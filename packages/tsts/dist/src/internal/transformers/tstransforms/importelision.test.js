// Mirror of internal/transformers/tstransforms/importelision_test.go
// (TestImportElision), with the Go fakeProgram reproduced as a plain object
// implementing the checker Program interface, and parsetestutil/emittestutil
// inlined (testutil is suite-side in TSTS).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SourceFile_Diagnostics, SourceFile_IsBound } from "../../ast/ast.js";
import { Diagnostic_MessageKey } from "../../ast/diagnostic.js";
import { BindSourceFile } from "../../binder/binder.js";
import { Checker_GetEmitResolver } from "../../checker/checker/support.js";
import { EmitResolver_as_printer_EmitResolver } from "../../checker/emitresolver.js";
import { NewChecker } from "../../checker/checker/state.js";
import { ModuleKindESNext, NewLineKindLF } from "../../core/compileroptions.js";
import { GetScriptKindFromFileName } from "../../core/core.js";
import { LanguageVariantJSX } from "../../core/languagevariant.js";
import { ParseSourceFile } from "../../parser/parser/statements-declarations.js";
import { NewEmitContext } from "../../printer/emitcontext.js";
import { NewPrinter } from "../../printer/printer/expressions.js";
import { Printer_EmitSourceFile } from "../../printer/printer/source-maps.js";
import { ExtensionTs } from "../../tspath/extension.js";
import { Transformer_TransformSourceFile } from "../transformer.js";
import { NewImportElisionTransformer } from "./importelision.js";
import { NewTypeEraserTransformer } from "./typeeraser.js";
// testutil/parsetestutil.ParseTypeScript
function parseTypeScript(text, jsx) {
    const fileName = jsx ? "/main.tsx" : "/main.ts";
    return ParseSourceFile({ FileName: fileName, Path: fileName }, text, GetScriptKindFromFileName(fileName));
}
// testutil/parsetestutil.CheckDiagnostics
function checkDiagnostics(file, message) {
    const diagnostics = SourceFile_Diagnostics(file) ?? [];
    assert.equal(diagnostics.length, 0, `${message}${diagnostics.map((d) => Diagnostic_MessageKey(d)).join("\n")}`);
}
// testutil/emittestutil.CheckEmit
function checkEmit(emitContext, file, expected) {
    const printer = NewPrinter({ NewLine: NewLineKindLF }, {}, emitContext);
    const text = Printer_EmitSourceFile(printer, file);
    const actual = text.endsWith("\n") ? text.slice(0, -1) : text;
    assert.equal(actual, expected);
    const file2 = parseTypeScript(text, file.LanguageVariant === LanguageVariantJSX);
    checkDiagnostics(file2, "error on reparse: ");
}
// Go: fakeProgram — methods either delegate to the configured callbacks,
// return zero values, or panic ("unimplemented").
function fakeProgram(o) {
    return {
        GetRedirectForResolution: (_file) => {
            throw new globalThis.Error("unimplemented");
        },
        SourceFileMayBeEmitted: (_sourceFile, _forceDtsEmit) => {
            throw new globalThis.Error("unimplemented");
        },
        GetEmitSyntaxForUsageLocation: (_sourceFile, _usageLocation) => {
            throw new globalThis.Error("unimplemented");
        },
        CommonSourceDirectory: () => {
            throw new globalThis.Error("unimplemented");
        },
        GetResolvedModuleFromModuleSpecifier: (_file, _moduleSpecifier) => {
            throw new globalThis.Error("unimplemented");
        },
        GetResolvedModules: () => {
            throw new globalThis.Error("unimplemented");
        },
        FileExists: (_path) => false,
        GetCurrentDirectory: () => "",
        GetGlobalTypingsCacheLocation: () => "",
        GetNearestAncestorDirectoryWithPackageJson: (_dirname) => "",
        GetSymlinkCache: () => undefined,
        ResolveModuleName: (_moduleName, _containingFile, _resolutionMode) => undefined,
        GetPackageJsonInfo: (_pkgJsonPath) => undefined,
        GetRedirectTargets: (_path) => [],
        GetSourceOfProjectReferenceIfOutputIncluded: (_file) => "",
        GetProjectReferenceFromSource: (_path) => undefined,
        IsSourceFromProjectReference: (_path) => false,
        GetPackagesMap: () => undefined,
        GetProjectReferenceFromOutputDts: (_path) => undefined,
        UseCaseSensitiveFileNames: () => true,
        Options: () => o.compilerOptions,
        SourceFiles: () => o.files,
        BindSourceFiles: () => {
            for (const file of o.files) {
                if (!SourceFile_IsBound(file)) {
                    BindSourceFile(file);
                }
            }
        },
        GetEmitModuleFormatOfFile: (sourceFile) => o.getEmitModuleFormatOfFile(sourceFile),
        GetImpliedNodeFormatForEmit: (sourceFile) => o.getImpliedNodeFormatForEmit(sourceFile),
        GetDefaultResolutionModeForFile: (sourceFile) => o.getEmitModuleFormatOfFile(sourceFile),
        GetModeForUsageLocation: (sourceFile, _location) => o.getEmitModuleFormatOfFile(sourceFile),
        GetResolvedModule: (currentSourceFile, moduleReference, mode) => o.getResolvedModule(currentSourceFile, moduleReference, mode),
        GetSourceFile: (fileName) => o.getSourceFile(fileName),
        GetSourceFileForResolvedModule: (fileName) => o.getSourceFileForResolvedModule(fileName),
        GetSourceFileMetaData: (_path) => ({ PackageJsonType: "", PackageJsonDirectory: "", ImpliedNodeFormat: 0 }),
        GetImportHelpersImportSpecifier: (_path) => undefined,
        GetJSXRuntimeImportSpecifier: (_path) => ["", undefined],
        IsSourceFileDefaultLibrary: (_path) => false,
    };
}
const zeroPackageId = () => ({ Name: "", SubModuleName: "", Version: "", PeerDependencies: "" });
const data = [
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
        const files = [file];
        let other;
        if (rec.other !== undefined && rec.other.length > 0) {
            other = parseTypeScript(rec.other, rec.jsx === true);
            checkDiagnostics(other, "");
            files.push(other);
        }
        const compilerOptions = {};
        const [c] = NewChecker(fakeProgram({
            compilerOptions: compilerOptions,
            files: files,
            getEmitModuleFormatOfFile: (_sourceFile) => ModuleKindESNext,
            getImpliedNodeFormatForEmit: (_sourceFile) => ModuleKindESNext,
            getSourceFile: (fileName) => (fileName === "other.ts" ? other : undefined),
            getSourceFileForResolvedModule: (fileName) => (fileName === "other.ts" ? other : undefined),
            getResolvedModule: (currentSourceFile, moduleReference, _mode) => {
                if (currentSourceFile === file && moduleReference === "other") {
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
        const opts = { CompilerOptions: compilerOptions, Context: NewEmitContext(), EmitResolver: emitResolver, Resolver: emitResolver };
        let transformed = Transformer_TransformSourceFile(NewTypeEraserTransformer(opts), file);
        transformed = Transformer_TransformSourceFile(NewImportElisionTransformer(opts), transformed);
        checkEmit(undefined, transformed, rec.output);
    });
}
//# sourceMappingURL=importelision.test.js.map