"use client";

import { useState } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Database, ArrowRightCircle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface DataMigratorProps {
  userId: string;
  userName: string;
}

export function DataMigrator({ userId, userName }: DataMigratorProps) {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [progress, setProgress] = useState(0);

  const migrateData = async () => {
    if (!userId) {
      toast.error("No user ID found");
      return;
    }

    setIsMigrating(true);
    setProgress(0);
    try {
      const oldActivitiesRef = collection(db, "user_activities");
      const oldQuery = query(oldActivitiesRef, where("userId", "==", userId));
      const oldSnapshot = await getDocs(oldQuery);

      if (oldSnapshot.empty) {
        toast.info("No legacy data found to migrate.");
        setIsMigrating(false);
        return;
      }

      const total = oldSnapshot.docs.length;
      let count = 0;

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
          completedAt: oldData.status === "completed"
            ? oldData.updatedAt || serverTimestamp()
            : null,
        });
        count++;
        setProgress(Math.round((count / total) * 100));
      }

      setMigratedCount(count);
      toast.success(`Transfer complete — ${count} records migrated.`);
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Transfer failed. Check console for details.");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="relative group mx-4 mt-4 mb-0">
      {/* Glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/20 to-orange-400/5 blur opacity-20 group-hover:opacity-40 transition duration-500" />

      <div className="relative bg-[#0d1117]/95 border border-orange-500/20 overflow-hidden p-4">
        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-orange-500/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-orange-500/40" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-orange-500/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-orange-500/40" />

        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="p-2 bg-orange-500/10 border border-orange-500/30 shrink-0">
            <Database className="h-4 w-4 text-orange-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xs font-bold tracking-widest uppercase text-orange-400 font-mono">
                Data Migration
              </h3>
              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                · Archive Transfer
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono leading-relaxed mb-3">
              Legacy task data detected. Migrate previous records to the current task system.
            </p>

            {/* Progress bar (visible during migration) */}
            {isMigrating && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-orange-400/60 uppercase tracking-widest">Transferring…</span>
                  <span className="text-[10px] font-mono text-orange-300">{progress}%</span>
                </div>
                <div className="h-px bg-slate-800 relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-orange-500 to-orange-300 transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success */}
            {migratedCount > 0 && !isMigrating && (
              <div className="mb-3 flex items-center gap-2 text-[11px] font-mono text-green-400/80 border border-green-500/20 bg-green-500/5 px-2 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Transfer complete —{" "}
                  <span className="text-green-300 font-bold">{migratedCount}</span> records migrated.
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              {/* Action button */}
              <button
                onClick={migrateData}
                disabled={isMigrating}
                className="
                  flex items-center gap-2 px-3 py-1.5
                  text-[10px] font-mono uppercase tracking-widest
                  bg-orange-500/10 border border-orange-500/30
                  text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/50
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-150
                "
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Transferring…
                  </>
                ) : (
                  <>
                    <ArrowRightCircle className="h-3 w-3" />
                    Initiate Transfer
                  </>
                )}
              </button>

              {/* Warning */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-700">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>Irreversible operation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
