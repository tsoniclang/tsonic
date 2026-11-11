import type { TextIdentity, TextRecord, TextValue } from "./parse.js";
import type { HirNode, PrintHir } from "./contract.js";
import type { HirDataPath, HirDataWork, HirRecordWork } from "./walk.js";
import { hirChildPath, hirDataPathText } from "./walk.js";
import { hirModuleData, hirNodeData } from "./text-data.js";
import { syntaxChildEdges } from "./children.js";

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
  if (value === null) return "null";
  switch (typeof value) {
    case "string": return quoteHirText(value);
    case "number":
      return Object.is(value, -0) ? "-0" : value === Number.POSITIVE_INFINITY ? "+Infinity" : String(value);
    case "bigint": return `${value}n`;
    case "boolean": return value ? "true" : "false";
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
  readonly work: HirDataWork;
  readonly path: HirDataPath;
  readonly put: (value: TextValue) => void;
}

interface PendingEncode {
  readonly task: EncodeValue | { readonly kind: "leave"; readonly owner: object };
  readonly next: PendingEncode | null;
}

interface SyntaxBinding {
  readonly node: HirNode;
  readonly ordinal: number;
}

type PendingSyntax = (
  | { readonly kind: "enter"; readonly node: HirNode; readonly path: HirDataPath }
  | { readonly kind: "leave"; readonly node: HirNode }
) & { readonly next: PendingSyntax | null };

function encodeHirRecord(work: HirRecordWork, bind: (node: HirNode, path: HirDataPath) => TextIdentity, binding: number | null): TextRecord {
  const view = work.read();
  const fields: { name: string; offset: number; value: TextValue }[] = [];
  const root: TextRecord = { kind: "record", binding, bindingOffset: 0, offset: 0, end: 0, label: view.label, fields };
  let pending = view.fields.reduceRight<PendingEncode | null>((next, field) => ({
    task: { kind: "value", work: field.work, path: { parent: null, field: field.name },
      put: wire => { fields.push({ name: field.name, offset: 0, value: wire }); } }, next,
  }), null);
  const onPath = new Set<object>([view.owner]);
  while (pending !== null) {
    const task = pending.task;
    pending = pending.next;
    if (task.kind === "leave") { onPath.delete(task.owner); continue; }
    const data = task.work.read();
    switch (data.kind) {
      case "scalar": task.put({ kind: "scalar", offset: 0, value: data.value }); break;
      case "identity": task.put({ kind: "identity", offset: 0, prefix: data.prefix, value: data.value }); break;
      case "array":
      case "record": {
        if (data.kind === "record" && data.syntax !== null) { task.put(bind(data.syntax, task.path)); break; }
        if (onPath.has(data.owner)) throw new TypeError(`Inline value cycle at ${hirDataPathText(task.path)}`);
        onPath.add(data.owner);
        pending = { task: { kind: "leave", owner: data.owner }, next: pending };
        if (data.kind === "array") {
          const values: TextValue[] = [];
          task.put({ kind: "array", offset: 0, end: 0, values });
          pending = data.value.reduceRight<PendingEncode | null>((next, element, ordinal) => ({
            task: { kind: "value", work: element, path: { parent: task.path, field: ordinal },
              put: wire => { values.push(wire); } }, next,
          }), pending);
        } else {
          const content: { name: string; offset: number; value: TextValue }[] = [];
          task.put({ kind: "record", binding: null, bindingOffset: 0, offset: 0, end: 0, label: data.label, fields: content });
          pending = data.fields.reduceRight<PendingEncode | null>((next, field) => ({
            task: { kind: "value", work: field.work, path: { parent: task.path, field: field.name },
              put: wire => { content.push({ name: field.name, offset: 0, value: wire }); } }, next,
          }), pending);
        }
      }
    }
  }
  return root;
}

export const printHir: PrintHir = module => {
  const bindings = new Map<HirNode, TextIdentity>();
  const arena: SyntaxBinding[] = [];
  const bind = (node: HirNode, path: HirDataPath): TextIdentity => {
    const previous = bindings.get(node);
    if (previous !== undefined) return previous;
    const root: TextIdentity = { kind: "identity", offset: 0, prefix: "n", value: arena.length };
    const active = new Set<HirNode>();
    let pending: PendingSyntax | null = { kind: "enter", node, path, next: null };
    while (pending !== null) {
      const frame = pending;
      pending = frame.next;
      if (frame.kind === "leave") { active.delete(frame.node); continue; }
      if (active.has(frame.node)) throw new TypeError(`Syntax child cycle at ${hirDataPathText(frame.path)}`);
      if (bindings.has(frame.node)) continue;
      const ordinal = arena.length;
      bindings.set(frame.node, { kind: "identity", offset: 0, prefix: "n", value: ordinal });
      active.add(frame.node);
      arena.push({ node: frame.node, ordinal });
      pending = syntaxChildEdges(frame.node).reduceRight<PendingSyntax | null>((next, child) => ({
        kind: "enter", node: child.node, path: hirChildPath(frame.path, child.fields), next,
      }), { kind: "leave", node: frame.node, next: pending });
    }
    return root;
  };
  const records: TextRecord[] = [encodeHirRecord(hirModuleData(module), bind, null)];
  for (const entry of arena) records.push(encodeHirRecord(hirNodeData(entry.node), bind, entry.ordinal));
  return printHirRecords(records);
};
