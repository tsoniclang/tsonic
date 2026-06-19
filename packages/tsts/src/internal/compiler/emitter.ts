import type { bool, byte, int } from "../../go/scalars.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { Node, SourceFile } from "../ast/ast.js";
import type { Diagnostic, DiagnosticsCollection } from "../ast/diagnostic.js";
import type { ReferenceResolver, ReferenceResolverHooks } from "../binder/referenceresolver.js";
import type { CompilerOptions, NewLineKind, ScriptTarget } from "../core/compileroptions.js";
import type { LanguageVariant } from "../core/languagevariant.js";
import type { OutputPaths } from "../outputpaths/outputpaths.js";
import type { EmitContext } from "../printer/emitcontext.js";
import type { EmitHost as EmitHost_b6591a53 } from "../printer/emithost.js";
import type { EmitTextWriter } from "../printer/emittextwriter.js";
import type { PrintHandlers, PrinterOptions, Printer } from "../printer/printer/state.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import type { Generator } from "../sourcemap/generator.js";
import type { Tracing } from "../tracing/tracing.js";
import type { TransformOptions } from "../transformers/chain.js";
import type { DeclarationTransformer } from "../transformers/declarations/transform.js";
import type { Transformer } from "../transformers/transformer.js";
import type { SourceOutputAndProjectReference } from "../tsoptions/parsedcommandline.js";
import type { Path } from "../tspath/path.js";
import type { EmitHost } from "./emitHost.js";
import { EmitHost_as_declarations_DeclarationEmitHost, EmitHost_as_printer_EmitHost } from "./emitHost.js";
import type { EmitResult, SourceMapEmitResult, WriteFileData } from "./program.js";
import { IsInJSFile, IsJsonSourceFile, IsSourceFileJS } from "../ast/utilities.js";
import { SourceFile_FileName, SourceFile_Path } from "../ast/ast.js";
import { NewCompilerDiagnostic, DiagnosticsCollection_Add, DiagnosticsCollection_GetDiagnostics } from "../ast/diagnostic.js";
import { NewReferenceResolver } from "../binder/referenceresolver.js";
import { Tristate_IsTrue, TSTrue, TSFalse } from "../core/tristate.js";
import { NewLineKindCRLF, CompilerOptions_GetEmitModuleKind, CompilerOptions_GetJSXTransformEnabled, CompilerOptions_GetIsolatedModules, CompilerOptions_GetEmitScriptTarget, ModuleKindPreserve, ModuleKindESNext, ModuleKindES2022, ModuleKindES2020, ModuleKindES2015, ModuleKindNode20, ModuleKindNode18, ModuleKindNode16, ModuleKindNodeNext, ModuleKindCommonJS } from "../core/compileroptions.js";
import { LanguageVariantJSX } from "../core/languagevariant.js";
import { Filter, Some, IfElse } from "../core/core.js";
import { GetCommonSourceDirectory } from "../outputpaths/commonsourcedirectory.js";
import { GetSourceFilePathInNewDir, GetSourceFilePathInNewDirWorker, OutputPaths_JsFilePath, OutputPaths_SourceMapFilePath, OutputPaths_DeclarationFilePath, OutputPaths_DeclarationMapPath } from "../outputpaths/outputpaths.js";
import { GetEmitContext } from "../printer/emitcontext.js";
import { NewPrinter } from "../printer/printer/expressions.js";
import { Printer_Write } from "../printer/printer/emit-core.js";
import { NewGenerator, Generator_Sources, Generator_RawSourceMap, Generator_Base64DataURL, Generator_String } from "../sourcemap/generator.js";
import { PhaseEmit, Tracing_Push } from "../tracing/tracing.js";
import { NewESModuleTransformer } from "../transformers/moduletransforms/esmodule.js";
import { NewImpliedModuleTransformer } from "../transformers/moduletransforms/impliedmodule.js";
import { NewCommonJSModuleTransformer } from "../transformers/moduletransforms/commonjsmodule.js";
import { NewMetadataTransformer } from "../transformers/tstransforms/metadata.js";
import { NewTypeEraserTransformer } from "../transformers/tstransforms/typeeraser.js";
import { NewImportElisionTransformer } from "../transformers/tstransforms/importelision.js";
import { NewRuntimeSyntaxTransformer } from "../transformers/tstransforms/runtimesyntax.js";
import { NewLegacyDecoratorsTransformer } from "../transformers/tstransforms/legacydecorators.js";
import { NewJSXTransformer } from "../transformers/jsxtransforms/jsx.js";
import { GetESTransformer } from "../transformers/estransforms/definitions.js";
import { NewUseStrictTransformer } from "../transformers/estransforms/usestrict.js";
import { NewConstEnumInliningTransformer } from "../transformers/inliners/constenum.js";
import { NewDeclarationTransformer, DeclarationTransformer_GetDiagnostics } from "../transformers/declarations/transform.js";
import { Transformer_TransformSourceFile } from "../transformers/transformer.js";
import { Could_not_write_file_0_Colon_1 } from "../diagnostics/generated/messages.js";
import { CombinePaths, EnsureTrailingDirectorySeparator, FileExtensionIs, GetBaseFileName, GetDirectoryPath, GetNormalizedAbsolutePath, GetRelativePathToDirectoryOrUrl, GetRootLength, NormalizePath, NormalizeSlashes, ComparePaths } from "../tspath/path.js";
import { ExtensionJson } from "../tspath/extension.js";
import { EncodeURI, AddUTF8ByteOrderMark } from "../stringutil/util.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::type::EmitOnly","kind":"type","status":"implemented","sigHash":"1958d246a44daf492c65aec0fb6b1cf3442407dc6463b06769a367a0c26e08ff","bodyHash":"0c69bbca4873981b8ee4a7bb25a2066b98a917dfd9499551f3df14e6760e7c67"}
 *
 * Go source:
 * EmitOnly byte
 */
export type EmitOnly = byte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::constGroup::EmitAll+EmitOnlyJs+EmitOnlyDts+EmitOnlyForcedDts","kind":"constGroup","status":"implemented","sigHash":"af569816f62f664fc9a4574da2e01107440b04234f2882eb1b60a90f3e23bee2","bodyHash":"46862dcc306e15ddbf5c6c7480a2b0376ac0561e06341b412deae4ec82385137"}
 *
 * Go source:
 * const (
 * 	EmitAll EmitOnly = iota
 * 	EmitOnlyJs
 * 	EmitOnlyDts
 * 	EmitOnlyForcedDts
 * )
 */
export const EmitAll: EmitOnly = 0;
export const EmitOnlyJs: EmitOnly = 1;
export const EmitOnlyDts: EmitOnly = 2;
export const EmitOnlyForcedDts: EmitOnly = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::type::emitter","kind":"type","status":"implemented","sigHash":"454673fa184afd6cc516ef23c6f14be2056fde32c5285194140584c8d2a3f1d9","bodyHash":"c0c17e1e1093155fed2b36136c3f63b4451e74b2627fb3a8d664b62615e55a2a"}
 *
 * Go source:
 * emitter struct {
 * 	host               EmitHost
 * 	emitOnly           EmitOnly
 * 	emitterDiagnostics ast.DiagnosticsCollection
 * 	writer             printer.EmitTextWriter
 * 	paths              *outputpaths.OutputPaths
 * 	sourceFile         *ast.SourceFile
 * 	emitResult         EmitResult
 * 	writeFile          func(fileName string, text string, data *WriteFileData) error
 * 	tr                 *tracing.Tracing
 * }
 */
export interface emitter {
  host: EmitHost;
  emitOnly: EmitOnly;
  emitterDiagnostics: DiagnosticsCollection;
  writer: EmitTextWriter;
  paths: GoPtr<OutputPaths>;
  sourceFile: GoPtr<SourceFile>;
  emitResult: EmitResult;
  writeFile: (fileName: string, text: string, data: GoPtr<WriteFileData>) => GoError;
  tr: GoPtr<Tracing>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.emit","kind":"method","status":"implemented","sigHash":"0c7c66cc05bd2f2c7ecc6cccbdddbe41483897a5e3bb4b485c80e447f16f22fe","bodyHash":"97fd61a75ce72765ab2f44eb59e0af574ed303fbbad47b041152085ca1b3e85d"}
 *
 * Go source:
 * func (e *emitter) emit() {
 * 	if e.tr != nil {
 * 		defer e.tr.Push(tracing.PhaseEmit, "emit", map[string]any{"path": string(e.sourceFile.Path())}, true)()
 * 	}
 * 	e.emitJSFile(e.sourceFile, e.paths.JsFilePath(), e.paths.SourceMapFilePath())
 * 	e.emitDeclarationFile(e.sourceFile, e.paths.DeclarationFilePath(), e.paths.DeclarationMapPath())
 * 	e.emitResult.Diagnostics = e.emitterDiagnostics.GetDiagnostics()
 * }
 */
export function emitter_emit(receiver: GoPtr<emitter>): void {
  const e = receiver!;
  let popTrace: (() => void) | undefined;
  if (e.tr !== undefined) {
    const pop = Tracing_Push(e.tr, PhaseEmit, "emit", new globalThis.Map([["path", globalThis.String(SourceFile_Path(e.sourceFile!))]]), true);
    popTrace = pop;
  }
  emitter_emitJSFile(receiver, e.sourceFile, OutputPaths_JsFilePath(e.paths), OutputPaths_SourceMapFilePath(e.paths));
  emitter_emitDeclarationFile(receiver, e.sourceFile, OutputPaths_DeclarationFilePath(e.paths), OutputPaths_DeclarationMapPath(e.paths));
  e.emitResult.Diagnostics = DiagnosticsCollection_GetDiagnostics(e.emitterDiagnostics);
  if (popTrace !== undefined) {
    popTrace();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.getDeclarationTransformers","kind":"method","status":"implemented","sigHash":"f61988fe726112c0a0cda088a6e24b6d791d9debc7ece7d7e9030abaa09fce49","bodyHash":"1d0ea39aefc946443843195c57f2462c1198de6666641532538a5d5ba223b82d"}
 *
 * Go source:
 * func (e *emitter) getDeclarationTransformers(emitContext *printer.EmitContext, declarationFilePath string, declarationMapPath string) []*declarations.DeclarationTransformer {
 * 	transform := declarations.NewDeclarationTransformer(e.host, emitContext, e.host.Options(), declarationFilePath, declarationMapPath)
 * 	return []*declarations.DeclarationTransformer{transform}
 * }
 */
export function emitter_getDeclarationTransformers(receiver: GoPtr<emitter>, emitContext: GoPtr<EmitContext>, declarationFilePath: string, declarationMapPath: string): GoSlice<GoPtr<DeclarationTransformer>> {
  const e = receiver!;
  const transform = NewDeclarationTransformer(EmitHost_as_declarations_DeclarationEmitHost(e.host), emitContext, e.host.Options(), declarationFilePath, declarationMapPath);
  return [transform];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.runScriptTransformers","kind":"method","status":"implemented","sigHash":"4ac8779ee086685c0955fb283f4e994ab17295f4132baa376fb8df914733cc5e","bodyHash":"ede515a30b656f36776f9417047dbe60b4995c49009a9f5a2a8bcb400069dd3c"}
 *
 * Go source:
 * func (e *emitter) runScriptTransformers(emitContext *printer.EmitContext, sourceFile *ast.SourceFile) *ast.SourceFile {
 * 	if e.tr != nil {
 * 		defer e.tr.Push(tracing.PhaseEmit, "transformNodes", map[string]any{"path": string(sourceFile.Path())}, false)()
 * 	}
 * 	for _, transformer := range getScriptTransformers(emitContext, e.host, sourceFile) {
 * 		sourceFile = transformer.TransformSourceFile(sourceFile)
 * 	}
 * 	return sourceFile
 * }
 */
export function emitter_runScriptTransformers(receiver: GoPtr<emitter>, emitContext: GoPtr<EmitContext>, sourceFile: GoPtr<SourceFile>): GoPtr<SourceFile> {
  const e = receiver!;
  let popTrace: (() => void) | undefined;
  if (e.tr !== undefined) {
    const pop = Tracing_Push(e.tr, PhaseEmit, "transformNodes", new globalThis.Map([["path", globalThis.String(SourceFile_Path(sourceFile!))]]), false);
    popTrace = pop;
  }
  let sf = sourceFile;
  for (const transformer of getScriptTransformers(emitContext, EmitHost_as_printer_EmitHost(e.host), sf)) {
    sf = Transformer_TransformSourceFile(transformer, sf);
  }
  if (popTrace !== undefined) {
    popTrace();
  }
  return sf;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.runDeclarationTransformers","kind":"method","status":"implemented","sigHash":"ee77c7dc30add2b807bb8fd1717ad9bfb88c8848802128f762cc14fd56cb430d","bodyHash":"a7335ea41618bd76bd32e530b057b92bfbfef2a0e28dbcea835fe9e30b39d267"}
 *
 * Go source:
 * func (e *emitter) runDeclarationTransformers(emitContext *printer.EmitContext, sourceFile *ast.SourceFile, declarationFilePath, declarationMapPath string) (*ast.SourceFile, []*ast.Diagnostic) {
 * 	if e.tr != nil {
 * 		defer e.tr.Push(tracing.PhaseEmit, "transformNodes", map[string]any{"path": string(sourceFile.Path())}, false)()
 * 	}
 * 	var diags []*ast.Diagnostic
 * 	for _, transformer := range e.getDeclarationTransformers(emitContext, declarationFilePath, declarationMapPath) {
 * 		sourceFile = transformer.TransformSourceFile(sourceFile)
 * 		diags = append(diags, transformer.GetDiagnostics()...)
 * 	}
 * 	return sourceFile, diags
 * }
 */
export function emitter_runDeclarationTransformers(receiver: GoPtr<emitter>, emitContext: GoPtr<EmitContext>, sourceFile: GoPtr<SourceFile>, declarationFilePath: string, declarationMapPath: string): [GoPtr<SourceFile>, GoSlice<GoPtr<Diagnostic>>] {
  const e = receiver!;
  let popTrace: (() => void) | undefined;
  if (e.tr !== undefined) {
    const pop = Tracing_Push(e.tr, PhaseEmit, "transformNodes", new globalThis.Map([["path", globalThis.String(SourceFile_Path(sourceFile!))]]), false);
    popTrace = pop;
  }
  let diags: GoSlice<GoPtr<Diagnostic>> = [];
  let sf = sourceFile;
  for (const transformer of emitter_getDeclarationTransformers(receiver, emitContext, declarationFilePath, declarationMapPath)) {
    sf = Transformer_TransformSourceFile(transformer as GoPtr<Transformer>, sf);
    diags = [...diags, ...DeclarationTransformer_GetDiagnostics(transformer)];
  }
  if (popTrace !== undefined) {
    popTrace();
  }
  return [sf, diags];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::getModuleTransformer","kind":"func","status":"implemented","sigHash":"9b7f759fe1a0490c1beff7b562486af6a7d9ab85991b7a8fbbe2e259dc285744","bodyHash":"51c8389a4e1524fd75ce38060ff96efff5b9d3580916c26a7eb18654e47baa33"}
 *
 * Go source:
 * func getModuleTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	switch opts.CompilerOptions.GetEmitModuleKind() {
 * 	case core.ModuleKindPreserve:
 * 		// `ESModuleTransformer` contains logic for preserving CJS input syntax in `--module preserve`
 * 		return moduletransforms.NewESModuleTransformer(opts)
 *
 * 	case core.ModuleKindESNext,
 * 		core.ModuleKindES2022,
 * 		core.ModuleKindES2020,
 * 		core.ModuleKindES2015,
 * 		core.ModuleKindNode20,
 * 		core.ModuleKindNode18,
 * 		core.ModuleKindNode16,
 * 		core.ModuleKindNodeNext,
 * 		core.ModuleKindCommonJS:
 * 		return moduletransforms.NewImpliedModuleTransformer(opts)
 *
 * 	default:
 * 		return moduletransforms.NewCommonJSModuleTransformer(opts)
 * 	}
 * }
 */
export function getModuleTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  switch (CompilerOptions_GetEmitModuleKind(opts!.CompilerOptions)) {
    case ModuleKindPreserve:
      // `ESModuleTransformer` contains logic for preserving CJS input syntax in `--module preserve`
      return NewESModuleTransformer(opts);

    case ModuleKindESNext:
    case ModuleKindES2022:
    case ModuleKindES2020:
    case ModuleKindES2015:
    case ModuleKindNode20:
    case ModuleKindNode18:
    case ModuleKindNode16:
    case ModuleKindNodeNext:
    case ModuleKindCommonJS:
      return NewImpliedModuleTransformer(opts);

    default:
      return NewCommonJSModuleTransformer(opts);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::getScriptTransformers","kind":"func","status":"implemented","sigHash":"6434cac1fca3cba843a83cdc6ecd9d1b1b9b7373f82be41ce7193c133fc01c1e","bodyHash":"09f63cd5016acf0d9166879de5e05b0596a5e50860f14c84916626fefbed9d6f"}
 *
 * Go source:
 * func getScriptTransformers(emitContext *printer.EmitContext, host printer.EmitHost, sourceFile *ast.SourceFile) []*transformers.Transformer {
 * 	var tx []*transformers.Transformer
 * 	options := host.Options()
 *
 * 	// JS files don't use reference calculations as they don't do import elision, no need to calculate it
 * 	importElisionEnabled := !options.VerbatimModuleSyntax.IsTrue() && !ast.IsInJSFile(sourceFile.AsNode())
 * 	jsxTransformEnabled := options.GetJSXTransformEnabled() && sourceFile.LanguageVariant == core.LanguageVariantJSX
 *
 * 	emitResolver := host.GetEmitResolver()
 *
 * 	var referenceResolver binder.ReferenceResolver
 * 	if importElisionEnabled || jsxTransformEnabled || !options.GetIsolatedModules() || options.EmitDecoratorMetadata.IsTrue() {
 * 		emitResolver.MarkLinkedReferencesRecursively(sourceFile)
 * 		referenceResolver = emitResolver
 * 	} else {
 * 		referenceResolver = binder.NewReferenceResolver(options, binder.ReferenceResolverHooks{})
 * 	}
 *
 * 	opts := transformers.TransformOptions{
 * 		Context:                   emitContext,
 * 		CompilerOptions:           options,
 * 		Resolver:                  referenceResolver,
 * 		EmitResolver:              emitResolver,
 * 		GetEmitModuleFormatOfFile: host.GetEmitModuleFormatOfFile,
 * 	}
 *
 * 	// transform TypeScript syntax
 * 	{
 * 		// use type nodes to add metadata decorators
 * 		if options.EmitDecoratorMetadata.IsTrue() {
 * 			tx = append(tx, tstransforms.NewMetadataTransformer(&opts))
 * 		}
 *
 * 		// erase types
 * 		tx = append(tx, tstransforms.NewTypeEraserTransformer(&opts))
 *
 * 		// elide imports
 * 		if importElisionEnabled {
 * 			tx = append(tx, tstransforms.NewImportElisionTransformer(&opts))
 * 		}
 *
 * 		// transform `enum`, `namespace`, and parameter properties
 * 		tx = append(tx, tstransforms.NewRuntimeSyntaxTransformer(&opts))
 *
 * 		if options.ExperimentalDecorators.IsTrue() {
 * 			tx = append(tx, tstransforms.NewLegacyDecoratorsTransformer(&opts))
 * 		}
 * 	}
 *
 * 	if jsxTransformEnabled {
 * 		tx = append(tx, jsxtransforms.NewJSXTransformer(&opts))
 * 	}
 *
 * 	downleveler := estransforms.GetESTransformer(&opts)
 * 	if downleveler != nil {
 * 		tx = append(tx, downleveler)
 * 	}
 *
 * 	tx = append(tx, estransforms.NewUseStrictTransformer(&opts))
 *
 * 	// transform module syntax
 * 	tx = append(tx, getModuleTransformer(&opts))
 *
 * 	// inlining (formerly done via substitutions)
 * 	if !options.GetIsolatedModules() {
 * 		tx = append(tx, inliners.NewConstEnumInliningTransformer(&opts))
 * 	}
 * 	return tx
 * }
 */
export function getScriptTransformers(emitContext: GoPtr<EmitContext>, host: EmitHost_b6591a53, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<Transformer>> {
  const tx: GoSlice<GoPtr<Transformer>> = [];
  const options = host.Options();

  // JS files don't use reference calculations as they don't do import elision, no need to calculate it
  const importElisionEnabled = !Tristate_IsTrue(options!.VerbatimModuleSyntax) && !IsInJSFile(sourceFile as GoPtr<Node>);
  const jsxTransformEnabled = CompilerOptions_GetJSXTransformEnabled(options) && sourceFile!.LanguageVariant === LanguageVariantJSX;

  const emitResolver = host.GetEmitResolver();

  let referenceResolver: ReferenceResolver;
  if (importElisionEnabled || jsxTransformEnabled || !CompilerOptions_GetIsolatedModules(options) || Tristate_IsTrue(options!.EmitDecoratorMetadata)) {
    emitResolver.MarkLinkedReferencesRecursively(sourceFile);
    referenceResolver = emitResolver;
  } else {
    referenceResolver = NewReferenceResolver(options, {} as ReferenceResolverHooks);
  }

  const opts: TransformOptions = {
    Context: emitContext,
    CompilerOptions: options,
    Resolver: referenceResolver,
    EmitResolver: emitResolver,
    GetEmitModuleFormatOfFile: (file) => host.GetEmitModuleFormatOfFile(file),
  };

  // transform TypeScript syntax
  {
    // use type nodes to add metadata decorators
    if (Tristate_IsTrue(options!.EmitDecoratorMetadata)) {
      tx.push(NewMetadataTransformer(opts));
    }

    // erase types
    tx.push(NewTypeEraserTransformer(opts));

    // elide imports
    if (importElisionEnabled) {
      tx.push(NewImportElisionTransformer(opts));
    }

    // transform `enum`, `namespace`, and parameter properties
    tx.push(NewRuntimeSyntaxTransformer(opts));

    if (Tristate_IsTrue(options!.ExperimentalDecorators)) {
      tx.push(NewLegacyDecoratorsTransformer(opts));
    }
  }

  if (jsxTransformEnabled) {
    tx.push(NewJSXTransformer(opts));
  }

  const downleveler = GetESTransformer(opts);
  if (downleveler !== undefined) {
    tx.push(downleveler);
  }

  tx.push(NewUseStrictTransformer(opts));

  // transform module syntax
  tx.push(getModuleTransformer(opts));

  // inlining (formerly done via substitutions)
  if (!CompilerOptions_GetIsolatedModules(options)) {
    tx.push(NewConstEnumInliningTransformer(opts));
  }
  return tx;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.emitJSFile","kind":"method","status":"implemented","sigHash":"48c35cf58379c75d20e7027257a6c585c17e057a4d5b48b1afa70715d47a797a","bodyHash":"cd29496225758685c60205c2f1c09087ef053b50feb63e9eeade4b76d80a8566"}
 *
 * Go source:
 * func (e *emitter) emitJSFile(sourceFile *ast.SourceFile, jsFilePath string, sourceMapFilePath string) {
 * 	options := e.host.Options()
 *
 * 	if sourceFile == nil || e.emitOnly != EmitAll && e.emitOnly != EmitOnlyJs || len(jsFilePath) == 0 {
 * 		return
 * 	}
 *
 * 	if options.NoEmit == core.TSTrue || e.host.IsEmitBlocked(jsFilePath) {
 * 		e.emitResult.EmitSkipped = true
 * 		return
 * 	}
 *
 * 	if e.tr != nil {
 * 		defer e.tr.Push(tracing.PhaseEmit, "emitJsFileOrBundle", map[string]any{"jsFilePath": jsFilePath}, true)()
 * 	}
 *
 * 	emitContext, putEmitContext := printer.GetEmitContext()
 * 	defer putEmitContext()
 *
 * 	sourceFile = e.runScriptTransformers(emitContext, sourceFile)
 *
 * 	printerOptions := printer.PrinterOptions{
 * 		RemoveComments:  options.RemoveComments.IsTrue(),
 * 		NewLine:         options.NewLine,
 * 		NoEmitHelpers:   options.NoEmitHelpers.IsTrue(),
 * 		SourceMap:       options.SourceMap.IsTrue(),
 * 		InlineSourceMap: options.InlineSourceMap.IsTrue(),
 * 		InlineSources:   options.InlineSources.IsTrue(),
 * 		Target:          options.Target,
 * 		// !!!
 * 	}
 *
 * 	// create a printer to print the nodes
 * 	printer := printer.NewPrinter(printerOptions, printer.PrintHandlers{
 * 		// !!!
 * 	}, emitContext)
 *
 * 	e.printSourceFile(jsFilePath, sourceMapFilePath, sourceFile, printer, options, shouldEmitSourceMaps(options, sourceFile))
 * }
 */
export function emitter_emitJSFile(receiver: GoPtr<emitter>, sourceFile: GoPtr<SourceFile>, jsFilePath: string, sourceMapFilePath: string): void {
  const e = receiver!;
  const options = e.host.Options();

  if (sourceFile === undefined || (e.emitOnly !== EmitAll && e.emitOnly !== EmitOnlyJs) || jsFilePath.length === 0) {
    return;
  }

  if (options!.NoEmit === TSTrue || e.host.IsEmitBlocked(jsFilePath)) {
    e.emitResult.EmitSkipped = true;
    return;
  }

  let popTrace: (() => void) | undefined;
  if (e.tr !== undefined) {
    const pop = Tracing_Push(e.tr, PhaseEmit, "emitJsFileOrBundle", new globalThis.Map([["jsFilePath", jsFilePath]]), true);
    popTrace = pop;
  }

  const [emitContext, putEmitContext] = GetEmitContext();
  try {
    let sf = emitter_runScriptTransformers(receiver, emitContext, sourceFile);

    const printerOptions: PrinterOptions = {
      RemoveComments: Tristate_IsTrue(options!.RemoveComments),
      NewLine: options!.NewLine,
      NoEmitHelpers: Tristate_IsTrue(options!.NoEmitHelpers),
      SourceMap: Tristate_IsTrue(options!.SourceMap),
      InlineSourceMap: Tristate_IsTrue(options!.InlineSourceMap),
      InlineSources: Tristate_IsTrue(options!.InlineSources),
      Target: options!.Target,
      // !!!
      OmitBraceSourceMapPositions: false,
      OnlyPrintJSDocStyle: false,
      NeverAsciiEscape: false,
      PreserveSourceNewlines: false,
      TerminateUnterminatedLiterals: false,
    };

    // create a printer to print the nodes
    const p = NewPrinter(printerOptions, {} as PrintHandlers, emitContext);

    emitter_printSourceFile(receiver, jsFilePath, sourceMapFilePath, sf, p, options, shouldEmitSourceMaps(options, sf));
  } finally {
    putEmitContext();
    if (popTrace !== undefined) {
      popTrace();
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.emitDeclarationFile","kind":"method","status":"implemented","sigHash":"6d491c974ae023bad1223b5e586fa4d1b7c289cd44aca89d4cf3e8eec522a18f","bodyHash":"c3551b193b04074a2d82589acf48aa745bd69532c686936b96bcc75c326d6eb1"}
 *
 * Go source:
 * func (e *emitter) emitDeclarationFile(sourceFile *ast.SourceFile, declarationFilePath string, declarationMapPath string) {
 * 	options := e.host.Options()
 *
 * 	if sourceFile == nil || e.emitOnly == EmitOnlyJs || len(declarationFilePath) == 0 {
 * 		return
 * 	}
 *
 * 	if e.tr != nil {
 * 		defer e.tr.Push(tracing.PhaseEmit, "emitDeclarationFileOrBundle", map[string]any{"declarationFilePath": declarationFilePath}, true)()
 * 	}
 *
 * 	emitContext, putEmitContext := printer.GetEmitContext()
 * 	defer putEmitContext()
 * 	sourceFile, diags := e.runDeclarationTransformers(emitContext, sourceFile, declarationFilePath, declarationMapPath)
 *
 * 	for _, elem := range diags {
 * 		// Add declaration transform diagnostics to emit diagnostics
 * 		e.emitterDiagnostics.Add(elem)
 * 	}
 *
 * 	if e.emitOnly != EmitOnlyForcedDts && (options.NoEmit == core.TSTrue || e.host.IsEmitBlocked(declarationFilePath)) {
 * 		e.emitResult.EmitSkipped = true
 * 		return
 * 	}
 *
 * 	declBlocked := len(diags) > 0 && e.emitOnly != EmitOnlyForcedDts
 * 	if declBlocked {
 * 		e.emitResult.EmitSkipped = true
 * 		return
 * 	}
 *
 * 	printerOptions := printer.PrinterOptions{
 * 		RemoveComments: options.RemoveComments.IsTrue(),
 * 		NewLine:        options.NewLine,
 * 		NoEmitHelpers:  true,
 * 		// Module: 			   options.Module, // NYI
 * 		// ModuleResolution:   options.ModuleResolution, // NYI
 * 		Target:          options.GetEmitScriptTarget(),
 * 		SourceMap:       e.emitOnly != EmitOnlyForcedDts && options.DeclarationMap.IsTrue(),
 * 		InlineSourceMap: options.InlineSourceMap.IsTrue(),
 * 		// InlineSources:       options.InlineSources.IsTrue(), // ignored, per strada
 * 		// ExtendedDiagnostics: options.ExtendedDiagnostics.IsTrue(), // NYI
 * 		OnlyPrintJSDocStyle:         true,
 * 		OmitBraceSourceMapPositions: true,
 * 	}
 *
 * 	// create a printer to print the nodes
 * 	printer := printer.NewPrinter(printerOptions, printer.PrintHandlers{
 * 		// !!!
 * 	}, emitContext)
 *
 * 	declarationMapOptions := &core.CompilerOptions{
 * 		SourceMap:  core.IfElse(e.emitOnly != EmitOnlyForcedDts && options.DeclarationMap.IsTrue(), core.TSTrue, core.TSFalse),
 * 		SourceRoot: options.SourceRoot,
 * 		MapRoot:    options.MapRoot,
 * 		// Explicitly do not pass through either inline option.
 * 	}
 * 	e.printSourceFile(declarationFilePath, declarationMapPath, sourceFile, printer, declarationMapOptions, shouldEmitSourceMaps(declarationMapOptions, sourceFile))
 * }
 */
export function emitter_emitDeclarationFile(receiver: GoPtr<emitter>, sourceFile: GoPtr<SourceFile>, declarationFilePath: string, declarationMapPath: string): void {
  const e = receiver!;
  const options = e.host.Options();

  if (sourceFile === undefined || e.emitOnly === EmitOnlyJs || declarationFilePath.length === 0) {
    return;
  }

  let popTrace: (() => void) | undefined;
  if (e.tr !== undefined) {
    const pop = Tracing_Push(e.tr, PhaseEmit, "emitDeclarationFileOrBundle", new globalThis.Map([["declarationFilePath", declarationFilePath]]), true);
    popTrace = pop;
  }

  const [emitContext, putEmitContext] = GetEmitContext();
  try {
    const [sf, diags] = emitter_runDeclarationTransformers(receiver, emitContext, sourceFile, declarationFilePath, declarationMapPath);

    for (const elem of diags) {
      // Add declaration transform diagnostics to emit diagnostics
      DiagnosticsCollection_Add(e.emitterDiagnostics, elem);
    }

    if (e.emitOnly !== EmitOnlyForcedDts && (options!.NoEmit === TSTrue || e.host.IsEmitBlocked(declarationFilePath))) {
      e.emitResult.EmitSkipped = true;
      return;
    }

    const declBlocked = diags.length > 0 && e.emitOnly !== EmitOnlyForcedDts;
    if (declBlocked) {
      e.emitResult.EmitSkipped = true;
      return;
    }

    const printerOptions: PrinterOptions = {
      RemoveComments: Tristate_IsTrue(options!.RemoveComments),
      NewLine: options!.NewLine,
      NoEmitHelpers: true,
      // Module:            options.Module, // NYI
      // ModuleResolution:  options.ModuleResolution, // NYI
      Target: CompilerOptions_GetEmitScriptTarget(options),
      SourceMap: e.emitOnly !== EmitOnlyForcedDts && Tristate_IsTrue(options!.DeclarationMap),
      InlineSourceMap: Tristate_IsTrue(options!.InlineSourceMap),
      // InlineSources:       options.InlineSources.IsTrue(), // ignored, per strada
      // ExtendedDiagnostics: options.ExtendedDiagnostics.IsTrue(), // NYI
      OnlyPrintJSDocStyle: true,
      OmitBraceSourceMapPositions: true,
      NeverAsciiEscape: false,
      PreserveSourceNewlines: false,
      TerminateUnterminatedLiterals: false,
    };

    // create a printer to print the nodes
    const p = NewPrinter(printerOptions, {} as PrintHandlers, emitContext);

    const declarationMapOptions: GoPtr<CompilerOptions> = {
      SourceMap: IfElse(e.emitOnly !== EmitOnlyForcedDts && Tristate_IsTrue(options!.DeclarationMap), TSTrue, TSFalse),
      SourceRoot: options!.SourceRoot,
      MapRoot: options!.MapRoot,
      // Explicitly do not pass through either inline option.
    } as CompilerOptions;
    emitter_printSourceFile(receiver, declarationFilePath, declarationMapPath, sf, p, declarationMapOptions, shouldEmitSourceMaps(declarationMapOptions, sf));
  } finally {
    putEmitContext();
    if (popTrace !== undefined) {
      popTrace();
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.printSourceFile","kind":"method","status":"implemented","sigHash":"1420a7b2cd5e3740e34c3e43eaa1bc1efa6e2edce1d206f06670737feee6c758","bodyHash":"432b6266097dd9973560b9ce0ed09a0289c73909c5940392ca8d962bc9e9b102"}
 *
 * Go source:
 * func (e *emitter) printSourceFile(jsFilePath string, sourceMapFilePath string, sourceFile *ast.SourceFile, printer_ *printer.Printer, mapOptions *core.CompilerOptions, shouldEmitSourceMaps bool) {
 * 	// !!! sourceMapGenerator
 * 	options := e.host.Options()
 * 	var sourceMapGenerator *sourcemap.Generator
 * 	if shouldEmitSourceMaps {
 * 		sourceMapGenerator = sourcemap.NewGenerator(
 * 			tspath.GetBaseFileName(tspath.NormalizeSlashes(jsFilePath)),
 * 			getSourceRoot(mapOptions),
 * 			e.getSourceMapDirectory(mapOptions, jsFilePath, sourceFile),
 * 			tspath.ComparePathsOptions{
 * 				UseCaseSensitiveFileNames: e.host.UseCaseSensitiveFileNames(),
 * 				CurrentDirectory:          e.host.GetCurrentDirectory(),
 * 			},
 * 		)
 * 	}
 *
 * 	printer_.Write(sourceFile.AsNode(), sourceFile, e.writer, sourceMapGenerator)
 *
 * 	sourceMapUrlPos := -1
 * 	if sourceMapGenerator != nil {
 * 		if mapOptions.SourceMap.IsTrue() || mapOptions.InlineSourceMap.IsTrue() {
 * 			e.emitResult.SourceMaps = append(e.emitResult.SourceMaps, &SourceMapEmitResult{
 * 				InputSourceFileNames: sourceMapGenerator.Sources(),
 * 				SourceMap:            sourceMapGenerator.RawSourceMap(),
 * 				GeneratedFile:        jsFilePath,
 * 			})
 * 		}
 *
 * 		sourceMappingURL := e.getSourceMappingURL(
 * 			mapOptions,
 * 			sourceMapGenerator,
 * 			jsFilePath,
 * 			sourceMapFilePath,
 * 			sourceFile,
 * 		)
 *
 * 		if len(sourceMappingURL) > 0 {
 * 			if !e.writer.IsAtStartOfLine() {
 * 				e.writer.RawWrite(core.IfElse(options.NewLine == core.NewLineKindCRLF, "\r\n", "\n"))
 * 			}
 * 			sourceMapUrlPos = e.writer.GetTextPos()
 * 			e.writer.WriteComment("//# sourceMappingURL=")
 * 			e.writer.WriteComment(sourceMappingURL)
 * 		}
 *
 * 		// Write the source map
 * 		if len(sourceMapFilePath) > 0 {
 * 			sourceMap := sourceMapGenerator.String()
 * 			err := e.writeText(sourceMapFilePath, sourceMap, nil)
 * 			if err != nil {
 * 				e.emitterDiagnostics.Add(ast.NewCompilerDiagnostic(diagnostics.Could_not_write_file_0_Colon_1, jsFilePath, err.Error()))
 * 			} else {
 * 				e.emitResult.EmittedFiles = append(e.emitResult.EmittedFiles, sourceMapFilePath)
 * 			}
 * 		}
 * 	} else {
 * 		e.writer.WriteLine()
 * 	}
 *
 * 	// Write the output file
 * 	text := e.writer.String()
 * 	if options.EmitBOM.IsTrue() {
 * 		text = stringutil.AddUTF8ByteOrderMark(text)
 * 	}
 * 	data := &WriteFileData{
 * 		SourceMapUrlPos: sourceMapUrlPos,
 * 		Diagnostics:     e.emitterDiagnostics.GetDiagnostics(),
 * 	}
 * 	err := e.writeText(jsFilePath, text, data)
 * 	skippedDtsWrite := data.SkippedDtsWrite
 * 	if err != nil {
 * 		e.emitterDiagnostics.Add(ast.NewCompilerDiagnostic(diagnostics.Could_not_write_file_0_Colon_1, jsFilePath, err.Error()))
 * 	} else if !skippedDtsWrite {
 * 		e.emitResult.EmittedFiles = append(e.emitResult.EmittedFiles, jsFilePath)
 * 	}
 *
 * 	// Reset state
 * 	e.writer.Clear()
 * }
 */
export function emitter_printSourceFile(receiver: GoPtr<emitter>, jsFilePath: string, sourceMapFilePath: string, sourceFile: GoPtr<SourceFile>, printer_: GoPtr<Printer>, mapOptions: GoPtr<CompilerOptions>, shouldEmitSourceMaps: bool): void {
  const e = receiver!;
  // !!! sourceMapGenerator
  const options = e.host.Options();
  let sourceMapGenerator: GoPtr<Generator> = undefined;
  if (shouldEmitSourceMaps) {
    sourceMapGenerator = NewGenerator(
      GetBaseFileName(NormalizeSlashes(jsFilePath)),
      getSourceRoot(mapOptions),
      emitter_getSourceMapDirectory(receiver, mapOptions, jsFilePath, sourceFile),
      {
        UseCaseSensitiveFileNames: e.host.UseCaseSensitiveFileNames(),
        CurrentDirectory: e.host.GetCurrentDirectory(),
      } as ComparePathsOptions,
    );
  }

  Printer_Write(printer_, sourceFile as GoPtr<Node>, sourceFile, e.writer, sourceMapGenerator);

  let sourceMapUrlPos = -1;
  if (sourceMapGenerator !== undefined) {
    if (Tristate_IsTrue(mapOptions!.SourceMap) || Tristate_IsTrue(mapOptions!.InlineSourceMap)) {
      e.emitResult.SourceMaps = [...e.emitResult.SourceMaps, {
        InputSourceFileNames: Generator_Sources(sourceMapGenerator),
        SourceMap: Generator_RawSourceMap(sourceMapGenerator),
        GeneratedFile: jsFilePath,
      } as SourceMapEmitResult];
    }

    const sourceMappingURL = emitter_getSourceMappingURL(
      receiver,
      mapOptions,
      sourceMapGenerator,
      jsFilePath,
      sourceMapFilePath,
      sourceFile,
    );

    if (sourceMappingURL.length > 0) {
      if (!e.writer.IsAtStartOfLine()) {
        e.writer.RawWrite(IfElse(options!.NewLine === NewLineKindCRLF, "\r\n", "\n"));
      }
      sourceMapUrlPos = e.writer.GetTextPos();
      e.writer.WriteComment("//# sourceMappingURL=");
      e.writer.WriteComment(sourceMappingURL);
    }

    // Write the source map
    if (sourceMapFilePath.length > 0) {
      const sourceMap = Generator_String(sourceMapGenerator);
      const err = emitter_writeText(receiver, sourceMapFilePath, sourceMap, undefined);
      if (err !== undefined) {
        DiagnosticsCollection_Add(e.emitterDiagnostics, NewCompilerDiagnostic(Could_not_write_file_0_Colon_1, jsFilePath, err.message));
      } else {
        e.emitResult.EmittedFiles = [...e.emitResult.EmittedFiles, sourceMapFilePath];
      }
    }
  } else {
    e.writer.WriteLine();
  }

  // Write the output file
  let text = e.writer.String();
  if (Tristate_IsTrue(options!.EmitBOM)) {
    text = AddUTF8ByteOrderMark(text);
  }
  const data: WriteFileData = {
    SourceMapUrlPos: sourceMapUrlPos,
    BuildInfo: undefined,
    Diagnostics: DiagnosticsCollection_GetDiagnostics(e.emitterDiagnostics),
    SkippedDtsWrite: false,
  };
  const err = emitter_writeText(receiver, jsFilePath, text, data);
  const skippedDtsWrite = data.SkippedDtsWrite;
  if (err !== undefined) {
    DiagnosticsCollection_Add(e.emitterDiagnostics, NewCompilerDiagnostic(Could_not_write_file_0_Colon_1, jsFilePath, err.message));
  } else if (!skippedDtsWrite) {
    e.emitResult.EmittedFiles = [...e.emitResult.EmittedFiles, jsFilePath];
  }

  // Reset state
  e.writer.Clear();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.writeText","kind":"method","status":"implemented","sigHash":"9aac04b1bbe12883854aeb318218ae862c3a628a81b257ff5997b30fd514bfe2","bodyHash":"4ed9f7731e85fe250661eac53be38cbf03842fbfd94c01fc172688dffe0baa54"}
 *
 * Go source:
 * func (e *emitter) writeText(fileName string, text string, data *WriteFileData) error {
 * 	if e.writeFile != nil {
 * 		return e.writeFile(fileName, text, data)
 * 	}
 * 	return e.host.WriteFile(fileName, text)
 * }
 */
export function emitter_writeText(receiver: GoPtr<emitter>, fileName: string, text: string, data: GoPtr<WriteFileData>): GoError {
  const e = receiver!;
  if (e.writeFile !== undefined) {
    return e.writeFile(fileName, text, data);
  }
  return EmitHost_as_printer_EmitHost(e.host).WriteFile(fileName, text);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::shouldEmitSourceMaps","kind":"func","status":"implemented","sigHash":"bdb653e6ca3d07136c362984a46dfb4482b1d6afea4822b56271536a7fc3579a","bodyHash":"174c9c32357b91a6b910888c4eedc6cae65d97ae9c49ef57e23c92f5607f8514"}
 *
 * Go source:
 * func shouldEmitSourceMaps(mapOptions *core.CompilerOptions, sourceFile *ast.SourceFile) bool {
 * 	return (mapOptions.SourceMap.IsTrue() || mapOptions.InlineSourceMap.IsTrue()) &&
 * 		!tspath.FileExtensionIs(sourceFile.FileName(), tspath.ExtensionJson)
 * }
 */
export function shouldEmitSourceMaps(mapOptions: GoPtr<CompilerOptions>, sourceFile: GoPtr<SourceFile>): bool {
  return (Tristate_IsTrue(mapOptions!.SourceMap) || Tristate_IsTrue(mapOptions!.InlineSourceMap)) &&
    !FileExtensionIs(SourceFile_FileName(sourceFile), ExtensionJson);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::getSourceRoot","kind":"func","status":"implemented","sigHash":"4b3326ca6ab67a8b5b6006de83888c129f670bdb1a1e9560d7a58f83bc51849d","bodyHash":"64d136d9b52eae2574124190f98f9aa66e9cbe4d1191f9fe45cc16bab0d402a9"}
 *
 * Go source:
 * func getSourceRoot(mapOptions *core.CompilerOptions) string {
 * 	// Normalize source root and make sure it has trailing "/" so that it can be used to combine paths with the
 * 	// relative paths of the sources list in the sourcemap
 * 	sourceRoot := tspath.NormalizeSlashes(mapOptions.SourceRoot)
 * 	if len(sourceRoot) > 0 {
 * 		sourceRoot = tspath.EnsureTrailingDirectorySeparator(sourceRoot)
 * 	}
 * 	return sourceRoot
 * }
 */
export function getSourceRoot(mapOptions: GoPtr<CompilerOptions>): string {
  // Normalize source root and make sure it has trailing "/" so that it can be used to combine paths with the
  // relative paths of the sources list in the sourcemap
  let sourceRoot = NormalizeSlashes(mapOptions!.SourceRoot);
  if (sourceRoot.length > 0) {
    sourceRoot = EnsureTrailingDirectorySeparator(sourceRoot);
  }
  return sourceRoot;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.getSourceMapDirectory","kind":"method","status":"implemented","sigHash":"ea8428e7fd05d47526b6f8eddfdc651ebac2b12f7a458bce4379196355f6e79e","bodyHash":"e868f9321ad051ee1e35211287f5820dabd5773e6ca5efa0246e14a841a4c58b"}
 *
 * Go source:
 * func (e *emitter) getSourceMapDirectory(mapOptions *core.CompilerOptions, filePath string, sourceFile *ast.SourceFile) string {
 * 	if len(mapOptions.SourceRoot) > 0 {
 * 		return e.host.CommonSourceDirectory()
 * 	}
 * 	if len(mapOptions.MapRoot) > 0 {
 * 		sourceMapDir := tspath.NormalizeSlashes(mapOptions.MapRoot)
 * 		if sourceFile != nil {
 * 			// For modules or multiple emit files the mapRoot will have directory structure like the sources
 * 			// So if src\a.ts and src\lib\b.ts are compiled together user would be moving the maps into mapRoot\a.js.map and mapRoot\lib\b.js.map
 * 			sourceMapDir = tspath.GetDirectoryPath(outputpaths.GetSourceFilePathInNewDir(
 * 				sourceFile.FileName(),
 * 				sourceMapDir,
 * 				e.host.GetCurrentDirectory(),
 * 				e.host.CommonSourceDirectory(),
 * 				e.host.UseCaseSensitiveFileNames(),
 * 			))
 * 		}
 * 		if tspath.GetRootLength(sourceMapDir) == 0 {
 * 			// The relative paths are relative to the common directory
 * 			sourceMapDir = tspath.CombinePaths(e.host.CommonSourceDirectory(), sourceMapDir)
 * 		}
 * 		return sourceMapDir
 * 	}
 * 	return tspath.GetDirectoryPath(tspath.NormalizePath(filePath))
 * }
 */
export function emitter_getSourceMapDirectory(receiver: GoPtr<emitter>, mapOptions: GoPtr<CompilerOptions>, filePath: string, sourceFile: GoPtr<SourceFile>): string {
  const e = receiver!;
  if (mapOptions!.SourceRoot.length > 0) {
    return e.host.CommonSourceDirectory();
  }
  if (mapOptions!.MapRoot.length > 0) {
    let sourceMapDir = NormalizeSlashes(mapOptions!.MapRoot);
    if (sourceFile !== undefined) {
      // For modules or multiple emit files the mapRoot will have directory structure like the sources
      // So if src\a.ts and src\lib\b.ts are compiled together user would be moving the maps into mapRoot\a.js.map and mapRoot\lib\b.js.map
      sourceMapDir = GetDirectoryPath(GetSourceFilePathInNewDir(
        SourceFile_FileName(sourceFile),
        sourceMapDir,
        e.host.GetCurrentDirectory(),
        e.host.CommonSourceDirectory(),
        e.host.UseCaseSensitiveFileNames(),
      ));
    }
    if (GetRootLength(sourceMapDir) === 0) {
      // The relative paths are relative to the common directory
      sourceMapDir = CombinePaths(e.host.CommonSourceDirectory(), sourceMapDir);
    }
    return sourceMapDir;
  }
  return GetDirectoryPath(NormalizePath(filePath));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::method::emitter.getSourceMappingURL","kind":"method","status":"implemented","sigHash":"5256d3ad354dcf7ae3485c254ec9a120879e4785c8213f2fb0bfa53a353d99c4","bodyHash":"341c169861d8322dd18001280728587a7bc2ee4189d90762ff17837cbefda7ce"}
 *
 * Go source:
 * func (e *emitter) getSourceMappingURL(mapOptions *core.CompilerOptions, sourceMapGenerator *sourcemap.Generator, filePath string, sourceMapFilePath string, sourceFile *ast.SourceFile) string {
 * 	if mapOptions.InlineSourceMap.IsTrue() {
 * 		// Encode the sourceMap into the sourceMap url
 * 		return sourceMapGenerator.Base64DataURL()
 * 	}
 *
 * 	sourceMapFile := tspath.GetBaseFileName(tspath.NormalizeSlashes(sourceMapFilePath))
 * 	if len(mapOptions.MapRoot) > 0 {
 * 		sourceMapDir := tspath.NormalizeSlashes(mapOptions.MapRoot)
 * 		if sourceFile != nil {
 * 			// For modules or multiple emit files the mapRoot will have directory structure like the sources
 * 			// So if src\a.ts and src\lib\b.ts are compiled together user would be moving the maps into mapRoot\a.js.map and mapRoot\lib\b.js.map
 * 			sourceMapDir = tspath.GetDirectoryPath(outputpaths.GetSourceFilePathInNewDir(
 * 				sourceFile.FileName(),
 * 				sourceMapDir,
 * 				e.host.GetCurrentDirectory(),
 * 				e.host.CommonSourceDirectory(),
 * 				e.host.UseCaseSensitiveFileNames(),
 * 			))
 * 		}
 * 		if tspath.GetRootLength(sourceMapDir) == 0 {
 * 			// The relative paths are relative to the common directory
 * 			sourceMapDir = tspath.CombinePaths(e.host.CommonSourceDirectory(), sourceMapDir)
 * 			return stringutil.EncodeURI(
 * 				tspath.GetRelativePathToDirectoryOrUrl(
 * 					tspath.GetDirectoryPath(tspath.NormalizePath(filePath)), // get the relative sourceMapDir path based on jsFilePath
 * 					tspath.CombinePaths(sourceMapDir, sourceMapFile),        // this is where user expects to see sourceMap
 * 					/*isAbsolutePathAnUrl* / true,
 * 					tspath.ComparePathsOptions{
 * 						UseCaseSensitiveFileNames: e.host.UseCaseSensitiveFileNames(),
 * 						CurrentDirectory:          e.host.GetCurrentDirectory(),
 * 					},
 * 				),
 * 			)
 * 		} else {
 * 			return stringutil.EncodeURI(tspath.CombinePaths(sourceMapDir, sourceMapFile))
 * 		}
 * 	}
 * 	return stringutil.EncodeURI(sourceMapFile)
 * }
 */
export function emitter_getSourceMappingURL(receiver: GoPtr<emitter>, mapOptions: GoPtr<CompilerOptions>, sourceMapGenerator: GoPtr<Generator>, filePath: string, sourceMapFilePath: string, sourceFile: GoPtr<SourceFile>): string {
  const e = receiver!;
  if (Tristate_IsTrue(mapOptions!.InlineSourceMap)) {
    // Encode the sourceMap into the sourceMap url
    return Generator_Base64DataURL(sourceMapGenerator);
  }

  const sourceMapFile = GetBaseFileName(NormalizeSlashes(sourceMapFilePath));
  if (mapOptions!.MapRoot.length > 0) {
    let sourceMapDir = NormalizeSlashes(mapOptions!.MapRoot);
    if (sourceFile !== undefined) {
      // For modules or multiple emit files the mapRoot will have directory structure like the sources
      // So if src\a.ts and src\lib\b.ts are compiled together user would be moving the maps into mapRoot\a.js.map and mapRoot\lib\b.js.map
      sourceMapDir = GetDirectoryPath(GetSourceFilePathInNewDir(
        SourceFile_FileName(sourceFile),
        sourceMapDir,
        e.host.GetCurrentDirectory(),
        e.host.CommonSourceDirectory(),
        e.host.UseCaseSensitiveFileNames(),
      ));
    }
    if (GetRootLength(sourceMapDir) === 0) {
      // The relative paths are relative to the common directory
      sourceMapDir = CombinePaths(e.host.CommonSourceDirectory(), sourceMapDir);
      return EncodeURI(
        GetRelativePathToDirectoryOrUrl(
          GetDirectoryPath(NormalizePath(filePath)), // get the relative sourceMapDir path based on jsFilePath
          CombinePaths(sourceMapDir, sourceMapFile),  // this is where user expects to see sourceMap
          true,
          {
            UseCaseSensitiveFileNames: e.host.UseCaseSensitiveFileNames(),
            CurrentDirectory: e.host.GetCurrentDirectory(),
          } as ComparePathsOptions,
        ),
      );
    } else {
      return EncodeURI(CombinePaths(sourceMapDir, sourceMapFile));
    }
  }
  return EncodeURI(sourceMapFile);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::type::SourceFileMayBeEmittedHost","kind":"type","status":"implemented","sigHash":"3234fb95de035e8140a4c0e6bc550036b5e6dce06888b191a2973d1e57e2f02b","bodyHash":"02eccd3d9ada9bcedde7e60d107ae713805b21eed3b1a0728307bc21227017b6"}
 *
 * Go source:
 * SourceFileMayBeEmittedHost interface {
 * 	Options() *core.CompilerOptions
 * 	GetProjectReferenceFromSource(path tspath.Path) *tsoptions.SourceOutputAndProjectReference
 * 	IsSourceFileFromExternalLibrary(file *ast.SourceFile) bool
 * 	GetCurrentDirectory() string
 * 	UseCaseSensitiveFileNames() bool
 * 	SourceFiles() []*ast.SourceFile
 * }
 */
export interface SourceFileMayBeEmittedHost {
  Options(): GoPtr<CompilerOptions>;
  GetProjectReferenceFromSource(path: Path): GoPtr<SourceOutputAndProjectReference>;
  IsSourceFileFromExternalLibrary(file: GoPtr<SourceFile>): bool;
  GetCurrentDirectory(): string;
  UseCaseSensitiveFileNames(): bool;
  SourceFiles(): GoSlice<GoPtr<SourceFile>>;
}

export function EmitHost_as_emitter_SourceFileMayBeEmittedHost(receiver: EmitHost): SourceFileMayBeEmittedHost {
  return {
    Options: (): GoPtr<CompilerOptions> => receiver.Options(),
    GetProjectReferenceFromSource: (path: Path): GoPtr<SourceOutputAndProjectReference> => receiver.GetProjectReferenceFromSource(path),
    IsSourceFileFromExternalLibrary: (file: GoPtr<SourceFile>): bool => receiver.IsSourceFileFromExternalLibrary(file),
    GetCurrentDirectory: (): string => receiver.GetCurrentDirectory(),
    UseCaseSensitiveFileNames: (): bool => receiver.UseCaseSensitiveFileNames(),
    SourceFiles: (): GoSlice<GoPtr<SourceFile>> => receiver.SourceFiles(),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::sourceFileMayBeEmitted","kind":"func","status":"implemented","sigHash":"d118009010869662095554f8b30ef9c13c4fe5ffeacba94989f117f844d4f559","bodyHash":"a3de80753eb2a856af8f019de9e7c5da784a223c6a9bc98daab001d42e8a306f"}
 *
 * Go source:
 * func sourceFileMayBeEmitted(sourceFile *ast.SourceFile, host SourceFileMayBeEmittedHost, forceDtsEmit bool) bool {
 * 	// TODO: move this to outputpaths?
 *
 * 	options := host.Options()
 * 	// Js files are emitted only if option is enabled
 * 	if options.NoEmitForJsFiles.IsTrue() && ast.IsSourceFileJS(sourceFile) {
 * 		return false
 * 	}
 *
 * 	// Declaration files are not emitted
 * 	if sourceFile.IsDeclarationFile {
 * 		return false
 * 	}
 *
 * 	// Source file from node_modules are not emitted
 * 	if host.IsSourceFileFromExternalLibrary(sourceFile) {
 * 		return false
 * 	}
 *
 * 	// forcing dts emit => file needs to be emitted
 * 	if forceDtsEmit {
 * 		return true
 * 	}
 *
 * 	// Check other conditions for file emit
 * 	// Source files from referenced projects are not emitted
 * 	if host.GetProjectReferenceFromSource(sourceFile.Path()) != nil {
 * 		return false
 * 	}
 *
 * 	// Any non json file should be emitted
 * 	if !ast.IsJsonSourceFile(sourceFile) {
 * 		return true
 * 	}
 *
 * 	// Json file is not emitted if outDir is not specified
 * 	if options.OutDir == "" {
 * 		return false
 * 	}
 *
 * 	// Otherwise, if rootDir is specified or a config file exists, we know the common source directory and can check if the file would be emitted in the same location
 * 	if options.RootDir != "" || options.ConfigFilePath != "" {
 * 		commonDir := tspath.GetNormalizedAbsolutePath(outputpaths.GetCommonSourceDirectory(options, func() []string { return nil }, host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames(), nil), host.GetCurrentDirectory())
 * 		outputPath := outputpaths.GetSourceFilePathInNewDirWorker(sourceFile.FileName(), options.OutDir, host.GetCurrentDirectory(), commonDir, host.UseCaseSensitiveFileNames())
 * 		if tspath.ComparePaths(sourceFile.FileName(), outputPath, tspath.ComparePathsOptions{
 * 			UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
 * 			CurrentDirectory:          host.GetCurrentDirectory(),
 * 		}) == 0 {
 * 			return false
 * 		}
 * 	}
 *
 * 	return true
 * }
 */
export function sourceFileMayBeEmitted(sourceFile: GoPtr<SourceFile>, host: SourceFileMayBeEmittedHost, forceDtsEmit: bool): bool {
  // TODO: move this to outputpaths?

  const options = host.Options();
  // Js files are emitted only if option is enabled
  if (Tristate_IsTrue(options!.NoEmitForJsFiles) && IsSourceFileJS(sourceFile)) {
    return false;
  }

  // Declaration files are not emitted
  if (sourceFile!.IsDeclarationFile) {
    return false;
  }

  // Source file from node_modules are not emitted
  if (host.IsSourceFileFromExternalLibrary(sourceFile)) {
    return false;
  }

  // forcing dts emit => file needs to be emitted
  if (forceDtsEmit) {
    return true;
  }

  // Check other conditions for file emit
  // Source files from referenced projects are not emitted
  if (host.GetProjectReferenceFromSource(SourceFile_Path(sourceFile)) !== undefined) {
    return false;
  }

  // Any non json file should be emitted
  if (!IsJsonSourceFile(sourceFile)) {
    return true;
  }

  // Json file is not emitted if outDir is not specified
  if (options!.OutDir === "") {
    return false;
  }

  // Otherwise, if rootDir is specified or a config file exists, we know the common source directory and can check if the file would be emitted in the same location
  if (options!.RootDir !== "" || options!.ConfigFilePath !== "") {
    const commonDir = GetNormalizedAbsolutePath(GetCommonSourceDirectory(options, () => [], host.GetCurrentDirectory(), host.UseCaseSensitiveFileNames(), undefined), host.GetCurrentDirectory());
    const outputPath = GetSourceFilePathInNewDirWorker(SourceFile_FileName(sourceFile), options!.OutDir, host.GetCurrentDirectory(), commonDir, host.UseCaseSensitiveFileNames());
    if (ComparePaths(SourceFile_FileName(sourceFile), outputPath, {
      UseCaseSensitiveFileNames: host.UseCaseSensitiveFileNames(),
      CurrentDirectory: host.GetCurrentDirectory(),
    } as ComparePathsOptions) === 0) {
      return false;
    }
  }

  return true;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::getSourceFilesToEmit","kind":"func","status":"implemented","sigHash":"5edceb1093bf34a3ab05e3852ba63ac3b274db891d0903a56ff02b0cd13c223f","bodyHash":"545d196a9cb86cc12878f08147673cbf642a8174a2915e1a28ecac8ef0d94ffb"}
 *
 * Go source:
 * func getSourceFilesToEmit(host SourceFileMayBeEmittedHost, targetSourceFile *ast.SourceFile, forceDtsEmit bool) []*ast.SourceFile {
 * 	var sourceFiles []*ast.SourceFile
 * 	if targetSourceFile != nil {
 * 		sourceFiles = []*ast.SourceFile{targetSourceFile}
 * 	} else {
 * 		sourceFiles = host.SourceFiles()
 * 	}
 * 	return core.Filter(sourceFiles, func(sourceFile *ast.SourceFile) bool {
 * 		return sourceFileMayBeEmitted(sourceFile, host, forceDtsEmit)
 * 	})
 * }
 */
export function getSourceFilesToEmit(host: SourceFileMayBeEmittedHost, targetSourceFile: GoPtr<SourceFile>, forceDtsEmit: bool): GoSlice<GoPtr<SourceFile>> {
  let sourceFiles: GoSlice<GoPtr<SourceFile>>;
  if (targetSourceFile !== undefined) {
    sourceFiles = [targetSourceFile];
  } else {
    sourceFiles = host.SourceFiles();
  }
  return Filter(sourceFiles, (sourceFile) => {
    return sourceFileMayBeEmitted(sourceFile, host, forceDtsEmit);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::isSourceFileNotJson","kind":"func","status":"implemented","sigHash":"450dcf9bc3ff6f1a0b2a1793149374cb79543a5c54cf0eb89a0b1359d9bf1dcb","bodyHash":"81ffe16f59ca6324407f03cd181b2f2dd11b23d03b6e46c6d95f2ede9fc56fb6"}
 *
 * Go source:
 * func isSourceFileNotJson(file *ast.SourceFile) bool {
 * 	return !ast.IsJsonSourceFile(file)
 * }
 */
export function isSourceFileNotJson(file: GoPtr<SourceFile>): bool {
  return !IsJsonSourceFile(file);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/compiler/emitter.go::func::getDeclarationDiagnostics","kind":"func","status":"implemented","sigHash":"89db86d46713a1be0836322521b8df64d17b4753cc5ea6b3caec1062d7c6eb32","bodyHash":"7c81f713a5cd3989dacc8fa87331982f14779f7552b41b71e4b862dad2f7b46c"}
 *
 * Go source:
 * func getDeclarationDiagnostics(host EmitHost, file *ast.SourceFile) []*ast.Diagnostic {
 * 	// TODO: use p.getSourceFilesToEmit cache
 * 	fullFiles := core.Filter(getSourceFilesToEmit(host, file, false), isSourceFileNotJson)
 * 	if !core.Some(fullFiles, func(f *ast.SourceFile) bool { return f == file }) {
 * 		return []*ast.Diagnostic{}
 * 	}
 * 	options := host.Options()
 * 	transform := declarations.NewDeclarationTransformer(host, nil, options, "", "")
 * 	transform.TransformSourceFile(file)
 * 	return transform.GetDiagnostics()
 * }
 */
export function getDeclarationDiagnostics(host: EmitHost, file: GoPtr<SourceFile>): GoSlice<GoPtr<Diagnostic>> {
  // TODO: use p.getSourceFilesToEmit cache
  const fullFiles = Filter(getSourceFilesToEmit(EmitHost_as_emitter_SourceFileMayBeEmittedHost(host), file, false), isSourceFileNotJson);
  if (!Some(fullFiles, (f) => f === file)) {
    return [];
  }
  const options = host.Options();
  const transform = NewDeclarationTransformer(EmitHost_as_declarations_DeclarationEmitHost(host), undefined, options, "", "");
  Transformer_TransformSourceFile(transform as GoPtr<Transformer>, file);
  return DeclarationTransformer_GetDiagnostics(transform);
}
