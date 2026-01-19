import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-primary to-[hsl(220,80%,55%)] text-primary-foreground shadow-sm",
        secondary: 
          "border-transparent bg-secondary/80 backdrop-blur-sm text-secondary-foreground",
        destructive:
          "border-transparent bg-gradient-to-r from-destructive to-[hsl(0,70%,50%)] text-destructive-foreground shadow-sm",
        outline: 
          "border [border-color:var(--badge-outline)] bg-white/50 dark:bg-white/5 backdrop-blur-sm shadow-sm",
        accent:
          "border-transparent bg-gradient-to-r from-primary to-[hsl(186,80%,45%)] text-white shadow-sm",
        glass:
          "border border-white/30 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
