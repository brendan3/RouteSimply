import { useEffect, useRef, useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  MapPin,
  ChevronUp,
  ChevronDown,
  GripVertical,
  ArrowRightLeft,
  Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Route, RouteStop } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const FALLBACK_COLORS = ["#3B82F6", "#22C55E", "#A855F7", "#F97316", "#EC4899", "#14B8A6", "#6366F1", "#EF4444"];
const UNASSIGNED_COLOR = "#9CA3AF"; // Neutral gray for unassigned routes

const BALTIMORE_CENTER = { lat: 39.2904, lng: -76.6122 };

interface SortableStopCardProps {
  stop: RouteStop;
  index: number;
  color: string | null;
  routes: Route[];
  selectedRouteId: string;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToRoute: (stopId: string, targetRouteId: string) => void;
  stopsCount: number;
  isReordering: boolean;
  isMoving: boolean;
}

function SortableStopCard({
  stop,
  index,
  color,
  routes,
  selectedRouteId,
  onMoveUp,
  onMoveDown,
  onMoveToRoute,
  stopsCount,
  isReordering,
  isMoving,
}: SortableStopCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 ${isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}
      data-testid={`stop-card-${stop.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            data-testid={`drag-handle-${stop.id}`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            style={{ backgroundColor: color || undefined }}
          >
            {index + 1}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{stop.customerName}</p>
          <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
          {stop.serviceType && (
            <p className="text-xs text-muted-foreground mt-0.5">{stop.serviceType}</p>
          )}
          <div className="flex items-center gap-1 mt-2">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => onMoveUp(index)}
              disabled={index === 0 || isReordering}
              data-testid={`button-move-up-${stop.id}`}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={() => onMoveDown(index)}
              disabled={index === stopsCount - 1 || isReordering}
              data-testid={`button-move-down-${stop.id}`}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
            {routes.length > 1 && (
              <Select
                onValueChange={(value) => onMoveToRoute(stop.id, value)}
                disabled={isMoving}
              >
                <SelectTrigger
                  className="h-7 w-auto text-xs px-2"
                  data-testid={`select-move-stop-${stop.id}`}
                >
                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="Move" />
                </SelectTrigger>
                <SelectContent>
                  {routes
                    .filter((r) => r.id !== selectedRouteId)
                    .map((route) => {
                      const routeIndex = routes.findIndex((r) => r.id === route.id);
                      const routeColor = route.driverColor || FALLBACK_COLORS[routeIndex % FALLBACK_COLORS.length];
                      return (
                        <SelectItem key={route.id} value={route.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: routeColor }}
                            />
                            <span>{route.driverName || "Unassigned"}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface RouteMapViewProps {
  routes: Route[];
  onStopMove?: (
    stopId: string,
    fromRouteId: string,
    toRouteId: string,
    newSequence: number
  ) => void;
}

export function RouteMapView({ routes }: RouteMapViewProps) {
  const { isLoaded, isLoading, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get unique dates from routes for the filter
  const availableDates = useMemo(() => {
    const dateSet = new Set(routes.filter((r) => r.date).map((r) => r.date));
    return Array.from(dateSet).sort() as string[];
  }, [routes]);

  // Filter routes by selected date
  const filteredRoutes = useMemo(() => {
    if (selectedDate === "all") return routes;
    return routes.filter((r) => r.date === selectedDate);
  }, [routes, selectedDate]);

  const selectedRoute = filteredRoutes.find((r) => r.id === selectedRouteId);
  const selectedRouteIndex = filteredRoutes.findIndex((r) => r.id === selectedRouteId);
  const selectedRouteColor =
    selectedRouteIndex >= 0
      ? (selectedRoute?.driverColor || FALLBACK_COLORS[selectedRouteIndex % FALLBACK_COLORS.length])
      : null;
  const selectedStops = selectedRoute
    ? ((selectedRoute.stopsJson || []) as RouteStop[])
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !selectedRouteId || active.id === over.id) return;

    const oldIndex = selectedStops.findIndex((stop) => stop.id === active.id);
    const newIndex = selectedStops.findIndex((stop) => stop.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newStops = arrayMove(selectedStops, oldIndex, newIndex);
    const updatedStops = newStops.map((stop, idx) => ({
      ...stop,
      sequence: idx + 1,
    }));

    reorderStopsMutation.mutate({ routeId: selectedRouteId, stops: updatedStops });
  };

  const reorderStopsMutation = useMutation({
    mutationFn: async ({
      routeId,
      stops,
    }: {
      routeId: string;
      stops: RouteStop[];
    }) => {
      return apiRequest<Route>("PATCH", `/api/routes/${routeId}/stops`, {
        stops,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Stop order updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update stop order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveStopMutation = useMutation({
    mutationFn: async ({
      stopId,
      fromRouteId,
      toRouteId,
      newSequence,
    }: {
      stopId: string;
      fromRouteId: string;
      toRouteId: string;
      newSequence: number;
    }) => {
      return apiRequest("POST", "/api/routes/move-stop", {
        stopId,
        fromRouteId,
        toRouteId,
        newSequence,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Stop moved to new route" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to move stop",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMoveUp = (stopIndex: number) => {
    if (stopIndex <= 0 || !selectedRouteId) return;

    const newStops = [...selectedStops];
    [newStops[stopIndex - 1], newStops[stopIndex]] = [
      newStops[stopIndex],
      newStops[stopIndex - 1],
    ];

    const updatedStops = newStops.map((stop, idx) => ({
      ...stop,
      sequence: idx + 1,
    }));

    reorderStopsMutation.mutate({ routeId: selectedRouteId, stops: updatedStops });
  };

  const handleMoveDown = (stopIndex: number) => {
    if (stopIndex >= selectedStops.length - 1 || !selectedRouteId) return;

    const newStops = [...selectedStops];
    [newStops[stopIndex], newStops[stopIndex + 1]] = [
      newStops[stopIndex + 1],
      newStops[stopIndex],
    ];

    const updatedStops = newStops.map((stop, idx) => ({
      ...stop,
      sequence: idx + 1,
    }));

    reorderStopsMutation.mutate({ routeId: selectedRouteId, stops: updatedStops });
  };

  const handleMoveToRoute = (stopId: string, targetRouteId: string) => {
    if (!selectedRouteId || targetRouteId === selectedRouteId) return;

    const targetRoute = routes.find((r) => r.id === targetRouteId);
    const targetStops = (targetRoute?.stopsJson || []) as RouteStop[];

    moveStopMutation.mutate({
      stopId,
      fromRouteId: selectedRouteId,
      toRouteId: targetRouteId,
      newSequence: targetStops.length + 1,
    });
  };

  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: BALTIMORE_CENTER,
        zoom: 11,
        mapId: "route-editor-map",
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      infoWindowRef.current = new google.maps.InfoWindow();
    } catch (err) {
      console.error("Map initialization error:", err);
      setMapError("Failed to initialize map");
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = [];

    polylinesRef.current.forEach((polyline) => {
      polyline.setMap(null);
    });
    polylinesRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasValidCoordinates = false;

    filteredRoutes.forEach((route, routeIndex) => {
      const stops = (route.stopsJson || []) as RouteStop[];
      const color = route.driverId ? (route.driverColor || FALLBACK_COLORS[routeIndex % FALLBACK_COLORS.length]) : UNASSIGNED_COLOR;
      const isSelected = route.id === selectedRouteId;
      const opacity = selectedRouteId ? (isSelected ? 1 : 0.3) : 1;

      const pathCoordinates: google.maps.LatLngLiteral[] = [];

      stops.forEach((stop, stopIndex) => {
        if (stop.lat == null || stop.lng == null) return;

        const position = { lat: stop.lat, lng: stop.lng };
        pathCoordinates.push(position);
        bounds.extend(position);
        hasValidCoordinates = true;

        const markerContent = document.createElement("div");
        markerContent.className = "route-marker";
        markerContent.style.cssText = `
          width: ${isSelected ? 32 : 28}px;
          height: ${isSelected ? 32 : 28}px;
          border-radius: 50%;
          background-color: ${color};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isSelected ? 14 : 12}px;
          font-weight: 600;
          border: ${isSelected ? 3 : 2}px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,${isSelected ? 0.5 : 0.3});
          cursor: pointer;
          opacity: ${opacity};
          transition: all 0.2s ease;
        `;
        markerContent.textContent = String(stopIndex + 1);

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position,
          content: markerContent,
          title: stop.customerName,
          zIndex: isSelected ? 1000 : 1,
        });

        marker.addListener("click", () => {
          if (infoWindowRef.current) {
            const content = `
              <div style="padding: 8px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
                  ${stop.customerName}
                </h3>
                <p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280;">
                  ${stop.address}
                </p>
                ${
                  stop.serviceType
                    ? `<p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Service: ${stop.serviceType}
                  </p>`
                    : ""
                }
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                  <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; background-color: ${color}20; color: ${color};">
                    Stop ${stopIndex + 1} of ${stops.length}
                  </span>
                </div>
              </div>
            `;
            infoWindowRef.current.setContent(content);
            infoWindowRef.current.open(mapInstanceRef.current, marker);
          }
        });

        markersRef.current.push(marker);
      });

      if (pathCoordinates.length >= 2) {
        const polyline = new google.maps.Polyline({
          path: pathCoordinates,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: isSelected ? 1 : opacity * 0.8,
          strokeWeight: isSelected ? 5 : 4,
          map: mapInstanceRef.current,
          zIndex: isSelected ? 100 : 1,
        });
        polylinesRef.current.push(polyline);
      }
    });

    if (hasValidCoordinates) {
      mapInstanceRef.current.fitBounds(bounds, 50);
    } else {
      mapInstanceRef.current.setCenter(BALTIMORE_CENTER);
      mapInstanceRef.current.setZoom(11);
    }
  }, [filteredRoutes, isLoaded, selectedRouteId]);

  if (error || mapError) {
    return (
      <Card className="h-[600px] flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <AlertCircle className="w-12 h-12" />
        <div className="text-center">
          <p className="font-medium text-foreground">Failed to load map</p>
          <p className="text-sm">{error || mapError}</p>
        </div>
      </Card>
    );
  }

  if (isLoading || !isLoaded) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <LoadingSpinner text="Loading map..." />
      </Card>
    );
  }

  const totalStops = filteredRoutes.reduce((sum, route) => {
    const stops = (route.stopsJson || []) as RouteStop[];
    return sum + stops.length;
  }, 0);

  return (
    <div className="flex gap-4" data-testid="route-map-view">
      <Card className="flex-1 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {filteredRoutes.length} routes • {totalStops} stops
            </span>
            {availableDates.length > 0 && (
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="h-8 w-[180px]" data-testid="select-date-filter">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  {availableDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {format(parseISO(date), "MMM d, yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {filteredRoutes.slice(0, 5).map((route, index) => {
              const stops = (route.stopsJson || []) as RouteStop[];
              const isSelected = route.id === selectedRouteId;
              return (
                <button
                  key={route.id}
                  onClick={() =>
                    setSelectedRouteId(isSelected ? null : route.id)
                  }
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-all hover-elevate ${
                    isSelected
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "hover:bg-muted"
                  }`}
                  data-testid={`button-select-route-${route.id}`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: route.driverId ? (route.driverColor || FALLBACK_COLORS[index % FALLBACK_COLORS.length]) : UNASSIGNED_COLOR,
                    }}
                  />
                  <span
                    className={
                      isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                    }
                  >
                    {route.driverName || "Unassigned"} ({stops.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          ref={mapRef}
          className="h-[600px] w-full"
          data-testid="map-container"
        />
      </Card>

      <Card className="w-80 flex flex-col h-[650px]" data-testid="sidebar-stop-list">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {selectedRoute ? (
              <>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedRouteColor || undefined }}
                />
                {selectedRoute.driverName || "Unassigned"} - {selectedStops.length} stops
              </>
            ) : (
              "Stop Editor"
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          {!selectedRoute ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4 text-muted-foreground">
              <MapPin className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Select a route to edit stops</p>
              <p className="text-xs mt-1">
                Click on a route in the legend above
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-2 space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedStops.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {selectedStops.map((stop, index) => (
                      <SortableStopCard
                        key={stop.id}
                        stop={stop}
                        index={index}
                        color={selectedRouteColor}
                        routes={routes}
                        selectedRouteId={selectedRouteId!}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onMoveToRoute={handleMoveToRoute}
                        stopsCount={selectedStops.length}
                        isReordering={reorderStopsMutation.isPending}
                        isMoving={moveStopMutation.isPending}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {selectedStops.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No stops in this route
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
