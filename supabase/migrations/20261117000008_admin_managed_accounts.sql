-- ============================================================
-- الحسابات يديرها أدمن المنصة فقط
-- العيادات لا تسجّل بنفسها: تتواصل مع نبض، والأدمن ينشئ حساب المالك
-- والعيادة والطاقم ويرسل بيانات الدخول. لذلك:
--   • يُزال الإنشاء الذاتي (create_clinic) والدعوات (create_invite, join_clinic).
--   • admin_create_clinic و admin_add_member تربط حساباً موجوداً في Auth
--     (يُنشئه خادم التطبيق بمفتاح الخدمة) بعيادة، مع فحص صلاحية الأدمن وحدود الخطة.
-- ============================================================

-- ── 1. إزالة التسجيل الذاتي والدعوات ────────────────────────
drop function public.create_clinic(text, text, text, text, text);
drop function public.join_clinic(text, text);
drop function public.create_invite(uuid, public.member_role);
drop table public.clinic_invites;

-- ── 2. إنشاء عيادة مع مالكها ────────────────────────────────
create function public.admin_create_clinic(
  p_owner       uuid,
  p_name        text,
  p_owner_name  text,
  p_specialty   text default 'general',
  p_currency    text default 'SYP',
  p_phone       text default null,
  p_plan        text default 'trial',
  p_expires_at  timestamptz default now() + interval '14 days'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform private.require_platform_admin();
  if exists (select 1 from public.clinic_members where user_id = p_owner) then
    raise exception 'user already belongs to a clinic' using errcode = '23505';
  end if;
  if exists (select 1 from public.platform_admins where user_id = p_owner) then
    raise exception 'platform admins cannot own a clinic' using errcode = '23514';
  end if;
  insert into public.clinics (name, specialty, currency, phone, plan, expires_at)
       values (p_name, coalesce(p_specialty, 'general'), coalesce(p_currency, 'SYP'), p_phone,
               coalesce(p_plan, 'trial'), coalesce(p_expires_at, now() + interval '14 days'))
    returning id into v_id;
  insert into public.clinic_members (clinic_id, user_id, role, full_name)
       values (v_id, p_owner, 'owner', p_owner_name);
  return v_id;
end $$;

-- ── 3. إضافة طبيب أو سكرتير ─────────────────────────────────
create function public.admin_add_member(
  p_clinic uuid, p_user uuid, p_role public.member_role, p_full_name text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
begin
  perform private.require_platform_admin();
  if p_role = 'owner' then
    raise exception 'a clinic has one owner' using errcode = '23514';
  end if;
  if exists (select 1 from public.clinic_members where user_id = p_user) then
    raise exception 'user already belongs to a clinic' using errcode = '23505';
  end if;
  perform 1 from public.clinics where id = p_clinic for update;
  if not found then
    raise exception 'clinic not found' using errcode = 'P0002';
  end if;
  v_max := (public.clinic_limits(p_clinic)).max_staff;
  if v_max is not null and (select count(*) from public.clinic_members where clinic_id = p_clinic) >= v_max then
    raise exception 'plan_limit_staff' using errcode = 'P0001', hint = v_max::text;
  end if;
  insert into public.clinic_members (clinic_id, user_id, role, full_name)
       values (p_clinic, p_user, p_role, p_full_name);
end $$;

-- إزالة عضو (غير المالك). حسابه في Auth يحذفه خادم التطبيق بعدها.
create function public.admin_remove_member(p_clinic uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_platform_admin();
  delete from public.clinic_members where clinic_id = p_clinic and user_id = p_user and role <> 'owner';
  if not found then
    raise exception 'member not found or is the owner' using errcode = 'P0002';
  end if;
end $$;

-- ── 4. أعضاء العيادة مع بريدهم (لصفحة الأدمن) ───────────────
create function public.admin_clinic_members(p_clinic uuid)
returns table (user_id uuid, role public.member_role, full_name text, email text, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform private.require_platform_admin();
  return query
  select m.user_id, m.role, m.full_name, u.email::text, u.last_sign_in_at, m.created_at
    from public.clinic_members m
    left join auth.users u on u.id = m.user_id
   where m.clinic_id = p_clinic
   order by m.role, m.created_at;
end $$;

revoke all on function
  public.admin_create_clinic(uuid, text, text, text, text, text, text, timestamptz),
  public.admin_add_member(uuid, uuid, public.member_role, text),
  public.admin_remove_member(uuid, uuid),
  public.admin_clinic_members(uuid)
  from public, anon;
grant execute on function
  public.admin_create_clinic(uuid, text, text, text, text, text, text, timestamptz),
  public.admin_add_member(uuid, uuid, public.member_role, text),
  public.admin_remove_member(uuid, uuid),
  public.admin_clinic_members(uuid)
  to authenticated;

-- ── 5. المالك لم يعد يدير العضويات من التطبيق ───────────────
-- الإضافة والإزالة من لوحة الأدمن فقط. يبقى للعضو تعديل اسمه ولونه.
drop policy members_delete on public.clinic_members;
drop policy members_update on public.clinic_members;
create policy members_update on public.clinic_members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and role = private.my_role(clinic_id));
