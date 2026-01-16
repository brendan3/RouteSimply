import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, Phone, Trash2, Palette, Check } from "lucide-react";
import type { User, InsertUser } from "@shared/schema";

const DRIVER_COLORS = [
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F97316" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Lime", value: "#84CC16" },
  { name: "Green", value: "#22C55E" },
  { name: "Emerald", value: "#10B981" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Sky", value: "#0EA5E9" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Purple", value: "#A855F7" },
  { name: "Fuchsia", value: "#D946EF" },
  { name: "Pink", value: "#EC4899" },
  { name: "Rose", value: "#F43F5E" },
];

export default function AdminDriversPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    username: "",
    password: "",
    role: "driver",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const drivers = users.filter((u) => u.role === "driver");
  const admins = users.filter((u) => u.role === "admin");

  const createUserMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      return apiRequest<User>("POST", "/api/users", data);
    },
    onSuccess: () => {
      setShowAddDialog(false);
      setNewDriver({ name: "", phone: "", username: "", password: "", role: "driver" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateColorMutation = useMutation({
    mutationFn: async ({ userId, color }: { userId: string; color: string | null }) => {
      return apiRequest<User>("PATCH", `/api/users/${userId}`, { color });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Driver color updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update color",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newDriver.name || !newDriver.username || !newDriver.password) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate(newDriver as InsertUser);
  };

  return (
    <AdminLayout
      title="Drivers & Users"
      subtitle={`${drivers.length} drivers • ${admins.length} admins`}
      actions={
        <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-user">
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-16" text="Loading users..." />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Add drivers and administrators to start managing your team."
          action={
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-first-user">
              <Plus className="w-4 h-4 mr-2" />
              Add First User
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {drivers.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Drivers</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {drivers.map((driver) => (
                  <Card key={driver.id} className="p-5" data-testid={`driver-card-${driver.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ 
                            backgroundColor: driver.color ? `${driver.color}20` : 'hsl(var(--primary) / 0.1)',
                          }}
                        >
                          <span 
                            className="text-sm font-semibold"
                            style={{ color: driver.color || 'hsl(var(--primary))' }}
                          >
                            {driver.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p 
                            className="font-medium"
                            style={{ color: driver.color || 'hsl(var(--foreground))' }}
                          >
                            {driver.name}
                          </p>
                          <p className="text-sm text-muted-foreground">@{driver.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-color-${driver.id}`}
                            >
                              {driver.color ? (
                                <div 
                                  className="w-4 h-4 rounded-full border border-border"
                                  style={{ backgroundColor: driver.color }}
                                />
                              ) : (
                                <Palette className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="end">
                            <div className="grid grid-cols-6 gap-2">
                              {DRIVER_COLORS.map((color) => (
                                <button
                                  key={color.value}
                                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:scale-110 transition-transform"
                                  style={{ backgroundColor: color.value }}
                                  onClick={() => updateColorMutation.mutate({ userId: driver.id, color: color.value })}
                                  title={color.name}
                                  data-testid={`color-option-${color.name.toLowerCase()}`}
                                >
                                  {driver.color === color.value && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                              ))}
                              <button
                                className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:scale-110 transition-transform bg-muted"
                                onClick={() => updateColorMutation.mutate({ userId: driver.id, color: null })}
                                title="Clear color"
                                data-testid="color-option-clear"
                              >
                                {!driver.color && (
                                  <Check className="w-3 h-3 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteUserMutation.mutate(driver.id)}
                          data-testid={`button-delete-${driver.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    {driver.phone && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {driver.phone}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {admins.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Administrators</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {admins.map((admin) => (
                  <Card key={admin.id} className="p-5" data-testid={`admin-card-${admin.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {admin.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{admin.name}</p>
                            <Badge variant="secondary" className="text-xs">
                              Admin
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">@{admin.username}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new driver or administrator account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newDriver.name}
                onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                placeholder="Enter full name"
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newDriver.phone}
                onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                placeholder="(555) 123-4567"
                data-testid="input-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={newDriver.username}
                onChange={(e) => setNewDriver({ ...newDriver, username: e.target.value })}
                placeholder="Enter username"
                data-testid="input-new-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={newDriver.password}
                onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
                placeholder="Enter password"
                data-testid="input-new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={newDriver.role}
                onValueChange={(value) => setNewDriver({ ...newDriver, role: value })}
              >
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="flex-1"
              data-testid="button-cancel-add"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createUserMutation.isPending}
              className="flex-1"
              data-testid="button-confirm-add"
            >
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
