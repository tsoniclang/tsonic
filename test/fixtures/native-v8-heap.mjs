export const nativeV8HeapFields = Object.freeze([
  "total_heap_size", "total_heap_size_executable", "total_physical_size",
  "total_available_size", "used_heap_size", "heap_size_limit", "malloced_memory",
  "peak_malloced_memory", "does_zap_garbage", "number_of_native_contexts",
  "number_of_detached_contexts", "total_global_handles_size", "used_global_handles_size",
  "external_memory", "total_allocated_bytes",
]);

export const nativeV8HeapSource = `
import { getHeapStatistics } from "node:v8";
import { getHeapStatistics as aliasedHeap } from "v8";
import type { HeapInfo } from "node:v8";

let attempts = 0;
let continued = 0;

function sum(info: HeapInfo): number {
  return ${nativeV8HeapFields.map(name => `info.${name}`).join(" + ")};
}

function request(): number {
  attempts += 1;
  const result = getHeapStatistics();
  continued += 1;
  return sum(result);
}

function observed(expectedAttempts: number, expectedContinued: number): boolean {
  return attempts === expectedAttempts && continued === expectedContinued;
}

export function run(): boolean {
  if (!observed(0, 0)) return false;
  let rejected = 0;
  try { request(); } catch { rejected += 1; }
  try { request(); } catch { rejected += 1; }
  try { aliasedHeap(); continued += 1; } catch { rejected += 1; }
  return observed(2, 0) && rejected === 3;
}
`;
