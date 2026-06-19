import type { byte, int } from "./scalars.js";
import type { GoError, GoSlice } from "./compat.js";
import * as errors from "./errors.js";

export const EOF: GoError = errors.New("EOF");

export const ErrUnexpectedEOF: GoError = errors.New("unexpected EOF");

export interface Closer {
  Close(): GoError;
}

class discardWriter implements Writer {
  Write(p: GoSlice<byte>): [int, GoError] {
    return [p.length as int, undefined];
  }
}

export const Discard: Writer = new discardWriter();

export interface ReadCloser extends Reader, Closer {
  readonly __tsgoEmpty?: never;
}

export interface Reader {
  Read(p: GoSlice<byte>): [int, GoError];
}

export function ReadFull(reader: Reader, buffer: GoSlice<byte>): [int, GoError] {
  let total = 0;
  while (total < buffer.length) {
    const view = buffer.slice(total);
    const [count, err] = reader.Read(view);
    if (count > 0) {
      for (let index = 0; index < count; index++) {
        buffer[total + index] = view[index]!;
      }
      total += count;
    }
    if (err !== undefined) {
      if (total === buffer.length) {
        return [total as int, undefined];
      }
      if (err === EOF && total > 0) {
        return [total as int, ErrUnexpectedEOF];
      }
      return [total as int, err];
    }
    if (count === 0) {
      return [total as int, total === 0 ? EOF : ErrUnexpectedEOF];
    }
  }
  return [total as int, undefined];
}

export interface ReadWriteCloser extends Reader, Writer, Closer {
  readonly __tsgoEmpty?: never;
}

export interface ReadWriter extends Reader, Writer {
  readonly __tsgoEmpty?: never;
}

export interface WriteCloser extends Writer, Closer {
  readonly __tsgoEmpty?: never;
}

export interface Writer {
  Write(p: GoSlice<byte>): [int, GoError];
}
