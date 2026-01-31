"use client";

import React, { Suspense } from "react";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";

// Popups
import { UserProvider, useUser } from "@/contexts/UserContext";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();

  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Suspense fallback={null}>
          {userId && (
            <>
            </>
          )}
        </Suspense>
        <Analytics />
        {children}
      </ThemeProvider>
      <Toaster />
    </>
  );
}

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <LayoutContent>{children}</LayoutContent>
    </UserProvider>
  );
}
