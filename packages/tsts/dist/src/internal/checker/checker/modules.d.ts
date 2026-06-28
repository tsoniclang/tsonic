import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Symbol } from "../../ast/symbol.js";
import type { ResolutionMode } from "../../core/compileroptions.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import type { ResolvedModule } from "../../module/types.js";
import type { Checker } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.mergeModuleAugmentation","kind":"method","status":"implemented","sigHash":"2180b8be90753b343b6f30f261b683d348387d3a1b55268c2d0ae7421d6dbeae","bodyHash":"a6bc03af285f7b6510ad1b0f4c130967a7b3531d8d19adfcfacf8d96144f8681"}
 *
 * Go source:
 * func (c *Checker) mergeModuleAugmentation(moduleName *ast.Node) {
 * 	moduleNode := moduleName.Parent
 * 	moduleAugmentation := moduleNode.AsModuleDeclaration()
 * 	if moduleAugmentation.Symbol.Declarations[0] != moduleNode {
 * 		// this is a combined symbol for multiple augmentations within the same file.
 * 		// its symbol already has accumulated information for all declarations
 * 		// so we need to add it just once - do the work only for first declaration
 * 		return
 * 	}
 * 	if ast.IsGlobalScopeAugmentation(moduleNode) {
 * 		c.mergeSymbolTable(c.globals, moduleAugmentation.Symbol.Exports, false /*unidirectional* /, nil /*parent* /)
 * 	} else {
 * 		// find a module that about to be augmented
 * 		// do not validate names of augmentations that are defined in ambient context
 * 		var moduleNotFoundError *diagnostics.Message
 * 		if moduleName.Parent.Parent.Flags&ast.NodeFlagsAmbient == 0 {
 * 			moduleNotFoundError = diagnostics.Invalid_module_name_in_augmentation_module_0_cannot_be_found
 * 		}
 * 		mainModule := c.resolveExternalModuleNameWorker(moduleName, moduleName, moduleNotFoundError /*ignoreErrors* /, false /*isForAugmentation* /, true)
 * 		if mainModule == nil {
 * 			return
 * 		}
 * 		// obtain item referenced by 'export='
 * 		mainModule = c.resolveExternalModuleSymbol(mainModule, false /*dontResolveAlias* /)
 * 		if mainModule.Flags&ast.SymbolFlagsNamespace != 0 {
 * 			// If we're merging an augmentation to a pattern ambient module, we want to
 * 			// perform the merge unidirectionally from the augmentation ('a.foo') to
 * 			// the pattern ('*.foo'), so that 'getMergedSymbol()' on a.foo gives you
 * 			// all the exports both from the pattern and from the augmentation, but
 * 			// 'getMergedSymbol()' on *.foo only gives you exports from *.foo.
 * 			if core.Some(c.patternAmbientModules, func(module *ast.PatternAmbientModule) bool {
 * 				return mainModule == module.Symbol
 * 			}) {
 * 				merged := c.mergeSymbol(moduleAugmentation.Symbol, mainModule, true /*unidirectional* /)
 * 				// moduleName will be a StringLiteral since this is not `declare global`.
 * 				ast.GetSymbolTable(&c.patternAmbientModuleAugmentations)[moduleName.Text()] = merged
 * 			} else {
 * 				if mainModule.Exports[ast.InternalSymbolNameExportStar] != nil && len(moduleAugmentation.Symbol.Exports) != 0 {
 * 					// We may need to merge the module augmentation's exports into the target symbols of the resolved exports
 * 					resolvedExports := c.getResolvedMembersOrExportsOfSymbol(mainModule, MembersOrExportsResolutionKindResolvedExports)
 * 					for key, value := range moduleAugmentation.Symbol.Exports {
 * 						if resolvedExports[key] != nil && mainModule.Exports[key] == nil {
 * 							c.mergeSymbol(resolvedExports[key], value, false /*unidirectional* /)
 * 						}
 * 					}
 * 				}
 * 				c.mergeSymbol(mainModule, moduleAugmentation.Symbol, false /*unidirectional* /)
 * 			}
 * 		} else {
 * 			// moduleName will be a StringLiteral since this is not `declare global`.
 * 			c.error(moduleName, diagnostics.Cannot_augment_module_0_because_it_resolves_to_a_non_module_entity, moduleName.Text())
 * 		}
 * 	}
 * }
 */
export declare function Checker_mergeModuleAugmentation(receiver: GoPtr<Checker>, moduleName: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkModuleAugmentationElement","kind":"method","status":"implemented","sigHash":"19449ac93dafe5141d4f4d64277b51b06e1ca84fd54b910ef9f80d190d9f0115","bodyHash":"25b0de7de9fad6e6c029eaf2a5e5fcab3e0974632577ccd645f1ce0e4b811302"}
 *
 * Go source:
 * func (c *Checker) checkModuleAugmentationElement(node *ast.Node) {
 * 	switch node.Kind {
 * 	case ast.KindVariableStatement:
 * 		// error each individual name in variable statement instead of marking the entire variable statement
 * 		for _, decl := range node.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 			c.checkModuleAugmentationElement(decl)
 * 		}
 * 	case ast.KindExportAssignment, ast.KindExportDeclaration:
 * 		c.grammarErrorOnFirstToken(node, diagnostics.Exports_and_export_assignments_are_not_permitted_in_module_augmentations)
 * 	case ast.KindImportEqualsDeclaration:
 * 		// import a = e.x; in module augmentation is ok, but not import a = require('fs)
 * 		if ast.IsInternalModuleImportEqualsDeclaration(node) {
 * 			break
 * 		}
 * 		fallthrough
 * 	case ast.KindImportDeclaration, ast.KindJSImportDeclaration:
 * 		c.grammarErrorOnFirstToken(node, diagnostics.Imports_are_not_permitted_in_module_augmentations_Consider_moving_them_to_the_enclosing_external_module)
 * 	case ast.KindBindingElement, ast.KindVariableDeclaration:
 * 		name := node.Name()
 * 		if ast.IsBindingPattern(name) {
 * 			for _, el := range name.Elements() {
 * 				// mark individual names in binding pattern
 * 				c.checkModuleAugmentationElement(el)
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_checkModuleAugmentationElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTargetOfModuleDefault","kind":"method","status":"implemented","sigHash":"29eddee9b813cc6f9c64dc6afbb020ccdb69232f96bd08a027600a07103693cd","bodyHash":"cc83e4fc25b7a702810d969bdf3021460cea04d2c27334f865b35a3973e30867"}
 *
 * Go source:
 * func (c *Checker) getTargetOfModuleDefault(moduleSymbol *ast.Symbol, node *ast.Node, dontResolveAlias bool) *ast.Symbol {
 * 	file := core.Find(moduleSymbol.Declarations, ast.IsSourceFile)
 * 	specifier := c.getModuleSpecifierForImportOrExport(node)
 * 	var exportDefaultSymbol *ast.Symbol
 * 	var exportModuleDotExportsSymbol *ast.Symbol
 * 	if isShorthandAmbientModuleSymbol(moduleSymbol) {
 * 		// !!! exportDefaultSymbol = moduleSymbol
 * 		// Does nothing?
 * 	} else if file != nil && specifier != nil &&
 * 		core.ModuleKindNode20 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext &&
 * 		c.getEmitSyntaxForModuleSpecifierExpression(specifier) == core.ModuleKindCommonJS &&
 * 		c.program.GetImpliedNodeFormatForEmit(file.AsSourceFile()) == core.ModuleKindESNext {
 * 		exportModuleDotExportsSymbol = c.resolveExportByName(moduleSymbol, ast.InternalSymbolNameModuleExports, node, dontResolveAlias)
 * 	}
 * 	if exportModuleDotExportsSymbol != nil {
 * 		// We have a transpiled default import where the `require` resolves to an ES module with a `module.exports` named
 * 		// export. With `esModuleInterop` (always enabled), this will work:
 * 		//
 * 		// const dep_1 = __importDefault(require("./dep.mjs")); // wraps like { default: require("./dep.mjs") }
 * 		// dep_1.default; // require("./dep.mjs") -> the `module.exports` export value
 * 		c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 		return exportModuleDotExportsSymbol
 * 	} else {
 * 		exportDefaultSymbol = c.resolveExportByName(moduleSymbol, ast.InternalSymbolNameDefault, node, dontResolveAlias)
 * 	}
 * 	if specifier == nil {
 * 		return exportDefaultSymbol
 * 	}
 * 	hasDefaultOnly := c.isOnlyImportableAsDefault(specifier, moduleSymbol)
 * 	hasSyntheticDefault := c.canHaveSyntheticDefault(file, moduleSymbol, dontResolveAlias, specifier)
 * 	if exportDefaultSymbol == nil && !hasSyntheticDefault && !hasDefaultOnly {
 * 		if ast.IsImportClause(node) {
 * 			c.reportNonDefaultExport(moduleSymbol, node)
 * 		} else {
 * 			var name *ast.Node
 * 			if ast.IsImportOrExportSpecifier(node) {
 * 				name = node.PropertyNameOrName()
 * 			} else {
 * 				name = node.Name()
 * 			}
 * 			c.errorNoModuleMemberSymbol(moduleSymbol, moduleSymbol, node, name)
 * 		}
 * 	} else if hasSyntheticDefault || hasDefaultOnly {
 * 		// per emit behavior, a synthetic default overrides a "real" .default member if `__esModule` is not present
 * 		resolved := c.resolveExternalModuleSymbol(moduleSymbol, dontResolveAlias)
 * 		if resolved == nil {
 * 			resolved = c.resolveSymbolEx(moduleSymbol, dontResolveAlias)
 * 		}
 * 		c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 		return resolved
 * 	}
 * 	c.markSymbolOfAliasDeclarationIfTypeOnly(node, nil)
 * 	return exportDefaultSymbol
 * }
 */
export declare function Checker_getTargetOfModuleDefault(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, node: GoPtr<Node>, dontResolveAlias: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getEmitSyntaxForModuleSpecifierExpression","kind":"method","status":"implemented","sigHash":"34f4590bc4f247eb352193e8005adf6c32a22eac31c1f59144a40e468950c5ed","bodyHash":"aebe78e02902646ba6c64b0a209d697cda027e120710c29ec9539858165124e9"}
 *
 * Go source:
 * func (c *Checker) getEmitSyntaxForModuleSpecifierExpression(usage *ast.Node) core.ResolutionMode {
 * 	if ast.IsStringLiteralLike(usage) {
 * 		return c.program.GetEmitSyntaxForUsageLocation(ast.GetSourceFileOfNode(usage), usage)
 * 	}
 * 	return core.ModuleKindNone
 * }
 */
export declare function Checker_getEmitSyntaxForModuleSpecifierExpression(receiver: GoPtr<Checker>, usage: GoPtr<Node>): ResolutionMode;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveExternalModule","kind":"method","status":"implemented","sigHash":"bebce0095380521cfebda9c3077c42103ee27fa2b04caece40715ccd9c291f0a","bodyHash":"d16ba5c1b860ab976af7d38e2b436eeee4cd713bf2119ef7e0a3a5ad77ae3cda"}
 *
 * Go source:
 * func (c *Checker) resolveExternalModule(location *ast.Node, moduleReference string, moduleNotFoundError *diagnostics.Message, errorNode *ast.Node, isForAugmentation bool) *ast.Symbol {
 * 	if errorNode != nil && strings.HasPrefix(moduleReference, "@types/") {
 * 		withoutAtTypePrefix := moduleReference[len("@types/"):]
 * 		c.error(errorNode, diagnostics.Cannot_import_type_declaration_files_Consider_importing_0_instead_of_1, withoutAtTypePrefix, moduleReference)
 * 	}
 * 	ambientModule := c.tryFindAmbientModule(moduleReference, true /*withAugmentations* /)
 * 	if ambientModule != nil {
 * 		return ambientModule
 * 	}
 *
 * 	importingSourceFile := ast.GetSourceFileOfNode(location)
 * 	var (
 * 		contextSpecifier *ast.Node
 * 		mode             core.ResolutionMode
 * 	)
 *
 * 	if ast.IsStringLiteralLike(location) || location.Parent != nil && ast.IsModuleDeclaration(location.Parent) && location.Parent.AsModuleDeclaration().Name() == location {
 * 		contextSpecifier = location
 * 	} else if ast.IsModuleDeclaration(location) {
 * 		contextSpecifier = location.AsModuleDeclaration().Name()
 * 	} else if ast.IsLiteralImportTypeNode(location) {
 * 		contextSpecifier = location.AsImportTypeNode().Argument.AsLiteralTypeNode().Literal
 * 	} else if ast.IsVariableDeclarationInitializedToBareOrAccessedRequire(location) {
 * 		contextSpecifier = ast.GetModuleSpecifierOfBareOrAccessedRequire(location)
 * 	} else {
 * 		ancestor := ast.FindAncestor(location, ast.IsImportCall)
 * 		if ancestor != nil {
 * 			contextSpecifier = ancestor.Arguments()[0]
 * 		}
 *
 * 		if ancestor == nil {
 * 			ancestor = ast.FindAncestor(location, ast.IsImportDeclarationOrJSImportDeclaration)
 * 			if ancestor != nil {
 * 				contextSpecifier = ancestor.ModuleSpecifier()
 * 			}
 * 		}
 * 		if ancestor == nil {
 * 			ancestor = ast.FindAncestor(location, ast.IsExportDeclaration)
 * 			if ancestor != nil {
 * 				contextSpecifier = ancestor.ModuleSpecifier()
 * 			}
 * 		}
 * 		if ancestor == nil {
 * 			ancestor = ast.FindAncestor(location, ast.IsImportEqualsDeclaration)
 * 			if ancestor != nil {
 * 				if moduleRefrence := ancestor.AsImportEqualsDeclaration().ModuleReference; moduleRefrence.Kind == ast.KindExternalModuleReference {
 * 					contextSpecifier = moduleRefrence.Expression()
 * 				}
 * 			}
 * 		}
 * 	}
 *
 * 	if contextSpecifier != nil && ast.IsStringLiteralLike(contextSpecifier) {
 * 		mode = c.program.GetModeForUsageLocation(importingSourceFile, contextSpecifier)
 * 	} else {
 * 		mode = c.program.GetDefaultResolutionModeForFile(importingSourceFile)
 * 	}
 *
 * 	resolvedModule := c.program.GetResolvedModule(importingSourceFile, moduleReference, mode)
 *
 * 	var resolutionDiagnostic *diagnostics.Message
 * 	if errorNode != nil && resolvedModule.IsResolved() {
 * 		resolutionDiagnostic = module.GetResolutionDiagnostic(c.compilerOptions, resolvedModule, importingSourceFile)
 * 	}
 *
 * 	var sourceFile *ast.SourceFile
 * 	if resolvedModule.IsResolved() && (resolutionDiagnostic == nil || resolutionDiagnostic == diagnostics.Module_0_was_resolved_to_1_but_jsx_is_not_set) {
 * 		sourceFile = c.program.GetSourceFileForResolvedModule(resolvedModule.ResolvedFileName)
 * 	}
 *
 * 	if sourceFile != nil {
 * 		// If there's a resolutionDiagnostic we need to report it even if a sourceFile is found.
 * 		if resolutionDiagnostic != nil {
 * 			c.error(errorNode, resolutionDiagnostic, moduleReference, resolvedModule.ResolvedFileName)
 * 		}
 *
 * 		if errorNode != nil {
 * 			if resolvedModule.ResolvedUsingTsExtension && tspath.IsDeclarationFileName(moduleReference) {
 * 				if ast.FindAncestor(location, ast.IsEmittableImport) != nil {
 * 					tsExtension := tspath.TryExtractTSExtension(moduleReference)
 * 					if tsExtension == "" {
 * 						panic("should be able to extract TS extension from string that passes IsDeclarationFileName")
 * 					}
 * 					c.error(
 * 						errorNode,
 * 						diagnostics.A_declaration_file_cannot_be_imported_without_import_type_Did_you_mean_to_import_an_implementation_file_0_instead,
 * 						c.getSuggestedImportSource(moduleReference, tsExtension, mode),
 * 					)
 * 				}
 * 			} else if resolvedModule.ResolvedUsingTsExtension && !c.compilerOptions.AllowImportingTsExtensionsFrom(importingSourceFile.FileName()) {
 * 				if ast.FindAncestor(location, ast.IsEmittableImport) != nil {
 * 					tsExtension := tspath.TryExtractTSExtension(moduleReference)
 * 					if tsExtension == "" {
 * 						// Fallback: do a best-effort extraction using strings.Contains.
 * 						// This handles cases where a wildcard pattern matches a TS extension that's
 * 						// not at the end of the module specifier, e.g., "#/foo.ts.omg" through "#/*.omg": "./src/*"
 * 						for _, ext := range tspath.SupportedTSExtensionsFlat {
 * 							if strings.Contains(moduleReference, ext) {
 * 								tsExtension = ext
 * 								break
 * 							}
 * 						}
 * 					}
 * 					if tsExtension == "" {
 * 						panic("should be able to extract TS extension from string when resolvedUsingTsExtension is true")
 * 					}
 * 					c.error(
 * 						errorNode,
 * 						diagnostics.An_import_path_can_only_end_with_a_0_extension_when_allowImportingTsExtensions_is_enabled,
 * 						tsExtension,
 * 					)
 * 				}
 * 			} else if c.compilerOptions.RewriteRelativeImportExtensions.IsTrue() &&
 * 				location.Flags&ast.NodeFlagsAmbient == 0 &&
 * 				!tspath.IsDeclarationFileName(moduleReference) &&
 * 				!ast.IsLiteralImportTypeNode(location) &&
 * 				!ast.IsPartOfTypeOnlyImportOrExportDeclaration(location) {
 * 				shouldRewrite := core.ShouldRewriteModuleSpecifier(moduleReference, c.compilerOptions)
 * 				if !resolvedModule.ResolvedUsingTsExtension && shouldRewrite {
 * 					relativeToSourceFile := tspath.GetRelativePathFromFile(
 * 						tspath.GetNormalizedAbsolutePath(importingSourceFile.FileName(), c.program.GetCurrentDirectory()),
 * 						resolvedModule.ResolvedFileName,
 * 						tspath.ComparePathsOptions{
 * 							UseCaseSensitiveFileNames: c.program.UseCaseSensitiveFileNames(),
 * 							CurrentDirectory:          c.program.GetCurrentDirectory(),
 * 						},
 * 					)
 * 					c.error(
 * 						errorNode,
 * 						diagnostics.This_relative_import_path_is_unsafe_to_rewrite_because_it_looks_like_a_file_name_but_actually_resolves_to_0,
 * 						relativeToSourceFile,
 * 					)
 * 				} else if resolvedModule.ResolvedUsingTsExtension && !shouldRewrite && c.program.SourceFileMayBeEmitted(sourceFile, false) {
 * 					c.error(
 * 						errorNode,
 * 						diagnostics.This_import_uses_a_0_extension_to_resolve_to_an_input_TypeScript_file_but_will_not_be_rewritten_during_emit_because_it_is_not_a_relative_path,
 * 						tspath.GetAnyExtensionFromPath(moduleReference, nil, false),
 * 					)
 * 				} else if resolvedModule.ResolvedUsingTsExtension && shouldRewrite {
 * 					if redirect := c.program.GetRedirectForResolution(sourceFile); redirect != nil {
 * 						ownRootDir := c.program.CommonSourceDirectory()
 * 						otherRootDir := redirect.CommonSourceDirectory()
 *
 * 						compareOptions := tspath.ComparePathsOptions{
 * 							UseCaseSensitiveFileNames: c.program.UseCaseSensitiveFileNames(),
 * 							CurrentDirectory:          c.program.GetCurrentDirectory(),
 * 						}
 *
 * 						rootDirPath := tspath.GetRelativePathFromDirectory(ownRootDir, otherRootDir, compareOptions)
 *
 * 						// Get outDir paths, defaulting to root directories if not specified
 * 						ownOutDir := c.compilerOptions.OutDir
 * 						if ownOutDir == "" {
 * 							ownOutDir = ownRootDir
 * 						}
 * 						otherOutDir := redirect.CompilerOptions().OutDir
 * 						if otherOutDir == "" {
 * 							otherOutDir = otherRootDir
 * 						}
 * 						outDirPath := tspath.GetRelativePathFromDirectory(ownOutDir, otherOutDir, compareOptions)
 *
 * 						if rootDirPath != outDirPath {
 * 							c.error(
 * 								errorNode,
 * 								diagnostics.This_import_path_is_unsafe_to_rewrite_because_it_resolves_to_another_project_and_the_relative_path_between_the_projects_output_files_is_not_the_same_as_the_relative_path_between_its_input_files,
 * 							)
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 *
 * 		if sourceFile.Symbol != nil {
 * 			if errorNode != nil {
 * 				if resolvedModule.IsExternalLibraryImport && !resolutionExtensionIsTSOrJson(resolvedModule.Extension) {
 * 					c.errorOnImplicitAnyModule(false /*isError* /, errorNode, mode, resolvedModule, moduleReference)
 * 				}
 * 				if c.moduleKind == core.ModuleKindNode16 || c.moduleKind == core.ModuleKindNode18 {
 * 					isSyncImport := c.program.GetDefaultResolutionModeForFile(importingSourceFile) == core.ModuleKindCommonJS && ast.FindAncestor(location, ast.IsImportCall) == nil ||
 * 						ast.FindAncestor(location, ast.IsImportEqualsDeclaration) != nil
 * 					overrideHost := ast.FindAncestor(location, ast.IsResolutionModeOverrideHost)
 * 					if isSyncImport && c.program.GetDefaultResolutionModeForFile(sourceFile) == core.ModuleKindESNext && !ast.HasResolutionModeOverride(overrideHost) {
 * 						if ast.FindAncestorKind(location, ast.KindImportEqualsDeclaration) != nil {
 * 							// ImportEquals in an ESM file resolving to another ESM file
 * 							c.error(errorNode, diagnostics.Module_0_cannot_be_imported_using_this_construct_The_specifier_only_resolves_to_an_ES_module_which_cannot_be_imported_with_require_Use_an_ECMAScript_import_instead, moduleReference)
 * 						} else {
 * 							// CJS file resolving to an ESM file
 * 							var diagnosticDetails *ast.Diagnostic
 * 							ext := tspath.TryGetExtensionFromPath(importingSourceFile.FileName())
 * 							if ext == tspath.ExtensionTs || ext == tspath.ExtensionJs || ext == tspath.ExtensionTsx || ext == tspath.ExtensionJsx {
 * 								diagnosticDetails = c.createModeMismatchDetails(importingSourceFile, errorNode)
 * 							}
 *
 * 							var message *diagnostics.Message
 * 							if overrideHost != nil && overrideHost.Kind == ast.KindImportDeclaration && overrideHost.ImportClause() != nil && overrideHost.ImportClause().IsTypeOnly() {
 * 								message = diagnostics.Type_only_import_of_an_ECMAScript_module_from_a_CommonJS_module_must_have_a_resolution_mode_attribute
 * 							} else if overrideHost != nil && overrideHost.Kind == ast.KindImportType {
 * 								message = diagnostics.Type_import_of_an_ECMAScript_module_from_a_CommonJS_module_must_have_a_resolution_mode_attribute
 * 							} else {
 * 								message = diagnostics.The_current_file_is_a_CommonJS_module_whose_imports_will_produce_require_calls_however_the_referenced_file_is_an_ECMAScript_module_and_cannot_be_imported_with_require_Consider_writing_a_dynamic_import_0_call_instead
 * 							}
 *
 * 							c.addDiagnostic(NewDiagnosticChainForNode(diagnosticDetails, errorNode, message, moduleReference))
 * 						}
 * 					}
 * 				}
 * 			}
 * 			return c.getMergedSymbol(sourceFile.Symbol)
 * 		}
 * 		if errorNode != nil && moduleNotFoundError != nil && !isSideEffectImport(errorNode) {
 * 			c.error(errorNode, diagnostics.File_0_is_not_a_module, resolvedModule.ResolvedFileName)
 * 		}
 * 		return nil
 * 	}
 *
 * 	if len(c.patternAmbientModules) != 0 {
 * 		pattern := core.FindBestPatternMatch(c.patternAmbientModules, func(v *ast.PatternAmbientModule) core.Pattern { return v.Pattern }, moduleReference)
 * 		if pattern != nil {
 * 			augmentation := c.patternAmbientModuleAugmentations[moduleReference]
 * 			if augmentation != nil {
 * 				return c.getMergedSymbol(augmentation)
 * 			}
 * 			return c.getMergedSymbol(pattern.Symbol)
 * 		}
 * 	}
 *
 * 	if errorNode == nil {
 * 		return nil
 * 	}
 *
 * 	if resolvedModule.IsResolved() && !resolutionExtensionIsTSOrJson(resolvedModule.Extension) && resolutionDiagnostic == nil || resolutionDiagnostic == diagnostics.Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type {
 * 		if isForAugmentation {
 * 			c.error(
 * 				errorNode,
 * 				diagnostics.Invalid_module_name_in_augmentation_Module_0_resolves_to_an_untyped_module_at_1_which_cannot_be_augmented,
 * 				moduleReference,
 * 				resolvedModule.ResolvedFileName,
 * 			)
 * 		} else {
 * 			c.errorOnImplicitAnyModule(c.noImplicitAny && moduleNotFoundError != nil, errorNode, mode, resolvedModule, moduleReference)
 * 		}
 * 		return nil
 * 	}
 *
 * 	if moduleNotFoundError != nil {
 * 		// See if this was possibly a projectReference redirect
 * 		if resolvedModule.IsResolved() {
 * 			redirect := c.program.GetProjectReferenceFromSource(tspath.ToPath(resolvedModule.ResolvedFileName, c.program.GetCurrentDirectory(), c.program.UseCaseSensitiveFileNames()))
 * 			if redirect != nil && redirect.OutputDts != "" {
 * 				c.error(
 * 					errorNode,
 * 					diagnostics.Output_file_0_has_not_been_built_from_source_file_1,
 * 					redirect.OutputDts,
 * 					resolvedModule.ResolvedFileName,
 * 				)
 * 				return nil
 * 			}
 * 		}
 *
 * 		if resolutionDiagnostic != nil {
 * 			c.error(errorNode, resolutionDiagnostic, moduleReference, resolvedModule.ResolvedFileName)
 * 		} else {
 * 			isExtensionlessRelativePathImport := tspath.PathIsRelative(moduleReference) && !tspath.HasExtension(moduleReference)
 * 			resolutionIsNode16OrNext := c.moduleResolutionKind == core.ModuleResolutionKindNode16 || c.moduleResolutionKind == core.ModuleResolutionKindNodeNext
 * 			if !c.compilerOptions.GetResolveJsonModule() && tspath.FileExtensionIs(moduleReference, tspath.ExtensionJson) {
 * 				c.error(errorNode, diagnostics.Cannot_find_module_0_Consider_using_resolveJsonModule_to_import_module_with_json_extension, moduleReference)
 * 			} else if mode == core.ResolutionModeESM && resolutionIsNode16OrNext && isExtensionlessRelativePathImport {
 * 				absoluteRef := tspath.GetNormalizedAbsolutePath(moduleReference, tspath.GetDirectoryPath(importingSourceFile.FileName()))
 * 				if suggestedExt := c.getSuggestedImportExtension(absoluteRef); suggestedExt != "" {
 * 					c.error(errorNode, diagnostics.Relative_import_paths_need_explicit_file_extensions_in_ECMAScript_imports_when_moduleResolution_is_node16_or_nodenext_Did_you_mean_0, moduleReference+suggestedExt)
 * 				} else {
 * 					c.error(errorNode, diagnostics.Relative_import_paths_need_explicit_file_extensions_in_ECMAScript_imports_when_moduleResolution_is_node16_or_nodenext_Consider_adding_an_extension_to_the_import_path)
 * 				}
 * 			} else if resolvedModule != nil && resolvedModule.AlternateResult != "" {
 * 				errorInfo := c.createModuleNotFoundChain(resolvedModule, errorNode, moduleReference, mode, moduleReference)
 * 				c.addDiagnostic(NewDiagnosticChainForNode(errorInfo, errorNode, moduleNotFoundError, moduleReference))
 * 			} else {
 * 				c.error(errorNode, moduleNotFoundError, moduleReference)
 * 			}
 * 		}
 * 	}
 *
 * 	return nil
 * }
 */
export declare function Checker_resolveExternalModule(receiver: GoPtr<Checker>, location: GoPtr<Node>, moduleReference: string, moduleNotFoundError: GoPtr<Message>, errorNode: GoPtr<Node>, isForAugmentation: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createModuleNotFoundChain","kind":"method","status":"implemented","sigHash":"22bde6a6b58afde1b761dd035ddfece60fa16f5ef3e2c6f1bbfd6fbeac767136","bodyHash":"f7efec4d3519d74a3248b104e86aa8cf147114676ca3f5998a91a87a94b4500f"}
 *
 * Go source:
 * func (c *Checker) createModuleNotFoundChain(resolvedModule *module.ResolvedModule, errorNode *ast.Node, moduleReference string, mode core.ResolutionMode, packageName string) *ast.Diagnostic {
 * 	// Store the original packageName for repopulateInfo before any modifications
 * 	storedPackageName := packageName
 * 	if storedPackageName == moduleReference {
 * 		storedPackageName = ""
 * 	}
 *
 * 	details := CreateModuleNotFoundChain(c.program, ast.GetSourceFileOfNode(errorNode), moduleReference, mode, packageName)
 * 	result := NewDiagnosticForNode(errorNode, details.Message, details.Args...)
 * 	result.SetRepopulateInfo(&ast.RepopulateDiagnosticInfo{
 * 		Kind:            ast.RepopulateModuleNotFound,
 * 		ModuleReference: moduleReference,
 * 		Mode:            mode,
 * 		PackageName:     storedPackageName,
 * 	})
 * 	return result
 * }
 */
export declare function Checker_createModuleNotFoundChain(receiver: GoPtr<Checker>, resolvedModule: GoPtr<ResolvedModule>, errorNode: GoPtr<Node>, moduleReference: string, mode: ResolutionMode, packageName: string): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.tryFindAmbientModule","kind":"method","status":"implemented","sigHash":"250b9304cd1606d9ecc1d27e7e08dec40491adfa555ee61dfbe4d35bc93ad306","bodyHash":"be15902581633fac8b1c7d22e382600c819948661c7723c889b066c105b329d2"}
 *
 * Go source:
 * func (c *Checker) tryFindAmbientModule(moduleName string, withAugmentations bool) *ast.Symbol {
 * 	if tspath.IsExternalModuleNameRelative(moduleName) {
 * 		return nil
 * 	}
 * 	symbol := c.getSymbol(c.globals, "\""+moduleName+"\"", ast.SymbolFlagsValueModule)
 * 	// merged symbol is module declaration symbol combined with all augmentations
 * 	if withAugmentations {
 * 		return c.getMergedSymbol(symbol)
 * 	}
 * 	return symbol
 * }
 */
export declare function Checker_tryFindAmbientModule(receiver: GoPtr<Checker>, moduleName: string, withAugmentations: bool): GoPtr<Symbol>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.GetAmbientModules","kind":"method","status":"implemented","sigHash":"57b2d1bddb2a2d07bdf07e2252120955cdd5ca5e066d4ef7a1315a200c69aad5","bodyHash":"f0755c6fecde13b318c6008c29f53a88cbfbac0345690c06aff08547b3a525fa"}
 *
 * Go source:
 * func (c *Checker) GetAmbientModules() []*ast.Symbol {
 * 	c.ambientModulesOnce.Do(func() {
 * 		for sym, global := range c.globals {
 * 			if strings.HasPrefix(sym, "\"") && strings.HasSuffix(sym, "\"") {
 * 				c.ambientModules = append(c.ambientModules, global)
 * 			}
 * 		}
 * 	})
 * 	return c.ambientModules
 * }
 */
export declare function Checker_GetAmbientModules(receiver: GoPtr<Checker>): GoSlice<GoPtr<Symbol>>;
//# sourceMappingURL=modules.d.ts.map