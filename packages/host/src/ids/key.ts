import type { KeyData, KeyRecord } from "./contract.js";

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

const isRecord = (value: object): value is KeyRecord => "kind" in value && value.kind === "record"
  && "fields" in value && Array.isArray(value.fields);

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
      active.add(value);
      tasks.push({ kind: "leave", value });
      if (Array.isArray(value)) {
        output.push(`A${value.length}:`);
        for (let index = value.length - 1; index >= 0; index -= 1) {
          const path: KeyPath = { parent: task.path, component: index };
          tasks.push({ kind: "value", value: value[index], path });
        }
      } else if (isRecord(value)) {
        const fields: (readonly [string, KeyData])[] = [];
        const names = new Set<string>();
        for (const field of value.fields) {
          if (!Array.isArray(field) || field.length !== 2 || typeof field[0] !== "string")
            throw keyError(task.path, "a key record requires complete named fields");
          if (names.has(field[0])) throw keyError(task.path, "a key record requires unique field names");
          names.add(field[0]);
          fields.push(field);
        }
        fields.sort(([left], [right]) => left < right ? -1 : 1);
        output.push(`O${fields.length}:`);
        for (const [name, child] of fields.reverse()) {
          const path: KeyPath = { parent: task.path, component: name };
          tasks.push({ kind: "value", value: child, path });
          tasks.push({ kind: "value", value: name, path });
        }
      } else throw keyError(task.path, "unsupported key data");
    } else {
      throw keyError(task.path, "unsupported key data");
    }
  }
  return output.join("");
}
