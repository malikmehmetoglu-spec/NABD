import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <EmptyState icon="search" title="الصفحة غير موجودة">
        <p>ربما حُذف هذا السجل أو أن الرابط غير صحيح.</p>
        <LinkButton href="/" variant="soft" className="mt-3">العودة للرئيسية</LinkButton>
      </EmptyState>
    </div>
  );
}
