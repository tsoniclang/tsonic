import type { ParseTir, TirBody } from "./contract.js";
import {
  decodeBodyId, decodeDefId, decodeModuleId, encodeBodyId, encodeDefId, encodeModuleId,
  expansionId, localId, nodeId, sigId, tyId,
} from "../ids/index.js";
import { requirePresent } from "../diag/index.js";
import type { TirLayouts, TirScalarValue } from "./text-layouts.js";
import type { TirConstruction, TirConstructionCursor, TirRecordConstruction, TirIdentityInput, TirSequenceConstruction, TirSyntaxConstruction, TirValueRequest } from "./text-construction.js";
import { hostNumberText } from "./text-layouts.js";
import { createTirLayouts } from "./text-model.js";

interface TirParseFailure {
  readonly kind: "invalid";
  readonly offset: number;
  readonly expected: readonly string[];
  readonly found: string | null;
}

interface TirLexeme {
  readonly kind: "word" | "scalar" | "punctuation";
  readonly text: string;
  readonly value: TirScalarValue;
  readonly offset: number;
  readonly end: number;
}

interface TirTextEnd { readonly kind: "end"; readonly offset: number }
type TirToken = TirLexeme | TirTextEnd | TirParseFailure;
const tokenFound = (token: TirLexeme | TirTextEnd): string | null => token.kind === "end" ? null : token.text;
type TirIdentityPrefix = "n" | "l" | "t" | "sig" | "mod" | "def" | "body" | "exp";

interface TirWireRecord {
  readonly ordinal: number;
  declaration: { readonly construction: TirSyntaxConstruction; readonly offset: number } | null;
  readonly children: TirWireUse[];
}

interface TirWireBinding {
  readonly type: string;
  readonly bind: (value: TirSyntaxConstruction) => boolean;
}

interface TirWireUse {
  readonly position: number;
  readonly ordinal: number;
  readonly bindings: readonly TirWireBinding[];
  readonly token: TirLexeme;
  readonly target: TirWireRecord;
}

interface TirReadState {
  readonly text: string;
  readonly layouts: TirLayouts;
  readonly nodes: Map<number, TirWireRecord>;
  readonly references: TirWireUse[];
  readonly declarations: TirWireRecord[];
  readonly declared: Set<number>;
  position: number;
  token: TirToken | null;
  failure: TirParseFailure | null;
  first: TirLexeme | TirTextEnd;
}

const invalid = (offset: number, expected: readonly string[], found: string | null): TirParseFailure =>
  ({ kind: "invalid", offset, expected, found });

interface TirTextFailure {
  readonly kind: "invalid-text";
  readonly offset: number;
  readonly line: number;
  readonly column: number;
  readonly expected: readonly string[];
  readonly found: string | null;
}

const finishFailure = (text: string, failure: TirParseFailure): TirTextFailure => {
  let line = 1;
  let column = 1;
  for (let position = 0; position < failure.offset; position++) {
    if (text[position] === "\n") { line++; column = 1; }
    else column++;
  }
  return { kind: "invalid-text", offset: failure.offset, line, column,
    expected: failure.expected, found: failure.found };
};

const skipSpace = (state: TirReadState): void => {
  for (let character = state.text[state.position]; character !== undefined && /\s/u.test(character);
    character = state.text[++state.position]) { }
};

const tokenHead = (state: TirReadState): { readonly offset: number; readonly found: string | null } => {
  skipSpace(state);
  let end = state.position;
  if (/[A-Za-z_$]/u.test(state.text.charAt(end))) {
    do { end++; } while (/[A-Za-z0-9_$-]/u.test(state.text.charAt(end)));
  }
  return { offset: state.position, found: end === state.position
    ? state.text[state.position] ?? null : state.text.slice(state.position, end) };
};

interface TirFieldNameRead {
  readonly expected: readonly string[];
  readonly given: ReadonlySet<string>;
  readonly previous: string | null;
  candidates: readonly string[];
  afterPrevious: boolean;
  position: number;
  first: number | null;
  deviation: { readonly offset: number; readonly found: string } | null;
}

const fieldCharacter = (field: TirFieldNameRead | null, value: string, offset: number): void => {
  if (field === null) return;
  if (field.first === null) field.first = offset;
  if (field.deviation !== null) return;
  if (field.expected.includes("*")) {
    if (field.previous !== null && !field.afterPrevious) {
      const previous = field.previous.charAt(field.position);
      if (value < previous) field.deviation = { offset: field.first, found: value };
      else if (value > previous) field.afterPrevious = true;
    }
    field.position++;
    return;
  }
  field.candidates = field.candidates.filter(name => name[field.position] === value);
  if (field.candidates.length === 0) field.deviation = { offset, found: value };
  field.position++;
};

const fieldExpected = (field: TirFieldNameRead): readonly string[] =>
  field.expected.includes("*") ? ["UTF-16 ordered dictionary key"]
    : field.expected.length === 0 ? ["end of record"] : field.expected;

const fieldLexicalFailure = (field: TirFieldNameRead | null, failure: TirParseFailure): TirParseFailure =>
  field !== null && field.deviation !== null
    ? invalid(field.deviation.offset, fieldExpected(field), field.deviation.found) : failure;

const finishFieldName = (field: TirFieldNameRead | null, token: TirLexeme): TirLexeme | TirParseFailure => {
  if (field === null) return token;
  const name = typeof token.value === "string" ? token.value : token.text;
  const end = token.text.startsWith('"') ? token.end - 1 : token.end;
  const offset = field.deviation?.offset ?? (field.expected.includes("*") ? field.first ?? end : end);
  if (field.given.has(name)) return invalid(offset, ["unique record field"], name);
  if (field.expected.includes("*") && field.previous !== null && name < field.previous) {
    return invalid(field.first ?? end, ["UTF-16 ordered dictionary key"], name);
  }
  if (field.deviation !== null || !field.expected.includes("*") &&
    !field.candidates.some(candidate => candidate.length === field.position)) {
    return invalid(offset, fieldExpected(field), name);
  }
  return token;
};

const readToken = (state: TirReadState, field: TirFieldNameRead | null = null): TirToken => {
  skipSpace(state);
  const text = state.text;
  const start = state.position;
  const character = text[start];
  if (character === undefined) return { kind: "end", offset: start };
  if ("(),[]=:".includes(character)) {
    state.position++;
    return { kind: "punctuation", text: character, value: character, offset: start, end: state.position };
  }
  if (character === '"') {
    const output: string[] = [];
    state.position++;
    for (let selected = text[state.position]; selected !== undefined; selected = text[state.position]) {
      if (selected === '"') {
        state.position++;
        return finishFieldName(field, { kind: "scalar", text: text.slice(start, state.position), value: output.join(""),
          offset: start, end: state.position });
      }
      if (selected.charCodeAt(0) < 32) return fieldLexicalFailure(field, invalid(state.position, ["JSON string character"], selected));
      if (selected !== "\\") {
        fieldCharacter(field, selected, state.position);
        output.push(selected); state.position++; continue;
      }
      const escapeStart = state.position;
      state.position++;
      const escape = text[state.position];
      if (escape === "u") {
        const digits = text.slice(state.position + 1, state.position + 5);
        if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) {
          return fieldLexicalFailure(field, invalid(state.position + 1, ["four hexadecimal digits"], digits.length === 0 ? null : digits));
        }
        const decoded = String.fromCharCode(Number.parseInt(digits, 16));
        fieldCharacter(field, decoded, escapeStart);
        output.push(decoded);
        state.position += 5;
        continue;
      }
      let decoded: string;
      switch (escape) {
        case '"': decoded = '"'; break;
        case "\\": decoded = "\\"; break;
        case "/": decoded = "/"; break;
        case "b": decoded = "\b"; break;
        case "f": decoded = "\f"; break;
        case "n": decoded = "\n"; break;
        case "r": decoded = "\r"; break;
        case "t": decoded = "\t"; break;
        default: return fieldLexicalFailure(field, invalid(state.position, ["JSON escape"], escape ?? null));
      }
      fieldCharacter(field, decoded, escapeStart);
      output.push(decoded);
      state.position++;
    }
    return fieldLexicalFailure(field, invalid(text.length, ['"'], null));
  }
  const exceptional = ["+Infinity", "-Infinity", "NaN"].find(value => text.startsWith(value, start));
  if (exceptional !== undefined) {
    state.position += exceptional.length;
    const token: TirLexeme = { kind: "scalar", text: exceptional,
      value: exceptional === "NaN" ? NaN : exceptional === "+Infinity" ? Infinity : -Infinity, offset: start, end: state.position };
    if (exceptional === "NaN" && field !== null) {
      for (const [position, character] of [...exceptional].entries()) fieldCharacter(field, character, start + position);
      return finishFieldName(field, token);
    }
    return token;
  }
  if (character === "-" || /[0-9]/u.test(character)) {
    let end = character === "-" ? start + 1 : start;
    const first = text.charAt(end);
    if (first === "0") end++;
    else if (first >= "1" && first <= "9") {
      do { end++; } while (text.charAt(end) >= "0" && text.charAt(end) <= "9");
    } else return invalid(start, ["number"], character);
    if (text[end] === "." && text.charAt(end + 1) >= "0" && text.charAt(end + 1) <= "9") {
      end += 2;
      while (text.charAt(end) >= "0" && text.charAt(end) <= "9") end++;
    }
    if (text[end] === "e") {
      let exponent = end + 1;
      if (text[exponent] === "+" || text[exponent] === "-") exponent++;
      const firstDigit = exponent;
      while (text.charAt(exponent) >= "0" && text.charAt(exponent) <= "9") exponent++;
      if (exponent > firstDigit) end = exponent;
    }
    if (text[end] === "n") end++;
    const selected = text.slice(start, end);
    state.position = end;
    if (selected.endsWith("n")) {
      if (!/^-?(?:0|[1-9][0-9]*)n$/u.test(selected) || selected === "-0n") return invalid(start, ["canonical bigint"], selected);
      return { kind: "scalar", text: selected, value: BigInt(selected.slice(0, -1)), offset: start, end: state.position };
    }
    const value = Number(selected);
    if (hostNumberText(value) !== selected) return invalid(start, ["canonical number"], selected);
    return { kind: "scalar", text: selected, value, offset: start, end: state.position };
  }
  if (/[A-Za-z_$]/u.test(character)) {
    for (let next = text[state.position]; next !== undefined && /[A-Za-z0-9_$-]/u.test(next); next = text[++state.position]) {
      fieldCharacter(field, next, state.position);
    }
    const source = text.slice(start, state.position);
    const value = source === "true" ? true : source === "false" ? false : source === "null" ? null : source;
    return finishFieldName(field, { kind: typeof value === "string" ? "word" : "scalar", text: source, value, offset: start, end: state.position });
  }
  return invalid(start, ["record", "string", "number", "["], character);
};

const peekToken = (state: TirReadState): TirToken => {
  if (state.token === null) state.token = readToken(state);
  return state.token;
};

const takeToken = (state: TirReadState, field: TirFieldNameRead | null = null): TirToken => {
  const token = field === null ? peekToken(state) : readToken(state, field);
  state.token = null;
  return token;
};

const expectToken = (state: TirReadState, expected: "n" | ":" | "(" | "="): TirLexeme | TirParseFailure => {
  const start = tokenHead(state);
  if (start.found !== expected) return invalid(start.offset, [expected], start.found);
  state.token = null;
  state.position = start.offset + expected.length;
  return { kind: expected === "n" ? "word" : "punctuation", text: expected, value: expected,
    offset: start.offset, end: state.position };
};

const identityPrefix = (value: string): TirIdentityPrefix | null => {
  switch (value) {
    case "n": case "l": case "t": case "sig": case "mod": case "def": case "body": case "exp": return value;
    default: return null;
  }
};

const publishStringIdentity = (prefix: "mod" | "def" | "body" | "exp", value: string): TirIdentityInput | null => {
  switch (prefix) {
    case "mod": {
      const decoded = decodeModuleId(value);
      return decoded.kind === "decoded" ? { prefix, value: encodeModuleId(decoded.value) } : null;
    }
    case "def": {
      const decoded = decodeDefId(value);
      return decoded.kind === "decoded" ? { prefix, value: encodeDefId(decoded.value) } : null;
    }
    case "body": {
      const decoded = decodeBodyId(value);
      return decoded.kind === "decoded" ? { prefix, value: encodeBodyId(decoded.value) } : null;
    }
    case "exp": return { prefix, value: expansionId(value) };
  }
};

const baseType = (type: string): string => type.startsWith("?") ? type.slice(1) : type;
const expectedTypes = (types: readonly string[]): readonly string[] =>
  [...new Set(types.map(type => type === "HostDiagnosticCode" ? "string"
    : type.startsWith("'") ? JSON.stringify(type.slice(1)) : type))];

type TirReadRequest = TirValueRequest;
interface TirRecordChoice {
  readonly source: TirReadRequest | null;
  readonly construction: TirRecordConstruction;
}
interface TirFieldChoice { readonly choice: TirRecordChoice; readonly cursor: TirConstructionCursor & { readonly kind: "field" } }
interface TirArrayChoice { readonly source: TirReadRequest; readonly construction: TirSequenceConstruction }
interface TirFieldRequests { readonly slot: TirFieldChoice; readonly requests: readonly TirReadRequest[] }
interface TirArrayRequests { readonly choice: TirArrayChoice; readonly requests: readonly TirReadRequest[] }

type TirDestination =
  | { readonly kind: "root" }
  | { readonly kind: "field"; readonly frame: TirRecordFrame; readonly name: string; readonly slots: readonly TirFieldRequests[] }
  | { readonly kind: "element"; readonly frame: TirArrayFrame; readonly slots: readonly TirArrayRequests[] };

interface TirRecordFrame {
  readonly kind: "record";
  readonly destination: TirDestination;
  readonly arena: TirWireRecord | null;
  readonly given: Set<string>;
  previous: string | null;
  choices: readonly TirRecordChoice[];
  state: "start" | "field" | "done";
}
interface TirArrayFrame {
  readonly kind: "array";
  readonly destination: TirDestination;
  readonly arena: TirWireRecord | null;
  choices: readonly TirArrayChoice[];
  state: "start" | "done";
}
interface TirValueRead {
  readonly kind: "read";
  readonly requests: readonly TirReadRequest[];
  readonly destination: TirDestination;
  readonly definition: ((value: TirSyntaxConstruction) => void) | null;
  readonly arena: TirWireRecord | null;
}
interface TirCompleteValue { readonly kind: "complete"; readonly end: number }
type TirReadWork = TirValueRead | TirRecordFrame | TirArrayFrame | TirCompleteValue;

const acceptValue = (requests: readonly TirReadRequest[], end: number, destination: TirDestination): TirReadWork => {
  switch (destination.kind) {
    case "root": return { kind: "complete", end };
    case "field": {
      const frame = destination.frame;
      frame.choices = destination.slots.filter(slot => slot.requests.some(request => requests.includes(request))).map(slot => slot.slot.choice);
      frame.given.add(destination.name);
      frame.previous = destination.name;
      frame.state = "done";
      return frame;
    }
    case "element": {
      const frame = destination.frame;
      frame.choices = destination.slots.filter(slot => slot.requests.some(request => requests.includes(request))).map(slot => slot.choice);
      frame.state = "done";
      return frame;
    }
  }
};

const prefixFailure = (state: TirReadState, types: readonly string[]): TirParseFailure | null => {
  if (state.token === null) skipSpace(state);
  const offset = state.token === null ? state.position : state.token.offset;
  const character = state.text[offset];
  if (character === '"' && !types.some(type => {
    const base = baseType(type);
    return base === "string" || base === "HostDiagnosticCode" || base.startsWith("'") ||
      state.layouts.literals.has(base) && !state.layouts.numericLiterals.has(base);
  })) return invalid(offset, expectedTypes(types), '"');
  if (character === "[" && !types.some(type => baseType(type).startsWith("["))) {
    return invalid(offset, expectedTypes(types), "[");
  }
  if (character !== undefined && /[-+0-9]/u.test(character) && !types.some(type => {
    const base = baseType(type);
    return base === "number" || base === "bigint" || /^[0-9]+$/u.test(base) || state.layouts.numericLiterals.has(base);
  })) return invalid(offset, expectedTypes(types), tokenHead(state).found);
  return null;
};

const wireRecord = (state: TirReadState, ordinal: number): TirWireRecord => {
  const found = state.nodes.get(ordinal);
  if (found !== undefined) return found;
  const created: TirWireRecord = { ordinal, declaration: null, children: [] };
  state.nodes.set(ordinal, created);
  return created;
};

const recordSlots = (frame: TirRecordFrame): readonly TirFieldChoice[] => frame.choices.flatMap(choice => {
  const cursor = choice.construction.cursor();
  return cursor.kind === "field" ? [{ choice, cursor }] : [];
});

const readSchemaValue = (state: TirReadState, initial: TirValueRead): TirCompleteValue | TirParseFailure => {
  let work: TirReadWork = initial;
  while (work.kind !== "complete") {
    const current = work;
    if (current.kind === "read") {
      const types = current.definition === null ? [...new Set(current.requests.map(value => value.type))] : ["$SyntaxNode"];
      const shape = prefixFailure(state, types);
      if (shape !== null) return shape;
      const token = takeToken(state);
      if (token.kind === "invalid") return token;
      if (token.kind === "end") return invalid(token.offset, ["value"], null);
      if (token.kind === "scalar") {
        const accepted = current.requests.filter(value => value.kind === "scalar" &&
          value.read(token.value));
        if (accepted.length === 0) return invalid(token.offset, expectedTypes(types), token.text);
        work = acceptValue(accepted, token.end, current.destination);
        continue;
      }
      if (token.text === "[") {
        const choices: TirArrayChoice[] = [];
        for (const source of current.requests) if (source.kind === "sequence") choices.push({ source,
          construction: source.sequence() });
        work = { kind: "array", choices, destination: current.destination, state: "start", arena: current.arena };
        continue;
      }
      if (token.kind !== "word") return invalid(token.offset, expectedTypes(types), token.text);
      const identityTypes = types.filter(type => baseType(type) === token.text ||
        current.definition === null && baseType(type).startsWith("$") && token.text === "n");
      const prefix = identityPrefix(token.text);
      const numeric = prefix === "n" || prefix === "l" || prefix === "t" || prefix === "sig";
      if (identityTypes.length > 0 && prefix !== null) {
        const colon = expectToken(state, ":");
        if (colon.kind === "invalid") return colon;
        const payload = prefixFailure(state, [numeric ? "number" : "string"]);
        if (payload !== null) return payload;
        const value = takeToken(state);
        if (value.kind === "invalid") return value;
        const accepted: TirReadRequest[] = [];
        if (prefix === "n" || prefix === "l" || prefix === "t" || prefix === "sig") {
          if (value.kind !== "scalar" || typeof value.value !== "number") {
            return invalid(value.offset, ["identity number"], tokenFound(value));
          }
          const bindings: TirWireBinding[] = [];
          for (const source of current.requests) {
            const request = source;
            if (request.kind === "syntax" && prefix === "n" && Number.isSafeInteger(value.value) && value.value >= 0 && !Object.is(value.value, -0)) {
              bindings.push({ type: request.type, bind: request.reference(value.value) });
              accepted.push(source);
            } else if (request.kind === "n" && prefix === "n") {
              request.read(nodeId(value.value)); accepted.push(source);
            } else if (request.kind === "l" && prefix === "l") {
              request.read(localId(value.value)); accepted.push(source);
            } else if (request.kind === "t" && prefix === "t") {
              request.read(tyId(value.value)); accepted.push(source);
            } else if (request.kind === "sig" && prefix === "sig") {
              request.read(sigId(value.value)); accepted.push(source);
            }
          }
          if (bindings.length > 0) {
            const target = wireRecord(state, value.value);
            const use: TirWireUse = { position: state.references.length, ordinal: value.value, target, bindings,
              token: { ...token, text: token.text + ":" + value.text, end: value.end } };
            if (current.arena !== null) current.arena.children.push(use);
            state.references.push(use);
          }
        } else {
          if (value.kind !== "scalar" || typeof value.value !== "string") {
            return invalid(value.offset, ["identity string"], tokenFound(value));
          }
          const identity = publishStringIdentity(prefix, value.value);
          if (identity === null) return invalid(token.offset, expectedTypes(identityTypes), token.text + ":" + value.text);
          for (const source of current.requests) {
            const request = source;
            if (request.kind === "mod" && identity.prefix === "mod") {
              request.read(identity.value); accepted.push(source);
            } else if (request.kind === "def" && identity.prefix === "def") {
              request.read(identity.value); accepted.push(source);
            } else if (request.kind === "body" && identity.prefix === "body") {
              request.read(identity.value); accepted.push(source);
            } else if (request.kind === "exp" && identity.prefix === "exp") {
              request.read(identity.value); accepted.push(source);
            }
          }
        }
        if (accepted.length === 0) return invalid(token.offset, expectedTypes(identityTypes), token.text + ":" + value.text);
        work = acceptValue(accepted, value.end, current.destination);
        continue;
      }
      const choices: TirRecordChoice[] = [];
      if (current.definition !== null) {
        const layout = state.layouts.syntax.get(token.text);
        if (layout !== undefined) choices.push({ source: null, construction: layout.start(current.definition) });
      } else for (const source of current.requests) if (source.kind === "record") {
        for (const construction of source.records(token.text)) choices.push({ source, construction });
      }
      if (choices.length === 0) return invalid(token.offset, expectedTypes(types), token.text);
      const opening = expectToken(state, "(");
      if (opening.kind === "invalid") return opening;
      work = { kind: "record", choices, destination: current.destination, state: "start", arena: current.arena,
        given: new Set<string>(), previous: null };
      continue;
    }
    if (current.kind === "array" && current.state === "start") {
      const start = tokenHead(state);
      if (start.found !== null && start.found !== "]") {
        const slots = current.choices.map(choice => ({ choice, requests: choice.construction.requests() }));
        work = { kind: "read", requests: slots.flatMap(slot => slot.requests),
          destination: { kind: "element", frame: current, slots }, definition: null, arena: current.arena };
        continue;
      }
    }
    if (current.state === "done") {
      const closing = current.kind === "array" ? "]" : ")";
      const start = tokenHead(state);
      if (start.found !== null && start.found !== "," && start.found !== closing) {
        const found = takeToken(state);
        return invalid(start.offset, [",", closing], found.kind === "invalid" ? start.found : tokenFound(found));
      }
    }
    const slots = current.kind === "record" ? recordSlots(current) : [];
    const names = [...new Set(slots.map(slot => slot.cursor.field.name))];
    const head = tokenHead(state);
    const field: TirFieldNameRead | null = current.kind === "record" && current.state !== "done" &&
      head.found !== null && head.found !== ")" ? {
        expected: names, given: current.given, previous: current.previous,
        candidates: names, afterPrevious: false, position: 0, first: null, deviation: null,
      } : null;
    const token = takeToken(state, field);
    if (token.kind === "invalid") return token;
    if (current.kind === "array") {
      if (token.kind === "end") return invalid(token.offset, current.state === "start" ? ["value", "]"] : [",", "]"], null);
      if (token.text === "]") {
        for (const choice of current.choices) choice.construction.publish();
        work = acceptValue(current.choices.map(choice => choice.source), token.end, current.destination);
      } else {
        const slots = current.choices.map(choice => ({ choice, requests: choice.construction.requests() }));
        work = { kind: "read", requests: slots.flatMap(slot => slot.requests),
          destination: { kind: "element", frame: current, slots }, definition: null, arena: current.arena };
      }
      continue;
    }
    const complete = current.choices.flatMap(choice => {
      const cursor = choice.construction.cursor();
      return cursor.kind === "complete" ? [{ choice, publish: cursor.publish }] :
        cursor.close === null ? [] : [{ choice, publish: cursor.close }];
    });
    if (token.kind === "end") return invalid(token.offset, current.state === "done" ? [",", ")"] :
      current.state === "field" ? ["field name"] : [...names, ...(complete.length > 0 ? [")"] : [])], null);
    if (token.text === ")" && current.state !== "field") {
      if (complete.length === 0) return invalid(token.offset, names, ")");
      for (const value of complete) value.publish();
      work = acceptValue(complete.flatMap(value => value.choice.source === null ? [] : [value.choice.source]), token.end, current.destination);
      continue;
    }
    if (current.state === "done") { current.state = "field"; continue; }
    if (token.kind !== "word" && (token.kind !== "scalar" ||
      typeof token.value !== "string" && !/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(token.text))) return invalid(token.offset, ["field name"], token.text);
    const name = typeof token.value === "string" ? token.value : token.text;
    const matching = slots.filter(slot => slot.cursor.field.name === name || slot.cursor.field.name === "*");
    const equals = expectToken(state, "=");
    if (equals.kind === "invalid") return equals;
    const fields = matching.map(slot => ({ slot, requests: slot.cursor.requests(name) }));
    work = { kind: "read", requests: fields.flatMap(value => value.requests),
      destination: { kind: "field", frame: current, name, slots: fields }, definition: null,
      arena: name === "tsonic" ? null : current.arena };
  }
  return work;
};
const earlierFailure = (state: TirReadState, failure: TirParseFailure): void => {
  if (state.failure === null || failure.offset < state.failure.offset) state.failure = failure;
};

const syntaxCycleWithin = (declarations: readonly TirWireRecord[], prefix: number): boolean => {
  const completed = new Set<number>();
  const active = new Set<number>();
  for (const root of declarations) {
    const pending = [{ node: root, exit: false }];
    for (let work = pending.pop(); work !== undefined; work = pending.pop()) {
      const node = work.node;
      if (work.exit) { active.delete(node.ordinal); completed.add(node.ordinal); continue; }
      if (active.has(node.ordinal)) return true;
      if (completed.has(node.ordinal)) continue;
      active.add(node.ordinal);
      pending.push({ node, exit: true });
      for (let position = node.children.length - 1, use = node.children[position]; use !== undefined; use = node.children[--position]) {
        if (use.position <= prefix) pending.push({ node: use.target, exit: false });
      }
    }
  }
  return false;
};

const verifyWireReferences = (state: TirReadState): void => {
  for (const use of state.references) {
    const bindings = use.bindings;
    const declaration = use.target.declaration;
    if (declaration === null) {
      earlierFailure(state, invalid(use.token.offset, ["declared syntax node"], use.token.text));
    } else {
      let accepted = false;
      for (const binding of bindings) if (binding.bind(declaration.construction)) accepted = true;
      if (!accepted) earlierFailure(state, invalid(use.token.offset,
        [...new Set(bindings.map(binding => baseType(binding.type).slice(1)))], use.token.text));
    }
  }
  if (syntaxCycleWithin(state.declarations, state.references.length - 1)) {
    let first = 0;
    let last = state.references.length - 1;
    while (first < last) {
      const middle = Math.floor((first + last) / 2);
      if (syntaxCycleWithin(state.declarations, middle)) last = middle;
      else first = middle + 1;
    }
    for (const use of state.references) if (use.position === first) {
      earlierFailure(state, invalid(use.token.offset, ["acyclic syntax reference"], use.token.text));
    }
  }
  const visited = new Set<number>();
  const pending = state.references.slice(0, 1).map(use => use.target);
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (visited.has(node.ordinal) || node.declaration === null) continue;
    const position = visited.size;
    visited.add(node.ordinal);
    if (node.ordinal !== position) earlierFailure(state, invalid(node.declaration.offset, ["wire traversal position"], String(node.ordinal)));
    for (let index = node.children.length - 1, child = node.children[index]; child !== undefined; child = node.children[--index]) pending.push(child.target);
  }
  for (const node of state.declarations) if (!visited.has(node.ordinal) && node.declaration !== null) {
    earlierFailure(state, invalid(node.declaration.offset, ["wire traversal position"], String(node.ordinal)));
  }
};

const constructTirBody = (state: TirReadState, accept: (value: TirConstruction<TirBody>) => void): boolean => {
  const prefix = prefixFailure(state, ["TirBody"]);
  if (prefix !== null) { state.failure = prefix; return false; }
  const first = peekToken(state);
  if (first.kind === "invalid") { state.failure = first; return false; }
  state.first = first;
  if (first.kind !== "word" || first.text !== "TirBody") return false;
  const header = readSchemaValue(state, { kind: "read", requests: state.layouts.bodyReader.requests(accept), destination: { kind: "root" }, definition: null, arena: null });
  if (header.kind === "invalid") { state.failure = header; return false; }
  let previousEnd = header.end;
  while (true) {
    const start = tokenHead(state);
    if (start.found === null) break;
    if (!state.text.slice(previousEnd, start.offset).includes("\n")) {
      state.failure = invalid(start.offset, ["newline"], start.found);
      break;
    }
    const prefix = expectToken(state, "n");
    if (prefix.kind === "invalid") { state.failure = prefix; break; }
    const colon = expectToken(state, ":");
    if (colon.kind === "invalid") { state.failure = colon; break; }
    const ordinal = takeToken(state);
    if (ordinal.kind === "invalid") { state.failure = ordinal; break; }
    if (ordinal.kind !== "scalar" || typeof ordinal.value !== "number" || !Number.isSafeInteger(ordinal.value) ||
      ordinal.value < 0 || Object.is(ordinal.value, -0)) {
      state.failure = invalid(ordinal.offset, ["wire traversal position"], tokenFound(ordinal));
      break;
    }
    if (state.declared.has(ordinal.value)) {
      state.failure = invalid(ordinal.offset, ["unique wire binding"], ordinal.text);
      break;
    }
    if (ordinal.value !== state.declarations.length) {
      state.failure = invalid(ordinal.offset, ["wire traversal position"], ordinal.text);
      break;
    }
    const equals = expectToken(state, "=");
    if (equals.kind === "invalid") { state.failure = equals; break; }
    const entry = wireRecord(state, ordinal.value);
    state.declared.add(ordinal.value);
    state.declarations.push(entry);
    const shape = prefixFailure(state, ["$SyntaxNode"]);
    if (shape !== null) { state.failure = shape; break; }
    const node = readSchemaValue(state, { kind: "read", requests: [], definition: value => {
      entry.declaration = { construction: value, offset: ordinal.offset };
    },
      destination: { kind: "root" }, arena: entry });
    if (node.kind === "invalid") { state.failure = node; break; }
    previousEnd = node.end;
  }
  if (state.failure === null) verifyWireReferences(state);
  return state.failure === null;
};

export const parseTypedBody: ParseTir = text => {
  let body: TirConstruction<TirBody> | undefined;
  const state: TirReadState = { text, layouts: createTirLayouts(), nodes: new Map(), references: [], declarations: [],
    declared: new Set(), position: 0, token: null, failure: null, first: { kind: "end", offset: 0 } };
  if (constructTirBody(state, value => { body = value; })) {
    const plan = requirePresent(body, { owner: "ir-tir", query: { name: "text.body-construction", encodedKey: "TirBody" },
      origin: null, message: "validated text has no typed body construction" });
    let step = plan.run(value => ({ kind: "complete", value }));
    while (step.kind === "next") step = step.next();
    return { kind: "parsed", value: step.value };
  }
  return finishFailure(text, state.failure ?? invalid(state.first.offset,
    state.first.kind === "end" ? ["value"] : ["TirBody"], tokenFound(state.first)));
};
