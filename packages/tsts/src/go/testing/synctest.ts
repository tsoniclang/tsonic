import { T } from "../testing.js";

export function Test(fn: (t: T) => void): void {
  fn(new T());
}

export function Wait(): void {
  // The TSTS runtime is single-threaded; queued synchronous work has completed.
}
