import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";

export interface NotificationPayload {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  category: "backup" | "customer" | "taskflow" | "system" | "activity" | "progress";
  userId?: string;
  metadata?: Record<string, any>;
}

export interface BackupNotificationPayload {
  status: "success" | "failed" | "started";
  message: string;
  timestamp: string;
  backupId: string;
  metadata?: Record<string, any>;
}

/**
 * Send a global notification that appears for all users
 */
export async function sendGlobalNotification(payload: NotificationPayload): Promise<string> {
  try {
    const notificationRef = collection(db, "notifications");
    const docRef = await addDoc(notificationRef, {
      ...payload,
      createdAt: serverTimestamp(),
      read: false,
      global: true,
    });
    return docRef.id;
  } catch (error) {
    console.error("[Notifications] Failed to send global notification:", error);
    throw error;
  }
}

/**
 * Send a notification to a specific user
 */
export async function sendUserNotification(
  userId: string,
  payload: NotificationPayload
): Promise<string> {
  try {
    const notificationRef = collection(db, "notifications");
    const docRef = await addDoc(notificationRef, {
      ...payload,
      userId,
      createdAt: serverTimestamp(),
      read: false,
      global: false,
    });
    return docRef.id;
  } catch (error) {
    console.error("[Notifications] Failed to send user notification:", error);
    throw error;
  }
}

/**
 * Send a backup-specific notification
 */
export async function sendBackupNotification(payload: BackupNotificationPayload): Promise<string> {
  const title = payload.status === "success" 
    ? "✅ Backup Completed" 
    : payload.status === "failed" 
    ? "❌ Backup Failed" 
    : "⏳ Backup Started";

  return sendGlobalNotification({
    title,
    message: payload.message,
    type: payload.status === "success" ? "success" : payload.status === "failed" ? "error" : "info",
    category: "backup",
    metadata: {
      backupId: payload.backupId,
      timestamp: payload.timestamp,
      ...payload.metadata,
    },
  });
}

/**
 * Send notification for newly added customer
 */
export async function notifyNewCustomer(customerData: {
  id: string;
  companyName: string;
  createdBy: string;
  createdAt: string;
}): Promise<string> {
  return sendGlobalNotification({
    title: "🆕 New Customer Added",
    message: `${customerData.companyName} was added to the customer database by ${customerData.createdBy}`,
    type: "info",
    category: "customer",
    metadata: {
      customerId: customerData.id,
      companyName: customerData.companyName,
      createdBy: customerData.createdBy,
      createdAt: customerData.createdAt,
    },
  });
}

/**
 * Send bulk notification for taskflow activities
 * This aggregates multiple activity notifications into one
 */
export async function notifyBulkActivities(
  activities: Array<{
    id: string;
    type: string;
    companyName: string;
    createdBy: string;
  }>
): Promise<string> {
  const count = activities.length;
  const groupedByUser = activities.reduce((acc, activity) => {
    acc[activity.createdBy] = (acc[activity.createdBy] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const userSummary = Object.entries(groupedByUser)
    .map(([user, count]) => `${count} by ${user}`)
    .join(", ");

  return sendGlobalNotification({
    title: "📊 New Taskflow Activities",
    message: `${count} new activities were recorded (${userSummary})`,
    type: "info",
    category: "activity",
    metadata: {
      activityCount: count,
      activities: activities.slice(0, 10).map(a => ({ id: a.id, type: a.type, companyName: a.companyName })),
      groupedByUser,
    },
  });
}

/**
 * Send bulk notification for taskflow progress updates
 */
export async function notifyBulkProgress(
  progressItems: Array<{
    id: string;
    companyName: string;
    status: string;
    updatedBy: string;
  }>
): Promise<string> {
  const count = progressItems.length;
  const groupedByStatus = progressItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusSummary = Object.entries(groupedByStatus)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");

  return sendGlobalNotification({
    title: "📈 Progress Updates",
    message: `${count} progress records updated (${statusSummary})`,
    type: "info",
    category: "progress",
    metadata: {
      progressCount: count,
      groupedByStatus,
      items: progressItems.slice(0, 10).map(p => ({ id: p.id, companyName: p.companyName, status: p.status })),
    },
  });
}

/**
 * Send notification for historical data changes
 */
export async function notifyHistoricalChanges(
  changes: Array<{
    id: string;
    action: string;
    table: string;
    affectedRecords: number;
  }>
): Promise<string> {
  const totalRecords = changes.reduce((sum, c) => sum + c.affectedRecords, 0);
  const tableList = [...new Set(changes.map(c => c.table))].join(", ");

  return sendGlobalNotification({
    title: "📜 Historical Data Changes",
    message: `${totalRecords} records affected across ${changes.length} operations in ${tableList}`,
    type: "warning",
    category: "taskflow",
    metadata: {
      totalRecords,
      operationCount: changes.length,
      tables: [...new Set(changes.map(c => c.table))],
      changes: changes.slice(0, 5),
    },
  });
}

/**
 * Get recent notifications for a user (or global if no userId)
 */
export async function getRecentNotifications(
  userId?: string,
  limit_count: number = 50
): Promise<any[]> {
  try {
    const notificationRef = collection(db, "notifications");
    let q;

    if (userId) {
      // Get notifications for this user OR global notifications
      q = query(
        notificationRef,
        where("userId", "in", [userId, null]),
        orderBy("createdAt", "desc"),
        limit(limit_count)
      );
    } else {
      // Get only global notifications
      q = query(
        notificationRef,
        where("global", "==", true),
        orderBy("createdAt", "desc"),
        limit(limit_count)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("[Notifications] Failed to get notifications:", error);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const docRef = doc(db, "notifications", notificationId);
    await setDoc(docRef, { read: true }, { merge: true });
  } catch (error) {
    console.error("[Notifications] Failed to mark notification as read:", error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId?: string): Promise<number> {
  try {
    const notificationRef = collection(db, "notifications");
    let q;

    if (userId) {
      q = query(
        notificationRef,
        where("userId", "in", [userId, null]),
        where("read", "==", false)
      );
    } else {
      q = query(
        notificationRef,
        where("global", "==", true),
        where("read", "==", false)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("[Notifications] Failed to get unread count:", error);
    return 0;
  }
}
