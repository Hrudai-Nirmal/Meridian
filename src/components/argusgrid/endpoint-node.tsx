"use client"

import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"

import { Badge } from "@/components/ui/badge"
import { type EndpointNodeData, iconRegistry, statusCopy, statusStyles } from "@/lib/argusgrid-data"
import { cn } from "@/lib/utils"

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
      <Handle className="opacity-0" type="target" position={Position.Left} />
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg border bg-background/80 shadow-sm">
          <Icon className="size-5" />
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
      <Handle className="opacity-0" type="source" position={Position.Right} />
    </div>
  )
}
