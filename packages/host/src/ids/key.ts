import type { KeyData } from "./contract.js";

type KeyTask =
  | { readonly kind: "value"; readonly value: unknown }
  | { readonly kind: "leave"; readonly value: object };

function dataField(value: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError("ids: a key field must be an own data property");
  }
  return descriptor.value;
}

export function encodeCanonicalNumber(value: number): string {
  return `F${Object.is(value, -0) ? "-0" : value === Infinity ? "+Infinity" : String(value)}:`;
}

export function encodeCanonicalKey(key: KeyData): string {
  const output: string[] = [];
  const active = new Set<object>();
  const tasks: KeyTask[] = [{ kind: "value", value: key }];
  for (let task = tasks.pop(); task !== undefined; task = tasks.pop()) {
    if (task.kind === "leave") {
      active.delete(task.value);
      continue;
    }
    const value = task.value;
    if (value === null) {
      output.push("N");
    } else if (typeof value === "boolean") {
      output.push(value ? "B1" : "B0");
    } else if (typeof value === "number") {
      output.push(encodeCanonicalNumber(value));
    } else if (typeof value === "bigint") {
      output.push(`I${value}:`);
    } else if (typeof value === "string") {
      output.push(`S${value.length}:${value}`);
    } else if (typeof value === "object") {
      if (active.has(value)) throw new TypeError("ids: cyclic key data");
      if (Object.getOwnPropertySymbols(value).length !== 0) {
        throw new TypeError("ids: key data cannot contain symbol fields");
      }
      active.add(value);
      tasks.push({ kind: "leave", value });
      if (Array.isArray(value)) {
        if (Object.getOwnPropertyNames(value).length !== value.length + 1) {
          throw new TypeError("ids: a key array must be dense with no extra fields");
        }
        output.push(`A${value.length}:`);
        for (let index = value.length - 1; index >= 0; index -= 1) {
          tasks.push({ kind: "value", value: dataField(value, String(index)) });
        }
      } else {
        const prototype: unknown = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          throw new TypeError("ids: a key record must be plain data");
        }
        const names = Object.getOwnPropertyNames(value).sort();
        output.push(`O${names.length}:`);
        for (const name of names.reverse()) {
          tasks.push({ kind: "value", value: dataField(value, name) });
          tasks.push({ kind: "value", value: name });
        }
      }
    } else {
      throw new TypeError("ids: unsupported key data");
    }
  }
  return output.join("");
}
