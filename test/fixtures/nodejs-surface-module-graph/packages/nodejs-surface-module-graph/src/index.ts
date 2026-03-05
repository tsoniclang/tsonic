import { joinTenantPath } from "./pathing.js";
import { getSystemSummary } from "./system-info.js";
import { describeFileState } from "./file-state.js";

export function main(): void {
  const filePath = joinTenantPath("tenant-1");
  const sys = getSystemSummary();
  const state = describeFileState(filePath);
  console.log(filePath);
  console.log(sys.length > 0 ? "sys-ok" : "sys-empty");
  console.log(state.length > 0 ? "state-ok" : "state-empty");
}
