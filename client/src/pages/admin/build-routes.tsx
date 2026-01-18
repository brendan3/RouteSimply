import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  useDraggable,
  MeasuringStrategy,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AdminLayout } from "@/components/layout/admin-layout";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/use-google-maps";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin,
  Plus,
  Search,
  GripVertical,
  Trash2,
  User,
  ArrowLeft,
  Save,
  Package,
  ExternalLink,
  LayoutGrid,
  Map,
  AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Location, User as UserType, RouteStop, Route, RouteConfirmation } from "@shared/schema";
import { cn } from "@/lib/utils";

const DRIVER_COLORS = [
  "#3B82F6", "#22C55E", "#A855F7", "#F97316", "#EC4899", 
  "#14B8A6", "#6366F1", "#EF4444", "#84CC16", "#06B6D4"
];

interface DraggableLocationProps {
  location: Location;
}

function UnassignedDraggableLocation({ location }: DraggableLocationProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: location.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-background border cursor-grab active:cursor-grabbing hover:bg-muted/50",
        isDragging && "ring-2 ring-primary"
      )}
      data-testid={`draggable-location-${location.id}`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{location.customerName}</p>
        <p className="text-xs text-muted-foreground truncate">{location.address}</p>
      </div>
    </div>
  );
}

interface SortableRouteStopProps {
  location: Location;
}

function SortableRouteStop({ location }: SortableRouteStopProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-background border cursor-grab active:cursor-grabbing hover:bg-muted/50",
        isDragging && "ring-2 ring-primary"
      )}
      data-testid={`sortable-stop-${location.id}`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{location.customerName}</p>
        <p className="text-xs text-muted-foreground truncate">{location.address}</p>
      </div>
    </div>
  );
}

interface DroppableRouteProps {
  routeIndex: number;
  stops: Location[];
  onRemoveStop: (locationId: string) => void;
  color: string;
}

function DroppableRoute({ routeIndex, stops, onRemoveStop, color }: DroppableRouteProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `route-${routeIndex}`,
  });

  const generateMapsUrl = () => {
    if (stops.length === 0) return null;
    const addresses = stops.map(s => encodeURIComponent(s.address));
    return `https://www.google.com/maps/dir/${addresses.join("/")}`;
  };

  const mapsUrl = generateMapsUrl();

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[280px] max-w-[400px] transition-all",
        isOver && "ring-2 ring-primary bg-primary/5"
      )}
      data-testid={`route-dropzone-${routeIndex}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <CardTitle className="text-base">
            Route {routeIndex + 1}
          </CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {stops.length} stops
          </Badge>
        </div>
        {mapsUrl && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => window.open(mapsUrl, "_blank")}
            data-testid={`button-view-map-${routeIndex}`}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Google Maps
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="h-[400px]">
          <SortableContext
            items={stops.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 p-2">
              {stops.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Drag locations here</p>
                </div>
              ) : (
                stops.map((location, index) => (
                  <div
                    key={location.id}
                    className="flex items-center gap-2"
                  >
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </Badge>
                    <SortableRouteStop location={location} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveStop(location.id)}
                      data-testid={`remove-stop-${location.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

const BALTIMORE_CENTER = { lat: 39.2904, lng: -76.6122 };
const UNASSIGNED_COLOR = "#9CA3AF";

interface BuildRoutesMapViewProps {
  routeStops: Location[][];
  unassignedLocations: Location[];
  colors: string[];
}

function BuildRoutesMapView({ routeStops, unassignedLocations, colors }: BuildRoutesMapViewProps) {
  const { isLoaded, isLoading, error } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return;

    try {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: BALTIMORE_CENTER,
        zoom: 11,
        mapId: "build-routes-map",
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
      directionsServiceRef.current = new google.maps.DirectionsService();
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

    unassignedLocations.forEach((location) => {
      if (location.lat == null || location.lng == null) return;

      const position = { lat: location.lat, lng: location.lng };
      bounds.extend(position);
      hasValidCoordinates = true;

      const markerContent = document.createElement("div");
      markerContent.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: ${UNASSIGNED_COLOR};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 600;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        opacity: 0.6;
      `;
      markerContent.textContent = "?";
      markerContent.title = location.customerName;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position,
        content: markerContent,
        title: location.customerName,
        zIndex: 1,
      });

      markersRef.current.push(marker);
    });

    routeStops.forEach((stops, routeIndex) => {
      const color = colors[routeIndex % colors.length];
      const validStops = stops.filter(l => l.lat != null && l.lng != null);

      validStops.forEach((location, stopIndex) => {
        const position = { lat: location.lat!, lng: location.lng! };
        bounds.extend(position);
        hasValidCoordinates = true;

        const markerContent = document.createElement("div");
        markerContent.style.cssText = `
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: ${color};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
        `;
        markerContent.textContent = String(stopIndex + 1);
        markerContent.title = `Route ${routeIndex + 1} - Stop ${stopIndex + 1}: ${location.customerName}`;

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position,
          content: markerContent,
          title: location.customerName,
          zIndex: 100 + routeIndex,
        });

        markersRef.current.push(marker);
      });

      if (validStops.length >= 2 && directionsServiceRef.current) {
        const origin = { lat: validStops[0].lat!, lng: validStops[0].lng! };
        const destination = { lat: validStops[validStops.length - 1].lat!, lng: validStops[validStops.length - 1].lng! };
        const waypoints = validStops.slice(1, -1).map(stop => ({
          location: { lat: stop.lat!, lng: stop.lng! },
          stopover: true,
        }));

        directionsServiceRef.current.route(
          {
            origin,
            destination,
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              const routePath = result.routes[0].overview_path;
              const polyline = new google.maps.Polyline({
                path: routePath,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.9,
                strokeWeight: 5,
                map: mapInstanceRef.current,
                zIndex: routeIndex,
              });
              polylinesRef.current.push(polyline);
            } else {
              const pathCoordinates = validStops.map(l => ({ lat: l.lat!, lng: l.lng! }));
              const polyline = new google.maps.Polyline({
                path: pathCoordinates,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.7,
                strokeWeight: 4,
                strokeDashArray: [10, 5],
                map: mapInstanceRef.current,
                zIndex: routeIndex,
              } as google.maps.PolylineOptions);
              polylinesRef.current.push(polyline);
            }
          }
        );
      } else if (validStops.length === 1) {
      }
    });

    if (hasValidCoordinates) {
      mapInstanceRef.current.fitBounds(bounds, 50);
    } else {
      mapInstanceRef.current.setCenter(BALTIMORE_CENTER);
      mapInstanceRef.current.setZoom(11);
    }
  }, [routeStops, unassignedLocations, colors, isLoaded]);

  if (error || mapError) {
    return (
      <Card className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
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
      <Card className="h-full flex items-center justify-center">
        <LoadingSpinner text="Loading map..." />
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-4">
        <MapPin className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Route Preview</span>
        <div className="flex items-center gap-3 ml-auto">
          {routeStops.map((stops, index) => (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-muted-foreground">
                Route {index + 1} ({stops.length})
              </span>
            </div>
          ))}
          {unassignedLocations.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: UNASSIGNED_COLOR }}
              />
              <span className="text-muted-foreground">
                Unassigned ({unassignedLocations.length})
              </span>
            </div>
          )}
        </div>
      </div>
      <div
        ref={mapRef}
        className="h-[calc(100%-52px)] w-full"
        data-testid="build-routes-map-container"
      />
    </Card>
  );
}

export default function BuildRoutesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get URL params - use window.location.search since wouter's useLocation only returns pathname
  const urlParams = new URLSearchParams(window.location.search);
  const scheduledDate = urlParams.get("date") || format(new Date(), "yyyy-MM-dd");
  const dayOfWeek = urlParams.get("day") || "";

  const [searchQuery, setSearchQuery] = useState("");
  const [driverCount, setDriverCount] = useState(2);
  const [routeStops, setRouteStops] = useState<Location[][]>([[], []]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "map">("cards");

  const { data: locations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: confirmations = [], isLoading: confirmationsLoading } = useQuery<RouteConfirmation[]>({
    queryKey: [`/api/route-confirmations?date=${scheduledDate}`],
  });

  const { data: drivers = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const availableDrivers = useMemo(() => 
    drivers.filter(d => d.role === "driver"),
    [drivers]
  );

  const excludedLocationIds = useMemo(() => {
    const excluded = new Set<string>();
    confirmations.forEach(c => {
      if (c.excluded) excluded.add(c.locationId);
    });
    return excluded;
  }, [confirmations]);

  const confirmedLocations = useMemo(() => {
    return locations.filter(loc => {
      if (!loc.daysOfWeek?.includes(dayOfWeek)) return false;
      if (excludedLocationIds.has(loc.id)) return false;
      return true;
    });
  }, [locations, dayOfWeek, excludedLocationIds]);

  const assignedLocationIds = useMemo(() => {
    const ids = new Set<string>();
    routeStops.forEach(stops => {
      stops.forEach(stop => ids.add(stop.id));
    });
    return ids;
  }, [routeStops]);

  const unassignedLocations = useMemo(() => {
    return confirmedLocations.filter(loc => !assignedLocationIds.has(loc.id));
  }, [confirmedLocations, assignedLocationIds]);

  const filteredUnassigned = useMemo(() => {
    if (!searchQuery) return unassignedLocations;
    const query = searchQuery.toLowerCase();
    return unassignedLocations.filter(
      loc =>
        loc.customerName.toLowerCase().includes(query) ||
        loc.address.toLowerCase().includes(query)
    );
  }, [unassignedLocations, searchQuery]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const measuringConfig = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };

  const customCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    const filteredPointerCollisions = pointerCollisions.filter(
      collision => collision.id !== args.active.id
    );
    if (filteredPointerCollisions.length > 0) {
      return filteredPointerCollisions;
    }
    
    const rectCollisions = rectIntersection(args);
    const filteredRectCollisions = rectCollisions.filter(
      collision => collision.id !== args.active.id
    );
    return filteredRectCollisions;
  };

  useEffect(() => {
    setRouteStops(prev => {
      const newRouteStops = Array(driverCount).fill(null).map((_, i) => 
        prev[i] || []
      );
      return newRouteStops;
    });
  }, [driverCount]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (!overId.startsWith("route-")) return;
    
    const targetRouteIndex = parseInt(overId.replace("route-", ""));
    const location = confirmedLocations.find(l => l.id === activeId);
    
    if (!location) return;

    let sourceRouteIndex = -1;
    routeStops.forEach((stops, index) => {
      if (stops.some(s => s.id === activeId)) {
        sourceRouteIndex = index;
      }
    });

    if (sourceRouteIndex === targetRouteIndex) return;
    
    if (routeStops[targetRouteIndex]?.some(s => s.id === activeId)) return;

    if (sourceRouteIndex === -1) return;

    setRouteStops(prev => {
      if (prev[targetRouteIndex]?.some(s => s.id === activeId)) {
        return prev;
      }
      
      const newRouteStops = prev.map(stops => [...stops]);
      
      newRouteStops[sourceRouteIndex] = newRouteStops[sourceRouteIndex].filter(
        s => s.id !== activeId
      );
      
      newRouteStops[targetRouteIndex].push(location);
      
      return newRouteStops;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const location = confirmedLocations.find(l => l.id === activeId);
    if (!location) return;

    let sourceRouteIndex = -1;
    routeStops.forEach((stops, index) => {
      if (stops.some(s => s.id === activeId)) {
        sourceRouteIndex = index;
      }
    });

    let targetRouteIndex = -1;
    
    if (overId.startsWith("route-")) {
      targetRouteIndex = parseInt(overId.replace("route-", ""));
    } else {
      routeStops.forEach((stops, index) => {
        if (stops.some(s => s.id === overId)) {
          targetRouteIndex = index;
        }
      });
    }

    if (targetRouteIndex === -1) return;
    if (sourceRouteIndex === targetRouteIndex) return;

    setRouteStops(prev => {
      const newRouteStops = prev.map(stops => [...stops]);
      
      if (sourceRouteIndex >= 0) {
        newRouteStops[sourceRouteIndex] = newRouteStops[sourceRouteIndex].filter(
          s => s.id !== activeId
        );
      }
      
      if (!newRouteStops[targetRouteIndex].some(s => s.id === activeId)) {
        newRouteStops[targetRouteIndex].push(location);
      }
      
      return newRouteStops;
    });
  };

  const handleRemoveStop = (routeIndex: number, locationId: string) => {
    setRouteStops(prev => {
      const newRouteStops = prev.map(stops => [...stops]);
      newRouteStops[routeIndex] = newRouteStops[routeIndex].filter(s => s.id !== locationId);
      return newRouteStops;
    });
  };

  const createRoutesMutation = useMutation({
    mutationFn: async () => {
      const routesToCreate = routeStops
        .map((stops, index) => ({
          dayOfWeek,
          scheduledDate,
          driverIndex: index,
          stops: stops.map((loc, seq) => ({
            id: crypto.randomUUID(),
            locationId: loc.id,
            address: loc.address,
            customerName: loc.customerName,
            serviceType: loc.serviceType,
            notes: loc.notes,
            lat: loc.lat,
            lng: loc.lng,
            sequence: seq + 1,
          })),
        }))
        .filter(route => route.stops.length > 0);

      if (routesToCreate.length === 0) {
        throw new Error("No stops assigned to any route");
      }

      return apiRequest<Route[]>("POST", "/api/routes/create-manual", {
        routes: routesToCreate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Routes created successfully" });
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create routes",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activeLocation = activeId ? confirmedLocations.find(l => l.id === activeId) : null;

  const isLoading = locationsLoading || confirmationsLoading;

  if (isLoading) {
    return (
      <AdminLayout title="Build Routes" subtitle="Loading...">
        <LoadingSpinner className="py-16" text="Loading locations..." />
      </AdminLayout>
    );
  }

  if (confirmedLocations.length === 0) {
    return (
      <AdminLayout
        title="Build Routes"
        subtitle="Manual Route Builder"
        actions={
          <Button variant="outline" onClick={() => navigate("/admin/confirm-route")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Confirm Locations
          </Button>
        }
      >
        <EmptyState
          icon={MapPin}
          title="No confirmed locations"
          description="Go back to Confirm Locations and select which stops to include for this date."
          action={
            <Button onClick={() => navigate("/admin/confirm-route")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Confirm Locations
            </Button>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Build Routes Manually"
      subtitle={`${format(parseISO(scheduledDate), "EEEE, MMMM d, yyyy")} - ${confirmedLocations.length} locations to assign`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/confirm-route")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={() => createRoutesMutation.mutate()}
            disabled={createRoutesMutation.isPending || assignedLocationIds.size === 0}
            data-testid="button-save-routes"
          >
            <Save className="w-4 h-4 mr-2" />
            {createRoutesMutation.isPending ? "Creating..." : "Create Routes"}
          </Button>
        </div>
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        measuring={measuringConfig}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          <Card className="w-80 flex-shrink-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Unassigned</CardTitle>
                <Badge variant="secondary">{unassignedLocations.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="relative mb-2 px-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                  data-testid="input-search-locations"
                />
              </div>
              <ScrollArea className="h-[calc(100%-48px)]">
                <div className="space-y-2 p-2">
                  {filteredUnassigned.map(location => (
                    <UnassignedDraggableLocation key={location.id} location={location} />
                  ))}
                  {filteredUnassigned.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {unassignedLocations.length === 0
                        ? "All locations assigned"
                        : "No matches found"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Number of routes:</span>
              <Select
                value={driverCount.toString()}
                onValueChange={(v) => setDriverCount(parseInt(v))}
              >
                <SelectTrigger className="w-24" data-testid="select-driver-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <SelectItem key={n} value={n.toString()}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {assignedLocationIds.size} of {confirmedLocations.length} locations assigned
              </span>
              <div className="flex items-center gap-1 ml-auto border rounded-lg p-1">
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  data-testid="button-view-cards"
                >
                  <LayoutGrid className="w-4 h-4 mr-1" />
                  Cards
                </Button>
                <Button
                  variant={viewMode === "map" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  data-testid="button-view-map"
                >
                  <Map className="w-4 h-4 mr-1" />
                  Map
                </Button>
              </div>
            </div>

            {viewMode === "cards" ? (
              <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
                {routeStops.map((stops, index) => (
                  <DroppableRoute
                    key={index}
                    routeIndex={index}
                    stops={stops}
                    onRemoveStop={(locationId) => handleRemoveStop(index, locationId)}
                    color={DRIVER_COLORS[index % DRIVER_COLORS.length]}
                  />
                ))}
              </div>
            ) : (
              <div className="flex gap-4 flex-1">
                <div className="flex gap-4 overflow-x-auto w-1/2 flex-shrink-0">
                  {routeStops.map((stops, index) => (
                    <DroppableRoute
                      key={index}
                      routeIndex={index}
                      stops={stops}
                      onRemoveStop={(locationId) => handleRemoveStop(index, locationId)}
                      color={DRIVER_COLORS[index % DRIVER_COLORS.length]}
                    />
                  ))}
                </div>
                <div className="flex-1">
                  <BuildRoutesMapView
                    routeStops={routeStops}
                    unassignedLocations={unassignedLocations}
                    colors={DRIVER_COLORS}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeLocation && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-background border shadow-lg">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{activeLocation.customerName}</p>
                <p className="text-xs text-muted-foreground truncate">{activeLocation.address}</p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </AdminLayout>
  );
}
