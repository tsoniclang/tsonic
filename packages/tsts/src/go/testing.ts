import type { bool } from "@tsonic/core/types.js";
import { Sprint } from "./fmt.js";

export function AllocsPerRun(runs: number, fn: () => void): number {
  for (let index = 0; index < runs; index++) {
    fn();
  }
  return 0;
}

class testFailure extends globalThis.Error {}

export interface TB {
  Helper(): void;
  Error(...args: unknown[]): void;
  Errorf(format: string, ...args: unknown[]): void;
  Fatal(...args: unknown[]): never;
  Fatalf(format: string, ...args: unknown[]): never;
  Failed(): bool;
  Fail(): void;
  FailNow(): never;
}

class testingBase implements TB {
  private failed = false;

  Helper(): void {}

  Error(...args: unknown[]): void {
    this.failed = true;
    console.error(args.map((arg) => Sprint(arg)).join(" "));
  }

  Errorf(format: string, ...args: unknown[]): void {
    this.Error(format, ...args);
  }

  Fatal(...args: unknown[]): never {
    this.Error(...args);
    throw new testFailure(args.map((arg) => Sprint(arg)).join(" "));
  }

  Fatalf(format: string, ...args: unknown[]): never {
    this.Error(format, ...args);
    throw new testFailure(format);
  }

  Failed(): bool {
    return this.failed as bool;
  }

  Fail(): void {
    this.failed = true;
  }

  FailNow(): never {
    this.Fail();
    throw new testFailure("test failed");
  }
}

export class B extends testingBase {}

export interface F {
  Add(...args: unknown[]): void;
  Fuzz(fn: (...args: unknown[]) => void): void;
}

export class M extends testingBase {}

export class T extends testingBase {
  Run(name: string, fn: (t: T) => void): bool {
    const child = new T();
    try {
      fn(child);
      return !child.Failed() as bool;
    } catch {
      return false as bool;
    }
  }
}

export class PB extends testingBase {}

export function Testing(): bool {
  return false as bool;
}
