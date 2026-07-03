import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Marinita",
  description: "Analisis y exportacion de gastos desde Excel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
