export const authoredLocalTypesFiles = Object.freeze({
  "EntryScope.ts": `export function scopeValue(): number { return 10; }`,
  "values.ts": `
    import type { int32 } from "@tsonic/core/types.js";
    export class Entry { value: int32 = 0; }
    export function first() {
      class Entry {
        private value: int32 = 3;
        readValue(): int32 { return this.value; }
      }
      return new Entry();
    }
    export function second() {
      class Entry { value: int32 = 7; }
      return new Entry();
    }
    export function generic<Value>(input: Value) {
      return class Entry { readValue(): Value { return input; } };
    }
  `,
  "index.ts": `
    import { Entry, first, second, generic } from "./values.js";
    import { scopeValue } from "./EntryScope.js";
    export function run(): boolean {
      if (scopeValue() !== 10 || new Entry().value !== 0 || first().readValue() !== 3 || second().value !== 7) return false;
      const Value = generic("retained");
      return new Value().readValue() === "retained";
    }
  `,
});
