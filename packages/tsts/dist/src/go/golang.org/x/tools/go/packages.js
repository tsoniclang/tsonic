import * as nodeChildProcess from "node:child_process";
export const NeedName = 1 << 0;
export const NeedFiles = 1 << 1;
export const NeedCompiledGoFiles = 1 << 2;
export const NeedImports = 1 << 3;
export const NeedTypes = 1 << 4;
export const NeedSyntax = 1 << 5;
export const LoadAllSyntax = (NeedName | NeedFiles | NeedCompiledGoFiles | NeedImports | NeedTypes | NeedSyntax);
export function Load(config, ...patterns) {
    try {
        const args = ["list", "-json", ...patterns];
        const stdout = nodeChildProcess.execFileSync("go", args, {
            cwd: config?.Dir === "" ? undefined : config?.Dir,
            env: envObject(config?.Env),
            encoding: "utf8",
        });
        return [parseGoListJson(stdout), undefined];
    }
    catch (error) {
        return [[], normalizeError(error)];
    }
}
function parseGoListJson(text) {
    const packages = [];
    for (const objectText of splitConcatenatedJsonObjects(text)) {
        const value = JSON.parse(objectText);
        packages.push({
            ID: value.ImportPath ?? "",
            Name: value.Name ?? "",
            PkgPath: value.ImportPath ?? "",
            GoFiles: value.GoFiles ?? [],
            CompiledGoFiles: value.CompiledGoFiles ?? [],
            Imports: new Map(),
            Errors: value.Error?.Err ? [new globalThis.Error(value.Error.Err)] : [],
        });
    }
    return packages;
}
function splitConcatenatedJsonObjects(text) {
    const objects = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (inString) {
            if (escape) {
                escape = false;
            }
            else if (char === "\\") {
                escape = true;
            }
            else if (char === "\"") {
                inString = false;
            }
            continue;
        }
        if (char === "\"") {
            inString = true;
        }
        else if (char === "{") {
            if (depth === 0) {
                start = index;
            }
            depth++;
        }
        else if (char === "}") {
            depth--;
            if (depth === 0 && start >= 0) {
                objects.push(text.slice(start, index + 1));
                start = -1;
            }
        }
    }
    return objects;
}
function envObject(env) {
    if (env === undefined) {
        return undefined;
    }
    const result = {};
    for (const entry of env) {
        const index = entry.indexOf("=");
        if (index >= 0) {
            result[entry.slice(0, index)] = entry.slice(index + 1);
        }
    }
    return result;
}
function normalizeError(error) {
    return error instanceof globalThis.Error ? error : new globalThis.Error(String(error));
}
//# sourceMappingURL=packages.js.map