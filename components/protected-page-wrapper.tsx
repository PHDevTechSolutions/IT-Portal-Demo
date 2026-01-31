"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ProtectedPageWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const deviceId = localStorage.getItem("deviceId") || "";

        // 1. Check if current session is valid
        const res = await fetch("/api/check-session", {
          headers: { "x-device-id": deviceId },
          cache: "no-store",
        });

        if (res.status === 200) {
          setLoading(false);
          return;
        }

        // 2. If not valid, check if there's an 'id' query param for auto-login
        const idFromUrl = searchParams?.get("id");

        if (idFromUrl) {
          const loginRes = await fetch("/api/auto-login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: idFromUrl }),
          });

          if (loginRes.ok) {
            const data = await loginRes.json();
            if (data.deviceId) {
              localStorage.setItem("deviceId", data.deviceId);
              setLoading(false);
              return;
            }
          }
        }

        // 3. If all fails, redirect to login page
        router.replace("/login");
      } catch (error) {
        console.error("Session check or auto-login failed:", error);
        router.replace("/login");
      }
    };

    checkSession();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-sm text-gray-600">
        
      </div>
    );
  }

  return <>{children}</>;
}
