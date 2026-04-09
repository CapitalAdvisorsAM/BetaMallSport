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
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
