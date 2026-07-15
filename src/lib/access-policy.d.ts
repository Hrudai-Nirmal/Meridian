export type EnterpriseRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"

export type EnterpriseRoleCapability = {
  id: string
  label: string
  description: string
  roles: Record<EnterpriseRole, boolean>
}

export const ENTERPRISE_ROLES: EnterpriseRole[]
export const ENTERPRISE_ROLE_CAPABILITIES: EnterpriseRoleCapability[]
export function getRoleLabel(role: string): string
export function getRoleCapabilityRows(): EnterpriseRoleCapability[]
