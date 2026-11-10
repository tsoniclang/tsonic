import type { TextRecord, TextValue } from "./parse.js";
import type { HirModule, PrintHir } from "./contract.js";
import type { HirDataPath, HirSchema, HirShape } from "./verify-syntax.js";
import { hirDataPathText, isHirArray, isHirObject, resolveHirShape } from "./verify-syntax.js";
import { createHirSchema } from "./verify-captures.js";
import { hirSyntaxArena } from "./walk.js";

interface TextTask {
  readonly kind: "text";
  readonly text: string;
}

interface ValueTask {
  readonly kind: "value";
  readonly value: TextValue;
}

interface PendingText {
  readonly task: TextTask | ValueTask;
  readonly next: PendingText | null;
}

export function quoteHirText(value: string): string {
  const pieces: string[] = ["\""];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    let escape: string | null = null;
    switch (code) {
      case 34: escape = "\\\""; break;
      case 92: escape = "\\\\"; break;
      case 8: escape = "\\b"; break;
      case 12: escape = "\\f"; break;
      case 10: escape = "\\n"; break;
      case 13: escape = "\\r"; break;
      case 9: escape = "\\t"; break;
      default: {
        const unpairedHigh = code >= 0xd800 && code <= 0xdbff &&
          !(value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff);
        const unpairedLow = code >= 0xdc00 && code <= 0xdfff &&
          !(value.charCodeAt(index - 1) >= 0xd800 && value.charCodeAt(index - 1) <= 0xdbff);
        if (code < 32 || unpairedHigh || unpairedLow) escape = `\\u${code.toString(16).padStart(4, "0")}`;
      }
    }
    if (escape !== null) {
      pieces.push(value.slice(start, index), escape);
      start = index + 1;
    }
  }
  pieces.push(value.slice(start), "\"");
  return pieces.join("");
}

function scalarText(value: string | number | bigint | boolean | null): string {
  switch (typeof value) {
    case "string": return quoteHirText(value);
    case "number":
      return Object.is(value, -0) ? "-0" : value === Number.POSITIVE_INFINITY ? "+Infinity" : String(value);
    case "bigint": return `${value}n`;
    case "boolean": return value ? "true" : "false";
    default: return "null";
  }
}

function fieldName(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/u.test(value) ? value : quoteHirText(value);
}

export function printHirRecords(records: readonly TextRecord[]): string {
  const tasks: (TextTask | ValueTask)[] = [];
  for (const record of records) {
    if (tasks.length > 0) tasks.push({ kind: "text", text: "\n" });
    tasks.push({ kind: "value", value: record });
  }
  const pieces: string[] = [];
  let pending = tasks.reduceRight<PendingText | null>((next, task) => ({ task, next }), null);
  while (pending !== null) {
    const task = pending.task;
    pending = pending.next;
    if (task.kind === "text") {
      pieces.push(task.text);
      continue;
    }
    const value = task.value;
    switch (value.kind) {
      case "scalar":
        pieces.push(scalarText(value.value));
        break;
      case "identity":
        pieces.push(value.prefix, ":", typeof value.value === "string"
          ? quoteHirText(value.value) : scalarText(value.value));
        break;
      case "array": {
        pieces.push("[");
        const content: (TextTask | ValueTask)[] = [];
        for (const item of value.values) {
          if (content.length > 0) content.push({ kind: "text", text: ", " });
          content.push({ kind: "value", value: item });
        }
        content.push({ kind: "text", text: "]" });
        pending = content.reduceRight<PendingText | null>((next, item) => ({ task: item, next }), pending);
        break;
      }
      case "record": {
        if (value.binding !== null) pieces.push("n:", String(value.binding), "=");
        pieces.push(value.label, "(");
        const content: (TextTask | ValueTask)[] = [];
        for (const field of value.fields) {
          if (content.length > 0) content.push({ kind: "text", text: ", " });
          content.push({ kind: "text", text: `${fieldName(field.name)}=` }, { kind: "value", value: field.value });
        }
        content.push({ kind: "text", text: ")" });
        pending = content.reduceRight<PendingText | null>((next, item) => ({ task: item, next }), pending);
        break;
      }
    }
  }
  return pieces.join("");
}

interface EncodeValue {
  readonly kind: "value";
  readonly value: unknown;
  readonly shape: HirShape;
  readonly path: HirDataPath;
  readonly put: (value: TextValue) => void;
}

interface PendingEncode {
  readonly task: EncodeValue | { readonly kind: "leave"; readonly value: object };
  readonly next: PendingEncode | null;
}

function encodeHirRecord(value: unknown, expected: HirShape, bindings: ReadonlyMap<object, number>, binding: number | null, hirSchema: HirSchema): TextRecord {
  const shape = resolveHirShape(expected, value, hirSchema);
  if (shape === null || typeof shape === "string" || shape.kind !== "record" || !isHirObject(value))
    throw new Error("HIR text requires the declared record shape.");
  const fields: { name: string; offset: number; value: TextValue }[] = [];
  const root: TextRecord = { kind: "record", binding, bindingOffset: 0, offset: 0, end: 0, label: shape.label, fields };
  let pending = shape.fields.reduceRight<PendingEncode | null>((next, [field, fieldShape]) => field === "kind" ? next : ({
    task: { kind: "value", value: value[field], shape: fieldShape, path: { parent: null, field },
      put: wire => { fields.push({ name: field, offset: 0, value: wire }); } }, next,
  }), null);
  const onPath = new Set<object>([value]);
  while (pending !== null) {
    const task = pending.task;
    pending = pending.next;
    if (task.kind === "leave") {
      onPath.delete(task.value);
      continue;
    }
    const selected = resolveHirShape(task.shape, task.value, hirSchema);
    if (selected === null) throw new Error("HIR text requires the declared field shape.");
    const data = task.value;
    if (typeof selected !== "string" && selected.kind === "record" && selected.syntax && isHirObject(data)) {
      const position = bindings.get(data);
      if (position === undefined) throw new Error("HIR syntax object requires its traversal-position wire binding.");
      task.put({ kind: "identity", offset: 0, prefix: "n", value: position });
      continue;
    }
    if (data !== null && typeof data === "object") {
      if (onPath.has(data)) throw new TypeError(`Inline value cycle at ${hirDataPathText(task.path)}`);
      onPath.add(data);
      pending = { task: { kind: "leave", value: data }, next: pending };
    }
    if (typeof selected === "string" || selected.kind === "literal") {
      if (data === null || typeof data === "string" || typeof data === "number" || typeof data === "bigint" || typeof data === "boolean")
        task.put({ kind: "scalar", offset: 0, value: data });
    } else if (selected.kind === "identity") {
      if (typeof data === "string" || typeof data === "number")
        task.put({ kind: "identity", offset: 0, prefix: selected.prefix, value: data });
    } else if (selected.kind === "array" && isHirArray(data)) {
      const values: TextValue[] = [];
      task.put({ kind: "array", offset: 0, end: 0, values });
      pending = data.reduceRight<PendingEncode | null>((next, element, ordinal) => ({
        task: { kind: "value", value: element, shape: selected.element, path: { parent: task.path, field: ordinal },
          put: wire => { values.push(wire); } }, next,
      }), pending);
    } else if (selected.kind === "record" && isHirObject(data)) {
      const content: { name: string; offset: number; value: TextValue }[] = [];
      task.put({ kind: "record", binding: null, bindingOffset: 0, offset: 0, end: 0, label: selected.label, fields: content });
      pending = selected.fields.reduceRight<PendingEncode | null>((next, [field, fieldShape]) => field === "kind" ? next : ({
        task: { kind: "value", value: data[field], shape: fieldShape, path: { parent: task.path, field },
          put: wire => { content.push({ name: field, offset: 0, value: wire }); } }, next,
      }), pending);
    } else if (selected.kind === "dictionary" && isHirObject(data)) {
      const content: { name: string; offset: number; value: TextValue }[] = [];
      task.put({ kind: "record", binding: null, bindingOffset: 0, offset: 0, end: 0, label: selected.label, fields: content });
      pending = Object.keys(data).reduceRight<PendingEncode | null>((next, field) => ({
        task: { kind: "value", value: data[field], shape: selected.element, path: { parent: task.path, field },
          put: wire => { content.push({ name: field, offset: 0, value: wire }); } }, next,
      }), pending);
    }
  }
  return root;
}

export const printHir: PrintHir = (module: HirModule): string => {
  const hirSchema = createHirSchema();
  const arena = hirSyntaxArena(module);
  const bindings = new Map<object, number>();
  arena.forEach((node, ordinal) => { bindings.set(node, ordinal); });
  const records: TextRecord[] = [encodeHirRecord(module, "HirModule", bindings, null, hirSchema)];
  arena.forEach((node, ordinal) => { records.push(encodeHirRecord(node, "SyntaxNode", bindings, ordinal, hirSchema)); });
  return printHirRecords(records);
};
