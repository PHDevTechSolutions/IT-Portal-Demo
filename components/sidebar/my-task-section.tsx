"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CheckCircle2, Clock, AlertCircle, PlayCircle, PauseCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Activity {
  id: string;
  userId: string;
  userName: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "on-hold" | "cancelled";
  createdAt: any;
  updatedAt: any;
}

const statusIcons = {
  pending: Clock,
  "in-progress": PlayCircle,
  completed: CheckCircle2,
  "on-hold": PauseCircle,
  cancelled: XCircle,
};

const statusColors = {
  pending: "text-yellow-500",
  "in-progress": "text-blue-500",
  completed: "text-green-500",
  "on-hold": "text-orange-500",
  cancelled: "text-red-500",
};

interface MyTaskSectionProps {
  userId: string;
  userName: string;
}

export function MyTaskSection({ userId, userName }: MyTaskSectionProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Activity["status"]>("pending");

  // Fetch activities from Firebase
  useEffect(() => {
    if (!userId) return;

    const activitiesRef = collection(db, "user_activities");
    const q = query(
      activitiesRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData: Activity[] = [];
      snapshot.forEach((doc) => {
        activitiesData.push({ id: doc.id, ...doc.data() } as Activity);
      });
      setActivities(activitiesData);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleCreateActivity = async () => {
    if (!description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setIsLoading(true);
    try {
      await addDoc(collection(db, "user_activities"), {
        userId,
        userName,
        description: description.trim(),
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Activity created successfully");
      setDescription("");
      setStatus("pending");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error creating activity:", error);
      toast.error("Failed to create activity");
    } finally {
      setIsLoading(false);
    }
  };

  const getLatestActivities = () => {
    return activities.slice(0, 5);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between">
        <span>My Tasks</span>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Activity</DialogTitle>
              <DialogDescription>
                Add a new task or activity to track your work.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="description"
                  placeholder="What are you working on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <Select
                  value={status}
                  onValueChange={(value: Activity["status"]) => setStatus(value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateActivity} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Activity"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarGroupLabel>
      <SidebarMenu>
        {getLatestActivities().map((activity) => {
          const StatusIcon = statusIcons[activity.status];
          return (
            <SidebarMenuItem key={activity.id}>
              <SidebarMenuButton className="h-auto py-2">
                <div className="flex items-start gap-2 w-full">
                  <StatusIcon
                    className={`h-4 w-4 mt-0.5 shrink-0 ${statusColors[activity.status]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {activity.status.replace("-", " ")}
                    </p>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
        {activities.length === 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton disabled className="text-muted-foreground">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-xs">No tasks yet. Click + to add one.</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
