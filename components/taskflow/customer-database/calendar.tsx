"use client"

import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { type DateRange } from "react-day-picker"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface CalendarProps {
    startDate: string
    endDate: string
    setStartDateAction: (date: string) => void
    setEndDateAction: (date: string) => void
}

export function Calendar({
    startDate,
    endDate,
    setStartDateAction,
    setEndDateAction,
}: CalendarProps) {
    const [open, setOpen] = React.useState(false)
    const [range, setRange] = React.useState<DateRange | undefined>(
        startDate && endDate
            ? { from: new Date(startDate), to: new Date(endDate) }
            : undefined,
    )

    const handleSelect = (r: DateRange | undefined) => {
        setRange(r)
        setStartDateAction(r?.from ? format(r.from, "yyyy-MM-dd") : "")
        setEndDateAction(r?.to ? format(r.to, "yyyy-MM-dd") : "")
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        setRange(undefined)
        setStartDateAction("")
        setEndDateAction("")
    }

    const hasRange = range?.from && range?.to

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-9 gap-2 text-xs font-normal rounded-none border-slate-600 bg-slate-800 text-slate-300",
                        "hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:text-cyan-400 transition-colors uppercase tracking-wider",
                        hasRange
                            ? "text-cyan-400 border-cyan-500/40 bg-cyan-500/5 pr-2"
                            : "text-slate-300",
                    )}
                >
                    <CalendarIcon className="size-3.5 shrink-0" />
                    {hasRange ? (
                        <span className="flex items-center gap-1.5">
                            <span>
                                {format(range.from!, "MMM d, yyyy")}
                                {" — "}
                                {format(range.to!, "MMM d, yyyy")}
                            </span>
                            <span
                                role="button"
                                onClick={handleClear}
                                className="ml-1 rounded-full p-0.5 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                                <X className="size-3" />
                            </span>
                        </span>
                    ) : (
                        <span>Date Range</span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent
                className="w-auto p-0 rounded-none border border-slate-700 shadow-xl bg-slate-900"
                align="start"
                sideOffset={6}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 bg-slate-800/60">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                        Filter by Date Created
                    </span>
                    {hasRange && (
                        <button
                            onClick={handleClear}
                            className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1 uppercase tracking-wider"
                        >
                            <X className="size-3" /> Clear
                        </button>
                    )}
                </div>

                <UiCalendar
                    mode="range"
                    selected={range}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    numberOfMonths={2}
                    className="p-3"
                    classNames={{
                        months: "flex flex-col sm:flex-row gap-4",
                        month: "space-y-3",
                        caption: "flex justify-center pt-1 relative items-center gap-1",
                        caption_label: "hidden",
                        caption_dropdowns: "flex gap-1",
                        dropdown:
                            "text-xs border border-slate-700 rounded-none px-1.5 py-1 bg-slate-800 text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer",
                        dropdown_month: "font-medium",
                        dropdown_year: "font-medium",
                        nav: "flex items-center gap-1",
                        nav_button:
                            "h-7 w-7 bg-transparent p-0 text-slate-500 hover:text-cyan-400 hover:bg-slate-800 rounded-none transition-colors",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse",
                        head_row: "flex",
                        head_cell:
                            "text-slate-600 w-9 font-medium text-[11px] text-center uppercase",
                        row: "flex w-full mt-1",
                        cell: cn(
                            "relative h-9 w-9 p-0 text-center text-sm",
                            "[&:has([aria-selected])]:bg-cyan-500/10",
                            "first:[&:has([aria-selected])]:rounded-l-none",
                            "last:[&:has([aria-selected])]:rounded-r-none",
                            "[&:has([aria-selected].day-range-end)]:rounded-r-none",
                            "[&:has([aria-selected].day-outside)]:bg-cyan-500/5",
                            "focus-within:relative focus-within:z-20",
                        ),
                        day: cn(
                            "h-9 w-9 p-0 font-normal text-xs rounded-none text-slate-300",
                            "hover:bg-slate-800 hover:text-cyan-400 transition-colors",
                            "aria-selected:opacity-100",
                        ),
                        day_range_start: "rounded-l-none",
                        day_range_end: "day-range-end rounded-r-none",
                        day_selected:
                            "bg-cyan-600 text-white hover:bg-cyan-500 hover:text-white focus:bg-cyan-600 focus:text-white rounded-none",
                        day_today:
                            "bg-slate-800 text-cyan-400 font-semibold border border-cyan-500/30",
                        day_outside:
                            "text-slate-700 aria-selected:bg-cyan-500/5 aria-selected:text-slate-600",
                        day_disabled: "text-slate-700 cursor-not-allowed",
                        day_range_middle:
                            "aria-selected:bg-cyan-500/10 aria-selected:text-slate-200 rounded-none",
                        day_hidden: "invisible",
                    }}
                />

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/60 bg-slate-800/60">
                    <span className="text-[11px] text-slate-500">
                        {hasRange
                            ? `${format(range.from!, "MMM d")} – ${format(range.to!, "MMM d, yyyy")}`
                            : "Select a start and end date"}
                    </span>
                    <Button
                        size="sm"
                        disabled={!hasRange}
                        onClick={() => setOpen(false)}
                        className="h-7 text-xs rounded-none bg-cyan-600 hover:bg-cyan-500 text-white border-0 px-4 uppercase tracking-wider"
                    >
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
