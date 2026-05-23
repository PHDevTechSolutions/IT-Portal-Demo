"use client"

import * as React from "react"
import { CalendarIcon, X, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { type DateRange, DayPicker, DayButton, getDefaultClassNames } from "react-day-picker"
import { format } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface CalendarProps {
    startDate: string
    endDate: string
    setStartDateAction: (date: string) => void
    setEndDateAction: (date: string) => void
}

// ─── Dark day button ──────────────────────────────────────────────────────────

function DarkDayButton({
    className,
    day,
    modifiers,
    ...props
}: React.ComponentProps<typeof DayButton>) {
    const ref = React.useRef<HTMLButtonElement>(null)
    React.useEffect(() => {
        if (modifiers.focused) ref.current?.focus()
    }, [modifiers.focused])

    return (
        <button
            ref={ref}
            data-day={day.date.toLocaleDateString()}
            className={cn(
                "relative flex aspect-square h-auto w-full min-w-[--cell-size] items-center justify-center",
                "text-[11px] font-mono transition-colors select-none outline-none",
                // default
                "text-slate-300 hover:bg-orange-500/10 hover:text-orange-400",
                // today
                modifiers.today && !modifiers.selected && "border border-orange-500/40 text-orange-400 font-bold",
                // range middle
                modifiers.range_middle && "!bg-orange-500/10 !text-slate-200",
                // range start / end / single selected
                (modifiers.range_start || modifiers.range_end ||
                    (modifiers.selected && !modifiers.range_middle)) &&
                    "!bg-orange-600 !text-white hover:!bg-orange-500",
                // outside month
                modifiers.outside && "!text-slate-700 hover:!bg-transparent hover:!text-slate-600",
                // disabled
                modifiers.disabled && "!text-slate-700 cursor-not-allowed hover:!bg-transparent",
                className,
            )}
            {...props}
        />
    )
}

// ─── Calendar component ───────────────────────────────────────────────────────

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
            {/* ── Trigger ── */}
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "inline-flex items-center gap-2 h-9 px-3",
                        "text-[10px] font-mono uppercase tracking-widest",
                        "border transition-colors",
                        hasRange
                            ? "border-orange-500/40 bg-orange-500/5 text-orange-400"
                            : "border-slate-800 bg-[#0d1117] text-slate-400 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300",
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
                                className="ml-1 p-0.5 text-slate-500 hover:text-red-400 transition-colors"
                            >
                                <X className="size-3" />
                            </span>
                        </span>
                    ) : (
                        <span>Date Range</span>
                    )}
                </button>
            </PopoverTrigger>

            {/* ── Popover ── */}
            <PopoverContent
                className="w-auto p-0 border border-orange-500/20 shadow-2xl bg-[#0a0d14]"
                align="start"
                sideOffset={6}
                style={{ borderRadius: 0 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-orange-500/10 bg-[#0d1117]">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.8)]" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400">
                            Filter by Date Created
                        </span>
                    </div>
                    {hasRange && (
                        <button
                            onClick={handleClear}
                            className="text-[9px] font-mono text-slate-600 hover:text-red-400 transition-colors flex items-center gap-1 uppercase tracking-wider"
                        >
                            <X className="size-3" /> Clear
                        </button>
                    )}
                </div>

                {/* Calendar grid */}
                <DayPicker
                    mode="range"
                    selected={range}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    numberOfMonths={2}
                    showOutsideDays
                    className="p-3 [--cell-size:2rem]"
                    classNames={{
                        months: "flex flex-col sm:flex-row gap-6",
                        month: "flex flex-col gap-3 w-full",
                        month_caption: "flex items-center justify-center h-8 relative px-8",
                        dropdowns: "flex items-center gap-1",
                        dropdown_root: "relative",
                        // hide the caption_label — dropdowns replace it
                        caption_label: "hidden",
                        dropdown: cn(
                            "text-[11px] font-mono border border-slate-700 px-2 py-1",
                            "bg-[#0d1117] text-slate-200 cursor-pointer",
                            "focus:outline-none focus:border-orange-500/50",
                        ),
                        nav: "absolute inset-x-0 top-0 flex items-center justify-between h-8 pointer-events-none",
                        button_previous: cn(
                            "pointer-events-auto h-8 w-8 flex items-center justify-center",
                            "text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors",
                            "aria-disabled:opacity-20 aria-disabled:cursor-not-allowed",
                        ),
                        button_next: cn(
                            "pointer-events-auto h-8 w-8 flex items-center justify-center",
                            "text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors",
                            "aria-disabled:opacity-20 aria-disabled:cursor-not-allowed",
                        ),
                        table: "w-full border-collapse",
                        weekdays: "flex",
                        weekday: "flex-1 text-[9px] font-mono font-bold uppercase tracking-widest text-orange-500/40 text-center py-1.5",
                        week: "flex w-full mt-0.5",
                        day: "relative aspect-square h-full w-full p-0 text-center",
                        range_start: "",
                        range_middle: "",
                        range_end: "",
                        today: "",
                        outside: "",
                        disabled: "",
                        hidden: "invisible",
                    }}
                    components={{
                        Chevron: ({ orientation }) =>
                            orientation === "left"
                                ? <ChevronLeftIcon className="size-3.5" />
                                : <ChevronRightIcon className="size-3.5" />,
                        DayButton: DarkDayButton,
                    }}
                />

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-orange-500/10 bg-[#0d1117]">
                    <span className="text-[10px] font-mono text-slate-600">
                        {hasRange
                            ? `${format(range.from!, "MMM d")} – ${format(range.to!, "MMM d, yyyy")}`
                            : "Select a start and end date"}
                    </span>
                    <button
                        disabled={!hasRange}
                        onClick={() => setOpen(false)}
                        className={cn(
                            "px-4 py-1 text-[9px] font-mono uppercase tracking-widest border transition-colors",
                            hasRange
                                ? "border-orange-500/40 bg-orange-600 text-white hover:bg-orange-500"
                                : "border-slate-700 text-slate-600 cursor-not-allowed",
                        )}
                    >
                        Apply
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
