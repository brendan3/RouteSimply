import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUpload } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Layers, Plus, Pencil, Trash2, Upload, ArrowUpDown, Search } from "lucide-react";
import type { MaterialWithQuantities, InsertMaterial } from "@shared/schema";

type SortField = "id" | "name" | "category" | "assignedQuantity" | "stockQuantity";
type SortDirection = "asc" | "desc";

export default function AdminMaterialsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialWithQuantities | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    category: "",
    stockQuantity: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { toast } = useToast();

  const { data: materials = [], isLoading } = useQuery<MaterialWithQuantities[]>({
    queryKey: ["/api/materials"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertMaterial) => {
      return apiRequest<MaterialWithQuantities>("POST", "/api/materials", data);
    },
    onSuccess: () => {
      setShowAddDialog(false);
      setFormData({ id: "", name: "", category: "", stockQuantity: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Material created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertMaterial> }) => {
      return apiRequest<MaterialWithQuantities>("PATCH", `/api/materials/${id}`, data);
    },
    onSuccess: () => {
      setEditingMaterial(null);
      setFormData({ id: "", name: "", category: "", stockQuantity: 0 });
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Material updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: "Material deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete material",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<{ message: string; created: number; skipped: number }>("/api/materials/upload", formData);
    },
    onSuccess: (data) => {
      setShowUploadDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      toast({ title: data.message || "Materials uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload materials",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!formData.name) {
      toast({
        title: "Name is required",
        description: "Please enter a material name",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      name: formData.name,
      category: formData.category || null,
      stockQuantity: formData.stockQuantity || 0,
    });
  };

  const handleUpdate = () => {
    if (!editingMaterial || !formData.name) {
      toast({
        title: "Name is required",
        description: "Please enter a material name",
        variant: "destructive",
      });
      return;
    }
    if (!formData.id) {
      toast({
        title: "Item ID is required",
        description: "Please enter an Item ID",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      id: editingMaterial.id,
      data: {
        id: formData.id !== editingMaterial.id ? formData.id : undefined,
        name: formData.name,
        category: formData.category || null,
        stockQuantity: formData.stockQuantity || 0,
      },
    });
  };

  const openEditDialog = (material: MaterialWithQuantities) => {
    setEditingMaterial(material);
    setFormData({
      id: material.id,
      name: material.name,
      category: material.category || "",
      stockQuantity: material.stockQuantity || 0,
    });
  };

  const closeDialogs = () => {
    setShowAddDialog(false);
    setEditingMaterial(null);
    setFormData({ id: "", name: "", category: "", stockQuantity: 0 });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 w-3 h-3 text-muted-foreground/50" />;
    }
    return (
      <ArrowUpDown className={`ml-1 w-3 h-3 ${sortDirection === "asc" ? "text-primary" : "text-primary rotate-180"}`} />
    );
  };

  const filteredAndSortedMaterials = materials
    .filter((material) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        material.name.toLowerCase().includes(query) ||
        material.category?.toLowerCase().includes(query) ||
        material.id.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "id":
          comparison = a.id.localeCompare(b.id);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "category":
          comparison = (a.category || "").localeCompare(b.category || "");
          break;
        case "assignedQuantity":
          comparison = (a.assignedQuantity || 0) - (b.assignedQuantity || 0);
          break;
        case "stockQuantity":
          comparison = (a.stockQuantity || 0) - (b.stockQuantity || 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  return (
    <AdminLayout
      title="Materials"
      subtitle={`${materials.length} materials configured`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowUploadDialog(true)} data-testid="button-upload-materials">
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-material">
            <Plus className="w-4 h-4 mr-2" />
            Add Material
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-16" text="Loading materials..." />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No materials yet"
          description="Add materials like mats, paper products, or other supplies that you deliver to customers."
          action={
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-first-material">
              <Plus className="w-4 h-4 mr-2" />
              Add First Material
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, category, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-materials"
            />
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("id")}
                    data-testid="sort-id"
                  >
                    <div className="flex items-center">
                      Item ID
                      <SortIcon field="id" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                    data-testid="sort-name"
                  >
                    <div className="flex items-center">
                      Item
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("category")}
                    data-testid="sort-category"
                  >
                    <div className="flex items-center">
                      Category
                      <SortIcon field="category" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("assignedQuantity")}
                    data-testid="sort-assigned"
                  >
                    <div className="flex items-center justify-end">
                      Assigned Qty
                      <SortIcon field="assignedQuantity" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("stockQuantity")}
                    data-testid="sort-stock"
                  >
                    <div className="flex items-center justify-end">
                      Stock Qty
                      <SortIcon field="stockQuantity" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedMaterials.map((material) => (
                  <TableRow key={material.id} data-testid={`material-row-${material.id}`}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      <span title={material.id} data-testid={`text-id-${material.id}`}>
                        {material.id.slice(0, 8)}...
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground" data-testid={`text-name-${material.id}`}>{material.name}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-muted-foreground" data-testid={`text-category-${material.id}`}>{material.category || "-"}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium" data-testid={`text-assigned-${material.id}`}>{material.assignedQuantity || 0}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium" data-testid={`text-stock-${material.id}`}>{material.stockQuantity || 0}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(material)}
                          data-testid={`button-edit-${material.id}`}
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(material.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${material.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredAndSortedMaterials.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No materials found</p>
                <p className="text-sm mt-1">
                  {searchQuery ? "Try adjusting your search" : "Add materials to get started"}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
            <DialogDescription>
              Add a material or supply type that you deliver to customers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Logo Mat, Anti-Fatigue Mat, Paper Towels"
                data-testid="input-material-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Mats, Paper Products, Supplies"
                data-testid="input-material-category"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stockQuantity">Stock Quantity</Label>
              <Input
                id="stockQuantity"
                type="number"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
                placeholder="0"
                data-testid="input-material-stock"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={closeDialogs}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex-1"
              data-testid="button-create-material"
            >
              {createMutation.isPending ? "Creating..." : "Create Material"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingMaterial} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Material</DialogTitle>
            <DialogDescription>
              Update the material details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-id">Item ID *</Label>
              <Input
                id="edit-id"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                placeholder="e.g., mat-001"
                data-testid="input-edit-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Logo Mat"
                data-testid="input-edit-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">Category (optional)</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Mats"
                data-testid="input-edit-category"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-stockQuantity">Stock Quantity</Label>
              <Input
                id="edit-stockQuantity"
                type="number"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
                placeholder="0"
                data-testid="input-edit-stock"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={closeDialogs}
              className="flex-1"
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              className="flex-1"
              data-testid="button-save-material"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Materials CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with materials. Required column: name. Optional columns: category, stock_quantity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
              data-testid="input-materials-csv"
            />
            {uploadMutation.isPending && (
              <div className="text-sm text-muted-foreground">Uploading...</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
