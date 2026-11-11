import type { KeyData } from "./contract.js";

interface KeyPath {
  readonly parent: KeyPath | null;
  readonly component: string | number;
}

type KeyTask =
  | { readonly kind: "value"; readonly value: unknown; readonly path: KeyPath | null }
  | { readonly kind: "leave"; readonly value: object };

function keyError(path: KeyPath | null, reason: string): TypeError {
  const components: string[] = [];
  for (let current = path; current !== null; current = current.parent) {
    components.push(typeof current.component === "number"
      ? `[${current.component}]` : `[${JSON.stringify(current.component)}]`);
  }
  return new TypeError(`ids: ${reason} at $root${components.reverse().join("")}`);
}

function dataField(value: object, name: string, path: KeyPath): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw keyError(path, "a key field must be an own data property");
  }
  if (descriptor.enumerable !== true) {
    throw keyError(path, "a key field must be enumerable");
  }
  return descriptor.value;
}

export function encodeCanonicalNumber(value: number): string {
  return `F${Object.is(value, -0) ? "-0" : value === Infinity ? "+Infinity" : String(value)}:`;
}

export function encodeCanonicalKey(key: KeyData): string {
  const output: string[] = [];
  const active = new Set<object>();
  const tasks: KeyTask[] = [{ kind: "value", value: key, path: null }];
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
      if (active.has(value)) throw keyError(task.path, "cyclic key data");
      if (Object.getOwnPropertySymbols(value).length !== 0) {
        throw keyError(task.path, "key data cannot contain symbol fields");
      }
      active.add(value);
      tasks.push({ kind: "leave", value });
      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) {
          throw keyError(task.path, "a key array must be plain data");
        }
        if (Object.getOwnPropertyNames(value).length !== value.length + 1) {
          throw keyError(task.path, "a key array must be dense with no extra fields");
        }
        output.push(`A${value.length}:`);
        for (let index = value.length - 1; index >= 0; index -= 1) {
          const path: KeyPath = { parent: task.path, component: index };
          tasks.push({ kind: "value", value: dataField(value, String(index), path), path });
        }
      } else {
        const prototype: unknown = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
          throw keyError(task.path, "a key record must be plain data");
        }
        const names = Object.getOwnPropertyNames(value).sort();
        output.push(`O${names.length}:`);
        for (const name of names.reverse()) {
          const path: KeyPath = { parent: task.path, component: name };
          tasks.push({ kind: "value", value: dataField(value, name, path), path });
          tasks.push({ kind: "value", value: name, path });
        }
      }
    } else {
      throw keyError(task.path, "unsupported key data");
    }
  }
  return output.join("");
}
