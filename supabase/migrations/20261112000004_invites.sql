-- ============================================================
-- دعوة الطاقم: المالك يولّد رمزاً، والطبيب أو السكرتير يدخله بعد التسجيل.
-- لا حاجة لمفتاح الخدمة في التطبيق.
-- ============================================================
create table public.clinic_invites (
  code       text primary key,
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  role       public.member_role not null check (role <> 'owner'),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users(id),
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index clinic_invites_clinic_idx on public.clinic_invites(clinic_id);

alter table public.clinic_invites enable row level security;
create policy invites_owner_select on public.clinic_invites for select using (public.has_role(clinic_id, '{owner}'));
create policy invites_owner_delete on public.clinic_invites for delete using (public.has_role(clinic_id, '{owner}'));

create function public.create_invite(p_clinic uuid, p_role public.member_role) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code  text;
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
begin
  if not public.has_role(p_clinic, '{owner}') then
    raise exception 'only the owner can invite' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'cannot invite an owner' using errcode = '23514';
  end if;
  -- 10 أحرف من أبجدية بلا أحرف ملتبسة (0/O، 1/I)
  -- البايتات من gen_random_uuid (عشوائية آمنة ومتاحة دون إضافات)
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(v_bytes, i) % 32), 1), '' order by i)
    into v_code from generate_series(0, 9) as i;
  insert into public.clinic_invites (code, clinic_id, role, created_by) values (v_code, p_clinic, p_role, auth.uid());
  return v_code;
end $$;

create function public.join_clinic(p_code text, p_full_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_inv public.clinic_invites;
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
  insert into public.clinic_members (clinic_id, user_id, role, full_name)
       values (v_inv.clinic_id, auth.uid(), v_inv.role, p_full_name);
  update public.clinic_invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  return v_inv.clinic_id;
end $$;

revoke all on function public.create_invite(uuid, public.member_role) from public, anon;
revoke all on function public.join_clinic(text, text) from public, anon;
grant execute on function public.create_invite(uuid, public.member_role) to authenticated;
grant execute on function public.join_clinic(text, text) to authenticated;
