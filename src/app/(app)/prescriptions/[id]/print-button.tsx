"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return <Button icon="print" onClick={() => window.print()}>طباعة</Button>;
}
