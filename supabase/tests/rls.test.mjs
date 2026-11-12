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

let db;

const AUTH_STUB = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
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
  await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${SEC}'), ('${DOC}')`);
});

let clinicA, clinicB, patientA;

test("create_clinic makes the caller the owner", async () => {
  clinicA = (await as(A, `select public.create_clinic('عيادة أ','general','SYP','د. أحمد') as id`)).rows[0].id;
  clinicB = (await as(B, `select public.create_clinic('عيادة ب','dental','SAR','د. بشرى') as id`)).rows[0].id;
  const { rows } = await as(A, `select role from clinic_members where clinic_id = $1`, [clinicA]);
  assert.equal(rows[0].role, "owner");
});

test("a user cannot create a second clinic", async () => {
  await assert.rejects(as(A, `select public.create_clinic('ثانية','general','SYP','د. أحمد')`));
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
  await as(A, `insert into clinic_members (clinic_id, user_id, role, full_name) values ($1,$2,'secretary','سلمى')`, [clinicA, SEC]);
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

test("invite codes: only owners create them, they work once", async () => {
  await assert.rejects(as(SEC, `select public.create_invite($1, 'doctor')`, [clinicA]));
  await assert.rejects(as(A, `select public.create_invite($1, 'owner')`, [clinicA]));
  const code = (await as(A, `select public.create_invite($1, 'doctor') as c`, [clinicA])).rows[0].c;
  assert.match(code, /^[A-Z2-9]{10}$/);
  const joined = (await as(DOC, `select public.join_clinic($1, 'د. دانة') as id`, [code.toLowerCase()])).rows[0].id;
  assert.equal(joined, clinicA);
  const role = (await as(DOC, `select role from clinic_members where user_id = $1`, [DOC])).rows[0].role;
  assert.equal(role, "doctor");
  await assert.rejects(as(B, `select public.join_clinic($1, 'x')`, [code]));
  const seen = await as(B, `select * from clinic_invites`);
  assert.equal(seen.rows.length, 0);
});

test("anonymous visitors see nothing", async () => {
  await assert.rejects(
    db.transaction(async (tx) => { await tx.exec("set local role anon"); return tx.query("select * from patients"); }),
  );
});
