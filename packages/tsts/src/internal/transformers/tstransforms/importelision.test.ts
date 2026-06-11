// Mirror of internal/transformers/tstransforms/importelision_test.go
// (TestImportElision), with the Go fakeProgram reproduced as a plain object
// implementing the checker Program interface, and parsetestutil/emittestutil
// inlined (testutil is suite-side in TSTS).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { HasFileName, SourceFile, SourceFileMetaData, StringLiteralLike } from "../../ast/ast.js";
import { SourceFile_Diagnostics, SourceFile_IsBound } from "../../ast/ast.js";
import { Diagnostic_MessageKey } from "../../ast/diagnostic.js";
import type { Node } from "../../ast/spine.js";
import type { SourceFileParseOptions } from "../../ast/parseoptions.js";
import { BindSourceFile } from "../../binder/binder.js";
import { Checker_GetEmitResolver } from "../../checker/checker/support.js";
import { EmitResolver_as_printer_EmitResolver } from "../../checker/emitresolver.js";
import { NewChecker } from "../../checker/checker/state.js";
import type { Program } from "../../checker/checker/state.js";
import type { CompilerOptions, ModuleKind, ResolutionMode } from "../../core/compileroptions.js";
import { ModuleKindESNext, NewLineKindLF } from "../../core/compileroptions.js";
import { GetScriptKindFromFileName } from "../../core/core.js";
import { LanguageVariantJSX } from "../../core/languagevariant.js";
import type { PackageId, ResolvedModule } from "../../module/types.js";
import type { InfoCacheEntry } from "../../packagejson/cache.js";
import { ParseSourceFile } from "../../parser/parser/statements-declarations.js";
import { NewEmitContext } from "../../printer/emitcontext.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import { NewPrinter } from "../../printer/printer/expressions.js";
import type { PrinterOptions, PrintHandlers } from "../../printer/printer/state.js";
import { Printer_EmitSourceFile } from "../../printer/printer/source-maps.js";
import type { KnownSymlinks } from "../../symlinks/knownsymlinks.js";
import type { ParsedCommandLine, SourceOutputAndProjectReference } from "../../tsoptions/parsedcommandline.js";
import type { Path } from "../../tspath/path.js";
import { ExtensionTs } from "../../tspath/extension.js";
import type { TransformOptions } from "../chain.js";
import { Transformer_TransformSourceFile } from "../transformer.js";
import { NewImportElisionTransformer } from "./importelision.js";
import { NewTypeEraserTransformer } from "./typeeraser.js";

// testutil/parsetestutil.ParseTypeScript
function parseTypeScript(text: string, jsx: boolean): GoPtr<SourceFile> {
  const fileName = jsx ? "/main.tsx" : "/main.ts";
  return ParseSourceFile({ FileName: fileName, Path: fileName } as SourceFileParseOptions, text, GetScriptKindFromFileName(fileName));
}

// testutil/parsetestutil.CheckDiagnostics
function checkDiagnostics(file: GoPtr<SourceFile>, message: string): void {
  const diagnostics = SourceFile_Diagnostics(file) ?? [];
  assert.equal(diagnostics.length, 0, `${message}${diagnostics.map((d) => Diagnostic_MessageKey(d)).join("\n")}`);
}

// testutil/emittestutil.CheckEmit
function checkEmit(emitContext: GoPtr<EmitContext>, file: GoPtr<SourceFile>, expected: string): void {
  const printer = NewPrinter({ NewLine: NewLineKindLF } as PrinterOptions, {} as PrintHandlers, emitContext);
  const text = Printer_EmitSourceFile(printer, file);
  const actual = text.endsWith("\n") ? text.slice(0, -1) : text;
  assert.equal(actual, expected);
  const file2 = parseTypeScript(text, file!.LanguageVariant === LanguageVariantJSX);
  checkDiagnostics(file2, "error on reparse: ");
}

interface fakeProgramOptions {
  compilerOptions: GoPtr<CompilerOptions>;
  files: Array<GoPtr<SourceFile>>;
  getEmitModuleFormatOfFile: (sourceFile: HasFileName) => ModuleKind;
  getImpliedNodeFormatForEmit: (sourceFile: HasFileName) => ModuleKind;
  getResolvedModule: (currentSourceFile: HasFileName, moduleReference: string, mode: ResolutionMode) => GoPtr<ResolvedModule>;
  getSourceFile: (fileName: string) => GoPtr<SourceFile>;
  getSourceFileForResolvedModule: (fileName: string) => GoPtr<SourceFile>;
}

// Go: fakeProgram — methods either delegate to the configured callbacks,
// return zero values, or panic ("unimplemented").
function fakeProgram(o: fakeProgramOptions): Program {
  return {
    GetRedirectForResolution: (_file: HasFileName): GoPtr<ParsedCommandLine> => {
      throw new globalThis.Error("unimplemented");
    },
    SourceFileMayBeEmitted: (_sourceFile: GoPtr<SourceFile>, _forceDtsEmit: bool): bool => {
      throw new globalThis.Error("unimplemented");
    },
    GetEmitSyntaxForUsageLocation: (_sourceFile: HasFileName, _usageLocation: GoPtr<StringLiteralLike>): ResolutionMode => {
      throw new globalThis.Error("unimplemented");
    },
    CommonSourceDirectory: (): string => {
      throw new globalThis.Error("unimplemented");
    },
    GetResolvedModuleFromModuleSpecifier: (_file: HasFileName, _moduleSpecifier: GoPtr<StringLiteralLike>): GoPtr<ResolvedModule> => {
      throw new globalThis.Error("unimplemented");
    },
    GetResolvedModules: (): GoMap<Path, never> => {
      throw new globalThis.Error("unimplemented");
    },
    FileExists: (_path: string): bool => false,
    GetCurrentDirectory: (): string => "",
    GetGlobalTypingsCacheLocation: (): string => "",
    GetNearestAncestorDirectoryWithPackageJson: (_dirname: string): string => "",
    GetSymlinkCache: (): GoPtr<KnownSymlinks> => undefined,
    ResolveModuleName: (_moduleName: string, _containingFile: string, _resolutionMode: ResolutionMode): GoPtr<ResolvedModule> => undefined,
    GetPackageJsonInfo: (_pkgJsonPath: string): GoPtr<InfoCacheEntry> => undefined,
    GetRedirectTargets: (_path: Path): GoSlice<string> => [],
    GetSourceOfProjectReferenceIfOutputIncluded: (_file: HasFileName): string => "",
    GetProjectReferenceFromSource: (_path: Path): GoPtr<SourceOutputAndProjectReference> => undefined,
    IsSourceFromProjectReference: (_path: Path): bool => false,
    GetPackagesMap: (): GoMap<string, bool> => undefined as unknown as GoMap<string, bool>,
    GetProjectReferenceFromOutputDts: (_path: Path): GoPtr<SourceOutputAndProjectReference> => undefined,
    UseCaseSensitiveFileNames: (): bool => true,
    Options: (): GoPtr<CompilerOptions> => o.compilerOptions,
    SourceFiles: (): GoSlice<GoPtr<SourceFile>> => o.files,
    BindSourceFiles: (): void => {
      for (const file of o.files) {
        if (!SourceFile_IsBound(file)) {
          BindSourceFile(file);
        }
      }
    },
    GetEmitModuleFormatOfFile: (sourceFile: HasFileName): ModuleKind => o.getEmitModuleFormatOfFile(sourceFile),
    GetImpliedNodeFormatForEmit: (sourceFile: HasFileName): ModuleKind => o.getImpliedNodeFormatForEmit(sourceFile),
    GetDefaultResolutionModeForFile: (sourceFile: HasFileName): ResolutionMode => o.getEmitModuleFormatOfFile(sourceFile),
    GetModeForUsageLocation: (sourceFile: HasFileName, _location: GoPtr<StringLiteralLike>): ResolutionMode => o.getEmitModuleFormatOfFile(sourceFile),
    GetResolvedModule: (currentSourceFile: HasFileName, moduleReference: string, mode: ResolutionMode): GoPtr<ResolvedModule> => o.getResolvedModule(currentSourceFile, moduleReference, mode),
    GetSourceFile: (fileName: string): GoPtr<SourceFile> => o.getSourceFile(fileName),
    GetSourceFileForResolvedModule: (fileName: string): GoPtr<SourceFile> => o.getSourceFileForResolvedModule(fileName),
    GetSourceFileMetaData: (_path: Path): SourceFileMetaData => ({ PackageJsonType: "", PackageJsonDirectory: "", ImpliedNodeFormat: 0 as ResolutionMode }),
    GetImportHelpersImportSpecifier: (_path: Path): GoPtr<Node> => undefined,
    GetJSXRuntimeImportSpecifier: (_path: Path): [string, GoPtr<Node>] => ["", undefined],
    IsSourceFileDefaultLibrary: (_path: Path): bool => false,
  } as unknown as Program;
}

const zeroPackageId = (): PackageId => ({ Name: "", SubModuleName: "", Version: "", PeerDependencies: "" });

const data: Array<{ title: string; input: string; output: string; other?: string; jsx?: boolean }> = [
  { title: "ImportEquals#1", input: 'import x = require("other"); x;', output: 'import x = require("other");\nx;' },
  { title: "ImportEquals#2", input: 'import x = require("other");', output: "" },
  { title: "ImportDeclaration#1", input: 'import "m";', output: 'import "m";' },
  { title: "ImportDeclaration#2", input: 'import * as x from "other"; x;', output: 'import * as x from "other";\nx;' },
  { title: "ImportDeclaration#3", input: 'import x from "other"; x;', output: 'import x from "other";\nx;' },
  { title: "ImportDeclaration#4", input: 'import { x } from "other"; x;', output: 'import { x } from "other";\nx;' },
  { title: "ImportDeclaration#5", input: 'import * as x from "other";', output: "" },
  { title: "ImportDeclaration#6", input: 'import x from "other";', output: "" },
  { title: "ImportDeclaration#7", input: 'import { x } from "other";', output: "" },
  { title: "ExportDeclaration#1", input: 'export * from "other";', other: "export let x;", output: 'export * from "other";' },
  { title: "ExportDeclaration#2", input: 'export * as x from "other";', other: "export let x;", output: 'export * as x from "other";' },
  { title: "ExportDeclaration#3", input: 'export * from "other";', other: "export let x;", output: 'export * from "other";' },
  { title: "ExportDeclaration#4", input: 'export * as x from "other";', other: "export let x;", output: 'export * as x from "other";' },
  { title: "ExportDeclaration#5", input: 'export { x } from "other";', other: "export let x;", output: 'export { x } from "other";' },
  { title: "ExportDeclaration#6", input: 'export { x } from "other";', other: "export type x = any;", output: "" },
  { title: "ExportDeclaration#7", input: "export { x }; let x;", output: "export { x };\nlet x;" },
  { title: "ExportDeclaration#8", input: "export { x }; type x = any;", output: "" },
  { title: "ExportDeclaration#9", input: 'import { x } from "other"; export { x };', other: "export type x = any;", output: "" },
  { title: "ExportAssignment#1", input: "let x; export default x;", output: "let x;\nexport default x;" },
  { title: "ExportAssignment#2", input: "type x = any; export default x;", output: "" },
];

for (const rec of data) {
  test(`ImportElision ${rec.title}`, () => {
    const file = parseTypeScript(rec.input, rec.jsx === true);
    checkDiagnostics(file, "");
    const files: Array<GoPtr<SourceFile>> = [file];

    let other: GoPtr<SourceFile>;
    if (rec.other !== undefined && rec.other.length > 0) {
      other = parseTypeScript(rec.other, rec.jsx === true);
      checkDiagnostics(other, "");
      files.push(other);
    }

    const compilerOptions = {} as CompilerOptions;

    const [c] = NewChecker(fakeProgram({
      compilerOptions: compilerOptions,
      files: files,
      getEmitModuleFormatOfFile: (_sourceFile) => ModuleKindESNext,
      getImpliedNodeFormatForEmit: (_sourceFile) => ModuleKindESNext,
      getSourceFile: (fileName) => (fileName === "other.ts" ? other : undefined),
      getSourceFileForResolvedModule: (fileName) => (fileName === "other.ts" ? other : undefined),
      getResolvedModule: (currentSourceFile, moduleReference, _mode) => {
        if (currentSourceFile === (file as unknown as HasFileName) && moduleReference === "other") {
          return {
            ResolutionDiagnostics: [],
            ResolvedFileName: "other.ts",
            OriginalPath: "",
            Extension: ExtensionTs,
            ResolvedUsingTsExtension: false,
            PackageId: zeroPackageId(),
            IsExternalLibraryImport: false,
            AlternateResult: "",
          };
        }
        return undefined;
      },
    }), undefined);

    // Go passes the checker's emit resolver directly (interfaces unify); the
    // port reaches the printer EmitResolver shape via the canonical adapter,
    // which also satisfies binder.ReferenceResolver.
    const emitResolver = EmitResolver_as_printer_EmitResolver(Checker_GetEmitResolver(c));
    emitResolver.MarkLinkedReferencesRecursively(file);

    const opts = { CompilerOptions: compilerOptions, Context: NewEmitContext(), EmitResolver: emitResolver, Resolver: emitResolver } as unknown as TransformOptions;
    let transformed = Transformer_TransformSourceFile(NewTypeEraserTransformer(opts), file);
    transformed = Transformer_TransformSourceFile(NewImportElisionTransformer(opts), transformed);
    checkEmit(undefined, transformed, rec.output);
  });
}
