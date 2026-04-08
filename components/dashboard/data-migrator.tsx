"use client";

import { useState } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, ArrowRightCircle, CheckCircle2, AlertTriangle } from "lucide-react";

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
    <div className="relative group mx-4 mb-4 mt-4">
      {/* Glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-500" />
      
      {/* Main card */}
      <div className="relative bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 p-4 overflow-hidden">
        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyan-500/50" />
        <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyan-500/50" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyan-500/50" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyan-500/50" />
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
            <Database className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white tracking-wider uppercase text-sm">Data Migration</h3>
            <p className="text-xs text-white/60 font-mono">SYSTEM ARCHIVE TRANSFER</p>
          </div>
        </div>
        
        {/* Description */}
        <p className="text-sm text-white/80 mb-4 leading-relaxed">
          Legacy task data detected in archive storage. Initiate transfer protocol to migrate previous mission logs to current command center.
        </p>
        
        {/* Action button */}
        <Button
          onClick={migrateData}
          disabled={isMigrating}
          className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMigrating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="uppercase tracking-wider text-xs">Transferring Data...</span>
            </>
          ) : (
            <>
              <ArrowRightCircle className="h-4 w-4" />
              <span className="uppercase tracking-wider text-xs">Initiate Transfer</span>
            </>
          )}
        </Button>
        
        {/* Success message */}
        {migratedCount > 0 && (
          <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <p className="text-sm text-white/90">
              Transfer complete. <span className="text-green-400 font-mono">{migratedCount}</span> mission logs archived.
            </p>
          </div>
        )}
        
        {/* Warning note */}
        <div className="mt-3 flex items-start gap-2 text-xs text-white/50">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>Archive transfer is irreversible. Ensure backup protocols are in place.</p>
        </div>
      </div>
    </div>
  );
}
