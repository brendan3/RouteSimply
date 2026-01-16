import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Map, Users, Clock, MapPin, LogOut, Package, Calendar, ClipboardCheck, Layers, ChevronDown, ChevronRight, Settings, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

const mainNavItemsDefault = [
  { id: "stops", label: "Delivery Stops", Icon: Package, href: "/admin/stops" },
  { id: "confirm-route", label: "Confirm Route", Icon: ClipboardCheck, href: "/admin/confirm-route" },
  { id: "routes", label: "Routes", Icon: Map, href: "/admin" },
  { id: "calendar", label: "Calendar", Icon: Calendar, href: "/admin/calendar" },
  { id: "materials", label: "Materials", Icon: Layers, href: "/admin/materials" },
];

const settingsNavItems = [
  { id: "drivers", label: "Drivers", Icon: Users, href: "/admin/drivers" },
  { id: "time-tracking", label: "Time Tracking", Icon: Clock, href: "/admin/time-tracking" },
  { id: "locations", label: "Work Locations", Icon: MapPin, href: "/admin/locations" },
];

interface NavItemProps {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  href: string;
  isActive: boolean;
}

function SortableNavItem({ id, label, Icon, href, isActive }: NavItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      <button
        {...attributes}
        {...listeners}
        className="p-1 mr-1 opacity-0 group-hover:opacity-50 cursor-grab active:cursor-grabbing"
        data-testid={`drag-handle-${id}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Link
        href={href}
        data-testid={`sidebar-nav-${id}`}
        className={cn(
          "flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-sidebar-foreground hover-elevate"
        )}
      >
        <Icon className="w-5 h-5" />
        {label}
      </Link>
    </div>
  );
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuthContext();

  const [settingsOpen, setSettingsOpen] = useState(() => {
    const saved = localStorage.getItem("sidebar_teamSettingsCollapsed");
    return saved ? saved !== "true" : true;
  });

  const [mainNavItems, setMainNavItems] = useState(() => {
    const savedOrder = localStorage.getItem("sidebar_navOrder");
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const orderedItems = orderIds
          .map((id: string) => mainNavItemsDefault.find(item => item.id === id))
          .filter(Boolean);
        const remaining = mainNavItemsDefault.filter(
          item => !orderIds.includes(item.id)
        );
        return [...orderedItems, ...remaining];
      } catch {
        return mainNavItemsDefault;
      }
    }
    return mainNavItemsDefault;
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMainNavItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("sidebar_navOrder", JSON.stringify(newItems.map(i => i.id)));
        return newItems;
      });
    }
  };

  const toggleSettings = () => {
    const newState = !settingsOpen;
    setSettingsOpen(newState);
    localStorage.setItem("sidebar_teamSettingsCollapsed", (!newState).toString());
  };

  const isNavItemActive = (href: string) => {
    if (href === "/admin") {
      return location === href;
    }
    return location === href || location.startsWith(href);
  };

  return (
    <aside className="w-[280px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">
          Grizzly Mats
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Driver Management</p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={mainNavItems.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {mainNavItems.map(({ id, label, Icon, href }) => (
                <SortableNavItem
                  key={id}
                  id={id}
                  label={label}
                  Icon={Icon}
                  href={href}
                  isActive={isNavItemActive(href)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="mt-2 pt-2 border-t border-sidebar-border">
          <button
            onClick={toggleSettings}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium text-sidebar-foreground hover-elevate"
            data-testid="sidebar-toggle-settings"
          >
            {settingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Settings className="w-5 h-5" />
            Team & Settings
          </button>
          {settingsOpen && (
            <div className="ml-4 mt-1 space-y-1">
              {settingsNavItems.map(({ id, label, Icon, href }) => {
                const isActive = isNavItemActive(href);
                return (
                  <Link
                    key={id}
                    href={href}
                    data-testid={`sidebar-nav-${id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover-elevate"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {user?.name?.charAt(0) || "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name || "Admin"}
            </p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-4 text-muted-foreground"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </Button>
      </div>
    </aside>
  );
}
