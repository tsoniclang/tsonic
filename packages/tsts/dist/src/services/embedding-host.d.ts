import type { GoPtr } from "../go/compat.js";
import type { Message } from "../internal/diagnostics/diagnostics.js";
import type { CompilerHost } from "../internal/compiler/host.js";
import type { ExtendedConfigCache } from "../internal/tsoptions/tsconfigparsing.js";
import type { FS } from "../internal/vfs/vfs.js";
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
export interface BundledLibrarySource {
    readonly name: string;
    readonly path: string;
    readonly text: string;
}
export declare function getBundledLibraryPath(): string;
export declare function getBundledLibraryClosure(rootNames: readonly string[]): readonly BundledLibrarySource[];
export declare function createInMemoryFileSystem(options: InMemoryFileSystemOptions): CompilerFileSystem;
export declare function withBundledLibraries(fileSystem: CompilerFileSystem): CompilerFileSystem;
export declare function createCompilerHost(options: CompilerHostOptions): CompilerHost;
//# sourceMappingURL=embedding-host.d.ts.map