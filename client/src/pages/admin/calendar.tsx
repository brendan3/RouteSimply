import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerDetailDialog } from "@/components/customer/customer-detail-dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, MapPin, Truck } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, isSameMonth, isToday } from "date-fns";
import type { Route, User } from "@shared/schema";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FALLBACK_COLORS = ["#3B82F6", "#22C55E", "#A855F7", "#F97316", "#EC4899", "#14B8A6", "#6366F1", "#EF4444"];
const UNASSIGNED_COLOR = "#9CA3AF"; // Neutral gray for unassigned routes

export default function AdminCalendarPage() {
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">(() => {
    const saved = localStorage.getItem("calendar_viewMode");
    return saved === "monthly" ? "monthly" : "weekly";
  });
  const [currentDate, setCurrentDate] = useState(() => {
    const saved = localStorage.getItem("calendar_currentDate");
    return saved ? new Date(saved) : new Date();
  });
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [selectedAddress, setSelectedAddress] = useState<string>("");

  // Persist state to localStorage
  const handleViewModeChange = (mode: "weekly" | "monthly") => {
    setViewMode(mode);
    localStorage.setItem("calendar_viewMode", mode);
  };
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    localStorage.setItem("calendar_currentDate", date.toISOString());
  };

  const { data: routes = [], isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  const { data: drivers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const driverList = drivers.filter((u) => u.role === "driver");

  const getDriverColor = (driverId: string): string => {
    const driver = driverList.find((d) => d.id === driverId);
    if (driver?.color) return driver.color;
    const index = driverList.findIndex((d) => d.id === driverId);
    return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  };

  const getRoutesForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return routes.filter((route) => route.date === dateStr);
  };

  const navigateBack = () => {
    if (viewMode === "weekly") {
      handleDateChange(subWeeks(currentDate, 1));
    } else {
      handleDateChange(subMonths(currentDate, 1));
    }
  };

  const navigateForward = () => {
    if (viewMode === "weekly") {
      handleDateChange(addWeeks(currentDate, 1));
    } else {
      handleDateChange(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    handleDateChange(new Date());
  };

  const handleOpenCustomerDialog = (stop: { locationId: string; customerName: string; address: string }) => {
    setSelectedLocationId(stop.locationId);
    setSelectedCustomerName(stop.customerName);
    setSelectedAddress(stop.address);
    setCustomerDialogOpen(true);
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 0 });
  const monthEndWeek = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const monthDays = eachDayOfInterval({ start: monthStartWeek, end: monthEndWeek });

  const renderDayContent = (date: Date) => {
    const dayRoutes = getRoutesForDate(date);
    
    if (dayRoutes.length === 0) {
      return (
        <p className="text-xs text-muted-foreground italic">No routes</p>
      );
    }

    return (
      <div className="space-y-1">
        {dayRoutes.map((route) => (
          <button
            key={route.id}
            className="w-full text-left px-2 py-1 rounded text-xs text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: route.driverId ? (route.driverColor || getDriverColor(route.driverId)) : UNASSIGNED_COLOR }}
            onClick={() => setSelectedRoute(route)}
            data-testid={`calendar-route-${route.id}`}
          >
            <p className="font-medium truncate">{route.driverName || "Unassigned"}</p>
            <p className="opacity-80">{route.stopCount} stops</p>
          </button>
        ))}
      </div>
    );
  };

  return (
    <AdminLayout
      title="Route Calendar"
      subtitle="View scheduled routes by driver"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => handleViewModeChange("weekly")}
            data-testid="button-view-weekly"
          >
            <List className="w-4 h-4 mr-1" />
            Weekly
          </Button>
          <Button
            variant={viewMode === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => handleViewModeChange("monthly")}
            data-testid="button-view-monthly"
          >
            <CalendarIcon className="w-4 h-4 mr-1" />
            Monthly
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigateBack} data-testid="button-nav-back">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateForward} data-testid="button-nav-forward">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} data-testid="button-today">
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold">
          {viewMode === "weekly"
            ? `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`
            : format(currentDate, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-2">
          {driverList.slice(0, 5).map((driver) => (
            <div key={driver.id} className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: getDriverColor(driver.id) }}
              />
              <span className="text-xs" style={{ color: driver.color || 'hsl(var(--muted-foreground))' }}>{driver.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {routesLoading ? (
        <LoadingSpinner className="py-16" text="Loading calendar..." />
      ) : viewMode === "weekly" ? (
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-4">
            {weekDays.map((day, index) => {
              const dayName = DAY_NAMES[day.getDay()];
              const dayIsToday = isToday(day);

              return (
                <div key={index} className="min-h-[200px]">
                  <div className={`text-center pb-3 mb-3 border-b ${dayIsToday ? "bg-primary/5 -mx-2 px-2 rounded-t-lg" : ""}`}>
                    <p className="text-xs text-muted-foreground uppercase">{dayName}</p>
                    <p className={`text-2xl font-semibold ${dayIsToday ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </p>
                  </div>
                  {renderDayContent(day)}
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day, index) => {
              const dayIsToday = isToday(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const dayRoutes = getRoutesForDate(day);

              return (
                <div
                  key={index}
                  className={`min-h-[100px] p-2 rounded-lg border ${
                    isCurrentMonth ? "bg-background" : "bg-muted/30"
                  } ${dayIsToday ? "border-primary border-2" : "border-transparent"}`}
                >
                  <p className={`text-sm font-medium mb-1 ${
                    isCurrentMonth ? "" : "text-muted-foreground"
                  } ${dayIsToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-0.5">
                    {dayRoutes.slice(0, 3).map((route) => (
                      <button
                        key={route.id}
                        className="w-full text-left px-1 py-0.5 rounded text-[10px] text-white truncate cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: route.driverId ? (route.driverColor || getDriverColor(route.driverId)) : UNASSIGNED_COLOR }}
                        onClick={() => setSelectedRoute(route)}
                        data-testid={`calendar-monthly-route-${route.id}`}
                      >
                        {route.driverName?.split(" ")[0] || "?"} ({route.stopCount})
                      </button>
                    ))}
                    {dayRoutes.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1">
                        +{dayRoutes.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Route Details Dialog */}
      <Dialog open={!!selectedRoute} onOpenChange={(open) => !open && setSelectedRoute(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {selectedRoute?.driverName || "Route Details"}
            </DialogTitle>
          </DialogHeader>
          {selectedRoute && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{selectedRoute.date ? format(new Date(selectedRoute.date), "EEEE, MMMM d, yyyy") : "No date"}</span>
                <Badge variant="secondary">{selectedRoute.stopCount} stops</Badge>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Stops
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedRoute.stopsJson && (selectedRoute.stopsJson as Array<{ locationId: string; customerName: string; address: string }>).map((stop, index) => (
                    <Card key={stop.locationId || index} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-primary">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-medium text-primary hover:underline cursor-pointer text-left"
                            onClick={() => handleOpenCustomerDialog(stop)}
                            data-testid={`route-stop-${stop.locationId}`}
                          >
                            {stop.customerName}
                          </button>
                          <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        locationId={selectedLocationId}
        customerName={selectedCustomerName}
        address={selectedAddress}
        isAdmin={true}
      />
    </AdminLayout>
  );
}
