"use client";

import { useState } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DataMigratorProps {
  userId: string;
  userName: string;
}

export function DataMigrator({ userId, userName }: DataMigratorProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);

  const migrateData = async () => {
    if (!userId) {
      toast.error("No user ID found");
      return;
    }

    setIsMigrating(true);
    try {
      // Fetch old data from user_activities
      const oldActivitiesRef = collection(db, "user_activities");
      const oldQuery = query(oldActivitiesRef, where("userId", "==", userId));
      const oldSnapshot = await getDocs(oldQuery);

      if (oldSnapshot.empty) {
        toast.info("No old data found to migrate");
        setIsMigrating(false);
        return;
      }

      let count = 0;
      // Migrate each activity to user_tasks
      for (const docSnapshot of oldSnapshot.docs) {
        const oldData = docSnapshot.data();
        
        await addDoc(collection(db, "user_tasks"), {
          userId: oldData.userId,
          userName: oldData.userName,
          title: oldData.description?.substring(0, 100) || "Untitled Task",
          description: oldData.description || "",
          status: oldData.status || "pending",
          priority: "medium",
          dueDate: null,
          category: null,
          tags: null,
          notes: null,
          createdAt: oldData.createdAt || serverTimestamp(),
          updatedAt: oldData.updatedAt || serverTimestamp(),
          completedAt: oldData.status === "completed" ? oldData.updatedAt || serverTimestamp() : null,
        });
        count++;
      }

      setMigratedCount(count);
      toast.success(`Successfully migrated ${count} tasks!`);
    } catch (error) {
      console.error("Error migrating data:", error);
      toast.error("Failed to migrate data");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="font-semibold text-yellow-800">Data Migration</h3>
      <p className="text-sm text-yellow-700 mt-1">
        Your old tasks from previous version can be migrated to the new system.
      </p>
      <Button
        onClick={migrateData}
        disabled={isMigrating}
        className="mt-2"
        variant="outline"
      >
        {isMigrating ? "Migrating..." : "Migrate Old Data"}
      </Button>
      {migratedCount > 0 && (
        <p className="text-sm text-green-600 mt-2">
          ✓ Migrated {migratedCount} tasks successfully!
        </p>
      )}
    </div>
  );
}
