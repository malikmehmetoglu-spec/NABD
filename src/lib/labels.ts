import type { AppointmentStatus, Gender, MemberRole, PaymentMethod } from "@/lib/supabase/types";

export const SPECIALTIES: Record<string, string> = {
  general: "طب عام",
  internal_medicine: "باطنية",
  pediatrics: "أطفال",
  gynecology: "نسائية وتوليد",
  dental: "أسنان",
  dermatology: "جلدية",
  cosmetic: "تجميل",
  cardiology: "قلبية",
  neurology: "عصبية",
  endocrinology: "غدد وسكري",
  pulmonology: "صدرية",
  gastroenterology: "هضمية",
  nephrology: "كلية",
  rheumatology: "مفاصل وروماتيزم",
  general_surgery: "جراحة عامة",
  orthopedic: "عظمية",
  ophthalmology: "عينية",
  ent: "أذن وأنف وحنجرة",
  urology: "بولية",
  physical_therapy: "علاج فيزيائي",
  mental_health: "صحة نفسية",
  nutrition: "تغذية",
  other: "أخرى",
};

export const CURRENCIES: Record<string, { name: string; symbol: string; decimals: number }> = {
  SYP: { name: "ليرة سورية", symbol: "ل.س", decimals: 0 },
  USD: { name: "دولار أمريكي", symbol: "$", decimals: 2 },
  EUR: { name: "يورو", symbol: "€", decimals: 2 },
  TRY: { name: "ليرة تركية", symbol: "₺", decimals: 2 },
  SAR: { name: "ريال سعودي", symbol: "ر.س", decimals: 2 },
  AED: { name: "درهم إماراتي", symbol: "د.إ", decimals: 2 },
  JOD: { name: "دينار أردني", symbol: "د.أ", decimals: 3 },
  LBP: { name: "ليرة لبنانية", symbol: "ل.ل", decimals: 0 },
  IQD: { name: "دينار عراقي", symbol: "د.ع", decimals: 0 },
  EGP: { name: "جنيه مصري", symbol: "ج.م", decimals: 2 },
  KWD: { name: "دينار كويتي", symbol: "د.ك", decimals: 3 },
  QAR: { name: "ريال قطري", symbol: "ر.ق", decimals: 2 },
};

export function formatMoney(amount: number, currency: string) {
  const c = CURRENCIES[currency] ?? { symbol: currency, decimals: 2 };
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: c.decimals,
  }).format(amount);
  return `${n} ${c.symbol}`;
}

export const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export const GENDER: Record<Gender, string> = { male: "ذكر", female: "أنثى" };
export const ROLE: Record<MemberRole, string> = { owner: "مالك العيادة", doctor: "طبيب", secretary: "سكرتارية" };
export const PAYMENT_METHOD: Record<PaymentMethod, string> = { cash: "نقداً", card: "بطاقة", transfer: "تحويل" };

export type Tone = "brand" | "orange" | "purple" | "green" | "teal" | "danger" | "neutral";

export const STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "محدد", tone: "neutral" },
  arrived: { label: "في الانتظار", tone: "orange" },
  in_progress: { label: "عند الطبيب", tone: "brand" },
  completed: { label: "مكتمل", tone: "green" },
  cancelled: { label: "ملغي", tone: "danger" },
  no_show: { label: "لم يحضر", tone: "neutral" },
};

/** الانتقالات المسموحة بين حالات الموعد */
export const NEXT_STATUS: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["arrived", "cancelled", "no_show"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: ["scheduled"],
  no_show: ["scheduled"],
};

export const STATUS_ACTION: Partial<Record<AppointmentStatus, string>> = {
  arrived: "وصل",
  in_progress: "إدخال للطبيب",
  completed: "إنهاء",
  cancelled: "إلغاء",
  no_show: "لم يحضر",
  scheduled: "إعادة تفعيل",
};

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const TIMEZONES = [
  "Asia/Damascus", "Asia/Beirut", "Asia/Amman", "Asia/Baghdad", "Asia/Riyadh", "Asia/Dubai",
  "Asia/Kuwait", "Asia/Qatar", "Africa/Cairo", "Europe/Istanbul", "Europe/Berlin", "Europe/London",
] as const;
