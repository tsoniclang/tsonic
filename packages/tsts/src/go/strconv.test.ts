import test from "node:test";
import assert from "node:assert/strict";
import {
  Atoi,
  Itoa,
  ParseInt,
  ParseUint,
  ParseFloat,
  ParseBool,
  FormatInt,
  FormatUint,
  ErrRange,
  ErrSyntax,
  NumError,
} from "./strconv.js";
import { Is } from "./errors.js";

test("strconv.Atoi parses base-10 integers", () => {
  assert.deepEqual(Atoi("42"), [42, undefined]);
  assert.deepEqual(Atoi("-7"), [-7, undefined]);
  assert.deepEqual(Atoi("+5"), [5, undefined]);
  assert.deepEqual(Atoi("0"), [0, undefined]);
});

test("strconv.Atoi reports a NumError on invalid syntax", () => {
  const [value, err] = Atoi("12x");
  assert.equal(value, 0);
  assert.ok(err instanceof NumError);
  assert.equal(Is(err, ErrSyntax), true);
});

test("strconv.Atoi reports a syntax error on empty string", () => {
  const [value, err] = Atoi("");
  assert.equal(value, 0);
  assert.equal(Is(err, ErrSyntax), true);
});

test("strconv.Itoa formats integers in base 10", () => {
  assert.equal(Itoa(42), "42");
  assert.equal(Itoa(-7), "-7");
  assert.equal(Itoa(0), "0");
});

test("strconv.ParseInt respects base", () => {
  assert.deepEqual(ParseInt("ff", 16, 64), [255, undefined]);
  assert.deepEqual(ParseInt("777", 8, 64), [511, undefined]);
  assert.deepEqual(ParseInt("101", 2, 64), [5, undefined]);
  assert.deepEqual(ParseInt("-10", 10, 32), [-10, undefined]);
});

test("strconv.ParseInt with base 0 infers from prefix", () => {
  assert.deepEqual(ParseInt("0x1A", 0, 64), [26, undefined]);
  assert.deepEqual(ParseInt("0o17", 0, 64), [15, undefined]);
  assert.deepEqual(ParseInt("0b110", 0, 64), [6, undefined]);
  assert.deepEqual(ParseInt("017", 0, 64), [15, undefined]);
  assert.deepEqual(ParseInt("42", 0, 64), [42, undefined]);
});

test("strconv.ParseInt reports range error and clamps on overflow", () => {
  const [value, err] = ParseInt("99999", 10, 16);
  assert.equal(Is(err, ErrRange), true);
  // int16 max is 32767.
  assert.equal(value, 32767);
});

test("strconv.ParseUint rejects a leading sign", () => {
  const [value, err] = ParseUint("-5", 10, 32);
  assert.equal(value, 0);
  assert.equal(Is(err, ErrSyntax), true);
});

test("strconv.ParseUint parses unsigned values", () => {
  assert.deepEqual(ParseUint("4294967295", 10, 32), [4294967295, undefined]);
  assert.deepEqual(ParseUint("255", 10, 32), [255, undefined]);
});

test("strconv.ParseFloat parses decimal floats", () => {
  assert.deepEqual(ParseFloat("3.14", 64), [3.14, undefined]);
  assert.deepEqual(ParseFloat("-0.5", 64), [-0.5, undefined]);
  assert.deepEqual(ParseFloat("1e3", 64), [1000, undefined]);
});

test("strconv.ParseFloat returns Inf with ErrRange on overflow", () => {
  const [value, err] = ParseFloat("1e400", 64);
  assert.equal(value, globalThis.Infinity);
  assert.equal(Is(err, ErrRange), true);
});

test("strconv.ParseFloat rejects malformed input", () => {
  const [, err] = ParseFloat("abc", 64);
  assert.equal(Is(err, ErrSyntax), true);
});

test("strconv.ParseBool accepts the documented spellings", () => {
  for (const truthy of ["1", "t", "T", "TRUE", "true", "True"]) {
    assert.deepEqual(ParseBool(truthy), [true, undefined]);
  }
  for (const falsy of ["0", "f", "F", "FALSE", "false", "False"]) {
    assert.deepEqual(ParseBool(falsy), [false, undefined]);
  }
  const [, err] = ParseBool("yes");
  assert.equal(Is(err, ErrSyntax), true);
});

test("strconv.FormatInt formats in the given base", () => {
  assert.equal(FormatInt(255, 16), "ff");
  assert.equal(FormatInt(511, 8), "777");
  assert.equal(FormatInt(-10, 10), "-10");
  assert.equal(FormatInt(5, 2), "101");
});

test("strconv.FormatUint formats unsigned values", () => {
  assert.equal(FormatUint(255, 16), "ff");
  assert.equal(FormatUint(8, 10), "8");
});

test("strconv NumError unwraps to its sentinel", () => {
  const [, err] = ParseInt("zzz", 10, 32);
  assert.ok(err instanceof NumError);
  assert.equal((err as NumError).Unwrap(), ErrSyntax);
});
