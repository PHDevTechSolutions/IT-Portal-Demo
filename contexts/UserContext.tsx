"use client";

/**
 * UserContext
 *
 * Loads the current user from /api/me on first mount so that every
 * consumer (dashboard, forms, etc.) has access to userId and referenceId
 * without relying on URL params or localStorage.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface UserContextType {
  userId: string | null;
  referenceId: string | null;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  role: string | null;
  name: string | null;
  setUserId: (id: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [firstname, setFirstname] = useState<string | null>(null);
  const [lastname, setLastname] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Hydrate from session on mount
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.userId) setUserId(data.userId);
        if (data.referenceId) setReferenceId(data.referenceId);
        if (data.email) setEmail(data.email);
        if (data.firstname) setFirstname(data.firstname);
        if (data.lastname) setLastname(data.lastname);
        if (data.role) setRole(data.role);
      })
      .catch(() => {
        // Silently ignore — unauthenticated pages will redirect via middleware
      });
  }, []);

  const name = firstname && lastname ? `${firstname} ${lastname}` : null;

  return (
    <UserContext.Provider value={{ userId, referenceId, email, firstname, lastname, role, name, setUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}
