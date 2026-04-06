"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { ShieldAlert } from "lucide-react"
import {
  AuditDialog,
  type AuditResult,
} from "@/components/taskflow/customer-database/audit-dialog"

interface AuditProps<T> {
  customers: T[]
  setAuditedAction: React.Dispatch<React.SetStateAction<T[]>>
  setDuplicateIdsAction: React.Dispatch<React.SetStateAction<Set<number>>>
  setIsAuditViewAction: React.Dispatch<React.SetStateAction<boolean>>
  setAuditFilterAction?: React.Dispatch<
    React.SetStateAction<"" | "all" | "missingType" | "missingStatus" | "duplicates">
  >
}

export function Audit<
  T extends {
    id: number
    account_reference_number?: string
    company_name?: string
    contact_person?: string
    contact_number?: string
    email_address?: string
    address?: string
    region?: string
    type_client?: string
    referenceid?: string
    tsm?: string
    manager?: string
    status?: string
    remarks?: string
    date_created?: string
    date_updated?: string
    next_available_date?: string
  }
>({
  customers,
  setAuditedAction,
  setDuplicateIdsAction,
  setIsAuditViewAction,
  setAuditFilterAction,
}: AuditProps<T>) {
  const [open, setOpen] = useState(false)

  const handleConfirm = (result: AuditResult) => {
    setAuditedAction((result.allAffectedCustomers as unknown) as T[])
    setDuplicateIdsAction(result.duplicateIds)
    setIsAuditViewAction(true)
    setAuditFilterAction?.("all")
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <ShieldAlert className="size-4 mr-1" /> Audit
      </Button>

      <AuditDialog
        open={open}
        onOpenChange={setOpen}
        customers={customers as any}
        onConfirmAudit={handleConfirm}
      />
    </>
  )
}