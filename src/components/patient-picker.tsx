"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { searchPatients } from "@/app/(app)/patients/actions";
import { cx } from "./ui";

type Option = { id: string; full_name: string; phone: string | null; file_number: number };

/** مربع بحث عن مريض، يكتب معرّفه في حقل مخفي باسم `name` */
export function PatientPicker({ name = "patient_id", initial, invalid }: { name?: string; initial?: Option | null; invalid?: boolean }) {
  const [selected, setSelected] = useState<Option | null>(initial ?? null);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => start(async () => setOptions(await searchPatients(q))), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (o: Option) => {
    setSelected(o);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={box} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-between rounded-xl border-[1.5px] border-line bg-white px-3.5 text-start text-sm"
        >
          <span className="font-semibold">{selected.full_name}</span>
          <span className="text-xs text-muted">#{selected.file_number} · تغيير</span>
        </button>
      ) : (
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid}
          autoFocus={open && !!selected}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && open && options[active]) { e.preventDefault(); choose(options[active]); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="ابحث باسم المريض أو هاتفه أو رقم إضبارته"
          className="h-11 w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 text-sm placeholder:text-faint focus:border-brand focus:ring-4 focus:ring-sky focus:outline-none aria-invalid:border-danger"
        />
      )}
      {open && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-auto rounded-xl border-[1.5px] border-line bg-white p-1 shadow-[0_12px_32px_rgba(8,99,186,.14)]">
          {options.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">{pending ? "جارٍ البحث..." : "لا نتائج"}</li>
          ) : (
            options.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                onMouseEnter={() => setActive(i)}
                className={cx("flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm", i === active && "bg-sky")}
              >
                <span className="font-semibold">{o.full_name}</span>
                <span className="text-xs text-muted" dir="ltr">{o.phone ?? `#${o.file_number}`}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
