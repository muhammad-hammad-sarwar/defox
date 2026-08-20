import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Defox Cloud",
  description: "Cloud coding agent platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface">{children}</body>
    </html>
  );
}
