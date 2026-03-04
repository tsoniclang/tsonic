import { join } from "node:path";

export function joinTenantPath(tenantId: string): string {
  return join("uploads", tenantId, "events.json");
}
