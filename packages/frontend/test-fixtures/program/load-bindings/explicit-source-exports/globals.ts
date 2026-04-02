import { Array as SourceArray } from "./src/array-object.js";
import { String as SourceString } from "./src/Globals.js";

declare global {
  interface Array<T> {
    push(...items: T[]): number;
    slice(start?: number, end?: number): T[];
  }
  interface ArrayConstructor {}
  const Array: ArrayConstructor & typeof SourceArray;

  interface String {
    trim(): string;
    charCodeAt(index: number): number;
  }
  const String: typeof SourceString;
}

export {};
