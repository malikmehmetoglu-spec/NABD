-- ============================================================
-- الاشتراكات ولوحة إدارة المنصة
-- القواعد مفروضة هنا في قاعدة البيانات، لا في واجهة التطبيق:
--   • العيادة المعلّقة: لا يرى أعضاؤها أي بيانات.
--   • الاشتراك المنتهي: قراءة فقط، كل إضافة أو تعديل أو حذف مرفوض.
--   • حدود الخطة (الطاقم، المرضى) تُفحص عند الإدراج.
--   • الخطة والحالة وتاريخ الانتهاء لا يعدّلها إلا أدمن المنصة.
-- ============================================================

-- ── الخطط ───────────────────────────────────────────────────
create table public.plans (
  code          text primary key check (code ~ '^[a-z][a-z0-9_]{1,29}$'),
  name          text not null,
  max_staff     int check (max_staff > 0),     -- عدد الأعضاء مع المالك، null = بلا حد
  max_patients  int check (max_patients > 0),  -- null = بلا حد
  price_monthly numeric(10,2) not null default 0 check (price_monthly >= 0),
  price_yearly  numeric(10,2) not null default 0 check (price_yearly >= 0),
  sort          int not null default 0
);

insert into public.plans (code, name, max_staff, max_patients, price_monthly, price_yearly, sort) values
  ('trial',      'تجريبية', 3,    100,  0,     0,   0),
  ('basic',      'أساسية',  2,    300,  5.99,  59,  1),
  ('pro',        'احترافية', 4,   1000, 13.99, 139, 2),
  ('enterprise', 'شاملة',   null, null, 21.99, 219, 3);

alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated using (true);
revoke insert, update, delete on public.plans from authenticated, anon;

-- ── حالة الاشتراك على العيادة ───────────────────────────────
create type public.clinic_status as enum ('active', 'suspended');

alter table public.clinics
  add column plan                  text not null default 'trial' references public.plans(code),
  add column status                public.clinic_status not null default 'active',
  add column expires_at            timestamptz not null default now() + interval '14 days',
  add column max_staff_override    int check (max_staff_override > 0),
  add column max_patients_override int check (max_patients_override > 0);
-- لا تُضاف هذه الأعمدة إلى صلاحيات التعديل (migration 0005): المالك لا يغيّرها.

-- ── أدمن المنصة ─────────────────────────────────────────────
-- يُضاف يدوياً من SQL Editor:  insert into platform_admins (user_id) values ('<uuid>');
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- بلا سياسات: لا يقرؤه أحد من التطبيق، والتحقق عبر is_platform_admin()

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- ── مدفوعات الاشتراك ────────────────────────────────────────
create table public.subscription_payments (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  plan        text not null references public.plans(code),
  months      int not null check (months between 1 and 36),
  amount      numeric(10,2) not null check (amount >= 0),
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  note        text check (char_length(note) <= 300),
  period_end  timestamptz not null,
  recorded_by uuid not null references auth.users(id),
  paid_at     timestamptz not null default now()
);
create index subscription_payments_clinic_idx on public.subscription_payments(clinic_id, paid_at desc);
alter table public.subscription_payments enable row level security;
create policy subscription_payments_read on public.subscription_payments for select
  using (public.is_platform_admin() or public.has_role(clinic_id, '{owner}'));
revoke insert, update, delete on public.subscription_payments from authenticated, anon;

-- ── حالة الوصول ─────────────────────────────────────────────
-- العضوية وحدها (دون النظر للحالة): لقراءة صف العيادة وعضوية المستخدم نفسه،
-- حتى يرى المعلّق سبب الحجب بدل أن يبدو بلا عيادة.
create function public.is_member_any(p_clinic uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clinic_members where clinic_id = p_clinic and user_id = auth.uid());
$$;

-- العضوية الفعّالة: العيادة غير معلّقة
create or replace function public.is_member(p_clinic uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members m join public.clinics c on c.id = m.clinic_id
     where m.clinic_id = p_clinic and m.user_id = auth.uid() and c.status = 'active'
  );
$$;

create or replace function public.has_role(p_clinic uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members m join public.clinics c on c.id = m.clinic_id
     where m.clinic_id = p_clinic and m.user_id = auth.uid() and m.role = any(p_roles) and c.status = 'active'
  );
$$;

-- الكتابة مسموحة فقط لعيادة فعّالة واشتراكها ساري
create function public.can_write(p_clinic uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clinics where id = p_clinic and status = 'active' and expires_at > now());
$$;

drop policy clinics_select on public.clinics;
create policy clinics_select on public.clinics for select
  using (public.is_member_any(id) or public.is_platform_admin());

drop policy members_select on public.clinic_members;
create policy members_select on public.clinic_members for select
  using (user_id = auth.uid() or public.is_member(clinic_id) or public.is_platform_admin());

-- ── منع الكتابة عند انتهاء الاشتراك ─────────────────────────
-- سياسات restrictive تُضاف فوق الموجودة (AND)، فتغطي كل جدول دون إعادة كتابة سياساته.
do $$
declare
  t text;
  cmd text;
begin
  foreach t in array array['patients','appointments','visits','prescriptions','prescription_items',
                           'payments','clinic_members','clinic_invites'] loop
    execute format('create policy %I on public.%I as restrictive for insert with check (public.can_write(clinic_id))', t || '_writable_ins', t);
    execute format('create policy %I on public.%I as restrictive for update using (public.can_write(clinic_id)) with check (public.can_write(clinic_id))', t || '_writable_upd', t);
    execute format('create policy %I on public.%I as restrictive for delete using (public.can_write(clinic_id))', t || '_writable_del', t);
  end loop;
end $$;
create policy clinics_writable_upd on public.clinics as restrictive for update
  using (public.can_write(id)) with check (public.can_write(id));

-- ── حدود الخطة ──────────────────────────────────────────────
create function public.clinic_limits(p_clinic uuid, out max_staff int, out max_patients int)
language sql stable security definer set search_path = public as $$
  select coalesce(c.max_staff_override, p.max_staff), coalesce(c.max_patients_override, p.max_patients)
    from public.clinics c join public.plans p on p.code = c.plan
   where c.id = p_clinic;
$$;

create function public.enforce_patient_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_max int := (public.clinic_limits(new.clinic_id)).max_patients;
begin
  if v_max is not null and (select count(*) from public.patients where clinic_id = new.clinic_id) >= v_max then
    raise exception 'plan_limit_patients' using errcode = 'P0001', hint = v_max::text;
  end if;
  return new;
end $$;
create trigger patients_plan_limit before insert on public.patients
  for each row execute function public.enforce_patient_limit();

-- الانضمام بدعوة: يفحص صلاحية الاشتراك وحد الطاقم
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
  if not public.can_write(v_inv.clinic_id) then
    raise exception 'subscription_inactive' using errcode = 'P0001';
  end if;
  -- قفل صف العيادة حتى لا يتجاوز انضمامان متزامنان الحد
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

create or replace function public.create_invite(p_clinic uuid, p_role public.member_role) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code  text;
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
begin
  if not public.has_role(p_clinic, '{owner}') then
    raise exception 'only the owner can invite' using errcode = '42501';
  end if;
  if not public.can_write(p_clinic) then
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

-- ── وظائف الأدمن ────────────────────────────────────────────
create function public.require_platform_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only' using errcode = '42501';
  end if;
end $$;

-- قائمة العيادات مع المالك والاستخدام (البريد من auth.users لا يصله التطبيق مباشرة)
create function public.admin_clinics()
returns table (
  id uuid, name text, specialty text, phone text, created_at timestamptz,
  plan text, plan_name text, status public.clinic_status, expires_at timestamptz,
  max_staff int, max_patients int, max_staff_override int, max_patients_override int,
  owner_name text, owner_email text, staff_count int, patient_count int, last_payment_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
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

-- تعديل الاشتراك يدوياً (الخطة، تاريخ الانتهاء، الحدود الخاصة، التعليق)
create function public.admin_update_subscription(
  p_clinic uuid, p_plan text, p_status public.clinic_status, p_expires_at timestamptz,
  p_max_staff_override int default null, p_max_patients_override int default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
  update public.clinics
     set plan = p_plan, status = p_status, expires_at = p_expires_at,
         max_staff_override = p_max_staff_override, max_patients_override = p_max_patients_override
   where id = p_clinic;
  if not found then
    raise exception 'clinic not found' using errcode = 'P0002';
  end if;
end $$;

-- تسجيل دفعة: يثبّت الخطة ويمدد الاشتراك من تاريخ انتهائه (أو من اليوم إن كان منتهياً)
create function public.admin_record_payment(
  p_clinic uuid, p_plan text, p_months int, p_amount numeric, p_currency text default 'USD', p_note text default null
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_end timestamptz;
begin
  perform public.require_platform_admin();
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

-- حذف نهائي: يتطلب كتابة اسم العيادة كما هو، ويحذف كل بياناتها (cascade)
create function public.admin_delete_clinic(p_clinic uuid, p_confirm_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_platform_admin();
  delete from public.clinics where id = p_clinic and name = p_confirm_name;
  if not found then
    raise exception 'name does not match' using errcode = 'P0002';
  end if;
end $$;

-- ── الصلاحيات على الدوال ────────────────────────────────────
revoke all on function public.is_member_any(uuid), public.can_write(uuid), public.clinic_limits(uuid),
  public.is_platform_admin(), public.require_platform_admin(),
  public.admin_clinics(), public.admin_update_subscription(uuid, text, public.clinic_status, timestamptz, int, int),
  public.admin_record_payment(uuid, text, int, numeric, text, text), public.admin_delete_clinic(uuid, text)
  from public, anon;
grant execute on function public.is_member_any(uuid), public.can_write(uuid), public.clinic_limits(uuid),
  public.is_platform_admin(), public.require_platform_admin(),
  public.admin_clinics(), public.admin_update_subscription(uuid, text, public.clinic_status, timestamptz, int, int),
  public.admin_record_payment(uuid, text, int, numeric, text, text), public.admin_delete_clinic(uuid, text)
  to authenticated;
revoke all on function public.enforce_patient_limit() from public, anon, authenticated;
