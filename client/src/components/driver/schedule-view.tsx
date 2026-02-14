import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/context/auth-context";
import { StopCompletionDialog } from "@/components/driver/stop-completion-dialog";
import { CustomerDetailDialog } from "@/components/customer/customer-detail-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Navigation, Clock, ExternalLink, Calendar, Check, SkipForward, Undo2 } from "lucide-react";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";
import type { Route, RouteStop, StopCompletion } from "@shared/schema";

function getCurrentDayOfWeek(): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date().getDay()];
}

function formatDayOfWeek(day: string | null | undefined): string {
  if (!day) return "";
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function DriverScheduleView() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { send } = useWebSocket();
  const todayDayOfWeek = getCurrentDayOfWeek();
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [completionStop, setCompletionStop] = useState<RouteStop | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  // Fetch routes
  const { data: routes = [], isLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes", "driver", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/routes?driverId=${user?.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch routes");
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Find today's route
  const todayRoute = routes.find((r) => 
    (r.status === "published" || r.status === "assigned") && r.dayOfWeek === todayDayOfWeek
  ) || routes.find((r) => r.status === "published" || r.status === "assigned");
  
  const stops = (todayRoute?.stopsJson || []) as RouteStop[];

  // Fetch stop completions for this route
  const { data: completions = [] } = useQuery<StopCompletion[]>({
    queryKey: ["/api/stop-completions/route", todayRoute?.id],
    queryFn: async () => {
      const response = await fetch(`/api/stop-completions/route/${todayRoute!.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch completions");
      return response.json();
    },
    enabled: !!todayRoute?.id,
  });

  // Create a completion map: stopId -> completion
  const completionMap = new Map(completions.map(c => [c.stopId, c]));

  // Calculate progress
  const completedCount = completions.filter(c => c.status === "completed").length;
  const skippedCount = completions.filter(c => c.status === "skipped").length;
  const progressPercent = stops.length > 0 ? ((completedCount + skippedCount) / stops.length) * 100 : 0;

  // Send location updates periodically
  useEffect(() => {
    if (!todayRoute || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        send("driver_location", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
        });

        // Also persist to API (throttled via the server)
        apiRequest("POST", "/api/driver-locations", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
          speed: position.coords.speed,
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [todayRoute, send]);

  // Complete stop mutation
  const completeMutation = useMutation({
    mutationFn: async (data: { stopId: string; status: "completed" | "skipped"; notes?: string; photoFile?: File }) => {
      const stop = stops.find(s => s.id === data.stopId);
      
      // Get current position
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}

      const completion = await apiRequest<StopCompletion>("POST", "/api/stop-completions", {
        routeId: todayRoute!.id,
        stopId: data.stopId,
        locationId: stop?.locationId,
        status: data.status,
        notes: data.notes,
        lat,
        lng,
      });

      // Upload photo if provided
      if (data.photoFile && completion.id) {
        const formData = new FormData();
        formData.append("photo", data.photoFile);
        await apiUpload(`/api/stop-completions/${completion.id}/photo`, formData);
      }

      return completion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stop-completions/route", todayRoute?.id] });
      setShowCompletionDialog(false);
      setCompletionStop(null);
      toast({ title: "Stop updated", description: "Stop status recorded successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Undo completion mutation
  const undoMutation = useMutation({
    mutationFn: async (completionId: string) => {
      await apiRequest("DELETE", `/api/stop-completions/${completionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stop-completions/route", todayRoute?.id] });
      toast({ title: "Undone", description: "Stop completion removed." });
    },
  });

  const handleStopAction = (stop: RouteStop) => {
    const existing = completionMap.get(stop.id);
    if (existing) {
      // Already completed - show undo option
      undoMutation.mutate(existing.id);
    } else {
      // Open completion dialog
      setCompletionStop(stop);
      setShowCompletionDialog(true);
    }
  };

  const handleCustomerClick = (stop: RouteStop) => {
    setSelectedStop(stop);
    setShowCustomerDialog(true);
  };

  if (isLoading) {
    return <LoadingSpinner className="py-16" text="Loading your schedule..." />;
  }

  if (!todayRoute || stops.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No route assigned"
        description="You don't have a route assigned for today. Check back later or contact your administrator."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {completedCount} of {stops.length} stops completed
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {skippedCount > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {skippedCount} skipped
          </p>
        )}
      </Card>

      {/* Open in Maps button */}
      {todayRoute.routeLink && (
        <Button
          asChild
          className="w-full h-14 rounded-xl text-[17px] font-semibold gap-2"
        >
          <a
            href={todayRoute.routeLink}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-open-maps"
          >
            <Navigation className="w-5 h-5" />
            Open Route in Google Maps
            <ExternalLink className="w-4 h-4 ml-auto" />
          </a>
        </Button>
      )}

      {/* Route info and stops */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {stops.length} stops
            </span>
            {todayRoute.dayOfWeek && (
              <Badge variant="outline" className="text-xs capitalize">
                <Calendar className="w-3 h-3 mr-1" />
                {formatDayOfWeek(todayRoute.dayOfWeek)}
              </Badge>
            )}
          </div>
          {todayRoute.estimatedTime && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                ~{Math.round(todayRoute.estimatedTime)} min
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {stops.map((stop, index) => {
            const completion = completionMap.get(stop.id);
            const isCompleted = completion?.status === "completed";
            const isSkipped = completion?.status === "skipped";
            const isDone = isCompleted || isSkipped;

            return (
              <div
                key={stop.id}
                className={cn(
                  "flex items-center gap-3 bg-background rounded-xl border transition-all p-4",
                  isDone ? "border-border/50 opacity-60" : "border-border",
                  isCompleted && "bg-green-50/50 dark:bg-green-950/20",
                  isSkipped && "bg-amber-50/50 dark:bg-amber-950/20",
                )}
                data-testid={`route-stop-${stop.id}`}
              >
                {/* Status indicator / sequence number */}
                <button
                  onClick={() => handleStopAction(stop)}
                  className={cn(
                    "rounded-full flex items-center justify-center flex-shrink-0 w-9 h-9 transition-all",
                    isCompleted && "bg-green-500 text-white",
                    isSkipped && "bg-amber-500 text-white",
                    !isDone && "bg-primary text-primary-foreground hover:scale-110",
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isSkipped ? (
                    <SkipForward className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </button>

                {/* Stop details */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "font-medium text-[17px] truncate cursor-pointer hover:text-primary transition-colors",
                      isDone && "line-through",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCustomerClick(stop);
                    }}
                  >
                    {stop.customerName}
                  </p>
                  <p className="text-[13px] text-muted-foreground truncate">
                    {stop.address}
                  </p>
                  {stop.serviceType && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {stop.serviceType}
                    </p>
                  )}
                  {completion?.notes && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      "{completion.notes}"
                    </p>
                  )}
                </div>

                {/* Action / undo button */}
                {isDone ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => handleStopAction(stop)}
                    title="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => handleStopAction(stop)}
                  >
                    <Check className="h-3 w-3" />
                    Done
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Completion dialog */}
      <StopCompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        stop={completionStop}
        isLoading={completeMutation.isPending}
        onComplete={(data) => {
          if (completionStop) {
            completeMutation.mutate({
              stopId: completionStop.id,
              ...data,
            });
          }
        }}
      />

      {/* Customer detail dialog */}
      <CustomerDetailDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        locationId={selectedStop?.locationId || null}
        customerName={selectedStop?.customerName}
        address={selectedStop?.address}
        isAdmin={false}
      />
    </div>
  );
}
