"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar as UiCalendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

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
                    className="rounded w-56 justify-between font-normal"
                >
                    {range?.from && range?.to
                        ? `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`
                        : "Select date"}
                    <ChevronDownIcon />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <UiCalendar

                    mode="range"
                    selected={range}
                    captionLayout="dropdown"
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
