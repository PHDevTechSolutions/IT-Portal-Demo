"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Bell, ChevronsUpDown, LogOut } from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"

interface NavUserProps {
  user: {
    id?: string
    name: string
    email: string
    avatar: string
  }
}

export function NavUser({ user }: NavUserProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)

  // Logout function with progress
  const handleLogout = async () => {
    setIsLoggingOut(true)
    setProgress(0)
    toast.info("Logging you out...")

    let value = 0
    const interval = setInterval(() => {
      value += 10
      setProgress(value)
      if (value >= 100) clearInterval(interval)
    }, 150)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    sessionStorage.clear()
    localStorage.clear()
    toast.success("Successfully logged out!")
    router.replace("/Login")
  }

  // Account click with overlay, toast, and redirect
  const handleAccountClick = async () => {
    if (!user.id) {
      toast.error("User ID not found")
      return
    }

    setShowOverlay(true)
    setProgress(0)
    toast.info("Opening Account...")

    let value = 0
    const interval = setInterval(() => {
      value += 20
      setProgress(value)
      if (value >= 100) clearInterval(interval)
    }, 150)

    // Short delay to allow user to see overlay & progress
    await new Promise((resolve) => setTimeout(resolve, 800))

    router.push(`/account?userId=${user.id}`)
  }

  return (
    <>
      {/* Logout overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <h2 className="text-white text-xl font-semibold">Logging out...</h2>
            <Progress value={progress} className="w-[60%] mx-auto" />
          </div>
        </div>
      )}

      {/* Account overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <h2 className="text-white text-xl font-semibold">Opening Account...</h2>
            <Progress value={progress} className="w-[70%] mx-auto" />
          </div>
        </div>
      )}

      {/* Sidebar Menu / Dropdown */}
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.name?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="min-w-56 rounded-lg" align="end">
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={handleAccountClick}>
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Account
                </DropdownMenuItem>

                <DropdownMenuItem>
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:text-red-700"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}
