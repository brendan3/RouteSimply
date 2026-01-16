import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Route } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";

interface GenerateRoutesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationCount: number;
  onGenerate: (driverCount: number, dayOfWeek: string, scheduledDate: string) => void;
  isLoading?: boolean;
  defaultDay?: string;
  defaultDate?: string;
}

const DAY_VALUES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function GenerateRoutesDialog({
  open,
  onOpenChange,
  locationCount,
  onGenerate,
  isLoading,
  defaultDay,
  defaultDate,
}: GenerateRoutesDialogProps) {
  const [driverCount, setDriverCount] = useState<string>("2");

  // Build days with their next occurrence dates (next 14 days)
  const daysWithDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const options: { value: string; label: string; dayOfWeek: string }[] = [];
    
    // Generate next 14 days
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayIndex = date.getDay();
      const dayOfWeek = DAY_VALUES[dayIndex];
      const dayName = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
      const dateStr = format(date, "yyyy-MM-dd");
      const displayDate = format(date, "MMM d");
      
      options.push({
        value: dateStr, // Store the actual date as the value
        label: `${dayName} - ${displayDate}`,
        dayOfWeek,
      });
    }
    
    return options;
  }, []);

  // Default to the first available date
  const [selectedDate, setSelectedDate] = useState<string>(daysWithDates[0]?.value || "");

  // Sync selected date when dialog opens or defaults change
  useEffect(() => {
    if (open && daysWithDates.length > 0) {
      // If defaultDate is provided and exists in the list, use it
      if (defaultDate) {
        const matchingDate = daysWithDates.find(d => d.value === defaultDate);
        if (matchingDate) {
          setSelectedDate(matchingDate.value);
          return;
        }
      }
      // If defaultDay is provided, find the next occurrence of that day
      if (defaultDay) {
        const matchingDay = daysWithDates.find(d => d.dayOfWeek === defaultDay);
        if (matchingDay) {
          setSelectedDate(matchingDay.value);
          return;
        }
      }
      setSelectedDate(daysWithDates[0].value);
    }
  }, [open, defaultDay, defaultDate, daysWithDates]);

  const handleGenerate = () => {
    const selectedOption = daysWithDates.find(d => d.value === selectedDate);
    if (selectedOption) {
      onGenerate(parseInt(driverCount), selectedOption.dayOfWeek, selectedDate);
    }
  };

  const stopsPerDriver = Math.ceil(locationCount / parseInt(driverCount));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" />
            Generate Routes
          </DialogTitle>
          <DialogDescription>
            Divide {locationCount} locations among drivers and optimize routes for each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="scheduled-date">Schedule Date</Label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger id="scheduled-date" data-testid="select-scheduled-date">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {daysWithDates.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver-count">Number of Drivers</Label>
            <Select value={driverCount} onValueChange={setDriverCount}>
              <SelectTrigger id="driver-count" data-testid="select-driver-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} drivers
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total locations</span>
              <span className="font-medium text-foreground">{locationCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stops per driver (avg)</span>
              <span className="font-medium text-foreground">~{stopsPerDriver}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isLoading}
            data-testid="button-cancel-generate"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || locationCount === 0}
            className="flex-1"
            data-testid="button-confirm-generate"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Routes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
