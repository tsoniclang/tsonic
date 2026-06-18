import * as fs from "node:fs";
import * as path from "node:path";
import { createExtensionModuleGraph } from "../extensions/module-graph.js";
import { parseTstsSourceFile } from "../extensions/parse-source.js";
const canonicalizePath = (filePath) => {
    const normalizedPath = path.resolve(filePath);
    try {
        return fs.realpathSync(normalizedPath);
    }
    catch {
        return normalizedPath;
    }
};
const appendUniquePath = (files, seenCanonicalPaths, filePath) => {
    const canonicalPath = canonicalizePath(filePath);
    if (seenCanonicalPaths.has(canonicalPath)) {
        return false;
    }
    seenCanonicalPaths.add(canonicalPath);
    files.push(path.resolve(filePath));
    return true;
};
const getModuleSpecifiers = (sourceText, fileName) => {
    const sourceFile = parseTstsSourceFile(sourceText, { fileName });
    const moduleGraph = createExtensionModuleGraph(undefined, [sourceFile]);
    const module = moduleGraph.getSourceFileModule(sourceFile);
    if (!module) {
        return [];
    }
    return [
        ...module.imports
            .filter((importModule) => !(importModule.isTypeOnly && importModule.bindings.length === 0))
            .map((importModule) => importModule.specifier),
        ...module.exports
            .map((binding) => binding.sourceSpecifier)
            .filter((specifier) => specifier !== undefined),
    ];
};
export const collectTstsModuleClosure = (options) => {
    const files = [];
    const queue = [];
    const queued = new Set();
    const visited = new Set();
    const seenFiles = new Set();
    const dependencyEdges = [];
    const diagnostics = [];
    const seenEdges = new Set();
    for (const filePath of options.seedFiles) {
        appendUniquePath(queue, queued, filePath);
    }
    while (queue.length > 0) {
        const currentFile = queue.shift();
        if (!currentFile) {
            continue;
        }
        const resolvedCurrentFile = path.resolve(currentFile);
        const canonicalCurrentFile = canonicalizePath(resolvedCurrentFile);
        if (visited.has(canonicalCurrentFile)) {
            continue;
        }
        visited.add(canonicalCurrentFile);
        appendUniquePath(files, seenFiles, resolvedCurrentFile);
        let sourceText;
        try {
            sourceText = fs.readFileSync(resolvedCurrentFile, "utf-8");
        }
        catch (cause) {
            diagnostics.push({
                containingFile: resolvedCurrentFile,
                specifier: currentFile,
                message: cause instanceof Error ? cause.message : String(cause),
            });
            continue;
        }
        for (const specifier of getModuleSpecifiers(sourceText, resolvedCurrentFile)) {
            const resolved = options.resolveModule({
                specifier,
                containingFile: resolvedCurrentFile,
            });
            if (!resolved.ok) {
                if (options.shouldReportUnresolved?.(specifier, resolvedCurrentFile) !==
                    false) {
                    diagnostics.push({
                        containingFile: resolvedCurrentFile,
                        specifier,
                        message: resolved.message,
                    });
                }
                continue;
            }
            if (!resolved.resolvedPath) {
                continue;
            }
            const resolvedDependencyPath = path.resolve(resolved.resolvedPath);
            const shouldInclude = options.shouldIncludeResolvedFile?.(resolvedDependencyPath) ?? true;
            const shouldQueue = options.shouldQueueResolvedFile?.(resolvedDependencyPath) ?? true;
            if (!shouldInclude && !shouldQueue) {
                continue;
            }
            const edge = {
                from: resolvedCurrentFile,
                to: resolvedDependencyPath,
                specifier,
            };
            const edgeId = `${edge.from}\0${edge.specifier}\0${edge.to}`;
            if (!seenEdges.has(edgeId)) {
                seenEdges.add(edgeId);
                dependencyEdges.push(edge);
            }
            if (shouldQueue) {
                appendUniquePath(queue, queued, resolvedDependencyPath);
                continue;
            }
            if (shouldInclude) {
                appendUniquePath(files, seenFiles, resolvedDependencyPath);
            }
        }
    }
    return {
        files,
        dependencyEdges,
        diagnostics,
    };
};
//# sourceMappingURL=module-closure.js.map