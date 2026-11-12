-- ============================================================
-- نبض — الصلاحيات (Row Level Security)
-- القاعدة: المستخدم يرى ويعدّل بيانات العيادات التي هو عضو فيها فقط.
-- ============================================================

-- هل المستخدم الحالي عضو في العيادة؟ (security definer لتجنب الدوران في سياسات clinic_members)
create function public.is_member(p_clinic uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members
     where clinic_id = p_clinic and user_id = auth.uid()
  );
$$;

create function public.has_role(p_clinic uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members
     where clinic_id = p_clinic and user_id = auth.uid() and role = any(p_roles)
  );
$$;

alter table public.clinics            enable row level security;
alter table public.clinic_members     enable row level security;
alter table public.patients           enable row level security;
alter table public.appointments       enable row level security;
alter table public.visits             enable row level security;
alter table public.prescriptions      enable row level security;
alter table public.prescription_items enable row level security;
alter table public.payments           enable row level security;

-- ── العيادات: القراءة للأعضاء، التعديل للمالك، الإنشاء عبر create_clinic فقط ──
create policy clinics_select on public.clinics for select using (public.is_member(id));
create policy clinics_update on public.clinics for update
  using (public.has_role(id, '{owner}')) with check (public.has_role(id, '{owner}'));

-- ── الأعضاء: يرى زملاءه، والمالك يدير العضويات ──
create policy members_select on public.clinic_members for select using (public.is_member(clinic_id));
create policy members_owner_write on public.clinic_members for all
  using (public.has_role(clinic_id, '{owner}')) with check (public.has_role(clinic_id, '{owner}'));
create policy members_self_update on public.clinic_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and role = (
    select m.role from public.clinic_members m where m.clinic_id = clinic_members.clinic_id and m.user_id = auth.uid()
  ));

-- ── المرضى والمواعيد والمدفوعات: كل الأعضاء ──
create policy patients_all on public.patients for all
  using (public.is_member(clinic_id)) with check (public.is_member(clinic_id));
create policy appointments_all on public.appointments for all
  using (public.is_member(clinic_id)) with check (public.is_member(clinic_id));
create policy payments_select on public.payments for select using (public.is_member(clinic_id));
create policy payments_insert on public.payments for insert
  with check (public.is_member(clinic_id) and created_by = auth.uid());
create policy payments_delete on public.payments for delete using (public.has_role(clinic_id, '{owner}'));

-- ── المحتوى الطبي: القراءة لكل الأعضاء، الكتابة للأطباء والمالك فقط ──
create policy visits_select on public.visits for select using (public.is_member(clinic_id));
create policy visits_write on public.visits for all
  using (public.has_role(clinic_id, '{owner,doctor}')) with check (public.has_role(clinic_id, '{owner,doctor}'));

create policy rx_select on public.prescriptions for select using (public.is_member(clinic_id));
create policy rx_write on public.prescriptions for all
  using (public.has_role(clinic_id, '{owner,doctor}')) with check (public.has_role(clinic_id, '{owner,doctor}'));

create policy rx_items_select on public.prescription_items for select using (public.is_member(clinic_id));
create policy rx_items_write on public.prescription_items for all
  using (public.has_role(clinic_id, '{owner,doctor}')) with check (public.has_role(clinic_id, '{owner,doctor}'));

-- ── إنشاء عيادة: يصبح المنشئ مالكها، في عملية واحدة ──
create function public.create_clinic(
  p_name text, p_specialty text, p_currency text, p_owner_name text, p_phone text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.clinic_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a clinic' using errcode = '23505';
  end if;
  insert into public.clinics (name, specialty, currency, phone)
       values (p_name, coalesce(p_specialty, 'general'), coalesce(p_currency, 'SYP'), p_phone)
    returning id into v_id;
  insert into public.clinic_members (clinic_id, user_id, role, full_name)
       values (v_id, auth.uid(), 'owner', p_owner_name);
  return v_id;
end $$;

revoke all on function public.create_clinic(text, text, text, text, text) from public, anon;
grant execute on function public.create_clinic(text, text, text, text, text) to authenticated;
revoke all on function public.assign_file_number() from public, anon, authenticated;

-- لا وصول للزوار غير المسجلين إلى أي جدول
revoke all on all tables in schema public from anon;
