import test from "node:test";
import assert from "node:assert/strict";
import {
  Sprintf,
  Sprint,
  Sprintln,
  Errorf,
  Fprint,
  Fprintf,
  Fprintln,
  Println,
} from "./fmt.js";
import type { Stringer } from "./fmt.js";
import { Is } from "./errors.js";
import type { byte, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "./compat.js";

// A minimal in-memory io.Writer for exercising Fprint*.
class StringWriter {
  buf = "";
  Write(p: GoSlice<byte>): [int, GoError] {
    this.buf += globalThis.Buffer.from(p).toString("utf8");
    return [p.length, undefined];
  }
}

test("fmt.Sprintf handles %s %d %v", () => {
  assert.equal(Sprintf("%s=%d", "n", 42), "n=42");
  assert.equal(Sprintf("%v", 7), "7");
  assert.equal(Sprintf("%v", true), "true");
  assert.equal(Sprintf("%v", "hi"), "hi");
});

test("fmt.Sprintf handles %q quoting", () => {
  assert.equal(Sprintf("%q", "a\"b"), '"a\\"b"');
  assert.equal(Sprintf("%q", "line\n"), '"line\\n"');
});

test("fmt.Sprintf handles integer bases and the # flag", () => {
  assert.equal(Sprintf("%x", 255), "ff");
  assert.equal(Sprintf("%X", 255), "FF");
  assert.equal(Sprintf("%#x", 255), "0xff");
  assert.equal(Sprintf("%o", 8), "10");
  assert.equal(Sprintf("%b", 5), "101");
});

test("fmt.Sprintf handles width, zero padding, and left alignment", () => {
  assert.equal(Sprintf("%6d", 42), "    42");
  assert.equal(Sprintf("%-6d|", 42), "42    |");
  assert.equal(Sprintf("%06d", 42), "000042");
  assert.equal(Sprintf("%016x", 255), "00000000000000ff");
  assert.equal(Sprintf("%02x", 5), "05");
});

test("fmt.Sprintf handles the + and space sign flags", () => {
  assert.equal(Sprintf("%+d", 42), "+42");
  assert.equal(Sprintf("% d", 42), " 42");
  assert.equal(Sprintf("%+d", -42), "-42");
});

test("fmt.Sprintf handles the * width argument", () => {
  assert.equal(Sprintf("%*d", 6, 42), "    42");
  assert.equal(Sprintf("%-*s|", 6, "hi"), "hi    |");
});

test("fmt.Sprintf handles %c rune and %U", () => {
  assert.equal(Sprintf("%c", 65), "A");
  assert.equal(Sprintf("%U", 0x1f600), "U+1F600");
});

test("fmt.Sprintf handles %t boolean", () => {
  assert.equal(Sprintf("%t", true), "true");
  assert.equal(Sprintf("%t", false), "false");
});

test("fmt.Sprintf handles floats", () => {
  assert.equal(Sprintf("%.3f", 3.14159), "3.142");
  assert.equal(Sprintf("%f", 1.5), "1.500000");
  assert.equal(Sprintf("%E", 12345.6789), "1.234568E+04");
});

test("fmt.Sprintf handles %% literal percent", () => {
  assert.equal(Sprintf("100%%"), "100%");
});

test("fmt.Sprintf calls Stringer for %v and %s", () => {
  const stringer: Stringer = { String: () => "I am stringer" };
  assert.equal(Sprintf("%v", stringer), "I am stringer");
  assert.equal(Sprintf("%s", stringer), "I am stringer");
});

test("fmt.Sprintf formats errors via their message for %v and %s", () => {
  const err = new globalThis.Error("kaboom");
  assert.equal(Sprintf("%v", err), "kaboom");
  assert.equal(Sprintf("%s", err), "kaboom");
});

test("fmt.Sprintf %T reports a Go-ish type name", () => {
  assert.equal(Sprintf("%T", "x"), "string");
  assert.equal(Sprintf("%T", 5), "int");
  assert.equal(Sprintf("%T", true), "bool");
});

test("fmt.Sprintf %+v adds struct field names", () => {
  class Point {
    constructor(public x: number, public y: number) {}
  }
  assert.equal(Sprintf("%v", new Point(1, 2)), "{1 2}");
  assert.equal(Sprintf("%+v", new Point(1, 2)), "{x:1 y:2}");
});

test("fmt.Errorf returns an error with the formatted message", () => {
  const err = Errorf("failed: %s (%d)", "io", 7);
  assert.ok(err instanceof globalThis.Error);
  assert.equal((err as Error).message, "failed: io (7)");
});

test("fmt.Errorf %w wraps an error so errors.Is sees it", () => {
  const root = new globalThis.Error("root");
  const wrapped = Errorf("context: %w", root);
  assert.equal((wrapped as Error).message, "context: root");
  assert.equal(Is(wrapped, root), true);
});

test("fmt.Sprint adds spaces only between non-string operands", () => {
  assert.equal(Sprint(1, 2, 3), "1 2 3");
  assert.equal(Sprint("a", "b"), "ab");
  assert.equal(Sprint("a", 1), "a1");
  assert.equal(Sprint(1, "a", 2), "1a2");
});

test("fmt.Sprintln always spaces and appends newline", () => {
  assert.equal(Sprintln("a", "b"), "a b\n");
  assert.equal(Sprintln(1, 2), "1 2\n");
});

test("fmt.Fprint writes default-formatted operands to the writer", () => {
  const w = new StringWriter();
  const [n, err] = Fprint(w, "tsgo ", "x", "\n");
  assert.equal(err, undefined);
  assert.equal(w.buf, "tsgo x\n");
  assert.equal(n, globalThis.Buffer.byteLength("tsgo x\n"));
});

test("fmt.Fprintf writes formatted output to the writer", () => {
  const w = new StringWriter();
  Fprintf(w, "%s=%d", "k", 9);
  assert.equal(w.buf, "k=9");
});

test("fmt.Fprintln writes spaced operands and a newline", () => {
  const w = new StringWriter();
  Fprintln(w, "a", "b");
  assert.equal(w.buf, "a b\n");
});

test("fmt.Println returns the byte count and no error", () => {
  const [n, err] = Println("hi");
  assert.equal(err, undefined);
  assert.equal(n, globalThis.Buffer.byteLength("hi\n"));
});
