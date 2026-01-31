"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger, } from "@/components/ui/popover";

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
            className="w-56 justify-between font-normal"
          >
            {internalRange?.from && internalRange?.to
              ? `${internalRange.from.toLocaleDateString()} - ${internalRange.to.toLocaleDateString()}`
              : "Select date"}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="range"
            selected={internalRange}
            captionLayout="dropdown"
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
