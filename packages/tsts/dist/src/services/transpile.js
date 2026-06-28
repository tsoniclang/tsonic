import { Background } from "../go/context.js";
import { NewCompilerHost } from "../internal/compiler/host.js";
import { NewProgram, Program_Emit, Program_GetConfigFileParsingDiagnostics, Program_GetProgramDiagnostics, Program_GetSourceFile, Program_GetSyntacticDiagnostics, SortAndDeduplicateDiagnostics, } from "../internal/compiler/program.js";
import { EmitOnlyDts, EmitOnlyJs } from "../internal/compiler/emitter.js";
import { FromASTDiagnostics, WriteFormatDiagnostics } from "../internal/diagnosticwriter/diagnosticwriter.js";
import { ParseCommandLine } from "../internal/tsoptions/commandlineparser.js";
import { ParsedCommandLine_CompilerOptions } from "../internal/tsoptions/parsedcommandline.js";
import { Default as DefaultLocale } from "../internal/locale/locale.js";
import { TSTrue } from "../internal/core/tristate.js";
export const barebonesLibContent = `interface Boolean {}
interface Function {}
interface CallableFunction {}
interface NewableFunction {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}
interface Array<T> { length: number; [n: number]: T; }
interface SymbolConstructor {
    (desc?: string | number): symbol;
    for(name: string): symbol;
    readonly toStringTag: symbol;
}
declare var Symbol: SymbolConstructor;
interface Symbol {
    readonly [Symbol.toStringTag]: string;
}`;
export function transpileModule(input, options = {}) {
    return transpileWorker(input, options, false);
}
export function transpileDeclaration(input, options = {}) {
    return transpileWorker(input, options, true);
}
export function transpile(input, compilerOptions, fileName, diagnostics, moduleName) {
    const options = {
        reportDiagnostics: diagnostics !== undefined,
    };
    if (compilerOptions !== undefined) {
        options.compilerOptions = compilerOptions;
    }
    if (fileName !== undefined) {
        options.fileName = fileName;
    }
    if (moduleName !== undefined) {
        options.moduleName = moduleName;
    }
    const output = transpileModule(input, options);
    if (diagnostics !== undefined) {
        diagnostics.push(...output.diagnostics);
    }
    return output.outputText;
}
export function formatDiagnostics(diagnostics, currentDirectory = "") {
    if (diagnostics.length === 0) {
        return "";
    }
    const output = new StringWriter();
    const formattingOptions = {
        Locale: DefaultLocale,
        __tsgoEmbedded0: {
            UseCaseSensitiveFileNames: false,
            CurrentDirectory: currentDirectory,
        },
        NewLine: "\n",
    };
    WriteFormatDiagnostics(output, FromASTDiagnostics([...diagnostics]), formattingOptions);
    return output.text;
}
function transpileWorker(input, options, declaration) {
    if (options.moduleName !== undefined) {
        throw new Error("transpileModule moduleName is not implemented in TSTS yet");
    }
    if (options.renamedDependencies !== undefined) {
        throw new Error("transpileModule renamedDependencies is not implemented in TSTS yet");
    }
    const inputFile = options.fileName ?? defaultInputFileName(options.compilerOptions);
    const fileSystem = new TranspileFileSystem(inputFile, input, declaration);
    const parseHost = {
        FS: () => fileSystem,
        GetCurrentDirectory: () => "/",
    };
    const parsed = ParseCommandLine(transpileCommandLineArgs(options.compilerOptions, inputFile, declaration), parseHost);
    const parsedOptions = ParsedCommandLine_CompilerOptions(parsed);
    parsedOptions.AllowNonTsExtensions = TSTrue;
    parsedOptions.SuppressOutputPathCheck = TSTrue;
    const host = NewCompilerHost("/", fileSystem, "/", undefined, undefined);
    const program = NewProgram({
        Host: host,
        Config: parsed,
        UseSourceOfProjectReference: false,
        SingleThreaded: TSTrue,
        CreateCheckerPool: undefined,
        TypingsLocation: "",
        ProjectName: "",
        Tracing: undefined,
    });
    const diagnostics = [];
    if (options.reportDiagnostics === true) {
        const sourceFile = Program_GetSourceFile(program, inputFile);
        appendDiagnostics(diagnostics, Program_GetConfigFileParsingDiagnostics(program));
        appendDiagnostics(diagnostics, Program_GetSyntacticDiagnostics(program, Background(), sourceFile));
        appendDiagnostics(diagnostics, Program_GetProgramDiagnostics(program));
    }
    let outputText;
    let sourceMapText;
    const writeFile = (fileName, text, _data) => {
        if (fileName.endsWith(".map")) {
            sourceMapText = text;
        }
        else {
            outputText = text;
        }
        fileSystem.setFile(fileName, text);
        return undefined;
    };
    const emitResult = Program_Emit(program, Background(), {
        TargetSourceFile: undefined,
        EmitOnly: declaration ? EmitOnlyDts : EmitOnlyJs,
        WriteFile: writeFile,
    });
    appendDiagnostics(diagnostics, emitResult?.Diagnostics ?? []);
    if (outputText === undefined) {
        // Emit can legitimately produce no output file — e.g. --isolatedDeclarations blocks
        // declaration emit on an un-isolatable construct (the pinned TS-Go binary writes no file
        // there either). Mirror tsc's transpileModule, which returns empty output text alongside the
        // blocking diagnostics rather than failing; throwing here would also discard those
        // diagnostics. Callers distinguish "no file" via empty output + the reported diagnostics.
        outputText = "";
    }
    // Mirror TS-Go's user-facing diagnostic presentation: tsc's EmitFilesAndReportErrors runs
    // compiler.SortAndDeduplicateDiagnostics over the combined program+emit diagnostics before
    // reporting (internal/execute/tsc/emit.go). The raw emit pipeline intentionally produces
    // duplicates (recovery boundaries replay deferred reports); the dedup is presentation-level.
    const presentedDiagnostics = [...SortAndDeduplicateDiagnostics(diagnostics)].filter((diagnostic) => diagnostic !== undefined);
    return sourceMapText === undefined
        ? { outputText, diagnostics: presentedDiagnostics }
        : { outputText, diagnostics: presentedDiagnostics, sourceMapText };
}
function appendDiagnostics(target, diagnostics) {
    for (const diagnostic of diagnostics) {
        if (diagnostic !== undefined) {
            target.push(diagnostic);
        }
    }
}
function transpileCommandLineArgs(compilerOptions, inputFile, declaration) {
    const args = ["--ignoreConfig"];
    appendCompilerOptions(args, compilerOptions);
    appendCompilerOptions(args, {
        pretty: false,
    });
    if (declaration) {
        appendCompilerOptions(args, { noResolve: true });
    }
    else {
        appendCompilerOptions(args, {
            noCheck: true,
            noResolve: true,
        });
    }
    if (compilerOptions?.verbatimModuleSyntax !== true) {
        appendCompilerOptions(args, { isolatedModules: true });
    }
    if (declaration) {
        appendCompilerOptions(args, {
            declaration: true,
            emitDeclarationOnly: true,
            isolatedDeclarations: true,
        });
    }
    else {
        appendCompilerOptions(args, {
            declaration: false,
            declarationMap: false,
            noLib: true,
        });
    }
    args.push(inputFile);
    return args;
}
function appendCompilerOptions(args, compilerOptions) {
    if (compilerOptions === undefined) {
        return;
    }
    for (const key of Object.keys(compilerOptions).sort()) {
        const value = compilerOptions[key];
        if (value === undefined) {
            continue;
        }
        args.push(`--${key}`);
        if (value === true) {
            continue;
        }
        if (Array.isArray(value)) {
            args.push(value.join(","));
            continue;
        }
        args.push(String(value));
    }
}
function defaultInputFileName(compilerOptions) {
    return compilerOptions?.jsx === undefined ? "module.ts" : "module.tsx";
}
class TranspileFileSystem {
    declaration;
    files = new Map();
    constructor(inputFile, input, declaration) {
        this.declaration = declaration;
        this.setFile(inputFile, input);
    }
    setFile(fileName, content) {
        this.files.set(normalizeTranspileKey(fileName), content);
    }
    UseCaseSensitiveFileNames() {
        return false;
    }
    FileExists(fileName) {
        const normalized = normalizeTranspileKey(fileName);
        return (this.files.has(normalized) || this.isBarebonesLib(normalized));
    }
    ReadFile(fileName) {
        const normalized = normalizeTranspileKey(fileName);
        const content = this.files.get(normalized);
        if (content !== undefined) {
            return [content, true];
        }
        if (this.isBarebonesLib(normalized)) {
            return [barebonesLibContent, true];
        }
        return ["", false];
    }
    WriteFile(fileName, data) {
        this.setFile(fileName, data);
        return undefined;
    }
    AppendFile(fileName, data) {
        this.setFile(fileName, (this.files.get(normalizeTranspileKey(fileName)) ?? "") + data);
        return undefined;
    }
    Remove(fileName) {
        this.files.delete(normalizeTranspileKey(fileName));
        return undefined;
    }
    Chtimes(_path, _aTime, _mTime) {
        return undefined;
    }
    DirectoryExists(_path) {
        return true;
    }
    GetAccessibleEntries(path) {
        const prefix = normalizeDirectoryKeyPrefix(path);
        const files = [];
        const directories = new Set();
        for (const fileName of this.files.keys()) {
            if (!fileName.startsWith(prefix)) {
                continue;
            }
            const rest = fileName.slice(prefix.length);
            const slash = rest.indexOf("/");
            if (slash === -1) {
                files.push(rest);
            }
            else {
                directories.add(rest.slice(0, slash));
            }
        }
        return {
            Files: files.sort(),
            Directories: [...directories].sort(),
            Symlinks: undefined,
        };
    }
    Stat(fileName) {
        const normalized = normalizeTranspileKey(fileName);
        if (this.FileExists(normalized)) {
            return new TranspileFileInfo(baseName(normalized), false);
        }
        if (this.DirectoryExists(normalized)) {
            return new TranspileFileInfo(baseName(normalized), true);
        }
        return undefined;
    }
    WalkDir(_root, _walkFn) {
        return undefined;
    }
    Realpath(fileName) {
        return normalizeTranspilePath(fileName);
    }
    isBarebonesLib(fileName) {
        return this.declaration && /^lib(?:\..*)?\.d\.ts$/i.test(baseName(fileName));
    }
}
class TranspileFileInfo {
    name;
    directory;
    constructor(name, directory) {
        this.name = name;
        this.directory = directory;
    }
    Name() {
        return this.name;
    }
    Size() {
        return 0;
    }
    Mode() {
        return this.directory ? 0x80000000 : 0;
    }
    ModTime() {
        return new Date(0);
    }
    IsDir() {
        return this.directory;
    }
    Sys() {
        return undefined;
    }
}
class StringWriter {
    chunks = [];
    get text() {
        return this.chunks.join("");
    }
    Write(bytes) {
        this.chunks.push(new TextDecoder().decode(new Uint8Array(bytes)));
        return [bytes.length, undefined];
    }
}
function normalizeTranspilePath(fileName) {
    let normalized = fileName.replaceAll("\\", "/");
    while (normalized.startsWith("./")) {
        normalized = normalized.slice(2);
    }
    return normalized;
}
function normalizeTranspileKey(fileName) {
    return normalizeTranspilePath(fileName).replace(/^\/+/, "");
}
function normalizeDirectoryKeyPrefix(path) {
    const normalized = normalizeTranspileKey(path);
    return normalized === "" || normalized.endsWith("/") ? normalized : `${normalized}/`;
}
function baseName(fileName) {
    const normalized = normalizeTranspilePath(fileName);
    const slash = normalized.lastIndexOf("/");
    return slash === -1 ? normalized : normalized.slice(slash + 1);
}
//# sourceMappingURL=transpile.js.map