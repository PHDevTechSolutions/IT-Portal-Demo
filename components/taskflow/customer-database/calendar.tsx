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
                    <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
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
                                className="ml-1 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="size-3" />
                            </span>
                        </span>
                    ) : (
                        <span>Date range</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-auto p-0 rounded-md border border-border shadow-md"
                align="start"
                sideOffset={6}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        Filter by Date Created
                    </span>
                    {hasRange && (
                        <button
                            onClick={handleClear}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
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
                            "text-xs border border-border rounded-sm px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer",
                        dropdown_month: "font-medium",
                        dropdown_year: "font-medium",
                        nav: "flex items-center gap-1",
                        nav_button:
                            "h-7 w-7 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm transition-colors",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse",
                        head_row: "flex",
                        head_cell:
                            "text-muted-foreground w-9 font-medium text-[11px] text-center",
                        row: "flex w-full mt-1",
                        cell: cn(
                            "relative h-9 w-9 p-0 text-center text-sm",
                            "[&:has([aria-selected])]:bg-primary/10",
                            "first:[&:has([aria-selected])]:rounded-l-md",
                            "last:[&:has([aria-selected])]:rounded-r-md",
                            "[&:has([aria-selected].day-range-end)]:rounded-r-md",
                            "[&:has([aria-selected].day-outside)]:bg-primary/5",
                            "focus-within:relative focus-within:z-20",
                        ),
                        day: cn(
                            "h-9 w-9 p-0 font-normal text-xs rounded-sm",
                            "hover:bg-muted hover:text-foreground transition-colors",
                            "aria-selected:opacity-100",
                        ),
                        day_range_start: "rounded-l-md",
                        day_range_end: "day-range-end rounded-r-md",
                        day_selected:
                            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-sm",
                        day_today:
                            "bg-accent text-accent-foreground font-semibold",
                        day_outside:
                            "text-muted-foreground/40 aria-selected:bg-primary/5 aria-selected:text-muted-foreground",
                        day_disabled: "text-muted-foreground/30 cursor-not-allowed",
                        day_range_middle:
                            "aria-selected:bg-primary/10 aria-selected:text-foreground rounded-none",
                        day_hidden: "invisible",
                    }}
                />

                {/* Footer */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/40">
                    <span className="text-[11px] text-muted-foreground">
                        {hasRange
                            ? `${format(range.from!, "MMM d")} – ${format(range.to!, "MMM d, yyyy")}`
                            : "Select a start and end date"}
                    </span>
                    <Button
                        size="sm"
                        className="h-7 text-xs rounded-sm"
                        disabled={!hasRange}
                        onClick={() => setOpen(false)}
                    >
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
