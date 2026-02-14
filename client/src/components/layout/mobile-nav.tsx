import { Calendar, Clock, User, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "schedule", label: "Schedule", Icon: Calendar },
  { id: "clock", label: "Clock", Icon: Clock },
  { id: "messages", label: "Messages", Icon: MessageCircle },
  { id: "profile", label: "Profile", Icon: User },
];

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 pb-safe">
      <div className="flex items-center justify-around h-[72px] max-w-lg mx-auto">
        {navItems.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              data-testid={`nav-${id}`}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 w-full h-full transition-opacity",
                isActive ? "opacity-100" : "opacity-60"
              )}
            >
              <Icon 
                className={cn(
                  "w-6 h-6 transition-colors",
                  isActive ? "text-primary" : "text-foreground"
                )} 
              />
              <span 
                className={cn(
                  "text-[11px] font-medium tracking-tight",
                  isActive ? "text-primary" : "text-foreground"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
