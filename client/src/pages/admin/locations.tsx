import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Plus, Trash2, Navigation } from "lucide-react";
import type { WorkLocation } from "@shared/schema";

export default function AdminLocationsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    radiusMeters: "100",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery<WorkLocation[]>({
    queryKey: ["/api/work-locations"],
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      address: string;
      radiusMeters: number;
    }) => {
      return apiRequest<WorkLocation>("POST", "/api/work-locations", data);
    },
    onSuccess: () => {
      setShowAddDialog(false);
      setNewLocation({ name: "", address: "", radiusMeters: "100" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-locations"] });
      toast({ title: "Work location added successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/work-locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-locations"] });
      toast({ title: "Work location deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setStartingPointMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/work-locations/${id}/set-starting-point`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-locations"] });
      toast({ title: "Starting point updated", description: "Routes will now start and end at this location." });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to set starting point",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newLocation.name || !newLocation.address) {
      toast({
        title: "Missing required fields",
        description: "Please enter a location name and address",
        variant: "destructive",
      });
      return;
    }
    createLocationMutation.mutate({
      name: newLocation.name,
      address: newLocation.address,
      radiusMeters: parseInt(newLocation.radiusMeters),
    });
  };

  return (
    <AdminLayout
      title="Work Locations"
      subtitle="Geofenced locations for GPS-verified clock in/out and route starting point"
      actions={
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-location">
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-16" text="Loading locations..." />
      ) : locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No work locations"
          description="Add work locations to enable GPS-verified clock in/out for drivers and set a route starting point."
          action={
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-first-location">
              <Plus className="w-4 h-4 mr-2" />
              Add First Location
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Card key={location.id} className={`p-5 ${location.isStartingPoint ? 'ring-2 ring-primary' : ''}`} data-testid={`location-card-${location.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{location.name}</p>
                      {location.isStartingPoint && (
                        <Badge variant="default" className="text-xs gap-1">
                          <Navigation className="w-3 h-3" />
                          Starting Point
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{location.address}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteLocationMutation.mutate(location.id)}
                  data-testid={`button-delete-location-${location.id}`}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Coordinates</span>
                  <span className="font-mono text-foreground">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Geofence radius</span>
                  <span className="font-medium text-foreground">{location.radiusMeters}m</span>
                </div>
              </div>

              {!location.isStartingPoint && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setStartingPointMutation.mutate(location.id)}
                  disabled={setStartingPointMutation.isPending}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Set as Route Starting Point
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Work Location</DialogTitle>
            <DialogDescription>
              Add a geofenced location where drivers can clock in and out. You can also designate it as the route starting point.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="loc-name">Location Name *</Label>
              <Input
                id="loc-name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="e.g., Main Warehouse"
                data-testid="input-location-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc-address">Address *</Label>
              <Input
                id="loc-address"
                value={newLocation.address}
                onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                placeholder="123 Main St, City, State"
                data-testid="input-location-address"
              />
              <p className="text-xs text-muted-foreground">
                Coordinates will be automatically detected from the address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loc-radius">Geofence Radius (meters)</Label>
              <Input
                id="loc-radius"
                value={newLocation.radiusMeters}
                onChange={(e) => setNewLocation({ ...newLocation, radiusMeters: e.target.value })}
                placeholder="100"
                data-testid="input-location-radius"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="flex-1"
              data-testid="button-cancel-location"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createLocationMutation.isPending}
              className="flex-1"
              data-testid="button-confirm-location"
            >
              {createLocationMutation.isPending ? "Adding..." : "Add Location"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
