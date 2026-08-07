import { LibPath, WrapFS } from "../internal/bundled/bundled.js";
import { LibNames } from "../internal/bundled/libs_generated.js";
import { NewCachedFSCompilerHost, NewCompilerHost } from "../internal/compiler/host.js";
import { ScriptKindTS } from "../internal/core/scriptkind.js";
import { ParseSourceFile } from "../internal/parser/parser/statements-declarations.js";
import { GetLibFileName } from "../internal/tsoptions/enummaps.js";
import { FromMap } from "../internal/vfs/vfstest/vfstest.js";
const bundledLibraryNames = new Set(LibNames);
const bundledLibrarySources = new Map();
const bundledLibraryDependencies = new Map();
const bundledLibraryFileSystem = WrapFS(FromMap(new Map(), false));
export function getBundledLibraryPath() {
    return LibPath();
}
export function getBundledLibraryClosure(rootNames) {
    const ordered = [];
    const states = new Map();
    const visit = (name) => {
        const state = states.get(name);
        if (state === "visited") {
            return;
        }
        if (state === "visiting") {
            throw new Error(`Bundled library dependency cycle contains '${name}'.`);
        }
        states.set(name, "visiting");
        const source = getBundledLibrarySource(name);
        for (const dependency of getBundledLibraryDependencies(source)) {
            visit(dependency);
        }
        states.set(name, "visited");
        ordered.push(source);
    };
    for (const rootName of [...new Set(rootNames)].sort()) {
        visit(rootName);
    }
    return Object.freeze(ordered);
}
function getBundledLibrarySource(name) {
    if (!bundledLibraryNames.has(name)) {
        throw new Error(`Unknown bundled library '${name}'.`);
    }
    const cached = bundledLibrarySources.get(name);
    if (cached !== undefined) {
        return cached;
    }
    const path = `${LibPath()}/${name}`;
    const [text, available] = bundledLibraryFileSystem.ReadFile(path);
    if (!available) {
        throw new Error(`Bundled library '${name}' is indexed but unavailable at '${path}'.`);
    }
    const source = Object.freeze({ name, path, text });
    bundledLibrarySources.set(name, source);
    return source;
}
function getBundledLibraryDependencies(source) {
    const cached = bundledLibraryDependencies.get(source.name);
    if (cached !== undefined) {
        return cached;
    }
    const sourceFile = ParseSourceFile({
        FileName: source.path,
        Path: source.path,
    }, source.text, ScriptKindTS);
    if (sourceFile === undefined) {
        throw new Error(`Bundled library '${source.name}' could not be parsed.`);
    }
    const dependencies = sourceFile.LibReferenceDirectives.map((reference) => {
        const [fileName, known] = GetLibFileName(reference.FileName);
        if (!known || !bundledLibraryNames.has(fileName)) {
            throw new Error(`Bundled library '${source.name}' references unknown library '${reference.FileName}'.`);
        }
        return fileName;
    });
    const result = Object.freeze([...new Set(dependencies)].sort());
    bundledLibraryDependencies.set(source.name, result);
    return result;
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