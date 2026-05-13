"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

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

export function Calendar({ startDate, endDate, setStartDateAction, setEndDateAction }: CalendarProps) {
    const [range, setRange] = React.useState<DateRange | undefined>(
        startDate && endDate ? { from: new Date(startDate), to: new Date(endDate) } : undefined
    )

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-56 justify-between font-normal rounded-none h-9 text-xs",
                        "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-cyan-400",
                        range?.from && "border-cyan-500/30 text-cyan-400"
                    )}
                >
                    {range?.from && range?.to
                        ? `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`
                        : "Select date range"}
                    <CalendarIcon className="size-4 text-slate-500" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-auto overflow-hidden p-0 bg-slate-900 border-slate-700 rounded-none" 
                align="start"
            >
                <UiCalendar
                    mode="range"
                    selected={range}
                    captionLayout="dropdown"
                    className="bg-slate-900 text-slate-300"
                    classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-medium text-slate-300",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-none",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-slate-800/50 [&:has([aria-selected])]:bg-slate-800 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-cyan-500/10 hover:text-cyan-400 rounded-none",
                        day_range_end: "day-range-end",
                        day_selected: "bg-cyan-600 text-white hover:bg-cyan-500 hover:text-white focus:bg-cyan-600 focus:text-white",
                        day_today: "bg-slate-800 text-cyan-400",
                        day_outside: "day-outside text-slate-600",
                        day_disabled: "text-slate-600",
                        day_range_middle: "aria-selected:bg-slate-800 aria-selected:text-slate-300",
                        day_hidden: "invisible",
                    }}
                    onSelect={(r) => {
                        setRange(r)
                        setStartDateAction(r?.from ? r.from.toISOString().split("T")[0] : "")
                        setEndDateAction(r?.to ? r.to.toISOString().split("T")[0] : "")
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}
