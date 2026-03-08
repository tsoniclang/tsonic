import { join } from "node:path";

export function joinTenantPath(tenantId: string): string {
  const parts = ["uploads", tenantId, "events.json"];
  return join(...parts);
}
