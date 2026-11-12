"use client";

import { Button, Card, EmptyState } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <EmptyState icon="alert" title="حدث خطأ أثناء تحميل الصفحة">
        <p>تحقق من الاتصال بالإنترنت ثم أعد المحاولة.</p>
        <Button variant="soft" className="mt-3" onClick={reset}>إعادة المحاولة</Button>
      </EmptyState>
    </Card>
  );
}
