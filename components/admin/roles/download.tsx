"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

interface UserAccount {
  Firstname: string
  Lastname: string
  Email: string
  Department: string
  Company: string
  Position: string
}

interface SpinnerItemProps {
  currentBytes: number
  totalBytes: number
  fileCount: number
  onCancel?: () => void
}

export function SpinnerItem({
  currentBytes,
  totalBytes,
  fileCount,
  onCancel,
}: SpinnerItemProps) {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  }

  const progressValue = totalBytes > 0 ? Math.min(100, Math.round((currentBytes / totalBytes) * 100)) : 0

  return (
    <div className="flex w-full flex-col gap-4">
      <Item variant="outline" className="w-full">
        <ItemMedia variant="icon">
          <Spinner />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            Downloading {fileCount} {fileCount === 1 ? "file" : "files"}...
          </ItemTitle>
          <ItemDescription>
            {formatBytes(currentBytes)} / {formatBytes(totalBytes)}
          </ItemDescription>
        </ItemContent>
        {onCancel && (
          <ItemActions className="flex mt-2 justify-end">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </ItemActions>
        )}
        <ItemFooter>
          <Progress value={progressValue} />
        </ItemFooter>
      </Item>
    </div>
  )
}
