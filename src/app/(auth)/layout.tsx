import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
      <div className="relative hidden overflow-hidden bg-linear-to-br from-brand-dark via-brand to-brand-light p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <svg viewBox="0 0 600 200" aria-hidden="true" className="absolute inset-x-0 top-1/3 w-full opacity-15">
          <path d="M0 120h170l24-70 34 120 28-80 22 30h322" fill="none" stroke="#fff" strokeWidth="4" />
        </svg>
        <Image src="/Logo_Nabd_icon.png" alt="" width={64} height={64} className="relative mb-6 rounded-2xl bg-white/15 p-2" />
        <h2 className="relative text-4xl font-extrabold">نبض</h2>
        <p className="relative mt-3 max-w-md text-lg leading-8 text-white/85">
          مواعيد العيادة وملفات المرضى والوصفات والمدفوعات، في مكان واحد.
        </p>
      </div>
    </div>
  );
}
