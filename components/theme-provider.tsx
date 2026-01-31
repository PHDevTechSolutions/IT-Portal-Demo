"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      value={{
        light: "light",
        dark: "dark",
        system: "system",
        disruptive: "disruptive",
        buildchem: "buildchem",
        prms: "prms",
        vah: "vah",
        ecoshift: "ecoshift",
        outlook: "outlook",
        viber: "viber",
      }}
    >

      {children}
    </NextThemesProvider>
  );
}
