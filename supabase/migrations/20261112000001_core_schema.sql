-- ============================================================
-- نبض — المخطط الأساسي للعيادات
-- كل جدول مرتبط بعيادة، وكل وصول يمر عبر سياسات RLS.
-- ============================================================

create extension if not exists btree_gist;

-- ── الأنواع ─────────────────────────────────────────────────
create type public.member_role as enum ('owner', 'doctor', 'secretary');
create type public.gender as enum ('male', 'female');
create type public.appointment_status as enum (
  'scheduled', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'
);
create type public.payment_method as enum ('cash', 'card', 'transfer');

-- ── العيادات ────────────────────────────────────────────────
create table public.clinics (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 120),
  specialty        text not null default 'general',
  phone            text,
  address          text,
  currency         text not null default 'SYP' check (currency ~ '^[A-Z]{3}$'),
  timezone         text not null default 'Asia/Damascus',
  default_fee      numeric(12,2) not null default 0 check (default_fee >= 0),
  slot_minutes     int not null default 15 check (slot_minutes between 5 and 240),
  next_file_number int not null default 1,
  created_at       timestamptz not null default now()
);

-- ── أعضاء العيادة (المالك، الأطباء، السكرتارية) ─────────────
create table public.clinic_members (
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null,
  full_name  text not null check (char_length(full_name) between 2 and 120),
  color      text not null default '#0863ba' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);
create index clinic_members_user_idx on public.clinic_members(user_id);

-- ── المرضى ──────────────────────────────────────────────────
create table public.patients (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references public.clinics(id) on delete cascade,
  file_number        int not null,
  full_name          text not null check (char_length(full_name) between 2 and 120),
  gender             public.gender not null,
  birth_date         date check (birth_date <= current_date),
  phone              text,
  blood_type         text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies          text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  notes              text,
  created_at         timestamptz not null default now(),
  unique (clinic_id, file_number)
);
create index patients_clinic_name_idx on public.patients(clinic_id, full_name);
create index patients_clinic_phone_idx on public.patients(clinic_id, phone);

-- رقم الإضبارة: تسلسلي لكل عيادة، يُحجز ذرّياً فلا يتكرر عند الإضافة المتزامنة
create function public.assign_file_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.clinics
     set next_file_number = next_file_number + 1
   where id = new.clinic_id
  returning next_file_number - 1 into new.file_number;
  return new;
end $$;

create trigger patients_file_number
  before insert on public.patients
  for each row execute function public.assign_file_number();

-- ── المواعيد ────────────────────────────────────────────────
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  patient_id   uuid not null references public.patients(id) on delete cascade,
  doctor_id    uuid not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  reason       text,
  status       public.appointment_status not null default 'scheduled',
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  foreign key (clinic_id, doctor_id) references public.clinic_members(clinic_id, user_id),
  -- منع الحجز المزدوج لنفس الطبيب (المواعيد الملغاة لا تحجز وقتاً)
  constraint appointments_no_overlap exclude using gist (
    doctor_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('cancelled', 'no_show'))
);
create index appointments_clinic_day_idx on public.appointments(clinic_id, starts_at);
create index appointments_patient_idx on public.appointments(patient_id);

-- ── الزيارات ────────────────────────────────────────────────
create table public.visits (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  patient_id     uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  doctor_id      uuid not null,
  visited_at     timestamptz not null default now(),
  complaint      text,
  diagnosis      text,
  notes          text,
  bp_systolic    int check (bp_systolic between 40 and 300),
  bp_diastolic   int check (bp_diastolic between 20 and 200),
  pulse          int check (pulse between 20 and 250),
  temperature    numeric(4,1) check (temperature between 30 and 45),
  weight_kg      numeric(5,1) check (weight_kg between 0.5 and 400),
  fee            numeric(12,2) not null default 0 check (fee >= 0),
  created_at     timestamptz not null default now(),
  foreign key (clinic_id, doctor_id) references public.clinic_members(clinic_id, user_id)
);
create index visits_patient_idx on public.visits(patient_id, visited_at desc);
create index visits_clinic_day_idx on public.visits(clinic_id, visited_at);

-- ── الوصفات ─────────────────────────────────────────────────
create table public.prescriptions (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id   uuid references public.visits(id) on delete cascade,
  doctor_id  uuid not null,
  notes      text,
  created_at timestamptz not null default now(),
  foreign key (clinic_id, doctor_id) references public.clinic_members(clinic_id, user_id)
);
create index prescriptions_patient_idx on public.prescriptions(patient_id, created_at desc);

create table public.prescription_items (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  clinic_id       uuid not null references public.clinics(id) on delete cascade,
  drug            text not null check (char_length(drug) between 1 and 200),
  dose            text,
  frequency       text,
  duration        text,
  instructions    text,
  position        int not null default 0
);
create index prescription_items_rx_idx on public.prescription_items(prescription_id, position);

-- ── المدفوعات ───────────────────────────────────────────────
create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id   uuid references public.visits(id) on delete set null,
  amount     numeric(12,2) not null check (amount > 0),
  method     public.payment_method not null default 'cash',
  paid_at    timestamptz not null default now(),
  note       text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index payments_clinic_day_idx on public.payments(clinic_id, paid_at);
create index payments_patient_idx on public.payments(patient_id);

-- ── سلامة الروابط: كل سجل فرعي يجب أن يتبع عيادة المريض نفسها ──
create function public.ensure_same_clinic() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.patients p where p.id = new.patient_id and p.clinic_id = new.clinic_id) then
    raise exception 'patient does not belong to this clinic' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger appointments_same_clinic before insert or update on public.appointments
  for each row execute function public.ensure_same_clinic();
create trigger visits_same_clinic before insert or update on public.visits
  for each row execute function public.ensure_same_clinic();
create trigger prescriptions_same_clinic before insert or update on public.prescriptions
  for each row execute function public.ensure_same_clinic();
create trigger payments_same_clinic before insert or update on public.payments
  for each row execute function public.ensure_same_clinic();

create function public.ensure_item_clinic() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.prescriptions r where r.id = new.prescription_id and r.clinic_id = new.clinic_id) then
    raise exception 'prescription does not belong to this clinic' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger prescription_items_same_clinic before insert or update on public.prescription_items
  for each row execute function public.ensure_item_clinic();

-- ── رصيد المريض ─────────────────────────────────────────────
create view public.patient_balances with (security_invoker = true) as
select p.id as patient_id,
       p.clinic_id,
       coalesce((select sum(v.fee) from public.visits v where v.patient_id = p.id), 0) as total_fees,
       coalesce((select sum(x.amount) from public.payments x where x.patient_id = p.id), 0) as total_paid
  from public.patients p;
