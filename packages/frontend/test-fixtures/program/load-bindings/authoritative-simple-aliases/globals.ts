import { Array as SourceArray } from "./src/array-object.js";
import { String as SourceString } from "./src/string-object.js";
import { Boolean as SourceBoolean } from "./src/boolean-object.js";

declare global {
  interface Array<T> {
    push(...items: T[]): number;
  }
  interface ArrayConstructor {}
  const Array: ArrayConstructor & typeof SourceArray;

  interface String {
    startsWith(search: string): boolean;
  }
  const String: typeof SourceString;

  interface Boolean {
    toString(): string;
  }
  const Boolean: typeof SourceBoolean;
}

export {};
