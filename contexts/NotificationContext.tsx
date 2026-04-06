"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  category: "backup" | "customer" | "taskflow" | "system" | "activity" | "progress";
  createdAt: string;
  read: boolean;
  global: boolean;
  userId?: string;
  metadata?: Record<string, any>;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => void;
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to Firebase notifications
  useEffect(() => {
    const notificationRef = collection(db, "notifications");
    
    // Simple query without complex ordering to avoid index requirements
    // We filter client-side instead
    const q = query(
      notificationRef,
      where("global", "==", true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: Notification[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title,
              message: data.message,
              type: data.type,
              category: data.category,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              read: data.read || false,
              global: data.global,
              userId: data.userId,
              metadata: data.metadata,
            };
          })
          // Sort client-side to avoid Firestore index requirement
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setIsLoading(false);
      },
      (error) => {
        console.error("[NotificationContext] Error subscribing to notifications:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    try {
      const docRef = doc(db, "notifications", id);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error("[NotificationContext] Failed to mark as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifications = notifications.filter((n) => !n.read);
      await Promise.all(
        unreadNotifications.map((n) => {
          const docRef = doc(db, "notifications", n.id);
          return updateDoc(docRef, { read: true });
        })
      );
    } catch (error) {
      console.error("[NotificationContext] Failed to mark all as read:", error);
    }
  }, [notifications]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        isLoading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
