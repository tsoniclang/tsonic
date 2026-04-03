import { Array as SourceArray } from "./src/array-object.js";
import { String as SourceString } from "./src/String.js";

declare global {
  interface Array<T> {
    push(...items: T[]): number;
  }
  interface ArrayConstructor {}
  const Array: ArrayConstructor & typeof SourceArray;

  interface String {
    trim(): string;
  }
  const String: typeof SourceString;
}

export {};
