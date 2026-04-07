import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border/60 bg-gradient-to-r from-slate-900 to-slate-800 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-200",
        "data-[state=checked]:from-primary data-[state=checked]:to-cyan-500 data-[state=checked]:shadow-[0_10px_30px_rgba(59,130,246,0.4)] data-[state=checked]:border-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-[0_6px_18px_rgba(0,0,0,0.25)] ring-0 transition-transform duration-200",
          "data-[state=unchecked]:translate-x-1 data-[state=checked]:translate-x-[calc(100%-6px)]",
          "data-[state=checked]:bg-white"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
