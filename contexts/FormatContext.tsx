"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type FormatContextType = {
  timeFormat: string;
  setTimeFormat: (val: string) => void;
  dateFormat: string;
  setDateFormat: (val: string) => void;
};

const FormatContext = createContext<FormatContextType | undefined>(undefined);

export function FormatProvider({ children }: { children: React.ReactNode }) {
  const [timeFormat, setTimeFormat] = useState("12h");
  const [dateFormat, setDateFormat] = useState("long");

  // Load from localStorage once on mount
  useEffect(() => {
    const savedTime = localStorage.getItem("timeFormat");
    const savedDate = localStorage.getItem("dateFormat");
    if (savedTime) setTimeFormat(savedTime);
    if (savedDate) setDateFormat(savedDate);
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem("timeFormat", timeFormat);
  }, [timeFormat]);

  useEffect(() => {
    localStorage.setItem("dateFormat", dateFormat);
  }, [dateFormat]);

  return (
    <FormatContext.Provider
      value={{ timeFormat, setTimeFormat, dateFormat, setDateFormat }}
    >
      {children}
    </FormatContext.Provider>
  );
}

export function useFormat() {
  const context = useContext(FormatContext);
  if (!context)
    throw new Error("useFormat must be used within a FormatProvider");
  return context;
}
