"use client"

import React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Calendar } from "lucide-react"

interface AppCommandModalProps {
  appName: string
  trigger: React.ReactNode
}

const appOptions: Record<string, { name: string; path: string }[]> = {
  Taskflow: [
    { name: "Customer Database", path: "/taskflow/customer-database" },
    { name: "Activity Logs", path: "/taskflow/activity-logs" },
    { name: "Progress Logs", path: "/taskflow/progress-logs" },
    { name: "CSR Inquiries", path: "/taskflow/csr-inquiries" },
  ],
  Ecodesk: [
    { name: "Customer Database", path: "/ecodesk/customer-database" },
    { name: "Ticket Logs", path: "/ecodesk/ticket-logs" },
    { name: "Received PO", path: "/ecodesk/received-po" },
    { name: "SKU Listing", path: "/ecodesk/sku-listing" },
    { name: "D-Tracking Logs", path: "/ecodesk/d-tracking-logs" },
    { name: "Outbound Calls", path: "/ecodesk/outbound-calls" },
  ],
  Acculog: [{ name: "Activity Logs", path: "/acculog/activity-logs" }],
  WooCommerce: [{ name: "Orders", path: "/woocommerce/orders" }],
  Shopify: [
    { name: "Orders", path: "/shopify/orders" },
    { name: "Products", path: "/shopify/products" },
  ],
  Cloudinary: [{ name: "Library Images", path: "/cloudinary/library-images" }],
}

export const AppCommandModal: React.FC<AppCommandModalProps> = ({ appName, trigger }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams?.get("userId") ?? null
  const options = appOptions[appName] || []

  const appendUserId = (url: string) => {
    if (!userId) return url
    return url.includes("?") ? `${url}&userId=${userId}` : `${url}?userId=${userId}`
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appName} Options</DialogTitle>
        </DialogHeader>
        <Command className="mt-2">
          <CommandInput placeholder="Search options..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Available Modules">
              {options.map((opt) => (
                <CommandItem
                  key={opt.name}
                  onSelect={() => router.push(appendUserId(opt.path))}
                  className="cursor-pointer"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>{opt.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
