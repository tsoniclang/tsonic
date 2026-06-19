import type { bool, int } from "../go/scalars.js";
import type { GoError, GoPtr, GoSlice } from "../go/compat.js";
import type { Writer } from "../go/io.js";
import { Background } from "../go/context.js";
import { NewCompilerHost } from "../internal/compiler/host.js";
import type { ProgramOptions, WriteFileData } from "../internal/compiler/program.js";
import {
  NewProgram,
  Program_Emit,
  Program_GetConfigFileParsingDiagnostics,
  Program_GetProgramDiagnostics,
  Program_GetSourceFile,
  Program_GetSyntacticDiagnostics,
  SortAndDeduplicateDiagnostics,
} from "../internal/compiler/program.js";
import { EmitOnlyDts, EmitOnlyJs } from "../internal/compiler/emitter.js";
import type { Diagnostic } from "../internal/ast/diagnostic.js";
import { FromASTDiagnostics, WriteFormatDiagnostics } from "../internal/diagnosticwriter/diagnosticwriter.js";
import type { FormattingOptions } from "../internal/diagnosticwriter/diagnosticwriter.js";
import { ParseCommandLine } from "../internal/tsoptions/commandlineparser.js";
import { ParsedCommandLine_CompilerOptions } from "../internal/tsoptions/parsedcommandline.js";
import type { ParseConfigHost } from "../internal/tsoptions/tsconfigparsing.js";
import type { FS, Entries, FileInfo, WalkDirFunc } from "../internal/vfs/vfs.js";
import { Default as DefaultLocale } from "../internal/locale/locale.js";
import { TSTrue } from "../internal/core/tristate.js";
import type { Time } from "../go/time.js";

export interface TranspileOptions {
  compilerOptions?: TranspileCompilerOptions;
  fileName?: string;
  reportDiagnostics?: boolean;
  moduleName?: string;
  renamedDependencies?: Record<string, string>;
}

export interface TranspileOutput {
  outputText: string;
  diagnostics: Diagnostic[];
  sourceMapText?: string;
}

export type TranspileCompilerOptions = Record<string, TranspileCompilerOptionValue>;

export type TranspileCompilerOptionValue =
  | string
  | number
  | boolean
  | readonly string[]
  | readonly number[]
  | undefined;

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

export function transpileModule(input: string, options: TranspileOptions = {}): TranspileOutput {
  return transpileWorker(input, options, false);
}

export function transpileDeclaration(input: string, options: TranspileOptions = {}): TranspileOutput {
  return transpileWorker(input, options, true);
}

export function transpile(
  input: string,
  compilerOptions?: TranspileCompilerOptions,
  fileName?: string,
  diagnostics?: Diagnostic[],
  moduleName?: string,
): string {
  const options: TranspileOptions = {
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

export function formatDiagnostics(diagnostics: readonly Diagnostic[], currentDirectory = ""): string {
  if (diagnostics.length === 0) {
    return "";
  }
  const output = new StringWriter();
  const formattingOptions: FormattingOptions = {
    Locale: DefaultLocale,
    __tsgoEmbedded0: {
      UseCaseSensitiveFileNames: false as bool,
      CurrentDirectory: currentDirectory,
    },
    NewLine: "\n",
  };
  WriteFormatDiagnostics(output, FromASTDiagnostics([...diagnostics]), formattingOptions);
  return output.text;
}

function transpileWorker(input: string, options: TranspileOptions, declaration: boolean): TranspileOutput {
  if (options.moduleName !== undefined) {
    throw new Error("transpileModule moduleName is not implemented in TSTS yet");
  }
  if (options.renamedDependencies !== undefined) {
    throw new Error("transpileModule renamedDependencies is not implemented in TSTS yet");
  }

  const inputFile = options.fileName ?? defaultInputFileName(options.compilerOptions);
  const fileSystem = new TranspileFileSystem(inputFile, input, declaration);
  const parseHost: ParseConfigHost = {
    FS: (): FS => fileSystem,
    GetCurrentDirectory: (): string => "/",
  };
  const parsed = ParseCommandLine(transpileCommandLineArgs(options.compilerOptions, inputFile, declaration), parseHost);
  const parsedOptions = ParsedCommandLine_CompilerOptions(parsed);
  parsedOptions!.AllowNonTsExtensions = TSTrue;
  parsedOptions!.SuppressOutputPathCheck = TSTrue;
  const host = NewCompilerHost("/", fileSystem, "/", undefined, undefined);
  const program = NewProgram({
    Host: host,
    Config: parsed,
    UseSourceOfProjectReference: false as bool,
    SingleThreaded: TSTrue,
    CreateCheckerPool: undefined!,
    TypingsLocation: "",
    ProjectName: "",
    Tracing: undefined,
  } satisfies ProgramOptions);

  const diagnostics: Diagnostic[] = [];
  if (options.reportDiagnostics === true) {
    const sourceFile = Program_GetSourceFile(program, inputFile);
    appendDiagnostics(diagnostics, Program_GetConfigFileParsingDiagnostics(program));
    appendDiagnostics(diagnostics, Program_GetSyntacticDiagnostics(program, Background(), sourceFile));
    appendDiagnostics(diagnostics, Program_GetProgramDiagnostics(program));
  }

  let outputText: string | undefined;
  let sourceMapText: string | undefined;
  const writeFile = (fileName: string, text: string, _data: GoPtr<WriteFileData>): GoError => {
    if (fileName.endsWith(".map")) {
      sourceMapText = text;
    } else {
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
  const presentedDiagnostics = [...SortAndDeduplicateDiagnostics(diagnostics)].filter((diagnostic): diagnostic is Diagnostic => diagnostic !== undefined);
  return sourceMapText === undefined
    ? { outputText, diagnostics: presentedDiagnostics }
    : { outputText, diagnostics: presentedDiagnostics, sourceMapText };
}

function appendDiagnostics(target: Diagnostic[], diagnostics: GoSlice<GoPtr<Diagnostic>>): void {
  for (const diagnostic of diagnostics) {
    if (diagnostic !== undefined) {
      target.push(diagnostic);
    }
  }
}

function transpileCommandLineArgs(compilerOptions: TranspileCompilerOptions | undefined, inputFile: string, declaration: boolean): string[] {
  const args = ["--ignoreConfig"];
  appendCompilerOptions(args, compilerOptions);
  appendCompilerOptions(args, {
    pretty: false,
  });
  if (declaration) {
    appendCompilerOptions(args, { noResolve: true });
  } else {
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
  } else {
    appendCompilerOptions(args, {
      declaration: false,
      declarationMap: false,
      noLib: true,
    });
  }
  args.push(inputFile);
  return args;
}

function appendCompilerOptions(args: string[], compilerOptions: TranspileCompilerOptions | undefined): void {
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

function defaultInputFileName(compilerOptions: TranspileCompilerOptions | undefined): string {
  return compilerOptions?.jsx === undefined ? "module.ts" : "module.tsx";
}

class TranspileFileSystem implements FS {
  private readonly files = new Map<string, string>();

  constructor(inputFile: string, input: string, private readonly declaration: boolean) {
    this.setFile(inputFile, input);
  }

  setFile(fileName: string, content: string): void {
    this.files.set(normalizeTranspileKey(fileName), content);
  }

  UseCaseSensitiveFileNames(): bool {
    return false as bool;
  }

  FileExists(fileName: string): bool {
    const normalized = normalizeTranspileKey(fileName);
    return (this.files.has(normalized) || this.isBarebonesLib(normalized)) as bool;
  }

  ReadFile(fileName: string): [string, bool] {
    const normalized = normalizeTranspileKey(fileName);
    const content = this.files.get(normalized);
    if (content !== undefined) {
      return [content, true as bool];
    }
    if (this.isBarebonesLib(normalized)) {
      return [barebonesLibContent, true as bool];
    }
    return ["", false as bool];
  }

  WriteFile(fileName: string, data: string): GoError {
    this.setFile(fileName, data);
    return undefined;
  }

  AppendFile(fileName: string, data: string): GoError {
    this.setFile(fileName, (this.files.get(normalizeTranspileKey(fileName)) ?? "") + data);
    return undefined;
  }

  Remove(fileName: string): GoError {
    this.files.delete(normalizeTranspileKey(fileName));
    return undefined;
  }

  Chtimes(_path: string, _aTime: Time, _mTime: Time): GoError {
    return undefined;
  }

  DirectoryExists(_path: string): bool {
    return true as bool;
  }

  GetAccessibleEntries(path: string): Entries {
    const prefix = normalizeDirectoryKeyPrefix(path);
    const files: string[] = [];
    const directories = new Set<string>();
    for (const fileName of this.files.keys()) {
      if (!fileName.startsWith(prefix)) {
        continue;
      }
      const rest = fileName.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash === -1) {
        files.push(rest);
      } else {
        directories.add(rest.slice(0, slash));
      }
    }
    return {
      Files: files.sort(),
      Directories: [...directories].sort(),
      Symlinks: undefined,
    };
  }

  Stat(fileName: string): GoPtr<FileInfo> {
    const normalized = normalizeTranspileKey(fileName);
    if (this.FileExists(normalized)) {
      return new TranspileFileInfo(baseName(normalized), false);
    }
    if (this.DirectoryExists(normalized)) {
      return new TranspileFileInfo(baseName(normalized), true);
    }
    return undefined;
  }

  WalkDir(_root: string, _walkFn: WalkDirFunc): GoError {
    return undefined;
  }

  Realpath(fileName: string): string {
    return normalizeTranspilePath(fileName);
  }

  private isBarebonesLib(fileName: string): boolean {
    return this.declaration && /^lib(?:\..*)?\.d\.ts$/i.test(baseName(fileName));
  }
}

class TranspileFileInfo implements FileInfo {
  constructor(private readonly name: string, private readonly directory: boolean) {}

  Name(): string {
    return this.name;
  }

  Size(): int {
    return 0 as int;
  }

  Mode(): number {
    return this.directory ? 0x80000000 : 0;
  }

  ModTime(): Date {
    return new Date(0);
  }

  IsDir(): bool {
    return this.directory as bool;
  }

  Sys(): unknown {
    return undefined;
  }
}

class StringWriter implements Writer {
  readonly chunks: string[] = [];

  get text(): string {
    return this.chunks.join("");
  }

  Write(bytes: GoSlice<number>): [int, GoError] {
    this.chunks.push(new TextDecoder().decode(new Uint8Array(bytes)));
    return [bytes.length as int, undefined];
  }
}

function normalizeTranspilePath(fileName: string): string {
  let normalized = fileName.replaceAll("\\", "/");
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

function normalizeTranspileKey(fileName: string): string {
  return normalizeTranspilePath(fileName).replace(/^\/+/, "");
}

function normalizeDirectoryKeyPrefix(path: string): string {
  const normalized = normalizeTranspileKey(path);
  return normalized === "" || normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function baseName(fileName: string): string {
  const normalized = normalizeTranspilePath(fileName);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}
