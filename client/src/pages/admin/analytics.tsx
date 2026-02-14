import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { StatCard } from "@/components/common/stat-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, MapPin, Users, Clock, CheckCircle, SkipForward, Route as RouteIcon } from "lucide-react";
import { format, subDays } from "date-fns";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface AnalyticsSummary {
  totalRoutes: number;
  totalStops: number;
  completedStops: number;
  skippedStops: number;
  completionRate: number;
  averageRouteTime: number;
  totalDrivers: number;
  totalTimeEntries: number;
}

interface DriverAnalytics {
  driverId: string;
  driverName: string;
  driverColor: string | null;
  totalRoutes: number;
  totalStops: number;
  completedStops: number;
  completionRate: number;
  averageRouteTime: number;
}

interface DailyTrend {
  date: string;
  completed: number;
  skipped: number;
  totalStops: number;
  routes: number;
}

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30");

  const dateFrom = format(subDays(new Date(), parseInt(timeRange)), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const { data: driverStats = [] } = useQuery<DriverAnalytics[]>({
    queryKey: ["/api/analytics/drivers", dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drivers?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch driver analytics");
      return res.json();
    },
  });

  const { data: dailyTrend = [] } = useQuery<DailyTrend[]>({
    queryKey: ["/api/analytics/daily-trend", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/daily-trend?days=${timeRange}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch trend data");
      return res.json();
    },
  });

  if (summaryLoading) {
    return (
      <AdminLayout title="Analytics" subtitle="Performance insights">
        <LoadingSpinner className="py-16" text="Loading analytics..." />
      </AdminLayout>
    );
  }

  const pieData = [
    { name: "Completed", value: summary?.completedStops || 0, color: "#10b981" },
    { name: "Skipped", value: summary?.skippedStops || 0, color: "#f59e0b" },
    { name: "Remaining", value: Math.max(0, (summary?.totalStops || 0) - (summary?.completedStops || 0) - (summary?.skippedStops || 0)), color: "#e5e7eb" },
  ].filter(d => d.value > 0);

  return (
    <AdminLayout title="Analytics" subtitle="Performance insights and metrics">
      {/* Time range selector */}
      <div className="flex justify-end mb-6">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Routes"
          value={summary?.totalRoutes || 0}
          icon={RouteIcon}
        />
        <StatCard
          label="Total Stops"
          value={summary?.totalStops || 0}
          icon={MapPin}
        />
        <StatCard
          label="Completion Rate"
          value={`${Math.round(summary?.completionRate || 0)}%`}
          icon={CheckCircle}
        />
        <StatCard
          label="Avg Route Time"
          value={`${summary?.averageRouteTime || 0}m`}
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily completion trend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Daily Completions
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(d) => format(new Date(d), "MMM d")}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")}
                />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="skipped" name="Skipped" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Stop completion pie chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Stop Status Breakdown
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Driver performance table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Driver Performance
        </h3>
        
        {driverStats.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No driver data available for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Driver</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Routes</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Stops</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Completed</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Rate</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {driverStats.map((driver) => (
                  <tr key={driver.driverId} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: driver.driverColor || "#3b82f6" }}
                        />
                        <span className="text-sm font-medium">{driver.driverName}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-2 text-sm">{driver.totalRoutes}</td>
                    <td className="text-center py-3 px-2 text-sm">{driver.totalStops}</td>
                    <td className="text-center py-3 px-2 text-sm">{driver.completedStops}</td>
                    <td className="text-center py-3 px-2">
                      <Badge
                        variant={driver.completionRate >= 90 ? "default" : driver.completionRate >= 70 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {driver.completionRate}%
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-2 text-sm text-muted-foreground">
                      {driver.averageRouteTime > 0 ? `${driver.averageRouteTime}m` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
