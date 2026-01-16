import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { RouteCard } from "@/components/routes/route-card";
import { RouteMapView } from "@/components/routes/route-map-view";
import { DriverAssignDialog } from "@/components/routes/driver-assign-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Map, Grid, CalendarIcon, Plus, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday } from "date-fns";
import type { Route, Location, User } from "@shared/schema";

const DAYS_OF_WEEK = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const ROUTE_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-red-500",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarViewProps {
  routes: Route[];
  drivers: User[];
  calendarDate: Date;
  onDateChange: (date: Date) => void;
  onAssign: (route: Route) => void;
}

function CalendarView({ routes, drivers, calendarDate, onDateChange, onAssign }: CalendarViewProps) {
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 0 });
  const monthEndWeek = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: monthStartWeek, end: monthEndWeek });

  const getDriverColor = (driverId: string): string => {
    const index = drivers.findIndex((d) => d.id === driverId);
    return ROUTE_COLORS[index % ROUTE_COLORS.length];
  };

  const getRoutesForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return routes.filter((route) => route.date === dateStr);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onDateChange(subMonths(calendarDate, 1))}
            data-testid="button-calendar-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onDateChange(addMonths(calendarDate, 1))}
            data-testid="button-calendar-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDateChange(new Date())}
            data-testid="button-calendar-today"
          >
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{format(calendarDate, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          {drivers.slice(0, 5).map((driver) => (
            <div key={driver.id} className="flex items-center gap-1" data-testid={`legend-driver-${driver.id}`}>
              <div className={`w-3 h-3 rounded-full ${getDriverColor(driver.id)}`} data-testid={`legend-color-${driver.id}`} />
              <span className="text-xs text-muted-foreground" data-testid={`legend-name-${driver.id}`}>{driver.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          {monthDays.map((day, index) => {
            const dayRoutes = getRoutesForDate(day);
            const isCurrentMonth = isSameMonth(day, calendarDate);
            const isTodayDate = isToday(day);

            return (
              <div
                key={index}
                className={`min-h-[100px] p-2 rounded-lg border ${
                  isCurrentMonth ? "bg-background" : "bg-muted/30"
                } ${isTodayDate ? "ring-2 ring-primary" : ""}`}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayRoutes.length === 0 && isCurrentMonth && (
                    <p className="text-xs text-muted-foreground italic">No routes</p>
                  )}
                  {dayRoutes.slice(0, 3).map((route) => (
                    <div
                      key={route.id}
                      onClick={() => !route.driverId && onAssign(route)}
                      className={`px-1.5 py-0.5 rounded text-xs text-white truncate ${getDriverColor(route.driverId || "")} ${!route.driverId ? "cursor-pointer hover-elevate" : ""}`}
                      title={`${route.driverName || "Unassigned"} - ${route.stopCount} stops`}
                      data-testid={`calendar-route-${route.id}`}
                    >
                      {route.driverName || "Unassigned"}
                    </div>
                  ))}
                  {dayRoutes.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{dayRoutes.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export default function AdminRoutesPage() {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map" | "calendar">(() => {
    const saved = localStorage.getItem("routes_viewMode");
    if (saved === "map") return "map";
    if (saved === "calendar") return "calendar";
    return "list";
  });
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    return localStorage.getItem("routes_selectedDay") || "all";
  });
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return localStorage.getItem("routes_selectedTab") || "all";
  });
  const [calendarDate, setCalendarDate] = useState(() => {
    const saved = localStorage.getItem("routes_calendarDate");
    return saved ? new Date(saved) : new Date();
  });

  // Persist state to localStorage
  const handleViewModeChange = (mode: "list" | "map" | "calendar") => {
    setViewMode(mode);
    localStorage.setItem("routes_viewMode", mode);
  };
  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    localStorage.setItem("routes_selectedDay", day);
  };
  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    localStorage.setItem("routes_selectedTab", tab);
  };
  const handleCalendarDateChange = (date: Date) => {
    setCalendarDate(date);
    localStorage.setItem("routes_calendarDate", date.toISOString());
  };

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: routes = [], isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  const { data: locations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: drivers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({
      routeId,
      driverId,
      driverName,
    }: {
      routeId: string;
      driverId: string;
      driverName: string;
    }) => {
      return apiRequest<Route>("PATCH", `/api/routes/${routeId}/assign`, {
        driverId,
        driverName,
      });
    },
    onSuccess: () => {
      setShowAssignDialog(false);
      setSelectedRoute(null);
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Driver assigned successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign driver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const publishRoutesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/routes/publish");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Routes published successfully" });
    },
  });

  const unpublishRoutesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/routes/unpublish");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Routes unpublished successfully" });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      return apiRequest("DELETE", `/api/routes/${routeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Route deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete route",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssign = (route: Route) => {
    setSelectedRoute(route);
    setShowAssignDialog(true);
  };

  // Filter routes by selected day
  const filteredRoutes = selectedDay === "all" 
    ? routes 
    : routes.filter((r) => r.dayOfWeek === selectedDay);

  const draftRoutes = filteredRoutes.filter((r) => r.status === "draft");
  const assignedRoutes = filteredRoutes.filter((r) => r.status === "assigned");
  const publishedRoutes = filteredRoutes.filter((r) => r.status === "published");

  // Count routes by day for the tabs
  const routeCountByDay = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day.value] = routes.filter((r) => r.dayOfWeek === day.value).length;
    return acc;
  }, {} as Record<string, number>);

  const isLoading = routesLoading || locationsLoading;

  return (
    <AdminLayout
      title="Route Management"
      subtitle={`${locations.length} locations • ${routes.length} routes`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => handleViewModeChange("list")}
            data-testid="button-list-view"
          >
            <Grid className="w-4 h-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === "map" ? "default" : "outline"}
            onClick={() => handleViewModeChange("map")}
            data-testid="button-map-view"
          >
            <Map className="w-4 h-4 mr-2" />
            Map
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            onClick={() => handleViewModeChange("calendar")}
            data-testid="button-calendar-view"
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Calendar
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-16" text="Loading routes..." />
      ) : routes.length === 0 ? (
        locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No delivery stops yet"
            description="Add delivery stops first, then generate optimized routes for your drivers."
            action={
              <Button onClick={() => navigate("/admin/stops")} data-testid="button-go-to-stops">
                <MapPin className="w-4 h-4 mr-2" />
                Go to Delivery Stops
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Map}
            title="No routes yet"
            description="Go to Confirm Route to generate optimized routes from your delivery stops."
            action={
              <Button onClick={() => navigate("/admin/confirm-route")} data-testid="button-go-to-confirm">
                <Plus className="w-4 h-4 mr-2" />
                Go to Confirm Route
              </Button>
            }
          />
        )
      ) : viewMode === "calendar" ? (
        <CalendarView 
          routes={routes} 
          drivers={drivers.filter(u => u.role === "driver")}
          calendarDate={calendarDate}
          onDateChange={handleCalendarDateChange}
          onAssign={(route) => {
            setSelectedRoute(route);
            setShowAssignDialog(true);
          }}
        />
      ) : viewMode === "map" ? (
        <RouteMapView routes={filteredRoutes} />
      ) : (
        <div className="space-y-6">
          {/* Day of Week Filter */}
          <div className="flex flex-wrap items-center gap-2" data-testid="day-filter-tabs">
            <Button
              variant={selectedDay === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => handleDayChange("all")}
              data-testid="button-day-all"
            >
              All Days ({routes.length})
            </Button>
            {DAYS_OF_WEEK.map((day) => (
              <Button
                key={day.value}
                variant={selectedDay === day.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleDayChange(day.value)}
                data-testid={`button-day-${day.value}`}
              >
                {day.label} {routeCountByDay[day.value] > 0 && `(${routeCountByDay[day.value]})`}
              </Button>
            ))}
          </div>

          <Tabs value={selectedTab} onValueChange={handleTabChange} className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all-routes">
                  All ({filteredRoutes.length})
                </TabsTrigger>
                <TabsTrigger value="draft" data-testid="tab-draft-routes">
                  Draft ({draftRoutes.length})
                </TabsTrigger>
                <TabsTrigger value="assigned" data-testid="tab-assigned-routes">
                  Assigned ({assignedRoutes.length})
                </TabsTrigger>
                <TabsTrigger value="published" data-testid="tab-published-routes">
                  Published ({publishedRoutes.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                {assignedRoutes.length > 0 && (
                  <Button
                    onClick={() => publishRoutesMutation.mutate()}
                    disabled={publishRoutesMutation.isPending}
                    data-testid="button-publish-routes"
                  >
                    Publish All Routes
                  </Button>
                )}
                {publishedRoutes.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => unpublishRoutesMutation.mutate()}
                    disabled={unpublishRoutesMutation.isPending}
                    data-testid="button-unpublish-routes"
                  >
                    Unpublish All Routes
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="all">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    onAssign={() => handleAssign(route)}
                    onDelete={() => deleteRouteMutation.mutate(route.id)}
                  />
                ))}
              </div>
            </TabsContent>

          <TabsContent value="draft">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {draftRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onAssign={() => handleAssign(route)}
                  onDelete={() => deleteRouteMutation.mutate(route.id)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="assigned">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {assignedRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onDelete={() => deleteRouteMutation.mutate(route.id)}
                />
              ))}
            </div>
          </TabsContent>

            <TabsContent value="published">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {publishedRoutes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    onDelete={() => deleteRouteMutation.mutate(route.id)}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <DriverAssignDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        route={selectedRoute}
        drivers={drivers}
        onAssign={(routeId, driverId, driverName) =>
          assignDriverMutation.mutate({ routeId, driverId, driverName })
        }
        isLoading={assignDriverMutation.isPending}
      />
    </AdminLayout>
  );
}
