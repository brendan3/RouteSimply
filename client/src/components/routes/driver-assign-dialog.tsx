import { useState } from "react";
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
import type { User, Route } from "@shared/schema";

interface DriverAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: Route | null;
  drivers: User[];
  onAssign: (routeId: string, driverId: string, driverName: string, driverColor: string | null) => void;
  isLoading?: boolean;
}

export function DriverAssignDialog({
  open,
  onOpenChange,
  route,
  drivers,
  onAssign,
  isLoading,
}: DriverAssignDialogProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  const handleAssign = () => {
    if (route && selectedDriverId) {
      const driver = drivers.find((d) => d.id === selectedDriverId);
      if (driver) {
        onAssign(route.id, driver.id, driver.name, driver.color || null);
        setSelectedDriverId("");
      }
    }
  };

  const availableDrivers = drivers.filter((d) => d.role === "driver");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Driver</DialogTitle>
          <DialogDescription>
            Select a driver to assign to this route. They will be able to see this route in their schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="driver-select">Driver</Label>
            <Select
              value={selectedDriverId}
              onValueChange={setSelectedDriverId}
            >
              <SelectTrigger id="driver-select" data-testid="select-driver">
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {availableDrivers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No drivers available
                  </SelectItem>
                ) : (
                  availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-2">
                        {driver.color && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: driver.color }}
                          />
                        )}
                        <span style={{ color: driver.color || undefined }}>{driver.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {route && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">Route Details</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(route.stopsJson as any[])?.length || 0} stops
                {route.estimatedTime && ` • ~${Math.round(route.estimatedTime)} min`}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            data-testid="button-cancel-assign"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedDriverId || isLoading}
            className="flex-1"
            data-testid="button-confirm-assign"
          >
            {isLoading ? "Assigning..." : "Assign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
