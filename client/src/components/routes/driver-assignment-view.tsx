import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, User, GripVertical, Calendar, Clock, Navigation, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Route, User as UserType, RouteStop } from "@shared/schema";
import { cn } from "@/lib/utils";

const UNASSIGNED_COLOR = "#9CA3AF";

interface DraggableRouteCardProps {
  route: Route;
  isSelected: boolean;
  onToggleSelect: (routeId: string) => void;
  showCheckbox: boolean;
}

function DraggableRouteCard({
  route,
  isSelected,
  onToggleSelect,
  showCheckbox,
}: DraggableRouteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: route.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const rawStops = (route.stopsJson || []) as RouteStop[];
  const stops = rawStops.filter(stop => stop.id && stop.customerName && stop.address);
  const deliveryStops = stops.filter(stop => 
    !stop.customerName?.startsWith("Start: ") && 
    !stop.customerName?.startsWith("End: ")
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 transition-all cursor-grab active:cursor-grabbing",
        isDragging && "shadow-lg ring-2 ring-primary",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      data-testid={`draggable-route-${route.id}`}
    >
      <div className="flex items-start gap-2">
        {showCheckbox && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(route.id)}
            className="mt-1"
            data-testid={`checkbox-route-${route.id}`}
          />
        )}
        <div 
          className="cursor-grab active:cursor-grabbing pt-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge
              variant="outline"
              className="text-xs capitalize"
            >
              {route.status}
            </Badge>
            {route.date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseISO(route.date), "MMM d")}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {deliveryStops.length} stops
            </span>
            {route.totalDistance && (
              <span className="flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {(route.totalDistance * 0.621371).toFixed(1)} mi
              </span>
            )}
            {route.estimatedTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.round(route.estimatedTime)} min
              </span>
            )}
          </div>
          
          {stops.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              {stops[0].customerName}
              {stops.length > 1 && ` +${stops.length - 1} more`}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

interface DroppableColumnProps {
  id: string;
  title: string;
  color: string | null;
  routes: Route[];
  selectedRoutes: Set<string>;
  onToggleSelect: (routeId: string) => void;
  showCheckboxes: boolean;
}

function DroppableColumn({
  id,
  title,
  color,
  routes,
  selectedRoutes,
  onToggleSelect,
  showCheckboxes,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <Card 
      className={cn(
        "flex flex-col h-full min-w-[280px] max-w-[320px]",
        isOver && "ring-2 ring-primary bg-primary/5"
      )}
      data-testid={`driver-column-${id}`}
    >
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color || UNASSIGNED_COLOR }}
          />
          <span className="truncate">{title}</span>
          <Badge variant="secondary" className="ml-auto">
            {routes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent 
        ref={setNodeRef}
        className="flex-1 p-2 overflow-hidden"
      >
        <ScrollArea className="h-full">
          <SortableContext
            items={routes.map(r => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pr-2">
              {routes.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Drag routes here
                </div>
              ) : (
                routes.map((route) => (
                  <DraggableRouteCard
                    key={route.id}
                    route={route}
                    isSelected={selectedRoutes.has(route.id)}
                    onToggleSelect={onToggleSelect}
                    showCheckbox={showCheckboxes}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface DriverAssignmentViewProps {
  routes: Route[];
  drivers: UserType[];
  selectedDate: string | null;
  onAssignRoute: (routeId: string, driverId: string | null, driverName: string | null, driverColor: string | null) => void;
  isLoading?: boolean;
}

export function DriverAssignmentView({
  routes,
  drivers,
  selectedDate,
  onAssignRoute,
  isLoading,
}: DriverAssignmentViewProps) {
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bulkAssignDriver, setBulkAssignDriver] = useState<string>("");

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

  const availableDrivers = useMemo(
    () => drivers.filter(d => d.role === "driver"),
    [drivers]
  );

  const filteredRoutes = useMemo(() => {
    if (!selectedDate) return routes;
    return routes.filter(r => r.date === selectedDate);
  }, [routes, selectedDate]);

  const unassignedRoutes = useMemo(
    () => filteredRoutes.filter(r => !r.driverId),
    [filteredRoutes]
  );

  const routesByDriver = useMemo(() => {
    const map = new Map<string, Route[]>();
    availableDrivers.forEach(driver => {
      map.set(driver.id, filteredRoutes.filter(r => r.driverId === driver.id));
    });
    return map;
  }, [filteredRoutes, availableDrivers]);

  const activeRoute = useMemo(
    () => activeId ? routes.find(r => r.id === activeId) : null,
    [activeId, routes]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const findColumnForRoute = (routeId: string): string | null => {
    const route = filteredRoutes.find(r => r.id === routeId);
    if (!route) return null;
    return route.driverId || "unassigned";
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const routeId = active.id as string;
    let targetColumnId = over.id as string;

    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    // Check if we dropped on a route card instead of a column
    // If targetId is a route id, find which column that route belongs to
    const isDroppedOnRoute = filteredRoutes.some(r => r.id === targetColumnId);
    if (isDroppedOnRoute) {
      const foundColumn = findColumnForRoute(targetColumnId);
      if (foundColumn) {
        targetColumnId = foundColumn;
      } else {
        return; // Can't determine target column
      }
    }

    if (targetColumnId === "unassigned") {
      if (route.driverId) {
        onAssignRoute(routeId, null, null, null);
      }
    } else {
      const driver = availableDrivers.find(d => d.id === targetColumnId);
      if (driver && route.driverId !== driver.id) {
        onAssignRoute(routeId, driver.id, driver.name, driver.color || null);
      }
    }
  };

  const handleToggleSelect = (routeId: string) => {
    setSelectedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRoutes.size === unassignedRoutes.length) {
      setSelectedRoutes(new Set());
    } else {
      setSelectedRoutes(new Set(unassignedRoutes.map(r => r.id)));
    }
  };

  const handleBulkAssign = () => {
    if (!bulkAssignDriver || selectedRoutes.size === 0) return;

    const driver = availableDrivers.find(d => d.id === bulkAssignDriver);
    if (!driver) return;

    selectedRoutes.forEach(routeId => {
      onAssignRoute(routeId, driver.id, driver.name, driver.color || null);
    });

    setSelectedRoutes(new Set());
    setBulkAssignDriver("");
  };

  const handleBulkUnassign = () => {
    if (selectedRoutes.size === 0) return;

    selectedRoutes.forEach(routeId => {
      onAssignRoute(routeId, null, null, null);
    });

    setSelectedRoutes(new Set());
  };

  const showCheckboxes = unassignedRoutes.length > 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {showCheckboxes && (
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            data-testid="button-select-all"
          >
            {selectedRoutes.size === unassignedRoutes.length && unassignedRoutes.length > 0
              ? "Deselect All"
              : "Select All Unassigned"}
          </Button>
          
          {selectedRoutes.size > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Select value={bulkAssignDriver} onValueChange={setBulkAssignDriver}>
                  <SelectTrigger className="w-[180px]" data-testid="select-bulk-assign-driver">
                    <SelectValue placeholder="Select driver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrivers.map(driver => (
                      <SelectItem key={driver.id} value={driver.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: driver.color || UNASSIGNED_COLOR }}
                          />
                          {driver.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleBulkAssign}
                  disabled={!bulkAssignDriver || isLoading}
                  data-testid="button-bulk-assign"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Assign ({selectedRoutes.size})
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkUnassign}
                disabled={isLoading}
                data-testid="button-bulk-unassign"
              >
                Unassign Selected
              </Button>
            </>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          <DroppableColumn
            id="unassigned"
            title="Unassigned"
            color={UNASSIGNED_COLOR}
            routes={unassignedRoutes}
            selectedRoutes={selectedRoutes}
            onToggleSelect={handleToggleSelect}
            showCheckboxes={showCheckboxes}
          />
          
          {availableDrivers.map(driver => (
            <DroppableColumn
              key={driver.id}
              id={driver.id}
              title={driver.name}
              color={driver.color}
              routes={routesByDriver.get(driver.id) || []}
              selectedRoutes={selectedRoutes}
              onToggleSelect={handleToggleSelect}
              showCheckboxes={false}
            />
          ))}
        </div>

        <DragOverlay>
          {activeRoute && (
            <Card className="p-3 shadow-lg ring-2 ring-primary w-[280px]">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {activeRoute.status}
                    </Badge>
                    {activeRoute.date && (
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(activeRoute.date), "MMM d")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {activeRoute.stopCount || 0} stops
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
