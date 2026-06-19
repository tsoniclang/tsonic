import type { ulong } from "../../../scalars.js";
import type { GoError } from "../../../compat.js";
import * as nodeOs from "node:os";

export interface Stats {
  Total: ulong;
  Used: ulong;
  Cached: ulong;
  Free: ulong;
}

export function Get(): [Stats, GoError] {
  const total = nodeOs.totalmem();
  const free = nodeOs.freemem();
  return [{
    Total: total as ulong,
    Used: (total - free) as ulong,
    Cached: 0 as ulong,
    Free: free as ulong,
  }, undefined];
}
