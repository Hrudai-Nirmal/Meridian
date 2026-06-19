import { allEndpointNodes, graphEdges, projectCategories, projectSummary } from "@/lib/meridian-data"

export async function GET() {
  return Response.json({
    project: projectSummary,
    categories: projectCategories,
    nodes: allEndpointNodes,
    edges: graphEdges,
  })
}
