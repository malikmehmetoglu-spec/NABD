-- ============================================================
-- تنظيف بعد فحص Supabase Advisors — بلا تغيير في معنى الصلاحيات
--   • دوال الصلاحيات الداخلية تنتقل إلى مخطط private غير مكشوف عبر الـ API،
--     فلا يستدعيها أحد مباشرة عبر /rest/v1/rpc.
--   • btree_gist خارج مخطط public.
--   • auth.uid() داخل (select ...) في السياسات: يُحسب مرة لكل استعلام لا لكل صف.
--   • سياسة واحدة لكل عملية بدل سياسات متداخلة (for all + select).
--   • فهارس للمفاتيح الأجنبية.
-- ============================================================

-- ── 1. المخطط الخاص ─────────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- السياسات تشير إلى الدوال بمعرّفها الداخلي، فتبقى تعمل بعد النقل
alter function public.is_member(uuid) set schema private;
alter function public.is_member_any(uuid) set schema private;
alter function public.has_role(uuid, public.member_role[]) set schema private;
alter function public.can_write(uuid) set schema private;
alter function public.require_platform_admin() set schema private;

revoke all on function private.is_member(uuid), private.is_member_any(uuid),
  private.has_role(uuid, public.member_role[]), private.can_write(uuid), private.require_platform_admin()
  from public, anon;
grant execute on function private.is_member(uuid), private.is_member_any(uuid),
  private.has_role(uuid, public.member_role[]), private.can_write(uuid), private.require_platform_admin()
  to authenticated;

-- ── 2. الدوال التي تستدعي المساعدات بالاسم ──────────────────
create or replace function public.create_invite(p_clinic uuid, p_role public.member_role) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code  text;
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
begin
  if not private.has_role(p_clinic, '{owner}') then
    raise exception 'only the owner can invite' using errcode = '42501';
  end if;
  if not private.can_write(p_clinic) then
    raise exception 'subscription_inactive' using errcode = 'P0001';
  end if;
  if p_role = 'owner' then
    raise exception 'cannot invite an owner' using errcode = '23514';
  end if;
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(v_bytes, i) % 32), 1), '' order by i)
    into v_code from generate_series(0, 9) as i;
  insert into public.clinic_invites (code, clinic_id, role, created_by) values (v_code, p_clinic, p_role, auth.uid());
  return v_code;
end $$;

create or replace function public.join_clinic(p_code text, p_full_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.clinic_invites;
  v_max int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.clinic_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a clinic' using errcode = '23505';
  end if;
  select * into v_inv from public.clinic_invites
   where code = upper(trim(p_code)) and used_by is null and expires_at > now()
   for update;
  if not found then
    raise exception 'invalid or expired invite' using errcode = 'P0002';
  end if;
  if not private.can_write(v_inv.clinic_id) then
    raise exception 'subscription_inactive' using errcode = 'P0001';
  end if;
  perform 1 from public.clinics where id = v_inv.clinic_id for update;
  v_max := (public.clinic_limits(v_inv.clinic_id)).max_staff;
  if v_max is not null and (select count(*) from public.clinic_members where clinic_id = v_inv.clinic_id) >= v_max then
    raise exception 'plan_limit_staff' using errcode = 'P0001', hint = v_max::text;
  end if;
  insert into public.clinic_members (clinic_id, user_id, role, full_name)
       values (v_inv.clinic_id, auth.uid(), v_inv.role, p_full_name);
  update public.clinic_invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  return v_inv.clinic_id;
end $$;

create or replace function public.admin_clinics()
returns table (
  id uuid, name text, specialty text, phone text, created_at timestamptz,
  plan text, plan_name text, status public.clinic_status, expires_at timestamptz,
  max_staff int, max_patients int, max_staff_override int, max_patients_override int,
  owner_name text, owner_email text, staff_count int, patient_count int, last_payment_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform private.require_platform_admin();
  return query
  select c.id, c.name, c.specialty, c.phone, c.created_at,
         c.plan, p.name, c.status, c.expires_at,
         coalesce(c.max_staff_override, p.max_staff), coalesce(c.max_patients_override, p.max_patients),
         c.max_staff_override, c.max_patients_override,
         o.full_name, u.email::text,
         (select count(*)::int from public.clinic_members m where m.clinic_id = c.id),
         (select count(*)::int from public.patients x where x.clinic_id = c.id),
         (select max(s.paid_at) from public.subscription_payments s where s.clinic_id = c.id)
    from public.clinics c
    join public.plans p on p.code = c.plan
    left join public.clinic_members o on o.clinic_id = c.id and o.role = 'owner'
    left join auth.users u on u.id = o.user_id
   order by c.created_at desc;
end $$;

create or replace function public.admin_update_subscription(
  p_clinic uuid, p_plan text, p_status public.clinic_status, p_expires_at timestamptz,
  p_max_staff_override int default null, p_max_patients_override int default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_platform_admin();
  update public.clinics
     set plan = p_plan, status = p_status, expires_at = p_expires_at,
         max_staff_override = p_max_staff_override, max_patients_override = p_max_patients_override
   where id = p_clinic;
  if not found then
    raise exception 'clinic not found' using errcode = 'P0002';
  end if;
end $$;

create or replace function public.admin_record_payment(
  p_clinic uuid, p_plan text, p_months int, p_amount numeric, p_currency text default 'USD', p_note text default null
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_end timestamptz;
begin
  perform private.require_platform_admin();
  update public.clinics
     set plan = p_plan,
         expires_at = greatest(expires_at, now()) + make_interval(months => p_months)
   where id = p_clinic
  returning expires_at into v_end;
  if v_end is null then
    raise exception 'clinic not found' using errcode = 'P0002';
  end if;
  insert into public.subscription_payments (clinic_id, plan, months, amount, currency, note, period_end, recorded_by)
       values (p_clinic, p_plan, p_months, p_amount, upper(p_currency), nullif(trim(p_note), ''), v_end, auth.uid());
  return v_end;
end $$;

create or replace function public.admin_delete_clinic(p_clinic uuid, p_confirm_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_platform_admin();
  delete from public.clinics where id = p_clinic and name = p_confirm_name;
  if not found then
    raise exception 'name does not match' using errcode = 'P0002';
  end if;
end $$;

-- ── 3. btree_gist خارج public ───────────────────────────────
create schema if not exists extensions;
alter extension btree_gist set schema extensions;

-- ── 4. سياسات أسرع، بلا تداخل ───────────────────────────────
-- دور المستخدم الحالي في عيادة (definer: لا يمر بسياسات clinic_members فلا يدور عليها)
create function private.my_role(p_clinic uuid) returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.clinic_members where clinic_id = p_clinic and user_id = auth.uid();
$$;
revoke all on function private.my_role(uuid) from public, anon;
grant execute on function private.my_role(uuid) to authenticated;

-- الأعضاء: سياسة تعديل واحدة تجمع "أعدّل نفسي" و"المالك يعدّل غيره"
drop policy members_select on public.clinic_members;
drop policy members_self_update on public.clinic_members;
drop policy members_owner_update on public.clinic_members;
drop policy members_owner_delete on public.clinic_members;

create policy members_select on public.clinic_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(clinic_id) or public.is_platform_admin());

create policy members_update on public.clinic_members for update to authenticated
  using (
    user_id = (select auth.uid())
    or (private.has_role(clinic_id, '{owner}') and user_id <> (select auth.uid()))
  )
  with check (
    -- العضو يعدّل اسمه ولونه دون دوره
    (user_id = (select auth.uid()) and role = private.my_role(clinic_id))
    -- المالك يعدّل غيره، ولا يرقّي أحداً لمالك
    or (private.has_role(clinic_id, '{owner}') and user_id <> (select auth.uid()) and role <> 'owner')
  );

create policy members_delete on public.clinic_members for delete to authenticated
  using (private.has_role(clinic_id, '{owner}') and user_id <> (select auth.uid()) and role <> 'owner');

drop policy payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated
  with check (private.is_member(clinic_id) and created_by = (select auth.uid()));

-- المحتوى الطبي: القراءة لكل الأعضاء، والكتابة (إضافة، تعديل، حذف) للأطباء والمالك
do $$
declare
  t text;
  p text;
begin
  for t, p in values ('visits', 'visits_write'), ('prescriptions', 'rx_write'), ('prescription_items', 'rx_items_write') loop
    execute format('drop policy %I on public.%I', p, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.has_role(clinic_id, ''{owner,doctor}''))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.has_role(clinic_id, ''{owner,doctor}'')) with check (private.has_role(clinic_id, ''{owner,doctor}''))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.has_role(clinic_id, ''{owner,doctor}''))', t || '_delete', t);
  end loop;
end $$;

-- أدمن المنصة: لا قراءة مباشرة لأحد (التحقق عبر is_platform_admin فقط)
create policy platform_admins_none on public.platform_admins for select to authenticated using (false);

-- ── 5. فهارس المفاتيح الأجنبية ──────────────────────────────
create index if not exists appointments_doctor_idx           on public.appointments(clinic_id, doctor_id);
create index if not exists visits_doctor_idx                 on public.visits(clinic_id, doctor_id);
create index if not exists visits_appointment_idx            on public.visits(appointment_id);
create index if not exists prescriptions_clinic_idx          on public.prescriptions(clinic_id, doctor_id);
create index if not exists prescriptions_visit_idx           on public.prescriptions(visit_id);
create index if not exists prescription_items_clinic_idx     on public.prescription_items(clinic_id);
create index if not exists payments_visit_idx                on public.payments(visit_id);
create index if not exists payments_created_by_idx           on public.payments(created_by);
create index if not exists clinic_invites_created_by_idx     on public.clinic_invites(created_by);
create index if not exists clinic_invites_used_by_idx        on public.clinic_invites(used_by);
create index if not exists clinics_plan_idx                  on public.clinics(plan);
create index if not exists subscription_payments_plan_idx    on public.subscription_payments(plan);
create index if not exists subscription_payments_by_idx      on public.subscription_payments(recorded_by);
