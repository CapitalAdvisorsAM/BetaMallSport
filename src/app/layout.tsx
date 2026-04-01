import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mall Sport",
  description: "Sistema de gestion de activos inmobiliarios",
  icons: {
    icon: "/MallSportLogo.jpg",
    shortcut: "/MallSportLogo.jpg",
    apple: "/MallSportLogo.jpg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
