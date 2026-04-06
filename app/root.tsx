"use client";

import React, { Suspense } from "react";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";

// Contexts
import { UserProvider, useUser } from "@/contexts/UserContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

// Hooks
import { useGlobalNotifications } from "@/lib/hooks/useNotifications";

function NotificationInitializer() {
  // Initialize global notifications monitoring
  useGlobalNotifications();
  return null;
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();

  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <NotificationProvider>
          <Suspense fallback={null}>
            {userId && (
              <>
                <NotificationInitializer />
              </>
            )}
          </Suspense>
          <Analytics />
          {children}
        </NotificationProvider>
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
