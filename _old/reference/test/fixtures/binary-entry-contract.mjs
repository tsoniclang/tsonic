export const binaryEntryNativePrograms = Object.freeze({
  explicit: `import type { int32 } from "@tsonic/core/types.js";
let calls: int32 = 0;
export function main(): void {
  calls++;
  if (calls !== 1) throw new Error("entry ran more than once");
}
main();
if (calls !== 1) throw new Error("entry did not run");`,
  top_level: `import type { int32 } from "@tsonic/core/types.js";
let calls: int32 = 0;
calls++;
if (calls !== 1) throw new Error("top-level code did not run exactly once");`,
  async: `import type { int32 } from "@tsonic/core/types.js";
let calls: int32 = 0;
export async function main(): Promise<void> {
  calls++;
  if (calls !== 1) throw new Error("async entry ran more than once");
}
await main();
if (calls !== 1) throw new Error("async entry did not run");`,
});
