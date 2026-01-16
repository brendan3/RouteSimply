import { MapPin, Clock, Navigation, GripVertical, User, ChevronRight, Calendar, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Route, RouteStop } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface RouteCardProps {
  route: Route;
  onEdit?: () => void;
  onAssign?: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
  showDragHandle?: boolean;
}

export function RouteCard({ 
  route, 
  onEdit, 
  onAssign, 
  onDelete,
  isDragging,
  showDragHandle = false 
}: RouteCardProps) {
  const stops = (route.stopsJson || []) as RouteStop[];
  const hasDriver = !!route.driverId || !!route.driverName;

  const statusColors = {
    draft: "bg-muted text-muted-foreground",
    assigned: "bg-primary/10 text-primary",
    published: "bg-status-online/10 text-status-online",
  };

  return (
    <Card
      className={cn(
        "p-6 transition-all",
        isDragging && "shadow-lg opacity-95"
      )}
      data-testid={`route-card-${route.id}`}
    >
      <div className="flex items-start gap-3">
        {showDragHandle && (
          <div className="pt-1 cursor-grab active:cursor-grabbing">
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <Badge
              className={cn("text-xs font-medium", statusColors[route.status as keyof typeof statusColors] || statusColors.draft)}
            >
              {route.status === "draft" && "Draft"}
              {route.status === "assigned" && "Assigned"}
              {route.status === "published" && "Published"}
            </Badge>
            {(route.date || route.dayOfWeek) && (
              <Badge variant="outline" className="text-xs font-medium capitalize">
                <Calendar className="w-3 h-3 mr-1" />
                {route.date ? format(parseISO(route.date), "MMM d") : ""} 
                {route.dayOfWeek && ` (${route.dayOfWeek.slice(0, 3)})`}
              </Badge>
            )}
            {hasDriver && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="truncate">{route.driverName || "Assigned"}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{stops.length}</p>
                <p className="text-xs text-muted-foreground">Stops</p>
              </div>
            </div>

            {route.totalDistance && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {route.totalDistance.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">km</p>
                </div>
              </div>
            )}

            {route.estimatedTime && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {Math.round(route.estimatedTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">Min</p>
                </div>
              </div>
            )}
          </div>

          {stops.length > 0 && (
            <div className="space-y-2 mb-4">
              {stops.slice(0, 3).map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {stop.customerName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {stop.address}
                    </p>
                  </div>
                </div>
              ))}
              {stops.length > 3 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  +{stops.length - 3} more stops
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex-1"
                data-testid={`button-edit-route-${route.id}`}
              >
                Edit Route
              </Button>
            )}
            {onAssign && !hasDriver && (
              <Button
                size="sm"
                onClick={onAssign}
                className="flex-1"
                data-testid={`button-assign-route-${route.id}`}
              >
                Assign Driver
              </Button>
            )}
            {route.routeLink && (
              <Button
                variant="outline"
                size="icon"
                asChild
              >
                <a
                  href={route.routeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`link-route-maps-${route.id}`}
                >
                  <ChevronRight className="w-4 h-4" />
                </a>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="icon"
                onClick={onDelete}
                data-testid={`button-delete-route-${route.id}`}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
