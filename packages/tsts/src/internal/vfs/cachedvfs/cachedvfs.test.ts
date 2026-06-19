import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "../../../go/scalars.js";
import type { GoError } from "../../../go/compat.js";
import { FromMap } from "../vfstest/vfstest.js";
import { Wrap } from "../vfsmock/wrapper.js";
import {
  FSMock_as_vfs_FS,
  FSMock_DirectoryExistsCalls,
  FSMock_FileExistsCalls,
  FSMock_GetAccessibleEntriesCalls,
  FSMock_ReadFileCalls,
  FSMock_RealpathCalls,
  FSMock_RemoveCalls,
  FSMock_StatCalls,
  FSMock_UseCaseSensitiveFileNamesCalls,
  FSMock_WalkDirCalls,
  FSMock_WriteFileCalls,
} from "../vfsmock/mock_generated.js";
import type { FSMock } from "../vfsmock/mock_generated.js";
import type { DirEntry, WalkDirFunc } from "../vfs.js";
import {
  FS_ClearCache,
  FS_DirectoryExists,
  FS_DisableAndClearCache,
  FS_Enable,
  FS_FileExists,
  FS_GetAccessibleEntries,
  FS_ReadFile,
  FS_Realpath,
  FS_Remove,
  FS_Stat,
  FS_UseCaseSensitiveFileNames,
  FS_WalkDir,
  FS_WriteFile,
  From,
} from "./cachedvfs.js";

function createMockFS(): FSMock {
  return Wrap(FromMap(new Map<string, string>([
    ["/some/path/file.txt", "hello world"],
  ]), true as bool))!;
}

test("DirectoryExists uses the cache exactly like TS-Go", () => {
  const underlying = createMockFS();
  const cached = From(FSMock_as_vfs_FS(underlying));

  FS_DirectoryExists(cached, "/some/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 1);
  FS_DirectoryExists(cached, "/some/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 1);

  FS_ClearCache(cached);
  FS_DirectoryExists(cached, "/some/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 2);
  FS_DirectoryExists(cached, "/other/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 3);

  FS_DisableAndClearCache(cached);
  FS_DirectoryExists(cached, "/some/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 4);
  FS_DirectoryExists(cached, "/some/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 5);

  FS_Enable(cached);
  FS_DirectoryExists(cached, "/some/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 6);
  FS_DirectoryExists(cached, "/some/path");
  assert.equal(FSMock_DirectoryExistsCalls(underlying).length, 6);
});

test("FileExists uses the cache exactly like TS-Go", () => {
  const underlying = createMockFS();
  const cached = From(FSMock_as_vfs_FS(underlying));

  FS_FileExists(cached, "/some/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 1);
  FS_FileExists(cached, "/some/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 1);

  FS_ClearCache(cached);
  FS_FileExists(cached, "/some/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 2);
  FS_FileExists(cached, "/other/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 3);

  FS_DisableAndClearCache(cached);
  FS_FileExists(cached, "/some/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 4);
  FS_FileExists(cached, "/some/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 5);

  FS_Enable(cached);
  FS_FileExists(cached, "/some/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 6);
  FS_FileExists(cached, "/some/path/file.txt");
  assert.equal(FSMock_FileExistsCalls(underlying).length, 6);
});

test("GetAccessibleEntries uses the cache exactly like TS-Go", () => {
  const underlying = createMockFS();
  const cached = From(FSMock_as_vfs_FS(underlying));

  FS_GetAccessibleEntries(cached, "/some/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 1);
  FS_GetAccessibleEntries(cached, "/some/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 1);

  FS_ClearCache(cached);
  FS_GetAccessibleEntries(cached, "/some/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 2);
  FS_GetAccessibleEntries(cached, "/other/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 3);

  FS_DisableAndClearCache(cached);
  FS_GetAccessibleEntries(cached, "/some/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 4);
  FS_GetAccessibleEntries(cached, "/some/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 5);

  FS_Enable(cached);
  FS_GetAccessibleEntries(cached, "/some/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 6);
  FS_GetAccessibleEntries(cached, "/some/path");
  assert.equal(FSMock_GetAccessibleEntriesCalls(underlying).length, 6);
});

test("Realpath and Stat are cached, while mutation and read operations pass through", () => {
  const underlying = createMockFS();
  const cached = From(FSMock_as_vfs_FS(underlying));

  FS_Realpath(cached, "/some/path");
  FS_Realpath(cached, "/some/path");
  assert.equal(FSMock_RealpathCalls(underlying).length, 1);
  FS_ClearCache(cached);
  FS_Realpath(cached, "/some/path");
  assert.equal(FSMock_RealpathCalls(underlying).length, 2);

  FS_Stat(cached, "/some/path");
  FS_Stat(cached, "/some/path");
  assert.equal(FSMock_StatCalls(underlying).length, 1);
  FS_ClearCache(cached);
  FS_Stat(cached, "/some/path");
  assert.equal(FSMock_StatCalls(underlying).length, 2);

  FS_ReadFile(cached, "/some/path/file.txt");
  FS_ReadFile(cached, "/some/path/file.txt");
  assert.equal(FSMock_ReadFileCalls(underlying).length, 2);

  FS_Remove(cached, "/some/path/file.txt");
  FS_Remove(cached, "/some/path/file.txt");
  assert.equal(FSMock_RemoveCalls(underlying).length, 2);

  FS_UseCaseSensitiveFileNames(cached);
  FS_UseCaseSensitiveFileNames(cached);
  assert.equal(FSMock_UseCaseSensitiveFileNamesCalls(underlying).length, 2);
});

test("WalkDir and WriteFile pass through and preserve arguments", () => {
  const underlying = createMockFS();
  const cached = From(FSMock_as_vfs_FS(underlying));
  const walkFn: WalkDirFunc = (_path: string, _info: DirEntry, _err: GoError): GoError => undefined;

  FS_WalkDir(cached, "/some/path", walkFn);
  FS_WalkDir(cached, "/some/path", walkFn);
  assert.equal(FSMock_WalkDirCalls(underlying).length, 2);

  FS_WriteFile(cached, "/some/path/file.txt", "new content");
  FS_WriteFile(cached, "/some/path/file.txt", "another content");
  FS_ClearCache(cached);
  FS_WriteFile(cached, "/some/path/file.txt", "third content");

  const calls = FSMock_WriteFileCalls(underlying);
  assert.equal(calls.length, 3);
  assert.equal(calls[2]!.Path, "/some/path/file.txt");
  assert.equal(calls[2]!.Data, "third content");
});
