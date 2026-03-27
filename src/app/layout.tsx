import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mall Sport",
  description: "Sistema de gestion de activos inmobiliarios",
  icons: {
    icon: "/MallSportLogo.png",
    shortcut: "/MallSportLogo.png",
    apple: "/MallSportLogo.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
