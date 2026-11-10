import type { TextParseResult } from "../diag/contract.js";
import type { ParseHir } from "./contract.js";
import type { HirSelectorFailure, HirShape, HirShapeVisit } from "./verify-syntax.js";
import { isHirModuleValue, resolveHirShape } from "./verify-syntax.js";
import { createHirSchema } from "./verify-captures.js";
import { hirSyntaxArena } from "./walk.js";

export interface TextScalar {
  readonly kind: "scalar";
  readonly offset: number;
  readonly value: string | number | bigint | boolean | null;
}

export interface TextIdentity {
  readonly kind: "identity";
  readonly offset: number;
  readonly prefix: string;
  readonly value: string | number;
}

export interface TextField {
  readonly name: string;
  readonly offset: number;
  readonly value: TextValue;
}

export interface TextRecord {
  readonly kind: "record";
  readonly binding: number | null;
  readonly bindingOffset: number;
  readonly offset: number;
  readonly end: number;
  readonly label: string;
  readonly fields: readonly TextField[];
}

export interface TextArray {
  readonly kind: "array";
  readonly offset: number;
  readonly end: number;
  readonly values: readonly TextValue[];
}

export type TextValue = TextScalar | TextIdentity | TextRecord | TextArray;

type InvalidText = TextParseResult<never> & { readonly kind: "invalid-text" };

interface TextReader {
  readonly text: string;
  cursor: number;
  failed: boolean;
  failure: InvalidText;
}

interface RecordFrame {
  readonly kind: "record";
  readonly binding: number | null;
  readonly bindingOffset: number;
  readonly offset: number;
  readonly label: string;
  readonly fields: TextField[];
  readonly names: Set<string>;
  phase: "first-field" | "field" | "equals" | "value" | "delimiter";
  name: string;
  nameOffset: number;
}

interface ArrayFrame {
  readonly kind: "array";
  readonly offset: number;
  readonly values: TextValue[];
  phase: "first-value" | "value" | "delimiter";
}

interface PendingFrame {
  readonly frame: RecordFrame | ArrayFrame;
  readonly next: PendingFrame | null;
}

function fail(reader: TextReader, expected: readonly string[], offset = reader.cursor): null {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (reader.text.charCodeAt(index) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  reader.failure = {
    kind: "invalid-text", offset, line, column, expected,
    found: offset === reader.text.length ? null : reader.text.slice(offset, offset + 1),
  };
  reader.failed = true;
  return null;
}

function whitespace(reader: TextReader): boolean {
  let newline = false;
  while (reader.cursor < reader.text.length) {
    const code = reader.text.charCodeAt(reader.cursor);
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) break;
    if (code === 10 || code === 13) newline = true;
    reader.cursor += 1;
  }
  return newline;
}

function word(reader: TextReader): string | null {
  const start = reader.cursor;
  if (!/[A-Za-z_]/u.test(reader.text.charAt(reader.cursor))) return fail(reader, ["identifier"]);
  reader.cursor += 1;
  while (/[A-Za-z0-9_-]/u.test(reader.text.charAt(reader.cursor))) reader.cursor += 1;
  return reader.text.slice(start, reader.cursor);
}

function quoted(reader: TextReader): string | null {
  reader.cursor += 1;
  const pieces: string[] = [];
  let start = reader.cursor;
  while (reader.cursor < reader.text.length) {
    const code = reader.text.charCodeAt(reader.cursor);
    if (code === 34) {
      pieces.push(reader.text.slice(start, reader.cursor));
      reader.cursor += 1;
      return pieces.join("");
    }
    if (code < 32) return fail(reader, ["JSON string character"]);
    if (code === 92) {
      pieces.push(reader.text.slice(start, reader.cursor));
      reader.cursor += 1;
      const escape = reader.text.charAt(reader.cursor);
      if (escape === "u") {
        const digits = reader.text.slice(reader.cursor + 1, reader.cursor + 5);
        if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) return fail(reader, ["four hexadecimal digits"], reader.cursor + 1);
        pieces.push(String.fromCharCode(Number.parseInt(digits, 16)));
        reader.cursor += 5;
      } else {
        switch (escape) {
          case "\"": pieces.push("\""); break;
          case "\\": pieces.push("\\"); break;
          case "/": pieces.push("/"); break;
          case "b": pieces.push("\b"); break;
          case "f": pieces.push("\f"); break;
          case "n": pieces.push("\n"); break;
          case "r": pieces.push("\r"); break;
          case "t": pieces.push("\t"); break;
          default: return fail(reader, ["JSON escape"]);
        }
        reader.cursor += 1;
      }
      start = reader.cursor;
    } else {
      reader.cursor += 1;
    }
  }
  return fail(reader, ["closing quote"]);
}

const specialNumbers: readonly string[] = Object.freeze(["NaN", "+Infinity", "-Infinity"]);

function numeric(reader: TextReader, offset: number): TextScalar | null {
  for (const token of specialNumbers) {
    if (reader.text.startsWith(token, reader.cursor)) {
      reader.cursor += token.length;
      return { kind: "scalar", offset, value: token === "NaN" ? Number.NaN : token === "+Infinity" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY };
    }
  }
  while (/[0-9eE+.-]/u.test(reader.text.charAt(reader.cursor))) reader.cursor += 1;
  if (reader.text.charAt(reader.cursor) === "n") {
    reader.cursor += 1;
    const digits = reader.text.slice(offset, reader.cursor - 1);
    if (!/^-?(?:0|[1-9][0-9]*)$/u.test(digits) || digits === "-0")
      return fail(reader, ["canonical bigint"], offset);
    return { kind: "scalar", offset, value: BigInt(digits) };
  }
  const digits = reader.text.slice(offset, reader.cursor);
  if (!/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/u.test(digits))
    return fail(reader, ["canonical finite number"], offset);
  const value = Number(digits);
  if (!Number.isFinite(value) || digits !== (Object.is(value, -0) ? "-0" : String(value)))
    return fail(reader, ["canonical finite number"], offset);
  return { kind: "scalar", offset, value };
}

function attach(frame: RecordFrame | ArrayFrame, value: TextValue): void {
  if (frame.kind === "array") frame.values.push(value);
  else frame.fields.push({ name: frame.name, offset: frame.nameOffset, value });
  frame.phase = "delimiter";
}

export function readHirText(text: string): TextParseResult<readonly [TextRecord, ...TextRecord[]]> {
  const reader: TextReader = { text, cursor: 0, failed: false,
    failure: { kind: "invalid-text", offset: 0, line: 1, column: 1, expected: ["record"],
      found: text.length === 0 ? null : text.slice(0, 1) } };
  const records: TextRecord[] = [];
  let pending: PendingFrame | null = null;
  let needSeparator = false;
  while (!reader.failed) {
    const newline = whitespace(reader);
    if (pending === null && reader.cursor === text.length) {
      const [first, ...rest] = records;
      if (first === undefined) fail(reader, ["record"]);
      else {
        const complete: readonly [TextRecord, ...TextRecord[]] = [first, ...rest];
        return { kind: "parsed", value: Object.freeze(complete) };
      }
      break;
    }
    if (pending === null && needSeparator && !newline) {
      fail(reader, ["newline"]);
      break;
    }
    const frame = pending?.frame;
    const character = text.charAt(reader.cursor);
    if (pending !== null && frame?.phase === "delimiter") {
      const closing = frame.kind === "record" ? ")" : "]";
      if (character === closing) {
        const value: TextRecord | TextArray = frame.kind === "record"
          ? { kind: "record", binding: frame.binding, bindingOffset: frame.bindingOffset,
            offset: frame.offset, end: reader.cursor, label: frame.label, fields: Object.freeze(frame.fields) }
          : { kind: "array", offset: frame.offset, end: reader.cursor, values: Object.freeze(frame.values) };
        reader.cursor += 1;
        pending = pending.next;
        if (pending === null) {
          if (value.kind !== "record") { fail(reader, ["record"], value.offset); break; }
          records.push(value);
          needSeparator = true;
        } else attach(pending.frame, value);
      } else if (character === ",") {
        reader.cursor += 1;
        frame.phase = frame.kind === "record" ? "field" : "value";
      } else fail(reader, [",", closing]);
      continue;
    }
    if (frame?.kind === "record" && (frame.phase === "first-field" || frame.phase === "field")) {
      if (frame.phase === "first-field" && character === ")") {
        frame.phase = "delimiter";
        continue;
      }
      frame.nameOffset = reader.cursor;
      const name = character === "\"" ? quoted(reader) : word(reader);
      if (name === null) break;
      if (frame.names.has(name)) { fail(reader, ["distinct field"], frame.nameOffset); break; }
      frame.names.add(name);
      frame.name = name;
      frame.phase = "equals";
      continue;
    }
    if (frame?.kind === "record" && frame.phase === "equals") {
      if (character !== "=") { fail(reader, ["="]); break; }
      reader.cursor += 1;
      frame.phase = "value";
      continue;
    }
    if (frame?.kind === "array" && frame.phase === "first-value" && character === "]") {
      frame.phase = "delimiter";
      continue;
    }
    let binding: number | null = null;
    const bindingOffset = reader.cursor;
    if (pending === null && text.startsWith("n:", reader.cursor)) {
      reader.cursor += 2;
      const numberOffset = reader.cursor;
      const position = numeric(reader, numberOffset);
      if (position === null) break;
      if (typeof position.value !== "number" || !Number.isSafeInteger(position.value) || position.value < 0 || Object.is(position.value, -0)) {
        fail(reader, ["nonnegative wire position"], numberOffset);
        break;
      }
      binding = position.value;
      whitespace(reader);
      if (text.charAt(reader.cursor) !== "=") { fail(reader, ["="]); break; }
      reader.cursor += 1;
      whitespace(reader);
    }
    const offset = reader.cursor;
    let value: TextValue | null = null;
    if (character === "[") {
      reader.cursor += 1;
      pending = { frame: { kind: "array", offset, values: [], phase: "first-value" }, next: pending };
      continue;
    }
    if (character === "\"") {
      const content = quoted(reader);
      if (content !== null) value = { kind: "scalar", offset, value: content };
    } else if (/[0-9+-]/u.test(character) || text.startsWith("NaN", reader.cursor)) {
      value = numeric(reader, offset);
    } else {
      const label = word(reader);
      if (label === null) break;
      if (label === "true" || label === "false" || label === "null") {
        value = { kind: "scalar", offset, value: label === "null" ? null : label === "true" };
      } else {
        whitespace(reader);
        if (text.charAt(reader.cursor) === "(") {
          reader.cursor += 1;
          pending = { frame: { kind: "record", binding, bindingOffset, offset, label, fields: [], names: new Set(),
            phase: "first-field", name: "", nameOffset: offset }, next: pending };
          continue;
        }
        if (text.charAt(reader.cursor) !== ":") { fail(reader, ["(", ":"]); break; }
        reader.cursor += 1;
        whitespace(reader);
        if (text.charAt(reader.cursor) === "\"") {
          const content = quoted(reader);
          if (content !== null) value = { kind: "identity", offset, prefix: label, value: content };
        } else {
          const start = reader.cursor;
          const content = numeric(reader, start);
          if (content !== null && typeof content.value === "number")
            value = { kind: "identity", offset, prefix: label, value: content.value };
          else if (!reader.failed) fail(reader, ["number identity"], start);
        }
      }
    }
    if (value === null) break;
    if (pending === null) { fail(reader, ["record"], offset); break; }
    attach(pending.frame, value);
  }
  return reader.failure;
}

interface MutableRecord { [field: string]: unknown }
interface DecodeTask {
  readonly wire: TextValue;
  readonly shape: HirShape;
  readonly target: MutableRecord | null;
  readonly put: (value: unknown) => void;
}

function invalidText(text: string, offset: number, expected: readonly string[]): InvalidText {
  let line = 1;
  let column = 1;
  for (let cursor = 0; cursor < offset; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) { line += 1; column = 1; }
    else column += 1;
  }
  return { kind: "invalid-text", offset, line, column, expected,
    found: offset === text.length ? null : text.slice(offset, offset + 1) };
}

function textView(wire: TextRecord): MutableRecord {
  const view: MutableRecord = { kind: wire.label };
  for (const field of wire.fields) {
    if (field.name === "kind") continue;
    const value = field.value;
    Object.defineProperty(view, field.name, { value: value.kind === "scalar" || value.kind === "identity" ? value.value : value,
      configurable: true, enumerable: true, writable: true });
  }
  return view;
}

export const parseHir: ParseHir = text => {
  const hirSchema = createHirSchema();
  const lexical = readHirText(text);
  if (lexical.kind === "invalid-text") return lexical;
  const [header, ...declarations] = lexical.value;
  if (header.binding !== null) return invalidText(text, header.bindingOffset, ["HirModule"]);
  const arena = new Map<number, MutableRecord>();
  const locations = new Map<object, Map<string | number, number>>();
  const containers: object[] = [];
  const pending: DecodeTask[] = [];
  let decoded: unknown;
  let failure: InvalidText | null = null;
  const reject = (offset: number, expected: readonly string[]): void => { failure = invalidText(text, offset, expected); };
  const schedule = (wire: TextValue, shape: HirShape, parent: MutableRecord | unknown[], field: string | number): void => {
    let positions = locations.get(parent);
    if (positions === undefined) { positions = new Map(); locations.set(parent, positions); }
    positions.set(field, wire.offset);
    pending.push({ wire, shape, target: null, put: value => {
      Object.defineProperty(parent, field, { value, configurable: true, enumerable: true, writable: true });
    } });
  };
  for (const wire of declarations) {
    const selected = resolveHirShape("SyntaxNode", { kind: wire.label }, hirSchema);
    if (selected === null) return invalidText(text, wire.offset, ["syntax node declaration"]);
    if (wire.binding === null) return invalidText(text, wire.offset, ["node wire binding"]);
    if (arena.has(wire.binding)) return invalidText(text, wire.bindingOffset, ["distinct wire binding"]);
    if (wire.binding !== arena.size) return invalidText(text, wire.bindingOffset, [`n:${arena.size}`]);
    const object: MutableRecord = { kind: wire.label };
    arena.set(wire.binding, object);
    pending.push({ wire, shape: "SyntaxNode", target: object, put: () => {} });
  }
  pending.push({ wire: header, shape: "HirModule", target: null, put: value => { decoded = value; } });
  for (const task of pending) {
    if (failure !== null) break;
    const wire = task.wire;
    if (wire.kind === "scalar") {
      const selected = resolveHirShape(task.shape, wire.value, hirSchema);
      if (selected !== null && selected.kind === "identity")
        reject(wire.offset, [`${selected.prefix}:identity`]);
      else task.put(wire.value);
      continue;
    }
    if (wire.kind === "identity") {
      const scalar = resolveHirShape(task.shape, wire.value, hirSchema);
      if (scalar !== null && scalar.kind === "identity" && scalar.prefix === wire.prefix) {
        task.put(wire.value);
      } else {
        const target = wire.prefix === "n" && typeof wire.value === "number" ? arena.get(wire.value) : undefined;
        const shape = target === undefined ? null : resolveHirShape(task.shape, target, hirSchema);
        if (shape !== null && shape.kind === "record" && shape.syntax) task.put(target);
        else reject(wire.offset, [typeof task.shape === "string" ? task.shape : "declared identity"]);
      }
      continue;
    }
    if (wire.kind === "array") {
      const shape = resolveHirShape(task.shape, [], hirSchema);
      if (shape === null || shape.kind !== "array") { reject(wire.offset, ["declared array"]); continue; }
      const values: unknown[] = [];
      containers.push(values);
      task.put(values);
      wire.values.forEach((element, ordinal) => schedule(element, shape.element, values, ordinal));
      continue;
    }
    const mismatch: { value: HirSelectorFailure | null } = { value: null };
    const shape = resolveHirShape(task.shape, textView(wire), hirSchema, value => { mismatch.value = value; });
    if (shape === null && mismatch.value !== null && mismatch.value.field !== "kind") {
      let ordinal = 0;
      for (const [name] of mismatch.value.fields) {
        if (name === "kind") continue;
        const field = wire.fields[ordinal];
        ordinal += 1;
        if (field === undefined) { reject(wire.end, [name]); break; }
        if (field.name !== name) { reject(field.offset, [name]); break; }
        if (name === mismatch.value.field) { reject(field.value.offset, ["declared field value"]); break; }
      }
      continue;
    }
    if (shape === null || (shape.kind !== "record" && shape.kind !== "dictionary") || shape.label !== wire.label) {
      reject(wire.offset, [typeof task.shape === "string" ? task.shape : "declared record"]);
      continue;
    }
    const object = task.target ?? {};
    containers.push(object);
    task.put(object);
    if (shape.kind === "dictionary") {
      for (const field of wire.fields) schedule(field.value, shape.element, object, field.name);
    } else {
      const fields = shape.fields.filter(([field]) => field !== "kind");
      if (shape.fields.some(([field]) => field === "kind")) object.kind = wire.label;
      let ordinal = 0;
      for (const [name, fieldShape] of fields) {
        const field = wire.fields[ordinal];
        ordinal += 1;
        if (field === undefined) { reject(wire.end, [name]); break; }
        if (field.name !== name) { reject(field.offset, [name]); break; }
        schedule(field.value, fieldShape, object, name);
      }
      for (const extra of wire.fields.slice(fields.length)) { reject(extra.offset, [")"]); break; }
    }
  }
  if (failure !== null) return failure;
  const fault = { offset: header.offset, expected: "HirModule" };
  const shapeFailure = (visit: HirShapeVisit): void => {
    fault.offset = visit.parent === null || visit.field === null ? header.offset : locations.get(visit.parent)?.get(visit.field) ?? header.offset;
    fault.expected = typeof visit.shape === "string" ? visit.shape : "declared field value";
  };
  if (!isHirModuleValue(decoded, hirSchema, shapeFailure)) return invalidText(text, fault.offset, [fault.expected]);
  const reachable = new Set<object>(hirSyntaxArena(decoded));
  for (const wire of declarations) {
    const object = wire.binding === null ? undefined : arena.get(wire.binding);
    if (object === undefined || !reachable.has(object)) return invalidText(text, wire.bindingOffset, ["referenced syntax declaration"]);
  }
  for (const container of containers) Object.freeze(container);
  return { kind: "parsed", value: decoded };
};
