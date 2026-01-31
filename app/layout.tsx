import React from "react";

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import RootLayoutClient from "./root"; // Client-side wrapper component

// Load Google Fonts with CSS variables for easy usage
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IT Portal ERP System",
  description: "Developed by IT Team and Leroux Y Xchire",
  icons: {
    icon: "/xchire-logo.png",
    shortcut: "/xchire-logo.png",
    apple: "/xchire-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
