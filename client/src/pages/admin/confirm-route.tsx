import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GenerateRoutesDialog } from "@/components/routes/generate-routes-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  MapPin, 
  CalendarIcon, 
  Check, 
  X, 
  Search, 
  ArrowRight, 
  CheckCircle2,
  XCircle,
  Building2,
  Plus
} from "lucide-react";
import { format, addDays } from "date-fns";
import type { Location, RouteConfirmation, Route } from "@shared/schema";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  { value: "sunday", label: "Sun", index: 0 },
  { value: "monday", label: "Mon", index: 1 },
  { value: "tuesday", label: "Tue", index: 2 },
  { value: "wednesday", label: "Wed", index: 3 },
  { value: "thursday", label: "Thu", index: 4 },
  { value: "friday", label: "Fri", index: 5 },
  { value: "saturday", label: "Sat", index: 6 },
];

function getDayOfWeek(date: Date): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
}

export default function AdminConfirmRoutePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [localExclusions, setLocalExclusions] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const dayOfWeek = getDayOfWeek(selectedDate);
  const dayLabel = DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || dayOfWeek;

  const { data: locations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: confirmations = [], isLoading: confirmationsLoading } = useQuery<RouteConfirmation[]>({
    queryKey: ["/api/route-confirmations", formattedDate],
    queryFn: async () => {
      const response = await fetch(`/api/route-confirmations?date=${formattedDate}`);
      if (!response.ok) throw new Error("Failed to fetch confirmations");
      return response.json();
    },
  });

  const stopsForDay = useMemo(() => {
    return locations.filter(loc => loc.daysOfWeek?.includes(dayOfWeek));
  }, [locations, dayOfWeek]);

  useEffect(() => {
    const excludedSet = new Set<string>();
    confirmations.forEach(c => {
      if (c.excluded) {
        excludedSet.add(c.locationId);
      }
    });
    setLocalExclusions(excludedSet);
    setHasUnsavedChanges(false);
  }, [confirmations]);

  const filteredStops = useMemo(() => {
    if (!searchQuery) return stopsForDay;
    const query = searchQuery.toLowerCase();
    return stopsForDay.filter(
      loc =>
        loc.customerName.toLowerCase().includes(query) ||
        loc.address.toLowerCase().includes(query)
    );
  }, [stopsForDay, searchQuery]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const confirmationsToSave = stopsForDay.map(stop => ({
        locationId: stop.id,
        excluded: localExclusions.has(stop.id),
      }));
      
      return apiRequest("POST", "/api/route-confirmations/bulk", {
        scheduledDate: formattedDate,
        confirmations: confirmationsToSave,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-confirmations", formattedDate] });
      setHasUnsavedChanges(false);
      toast({ title: "Confirmations saved successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save confirmations",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateRoutesMutation = useMutation({
    mutationFn: async ({ driverCount, dayOfWeek, scheduledDate }: { driverCount: number; dayOfWeek: string; scheduledDate: string }) => {
      return apiRequest<Route[]>("POST", "/api/routes/generate", { driverCount, dayOfWeek, scheduledDate });
    },
    onSuccess: () => {
      setShowGenerateDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Routes generated successfully" });
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate routes",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleExclusion = (locationId: string) => {
    setLocalExclusions(prev => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleExcludeAll = () => {
    setLocalExclusions(new Set(stopsForDay.map(s => s.id)));
    setHasUnsavedChanges(true);
  };

  const handleIncludeAll = () => {
    setLocalExclusions(new Set());
    setHasUnsavedChanges(true);
  };

  const isLoading = locationsLoading || confirmationsLoading;
  const includedCount = stopsForDay.length - localExclusions.size;
  const excludedCount = localExclusions.size;

  return (
    <AdminLayout
      title="Confirm Route"
      subtitle={`Review and confirm stops for ${format(selectedDate, "EEEE, MMMM d, yyyy")}`}
      actions={
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300">
              Unsaved Changes
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasUnsavedChanges}
            data-testid="button-save-confirmations"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            onClick={() => setShowGenerateDialog(true)}
            disabled={includedCount === 0}
            data-testid="button-generate-routes"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Routes
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Select Date:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                      )}
                      data-testid="button-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, "PPP")}
                      <Badge variant="secondary" className="ml-auto">
                        {dayLabel}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      data-testid="calendar-date-picker"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-medium">{includedCount}</span>
                  <span className="text-muted-foreground">included</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span className="font-medium">{excludedCount}</span>
                  <span className="text-muted-foreground">excluded</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <LoadingSpinner className="py-16" text="Loading stops..." />
        ) : stopsForDay.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={`No stops scheduled for ${dayLabel}`}
            description="There are no delivery stops assigned to this day of the week. Go to Delivery Stops to assign days."
            action={
              <Button onClick={() => navigate("/admin/stops")} data-testid="button-go-to-stops">
                <MapPin className="w-4 h-4 mr-2" />
                Go to Delivery Stops
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search stops..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-stops"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleIncludeAll}
                  data-testid="button-include-all"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Include All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExcludeAll}
                  data-testid="button-exclude-all"
                >
                  <X className="w-4 h-4 mr-1" />
                  Exclude All
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Stops for {format(selectedDate, "EEEE, MMMM d")} ({stopsForDay.length} total)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredStops.map((location) => {
                    const isExcluded = localExclusions.has(location.id);
                    return (
                      <div
                        key={location.id}
                        className={cn(
                          "flex items-center gap-4 p-4 transition-colors",
                          isExcluded && "bg-destructive/5"
                        )}
                        data-testid={`stop-row-${location.id}`}
                      >
                        <button
                          onClick={() => handleToggleExclusion(location.id)}
                          className={cn(
                            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                            isExcluded
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-primary text-primary-foreground"
                          )}
                          data-testid={`toggle-stop-${location.id}`}
                          title={isExcluded ? "Click to include" : "Click to exclude"}
                        >
                          {isExcluded ? (
                            <X className="w-5 h-5" />
                          ) : (
                            <Check className="w-5 h-5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium",
                            isExcluded && "text-muted-foreground line-through"
                          )}>
                            {location.customerName}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{location.address}</span>
                          </div>
                        </div>
                        <Badge
                          variant={isExcluded ? "destructive" : "secondary"}
                          className="flex-shrink-0"
                        >
                          {isExcluded ? "Excluded" : "Included"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                {filteredStops.length === 0 && searchQuery && (
                  <div className="p-8 text-center text-muted-foreground">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No stops found</p>
                    <p className="text-sm mt-1">Try adjusting your search</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    <p>
                      <strong>{includedCount}</strong> stops will be included when generating routes for this date.
                      {excludedCount > 0 && (
                        <span> ({excludedCount} excluded just for this day)</span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        saveMutation.mutate();
                      }
                      setShowGenerateDialog(true);
                    }}
                    disabled={saveMutation.isPending || includedCount === 0}
                    data-testid="button-save-and-generate"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {hasUnsavedChanges ? "Save & " : ""}Generate Routes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <GenerateRoutesDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        locationCount={includedCount}
        onGenerate={(count, dayOfWeek, scheduledDate) => generateRoutesMutation.mutate({ driverCount: count, dayOfWeek, scheduledDate })}
        defaultDay={dayOfWeek}
        defaultDate={formattedDate}
        isLoading={generateRoutesMutation.isPending}
      />
    </AdminLayout>
  );
}
