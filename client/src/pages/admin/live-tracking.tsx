import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { EmptyState } from "@/components/common/empty-state";
import { useWebSocket } from "@/hooks/use-websocket";
import { Wifi, WifiOff, MapPin, Clock, User, CheckCircle, Navigation } from "lucide-react";
import { format } from "date-fns";
import type { User as UserType } from "@shared/schema";

interface DriverLocationData {
  id?: string;
  driverId: string;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  updatedAt?: string;
  driver?: {
    id: string;
    name: string;
    color: string | null;
  };
}

interface StopCompletedEvent {
  routeId: string;
  stopId: string;
  driverName: string;
  status: string;
  completedAt: string;
}

interface ActivityEvent {
  id: string;
  type: "connected" | "disconnected" | "location" | "stop_completed";
  driverName: string;
  driverId: string;
  message: string;
  timestamp: string;
}

export default function AdminLiveTrackingPage() {
  const queryClient = useQueryClient();
  const { isConnected, subscribe } = useWebSocket();
  const [driverPositions, setDriverPositions] = useState<Map<string, DriverLocationData>>(new Map());
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [wsStatus, setWsStatus] = useState({ total: 0, drivers: 0, admins: 0 });

  // Fetch initial driver locations
  const { data: initialLocations = [], isLoading } = useQuery<DriverLocationData[]>({
    queryKey: ["/api/driver-locations"],
    refetchInterval: 30000, // Refresh every 30s as fallback
  });

  // Fetch WS connection status
  useQuery({
    queryKey: ["/api/ws/status"],
    queryFn: async () => {
      const res = await fetch("/api/ws/status", {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setWsStatus(data);
      return data;
    },
    refetchInterval: 10000,
  });

  // Fetch drivers list
  const { data: drivers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const driverUsers = drivers.filter(d => d.role === "driver");

  // Initialize positions from API data
  useEffect(() => {
    const map = new Map<string, DriverLocationData>();
    initialLocations.forEach(loc => {
      map.set(loc.driverId, loc);
    });
    setDriverPositions(map);
  }, [initialLocations]);

  // Add event to activity feed
  const addActivity = useCallback((event: Omit<ActivityEvent, "id">) => {
    setActivityFeed(prev => {
      const newFeed = [{ ...event, id: `${Date.now()}-${Math.random()}` }, ...prev];
      return newFeed.slice(0, 50); // Keep last 50 events
    });
  }, []);

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubs = [
      subscribe("driver_location", (payload: any) => {
        setDriverPositions(prev => {
          const next = new Map(prev);
          next.set(payload.driverId, {
            driverId: payload.driverId,
            lat: payload.lat,
            lng: payload.lng,
            heading: payload.heading,
            speed: payload.speed,
            updatedAt: payload.timestamp,
            driver: {
              id: payload.driverId,
              name: payload.driverName,
              color: null,
            },
          });
          return next;
        });
      }),

      subscribe("stop_completed", (payload: StopCompletedEvent) => {
        addActivity({
          type: "stop_completed",
          driverName: payload.driverName,
          driverId: payload.driverName,
          message: `completed a stop (${payload.status})`,
          timestamp: new Date().toISOString(),
        });
        // Refresh completions data
        queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      }),

      subscribe("driver_connected", (payload: any) => {
        if (payload.driverName) {
          addActivity({
            type: "connected",
            driverName: payload.driverName,
            driverId: payload.driverId,
            message: "came online",
            timestamp: new Date().toISOString(),
          });
        }
      }),

      subscribe("driver_disconnected", (payload: any) => {
        if (payload.driverName) {
          addActivity({
            type: "disconnected",
            driverName: payload.driverName,
            driverId: payload.driverId,
            message: "went offline",
            timestamp: new Date().toISOString(),
          });
        }
      }),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [subscribe, addActivity, queryClient]);

  if (isLoading) {
    return (
      <AdminLayout title="Live Tracking" subtitle="Real-time driver monitoring">
        <LoadingSpinner className="py-16" text="Loading tracking data..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Live Tracking" subtitle="Real-time driver monitoring">
      {/* Connection status */}
      <div className="flex items-center gap-4 mb-6">
        <Badge variant={isConnected ? "default" : "destructive"} className="gap-1.5">
          {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {wsStatus.drivers} driver{wsStatus.drivers !== 1 ? "s" : ""} online
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Driver list with status */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold">Drivers</h3>
          
          {driverUsers.length === 0 ? (
            <EmptyState
              icon={User}
              title="No drivers"
              description="No drivers have been created yet."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {driverUsers.map(driver => {
                const position = driverPositions.get(driver.id);
                const isOnline = !!position && position.updatedAt && 
                  (Date.now() - new Date(position.updatedAt).getTime()) < 120000; // 2 min threshold
                
                return (
                  <Card key={driver.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{ backgroundColor: driver.color || "#3b82f6" }}
                        >
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isOnline ? "Online" : "Offline"}
                        </p>
                        {position && isOnline && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
                            </span>
                          </div>
                        )}
                        {position?.speed && position.speed > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Navigation className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {Math.round(position.speed * 2.237)} mph
                            </span>
                          </div>
                        )}
                        {position?.updatedAt && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            Last update: {format(new Date(position.updatedAt), "h:mm:ss a")}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Activity Feed</h3>
          <Card className="p-4 max-h-[600px] overflow-y-auto">
            {activityFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity yet. Events will appear here in real-time.
              </p>
            ) : (
              <div className="space-y-3">
                {activityFeed.map(event => (
                  <div key={event.id} className="flex items-start gap-2">
                    <div className="mt-1">
                      {event.type === "connected" && <Wifi className="w-3.5 h-3.5 text-green-500" />}
                      {event.type === "disconnected" && <WifiOff className="w-3.5 h-3.5 text-red-500" />}
                      {event.type === "stop_completed" && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
                      {event.type === "location" && <MapPin className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-medium">{event.driverName}</span>{" "}
                        <span className="text-muted-foreground">{event.message}</span>
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {format(new Date(event.timestamp), "h:mm:ss a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
