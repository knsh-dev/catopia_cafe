import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-caramel text-white hover:bg-caramel-dark active:bg-caramel-dark shadow-sm hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-latte-dark",
        outline:
          "border-2 border-caramel text-caramel bg-transparent hover:bg-caramel hover:text-white",
        ghost:
          "text-espresso hover:bg-latte/60",
        link:
          "text-caramel underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        accent:
          "bg-espresso text-cream hover:bg-espresso-light shadow-md hover:shadow-lg",
      },
      size: {
        default: "h-10 px-5 py-2 text-sm rounded-[var(--radius-md)]",
        sm: "h-8 px-3 text-xs rounded-[var(--radius-sm)]",
        lg: "h-12 px-8 text-base rounded-[var(--radius-lg)]",
        xl: "h-14 px-10 text-lg rounded-[var(--radius-xl)]",
        icon: "h-10 w-10 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
