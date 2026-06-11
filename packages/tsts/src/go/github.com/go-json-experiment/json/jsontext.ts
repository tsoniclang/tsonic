import type { bool, byte } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../../../compat.js";
import type { Reader, Writer } from "../../../io.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface Option {
  readonly name: string;
  readonly value: unknown;
}

export function AllowDuplicateNames(allow: bool): Option {
  return { name: "AllowDuplicateNames", value: allow };
}

export function AllowInvalidUTF8(allow: bool): Option {
  return { name: "AllowInvalidUTF8", value: allow };
}

export class Kind {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  Kind(): string {
    return this.#value;
  }

  String(): string {
    return this.#value;
  }
}

export const BeginArray = new Kind("[");
export const BeginObject = new Kind("{");
export const EndArray = new Kind("]");
export const EndObject = new Kind("}");
export const Null = new Kind("n");

export type Value = GoSlice<byte>;

export interface Decoder {
  PeekKind(): string;
  ReadToken(): [Kind, GoError];
  ReadValue(): [unknown, GoError];
}

export interface Encoder {
  WriteToken(kind: Kind): GoError;
  WriteValue(value: unknown): GoError;
  Bytes(): GoSlice<byte>;
}

class JsonDecoder implements Decoder {
  readonly #value: unknown;
  #consumed = false;

  constructor(input: unknown) {
    this.#value = parseInput(input);
  }

  PeekKind(): string {
    return kindOf(this.#value);
  }

  ReadToken(): [Kind, GoError] {
    if (this.#consumed) {
      return [new Kind(""), new Error("json decoder exhausted")];
    }
    this.#consumed = true;
    return [new Kind(kindOf(this.#value)), undefined];
  }

  ReadValue(): [unknown, GoError] {
    if (this.#consumed) {
      return [undefined, new Error("json decoder exhausted")];
    }
    this.#consumed = true;
    return [this.#value, undefined];
  }
}

class JsonEncoder implements Encoder {
  readonly #chunks: Array<string> = [];
  readonly #stack: Array<JsonContainerFrame> = [];

  WriteToken(kind: Kind): GoError {
    try {
      const value = kind.Kind();
      switch (value) {
        case "{":
          this.#writeValuePrefix();
          this.#chunks.push("{");
          this.#stack.push({ kind: "object", count: 0, expecting: "key" });
          return undefined;
        case "[":
          this.#writeValuePrefix();
          this.#chunks.push("[");
          this.#stack.push({ kind: "array", count: 0 });
          return undefined;
        case "}":
          return this.#closeContainer("object", "}");
        case "]":
          return this.#closeContainer("array", "]");
        case "n":
          this.#writeValuePrefix();
          this.#chunks.push("null");
          return undefined;
        default:
          return new Error(`unsupported json token ${value}`);
      }
    } catch (error) {
      return toError(error);
    }
  }

  WriteValue(value: unknown): GoError {
    try {
      const frame = this.#stack[this.#stack.length - 1];
      const objectFrame = asJsonObjectFrame(frame);
      if (objectFrame !== undefined) {
        if (objectFrame.expecting !== "key") {
          this.#writeValuePrefix();
          this.#chunks.push(JSON.stringify(normalizeForJson(value)));
          return undefined;
        }
        if (objectFrame.count > 0) {
          this.#chunks.push(",");
        }
        this.#chunks.push(JSON.stringify(String(value)));
        this.#chunks.push(":");
        objectFrame.expecting = "value";
        return undefined;
      }
      this.#writeValuePrefix();
      this.#chunks.push(JSON.stringify(normalizeForJson(value)));
      return undefined;
    } catch (error) {
      return toError(error);
    }
  }

  Bytes(): GoSlice<byte> {
    return Array.from(textEncoder.encode(this.#chunks.join("")));
  }

  #writeValuePrefix(): void {
    const frame = this.#stack[this.#stack.length - 1];
    if (frame === undefined) {
      if (this.#chunks.length > 0) {
        throw new Error("json encoder already has a top-level value");
      }
      return;
    }
    if (frame.kind === "array") {
      if (frame.count > 0) {
        this.#chunks.push(",");
      }
      frame.count = frame.count + 1;
      return;
    }
    const objectFrame = asJsonObjectFrame(frame);
    if (objectFrame === undefined) {
      throw new Error("json array value prefix reached object-only branch");
    }
    if (objectFrame.expecting !== "value") {
      throw new Error("json object value written before key");
    }
    objectFrame.count = objectFrame.count + 1;
    objectFrame.expecting = "key";
  }

  #closeContainer(expected: JsonContainerFrame["kind"], token: string): GoError {
    const frame = this.#stack.pop();
    if (frame === undefined || frame.kind !== expected) {
      return new Error(`json encoder mismatched ${token} token`);
    }
    const objectFrame = asJsonObjectFrame(frame);
    if (objectFrame !== undefined) {
      if (objectFrame.expecting !== "key") {
        return new Error("json object closed before value");
      }
    }
    this.#chunks.push(token);
    return undefined;
  }
}

interface JsonObjectFrame {
  kind: "object";
  count: number;
  expecting: "key" | "value";
}

interface JsonArrayFrame {
  kind: "array";
  count: number;
}

type JsonContainerFrame = JsonObjectFrame | JsonArrayFrame;

function asJsonObjectFrame(frame: JsonContainerFrame | undefined): JsonObjectFrame | undefined {
  return frame !== undefined && frame.kind === "object" ? frame as JsonObjectFrame : undefined;
}

export function NewDecoder(reader: Reader | GoSlice<byte> | string): Decoder {
  return new JsonDecoder(reader);
}

export function NewEncoder(): Encoder {
  return new JsonEncoder();
}

export function WithIndent(indent: string): Option {
  return { name: "WithIndent", value: indent };
}

export function WithIndentPrefix(prefix: string): Option {
  return { name: "WithIndentPrefix", value: prefix };
}

const parseInput = (input: unknown): unknown => {
  if (typeof input === "string") {
    return JSON.parse(input);
  }
  if (Array.isArray(input) || input instanceof Uint8Array) {
    return JSON.parse(textDecoder.decode(Uint8Array.from(input as ArrayLike<number>)));
  }
  if (typeof input === "object" && input !== null && "Read" in input) {
    const bytes: Array<byte> = [];
    const chunk = new Array<byte>(4096);
    for (;;) {
      const [count, err] = (input as Reader).Read(chunk);
      if (count > 0) {
        bytes.push(...chunk.slice(0, count));
      }
      if (err !== undefined || count === 0) {
        break;
      }
    }
    return JSON.parse(textDecoder.decode(Uint8Array.from(bytes as Array<number>)));
  }
  return input;
}

const kindOf = (value: unknown): string => {
  if (value === null) {
    return "n";
  }
  if (Array.isArray(value)) {
    return "[";
  }
  if (typeof value === "object") {
    return "{";
  }
  if (typeof value === "string") {
    return "\"";
  }
  if (typeof value === "boolean") {
    return value ? "t" : "f";
  }
  return "0";
}

const normalizeForJson = (value: unknown): unknown => {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  return value;
}

const toError = (error: unknown): Error => {
  return error instanceof Error ? error : new Error(String(error));
}

export const writeTo = (writer: Writer, bytes: GoSlice<byte>): GoError => {
  const [, err] = writer.Write(bytes);
  return err;
}
