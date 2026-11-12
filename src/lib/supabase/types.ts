// أنواع قاعدة البيانات — مطابقة لملفات supabase/migrations.
// بعد ربط المشروع يمكن توليدها تلقائياً: npx supabase gen types typescript --linked

export type MemberRole = "owner" | "doctor" | "secretary";
export type Gender = "male" | "female";
export type AppointmentStatus =
  | "scheduled"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";
export type PaymentMethod = "cash" | "card" | "transfer";

type Rel<Col extends string, To extends string> = {
  foreignKeyName: `${Col}_fkey`;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: To;
  referencedColumns: ["id"];
};

type Table<Row, Required extends keyof Row, Optional extends keyof Row = never, R extends unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: R;
};

type ToPatient = Rel<"patient_id", "patients">;

export type Clinic = {
  id: string;
  name: string;
  specialty: string;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  default_fee: number;
  slot_minutes: number;
  next_file_number: number;
  created_at: string;
};

export type ClinicMember = {
  clinic_id: string;
  user_id: string;
  role: MemberRole;
  full_name: string;
  color: string;
  created_at: string;
};

export type Patient = {
  id: string;
  clinic_id: string;
  file_number: number;
  full_name: string;
  gender: Gender;
  birth_date: string | null;
  phone: string | null;
  blood_type: string | null;
  allergies: string[];
  chronic_conditions: string[];
  notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  status: AppointmentStatus;
  created_at: string;
};

export type Visit = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  doctor_id: string;
  visited_at: string;
  complaint: string | null;
  diagnosis: string | null;
  notes: string | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  weight_kg: number | null;
  fee: number;
  created_at: string;
};

export type Prescription = {
  id: string;
  clinic_id: string;
  patient_id: string;
  visit_id: string | null;
  doctor_id: string;
  notes: string | null;
  created_at: string;
};

export type PrescriptionItem = {
  id: string;
  prescription_id: string;
  clinic_id: string;
  drug: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  position: number;
};

export type Payment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  visit_id: string | null;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  note: string | null;
  created_by: string;
  created_at: string;
};

export type ClinicInvite = {
  code: string;
  clinic_id: string;
  role: MemberRole;
  created_by: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
};

export type PatientBalance = {
  patient_id: string;
  clinic_id: string;
  total_fees: number;
  total_paid: number;
};

export type Database = {
  public: {
    Tables: {
      clinics: Table<Clinic, "name", Exclude<keyof Clinic, "name">>;
      clinic_members: Table<ClinicMember, "clinic_id" | "user_id" | "role" | "full_name", "color" | "created_at">;
      patients: Table<Patient, "clinic_id" | "full_name" | "gender", Exclude<keyof Patient, "clinic_id" | "full_name" | "gender">>;
      appointments: Table<Appointment, "clinic_id" | "patient_id" | "doctor_id" | "starts_at" | "ends_at", "id" | "reason" | "status" | "created_at", [ToPatient]>;
      visits: Table<Visit, "clinic_id" | "patient_id" | "doctor_id", Exclude<keyof Visit, "clinic_id" | "patient_id" | "doctor_id">, [ToPatient, Rel<"appointment_id", "appointments">]>;
      prescriptions: Table<Prescription, "clinic_id" | "patient_id" | "doctor_id", "id" | "visit_id" | "notes" | "created_at", [ToPatient, Rel<"visit_id", "visits">]>;
      prescription_items: Table<PrescriptionItem, "prescription_id" | "clinic_id" | "drug", Exclude<keyof PrescriptionItem, "prescription_id" | "clinic_id" | "drug">, [Rel<"prescription_id", "prescriptions">]>;
      clinic_invites: Table<ClinicInvite, "code" | "clinic_id" | "role" | "created_by", "expires_at" | "used_by" | "used_at" | "created_at">;
      payments: Table<Payment, "clinic_id" | "patient_id" | "amount", Exclude<keyof Payment, "clinic_id" | "patient_id" | "amount">, [ToPatient, Rel<"visit_id", "visits">]>;
    };
    Views: {
      patient_balances: { Row: PatientBalance; Relationships: [] };
    };
    Functions: {
      create_clinic: {
        Args: { p_name: string; p_specialty: string; p_currency: string; p_owner_name: string; p_phone?: string | null };
        Returns: string;
      };
      save_visit: { Args: { p: Record<string, unknown> }; Returns: string };
      create_invite: { Args: { p_clinic: string; p_role: MemberRole }; Returns: string };
      join_clinic: { Args: { p_code: string; p_full_name: string }; Returns: string };
    };
    Enums: {
      member_role: MemberRole;
      gender: Gender;
      appointment_status: AppointmentStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
};
