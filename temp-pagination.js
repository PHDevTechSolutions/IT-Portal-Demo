const fs = require('fs');

const content = `"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChangeAction: (newPage: number) => void
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChangeAction,
}) => {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChangeAction(Math.max(1, page - 1))}
        disabled={page === 1}
        className="h-8 w-8 p-0 border-cyan-500/30 bg-slate-900/50 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-1 px-3 py-1 rounded border border-cyan-500/30 bg-slate-900/50">
        <span className="text-xs text-cyan-400 font-mono">{page}</span>
        <span className="text-xs text-cyan-500/50">/</span>
        <span className="text-xs text-cyan-300/60 font-mono">{totalPages}</span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChangeAction(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="h-8 w-8 p-0 border-cyan-500/30 bg-slate-900/50 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
`;

fs.writeFileSync('components/app-pagination.tsx', content);
console.log('Pagination updated');
";

fs.writeFileSync('temp-pagination.js', content);
node temp-pagination.js && del temp-pagination.js
