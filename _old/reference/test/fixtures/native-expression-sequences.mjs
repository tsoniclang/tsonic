export const nativeExpressionSequencesSource = `
import type { int32, uint64 } from "@tsonic/core/types.js";

class Trace {
  order: int32 = 0;
  mark(step: int32): void { this.order = this.order * 10 + step; }
  value(step: int32): int32 { this.mark(step); return step; }
  observe(): int32 { return this.order; }
}

function direct(trace: Trace): int32 { return (trace.mark(1), trace.value(2)); }
function nested(trace: Trace): int32 { return (trace.value(3), (trace.mark(4), trace.value(5))); }
function optional(trace: Trace): int32 | undefined { return (trace.mark(6), undefined); }
function wide(trace: Trace, value: uint64): uint64 { return (trace.mark(7), value); }
function identity(trace: Trace): Trace { return (trace.mark(8), trace); }
function stopped(trace: Trace): int32 { return (fail(), trace.value(9)); }
function fail(): never { throw new Error("sequence stopped"); }
async function suspended(trace: Trace): Promise<int32> { return (trace.mark(1), await trace.value(2)); }
function lazy(trace: Trace, enabled: boolean): int32 { return enabled ? (trace.mark(1), trace.value(2)) : 0; }

export async function main(): Promise<void> {
  const trace = new Trace();
  if (direct(trace) !== 2 || trace.observe() !== 12) throw new Error("sequence order or completion");
  trace.order = 0;
  if (nested(trace) !== 5 || trace.observe() !== 345) throw new Error("nested sequence order");
  trace.order = 0;
  if (optional(trace) !== null || trace.observe() !== 6) throw new Error("sequence absence");
  trace.order = 0;
  const value: uint64 = 9007199254740993n;
  if (wide(trace, value) !== value || trace.observe() !== 7) throw new Error("sequence native width");
  trace.order = 0;
  if (identity(trace) !== trace || trace.observe() !== 8) throw new Error("sequence identity");
  trace.order = 0;
  let rejected = false;
  try { stopped(trace); } catch { rejected = true; }
  if (!rejected || trace.observe() !== 0) throw new Error("divergent sequence evaluated its right");
  if (await suspended(trace) !== 2 || trace.observe() !== 12) throw new Error("sequence suspension");
  trace.order = 0;
  if (lazy(trace, false) !== 0 || trace.observe() !== 0) throw new Error("unselected sequence evaluated");
  if (lazy(trace, true) !== 2 || trace.observe() !== 12) throw new Error("selected sequence skipped");
}
`;
