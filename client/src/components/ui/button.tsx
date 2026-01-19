import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary to-[hsl(220,80%,55%)] text-primary-foreground border border-primary-border shadow-md hover:shadow-glow-sm",
        destructive:
          "bg-gradient-to-br from-destructive to-[hsl(0,70%,50%)] text-destructive-foreground border border-destructive-border shadow-md",
        outline:
          "border [border-color:var(--button-outline)] bg-white/50 dark:bg-white/5 backdrop-blur-sm shadow-sm hover:bg-white/70 dark:hover:bg-white/10",
        secondary: 
          "border bg-secondary/80 backdrop-blur-sm text-secondary-foreground border-secondary-border shadow-sm",
        ghost: 
          "border border-transparent hover:bg-primary/5 dark:hover:bg-primary/10",
        glass:
          "bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/20 shadow-sm hover:bg-white/80 dark:hover:bg-white/15",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
