import type { byte, int } from "./scalars.js";
import type { GoError, GoSlice } from "./compat.js";
import type { Reader as IoReader, Writer as IoWriter } from "./io.js";
import { EOF } from "./io.js";

export class Reader implements IoReader {
  private readonly buffer: GoSlice<byte> = [];

  constructor(private readonly source: IoReader) {}

  Read(p: GoSlice<byte>): [int, GoError] {
    let count = 0;
    while (count < p.length) {
      const [b, err] = this.ReadByte();
      if (err !== undefined) {
        return [count as int, count > 0 ? undefined : err];
      }
      p[count] = b;
      count++;
    }
    return [count as int, undefined];
  }

  ReadByte(): [byte, GoError] {
    if (this.buffer.length > 0) {
      return [this.buffer.shift()!, undefined];
    }
    const one: GoSlice<byte> = [0 as byte];
    const [n, err] = this.source.Read(one);
    if (n > 0) {
      return [one[0]!, undefined];
    }
    return [0 as byte, err ?? EOF];
  }

  ReadBytes(delim: byte): [GoSlice<byte>, GoError] {
    const out: GoSlice<byte> = [];
    for (;;) {
      const [b, err] = this.ReadByte();
      if (err !== undefined) {
        return [out, err];
      }
      out.push(b);
      if (b === delim) {
        return [out, undefined];
      }
    }
  }
}

export class Writer implements IoWriter {
  private readonly buffer: GoSlice<byte> = [];

  constructor(private readonly target: IoWriter) {}

  Write(p: GoSlice<byte>): [int, GoError] {
    this.buffer.push(...p);
    return [p.length as int, undefined];
  }

  WriteString(s: string): [int, GoError] {
    const bytes = new globalThis.TextEncoder().encode(s);
    for (const b of bytes) {
      this.buffer.push(b as byte);
    }
    return [bytes.length as int, undefined];
  }

  Flush(): GoError {
    if (this.buffer.length === 0) {
      return undefined;
    }
    const data = this.buffer.splice(0, this.buffer.length);
    const [, err] = this.target.Write(data);
    return err;
  }
}

export class Scanner {
  private readonly lines: string[];
  private index = -1;

  constructor(reader: IoReader) {
    const bytes: GoSlice<byte> = [];
    for (;;) {
      const chunk: GoSlice<byte> = new globalThis.Array(4096).fill(0) as GoSlice<byte>;
      const [n, err] = reader.Read(chunk);
      if (n > 0) {
        bytes.push(...chunk.slice(0, n));
      }
      if (err !== undefined || n === 0) {
        break;
      }
    }
    this.lines = new globalThis.TextDecoder("utf-8").decode(Uint8Array.from(bytes)).split(/\r?\n/);
  }

  Scan(): boolean {
    if (this.index + 1 >= this.lines.length) {
      return false;
    }
    this.index++;
    return true;
  }

  Text(): string {
    return this.index >= 0 && this.index < this.lines.length ? this.lines[this.index]! : "";
  }

  Err(): GoError {
    return undefined;
  }
}

export function NewReader(reader: IoReader): Reader {
  return new Reader(reader);
}

export function NewScanner(reader: IoReader): Scanner {
  return new Scanner(reader);
}

export function NewWriter(writer: IoWriter): Writer {
  return new Writer(writer);
}
