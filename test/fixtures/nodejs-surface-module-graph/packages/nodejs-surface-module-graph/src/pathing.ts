import { path } from "node:path";

export function joinTenantPath(tenantId: string): string {
  return path.join("uploads", tenantId, "events.json");
}
