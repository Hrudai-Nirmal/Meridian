"use client"

/*
 * Custom React Flow node for monitored automation endpoints. The visible handles
 * make workflow relationships editable without changing node telemetry behavior.
 */

import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"
import { type EndpointNodeData, iconRegistry, statusCopy, statusStyles } from "@/lib/argusgrid-data"
import { cn } from "@/lib/utils"

const connectorHandleClasses = cn(
  "!size-7 !border-0 !bg-transparent !opacity-100",
  "after:absolute after:left-1/2 after:top-1/2 after:size-3 after:-translate-x-1/2 after:-translate-y-1/2",
  "after:rounded-full after:border after:border-sky-300 after:bg-background after:shadow-sm after:transition-all",
  "hover:after:scale-125 hover:after:border-sky-500 hover:after:bg-sky-50",
  "dark:after:border-sky-500 dark:hover:after:bg-sky-950"
)

/**
 * Renders a monitored endpoint node with input/output graph connection handles.
 */
export function EndpointGraphNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as EndpointNodeData
  const Icon = iconRegistry[nodeData.icon] ?? iconRegistry.api
  const effectiveStatus = nodeData.override ?? nodeData.status

  return (
    <div
      className={cn(
        "min-w-48 rounded-xl border bg-card p-3 text-card-foreground shadow-sm transition-all",
        statusStyles[effectiveStatus],
        selected && "ring-4 ring-primary/20"
      )}
    >
      <Handle
        aria-label={`${nodeData.label} input connection`}
        className={cn(connectorHandleClasses, "!-left-3")}
        title="Input connection"
        type="target"
        position={Position.Left}
      />
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg border bg-background/80 shadow-sm">
          {nodeData.customIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-6 object-contain" src={nodeData.customIconUrl} />
          ) : (
            <Icon className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{nodeData.label}</div>
          <div className="truncate text-xs text-muted-foreground">{nodeData.category}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant="outline" className="bg-background/70 text-[11px]">
          {statusCopy[effectiveStatus]}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{nodeData.cadence}</span>
      </div>
      <Handle
        aria-label={`${nodeData.label} output connection`}
        className={cn(connectorHandleClasses, "!-right-3")}
        title="Output connection"
        type="source"
        position={Position.Right}
      />
    </div>
  )
}
