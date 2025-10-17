import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Speed Test",
  description: "Internet speed test - measure your download and upload speeds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
