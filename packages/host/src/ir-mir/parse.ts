import type { TextParseResult } from "../diag/contract.js";
import type { DecodedIdentity } from "../ids/contract.js";
import type { MirBody } from "./contract.js";
import { createBodyWire } from "./print.js";
import type { ReadChoice, ReadStep, TextReader } from "./text.js";

interface LexicalFailure {
  readonly offset: number;
  readonly expected: readonly string[];
}

interface Name {
  readonly value: string;
  readonly positions: readonly number[];
  readonly end: number;
  readonly complete: boolean;
  readonly failure: LexicalFailure | null;
}

function createReader(source: string): { readonly reader: TextReader; readonly offset: () => number } {
  let offset = 0;
  const space = (): void => {
    while (/[\t\r\n ]/u.test(source.charAt(offset))) offset += 1;
  };
  const invalid = <Value>(at: number, expected: readonly string[]): ReadStep<Value> =>
    ({ kind: "invalid", offset: at, expected, found: source[at] ?? null });
  const proceed = <Value>(next: () => ReadStep<Value>): ReadStep<Value> => ({ kind: "continue", next });
  const punctuation = <Value>(expected: string, next: () => ReadStep<Value>): ReadStep<Value> => {
    space();
    if (source.charAt(offset) !== expected) return invalid(offset, [expected]);
    offset += 1;
    return proceed(next);
  };
  const delimiter = (character: string): boolean => character === "" || /[\t\r\n ,\]\)=]/u.test(character);

  const quoted = (): Name => {
    offset += 1;
    const pieces: string[] = [];
    const positions: number[] = [];
    while (offset < source.length) {
      const position = offset;
      const character = source.charAt(offset);
      if (character === '"') {
        offset += 1;
        return { value: pieces.join(""), positions, end: position, complete: true, failure: null };
      }
      if (character.charCodeAt(0) < 32) return { value: pieces.join(""), positions, end: position,
        complete: false, failure: { offset: position, expected: ["escaped string character"] } };
      if (character !== "\\") {
        pieces.push(character);
        positions.push(position);
        offset += 1;
        continue;
      }
      offset += 1;
      const escaped = source.charAt(offset);
      if (escaped === "u") {
        let code = 0;
        offset += 1;
        for (let index = 0; index < 4; index += 1) {
          const digit = source.charAt(offset);
          if (!/^[0-9a-fA-F]$/u.test(digit)) return { value: pieces.join(""), positions, end: position,
            complete: false, failure: { offset: position, expected: ["four hexadecimal escape digits"] } };
          code = code * 16 + Number.parseInt(digit, 16);
          offset += 1;
        }
        pieces.push(String.fromCharCode(code));
        positions.push(position);
        continue;
      }
      let decoded: string;
      switch (escaped) {
        case '"': decoded = '"'; break;
        case "\\": decoded = "\\"; break;
        case "/": decoded = "/"; break;
        case "b": decoded = "\b"; break;
        case "f": decoded = "\f"; break;
        case "n": decoded = "\n"; break;
        case "r": decoded = "\r"; break;
        case "t": decoded = "\t"; break;
        default: return { value: pieces.join(""), positions, end: position, complete: false,
          failure: { offset: position, expected: ["JSON string escape"] } };
      }
      pieces.push(decoded);
      positions.push(position);
      offset += 1;
    }
    return { value: pieces.join(""), positions, end: offset, complete: false,
      failure: { offset, expected: ['"'] } };
  };
  const name = (): Name => {
    space();
    if (source.charAt(offset) === '"') return quoted();
    const pieces: string[] = [];
    const positions: number[] = [];
    while (/[A-Za-z0-9_$-]/u.test(source.charAt(offset))) {
      positions.push(offset);
      pieces.push(source.charAt(offset));
      offset += 1;
    }
    return { value: pieces.join(""), positions, end: offset, complete: pieces.length > 0, failure: null };
  };
  const deviation = (token: Name, expected: readonly string[]): number => {
    const possible = expected.map(value => ({ value, active: true }));
    let index = 0;
    for (const position of token.positions) {
      let any = false;
      for (const entry of possible) {
        entry.active = entry.active && entry.value.charAt(index) === token.value.charAt(index);
        any = any || entry.active;
      }
      if (!any) return position;
      index += 1;
    }
    return token.end;
  };
  const word = <Value>(expected: readonly string[], next: (value: string) => ReadStep<Value>): ReadStep<Value> => {
    space();
    if (source.charAt(offset) === '"') return invalid(offset, expected);
    const token = name();
    const at = deviation(token, expected);
    if (!token.complete || !expected.includes(token.value)) return invalid(at, expected);
    return proceed(() => next(token.value));
  };
  const keyword = <Value>(literal: string, next: () => ReadStep<Value>): ReadStep<Value> => {
    for (const character of literal) {
      if (source.charAt(offset) !== character) return invalid(offset, [literal]);
      offset += 1;
    }
    if (!delimiter(source.charAt(offset))) return invalid(offset, [literal]);
    return proceed(next);
  };
  const numeric = <Value>(bigint: boolean, next: (value: string) => ReadStep<Value>): ReadStep<Value> => {
    const start = offset;
    const expected = bigint ? "bigint" : "number";
    if (!bigint && source.charAt(offset) === "N") return keyword("NaN", () => next("NaN"));
    if (!bigint && source.charAt(offset) === "+") return keyword("+Infinity", () => next("+Infinity"));
    if (!bigint && source.slice(offset, offset + 2) === "-I") return keyword("-Infinity", () => next("-Infinity"));
    if (source.charAt(offset) === "-") offset += 1;
    if (!/^[0-9]$/u.test(source.charAt(offset))) return invalid(offset, [expected]);
    const leadingZero = source.charAt(offset) === "0";
    offset += 1;
    if (leadingZero && /^[0-9]$/u.test(source.charAt(offset))) return invalid(offset, [expected]);
    while (/^[0-9]$/u.test(source.charAt(offset))) offset += 1;
    if (bigint) {
      if (source.charAt(offset) !== "n") return invalid(offset, ["n"]);
      const value = source.slice(start, offset);
      offset += 1;
      if (!delimiter(source.charAt(offset))) return invalid(offset, [expected]);
      return proceed(() => next(value));
    }
    if (source.charAt(offset) === ".") {
      offset += 1;
      if (!/^[0-9]$/u.test(source.charAt(offset))) return invalid(offset, ["fraction digit"]);
      while (/^[0-9]$/u.test(source.charAt(offset))) offset += 1;
    }
    if (source.charAt(offset) === "e" || source.charAt(offset) === "E") {
      offset += 1;
      if (source.charAt(offset) === "+" || source.charAt(offset) === "-") offset += 1;
      if (!/^[0-9]$/u.test(source.charAt(offset))) return invalid(offset, ["exponent digit"]);
      while (/^[0-9]$/u.test(source.charAt(offset))) offset += 1;
    }
    if (!delimiter(source.charAt(offset))) return invalid(offset, [expected]);
    const value = source.slice(start, offset);
    return proceed(() => next(value));
  };

  const fieldName = <Value>(
    required: string, previous: ReadonlySet<string>, next: () => ReadStep<Value>,
  ): ReadStep<Value> => {
    const token = name();
    const at = deviation(token, [required]);
    if (token.failure !== null && token.failure.offset <= at) return invalid(token.failure.offset, token.failure.expected);
    if (required.length === 0 || token.value !== required || !token.complete || token.failure !== null) {
      const expected = token.complete && token.failure === null && previous.has(token.value)
        ? "unique record field" : required.length === 0 ? "end of record" : required;
      return invalid(at, [expected]);
    }
    return punctuation("=", next);
  };

  const prefixed = <Result>(prefix: string | null, read: () => ReadStep<Result>): ReadStep<Result> =>
    prefix === null ? read() : word([prefix], () => punctuation(":", read));
  const string: TextReader["string"] = (prefix, next) => prefixed(prefix, () => {
    space();
    if (source.charAt(offset) !== '"') return invalid(offset, ["string"]);
    const token = quoted();
    if (token.failure !== null) return invalid(token.failure.offset, token.failure.expected);
    return proceed(() => next(token.value));
  });
  const number: TextReader["number"] = (prefix, next) => prefixed(prefix, () => {
    space();
    return numeric(false, value => next(Number(value)));
  });
  const bigint: TextReader["bigint"] = next => {
    space();
    return numeric(true, value => next(BigInt(value)));
  };
  const boolean: TextReader["boolean"] = next => {
    space();
    if (source.charAt(offset) === "t") return keyword("true", () => next(true));
    if (source.charAt(offset) === "f") return keyword("false", () => next(false));
    return invalid(offset, ["boolean"]);
  };
  const literal: TextReader["literals"] = (values, next) => {
    space();
    const expected = values.map(value => JSON.stringify(value));
    if (source.charAt(offset) !== '"') return invalid(offset, expected);
    const token = quoted();
    const at = deviation(token, values);
    if (token.failure !== null && token.failure.offset <= at) return invalid(token.failure.offset, token.failure.expected);
    for (const value of values) {
      if (token.complete && token.failure === null && token.value === value) return proceed(() => next(value));
    }
    return invalid(at, expected);
  };
  const identity = <Parts, Identity extends string, Result>(
    prefix: string, decode: (text: string) => DecodedIdentity<Parts>, encode: (parts: Parts) => Identity,
    next: (value: Identity) => ReadStep<Result>,
  ): ReadStep<Result> => word([prefix], () => punctuation(":", () => {
    space();
    if (source.charAt(offset) !== '"') return invalid(offset, ["string"]);
    const token = quoted();
    if (token.failure !== null) return invalid(token.failure.offset, token.failure.expected);
    const result = decode(token.value);
    if (result.kind === "invalid") return invalid(token.positions[result.offset] ?? token.end, [`canonical ${prefix} identity`]);
    return proceed(() => next(encode(result.value)));
  }));
  const variant = <Value, Result>(
    choices: readonly ReadChoice<Value>[], next: (value: Value) => ReadStep<Result>,
  ): ReadStep<Result> => {
    space();
    const start = offset;
    const expected = choices.map(choice => choice.label);
    if (source.charAt(offset) === '"') return invalid(offset, expected);
    const token = name();
    for (const candidate of choices) {
      if (token.complete && candidate.label === token.value) {
        offset = start;
        return proceed(() => candidate.read(reader, next));
      }
    }
    return invalid(deviation(token, expected), expected);
  };
  const reader: TextReader = {
    string, number, bigint, boolean,
    literals: literal,
    identity,
    record: (label, next) => word([label], () => punctuation("(", next)),
    field: (required, previous, first, next) => first ? fieldName(required, previous, next)
      : punctuation(",", () => fieldName(required, previous, next)),
    endRecord: (previous, next) => {
      space();
      return source.charAt(offset) === ")" ? punctuation(")", next)
        : punctuation(",", () => fieldName("", previous, next));
    },
    startArray: next => punctuation("[", next),
    arrayElement: (first, next, end) => {
      space();
      if (source.charAt(offset) === "]") return punctuation("]", end);
      return first ? proceed(next) : punctuation(",", next);
    },
    nullable: (words, present, absent) => {
      space();
      if (source.charAt(offset) !== "n") return proceed(present);
      const start = offset;
      return word(["null", ...words], selected => {
        if (selected === "null") return proceed(absent);
        offset = start;
        return proceed(present);
      });
    },
    variant,
  };
  return { reader, offset: () => { space(); return offset; } };
}

export function parseBody(source: string): TextParseResult<MirBody> {
  const parser = createReader(source);
  let current: ReadStep<MirBody> = createBodyWire().read(parser.reader, value => ({ kind: "complete", value }));
  while (current.kind === "continue") current = current.next();
  if (current.kind === "complete") {
    const offset = parser.offset();
    if (offset === source.length) return { kind: "parsed", value: current.value };
    current = { kind: "invalid", offset, expected: ["end of text"], found: source.charAt(offset) };
  }
  let line = 1;
  let column = 1;
  for (let position = 0; position < current.offset; position += 1) {
    const character = source.charAt(position);
    if (character === "\r") {
      line += 1;
      column = 1;
      if (source.charAt(position + 1) === "\n" && position + 1 < current.offset) position += 1;
    } else if (character === "\n") {
      line += 1;
      column = 1;
    } else column += 1;
  }
  return { kind: "invalid-text", offset: current.offset, line, column, expected: current.expected, found: current.found };
}
