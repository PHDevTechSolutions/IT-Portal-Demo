"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface ConvertEmailDialogProps {
  open: boolean
  onOpenChangeAction: (open: boolean) => void
  accounts: { _id: string; Email: string }[]
  setAccountsAction: React.Dispatch<React.SetStateAction<any[]>>
}

export const ConvertEmailDialog = ({
  open,
  onOpenChangeAction,
  accounts,
  setAccountsAction
}: ConvertEmailDialogProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [targetCompany, setTargetCompany] = useState("Disruptive Solutions Inc")
  const [search, setSearch] = useState("")

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const copy = new Set(prev)
      copy.has(id) ? copy.delete(id) : copy.add(id)
      return copy
    })
  }

  const handleConvert = async () => {
    if (!targetCompany) return toast.error("Select a target company!")
    if (selectedIds.size === 0) return toast.error("Select at least one user!")

    const toastId = toast.loading("Converting emails...")
    try {
      const res = await fetch("/api/UserManagement/ConvertEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          targetCompany
        })
      })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.message || "Conversion failed")

      // Update local state
      setAccountsAction(prev =>
        prev.map(acc => {
          if (selectedIds.has(acc._id)) {
            const [local] = acc.Email.split("@")
            const domainMap: Record<string, string> = {
              "Disruptive Solutions Inc": "disruptivesolutionsinc.com",
              "Ecoshift Corporation": "ecoshiftcorp.com"
            }
            return { ...acc, Email: `${local}@${domainMap[targetCompany]}` }
          }
          return acc
        })
      )

      toast.success(result.message, { id: toastId })
      setSelectedIds(new Set())
      onOpenChangeAction(false)
    } catch (err) {
      toast.error((err as Error).message, { id: toastId })
    }
  }

  const filteredAccounts = accounts
    .filter(acc => acc.Email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (selectedIds.has(a._id) && !selectedIds.has(b._id)) return -1
      if (!selectedIds.has(a._id) && selectedIds.has(b._id)) return 1
      return 0
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Email Domains</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="mt-2 mb-2">
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Selected count */}
        <div className="mb-2 text-sm font-medium">
          Selected: {selectedIds.size} / {filteredAccounts.length}
        </div>

        {/* Cards */}
        <div className="max-h-64 overflow-auto grid grid-cols-1 gap-2">
          {filteredAccounts.length ? (
            filteredAccounts.map(acc => (
              <div
                key={acc._id}
                className={`flex items-center justify-between p-3 border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition ${
                  selectedIds.has(acc._id) ? "bg-red-50 border-red-400" : "bg-white"
                }`}
                onClick={() => toggleSelect(acc._id)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={selectedIds.has(acc._id)} onCheckedChange={() => toggleSelect(acc._id)} />
                  <span className="text-sm">{acc.Email}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              No users found.
            </div>
          )}
        </div>

        {/* Target company select */}
        <div className="mt-4">
          <Select value={targetCompany} onValueChange={setTargetCompany}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Disruptive Solutions Inc">Disruptive Solutions Inc</SelectItem>
              <SelectItem value="Ecoshift Corporation">Ecoshift Corporation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Footer buttons */}
        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChangeAction(false)}>Cancel</Button>
          <Button onClick={handleConvert}>Convert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
