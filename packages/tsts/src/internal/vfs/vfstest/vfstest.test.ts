import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "../../../go/scalars.js";
import { ReadDir, ReadFile, Stat } from "../../../go/io/fs.js";
import { TestFS } from "../../../go/testing/fstest.js";
import type { MapFile, MapFS as FstestMapFS } from "../../../go/testing/fstest.js";
import { ModeDir } from "../../../go/io/fs.js";
import type { Clock } from "./vfstest.js";
import {
  convertMapFS,
  FromMap,
  MapFS_as_io_fs_FS,
  MapFS_Realpath,
  Symlink,
} from "./vfstest.js";

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function assertErrorContains(error: unknown, expected: string): void {
  assert.ok(error instanceof Error, `expected error containing ${expected}`);
  assert.ok(error.message.includes(expected), `got ${error.message}, want substring ${expected}`);
}

function dirEntriesToNames(entries: Array<{ Name(): string }>): string[] {
  return entries.map((entry) => entry.Name());
}

function nilClock(): Clock {
  return undefined as unknown as Clock;
}

test("convertMapFS mirrors TS-Go case-insensitive lookup and realpath behavior", () => {
  const contents = bytes("bar");
  const map = new Map<string, MapFile>([
    ["foo/bar/baz", { Data: contents, Sys: 1234 }],
    ["foo/bar2/baz2", { Data: contents, Sys: 1234 }],
    ["foo/bar3/baz3", { Data: contents, Sys: 1234 }],
  ]) as FstestMapFS;
  const mapFS = convertMapFS(map, false as bool, nilClock());
  const fs = MapFS_as_io_fs_FS(mapFS);

  assert.deepEqual(ReadFile(fs, "foo/bar/baz"), ["bar", undefined]);
  const [sensitiveInfo, sensitiveInfoErr] = Stat(fs, "foo/bar/baz");
  assert.equal(sensitiveInfoErr, undefined);
  assert.equal(sensitiveInfo.Sys(), 1234);
  assert.deepEqual(MapFS_Realpath(mapFS, "foo/bar/baz"), ["foo/bar/baz", undefined]);
  assert.deepEqual(dirEntriesToNames(ReadDir(fs, "foo")[0]), ["bar", "bar2", "bar3"]);
  assert.equal(TestFS(fs, "foo/bar/baz"), undefined);

  assert.deepEqual(ReadFile(fs, "Foo/Bar/Baz"), ["bar", undefined]);
  const [insensitiveInfo, insensitiveInfoErr] = Stat(fs, "Foo/Bar/Baz");
  assert.equal(insensitiveInfoErr, undefined);
  assert.equal(insensitiveInfo.Sys(), 1234);
  assert.deepEqual(MapFS_Realpath(mapFS, "Foo/Bar/Baz"), ["foo/bar/baz", undefined]);
  assert.deepEqual(dirEntriesToNames(ReadDir(fs, "Foo")[0]), ["bar", "bar2", "bar3"]);

  assertErrorContains(MapFS_Realpath(mapFS, "does/not/exist")[1], "file does not exist");
  assertErrorContains(Stat(fs, "does/not/exist")[1], "file does not exist");
});

test("convertMapFS mirrors TS-Go case-sensitive lookup behavior", () => {
  const contents = bytes("bar");
  const map = new Map<string, MapFile>([
    ["foo/bar/baz", { Data: contents, Sys: 1234 }],
    ["foo/bar2/baz2", { Data: contents, Sys: 1234 }],
    ["foo/bar3/baz3", { Data: contents, Sys: 1234 }],
  ]) as FstestMapFS;
  const fs = MapFS_as_io_fs_FS(convertMapFS(map, true as bool, nilClock()));

  assert.deepEqual(ReadFile(fs, "foo/bar/baz"), ["bar", undefined]);
  assert.equal(Stat(fs, "foo/bar/baz")[0].Sys(), 1234);
  assert.equal(TestFS(fs, "foo/bar/baz"), undefined);
  assertErrorContains(ReadFile(fs, "Foo/Bar/Baz")[1], "file does not exist");
});

test("convertMapFS mirrors TS-Go duplicate and parent-file panics", () => {
  assert.throws(
    () => convertMapFS(new Map<string, MapFile>([
      ["foo", { Data: bytes("bar") }],
      ["Foo", { Data: bytes("baz") }],
    ]) as FstestMapFS, false as bool, nilClock()),
    /duplicate path: "Foo" and "foo" have the same canonical path/,
  );

  assert.doesNotThrow(() => convertMapFS(new Map<string, MapFile>([
    ["foo", { Data: bytes("bar") }],
    ["Foo", { Data: bytes("baz") }],
  ]) as FstestMapFS, true as bool, nilClock()));

  assert.throws(
    () => convertMapFS(new Map<string, MapFile>([
      ["foo", { Data: bytes("bar") }],
      ["foo/oops", { Data: bytes("baz") }],
    ]) as FstestMapFS, false as bool, nilClock()),
    /failed to create intermediate directories for "foo\/oops": mkdir "foo": path exists but is not a directory/,
  );
});

test("FromMap mirrors TS-Go read/write/delete and path validation behavior", () => {
  const fs = FromMap<unknown>(new Map(), false as bool);

  assert.equal(fs.WriteFile("/foo/bar/baz", "hello, world"), undefined);
  assert.deepEqual(fs.ReadFile("/foo/bar/baz"), ["hello, world", true]);

  assert.equal(fs.WriteFile("/foo/bar/baz", "goodbye, world"), undefined);
  assert.deepEqual(fs.ReadFile("/foo/bar/baz"), ["goodbye, world", true]);

  assertErrorContains(fs.WriteFile("/foo/bar/baz/oops", "goodbye, world"), `mkdir "foo/bar/baz": path exists but is not a directory`);

  assert.equal(fs.WriteFile("/foo/bar/file.ts", "remove"), undefined);
  assert.equal(fs.FileExists("/foo/bar/file.ts"), true);
  assert.equal(fs.Remove("/foo/bar/file.ts"), undefined);
  assert.equal(fs.FileExists("/foo/bar/file.ts"), false);

  assert.equal(fs.WriteFile("/foo/bar/test/remove2.ts", "remove2"), undefined);
  assert.equal(fs.DirectoryExists("/foo/bar/test"), true);
  assert.equal(fs.Remove("/foo/bar/test"), undefined);
  assert.equal(fs.FileExists("/foo/bar/test/remove2.ts"), false);
  assert.equal(fs.DirectoryExists("/foo/bar/test"), false);

  assert.equal(fs.Remove("/foo/bar/test"), undefined);
  assert.equal(fs.WriteFile("/foo/barbar", "remove2"), undefined);
  assert.equal(fs.Remove("/foo/bar"), undefined);
  assert.equal(fs.FileExists("/foo/barbar"), true);

  assert.throws(() => FromMap(new Map<string, unknown>([["string", "hello, world"]]), false as bool), /non-rooted path "string"/);
  assert.throws(() => FromMap(new Map<string, unknown>([["/string/", "hello, world"]]), false as bool), /non-normalized path "\/string\/"/);
  assert.throws(() => FromMap(new Map<string, unknown>([["/string/../foo", "hello, world"]]), false as bool), /non-normalized path "\/string\/\.\.\/foo"/);
  assert.throws(() => FromMap(new Map<string, unknown>([["/string", 1234]]), false as bool), /invalid file type/);
  assert.throws(() => FromMap(new Map<string, unknown>([
    ["/string", "hello, world"],
    ["c:/bytes", bytes("hello, world")],
  ]), false as bool), /mixed posix and windows paths/);
});

test("FromMap mirrors TS-Go POSIX, Windows, and BOM read behavior", () => {
  const posix = FromMap(new Map<string, unknown>([
    ["/string", "hello, world"],
    ["/bytes", bytes("hello, world")],
    ["/mapfile", { Data: bytes("hello, world") } satisfies MapFile],
  ]), false as bool);
  assert.deepEqual(posix.ReadFile("/string"), ["hello, world", true]);
  assert.deepEqual(posix.ReadFile("/bytes"), ["hello, world", true]);
  assert.deepEqual(posix.ReadFile("/mapfile"), ["hello, world", true]);

  const windows = FromMap(new Map<string, unknown>([
    ["c:/string", "hello, world"],
    ["d:/bytes", bytes("hello, world")],
    ["e:/mapfile", { Data: bytes("hello, world") } satisfies MapFile],
  ]), false as bool);
  assert.deepEqual(windows.ReadFile("c:/string"), ["hello, world", true]);
  assert.deepEqual(windows.ReadFile("d:/bytes"), ["hello, world", true]);
  assert.deepEqual(windows.ReadFile("e:/mapfile"), ["hello, world", true]);

  const utf16be = new Uint8Array([0xfe, 0xff, 0x00, 0x68, 0x00, 0x69]);
  const utf16le = new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]);
  const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("hi")]);
  assert.deepEqual(FromMap(new Map([["/foo.ts", utf16be]]), true as bool).ReadFile("/foo.ts"), ["hi", true]);
  assert.deepEqual(FromMap(new Map([["/foo.ts", utf16le]]), true as bool).ReadFile("/foo.ts"), ["hi", true]);
  assert.deepEqual(FromMap(new Map([["/foo.ts", utf8Bom]]), true as bool).ReadFile("/foo.ts"), ["hi", true]);
});

test("FromMap mirrors TS-Go symlink read, realpath, existence, and writable behavior", () => {
  const fs = FromMap(new Map<string, unknown>([
    ["/foo.ts", "hello, world"],
    ["/symlink.ts", Symlink("/foo.ts")],
    ["/some/dir/file.ts", "hello, world"],
    ["/some/dirlink", Symlink("/some/dir")],
    ["/a", Symlink("/b")],
    ["/b", Symlink("/c")],
    ["/c", Symlink("/d")],
    ["/d/existing.ts", "this is existing.ts"],
  ]), false as bool);

  assert.deepEqual(fs.ReadFile("/symlink.ts"), ["hello, world", true]);
  assert.deepEqual(fs.ReadFile("/some/dirlink/file.ts"), ["hello, world", true]);
  assert.deepEqual(fs.ReadFile("/a/existing.ts"), ["this is existing.ts", true]);
  assert.equal(fs.Realpath("/symlink.ts"), "/foo.ts");
  assert.equal(fs.Realpath("/some/dirlink"), "/some/dir");
  assert.equal(fs.Realpath("/some/dirlink/file.ts"), "/some/dir/file.ts");
  assert.equal(fs.FileExists("/symlink.ts"), true);
  assert.equal(fs.FileExists("/some/dirlink/file.ts"), true);
  assert.equal(fs.FileExists("/a/existing.ts"), true);
  assert.equal(fs.DirectoryExists("/some/dirlink"), true);
  assert.equal(fs.DirectoryExists("/d"), true);
  assert.equal(fs.DirectoryExists("/c"), true);
  assert.equal(fs.DirectoryExists("/b"), true);
  assert.equal(fs.DirectoryExists("/a"), true);

  assert.equal(fs.WriteFile("/some/dirlink/new.ts", "new file"), undefined);
  assert.deepEqual(fs.ReadFile("/some/dir/new.ts"), ["new file", true]);
});
