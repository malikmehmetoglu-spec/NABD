import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "نبض", template: "%s · نبض" },
  description: "نبض — إدارة العيادات",
  icons: { icon: "/favicon-48.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0863ba", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- خط واحد للتطبيق كله في الـ root layout */}
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300..900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
