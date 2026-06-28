import { LibPath, WrapFS } from "../internal/bundled/bundled.js";
import { NewCachedFSCompilerHost, NewCompilerHost } from "../internal/compiler/host.js";
import { FromMap } from "../internal/vfs/vfstest/vfstest.js";
export function getBundledLibraryPath() {
    return LibPath();
}
export function createInMemoryFileSystem(options) {
    const files = options.files instanceof Map ? options.files : new Map(Object.entries(options.files));
    const fs = FromMap(files, (options.useCaseSensitiveFileNames ?? false));
    return options.includeBundledLibraries === false ? fs : WrapFS(fs);
}
export function withBundledLibraries(fileSystem) {
    return WrapFS(fileSystem);
}
export function createCompilerHost(options) {
    const defaultLibraryPath = options.defaultLibraryPath ?? getBundledLibraryPath();
    const trace = options.trace === undefined
        ? undefined
        : ((message, ...args) => options.trace?.(message, ...args));
    const fs = options.includeBundledLibraries === false ? options.fileSystem : withBundledLibraries(options.fileSystem);
    return options.cacheFileSystem === false
        ? NewCompilerHost(options.currentDirectory, fs, defaultLibraryPath, options.extendedConfigCache, trace)
        : NewCachedFSCompilerHost(options.currentDirectory, fs, defaultLibraryPath, options.extendedConfigCache, trace);
}
//# sourceMappingURL=embedding-host.js.map