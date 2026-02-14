import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CSVUpload } from "@/components/upload/csv-upload";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { CustomerDetailDialog } from "@/components/customer/customer-detail-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiUpload } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Upload, Trash2, Search, Check, Calendar, Building2, Grid, List, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Location } from "@shared/schema";

const DAYS_OF_WEEK = [
  { value: "monday", label: "Mon", fullLabel: "Monday" },
  { value: "tuesday", label: "Tue", fullLabel: "Tuesday" },
  { value: "wednesday", label: "Wed", fullLabel: "Wednesday" },
  { value: "thursday", label: "Thu", fullLabel: "Thursday" },
  { value: "friday", label: "Fri", fullLabel: "Friday" },
  { value: "saturday", label: "Sat", fullLabel: "Saturday" },
  { value: "sunday", label: "Sun", fullLabel: "Sunday" },
];

type SortField = "customerName" | "address" | "daysCount";
type SortDirection = "asc" | "desc";

export default function AdminStopsPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDay, setFilterDay] = useState<string>(() => {
    return localStorage.getItem("stops_filterDay") || "all";
  });
  const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
    const saved = localStorage.getItem("stops_viewMode");
    return saved === "list" ? "list" : "cards";
  });
  const [sortField, setSortField] = useState<SortField>("customerName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);

  // Persist state to localStorage
  const handleFilterDayChange = (day: string) => {
    setFilterDay(day);
    localStorage.setItem("stops_filterDay", day);
  };
  const handleViewModeChange = (mode: "cards" | "list") => {
    setViewMode(mode);
    localStorage.setItem("stops_viewMode", mode);
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload("/api/locations/upload", formData);
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

  const handleCustomerClick = (location: Location) => {
    setSelectedLocation(location);
    setShowCustomerDialog(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort locations - use useMemo to maintain stable order
  const filteredAndSortedLocations = useMemo(() => {
    let result = [...locations];

    // Apply search filter
    if (searchQuery) {
      result = result.filter(
        (loc) =>
          loc.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply day filter
    if (filterDay !== "all" && filterDay !== "unscheduled") {
      result = result.filter((loc) => loc.daysOfWeek?.includes(filterDay));
    } else if (filterDay === "unscheduled") {
      result = result.filter((loc) => !loc.daysOfWeek || loc.daysOfWeek.length === 0);
    }

    // Apply sorting - alphabetical by name in cards view, configurable in list view
    if (viewMode === "cards") {
      // Always sort alphabetically by customer name in cards view
      result.sort((a, b) => a.customerName.localeCompare(b.customerName));
    } else {
      result.sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case "customerName":
            comparison = a.customerName.localeCompare(b.customerName);
            break;
          case "address":
            comparison = a.address.localeCompare(b.address);
            break;
          case "daysCount":
            comparison = (a.daysOfWeek?.length || 0) - (b.daysOfWeek?.length || 0);
            break;
        }
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [locations, searchQuery, filterDay, viewMode, sortField, sortDirection]);

  // Count locations per day
  const countByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day.value] = locations.filter((loc) => loc.daysOfWeek?.includes(day.value)).length;
    return acc;
  }, {} as Record<string, number>);

  const unscheduledCount = locations.filter((loc) => !loc.daysOfWeek || loc.daysOfWeek.length === 0).length;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="w-4 h-4 ml-1" /> 
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  return (
    <AdminLayout
      title="Delivery Stops"
      subtitle={`${locations.length} stops total`}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("cards")}
              data-testid="button-view-cards"
            >
              <Grid className="w-4 h-4 mr-1" />
              Cards
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewModeChange("list")}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4 mr-1" />
              List
            </Button>
          </div>
          <Button onClick={() => setShowUpload(!showUpload)} data-testid="button-upload-csv">
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
        </div>
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
              onClick={() => handleFilterDayChange("all")}
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
                onClick={() => handleFilterDayChange(day.value)}
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
              onClick={() => handleFilterDayChange("unscheduled")}
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

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-stops"
              />
            </div>
            {viewMode === "list" && (
              <Select value={filterDay} onValueChange={setFilterDay}>
                <SelectTrigger className="w-40" data-testid="select-filter-day">
                  <SelectValue placeholder="Filter by day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  <SelectItem value="unscheduled">Unscheduled</SelectItem>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.fullLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* List View */}
          {viewMode === "list" ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer select-none"
                      onClick={() => handleSort("customerName")}
                      data-testid="sort-customer"
                    >
                      <div className="flex items-center">
                        Customer
                        <SortIcon field="customerName" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none"
                      onClick={() => handleSort("address")}
                      data-testid="sort-address"
                    >
                      <div className="flex items-center">
                        Address
                        <SortIcon field="address" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none text-center"
                      onClick={() => handleSort("daysCount")}
                      data-testid="sort-days"
                    >
                      <div className="flex items-center justify-center">
                        Schedule Days
                        <SortIcon field="daysCount" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedLocations.map((location) => (
                    <TableRow key={location.id} data-testid={`stop-row-${location.id}`}>
                      <TableCell>
                        <div>
                          <p 
                            className="font-medium text-primary hover:underline cursor-pointer"
                            onClick={() => handleCustomerClick(location)}
                            data-testid={`customer-name-${location.id}`}
                          >
                            {location.customerName}
                          </p>
                          {location.serviceType && (
                            <p className="text-xs text-muted-foreground">{location.serviceType}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{location.address}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {DAYS_OF_WEEK.map((day) => {
                            const isSelected = location.daysOfWeek?.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                onClick={() => handleDayToggle(location, day.value)}
                                className={`w-9 h-9 rounded-lg text-xs font-medium transition-all duration-150 transform active:scale-90 hover-elevate ${
                                  isSelected
                                    ? "bg-gradient-to-br from-primary to-[hsl(220,80%,55%)] text-primary-foreground shadow-md ring-2 ring-primary/30"
                                    : "bg-muted text-muted-foreground"
                                }`}
                                data-testid={`day-toggle-${location.id}-${day.value}`}
                                title={day.fullLabel}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLocationMutation.mutate(location.id)}
                          data-testid={`button-delete-stop-${location.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredAndSortedLocations.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
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
              )}
            </Card>
          ) : (
            /* Card View */
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredAndSortedLocations.map((location) => (
                  <Card key={location.id} className="overflow-hidden" data-testid={`stop-card-${location.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle 
                            className="text-base truncate text-primary hover:underline cursor-pointer"
                            onClick={() => handleCustomerClick(location)}
                            data-testid={`customer-name-${location.id}`}
                          >
                            {location.customerName}
                          </CardTitle>
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
                              className={`relative w-10 h-10 rounded-lg text-xs font-medium transition-all duration-150 transform active:scale-90 hover-elevate flex items-center justify-center ${
                                isSelected
                                  ? "bg-gradient-to-br from-primary to-[hsl(220,80%,55%)] text-primary-foreground shadow-md ring-2 ring-primary/30"
                                  : "bg-muted text-muted-foreground border border-transparent"
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

              {filteredAndSortedLocations.length === 0 && (
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
            </>
          )}
        </div>
      )}

      <CustomerDetailDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        locationId={selectedLocation?.id || null}
        customerName={selectedLocation?.customerName}
        address={selectedLocation?.address}
        isAdmin={true}
      />
    </AdminLayout>
  );
}
