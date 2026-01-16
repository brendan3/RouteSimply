import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths, isSameMonth, isToday } from "date-fns";
import type { Route, User } from "@shared/schema";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function AdminCalendarPage() {
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">(() => {
    const saved = localStorage.getItem("calendar_viewMode");
    return saved === "monthly" ? "monthly" : "weekly";
  });
  const [currentDate, setCurrentDate] = useState(() => {
    const saved = localStorage.getItem("calendar_currentDate");
    return saved ? new Date(saved) : new Date();
  });

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
    const index = driverList.findIndex((d) => d.id === driverId);
    return ROUTE_COLORS[index % ROUTE_COLORS.length];
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
          <div
            key={route.id}
            className={`px-2 py-1 rounded text-xs text-white ${getDriverColor(route.driverId || "")}`}
            data-testid={`calendar-route-${route.id}`}
          >
            <p className="font-medium truncate">{route.driverName || "Unassigned"}</p>
            <p className="opacity-80">{route.stopCount} stops</p>
          </div>
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
              <div className={`w-3 h-3 rounded-full ${getDriverColor(driver.id)}`} />
              <span className="text-xs text-muted-foreground">{driver.name.split(" ")[0]}</span>
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
                      <div
                        key={route.id}
                        className={`px-1 py-0.5 rounded text-[10px] text-white truncate ${getDriverColor(route.driverId || "")}`}
                      >
                        {route.driverName?.split(" ")[0] || "?"} ({route.stopCount})
                      </div>
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
    </AdminLayout>
  );
}
