"use client"

import type * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

function ChartContainer({
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: Record<string, { label: string; color?: string }>
}) {
  return (
    <div className={cn("w-full", className)} {...props}>
      {children}
    </div>
  )
}

function ChartTooltip({ ...props }: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  return <RechartsPrimitive.Tooltip {...props} />
}

function ChartTooltipContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-background p-2 shadow-md", className)} {...props} />
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
