export const nativeV8FlagsSource = `
import { setFlagsFromString } from "node:v8";
import { setFlagsFromString as aliasedFlags } from "v8";

let attempts = 0;
function request(flags: string): void {
  attempts += 1;
  setFlagsFromString(flags);
}

function attempted(count: number): boolean {
  return attempts === count;
}

export function run(): boolean {
  if (!attempted(0)) return false;
  let rejected = 0;
  try { request("--stack_size=1024"); } catch { rejected += 1; }
  try { request(""); } catch { rejected += 1; }
  try { aliasedFlags("--trace_gc"); } catch { rejected += 1; }
  return attempted(2) && rejected === 3;
}
`;
