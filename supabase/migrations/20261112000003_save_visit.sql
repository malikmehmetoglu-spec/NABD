-- ============================================================
-- حفظ الزيارة كعملية واحدة: الزيارة + الوصفة + الدفعة + إغلاق الموعد.
-- إما أن ينجح كل شيء أو لا يُحفظ شيء. تعمل بصلاحيات المستخدم (RLS مطبّقة).
-- ============================================================
create function public.save_visit(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_visit   uuid;
  v_rx      uuid;
  v_clinic  uuid := (p->>'clinic_id')::uuid;
  v_patient uuid := (p->>'patient_id')::uuid;
  v_appt    uuid := nullif(p->>'appointment_id', '')::uuid;
  v_item    jsonb;
  v_pos     int := 0;
begin
  insert into visits (clinic_id, patient_id, appointment_id, doctor_id, complaint, diagnosis, notes,
                      bp_systolic, bp_diastolic, pulse, temperature, weight_kg, fee)
  values (v_clinic, v_patient, v_appt, auth.uid(),
          p->>'complaint', p->>'diagnosis', p->>'notes',
          (p->>'bp_systolic')::int, (p->>'bp_diastolic')::int, (p->>'pulse')::int,
          (p->>'temperature')::numeric, (p->>'weight_kg')::numeric, coalesce((p->>'fee')::numeric, 0))
  returning id into v_visit;

  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) > 0 then
    insert into prescriptions (clinic_id, patient_id, visit_id, doctor_id, notes)
    values (v_clinic, v_patient, v_visit, auth.uid(), p->>'rx_notes')
    returning id into v_rx;

    for v_item in select * from jsonb_array_elements(p->'items') loop
      insert into prescription_items (prescription_id, clinic_id, drug, dose, frequency, duration, instructions, position)
      values (v_rx, v_clinic, v_item->>'drug', v_item->>'dose', v_item->>'frequency',
              v_item->>'duration', v_item->>'instructions', v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;

  if coalesce((p->>'paid')::numeric, 0) > 0 then
    insert into payments (clinic_id, patient_id, visit_id, amount, method)
    values (v_clinic, v_patient, v_visit, (p->>'paid')::numeric, coalesce((p->>'method')::payment_method, 'cash'));
  end if;

  if v_appt is not null then
    update appointments set status = 'completed'
     where id = v_appt and clinic_id = v_clinic and patient_id = v_patient;
  end if;

  return v_visit;
end $$;

revoke all on function public.save_visit(jsonb) from public, anon;
grant execute on function public.save_visit(jsonb) to authenticated;

-- ── قيود إضافية على حالات المواعيد: لا قفز غير منطقي بين الحالات ──
create function public.check_appointment_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status = new.status then return new; end if;
  if not (
    (old.status = 'scheduled'   and new.status in ('arrived','cancelled','no_show','in_progress','completed')) or
    (old.status = 'arrived'     and new.status in ('in_progress','cancelled','completed','scheduled')) or
    (old.status = 'in_progress' and new.status in ('completed','arrived')) or
    (old.status in ('cancelled','no_show') and new.status = 'scheduled')
  ) then
    raise exception 'invalid status change % -> %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end $$;

create trigger appointments_transition before update of status on public.appointments
  for each row execute function public.check_appointment_transition();
