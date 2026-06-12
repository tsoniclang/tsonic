// Faithful TypeScript port of Go's `encoding/base64` package (the subset used by
// typescript-go's internal/sourcemap): standard RFC 4648 base64 with '+' '/' and
// '=' padding.
//
// The active call sites use:
//   - base64.StdEncoding.DecodeString(s) ([]byte, error)
//   - base64.StdEncoding.EncodedLen(n) int
//   - base64.NewEncoder(enc, w) io.WriteCloser  (streaming encode into w, flushed on Close)
//
// Go's Encoding is a value with an `encode` symbol table, a `decodeMap` reverse
// table, a padding rune, and a `strict` flag. We model it as a class whose fields
// mirror the Go struct. Go integer division (n+2)/3*4 etc. is reproduced with
// Math.trunc. Decode never panics on malformed input: it returns the partially
// decoded data together with a CorruptInputError, exactly like Go.

import type { bool, byte, int, long, uint } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../compat.js";
import { FormatInt } from "../strconv.js";
import type { WriteCloser, Writer } from "../io.js";

// Go's StdPadding ('=') and NoPadding (-1) rune constants.
const StdPaddingValue: int = 0x3d; // '='
const NoPaddingValue: int = -1;
const invalidIndex: byte = 0xff;

// CorruptInputError mirrors Go's base64.CorruptInputError(int64): an error whose
// message reports the byte offset of the illegal input.
export class CorruptInputError extends globalThis.Error {
  readonly offset: long;
  constructor(offset: long) {
    super("illegal base64 data at input byte " + FormatInt(offset, 10));
    this.name = "CorruptInputError";
    this.offset = offset;
  }
}

// An Encoding is a radix 64 encoding/decoding scheme defined by a 64-character
// alphabet, faithful to Go's base64.Encoding.
export class Encoding {
  // mapping of symbol index to symbol byte value (Go: encode [64]byte)
  private readonly encode: Uint8Array;
  // mapping of symbol byte value to symbol index (Go: decodeMap [256]uint8)
  private readonly decodeMap: Uint8Array;
  private padChar: int;
  private strict: bool;

  constructor(encoder: string) {
    // Go's NewEncoding: the alphabet must be exactly 64 bytes.
    const alphabet: Uint8Array = new globalThis.TextEncoder().encode(encoder);
    if (alphabet.length !== 64) {
      throw new globalThis.Error("encoding alphabet is not 64-bytes long");
    }
    this.encode = new globalThis.Uint8Array(64);
    this.decodeMap = new globalThis.Uint8Array(256).fill(invalidIndex);
    this.padChar = StdPaddingValue;
    this.strict = false;
    for (let i = 0; i < 64; i++) {
      const c: byte = alphabet[i]!;
      if (c === 0x0a /* '\n' */ || c === 0x0d /* '\r' */) {
        throw new globalThis.Error("encoding alphabet contains newline character");
      }
      if (this.decodeMap[c] !== invalidIndex) {
        throw new globalThis.Error("encoding alphabet includes duplicate symbols");
      }
      this.encode[i] = c;
      this.decodeMap[c] = i;
    }
  }

  // EncodedLen returns the length in bytes of the base64 encoding of an input
  // buffer of length n. Go uses integer arithmetic; we trunc to match.
  EncodedLen(n: int): int {
    if (this.padChar === NoPaddingValue) {
      return globalThis.Math.trunc(n / 3) * 4 + globalThis.Math.trunc(((n % 3) * 8 + 5) / 6);
    }
    return globalThis.Math.trunc((n + 2) / 3) * 4;
  }

  // DecodedLen returns the maximum length in bytes of the decoded data
  // corresponding to n bytes of base64-encoded data.
  DecodedLen(n: int): int {
    return decodedLen(n, this.padChar);
  }

  // Encode encodes src, writing EncodedLen(len(src)) bytes to dst.
  Encode(dst: GoSlice<byte>, src: GoSlice<byte>): void {
    if (src.length === 0) {
      return;
    }
    let di: int = 0;
    let si: int = 0;
    const n: int = globalThis.Math.trunc(src.length / 3) * 3;
    while (si < n) {
      // Convert 3x 8bit source bytes into 4 bytes.
      const val: uint = ((src[si + 0]! << 16) | (src[si + 1]! << 8) | src[si + 2]!) >>> 0;
      dst[di + 0] = this.encode[(val >>> 18) & 0x3f]!;
      dst[di + 1] = this.encode[(val >>> 12) & 0x3f]!;
      dst[di + 2] = this.encode[(val >>> 6) & 0x3f]!;
      dst[di + 3] = this.encode[val & 0x3f]!;
      si += 3;
      di += 4;
    }

    const remain: int = src.length - si;
    if (remain === 0) {
      return;
    }
    // Add the remaining small block.
    let val: uint = (src[si + 0]! << 16) >>> 0;
    if (remain === 2) {
      val = (val | (src[si + 1]! << 8)) >>> 0;
    }

    dst[di + 0] = this.encode[(val >>> 18) & 0x3f]!;
    dst[di + 1] = this.encode[(val >>> 12) & 0x3f]!;

    if (remain === 2) {
      dst[di + 2] = this.encode[(val >>> 6) & 0x3f]!;
      if (this.padChar !== NoPaddingValue) {
        dst[di + 3] = this.padChar & 0xff;
      }
    } else if (remain === 1) {
      if (this.padChar !== NoPaddingValue) {
        dst[di + 2] = this.padChar & 0xff;
        dst[di + 3] = this.padChar & 0xff;
      }
    }
  }

  // EncodeToString returns the base64 encoding of src.
  EncodeToString(src: GoSlice<byte>): string {
    const buf: GoSlice<byte> = new globalThis.Array<byte>(this.EncodedLen(src.length)).fill(0);
    this.Encode(buf, src);
    return new globalThis.TextDecoder("utf-8").decode(globalThis.Uint8Array.from(buf));
  }

  // DecodeString returns the bytes represented by the base64 string s. On
  // malformed input it returns the partially decoded data and a CorruptInputError
  // (returned, never thrown), matching Go.
  DecodeString(s: string): [GoSlice<byte>, GoError] {
    const src: GoSlice<byte> = globalThis.Array.from(new globalThis.TextEncoder().encode(s));
    const dbuf: GoSlice<byte> = new globalThis.Array<byte>(this.DecodedLen(src.length)).fill(0);
    const [n, err] = this.Decode(dbuf, src);
    return [dbuf.slice(0, n), err];
  }

  // Decode decodes src using this encoding. It returns the number of bytes
  // written and, on invalid input, a CorruptInputError.
  Decode(dst: GoSlice<byte>, src: GoSlice<byte>): [int, GoError] {
    if (src.length === 0) {
      return [0, undefined];
    }
    let si: int = 0;
    let n: int = 0;
    // No SIMD assemble fast-path: it produces identical results, so the
    // quantum-by-quantum loop alone is a faithful decode.
    while (si < src.length) {
      const [nsi, ninc, err] = this.decodeQuantum(dst, n, src, si);
      si = nsi;
      n += ninc;
      if (err !== undefined) {
        return [n, err];
      }
    }
    return [n, undefined];
  }

  // decodeQuantum decodes up to 4 base64 bytes from src starting at si, writing
  // into dst at offset dstOff. Returns [nextSi, bytesWritten, error]. Faithful
  // port of Go's (*Encoding).decodeQuantum.
  private decodeQuantum(dst: GoSlice<byte>, dstOff: int, src: GoSlice<byte>, si: int): [int, int, GoError] {
    const dbuf: Uint8Array = new globalThis.Uint8Array(4);
    let dlen: int = 4;

    let err: GoError = undefined;
    for (let j = 0; j < 4; j++) {
      if (src.length === si) {
        if (j === 0) {
          return [si, 0, undefined];
        }
        if (j === 1 || this.padChar !== NoPaddingValue) {
          return [si, 0, new CorruptInputError(si - j)];
        }
        dlen = j;
        break;
      }
      const inByte: byte = src[si]!;
      si++;

      const out: byte = this.decodeMap[inByte]!;
      if (out !== 0xff) {
        dbuf[j] = out;
        continue;
      }

      if (inByte === 0x0a /* '\n' */ || inByte === 0x0d /* '\r' */) {
        j--;
        continue;
      }

      if (inByte !== this.padChar) {
        return [si, 0, new CorruptInputError(si - 1)];
      }

      // We've reached the end and there's padding.
      if (j === 0 || j === 1) {
        // incorrect padding
        return [si, 0, new CorruptInputError(si - 1)];
      }
      if (j === 2) {
        // "==" is expected, the first "=" is already consumed; skip newlines.
        while (si < src.length && (src[si] === 0x0a || src[si] === 0x0d)) {
          si++;
        }
        if (si === src.length) {
          // not enough padding
          return [si, 0, new CorruptInputError(src.length)];
        }
        if (src[si]! !== this.padChar) {
          // incorrect padding
          return [si, 0, new CorruptInputError(si - 1)];
        }
        si++;
      }

      // skip over newlines
      while (si < src.length && (src[si] === 0x0a || src[si] === 0x0d)) {
        si++;
      }
      if (si < src.length) {
        // trailing garbage
        err = new CorruptInputError(si);
      }
      dlen = j;
      break;
    }

    // Convert 4x 6bit source bytes into 3 bytes.
    const val: uint = (((dbuf[0]! << 18) | (dbuf[1]! << 12) | (dbuf[2]! << 6) | dbuf[3]!) >>> 0);
    const b2: byte = (val >>> 0) & 0xff;
    const b1: byte = (val >>> 8) & 0xff;
    const b0: byte = (val >>> 16) & 0xff;
    dbuf[2] = b2;
    dbuf[1] = b1;
    dbuf[0] = b0;
    // dlen falls through from 4 -> 3 -> 2 in Go; replicate explicitly.
    if (dlen >= 4) {
      dst[dstOff + 2] = dbuf[2]!;
      dbuf[2] = 0;
    }
    if (dlen >= 3) {
      dst[dstOff + 1] = dbuf[1]!;
      if (this.strict && dbuf[2] !== 0) {
        return [si, 0, new CorruptInputError(si - 1)];
      }
      dbuf[1] = 0;
    }
    if (dlen >= 2) {
      dst[dstOff + 0] = dbuf[0]!;
      if (this.strict && (dbuf[1] !== 0 || dbuf[2] !== 0)) {
        return [si, 0, new CorruptInputError(si - 2)];
      }
    }

    return [si, dlen - 1, err];
  }
}

// decodedLen mirrors Go's package-level decodedLen(n, padChar).
function decodedLen(n: int, padChar: int): int {
  if (padChar === NoPaddingValue) {
    // Unpadded data may end with partial block of 2-3 characters.
    return globalThis.Math.trunc(n / 4) * 3 + globalThis.Math.trunc(((n % 4) * 6) / 8);
  }
  // Padded base64 should always be a multiple of 4 characters in length.
  return globalThis.Math.trunc(n / 4) * 3;
}

// StdEncoding is the standard base64 encoding, as defined in RFC 4648.
export const StdEncoding: Encoding = new Encoding(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
);

// encoder is Go's *encoder: an io.WriteCloser that streams base64 into a writer w
// and must be Close()d to flush a final partial group. The buffered fringe (buf,
// nbuf) and sticky error mirror the Go struct fields exactly.
class encoder implements WriteCloser {
  private err: GoError = undefined;
  private readonly enc: Encoding;
  private readonly w: Writer;
  private readonly buf: Uint8Array = new globalThis.Uint8Array(3);
  private nbuf: int = 0;
  private readonly out: Uint8Array = new globalThis.Uint8Array(1024);

  constructor(enc: Encoding, w: Writer) {
    this.enc = enc;
    this.w = w;
  }

  Write(p: GoSlice<byte>): [int, GoError] {
    if (this.err !== undefined) {
      return [0, this.err];
    }

    let n: int = 0;

    // Leading fringe.
    if (this.nbuf > 0) {
      let i: int = 0;
      for (i = 0; i < p.length && this.nbuf < 3; i++) {
        this.buf[this.nbuf] = p[i]!;
        this.nbuf++;
      }
      n += i;
      p = p.slice(i);
      if (this.nbuf < 3) {
        return [n, undefined];
      }
      const outChunk: GoSlice<byte> = globalThis.Array.from(this.out);
      this.enc.Encode(outChunk, globalThis.Array.from(this.buf));
      const [, werr] = this.w.Write(outChunk.slice(0, 4));
      this.err = werr;
      if (this.err !== undefined) {
        return [n, this.err];
      }
      this.nbuf = 0;
    }

    // Large interior chunks.
    while (p.length >= 3) {
      let nn: int = globalThis.Math.trunc(this.out.length / 4) * 3;
      if (nn > p.length) {
        nn = p.length;
        nn -= nn % 3;
      }
      const outChunk: GoSlice<byte> = globalThis.Array.from(this.out);
      this.enc.Encode(outChunk, p.slice(0, nn));
      const [, werr] = this.w.Write(outChunk.slice(0, globalThis.Math.trunc(nn / 3) * 4));
      this.err = werr;
      if (this.err !== undefined) {
        return [n, this.err];
      }
      n += nn;
      p = p.slice(nn);
    }

    // Trailing fringe.
    for (let k = 0; k < p.length; k++) {
      this.buf[k] = p[k]!;
    }
    this.nbuf = p.length;
    n += p.length;
    return [n, undefined];
  }

  // Close flushes any pending output. It is an error to Write after Close.
  Close(): GoError {
    if (this.err === undefined && this.nbuf > 0) {
      const outChunk: GoSlice<byte> = globalThis.Array.from(this.out);
      this.enc.Encode(outChunk, globalThis.Array.from(this.buf.subarray(0, this.nbuf)));
      const [, werr] = this.w.Write(outChunk.slice(0, this.enc.EncodedLen(this.nbuf)));
      this.err = werr;
      this.nbuf = 0;
    }
    return this.err;
  }
}

// NewEncoder returns a new base64 stream encoder. Data written to the returned
// writer is encoded using enc and written to w; the caller must Close it to flush
// any partially written block.
export function NewEncoder(enc: Encoding, w: Writer): WriteCloser {
  return new encoder(enc, w);
}
