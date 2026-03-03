import { Console } from "@tsonic/dotnet/System.js";
import { joinTenantPath } from "./pathing.js";
import { getSystemSummary } from "./system-info.js";
import { describeFileState } from "./file-state.js";

export function main(): void {
  const filePath = joinTenantPath("tenant-1");
  const sys = getSystemSummary();
  const state = describeFileState(filePath);
  Console.WriteLine(filePath);
  Console.WriteLine(sys.Length > 0 ? "sys-ok" : "sys-empty");
  Console.WriteLine(state.Length > 0 ? "state-ok" : "state-empty");
}
