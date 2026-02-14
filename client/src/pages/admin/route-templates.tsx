import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { EmptyState } from "@/components/common/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layers, Plus, Play, Trash2, MapPin, User, Calendar } from "lucide-react";
import type { RouteTemplate, Route, User as UserType, RouteStop } from "@shared/schema";

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export default function AdminRouteTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RouteTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [applyDay, setApplyDay] = useState<string>("");
  const [applyDriverId, setApplyDriverId] = useState<string>("");

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<RouteTemplate[]>({
    queryKey: ["/api/route-templates"],
  });

  // Fetch routes (to create templates from)
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  // Fetch drivers
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const drivers = users.filter(u => u.role === "driver");

  // Create template
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/route-templates", {
        name: newTemplateName,
        routeId: selectedRouteId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-templates"] });
      setCreateDialogOpen(false);
      setNewTemplateName("");
      setSelectedRouteId("");
      toast({ title: "Template created", description: "Route template saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Apply template
  const applyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("POST", `/api/route-templates/${templateId}/apply`, {
        dayOfWeek: applyDay || undefined,
        driverId: applyDriverId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      setApplyDialogOpen(false);
      setApplyDay("");
      setApplyDriverId("");
      toast({ title: "Template applied", description: "New route created from template." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("DELETE", `/api/route-templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-templates"] });
      setDeleteDialogOpen(false);
      toast({ title: "Deleted", description: "Template removed." });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout title="Route Templates" subtitle="Save and reuse routes">
        <LoadingSpinner className="py-16" text="Loading templates..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Route Templates" subtitle="Save and reuse optimized route configurations">
      {/* Create button */}
      <div className="flex justify-end mb-6">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Route Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Monday Downtown Route"
                />
              </div>
              <div className="space-y-2">
                <Label>Create From Existing Route (optional)</Label>
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a route..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Empty template</SelectItem>
                    {routes.map(route => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.dayOfWeek ? `${route.dayOfWeek} - ` : ""}
                        {route.driverName || "Unassigned"} ({(route.stopsJson as RouteStop[])?.length || 0} stops)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!newTemplateName.trim() || createMutation.isPending}
              >
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates list */}
      {templates.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No templates yet"
          description="Create templates from your existing routes to quickly apply them on other days."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <Card key={template.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-base">{template.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  {template.stopCount || 0} stops
                </div>
                {template.dayOfWeek && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="capitalize">{template.dayOfWeek}</span>
                  </div>
                )}
                {template.driverName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    {template.driverName}
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setSelectedTemplate(template);
                  setApplyDialogOpen(true);
                }}
              >
                <Play className="w-4 h-4" />
                Apply Template
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Apply dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={applyDay} onValueChange={setApplyDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day..." />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to Driver (optional)</Label>
              <Select value={applyDriverId} onValueChange={setApplyDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {drivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => selectedTemplate && applyMutation.mutate(selectedTemplate.id)}
              disabled={applyMutation.isPending}
            >
              Create Route from Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template "{selectedTemplate?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
