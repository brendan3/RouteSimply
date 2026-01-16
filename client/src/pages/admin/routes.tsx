import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";
import { RouteCard } from "@/components/routes/route-card";
import { RouteMapView } from "@/components/routes/route-map-view";
import { GenerateRoutesDialog } from "@/components/routes/generate-routes-dialog";
import { DriverAssignDialog } from "@/components/routes/driver-assign-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Map, Grid, Plus, MapPin } from "lucide-react";
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

function getCurrentDayOfWeek(): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date().getDay()];
}

export default function AdminRoutesPage() {
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedDay, setSelectedDay] = useState<string>("all");

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

  const generateRoutesMutation = useMutation({
    mutationFn: async ({ driverCount, dayOfWeek, scheduledDate }: { driverCount: number; dayOfWeek: string; scheduledDate: string }) => {
      return apiRequest<Route[]>("POST", "/api/routes/generate", { driverCount, dayOfWeek, scheduledDate });
    },
    onSuccess: () => {
      setShowGenerateDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Routes generated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate routes",
        description: error.message,
        variant: "destructive",
      });
    },
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
            onClick={() => setShowGenerateDialog(true)}
            disabled={locations.length === 0}
            data-testid="button-generate-routes"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate Routes
          </Button>
          <div className="flex items-center gap-1 border-l pl-2 ml-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              data-testid="button-list-view"
            >
              <Grid className="w-4 h-4 mr-2" />
              List View
            </Button>
            <Button
              variant={viewMode === "map" ? "default" : "outline"}
              onClick={() => setViewMode("map")}
              data-testid="button-map-view"
            >
              <Map className="w-4 h-4 mr-2" />
              Map View
            </Button>
          </div>
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
            description="Generate optimized routes from your delivery stops."
            action={
              <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-first-routes">
                <Plus className="w-4 h-4 mr-2" />
                Generate Routes
              </Button>
            }
          />
        )
      ) : viewMode === "map" ? (
        <RouteMapView routes={filteredRoutes} />
      ) : (
        <div className="space-y-6">
          {/* Day of Week Filter */}
          <div className="flex flex-wrap items-center gap-2" data-testid="day-filter-tabs">
            <Button
              variant={selectedDay === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDay("all")}
              data-testid="button-day-all"
            >
              All Days ({routes.length})
            </Button>
            {DAYS_OF_WEEK.map((day) => (
              <Button
                key={day.value}
                variant={selectedDay === day.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDay(day.value)}
                data-testid={`button-day-${day.value}`}
              >
                {day.label} {routeCountByDay[day.value] > 0 && `(${routeCountByDay[day.value]})`}
              </Button>
            ))}
          </div>

          <Tabs defaultValue="all" className="space-y-6">
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

      <GenerateRoutesDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        locationCount={locations.length}
        onGenerate={(count, dayOfWeek, scheduledDate) => generateRoutesMutation.mutate({ driverCount: count, dayOfWeek, scheduledDate })}
        defaultDay={selectedDay !== "all" ? selectedDay : undefined}
        isLoading={generateRoutesMutation.isPending}
      />

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
