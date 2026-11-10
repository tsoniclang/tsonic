import type { TextParseResult } from "../diag/contract.js";

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
  readonly offset: number;
  readonly label: string;
  readonly fields: readonly TextField[];
}

export interface TextArray {
  readonly kind: "array";
  readonly offset: number;
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

function numeric(reader: TextReader, offset: number): TextScalar | null {
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

export function readHirText(text: string): TextParseResult<readonly TextRecord[]> {
  const reader: TextReader = { text, cursor: 0, failed: false,
    failure: { kind: "invalid-text", offset: 0, line: 1, column: 1, expected: ["record"],
      found: text.length === 0 ? null : text.slice(0, 1) } };
  const records: TextRecord[] = [];
  let pending: PendingFrame | null = null;
  let needSeparator = false;
  while (!reader.failed) {
    const newline = whitespace(reader);
    if (pending === null && reader.cursor === text.length) {
      if (records.length === 0) fail(reader, ["record"]);
      else return { kind: "parsed", value: Object.freeze(records) };
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
          ? { kind: "record", offset: frame.offset, label: frame.label, fields: Object.freeze(frame.fields) }
          : { kind: "array", offset: frame.offset, values: Object.freeze(frame.values) };
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
    } else if (/[0-9-]/u.test(character)) {
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
          pending = { frame: { kind: "record", offset, label, fields: [], names: new Set(),
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
          if (content !== null && typeof content.value === "number" && Number.isInteger(content.value))
            value = { kind: "identity", offset, prefix: label, value: content.value };
          else if (!reader.failed) fail(reader, ["integer identity"], start);
        }
      }
    }
    if (value === null) break;
    if (pending === null) { fail(reader, ["record"], offset); break; }
    attach(pending.frame, value);
  }
  return reader.failure;
}
