import { allEndpointNodes, graphEdges, projectCategories, projectSummary } from "@/lib/argusgrid-data"

export async function GET() {
  return Response.json({
    project: projectSummary,
    categories: projectCategories,
    nodes: allEndpointNodes,
    edges: graphEdges,
  })
}
