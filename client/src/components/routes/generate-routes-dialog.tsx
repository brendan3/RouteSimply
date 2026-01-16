import { useState, useEffect } from "react";
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

interface GenerateRoutesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationCount: number;
  onGenerate: (driverCount: number, dayOfWeek?: string) => void;
  isLoading?: boolean;
  defaultDay?: string;
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export function GenerateRoutesDialog({
  open,
  onOpenChange,
  locationCount,
  onGenerate,
  isLoading,
  defaultDay,
}: GenerateRoutesDialogProps) {
  const [driverCount, setDriverCount] = useState<string>("2");
  const [dayOfWeek, setDayOfWeek] = useState<string>(defaultDay || "monday");

  // Sync dayOfWeek state when defaultDay changes or dialog opens
  useEffect(() => {
    if (open && defaultDay) {
      setDayOfWeek(defaultDay);
    }
  }, [open, defaultDay]);

  const handleGenerate = () => {
    onGenerate(parseInt(driverCount), dayOfWeek);
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
            <Label htmlFor="day-of-week">Day of Week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger id="day-of-week" data-testid="select-day-of-week">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
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
