import { ExtensionFacts } from "./facts.js";
import { createExtensionImportIndex } from "./import-index.js";
const createDiagnostics = () => {
    const diagnostics = [];
    return {
        add: (diagnostic) => {
            diagnostics.push(diagnostic);
        },
        all: () => diagnostics,
    };
};
const reportHookFailure = (diagnostics, extensionId, hookName, error, sourceFile) => {
    const message = error instanceof Error ? error.message : String(error);
    diagnostics.add({
        extensionId,
        code: "TSTS_EXTENSION_FAILURE",
        category: "error",
        message: `Extension '${extensionId}' failed in ${hookName}: ${message}`,
        sourceFile,
    });
};
const runExtensionHook = (diagnostics, extension, hookName, run, sourceFile) => {
    try {
        run();
    }
    catch (error) {
        reportHookFailure(diagnostics, extension.id, hookName, error, sourceFile);
    }
};
const orderedExtensions = (extensions) => {
    const byId = new Map();
    for (const extension of extensions) {
        if (byId.has(extension.id)) {
            throw new Error(`Duplicate TSTS extension id '${extension.id}'.`);
        }
        byId.set(extension.id, extension);
    }
    const ordered = [];
    const visiting = new Set();
    const visited = new Set();
    const visit = (extension) => {
        if (visited.has(extension.id))
            return;
        if (visiting.has(extension.id)) {
            throw new Error(`TSTS extension dependency cycle includes '${extension.id}'.`);
        }
        visiting.add(extension.id);
        for (const dependencyId of extension.dependsOn ?? []) {
            const dependency = byId.get(dependencyId);
            if (!dependency) {
                throw new Error(`TSTS extension '${extension.id}' depends on missing extension '${dependencyId}'.`);
            }
            visit(dependency);
        }
        for (const predecessorId of extension.runsAfter ?? []) {
            const predecessor = byId.get(predecessorId);
            if (predecessor) {
                visit(predecessor);
            }
        }
        visiting.delete(extension.id);
        visited.add(extension.id);
        ordered.push(extension);
    };
    for (const extension of extensions) {
        visit(extension);
    }
    return ordered;
};
export const createExtensionHost = (extensions) => {
    const ordered = orderedExtensions(extensions);
    const facts = new ExtensionFacts();
    const diagnostics = createDiagnostics();
    const sourceFileContext = (sourceFile, program) => {
        let imports;
        return {
            program,
            sourceFile,
            get imports() {
                imports ??= createExtensionImportIndex(sourceFile);
                return imports;
            },
            facts,
            diagnostics,
        };
    };
    const programContext = (program, sourceFiles) => ({
        program,
        sourceFiles,
        facts,
        diagnostics,
    });
    return {
        extensions: ordered,
        facts,
        diagnostics,
        configure: () => {
            for (const extension of ordered) {
                if (!extension.configure)
                    continue;
                runExtensionHook(diagnostics, extension, "configure", () => extension.configure({ facts, diagnostics }));
            }
        },
        afterParseSourceFile: (sourceFile, program) => {
            const context = sourceFileContext(sourceFile, program);
            for (const extension of ordered) {
                if (!extension.afterParseSourceFile)
                    continue;
                runExtensionHook(diagnostics, extension, "afterParseSourceFile", () => extension.afterParseSourceFile(context), sourceFile);
            }
        },
        afterBindSourceFile: (sourceFile, program) => {
            const context = sourceFileContext(sourceFile, program);
            for (const extension of ordered) {
                if (!extension.afterBindSourceFile)
                    continue;
                runExtensionHook(diagnostics, extension, "afterBindSourceFile", () => extension.afterBindSourceFile(context), sourceFile);
            }
        },
        afterCheckSourceFile: (sourceFile, checker, program) => {
            const context = {
                ...sourceFileContext(sourceFile, program),
                checker: checker.facade,
            };
            for (const extension of ordered) {
                if (!extension.afterCheckSourceFile)
                    continue;
                runExtensionHook(diagnostics, extension, "afterCheckSourceFile", () => extension.afterCheckSourceFile(context), sourceFile);
            }
        },
        afterCheckProgram: (program, sourceFiles) => {
            const context = programContext(program, sourceFiles);
            for (const extension of ordered) {
                if (!extension.afterCheckProgram)
                    continue;
                runExtensionHook(diagnostics, extension, "afterCheckProgram", () => extension.afterCheckProgram(context));
            }
        },
        validateProgram: (program, sourceFiles) => {
            const context = programContext(program, sourceFiles);
            for (const extension of ordered) {
                if (!extension.validateProgram)
                    continue;
                runExtensionHook(diagnostics, extension, "validateProgram", () => extension.validateProgram(context));
            }
        },
    };
};
//# sourceMappingURL=extension-host.js.map