"use client";

import * as React from "react";
import { ChevronDownIcon, Calendar } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Calendar23Props {
  range?: DateRange;
  onRangeChange?: (range?: DateRange) => void;
}

export function Calendar23({ range, onRangeChange }: Calendar23Props) {
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(range);

  React.useEffect(() => {
    setInternalRange(range);
  }, [range]);

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setInternalRange(selectedRange);
    onRangeChange?.(selectedRange);
  };

  return (
    <div className="flex flex-col gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="dates"
            className="w-56 justify-between bg-slate-900/50 border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/20 hover:text-cyan-300"
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-500/60" />
              {internalRange?.from && internalRange?.to
                ? `${internalRange.from.toLocaleDateString()} - ${internalRange.to.toLocaleDateString()}`
                : <span className="text-cyan-500/50">Select date range</span>}
            </div>
            <ChevronDownIcon className="text-cyan-500/60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0 bg-[#0a0f1c] border border-cyan-500/30" align="start">
          <CalendarComponent
            mode="range"
            selected={internalRange}
            captionLayout="dropdown"
            onSelect={handleSelect}
            className="bg-[#0a0f1c] text-cyan-100"
            classNames={{
              day_selected: "bg-cyan-500 text-white hover:bg-cyan-400",
              day_range_middle: "bg-cyan-500/20 text-cyan-100",
              day_today: "text-cyan-400 border border-cyan-500/50",
              caption_label: "text-cyan-100 font-medium",
              nav_button: "text-cyan-400 hover:bg-cyan-500/20",
              head_cell: "text-cyan-500/70",
              cell: "text-cyan-100 hover:bg-cyan-500/20",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
