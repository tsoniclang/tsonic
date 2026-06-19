import type { byte, int } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";
import type { Reader as IoReader, Writer as IoWriter } from "../io.js";
import { EOF } from "../io.js";
import * as nodeZlib from "node:zlib";

export const BestCompression: int = 9 as int;

class gzipReader implements IoReader {
  private offset = 0;

  constructor(private readonly data: Uint8Array) {}

  Read(p: GoSlice<byte>): [int, GoError] {
    if (this.offset >= this.data.length) {
      return [0 as int, EOF];
    }
    const count = Math.min(p.length, this.data.length - this.offset);
    for (let index = 0; index < count; index++) {
      p[index] = this.data[this.offset + index]! as byte;
    }
    this.offset += count;
    return [count as int, undefined];
  }

  Close(): GoError {
    return undefined;
  }
}

class gzipWriter implements IoWriter {
  private readonly chunks: number[] = [];

  constructor(private readonly writer: IoWriter, private readonly level: int) {}

  Write(p: GoSlice<byte>): [int, GoError] {
    this.chunks.push(...p);
    return [p.length as int, undefined];
  }

  Close(): GoError {
    try {
      const gzipped = nodeZlib.gzipSync(Buffer.from(this.chunks), { level: this.level as number });
      const [, err] = this.writer.Write(Array.from(gzipped) as GoSlice<byte>);
      return err;
    } catch (error) {
      return normalizeError(error);
    }
  }
}

export function NewReader(source: IoReader | GoSlice<byte> | Uint8Array | string): [gzipReader | undefined, GoError] {
  try {
    const bytes = sourceToBytes(source);
    return [new gzipReader(nodeZlib.gunzipSync(Buffer.from(bytes))), undefined];
  } catch (error) {
    return [undefined, normalizeError(error)];
  }
}

export function NewWriterLevel(writer: IoWriter, level: int): [gzipWriter | undefined, GoError] {
  if ((level as number) < -1 || (level as number) > 9) {
    return [undefined, new globalThis.Error("gzip: invalid compression level")];
  }
  return [new gzipWriter(writer, level), undefined];
}

function sourceToBytes(source: IoReader | GoSlice<byte> | Uint8Array | string): Uint8Array {
  if (typeof source === "string") {
    return new TextEncoder().encode(source);
  }
  if (source instanceof Uint8Array) {
    return source;
  }
  if (globalThis.Array.isArray(source)) {
    return Uint8Array.from(source);
  }
  const chunks: number[] = [];
  const buffer = new Array<byte>(8192 as int);
  for (;;) {
    const [count, err] = source.Read(buffer);
    if ((count as number) > 0) {
      chunks.push(...buffer.slice(0, count as number));
    }
    if (err !== undefined) {
      break;
    }
    if ((count as number) === 0) {
      break;
    }
  }
  return Uint8Array.from(chunks);
}

function normalizeError(error: unknown): GoError {
  return error instanceof globalThis.Error ? error : new globalThis.Error(String(error));
}
