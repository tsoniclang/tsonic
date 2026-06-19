import type { int } from "./scalars.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type ByteSlice = Uint8Array | Array<number>;

const toBytes = (value: ByteSlice | string): Uint8Array => {
  if (typeof value === "string") {
    return textEncoder.encode(value);
  }
  return value instanceof Uint8Array ? value : Uint8Array.from(value);
};

export interface Buffer {
  Write(bytes: ByteSlice): [int, Error | undefined];
  WriteByte(byte: number): Error | undefined;
  WriteString(text: string): [int, Error | undefined];
  String(): string;
  Bytes(): Uint8Array;
  Len(): int;
  Reset(): void;
}

class BytesBuffer implements Buffer {
  #bytes: Array<number>;

  constructor(bytes: ByteSlice = []) {
    this.#bytes = Array.from(toBytes(bytes));
  }

  Write(bytes: ByteSlice): [int, Error | undefined] {
    const source = toBytes(bytes);
    this.#bytes.push(...source);
    return [source.length as int, undefined];
  }

  WriteByte(byte: number): Error | undefined {
    this.#bytes.push(byte & 0xff);
    return undefined;
  }

  WriteString(text: string): [int, Error | undefined] {
    return this.Write(textEncoder.encode(text));
  }

  String(): string {
    return textDecoder.decode(Uint8Array.from(this.#bytes));
  }

  Bytes(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }

  Len(): int {
    return this.#bytes.length as int;
  }

  Reset(): void {
    this.#bytes.length = 0;
  }
}

export function Cut(source: ByteSlice, separator: ByteSlice): [Uint8Array, Uint8Array, boolean] {
  const haystack = toBytes(source);
  const needle = toBytes(separator);
  const index = indexOf(haystack, needle);
  if (index < 0) {
    return [haystack, new Uint8Array(), false];
  }
  return [
    haystack.slice(0, index),
    haystack.slice(index + needle.length),
    true,
  ];
}

export function Equal(left: ByteSlice, right: ByteSlice): boolean {
  const a = toBytes(left);
  const b = toBytes(right);
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

export function NewBuffer(bytes: ByteSlice): Buffer {
  return new BytesBuffer(bytes);
}

export function NewReader(bytes: ByteSlice): Uint8Array {
  return toBytes(bytes);
}

export function ReplaceAll(source: ByteSlice, oldValue: ByteSlice, newValue: ByteSlice): Uint8Array {
  const parts = Split(source, oldValue);
  if (parts.length === 1) {
    return parts[0]!;
  }
  const replacement = Array.from(toBytes(newValue));
  const result: Array<number> = [];
  for (let index = 0; index < parts.length; index++) {
    if (index > 0) {
      result.push(...replacement);
    }
    result.push(...parts[index]!);
  }
  return Uint8Array.from(result);
}

export function Split(source: ByteSlice, separator: ByteSlice): Array<Uint8Array> {
  const bytes = toBytes(source);
  const sep = toBytes(separator);
  if (sep.length === 0) {
    return Array.from(textDecoder.decode(bytes)).map((char) => textEncoder.encode(char));
  }
  const result: Array<Uint8Array> = [];
  let start = 0;
  for (;;) {
    const index = indexOf(bytes.subarray(start), sep);
    if (index < 0) {
      result.push(bytes.slice(start));
      return result;
    }
    result.push(bytes.slice(start, start + index));
    start += index + sep.length;
  }
}

export function TrimSpace(source: ByteSlice): Uint8Array {
  return textEncoder.encode(textDecoder.decode(toBytes(source)).trim());
}

const indexOf = (source: Uint8Array, search: Uint8Array): number => {
  if (search.length === 0) {
    return 0;
  }
  outer:
  for (let index = 0; index <= source.length - search.length; index++) {
    for (let offset = 0; offset < search.length; offset++) {
      if (source[index + offset] !== search[offset]) {
        continue outer;
      }
    }
    return index;
  }
  return -1;
}
