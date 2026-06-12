import type { bool, ulong } from "@tsonic/core/types.js";
import type { GoSlice } from "../compat.js";
import * as nodeOs from "node:os";

export type ValueKind = number;

export const KindBad: ValueKind = 0;
export const KindUint64: ValueKind = 1;
export const KindFloat64: ValueKind = 2;
export const KindFloat64Histogram: ValueKind = 3;

export interface Description {
  Name: string;
  Description: string;
  Kind: ValueKind;
  Cumulative: bool;
}

export interface Float64Histogram {
  Counts: GoSlice<ulong>;
  Buckets: GoSlice<number>;
}

export class Value {
  private readonly kind: ValueKind;
  private readonly payload: number | Float64Histogram;

  private constructor(kind: ValueKind, payload: number | Float64Histogram) {
    this.kind = kind;
    this.payload = payload;
  }

  static Uint64(value: ulong): Value {
    return new Value(KindUint64, value as number);
  }

  static Float64(value: number): Value {
    return new Value(KindFloat64, value);
  }

  static Histogram(value: Float64Histogram): Value {
    return new Value(KindFloat64Histogram, value);
  }

  Kind(): ValueKind {
    return this.kind;
  }

  Uint64(): ulong {
    return (this.kind === KindUint64 ? this.payload as number : 0) as ulong;
  }

  Float64(): number {
    return this.kind === KindFloat64 ? this.payload as number : 0;
  }

  Float64Histogram(): Float64Histogram | undefined {
    return this.kind === KindFloat64Histogram ? this.payload as Float64Histogram : undefined;
  }
}

export interface Sample {
  Name: string;
  Value: Value;
}

export function All(): GoSlice<Description> {
  return [
    {
      Name: "/memory/classes/heap/free:bytes",
      Description: "Approximate free system memory in bytes.",
      Kind: KindUint64,
      Cumulative: false as bool,
    },
    {
      Name: "/memory/classes/total:bytes",
      Description: "Approximate total system memory in bytes.",
      Kind: KindUint64,
      Cumulative: false as bool,
    },
    {
      Name: "/sched/goroutines:goroutines",
      Description: "Single-threaded JavaScript runtime goroutine count.",
      Kind: KindUint64,
      Cumulative: false as bool,
    },
  ];
}

export function Read(samples: GoSlice<Sample>): void {
  for (const sample of samples) {
    switch (sample.Name) {
      case "/memory/classes/heap/free:bytes":
        sample.Value = Value.Uint64(nodeOs.freemem() as ulong);
        break;
      case "/memory/classes/total:bytes":
        sample.Value = Value.Uint64(nodeOs.totalmem() as ulong);
        break;
      case "/sched/goroutines:goroutines":
        sample.Value = Value.Uint64(1 as ulong);
        break;
      default:
        sample.Value = Value.Uint64(0 as ulong);
        break;
    }
  }
}
