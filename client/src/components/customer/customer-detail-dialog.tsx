import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Layers, Plus, X, Calendar, Minus } from "lucide-react";
import type { Location, Material, LocationMaterialWithDetails } from "@shared/schema";
import { useState } from "react";

interface CustomerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string | null;
  customerName?: string;
  address?: string;
  isAdmin?: boolean;
}

export function CustomerDetailDialog({
  open,
  onOpenChange,
  locationId,
  customerName,
  address,
  isAdmin = false,
}: CustomerDetailDialogProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locationMaterials = [], isLoading: materialsLoading } = useQuery<LocationMaterialWithDetails[]>({
    queryKey: ["/api/locations", locationId, "materials"],
    queryFn: async () => {
      if (!locationId) return [];
      const response = await fetch(`/api/locations/${locationId}/materials`);
      if (!response.ok) throw new Error("Failed to fetch materials");
      return response.json();
    },
    enabled: !!locationId && open,
  });

  const { data: allMaterials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
    enabled: isAdmin && open,
  });

  const { data: location } = useQuery<Location>({
    queryKey: ["/api/locations", locationId],
    queryFn: async () => {
      if (!locationId) return null;
      const response = await fetch(`/api/locations/${locationId}`);
      if (!response.ok) throw new Error("Failed to fetch location");
      return response.json();
    },
    enabled: !!locationId && open,
  });

  const addMaterialMutation = useMutation({
    mutationFn: async ({ materialId, quantity }: { materialId: string; quantity: number }) => {
      return apiRequest("POST", `/api/locations/${locationId}/materials`, { materialId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", locationId, "materials"] });
      setSelectedMaterialId("");
      setNewQuantity(1);
      toast({ title: "Material added successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      return apiRequest("PATCH", `/api/location-materials/${id}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", locationId, "materials"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update quantity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMaterialMutation = useMutation({
    mutationFn: async (locationMaterialId: string) => {
      return apiRequest("DELETE", `/api/location-materials/${locationMaterialId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations", locationId, "materials"] });
      toast({ title: "Material removed successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddMaterial = () => {
    if (selectedMaterialId) {
      addMaterialMutation.mutate({ materialId: selectedMaterialId, quantity: newQuantity });
    }
  };

  const handleQuantityChange = (lm: LocationMaterialWithDetails, delta: number) => {
    const newQty = Math.max(1, (lm.quantity || 1) + delta);
    updateQuantityMutation.mutate({ id: lm.id, quantity: newQty });
  };

  const assignedMaterialIds = locationMaterials.map((lm) => lm.materialId);
  const availableMaterials = allMaterials.filter((m) => !assignedMaterialIds.includes(m.id));

  const displayName = customerName || location?.customerName || "Customer";
  const displayAddress = address || location?.address || "";
  const displayDays = location?.daysOfWeek || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            {displayName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {displayAddress}
          </div>

          {displayDays.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {displayDays.map((day) => (
                <Badge key={day} variant="secondary" className="text-xs capitalize">
                  {day}
                </Badge>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Materials
              </h3>
              {materialsLoading && <LoadingSpinner className="w-4 h-4" />}
            </div>

            {locationMaterials.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No materials assigned to this location.
              </p>
            ) : (
              <div className="space-y-2">
                {locationMaterials.map((lm) => (
                  <Card key={lm.id} className="p-3 flex items-center justify-between" data-testid={`location-material-${lm.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{lm.material?.name || "Unknown"}</p>
                        {lm.material?.category && (
                          <p className="text-xs text-muted-foreground">{lm.material.category}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        <>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(lm, -1)}
                              disabled={updateQuantityMutation.isPending || (lm.quantity || 1) <= 1}
                              data-testid={`button-decrease-qty-${lm.id}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium" data-testid={`qty-${lm.id}`}>
                              {lm.quantity || 1}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleQuantityChange(lm, 1)}
                              disabled={updateQuantityMutation.isPending}
                              data-testid={`button-increase-qty-${lm.id}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeMaterialMutation.mutate(lm.id)}
                            disabled={removeMaterialMutation.isPending}
                            data-testid={`button-remove-material-${lm.id}`}
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Qty: {lm.quantity || 1}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {isAdmin && availableMaterials.length > 0 && (
              <div className="mt-4 flex gap-2">
                <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                  <SelectTrigger className="flex-1" data-testid="select-material">
                    <SelectValue placeholder="Select a material to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMaterials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name}
                        {material.category && ` (${material.category})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center"
                  data-testid="input-quantity"
                />
                <Button
                  size="icon"
                  onClick={handleAddMaterial}
                  disabled={!selectedMaterialId || addMaterialMutation.isPending}
                  data-testid="button-add-material"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            {isAdmin && allMaterials.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4">
                No materials configured yet. Add materials in the Materials section.
              </p>
            )}
          </div>

          {location?.notes && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground">{location.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
