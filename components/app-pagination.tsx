"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

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
    <div className="flex items-center gap-1.5 shrink-0">
      {/* Prev */}
      <button
        onClick={() => onPageChangeAction(Math.max(1, page - 1))}
        disabled={page === 1}
        className="h-8 w-8 flex items-center justify-center border border-orange-500/20 bg-transparent text-orange-500/50 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-orange-500/20 transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {/* Page indicator */}
      <div className="flex items-center gap-1 px-3 h-8 border border-orange-500/20 bg-orange-500/5">
        <span className="text-[11px] font-mono text-orange-400">{page}</span>
        <span className="text-[11px] font-mono text-orange-500/30">/</span>
        <span className="text-[11px] font-mono text-orange-500/40">{totalPages}</span>
      </div>

      {/* Next */}
      <button
        onClick={() => onPageChangeAction(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="h-8 w-8 flex items-center justify-center border border-orange-500/20 bg-transparent text-orange-500/50 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-orange-500/20 transition-colors"
        aria-label="Next page"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
