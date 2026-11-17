// اختبارات قاعدة البيانات: تشغيل migrations على Postgres داخل العملية،
// مع محاكاة مخطط auth الخاص بـ Supabase، ثم التحقق من عزل العيادات.
// التشغيل: npm run test:db
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const MIGRATIONS = join(import.meta.dirname, "..", "migrations");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const SEC = "00000000-0000-0000-0000-00000000000c";
const DOC = "00000000-0000-0000-0000-00000000000d";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const C = "00000000-0000-0000-0000-0000000000c1";
const C2 = "00000000-0000-0000-0000-0000000000c2";
const C3 = "00000000-0000-0000-0000-0000000000c3";

let db;

const AUTH_STUB = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated;
`;

/** تنفيذ استعلام بصفة مستخدم مسجل */
async function as(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.sub', $1, true)`, [uid]);
    await tx.exec("set local role authenticated");
    return tx.query(sql, params);
  });
}

before(async () => {
  db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${SEC}'), ('${DOC}'), ('${ADMIN}'), ('${C}'), ('${C2}'), ('${C3}')`);
  await db.exec(`insert into platform_admins values ('${ADMIN}')`);
});

let clinicA, clinicB, patientA;

test("the platform admin creates a clinic and its owner", async () => {
  clinicA = (await as(ADMIN, `select public.admin_create_clinic($1,'عيادة أ','د. أحمد','general','SYP') as id`, [A])).rows[0].id;
  clinicB = (await as(ADMIN, `select public.admin_create_clinic($1,'عيادة ب','د. بشرى','dental','SAR') as id`, [B])).rows[0].id;
  const { rows } = await as(A, `select role from clinic_members where clinic_id = $1`, [clinicA]);
  assert.equal(rows[0].role, "owner");
});

test("a user cannot own a second clinic, and only the admin creates clinics", async () => {
  await assert.rejects(as(ADMIN, `select public.admin_create_clinic($1,'ثانية','د. أحمد')`, [A]), /already belongs/);
  // ولا يستطيع مستخدم عادي إنشاء عيادة
  await assert.rejects(as(DOC, `select public.admin_create_clinic($1,'عيادتي','د. دانة')`, [DOC]), /platform admin only/);
});

test("file numbers are sequential per clinic", async () => {
  const p1 = await as(A, `insert into patients (clinic_id, full_name, gender) values ($1,'ريم','female') returning id, file_number`, [clinicA]);
  const p2 = await as(A, `insert into patients (clinic_id, full_name, gender) values ($1,'عمر','male') returning file_number`, [clinicA]);
  const p3 = await as(B, `insert into patients (clinic_id, full_name, gender) values ($1,'سارة','female') returning file_number`, [clinicB]);
  patientA = p1.rows[0].id;
  assert.deepEqual([p1.rows[0].file_number, p2.rows[0].file_number, p3.rows[0].file_number], [1, 2, 1]);
});

test("clinics cannot see each other's patients", async () => {
  const { rows } = await as(B, `select id from patients where clinic_id = $1`, [clinicA]);
  assert.equal(rows.length, 0);
});

test("clinics cannot write into another clinic", async () => {
  await assert.rejects(as(B, `insert into patients (clinic_id, full_name, gender) values ($1,'دخيل','male')`, [clinicA]));
});

test("an appointment cannot point at another clinic's patient", async () => {
  const pB = (await as(B, `select id from patients limit 1`)).rows[0].id;
  await assert.rejects(
    as(A, `insert into appointments (clinic_id, patient_id, doctor_id, starts_at, ends_at) values ($1,$2,$3, now(), now() + interval '15 min')`, [clinicA, pB, A]),
  );
});

test("double booking the same doctor is rejected", async () => {
  await as(A, `insert into appointments (clinic_id, patient_id, doctor_id, starts_at, ends_at) values ($1,$2,$3,'2026-12-01 10:00+03','2026-12-01 10:30+03')`, [clinicA, patientA, A]);
  await assert.rejects(
    as(A, `insert into appointments (clinic_id, patient_id, doctor_id, starts_at, ends_at) values ($1,$2,$3,'2026-12-01 10:15+03','2026-12-01 10:30+03')`, [clinicA, patientA, A]),
    /appointments_no_overlap/,
  );
  // بعد إلغاء الموعد يصبح الوقت متاحاً
  await as(A, `update appointments set status = 'cancelled' where starts_at = '2026-12-01 10:00+03'`);
  await as(A, `insert into appointments (clinic_id, patient_id, doctor_id, starts_at, ends_at) values ($1,$2,$3,'2026-12-01 10:15+03','2026-12-01 10:30+03')`, [clinicA, patientA, A]);
});

test("secretaries can book but cannot write medical records", async () => {
  await as(ADMIN, `select public.admin_add_member($1,$2,'secretary','سلمى')`, [clinicA, SEC]);
  const { rows } = await as(SEC, `select count(*)::int as n from patients`);
  assert.equal(rows[0].n, 2);
  await assert.rejects(
    as(SEC, `insert into visits (clinic_id, patient_id, doctor_id, complaint) values ($1,$2,$3,'صداع')`, [clinicA, patientA, A]),
  );
});

test("a secretary cannot promote herself", async () => {
  await as(SEC, `update clinic_members set role = 'owner' where user_id = $1`, [SEC]).catch(() => {});
  const { rows } = await as(A, `select role from clinic_members where user_id = $1`, [SEC]);
  assert.equal(rows[0].role, "secretary");
});

test("balances combine visit fees and payments", async () => {
  await as(A, `insert into visits (clinic_id, patient_id, doctor_id, fee) values ($1,$2,$3,5000)`, [clinicA, patientA, A]);
  await as(SEC, `insert into payments (clinic_id, patient_id, amount) values ($1,$2,3000)`, [clinicA, patientA]);
  const { rows } = await as(A, `select total_fees::int, total_paid::int from patient_balances where patient_id = $1`, [patientA]);
  assert.deepEqual(rows[0], { total_fees: 5000, total_paid: 3000 });
  const other = await as(B, `select * from patient_balances where patient_id = $1`, [patientA]);
  assert.equal(other.rows.length, 0);
});

test("save_visit stores visit, prescription, payment and closes the appointment atomically", async () => {
  const appt = (await as(A, `insert into appointments (clinic_id, patient_id, doctor_id, starts_at, ends_at, status)
     values ($1,$2,$3,'2026-12-02 09:00+03','2026-12-02 09:15+03','in_progress') returning id`, [clinicA, patientA, A])).rows[0].id;
  const payload = {
    clinic_id: clinicA, patient_id: patientA, appointment_id: appt, complaint: "صداع", fee: 4000, paid: 4000,
    bp_systolic: 130, bp_diastolic: 80,
    items: [{ drug: "باراسيتامول 500", dose: "حبة", frequency: "3 مرات يومياً" }, { drug: "فيتامين د" }],
  };
  const visit = (await as(A, `select public.save_visit($1::jsonb) as id`, [JSON.stringify(payload)])).rows[0].id;
  const items = await as(A, `select drug from prescription_items i join prescriptions r on r.id = i.prescription_id where r.visit_id = $1 order by position`, [visit]);
  assert.deepEqual(items.rows.map((r) => r.drug), ["باراسيتامول 500", "فيتامين د"]);
  const st = await as(A, `select status from appointments where id = $1`, [appt]);
  assert.equal(st.rows[0].status, "completed");
  const pay = await as(A, `select amount::int from payments where visit_id = $1`, [visit]);
  assert.equal(pay.rows[0].amount, 4000);
});

test("save_visit rolls back completely on a bad value", async () => {
  const before = (await as(A, `select count(*)::int n from visits`)).rows[0].n;
  await assert.rejects(as(A, `select public.save_visit($1::jsonb)`, [JSON.stringify({
    clinic_id: clinicA, patient_id: patientA, pulse: 900, items: [{ drug: "x" }],
  })]));
  const after = (await as(A, `select count(*)::int n from visits`)).rows[0].n;
  assert.equal(after, before);
});

test("a secretary cannot call save_visit", async () => {
  await assert.rejects(as(SEC, `select public.save_visit($1::jsonb)`, [JSON.stringify({ clinic_id: clinicA, patient_id: patientA })]));
});

test("completed appointments cannot jump back to scheduled", async () => {
  const appt = (await as(A, `select id from appointments where status = 'completed' limit 1`)).rows[0].id;
  await assert.rejects(as(A, `update appointments set status = 'scheduled' where id = $1`, [appt]), /invalid status change/);
});

test("only the platform admin adds staff, and a clinic has one owner", async () => {
  await assert.rejects(as(A, `select public.admin_add_member($1,$2,'doctor','د. دانة')`, [clinicA, DOC]), /platform admin only/);
  await assert.rejects(as(ADMIN, `select public.admin_add_member($1,$2,'owner','د. دانة')`, [clinicA, DOC]), /one owner/);
  await as(ADMIN, `select public.admin_add_member($1,$2,'doctor','د. دانة')`, [clinicA, DOC]);
  assert.equal((await as(DOC, `select role from clinic_members where user_id = $1`, [DOC])).rows[0].role, "doctor");
  await assert.rejects(as(ADMIN, `select public.admin_add_member($1,$2,'doctor','د. دانة')`, [clinicB, DOC]), /already belongs/);
  const members = await as(ADMIN, `select role, full_name from public.admin_clinic_members($1)`, [clinicA]);
  assert.deepEqual(members.rows.map((r) => r.role), ["owner", "doctor", "secretary"]);
  await assert.rejects(as(A, `select * from public.admin_clinic_members($1)`, [clinicA]), /platform admin only/);
});

test("anonymous visitors see nothing", async () => {
  await assert.rejects(
    db.transaction(async (tx) => { await tx.exec("set local role anon"); return tx.query("select * from patients"); }),
  );
});

// ── تشديد الصلاحيات (migration 0005) ─────────────────────────

test("a secretary cannot delete patients or appointments; the owner can", async () => {
  const tmp = (await as(A, `insert into patients (clinic_id, full_name, gender) values ($1,'مؤقت','male') returning id`, [clinicA])).rows[0].id;
  await as(SEC, `delete from patients where id = $1`, [tmp]);
  assert.equal((await as(A, `select count(*)::int as n from patients where id = $1`, [tmp])).rows[0].n, 1);
  const appt = (await as(A, `select id from appointments limit 1`)).rows[0].id;
  await as(SEC, `delete from appointments where id = $1`, [appt]);
  assert.equal((await as(A, `select count(*)::int as n from appointments where id = $1`, [appt])).rows[0].n, 1);
  await as(A, `delete from patients where id = $1`, [tmp]);
  assert.equal((await as(A, `select count(*)::int as n from patients where id = $1`, [tmp])).rows[0].n, 0);
});

test("members are added only by the platform admin, never by direct insert", async () => {
  await assert.rejects(
    as(A, `insert into clinic_members (clinic_id, user_id, role, full_name) values ($1,$2,'doctor','دخيل')`, [clinicA, B]),
  );
});

test("the owner cannot create a second owner, demote or remove herself", async () => {
  await as(A, `update clinic_members set role = 'owner' where user_id = $1`, [SEC]).catch(() => {});
  assert.equal((await as(A, `select role from clinic_members where user_id = $1`, [SEC])).rows[0].role, "secretary");
  await as(A, `update clinic_members set role = 'doctor' where user_id = $1`, [A]).catch(() => {});
  await as(A, `delete from clinic_members where user_id = $1`, [A]);
  assert.equal((await as(A, `select role from clinic_members where user_id = $1`, [A])).rows[0].role, "owner");
  // يعدّل اسمه فقط؛ أسماء الطاقم وعضوياتهم من لوحة الأدمن
  await as(A, `update clinic_members set full_name = 'د. أحمد علي' where user_id = $1`, [A]);
  await as(A, `update clinic_members set full_name = 'اسم آخر' where user_id = $1`, [SEC]);
  const names = (await as(A, `select full_name from clinic_members where user_id in ($1,$2) order by role`, [A, SEC])).rows;
  assert.deepEqual(names.map((r) => r.full_name), ["د. أحمد علي", "سلمى"]);
});

test("the owner edits clinic settings but not protected columns", async () => {
  await as(A, `update clinics set name = 'عيادة أ الجديدة', default_fee = 7000 where id = $1`, [clinicA]);
  assert.equal((await as(A, `select name from clinics where id = $1`, [clinicA])).rows[0].name, "عيادة أ الجديدة");
  await assert.rejects(as(A, `update clinics set next_file_number = 1 where id = $1`, [clinicA]), /permission denied/);
  await assert.rejects(as(A, `update clinics set created_at = now() - interval '1 year' where id = $1`, [clinicA]), /permission denied/);
});

test("appointments, visits and prescriptions need a doctor, not a secretary", async () => {
  await assert.rejects(
    as(A, `insert into appointments (clinic_id, patient_id, doctor_id, starts_at, ends_at) values ($1,$2,$3,'2026-12-02 10:00+03','2026-12-02 10:30+03')`, [clinicA, patientA, SEC]),
    /doctor_id must be a doctor/,
  );
  await assert.rejects(
    as(A, `insert into visits (clinic_id, patient_id, doctor_id) values ($1,$2,$3)`, [clinicA, patientA, SEC]),
    /doctor_id must be a doctor/,
  );
  // الطبيب المدعو مقبول
  await as(SEC, `insert into appointments (clinic_id, patient_id, doctor_id, starts_at, ends_at) values ($1,$2,$3,'2026-12-02 11:00+03','2026-12-02 11:30+03')`, [clinicA, patientA, DOC]);
});

test("only the admin removes staff, and a removed member loses access", async () => {
  await as(A, `delete from clinic_members where user_id = $1`, [SEC]);
  assert.equal((await as(SEC, `select count(*)::int as n from patients`)).rows[0].n > 0, true);
  await assert.rejects(as(ADMIN, `select public.admin_remove_member($1,$2)`, [clinicA, A]), /is the owner/);
  await as(ADMIN, `select public.admin_remove_member($1,$2)`, [clinicA, SEC]);
  assert.equal((await as(SEC, `select count(*)::int as n from patients`)).rows[0].n, 0);
});

// ── الاشتراكات والأدمن (migration 0006) ─────────────────────

let clinicC;

test("a new clinic starts on a 14-day trial", async () => {
  clinicC = (await as(ADMIN, `select public.admin_create_clinic($1,'عيادة ج','د. جود','general','USD') as id`, [C])).rows[0].id;
  const { rows } = await as(C, `select plan, status, round(extract(epoch from expires_at - now()) / 86400) as days from clinics where id = $1`, [clinicC]);
  assert.deepEqual({ plan: rows[0].plan, status: rows[0].status, days: Number(rows[0].days) }, { plan: "trial", status: "active", days: 14 });
});

test("the owner cannot change plan, status or expiry", async () => {
  for (const sql of [
    `update clinics set plan = 'enterprise' where id = $1`,
    `update clinics set status = 'active' where id = $1`,
    `update clinics set expires_at = now() + interval '10 years' where id = $1`,
    `update clinics set max_patients_override = 99999 where id = $1`,
  ]) await assert.rejects(as(C, sql, [clinicC]), /permission denied/);
  await assert.rejects(as(C, `insert into subscription_payments (clinic_id, plan, months, amount, period_end, recorded_by) values ($1,'pro',12,0,now(),$2)`, [clinicC, C]));
});

test("only platform admins can call admin functions", async () => {
  await assert.rejects(as(C, `select * from public.admin_clinics()`), /platform admin only/);
  await assert.rejects(as(C, `select public.admin_record_payment($1,'enterprise',12,0)`, [clinicC]), /platform admin only/);
  await assert.rejects(as(C, `select public.admin_update_subscription($1,'enterprise','active', now() + interval '1 year')`, [clinicC]), /platform admin only/);
  const { rows } = await as(ADMIN, `select name, owner_name, owner_email, plan, staff_count from public.admin_clinics() where id = $1`, [clinicC]);
  assert.deepEqual(rows[0], { name: "عيادة ج", owner_name: "د. جود", owner_email: null, plan: "trial", staff_count: 1 });
});

test("an expired clinic is read-only", async () => {
  const pid = (await as(C, `insert into patients (clinic_id, full_name, gender) values ($1,'منى','female') returning id`, [clinicC])).rows[0].id;
  await db.query(`update clinics set expires_at = now() - interval '1 day' where id = $1`, [clinicC]);
  assert.equal((await as(C, `select count(*)::int as n from patients where clinic_id = $1`, [clinicC])).rows[0].n, 1);
  await assert.rejects(as(C, `insert into patients (clinic_id, full_name, gender) values ($1,'جديد','male')`, [clinicC]));
  await as(C, `update patients set full_name = 'تعديل' where id = $1`, [pid]);
  assert.equal((await as(C, `select full_name from patients where id = $1`, [pid])).rows[0].full_name, "منى");
  await assert.rejects(as(C, `select public.save_visit($1::jsonb)`, [JSON.stringify({ clinic_id: clinicC, patient_id: pid, fee: 10 })]));
});

test("recording a payment extends from today when expired, from the expiry date otherwise", async () => {
  const end1 = (await as(ADMIN, `select public.admin_record_payment($1,'basic',1,5.99) as e`, [clinicC])).rows[0].e;
  const days1 = (new Date(end1) - Date.now()) / 86400000;
  assert.ok(days1 > 27 && days1 < 32, `expected ~1 month, got ${days1}`);
  const end2 = (await as(ADMIN, `select public.admin_record_payment($1,'basic',12,59,'usd','سنوي') as e`, [clinicC])).rows[0].e;
  const days2 = (new Date(end2) - new Date(end1)) / 86400000;
  assert.ok(days2 > 360 && days2 < 370, `expected ~1 year more, got ${days2}`);
  await as(C, `insert into patients (clinic_id, full_name, gender) values ($1,'بعد التجديد','male')`, [clinicC]);
  const pays = await as(C, `select plan, months, amount::float, currency from subscription_payments where clinic_id = $1 order by paid_at`, [clinicC]);
  assert.deepEqual(pays.rows.map((r) => r.months), [1, 12]);
  assert.equal(pays.rows[1].currency, "USD");
  assert.equal((await as(B, `select count(*)::int as n from subscription_payments`)).rows[0].n, 0);
});

test("the patient limit comes from the plan, and a per-clinic override wins", async () => {
  await as(ADMIN, `select public.admin_update_subscription($1,'basic','active', now() + interval '1 month', null, 3)`, [clinicC]);
  await as(C, `insert into patients (clinic_id, full_name, gender) values ($1,'ثالث','male')`, [clinicC]);
  await assert.rejects(as(C, `insert into patients (clinic_id, full_name, gender) values ($1,'رابع','male')`, [clinicC]), /plan_limit_patients/);
});

test("the staff limit is enforced when the admin adds members", async () => {
  // basic = عضوان: المالك + عضو واحد
  await as(ADMIN, `select public.admin_add_member($1,$2,'doctor','د. ثانٍ')`, [clinicC, C2]);
  await assert.rejects(as(ADMIN, `select public.admin_add_member($1,$2,'secretary','سكرتير')`, [clinicC, C3]), /plan_limit_staff/);
});

test("a suspended clinic sees no data but can still read its own status", async () => {
  await as(ADMIN, `select public.admin_update_subscription($1,'basic','suspended', now() + interval '1 month')`, [clinicC]);
  assert.equal((await as(C, `select count(*)::int as n from patients`)).rows[0].n, 0);
  assert.equal((await as(C2, `select count(*)::int as n from patients`)).rows[0].n, 0);
  const { rows } = await as(C, `select c.status from clinic_members m join clinics c on c.id = m.clinic_id where m.user_id = $1`, [C]);
  assert.equal(rows[0].status, "suspended");
  await as(ADMIN, `select public.admin_update_subscription($1,'basic','active', now() + interval '1 month')`, [clinicC]);
  assert.equal((await as(C, `select count(*)::int as n from patients`)).rows[0].n, 3);
});

test("deleting a clinic needs its exact name and removes everything", async () => {
  await assert.rejects(as(ADMIN, `select public.admin_delete_clinic($1,'اسم خطأ')`, [clinicC]), /name does not match/);
  await as(ADMIN, `select public.admin_delete_clinic($1,'عيادة ج')`, [clinicC]);
  const left = await db.query(`select (select count(*) from patients where clinic_id = $1)::int as p, (select count(*) from clinic_members where clinic_id = $1)::int as m`, [clinicC]);
  assert.deepEqual(left.rows[0], { p: 0, m: 0 });
});
