import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import type { Message } from "../internal/diagnostics/diagnostics.js";
import { LibPath, WrapFS } from "../internal/bundled/bundled.js";
import { NewCachedFSCompilerHost, NewCompilerHost } from "../internal/compiler/host.js";
import type { CompilerHost } from "../internal/compiler/host.js";
import type { ExtendedConfigCache } from "../internal/tsoptions/tsconfigparsing.js";
import type { FS } from "../internal/vfs/vfs.js";
import { FromMap } from "../internal/vfs/vfstest/vfstest.js";

export type CompilerFileSystem = FS;
export type CompilerTraceCallback = (message: GoPtr<Message>, ...args: readonly unknown[]) => void;

export interface CompilerHostOptions {
  readonly currentDirectory: string;
  readonly fileSystem: CompilerFileSystem;
  readonly defaultLibraryPath?: string;
  readonly extendedConfigCache?: GoPtr<ExtendedConfigCache>;
  readonly trace?: CompilerTraceCallback;
  readonly cacheFileSystem?: boolean;
  readonly includeBundledLibraries?: boolean;
}

export interface InMemoryFileSystemOptions {
  readonly files: ReadonlyMap<string, string> | Record<string, string>;
  readonly useCaseSensitiveFileNames?: boolean;
  readonly includeBundledLibraries?: boolean;
}

export function getBundledLibraryPath(): string {
  return LibPath();
}

export function createInMemoryFileSystem(options: InMemoryFileSystemOptions): CompilerFileSystem {
  const files = options.files instanceof Map ? options.files : new Map(Object.entries(options.files));
  const fs = FromMap(files, (options.useCaseSensitiveFileNames ?? false) as bool);
  return options.includeBundledLibraries === false ? fs : WrapFS(fs);
}

export function withBundledLibraries(fileSystem: CompilerFileSystem): CompilerFileSystem {
  return WrapFS(fileSystem);
}

export function createCompilerHost(options: CompilerHostOptions): CompilerHost {
  const defaultLibraryPath = options.defaultLibraryPath ?? getBundledLibraryPath();
  const trace = options.trace === undefined
    ? undefined
    : ((message: GoPtr<Message>, ...args: unknown[]): void => options.trace?.(message, ...args));
  const fs = options.includeBundledLibraries === false ? options.fileSystem : withBundledLibraries(options.fileSystem);
  return options.cacheFileSystem === false
    ? NewCompilerHost(options.currentDirectory, fs, defaultLibraryPath, options.extendedConfigCache, trace)
    : NewCachedFSCompilerHost(options.currentDirectory, fs, defaultLibraryPath, options.extendedConfigCache, trace);
}
