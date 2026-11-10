import type { TextRecord, TextValue } from "./parse.js";

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
      if (!Number.isFinite(value)) throw new Error("HIR text requires finite host numbers.");
      return Object.is(value, -0) ? "-0" : String(value);
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
