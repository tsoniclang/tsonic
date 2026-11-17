import type { Staged, DataReference } from "./text-data.js";
import type { TextRoot } from "./text-decisions.js";
import { numberText } from "./text-data.js";
import { createTextSchemas } from "./text-decisions.js";

export function enumValue(values: readonly (string | number)[], value: unknown): boolean {
  return values.some(choice => Object.is(choice, value));
}

interface InlinePath {
  readonly parent: InlinePath | null;
  readonly segment: string | number;
}

type Writer = (text: string) => void;

type WalkTask =
  | { readonly kind: "value"; readonly value: Staged; readonly path: InlinePath | null }
  | { readonly kind: "leave"; readonly value: object }
  | { readonly kind: "text"; readonly value: string; readonly write: Writer };

function pathText(path: InlinePath | null, root: string): string {
  const parts: string[] = [];
  for (let current = path; current !== null; current = current.parent)
    parts.push(typeof current.segment === "number" ? `[${current.segment}]` : `.${current.segment}`);
  return root + parts.reverse().join("");
}

function enterInline(value: object, path: InlinePath | null, active: Set<object>, root: string): void {
  if (active.has(value)) throw new TypeError(`Inline cycle at ${pathText(path, root)}.`);
  active.add(value);
}

function walk(input: TextRoot, stage: (input: TextRoot) => Staged, visit: ((reference: DataReference) => void) | null,
  write: Writer | null, root: string): void {
  const active = new Set<object>();
  const pending: WalkTask[] = [{ kind: "value", value: stage(input), path: null }];
  for (let task = pending.pop(); task !== undefined; task = pending.pop()) {
    if (task.kind === "text") { task.write(task.value); continue; }
    if (task.kind === "leave") { active.delete(task.value); continue; }
    const value = task.value;
    if (value.kind !== "array" && value.reference !== null && visit !== null) visit(value.reference);
    switch (value.kind) {
      case "scalar":
        if (write !== null) write(value.prefix + (typeof value.value === "number" ? numberText(value.value)
          : typeof value.value === "bigint" ? `${value.value}n` : JSON.stringify(value.value)));
        break;
      case "array":
        enterInline(value.source, task.path, active, root);
        pending.push({ kind: "leave", value: value.source });
        if (write !== null) { write("["); pending.push({ kind: "text", value: "]", write }); }
        for (let index = value.length - 1; index >= 0; index -= 1) {
          const path = { parent: task.path, segment: index };
          const child = value.read(index);
          if (child === undefined) throw new TypeError(`Missing inline value at ${pathText(path, root)}.`);
          pending.push({ kind: "value", value: child, path });
          if (write !== null && index > 0) pending.push({ kind: "text", value: ", ", write });
        }
        break;
      case "record":
        enterInline(value.source, task.path, active, root);
        pending.push({ kind: "leave", value: value.source });
        if (write !== null) { write(`${value.label}(`); pending.push({ kind: "text", value: ")", write }); }
        for (const [index, field] of [...value.fields().entries()].reverse()) {
          pending.push({ kind: "value", value: field.value, path: { parent: task.path, segment: field.name } });
          if (write !== null) pending.push({ kind: "text", value: `${index > 0 ? ", " : ""}${field.name}=`, write });
        }
        break;
    }
  }
}

export function printDocument(input: TextRoot, root: string = "$"): string {
  const fragments: string[] = [];
  walk(input, createTextSchemas().stageRoot, null, text => fragments.push(text), root);
  return fragments.join("");
}

export type DataVisitor = (input: TextRoot, visit: (reference: DataReference) => void, root: string) => void;

export function createDataVisitor(): DataVisitor {
  const stage = createTextSchemas().stageRoot;
  return (input, visit, root) => walk(input, stage, visit, null, root);
}
