import type { TextParseResult, HostDiagnosticCode } from "../diag/contract.js";
import type { BodyId, DefId, ExpansionId, LocalId, ModuleId, NodeId, PackageId, SigId, TyId } from "../ids/contract.js";
import { decodeBodyId, decodeDefId, decodeModuleId, decodePackageId, encodeBodyId, encodeDefId, encodeModuleId, encodePackageId } from "../ids/index.js";

export interface IdentityReaders {
  readonly type: (value: number) => TyId;
  readonly signature: (value: number) => SigId;
  readonly node: (value: number) => NodeId;
  readonly local: (value: number) => LocalId;
  readonly expansion: (value: string) => ExpansionId;
  readonly hostCode: (value: string) => HostDiagnosticCode;
}

export interface Cursor {
  readonly text: string;
  readonly identities: IdentityReaders;
  offset: number;
}

export interface LexicalFault {
  readonly offset: number;
  readonly expected: readonly string[];
}

export interface DecodedName {
  readonly value: string;
  readonly positions: readonly number[];
  readonly end: number;
  readonly fault: LexicalFault | null;
}

export type TextFault = TextParseResult<never> & { readonly kind: "invalid-text" };

export function invalid(cursor: Cursor, offset: number, expected: readonly string[]): TextFault {
  let line = 1;
  let column = 1;
  for (let position = 0; position < offset; position += 1) {
    if (cursor.text[position] === "\r") {
      line += 1;
      column = 1;
      if (position + 1 < offset && cursor.text[position + 1] === "\n") position += 1;
    } else if (cursor.text[position] === "\n") { line += 1; column = 1; }
    else column += 1;
  }
  return { kind: "invalid-text", offset, line, column, expected, found: cursor.text[offset] ?? null };
}

export function whitespace(cursor: Cursor): void {
  while (cursor.offset < cursor.text.length) {
    const code = cursor.text.charCodeAt(cursor.offset);
    if (code !== 9 && code !== 10 && code !== 13 && code !== 32) break;
    cursor.offset += 1;
  }
}

export function delimiter(cursor: Cursor, expected: string): TextParseResult<null> {
  whitespace(cursor);
  if (!cursor.text.startsWith(expected, cursor.offset)) return invalid(cursor, cursor.offset, [expected]);
  cursor.offset += expected.length;
  return { kind: "parsed", value: null };
}

export function nameStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36;
}

export function namePart(code: number): boolean {
  return nameStart(code) || (code >= 48 && code <= 57);
}

export function hexadecimal(code: number): number {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 70) return code - 55;
  if (code >= 97 && code <= 102) return code - 87;
  return -1;
}

export function quoted(cursor: Cursor): DecodedName {
  const characters: string[] = [];
  const positions: number[] = [];
  cursor.offset += 1;
  while (cursor.offset < cursor.text.length) {
    const start = cursor.offset;
    const code = cursor.text.charCodeAt(cursor.offset);
    if (code === 34) {
      cursor.offset += 1;
      return { value: characters.join(""), positions, end: start, fault: null };
    }
    if (code < 32) {
      return { value: characters.join(""), positions, end: start, fault: { offset: start, expected: ["JSON string character"] } };
    }
    if (code !== 92) {
      characters.push(cursor.text.charAt(cursor.offset));
      positions.push(start);
      cursor.offset += 1;
      continue;
    }
    cursor.offset += 1;
    const escaped = cursor.text.charAt(cursor.offset);
    cursor.offset += 1;
    switch (escaped) {
      case '"': characters.push('"'); break;
      case "\\": characters.push("\\"); break;
      case "/": characters.push("/"); break;
      case "b": characters.push("\b"); break;
      case "f": characters.push("\f"); break;
      case "n": characters.push("\n"); break;
      case "r": characters.push("\r"); break;
      case "t": characters.push("\t"); break;
      case "u": {
        let decoded = 0;
        for (let digit = 0; digit < 4; digit += 1) {
          const value = hexadecimal(cursor.text.charCodeAt(cursor.offset));
          if (value < 0) {
            return { value: characters.join(""), positions, end: start, fault: { offset: cursor.offset, expected: ["hexadecimal digit"] } };
          }
          decoded = decoded * 16 + value;
          cursor.offset += 1;
        }
        characters.push(String.fromCharCode(decoded));
        break;
      }
      default:
        return { value: characters.join(""), positions, end: start, fault: { offset: start, expected: ["JSON escape"] } };
    }
    positions.push(start);
  }
  return { value: characters.join(""), positions, end: cursor.text.length, fault: { offset: cursor.text.length, expected: ['"'] } };
}

export function readString(cursor: Cursor): TextParseResult<string> {
  whitespace(cursor);
  if (cursor.text[cursor.offset] !== '"') return invalid(cursor, cursor.offset, ["string"]);
  const decoded = quoted(cursor);
  return decoded.fault === null ? { kind: "parsed", value: decoded.value }
    : invalid(cursor, decoded.fault.offset, decoded.fault.expected);
}

export function fieldChoice<const Choice extends string>(
  cursor: Cursor,
  required: readonly Choice[],
  given: ReadonlySet<string>,
): TextParseResult<Choice> {
  whitespace(cursor);
  const start = cursor.offset;
  const expected = required.length === 0 ? ["end of record"] : required;
  let decoded: DecodedName;
  if (cursor.text[start] === '"') decoded = quoted(cursor);
  else {
    if (!nameStart(cursor.text.charCodeAt(start))) return invalid(cursor, start, expected);
    const positions: number[] = [];
    while (namePart(cursor.text.charCodeAt(cursor.offset))) { positions.push(cursor.offset); cursor.offset += 1; }
    decoded = { value: cursor.text.substring(start, cursor.offset), positions, end: cursor.offset, fault: null };
  }
  let common = 0;
  let matched: Choice | undefined;
  for (const candidate of required) {
    let prefix = 0;
    while (prefix < decoded.value.length && prefix < candidate.length && decoded.value[prefix] === candidate[prefix]) prefix += 1;
    if (prefix > common) common = prefix;
    if (prefix === candidate.length && prefix === decoded.value.length) matched = candidate;
  }
  const deviation = decoded.positions[common] ?? decoded.end;
  const decodedDeviation = common < decoded.value.length;
  if (decoded.fault !== null && (!decodedDeviation || decoded.fault.offset <= deviation)) {
    return invalid(cursor, decoded.fault.offset, decoded.fault.expected);
  }
  if (matched === undefined) {
    return invalid(cursor, deviation, decoded.fault === null && given.has(decoded.value) ? ["unique record field"] : expected);
  }
  const equals = delimiter(cursor, "=");
  return equals.kind === "invalid-text" ? equals : { kind: "parsed", value: matched };
}

export function unsignedDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

export function scalarEnd(cursor: Cursor): number {
  let end = cursor.offset;
  while (end < cursor.text.length) {
    const code = cursor.text.charCodeAt(end);
    if (code === 9 || code === 10 || code === 13 || code === 32 || code === 44 || code === 41 || code === 61 || code === 93) break;
    end += 1;
  }
  return end;
}

export function readNumber(cursor: Cursor): TextParseResult<number> {
  whitespace(cursor);
  const start = cursor.offset;
  const end = scalarEnd(cursor);
  const token = cursor.text.substring(start, end);
  let value: number;
  switch (token) {
    case "-0": value = -0; break;
    case "NaN": value = NaN; break;
    case "+Infinity": value = Infinity; break;
    case "-Infinity": value = -Infinity; break;
    default: {
      value = Number(token);
      if (token.length === 0 || !Number.isFinite(value) || String(value) !== token) return invalid(cursor, start, ["number"]);
    }
  }
  cursor.offset = end;
  return { kind: "parsed", value };
}

export function readBigInt(cursor: Cursor): TextParseResult<bigint> {
  whitespace(cursor);
  const start = cursor.offset;
  let digit = start;
  if (cursor.text[digit] === "-") digit += 1;
  const first = digit;
  while (unsignedDigit(cursor.text.charCodeAt(digit))) digit += 1;
  if (digit === first || cursor.text[digit] !== "n" || (cursor.text[first] === "0" && digit !== first + 1)
    || (cursor.text[start] === "-" && cursor.text[first] === "0")) return invalid(cursor, start, ["bigint"]);
  const value = BigInt(cursor.text.substring(start, digit));
  cursor.offset = digit + 1;
  return { kind: "parsed", value };
}

export function choice<const Choice extends string>(cursor: Cursor, choices: readonly Choice[]): TextParseResult<Choice> {
  whitespace(cursor);
  const start = cursor.offset;
  let end = start;
  while (namePart(cursor.text.charCodeAt(end)) || cursor.text[end] === "-") end += 1;
  const token = cursor.text.substring(start, end);
  for (const candidate of choices) {
    if (token === candidate) { cursor.offset = end; return { kind: "parsed", value: candidate }; }
  }
  return invalid(cursor, start, choices);
}

export function readBoolean(cursor: Cursor): TextParseResult<boolean> {
  const result = choice(cursor, ["true", "false"]);
  return result.kind === "invalid-text" ? result : { kind: "parsed", value: result.value === "true" };
}

export function readNull(cursor: Cursor): TextParseResult<null> {
  const result = choice(cursor, ["null"]);
  return result.kind === "invalid-text" ? result : { kind: "parsed", value: null };
}

export function readStringChoice<const Choice extends string>(cursor: Cursor, choices: readonly Choice[]): TextParseResult<Choice> {
  whitespace(cursor);
  const start = cursor.offset;
  const value = readString(cursor);
  if (value.kind === "invalid-text") return value;
  for (const candidate of choices) {
    if (candidate === value.value) return { kind: "parsed", value: candidate };
  }
  return invalid(cursor, start, choices.map(candidate => JSON.stringify(candidate)));
}

export function readSignatureId(cursor: Cursor): TextParseResult<SigId> {
  return readNumericId(cursor, "sig", cursor.identities.signature);
}

export function readNumberChoice<const Choice extends number>(cursor: Cursor, choices: readonly Choice[]): TextParseResult<Choice> {
  whitespace(cursor);
  const start = cursor.offset;
  const value = readNumber(cursor);
  if (value.kind === "invalid-text") return value;
  for (const candidate of choices) {
    if (Object.is(candidate, value.value)) return { kind: "parsed", value: candidate };
  }
  return invalid(cursor, start, choices.map(candidate => String(candidate)));
}

export function readExpansionId(cursor: Cursor): TextParseResult<ExpansionId> {
  const start = delimiter(cursor, "exp:");
  if (start.kind === "invalid-text") return start;
  const value = readString(cursor);
  return value.kind === "invalid-text" ? value : { kind: "parsed", value: cursor.identities.expansion(value.value) };
}

export function readHostCode(cursor: Cursor): TextParseResult<HostDiagnosticCode> {
  const value = readString(cursor);
  return value.kind === "invalid-text" ? value : { kind: "parsed", value: cursor.identities.hostCode(value.value) };
}

export function readChild<Value>(
  cursor: Cursor, parse: (text: string) => TextParseResult<Value>,
): TextParseResult<Value> {
  whitespace(cursor);
  const start = cursor.offset;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let opened = false;
  while (cursor.offset < cursor.text.length) {
    const character = cursor.text[cursor.offset];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === "(" || character === "[") { opened = true; depth += 1; }
    else if (character === ")" || character === "]") {
      if (depth === 0) break;
      depth -= 1;
      if (depth === 0) { cursor.offset += 1; break; }
    } else if (!opened && character === ",") break;
    cursor.offset += 1;
  }
  const result = parse(cursor.text.substring(start, cursor.offset));
  return result.kind === "parsed" ? result : invalid(cursor, start + result.offset, result.expected);
}

export function readArray<Value>(cursor: Cursor, element: (cursor: Cursor) => TextParseResult<Value>): TextParseResult<readonly Value[]> {
  const start = delimiter(cursor, "[");
  if (start.kind === "invalid-text") return start;
  const values: Value[] = [];
  whitespace(cursor);
  if (cursor.text[cursor.offset] === "]") { cursor.offset += 1; return { kind: "parsed", value: values }; }
  while (true) {
    const value = element(cursor);
    if (value.kind === "invalid-text") return value;
    values.push(value.value);
    whitespace(cursor);
    if (cursor.text[cursor.offset] === "]") { cursor.offset += 1; return { kind: "parsed", value: values }; }
    const comma = delimiter(cursor, ",");
    if (comma.kind === "invalid-text") return comma;
  }
}

export function nullable<Value>(cursor: Cursor, present: (cursor: Cursor) => TextParseResult<Value>): TextParseResult<Value | null> {
  whitespace(cursor);
  if (cursor.text.substring(cursor.offset, scalarEnd(cursor)) === "null") { cursor.offset += 4; return { kind: "parsed", value: null }; }
  return present(cursor);
}

export interface RecordFields {
  readonly given: Set<string>;
}

export function openRecord(cursor: Cursor, label: string): TextParseResult<RecordFields> {
  const name = choice(cursor, [label]);
  if (name.kind === "invalid-text") return name;
  const open = delimiter(cursor, "(");
  return open.kind === "invalid-text" ? open : { kind: "parsed", value: { given: new Set<string>() } };
}

export function readField<Value>(
  cursor: Cursor,
  fields: RecordFields,
  name: string,
  decode: (cursor: Cursor) => TextParseResult<Value>,
): TextParseResult<Value> {
  const start = startField(cursor, fields, name);
  return start.kind === "invalid-text" ? start : decode(cursor);
}

export function startField(cursor: Cursor, fields: RecordFields, name: string): TextParseResult<null> {
  const result = startFieldChoice(cursor, fields, [name]);
  return result.kind === "invalid-text" ? result : { kind: "parsed", value: null };
}

export function startFieldChoice<const Choice extends string>(cursor: Cursor, fields: RecordFields, names: readonly Choice[]): TextParseResult<Choice> {
  if (fields.given.size !== 0) {
    const comma = delimiter(cursor, ",");
    if (comma.kind === "invalid-text") return comma;
  }
  const key = fieldChoice(cursor, names, fields.given);
  if (key.kind === "invalid-text") return key;
  fields.given.add(key.value);
  return key;
}

export function closeRecord(cursor: Cursor, fields: RecordFields): TextParseResult<null> {
  whitespace(cursor);
  if (cursor.text[cursor.offset] === ")") { cursor.offset += 1; return { kind: "parsed", value: null }; }
  if (cursor.text[cursor.offset] === ",") {
    cursor.offset += 1;
    return fieldChoice<never>(cursor, [], fields.given);
  }
  return invalid(cursor, cursor.offset, [")"]);
}

export function readIdentity<Value>(
  cursor: Cursor,
  prefix: string,
  decode: (text: string) => { readonly kind: "decoded"; readonly value: Value } | { readonly kind: "invalid"; readonly offset: number },
): TextParseResult<Value> {
  const start = delimiter(cursor, prefix + ":");
  if (start.kind === "invalid-text") return start;
  whitespace(cursor);
  if (cursor.text[cursor.offset] !== '"') return invalid(cursor, cursor.offset, ["string"]);
  const text = quoted(cursor);
  if (text.fault !== null) return invalid(cursor, text.fault.offset, text.fault.expected);
  const identity = decode(text.value);
  return identity.kind === "decoded" ? { kind: "parsed", value: identity.value }
    : invalid(cursor, text.positions[identity.offset] ?? text.end, [prefix + " identity"]);
}

export function readPackageId(cursor: Cursor): TextParseResult<PackageId> {
  return readIdentity(cursor, "pkg", text => {
    const decoded = decodePackageId(text);
    return decoded.kind === "decoded" ? { kind: "decoded", value: encodePackageId(decoded.value) } : decoded;
  });
}

export function readModuleId(cursor: Cursor): TextParseResult<ModuleId> {
  return readIdentity(cursor, "mod", text => {
    const decoded = decodeModuleId(text);
    return decoded.kind === "decoded" ? { kind: "decoded", value: encodeModuleId(decoded.value) } : decoded;
  });
}

export function readDefinitionId(cursor: Cursor): TextParseResult<DefId> {
  return readIdentity(cursor, "def", text => {
    const decoded = decodeDefId(text);
    return decoded.kind === "decoded" ? { kind: "decoded", value: encodeDefId(decoded.value) } : decoded;
  });
}

export function readBodyId(cursor: Cursor): TextParseResult<BodyId> {
  return readIdentity(cursor, "body", text => {
    const decoded = decodeBodyId(text);
    return decoded.kind === "decoded" ? { kind: "decoded", value: encodeBodyId(decoded.value) } : decoded;
  });
}

export function readNumericId<Value extends number>(cursor: Cursor, prefix: string, make: (value: number) => Value): TextParseResult<Value> {
  const start = delimiter(cursor, prefix + ":");
  if (start.kind === "invalid-text") return start;
  const value = readNumber(cursor);
  return value.kind === "invalid-text" ? value : { kind: "parsed", value: make(value.value) };
}

export function readTypeId(cursor: Cursor): TextParseResult<TyId> {
  return readNumericId(cursor, "t", cursor.identities.type);
}

export function readNodeId(cursor: Cursor): TextParseResult<NodeId> {
  return readNumericId(cursor, "n", cursor.identities.node);
}

export function readLocalId(cursor: Cursor): TextParseResult<LocalId> {
  return readNumericId(cursor, "l", cursor.identities.local);
}

export type TextStep<Root> =
  | { readonly kind: "step"; readonly run: () => TextStep<Root> }
  | { readonly kind: "complete"; readonly result: TextParseResult<Root> };

export type TextReader<Value> = <Root>(
  cursor: Cursor, finish: (value: Value) => TextStep<Root>,
) => TextStep<Root>;

export function acceptText<Value, Root>(value: Value, finish: (value: Value) => TextStep<Root>): TextStep<Root> {
  return { kind: "step", run: () => finish(value) };
}

export function atomicText<Value, Root>(
  cursor: Cursor, decode: (cursor: Cursor) => TextParseResult<Value>,
  finish: (value: Value) => TextStep<Root>,
): TextStep<Root> {
  const value = decode(cursor);
  return value.kind === "invalid-text" ? { kind: "complete", result: value } : acceptText(value.value, finish);
}

export function fieldText<Value, Root>(
  cursor: Cursor, fields: RecordFields, name: string, read: TextReader<Value>,
  finish: (value: Value) => TextStep<Root>,
): TextStep<Root> {
  const start = startField(cursor, fields, name);
  return start.kind === "invalid-text" ? { kind: "complete", result: start }
    : { kind: "step", run: () => read(cursor, finish) };
}

export function nullableText<Value, Root>(
  cursor: Cursor, read: TextReader<Value>, finish: (value: Value | null) => TextStep<Root>,
): TextStep<Root> {
  whitespace(cursor);
  if (cursor.text.substring(cursor.offset, scalarEnd(cursor)) === "null") {
    cursor.offset += 4;
    return acceptText(null, finish);
  }
  return { kind: "step", run: () => read(cursor, finish) };
}

export function arrayText<Value, Root>(
  cursor: Cursor, read: TextReader<Value>, finish: (value: readonly Value[]) => TextStep<Root>,
): TextStep<Root> {
  const opened = delimiter(cursor, "[");
  if (opened.kind === "invalid-text") return { kind: "complete", result: opened };
  const values: Value[] = [];
  whitespace(cursor);
  if (cursor.text[cursor.offset] === "]") {
    cursor.offset += 1;
    return acceptText(values, finish);
  }
  const next = (): TextStep<Root> => read(cursor, value => {
    values.push(value);
    whitespace(cursor);
    if (cursor.text[cursor.offset] === "]") {
      cursor.offset += 1;
      return acceptText(values, finish);
    }
    const comma = delimiter(cursor, ",");
    return comma.kind === "invalid-text" ? { kind: "complete", result: comma }
      : { kind: "step", run: next };
  });
  return { kind: "step", run: next };
}

export function evaluateText<Value>(step: TextStep<Value>): TextParseResult<Value> {
  let current = step;
  while (current.kind === "step") current = current.run();
  return current.result;
}
