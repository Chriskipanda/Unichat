import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UniChat Enterprise — Admin",
  description: "SuperAdmin platform console for UniChat Enterprise",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
