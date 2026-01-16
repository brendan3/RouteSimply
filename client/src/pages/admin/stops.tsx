import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CSVUpload } from "@/components/upload/csv-upload";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Upload, Trash2, Search, Check, Calendar, Building2 } from "lucide-react";
import type { Location } from "@shared/schema";

const DAYS_OF_WEEK = [
  { value: "monday", label: "Mon", fullLabel: "Monday", color: "bg-blue-500" },
  { value: "tuesday", label: "Tue", fullLabel: "Tuesday", color: "bg-green-500" },
  { value: "wednesday", label: "Wed", fullLabel: "Wednesday", color: "bg-yellow-500" },
  { value: "thursday", label: "Thu", fullLabel: "Thursday", color: "bg-orange-500" },
  { value: "friday", label: "Fri", fullLabel: "Friday", color: "bg-red-500" },
  { value: "saturday", label: "Sat", fullLabel: "Saturday", color: "bg-purple-500" },
  { value: "sunday", label: "Sun", fullLabel: "Sunday", color: "bg-pink-500" },
];

export default function AdminStopsPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDay, setFilterDay] = useState<string>("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/locations/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setUploadSuccess(true);
      setUploadError(null);
      setShowUpload(false);
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "CSV uploaded successfully" });
    },
    onError: (error: Error) => {
      setUploadError(error.message);
      setUploadSuccess(false);
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, daysOfWeek }: { id: string; daysOfWeek: string[] }) => {
      return apiRequest<Location>("PATCH", `/api/locations/${id}`, { daysOfWeek });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Location deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDayToggle = (location: Location, day: string) => {
    const currentDays = location.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    
    updateLocationMutation.mutate({ id: location.id, daysOfWeek: newDays });
  };

  const handleQuickAssign = (location: Location, day: string) => {
    const currentDays = location.daysOfWeek || [];
    if (!currentDays.includes(day)) {
      updateLocationMutation.mutate({ id: location.id, daysOfWeek: [...currentDays, day] });
      toast({ title: `Added to ${DAYS_OF_WEEK.find(d => d.value === day)?.fullLabel}` });
    }
  };

  // Filter locations
  let filteredLocations = locations.filter(
    (loc) =>
      loc.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filterDay !== "all" && filterDay !== "unscheduled") {
    filteredLocations = filteredLocations.filter((loc) => 
      loc.daysOfWeek?.includes(filterDay)
    );
  } else if (filterDay === "unscheduled") {
    filteredLocations = filteredLocations.filter((loc) => 
      !loc.daysOfWeek || loc.daysOfWeek.length === 0
    );
  }

  // Count locations per day
  const countByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day.value] = locations.filter((loc) => loc.daysOfWeek?.includes(day.value)).length;
    return acc;
  }, {} as Record<string, number>);

  const unscheduledCount = locations.filter((loc) => !loc.daysOfWeek || loc.daysOfWeek.length === 0).length;

  return (
    <AdminLayout
      title="Delivery Stops"
      subtitle={`${locations.length} stops total`}
      actions={
        <Button onClick={() => setShowUpload(!showUpload)} data-testid="button-upload-csv">
          <Upload className="w-4 h-4 mr-2" />
          Upload CSV
        </Button>
      }
    >
      {showUpload && (
        <Card className="p-6 mb-6">
          <CSVUpload
            onUpload={(file) => uploadMutation.mutate(file)}
            isLoading={uploadMutation.isPending}
            error={uploadError}
            success={uploadSuccess}
          />
        </Card>
      )}

      {isLoading ? (
        <LoadingSpinner className="py-16" text="Loading stops..." />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No delivery stops"
          description="Upload a CSV file with delivery addresses to get started."
          action={
            <Button onClick={() => setShowUpload(true)} data-testid="button-first-upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload CSV
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Day Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card 
              className={`cursor-pointer transition-all hover-elevate ${filterDay === "all" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilterDay("all")}
              data-testid="filter-all"
            >
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{locations.length}</p>
                <p className="text-xs text-muted-foreground">All Stops</p>
              </CardContent>
            </Card>
            {DAYS_OF_WEEK.map((day) => (
              <Card 
                key={day.value}
                className={`cursor-pointer transition-all hover-elevate ${filterDay === day.value ? "ring-2 ring-primary" : ""}`}
                onClick={() => setFilterDay(day.value)}
                data-testid={`filter-${day.value}`}
              >
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{countByDay[day.value]}</p>
                  <p className="text-xs text-muted-foreground">{day.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Unscheduled Alert */}
          {unscheduledCount > 0 && (
            <Card 
              className={`cursor-pointer border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 ${filterDay === "unscheduled" ? "ring-2 ring-orange-500" : ""}`}
              onClick={() => setFilterDay("unscheduled")}
              data-testid="filter-unscheduled"
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">
                      {unscheduledCount} stops need scheduling
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Click to view and assign days to these stops
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300">
                  Action Required
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-stops"
            />
          </div>

          {/* Stops List */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredLocations.map((location) => (
              <Card key={location.id} className="overflow-hidden" data-testid={`stop-card-${location.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{location.customerName}</CardTitle>
                      {location.serviceType && (
                        <p className="text-xs text-muted-foreground mt-0.5">{location.serviceType}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteLocationMutation.mutate(location.id)}
                      data-testid={`button-delete-stop-${location.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{location.address}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Schedule Days</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = location.daysOfWeek?.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          onClick={() => handleDayToggle(location, day.value)}
                          className={`relative w-10 h-10 rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 border border-transparent hover:border-primary/20"
                          }`}
                          data-testid={`day-toggle-${location.id}-${day.value}`}
                          title={isSelected ? `Remove from ${day.fullLabel}` : `Add to ${day.fullLabel}`}
                        >
                          {day.label}
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-online text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Quick assign for unscheduled */}
                  {(!location.daysOfWeek || location.daysOfWeek.length === 0) && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Quick assign:</p>
                      <div className="flex flex-wrap gap-1">
                        {DAYS_OF_WEEK.slice(0, 5).map((day) => (
                          <Button
                            key={day.value}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleQuickAssign(location, day.value)}
                            data-testid={`quick-assign-${location.id}-${day.value}`}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show scheduled days summary */}
                  {location.daysOfWeek && location.daysOfWeek.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {location.daysOfWeek.length === 1 
                            ? "Weekly" 
                            : `${location.daysOfWeek.length}x per week`}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredLocations.length === 0 && (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No stops found</p>
                <p className="text-sm mt-1">
                  {filterDay === "unscheduled" 
                    ? "All stops have been scheduled" 
                    : searchQuery 
                      ? "Try adjusting your search" 
                      : `No stops scheduled for ${DAYS_OF_WEEK.find(d => d.value === filterDay)?.fullLabel || "this day"}`}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
