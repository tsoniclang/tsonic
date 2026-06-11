import { test } from "node:test";
import assert from "node:assert/strict";
import * as strings from "./strings.js";

test("HasPrefix / HasSuffix", () => {
  assert.equal(strings.HasPrefix("hello", "he"), true);
  assert.equal(strings.HasPrefix("hello", "lo"), false);
  assert.equal(strings.HasSuffix("hello", "lo"), true);
  assert.equal(strings.HasSuffix("hello", "he"), false);
});

test("Contains / ContainsAny / ContainsRune", () => {
  assert.equal(strings.Contains("seafood", "foo"), true);
  assert.equal(strings.Contains("seafood", "bar"), false);
  assert.equal(strings.Contains("seafood", ""), true);
  assert.equal(strings.ContainsAny("seafood", "xyz"), false);
  assert.equal(strings.ContainsAny("seafood", "fyz"), true);
  assert.equal(strings.ContainsRune("seafood", "o".codePointAt(0)!), true);
  assert.equal(strings.ContainsRune("seafood", "z".codePointAt(0)!), false);
});

test("Index returns byte offsets", () => {
  assert.equal(strings.Index("chicken", "ken"), 4);
  assert.equal(strings.Index("chicken", "dmr"), -1);
  assert.equal(strings.Index("hello", ""), 0);
  // "é" is 2 UTF-8 bytes; "llo" starts at byte offset 3.
  assert.equal(strings.Index("héllo", "llo"), 3);
});

test("IndexByte / LastIndexByte", () => {
  assert.equal(strings.IndexByte("golang", "g".codePointAt(0)!), 0);
  assert.equal(strings.LastIndexByte("golang", "g".codePointAt(0)!), 5);
  assert.equal(strings.IndexByte("golang", "x".codePointAt(0)!), -1);
});

test("IndexRune / IndexAny", () => {
  assert.equal(strings.IndexRune("chicken", "k".codePointAt(0)!), 4);
  assert.equal(strings.IndexRune("chicken", "z".codePointAt(0)!), -1);
  assert.equal(strings.IndexAny("chicken", "aeiouy"), 2);
  assert.equal(strings.IndexAny("crwth", "aeiouy"), -1);
});

test("IndexFunc / LastIndexFunc", () => {
  const isDigit = (r: number): boolean => r >= 0x30 && r <= 0x39;
  assert.equal(strings.IndexFunc("ab12cd", isDigit), 2);
  assert.equal(strings.LastIndexFunc("ab12cd", isDigit), 3);
  assert.equal(strings.IndexFunc("abcd", isDigit), -1);
});

test("LastIndex", () => {
  assert.equal(strings.LastIndex("go gopher", "go"), 3);
  assert.equal(strings.LastIndex("go gopher", "rodent"), -1);
});

test("Count", () => {
  assert.equal(strings.Count("cheese", "e"), 3);
  assert.equal(strings.Count("five", ""), 5);
  assert.equal(strings.Count("", ""), 1);
});

test("Join", () => {
  assert.equal(strings.Join(["a", "b", "c"], "-"), "a-b-c");
  assert.equal(strings.Join([], ","), "");
  assert.equal(strings.Join(["solo"], ","), "solo");
});

test("Split / SplitN", () => {
  assert.deepEqual(strings.Split("a,b,c", ","), ["a", "b", "c"]);
  assert.deepEqual(strings.Split("a", ","), ["a"]);
  assert.deepEqual(strings.Split("", ","), [""]);
  assert.deepEqual(strings.Split("abc", ""), ["a", "b", "c"]);
  assert.deepEqual(strings.SplitN("a,b,c", ",", 2), ["a", "b,c"]);
  assert.deepEqual(strings.SplitN("a,b,c", ",", 0), []);
});

test("Fields", () => {
  assert.deepEqual(strings.Fields("  foo bar  baz   "), ["foo", "bar", "baz"]);
  assert.deepEqual(strings.Fields(""), []);
  assert.deepEqual(strings.Fields("\t a\n"), ["a"]);
});

test("Cut / CutPrefix / CutSuffix", () => {
  assert.deepEqual(strings.Cut("Gopher", "ph"), ["Go", "er", true]);
  assert.deepEqual(strings.Cut("Gopher", "xx"), ["Gopher", "", false]);
  assert.deepEqual(strings.CutPrefix("Gopher", "Go"), ["pher", true]);
  assert.deepEqual(strings.CutPrefix("Gopher", "xx"), ["Gopher", false]);
  assert.deepEqual(strings.CutSuffix("Gopher", "er"), ["Goph", true]);
  assert.deepEqual(strings.CutSuffix("Gopher", "xx"), ["Gopher", false]);
});

test("Trim family", () => {
  assert.equal(strings.TrimSpace("  hi \t\n"), "hi");
  assert.equal(strings.Trim("xxhixx", "x"), "hi");
  assert.equal(strings.TrimLeft("xxhixx", "x"), "hixx");
  assert.equal(strings.TrimRight("xxhixx", "x"), "xxhi");
  assert.equal(strings.TrimPrefix("hello", "he"), "llo");
  assert.equal(strings.TrimPrefix("hello", "xx"), "hello");
  assert.equal(strings.TrimSuffix("hello", "lo"), "hel");
  assert.equal(strings.TrimSuffix("hello", "xx"), "hello");
});

test("TrimFunc family", () => {
  const isX = (r: number): boolean => r === "x".codePointAt(0)!;
  assert.equal(strings.TrimFunc("xxhixx", isX), "hi");
  assert.equal(strings.TrimLeftFunc("xxhixx", isX), "hixx");
  assert.equal(strings.TrimRightFunc("xxhixx", isX), "xxhi");
});

test("Replace / ReplaceAll", () => {
  assert.equal(strings.Replace("oink oink oink", "k", "ky", 2), "oinky oinky oink");
  assert.equal(strings.Replace("oink oink oink", "oink", "moo", -1), "moo moo moo");
  assert.equal(strings.ReplaceAll("oink oink oink", "oink", "moo"), "moo moo moo");
  assert.equal(strings.Replace("abc", "", "-", -1), "-a-b-c-");
});

test("Repeat", () => {
  assert.equal(strings.Repeat("ab", 3), "ababab");
  assert.equal(strings.Repeat("x", 0), "");
});

test("ToLower / ToUpper", () => {
  assert.equal(strings.ToLower("Gopher"), "gopher");
  assert.equal(strings.ToUpper("Gopher"), "GOPHER");
});

test("Compare", () => {
  assert.equal(strings.Compare("a", "b"), -1);
  assert.equal(strings.Compare("b", "a"), 1);
  assert.equal(strings.Compare("a", "a"), 0);
  assert.equal(strings.Compare("a", "ab"), -1);
});

test("EqualFold", () => {
  assert.equal(strings.EqualFold("Go", "GO"), true);
  assert.equal(strings.EqualFold("Go", "no"), false);
});

test("Map drops negative results", () => {
  const rot = (r: number): number => {
    if (r >= "a".codePointAt(0)! && r <= "z".codePointAt(0)!) {
      return r - 32; // uppercase
    }
    if (r === " ".codePointAt(0)!) {
      return -1; // drop spaces
    }
    return r;
  };
  assert.equal(strings.Map(rot, "a b c"), "ABC");
});

test("Clone returns equal string", () => {
  assert.equal(strings.Clone("hello"), "hello");
});

test("Builder accumulates", () => {
  const b = new strings.Builder();
  b.WriteString("foo");
  b.WriteByte("-".codePointAt(0)!);
  b.WriteRune("é".codePointAt(0)!);
  assert.equal(b.String(), "foo-é");
  assert.equal(b.Len(), encodeLen("foo-é"));
  b.Reset();
  assert.equal(b.String(), "");
  assert.equal(b.Len(), 0);
});

const encodeLen = (s: string): number => new TextEncoder().encode(s).length;

test("NewReader reads bytes and runes", () => {
  const r = strings.NewReader("aé");
  assert.equal(r.Size(), encodeLen("aé"));
  const [b, err] = r.ReadByte();
  assert.equal(err, undefined);
  assert.equal(b, "a".codePointAt(0)!);
  const [rune, size, rerr] = r.ReadRune();
  assert.equal(rerr, undefined);
  assert.equal(rune, "é".codePointAt(0)!);
  assert.equal(size, 2);
});

test("NewReplacer", () => {
  const rep = strings.NewReplacer("a", "1", "b", "2");
  assert.equal(rep.Replace("abc"), "12c");
});

test("Lines iterator", () => {
  const lines: Array<string> = [];
  strings.Lines("a\nb\nc")((l) => {
    lines.push(l);
    return true;
  });
  assert.deepEqual(lines, ["a\n", "b\n", "c"]);
});

test("SplitSeq iterator", () => {
  const parts: Array<string> = [];
  strings.SplitSeq("a,b,c", ",")((p) => {
    parts.push(p);
    return true;
  });
  assert.deepEqual(parts, ["a", "b", "c"]);
});

test("ToValidUTF8 passes through valid input", () => {
  assert.equal(strings.ToValidUTF8("abc", "�"), "abc");
});
