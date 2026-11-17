-- ============================================================
-- تشديد الصلاحيات — إصلاح أربع ثغرات في السياسات الأولى
-- ============================================================

-- ── 1. حذف المريض للمالك فقط ────────────────────────────────
-- كانت patients_all تسمح لأي عضو (حتى السكرتارية) بحذف مريض،
-- والحذف يمسح زياراته ووصفاته ومدفوعاته معه. ينطبق نفس الشيء على المواعيد.
drop policy patients_all on public.patients;
create policy patients_select on public.patients for select using (public.is_member(clinic_id));
create policy patients_insert on public.patients for insert with check (public.is_member(clinic_id));
create policy patients_update on public.patients for update
  using (public.is_member(clinic_id)) with check (public.is_member(clinic_id));
create policy patients_delete on public.patients for delete using (public.has_role(clinic_id, '{owner}'));

drop policy appointments_all on public.appointments;
create policy appointments_select on public.appointments for select using (public.is_member(clinic_id));
create policy appointments_insert on public.appointments for insert with check (public.is_member(clinic_id));
create policy appointments_update on public.appointments for update
  using (public.is_member(clinic_id)) with check (public.is_member(clinic_id));
create policy appointments_delete on public.appointments for delete using (public.has_role(clinic_id, '{owner}'));

-- ── 2. العضويات: الانضمام عبر الدعوة فقط، ولا عيادة بلا مالك ──
-- كانت members_owner_write (for all) تسمح للمالك بإضافة أي مستخدم دون دعوة،
-- وبإضافة مالك ثانٍ، وبحذف نفسه فتبقى العيادة بلا مالك.
-- الإضافة الآن حصراً عبر create_clinic و join_clinic (security definer).
drop policy members_owner_write on public.clinic_members;

-- المالك يعدّل بيانات الآخرين (الاسم، اللون، الدور بين طبيب وسكرتارية) ولا يرقّي أحداً لمالك
create policy members_owner_update on public.clinic_members for update
  using (public.has_role(clinic_id, '{owner}') and user_id <> auth.uid())
  with check (public.has_role(clinic_id, '{owner}') and user_id <> auth.uid() and role <> 'owner');

-- المالك يزيل الأطباء والسكرتارية، لا نفسه ولا مالكاً آخر
create policy members_owner_delete on public.clinic_members for delete
  using (public.has_role(clinic_id, '{owner}') and user_id <> auth.uid() and role <> 'owner');

-- ── 3. المالك يعدّل الإعدادات فقط، لا كل الأعمدة ─────────────
-- سياسة clinics_update تحدد الصف؛ صلاحيات الأعمدة تحدد ما يُعدَّل فيه.
-- أي عمود يُضاف لاحقاً (الخطة، الحالة، تاريخ الانتهاء) يبقى غير قابل للتعديل
-- من التطبيق ما لم يُمنح صراحةً هنا.
revoke update on public.clinics from authenticated, anon;
grant update (name, specialty, phone, address, currency, timezone, default_fee, slot_minutes)
  on public.clinics to authenticated;

-- ── 4. الطبيب في الموعد والزيارة والوصفة يجب أن يكون طبيباً أو مالكاً ──
create function public.ensure_doctor_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.clinic_members m
     where m.clinic_id = new.clinic_id and m.user_id = new.doctor_id and m.role in ('owner', 'doctor')
  ) then
    raise exception 'doctor_id must be a doctor or owner of this clinic' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.ensure_doctor_role() from public, anon, authenticated;

create trigger appointments_doctor_role before insert or update of doctor_id, clinic_id on public.appointments
  for each row execute function public.ensure_doctor_role();
create trigger visits_doctor_role before insert or update of doctor_id, clinic_id on public.visits
  for each row execute function public.ensure_doctor_role();
create trigger prescriptions_doctor_role before insert or update of doctor_id, clinic_id on public.prescriptions
  for each row execute function public.ensure_doctor_role();
