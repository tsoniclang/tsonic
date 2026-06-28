import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Node } from "../../ast/spine.js";
import type { ExportAssignment, ExportDeclaration, ExportSpecifier, FunctionDeclaration, ImportDeclaration } from "../../ast/generated/data.js";
import type { Declaration, FunctionDeclarationNode, IdentifierNode, ModuleExportName } from "../../ast/generated/unions.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { MultiMap } from "../../collections/multimap.js";
import type { OrderedSet } from "../../collections/ordered_set.js";
import type { Set } from "../../collections/set.js";
import type { CompilerOptions, ModuleKind } from "../../core/compileroptions.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import type { EmitHelper } from "../../printer/helpers.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::type::externalModuleInfo","kind":"type","status":"implemented","sigHash":"76ea936086f877ffb778dc08a937acc672aba64f64355b8fe64c36697d57f693","bodyHash":"69ffa5434f6b92d92a7524fed146677b8665dec515f809f05197806eed50f016"}
 *
 * Go source:
 * externalModuleInfo struct {
 * 	externalImports              []*ast.Declaration                                            // ImportDeclaration | ImportEqualsDeclaration | ExportDeclaration. imports and reexports of other external modules
 * 	exportSpecifiers             collections.MultiMap[string, *ast.ExportSpecifier]            // Maps local names to their associated export specifiers (excludes reexports)
 * 	exportedBindings             collections.MultiMap[*ast.Declaration, *ast.ModuleExportName] // Maps local declarations to their associated export aliases
 * 	exportedNames                []*ast.ModuleExportName                                       // all exported names in the module, both local and re-exported, excluding the names of locally exported function declarations
 * 	exportedFunctions            collections.OrderedSet[*ast.FunctionDeclarationNode]          // all of the top-level exported function declarations
 * 	exportEquals                 *ast.ExportAssignment                                         // an export=/module.exports= declaration if one was present
 * 	hasExportStarsToExportValues bool                                                          // whether this module contains export*
 * }
 */
export interface externalModuleInfo {
    externalImports: GoSlice<GoPtr<Declaration>>;
    exportSpecifiers: MultiMap<string, GoPtr<ExportSpecifier>>;
    exportedBindings: MultiMap<GoPtr<Declaration>, GoPtr<ModuleExportName>>;
    exportedNames: GoSlice<GoPtr<ModuleExportName>>;
    exportedFunctions: OrderedSet<GoPtr<FunctionDeclarationNode>>;
    exportEquals: GoPtr<ExportAssignment>;
    hasExportStarsToExportValues: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::type::externalModuleInfoCollector","kind":"type","status":"implemented","sigHash":"c9a137d8bfba0f0c13f50050e30f778d45423b236f366907692de71560df2084","bodyHash":"618e94804bec52bfe0a95b1632cd33640be8b593ea2269f0e03989638d118355"}
 *
 * Go source:
 * externalModuleInfoCollector struct {
 * 	sourceFile       *ast.SourceFile
 * 	compilerOptions  *core.CompilerOptions
 * 	emitContext      *printer.EmitContext
 * 	resolver         binder.ReferenceResolver
 * 	uniqueExports    collections.Set[string]
 * 	hasExportDefault bool
 * 	output           *externalModuleInfo
 * }
 */
export interface externalModuleInfoCollector {
    sourceFile: GoPtr<SourceFile>;
    compilerOptions: GoPtr<CompilerOptions>;
    emitContext: GoPtr<EmitContext>;
    resolver: ReferenceResolver;
    uniqueExports: Set<string>;
    hasExportDefault: bool;
    output: GoPtr<externalModuleInfo>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::collectExternalModuleInfo","kind":"func","status":"implemented","sigHash":"412bb115af275d25cda73a8696f2015c44619dfb967fbdd38fda8e2df432d9cd","bodyHash":"067453bc305d307046997405c10046b7032b363ae89fa6e6ecbd42cde5a15e31"}
 *
 * Go source:
 * func collectExternalModuleInfo(sourceFile *ast.SourceFile, compilerOptions *core.CompilerOptions, emitContext *printer.EmitContext, resolver binder.ReferenceResolver) *externalModuleInfo {
 * 	c := externalModuleInfoCollector{
 * 		sourceFile:      sourceFile,
 * 		compilerOptions: compilerOptions,
 * 		emitContext:     emitContext,
 * 		resolver:        resolver,
 * 		output:          &externalModuleInfo{},
 * 	}
 * 	return c.collect()
 * }
 */
export declare function collectExternalModuleInfo(sourceFile: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>, emitContext: GoPtr<EmitContext>, resolver: ReferenceResolver): GoPtr<externalModuleInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.collect","kind":"method","status":"implemented","sigHash":"f4e81911301c6b0daa2721132fd54ff9fa930dc097ffdb9c4f216ecf70b7a809","bodyHash":"a10ae382fc1750885ad8b748c47748fb24d7add150f36e3d6b8e076fd2bef92f"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) collect() *externalModuleInfo {
 * 	hasImportStar := false
 * 	hasImportDefault := false
 * 	for _, node := range c.sourceFile.Statements.Nodes {
 * 		// Look through NotEmittedStatement to find elided export= declarations
 * 		// (e.g., `declare export = x` is elided by the type eraser but must still be collected)
 * 		if ast.IsNotEmittedStatement(node) {
 * 			original := c.emitContext.MostOriginal(node)
 * 			if original != nil && ast.IsExportAssignment(original) {
 * 				n := original.AsExportAssignment()
 * 				if n.IsExportEquals && c.output.exportEquals == nil {
 * 					c.output.exportEquals = n
 * 				}
 * 			}
 * 			continue
 * 		}
 * 		switch node.Kind {
 * 		case ast.KindImportDeclaration:
 * 			// import "mod"
 * 			// import x from "mod"
 * 			// import * as x from "mod"
 * 			// import { x, y } from "mod"
 * 			n := node.AsImportDeclaration()
 * 			c.addExternalImport(node)
 * 			if !hasImportStar && getImportNeedsImportStarHelper(n) {
 * 				hasImportStar = true
 * 			}
 * 			if !hasImportDefault && getImportNeedsImportDefaultHelper(n) {
 * 				hasImportDefault = true
 * 			}
 *
 * 		case ast.KindImportEqualsDeclaration:
 * 			n := node.AsImportEqualsDeclaration()
 * 			if ast.IsExternalModuleReference(n.ModuleReference) {
 * 				// import x = require("mod")
 * 				c.addExternalImport(node)
 * 			}
 *
 * 		case ast.KindExportDeclaration:
 * 			n := node.AsExportDeclaration()
 * 			if n.ModuleSpecifier != nil {
 * 				// export * from "mod"
 * 				// export * as ns from "mod"
 * 				// export { x, y } from "mod"
 * 				c.addExternalImport(node)
 * 				if n.ExportClause == nil {
 * 					// export * from "mod"
 * 					c.output.hasExportStarsToExportValues = true
 * 				} else if ast.IsNamedExports(n.ExportClause) {
 * 					// export { x, y } from "mod"
 * 					c.addExportedNamesForExportDeclaration(n)
 * 					if !hasImportDefault {
 * 						hasImportDefault = containsDefaultReference(n.ExportClause)
 * 					}
 * 				} else {
 * 					// export * as ns from "mod"
 * 					name := n.ExportClause.AsNamespaceExport().Name()
 * 					nameText := name.Text()
 * 					if c.addUniqueExport(nameText) {
 * 						c.addExportedBinding(node, name)
 * 						c.addExportedName(name)
 * 					}
 * 					// we use the same helpers for `export * as ns` as we do for `import * as ns`
 * 					hasImportStar = true
 * 				}
 * 			} else {
 * 				// export { x, y }
 * 				c.addExportedNamesForExportDeclaration(node.AsExportDeclaration())
 * 			}
 *
 * 		case ast.KindExportAssignment:
 * 			n := node.AsExportAssignment()
 * 			if n.IsExportEquals && c.output.exportEquals == nil {
 * 				// export = x
 * 				c.output.exportEquals = n
 * 			}
 *
 * 		case ast.KindVariableStatement:
 * 			n := node.AsVariableStatement()
 * 			if ast.HasSyntacticModifier(node, ast.ModifierFlagsExport) {
 * 				for _, decl := range n.DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 					c.collectExportedVariableInfo(decl)
 * 				}
 * 			}
 *
 * 		case ast.KindFunctionDeclaration:
 * 			n := node.AsFunctionDeclaration()
 * 			if ast.HasSyntacticModifier(node, ast.ModifierFlagsExport) {
 * 				c.addExportedFunctionDeclaration(n, nil /*name* /, ast.HasSyntacticModifier(node, ast.ModifierFlagsDefault))
 * 			}
 *
 * 		case ast.KindClassDeclaration:
 * 			n := node.AsClassDeclaration()
 * 			if ast.HasSyntacticModifier(node, ast.ModifierFlagsExport) {
 * 				if ast.HasSyntacticModifier(node, ast.ModifierFlagsDefault) {
 * 					// export default class { }
 * 					if !c.hasExportDefault {
 * 						name := n.Name()
 * 						if name == nil {
 * 							name = c.emitContext.Factory.NewGeneratedNameForNode(node)
 * 						}
 * 						c.addExportedBinding(node, name)
 * 						c.hasExportDefault = true
 * 					}
 * 				} else {
 * 					// export class x { }
 * 					name := n.Name()
 * 					if name != nil {
 * 						if c.addUniqueExport(name.Text()) {
 * 							c.addExportedBinding(node, name)
 * 							c.addExportedName(name)
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 *
 * 	return c.output
 * }
 */
export declare function externalModuleInfoCollector_collect(receiver: GoPtr<externalModuleInfoCollector>): GoPtr<externalModuleInfo>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addUniqueExport","kind":"method","status":"implemented","sigHash":"55e8754e5b4f6cfadea5625329465f08b5a04d800ea685968a48eda4e6b29bc2","bodyHash":"3dd183869a5c53f887ff3f64264069ec3b12192637a6e832915c029168a528a4"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addUniqueExport(name string) bool {
 * 	if !c.uniqueExports.Has(name) {
 * 		c.uniqueExports.Add(name)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function externalModuleInfoCollector_addUniqueExport(receiver: GoPtr<externalModuleInfoCollector>, name: string): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExportedBinding","kind":"method","status":"implemented","sigHash":"400fefe950c86ac54e2390013a22d89ea0e98c15d0cf1182ebf67d595f6a0568","bodyHash":"85063aa4b18f1a5f16265f531ce6e635f43d999f2e0eeffa6438fec0d828002f"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExportedBinding(decl *ast.Declaration, name *ast.ModuleExportName) {
 * 	c.output.exportedBindings.Add(c.emitContext.MostOriginal(decl), name)
 * }
 */
export declare function externalModuleInfoCollector_addExportedBinding(receiver: GoPtr<externalModuleInfoCollector>, decl: GoPtr<Declaration>, name: GoPtr<ModuleExportName>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExternalImport","kind":"method","status":"implemented","sigHash":"543d9915f0dcb8323b5f1e06a8ce384675a17e0e467df06b44c876a84810b368","bodyHash":"4c2300bc384be9bb00680f842ce52eb811666ab5128a8e35d9a21889546e25b6"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExternalImport(node *ast.Node /*ImportDeclaration | ImportEqualsDeclaration | ExportDeclaration* /) {
 * 	c.output.externalImports = append(c.output.externalImports, node)
 * }
 */
export declare function externalModuleInfoCollector_addExternalImport(receiver: GoPtr<externalModuleInfoCollector>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExportedName","kind":"method","status":"implemented","sigHash":"44929fe0897f6b70f034728853c9d2033c9c2289a61ecd949b0ef76d249088a6","bodyHash":"ad9ddfd67ea52997998a19e23bd2b7022939646d48b43e08a62d62919aa31c51"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExportedName(name *ast.ModuleExportName) {
 * 	c.output.exportedNames = append(c.output.exportedNames, name)
 * }
 */
export declare function externalModuleInfoCollector_addExportedName(receiver: GoPtr<externalModuleInfoCollector>, name: GoPtr<ModuleExportName>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExportedNamesForExportDeclaration","kind":"method","status":"implemented","sigHash":"79c5bd2917551805f39490e76b33b237bda88dbfaf6ed45d643d0739a05d398a","bodyHash":"0d2cb545e77762dd23c5c597c89e6d33b9b506de7a5a455f661df1273808d1a7"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExportedNamesForExportDeclaration(node *ast.ExportDeclaration) {
 * 	for _, specifier := range node.ExportClause.Elements() {
 * 		specifierNameText := specifier.Name().Text()
 * 		if c.addUniqueExport(specifierNameText) {
 * 			name := specifier.PropertyNameOrName()
 * 			if name.Kind != ast.KindStringLiteral {
 * 				if node.ModuleSpecifier == nil {
 * 					c.output.exportSpecifiers.Add(name.Text(), specifier.AsExportSpecifier())
 * 				}
 *
 * 				decl := c.resolver.GetReferencedImportDeclaration(c.emitContext.MostOriginal(name))
 * 				if decl == nil {
 * 					decl = c.resolver.GetReferencedValueDeclaration(c.emitContext.MostOriginal(name))
 * 				}
 * 				if decl != nil {
 * 					if decl.Kind == ast.KindFunctionDeclaration {
 * 						c.uniqueExports.Delete(specifierNameText)
 * 						c.addExportedFunctionDeclaration(decl.AsFunctionDeclaration(), specifier.Name(), ast.ModuleExportNameIsDefault(specifier.Name()))
 * 						continue
 * 					}
 * 					c.addExportedBinding(decl, specifier.Name())
 * 				}
 * 			}
 *
 * 			c.addExportedName(specifier.Name())
 * 		}
 * 	}
 * }
 */
export declare function externalModuleInfoCollector_addExportedNamesForExportDeclaration(receiver: GoPtr<externalModuleInfoCollector>, node: GoPtr<ExportDeclaration>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExportedFunctionDeclaration","kind":"method","status":"implemented","sigHash":"8e8c5c69cd47212161862af26f0b44b6ee7057b7def65edbf46738703690b77f","bodyHash":"ba8fa6add2fd24299f0bbfeda5ba8a03974258b1a17b13b7ddfc6b4dec44b1a1"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExportedFunctionDeclaration(node *ast.FunctionDeclaration, name *ast.ModuleExportName, isDefault bool) {
 * 	c.output.exportedFunctions.Add(c.emitContext.MostOriginal(node.AsNode()))
 * 	if isDefault {
 * 		// export default function() { }
 * 		// function x() { } + export { x as default };
 * 		if !c.hasExportDefault {
 * 			if name == nil {
 * 				name = c.emitContext.Factory.NewGeneratedNameForNode(node.AsNode())
 * 			}
 * 			c.addExportedBinding(node.AsNode(), name)
 * 			c.hasExportDefault = true
 * 		}
 * 	} else {
 * 		// export function x() { }
 * 		// function x() { } + export { x }
 * 		if name == nil {
 * 			name = node.Name()
 * 		}
 * 		nameText := name.Text()
 * 		if c.addUniqueExport(nameText) {
 * 			c.addExportedBinding(node.AsNode(), name)
 * 		}
 * 	}
 * }
 */
export declare function externalModuleInfoCollector_addExportedFunctionDeclaration(receiver: GoPtr<externalModuleInfoCollector>, node: GoPtr<FunctionDeclaration>, name: GoPtr<ModuleExportName>, isDefault: bool): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.collectExportedVariableInfo","kind":"method","status":"implemented","sigHash":"cc752e20a6c44e80f76f6d28a5239dbf5e9fbefc1273df7cc4b579099745388c","bodyHash":"092ba5761d934e923f9adb53ae69a643cb799503a7155c913745c306783e4c77"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) collectExportedVariableInfo(decl *ast.Node /*VariableDeclaration | BindingElement* /) {
 * 	if ast.IsBindingPattern(decl.Name()) {
 * 		for _, element := range decl.Name().Elements() {
 * 			e := element.AsBindingElement()
 * 			if e.Name() != nil {
 * 				c.collectExportedVariableInfo(element)
 * 			}
 * 		}
 * 	} else if !c.emitContext.HasAutoGenerateInfo(decl.Name()) {
 * 		text := decl.Name().Text()
 * 		if c.addUniqueExport(text) {
 * 			c.addExportedName(decl.Name())
 * 			if transformers.IsLocalName(c.emitContext, decl.Name()) {
 * 				c.addExportedBinding(decl, decl.Name())
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function externalModuleInfoCollector_collectExportedVariableInfo(receiver: GoPtr<externalModuleInfoCollector>, decl: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::constGroup::externalHelpersModuleNameText","kind":"constGroup","status":"implemented","sigHash":"42b8d30f6cec123c960fc65215bb7957d60e1e2100a713e6f60422dd65ee175e","bodyHash":"3a84e0e3d22c1db0bc8672e8e58062771a665415a82256bcf69ae99de8d0f1f2"}
 *
 * Go source:
 * const externalHelpersModuleNameText = "tslib"
 */
export declare const externalHelpersModuleNameText: string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::createExternalHelpersImportDeclarationIfNeeded","kind":"func","status":"implemented","sigHash":"ee1c1d214f9e022612ed38acf0047ea515832a2e6a0b4c24a42474d4a6abe601","bodyHash":"222dbfde9ca376672ded42b89c595570dfc517e0d9958b88395aa31422c264d0"}
 *
 * Go source:
 * func createExternalHelpersImportDeclarationIfNeeded(emitContext *printer.EmitContext, sourceFile *ast.SourceFile, compilerOptions *core.CompilerOptions, fileModuleKind core.ModuleKind, hasExportStarsToExportValues bool, hasImportStar bool, hasImportDefault bool) *ast.Node /*ImportDeclaration | ImportEqualsDeclaration* / {
 * 	if compilerOptions.ImportHelpers.IsTrue() && ast.IsEffectiveExternalModule(sourceFile, compilerOptions) {
 * 		moduleKind := compilerOptions.GetEmitModuleKind()
 * 		helpers := getImportedHelpers(emitContext, sourceFile)
 * 		if fileModuleKind == core.ModuleKindCommonJS || fileModuleKind == core.ModuleKindNone && moduleKind == core.ModuleKindCommonJS {
 * 			// When we emit to a non-ES module, generate a synthetic `import tslib = require("tslib")` to be further transformed.
 * 			externalHelpersModuleName := getOrCreateExternalHelpersModuleNameIfNeeded(emitContext, sourceFile, compilerOptions, helpers, hasExportStarsToExportValues, hasImportStar || hasImportDefault, fileModuleKind)
 * 			if externalHelpersModuleName != nil {
 * 				externalHelpersImportDeclaration := emitContext.Factory.NewImportEqualsDeclaration(
 * 					nil,   /*modifiers* /
 * 					false, /*isTypeOnly* /
 * 					externalHelpersModuleName,
 * 					emitContext.Factory.NewExternalModuleReference(emitContext.Factory.NewStringLiteral(externalHelpersModuleNameText, ast.TokenFlagsNone)),
 * 				)
 * 				emitContext.AddEmitFlags(externalHelpersImportDeclaration, printer.EFCustomPrologue)
 * 				return externalHelpersImportDeclaration
 * 			}
 * 		} else {
 * 			// When we emit as an ES module, generate an `import` declaration that uses named imports for helpers.
 * 			// If we cannot determine the implied module kind under `module: preserve` we assume ESM.
 * 			var helperNames []string
 * 			for _, helper := range helpers {
 * 				importName := helper.ImportName
 * 				if len(importName) > 0 {
 * 					helperNames = core.AppendIfUnique(helperNames, importName)
 * 				}
 * 			}
 * 			if len(helperNames) > 0 {
 * 				slices.SortFunc(helperNames, stringutil.CompareStringsCaseSensitive)
 * 				// Alias the imports if the names are used somewhere in the file.
 * 				// NOTE: We don't need to care about global import collisions as this is a module.
 *
 * 				importSpecifiers := core.Map(helperNames, func(name string) *ast.ImportSpecifierNode {
 * 					if printer.IsFileLevelUniqueName(sourceFile, name, nil /*hasGlobalName* /) {
 * 						return emitContext.Factory.NewImportSpecifier(false /*isTypeOnly* /, nil /*propertyName* /, emitContext.Factory.NewIdentifier(name))
 * 					} else {
 * 						return emitContext.Factory.NewImportSpecifier(false /*isTypeOnly* /, emitContext.Factory.NewIdentifier(name), emitContext.Factory.NewUnscopedHelperName(name))
 * 					}
 * 				})
 * 				namedBindings := emitContext.Factory.NewNamedImports(emitContext.Factory.NewNodeList(importSpecifiers))
 * 				parseNode := emitContext.MostOriginal(sourceFile.AsNode())
 * 				emitContext.AddEmitFlags(parseNode, printer.EFExternalHelpers)
 *
 * 				externalHelpersImportDeclaration := emitContext.Factory.NewImportDeclaration(
 * 					nil, /*modifiers* /
 * 					emitContext.Factory.NewImportClause(ast.KindUnknown /*phaseModifier* /, nil /*name* /, namedBindings),
 * 					emitContext.Factory.NewStringLiteral(externalHelpersModuleNameText, ast.TokenFlagsNone),
 * 					nil, /*attributes* /
 * 				)
 *
 * 				emitContext.AddEmitFlags(externalHelpersImportDeclaration, printer.EFCustomPrologue)
 * 				return externalHelpersImportDeclaration
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export declare function createExternalHelpersImportDeclarationIfNeeded(emitContext: GoPtr<EmitContext>, sourceFile: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>, fileModuleKind: ModuleKind, hasExportStarsToExportValues: bool, hasImportStar: bool, hasImportDefault: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::getImportedHelpers","kind":"func","status":"implemented","sigHash":"3473b45f27e47d7fd866d41edfc966096030c3d51af0f954237bd87eadb71d75","bodyHash":"ae061b50898d51a343902807985fdbecf08420b67421b6fe710d9f6bfb4c8edd"}
 *
 * Go source:
 * func getImportedHelpers(emitContext *printer.EmitContext, sourceFile *ast.SourceFile) []*printer.EmitHelper {
 * 	var helpers []*printer.EmitHelper
 * 	for _, helper := range emitContext.GetEmitHelpers(sourceFile.AsNode()) {
 * 		if !helper.Scoped {
 * 			helpers = append(helpers, helper)
 * 		}
 * 	}
 * 	return helpers
 * }
 */
export declare function getImportedHelpers(emitContext: GoPtr<EmitContext>, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<EmitHelper>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::getOrCreateExternalHelpersModuleNameIfNeeded","kind":"func","status":"implemented","sigHash":"fd865c6562e4302dd96864b3c7b867860406cb1d5de983f8d0ec0362d404ef88","bodyHash":"b984ddad3391b3cebcd0ac508253944381cf48776c088bcb31501583ac8317a7"}
 *
 * Go source:
 * func getOrCreateExternalHelpersModuleNameIfNeeded(emitContext *printer.EmitContext, node *ast.SourceFile, compilerOptions *core.CompilerOptions, helpers []*printer.EmitHelper, hasExportStarsToExportValues bool, hasImportStarOrImportDefault bool, fileModuleKind core.ModuleKind) *ast.IdentifierNode {
 * 	externalHelpersModuleName := emitContext.GetExternalHelpersModuleName(node)
 * 	if externalHelpersModuleName != nil {
 * 		return externalHelpersModuleName
 * 	}
 *
 * 	create := len(helpers) > 0 ||
 * 		(hasExportStarsToExportValues || hasImportStarOrImportDefault) &&
 * 			fileModuleKind < core.ModuleKindSystem
 *
 * 	if create {
 * 		externalHelpersModuleName = emitContext.Factory.NewUniqueName(externalHelpersModuleNameText)
 * 		emitContext.SetExternalHelpersModuleName(node, externalHelpersModuleName)
 * 	}
 *
 * 	return externalHelpersModuleName
 * }
 */
export declare function getOrCreateExternalHelpersModuleNameIfNeeded(emitContext: GoPtr<EmitContext>, node: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>, helpers: GoSlice<GoPtr<EmitHelper>>, hasExportStarsToExportValues: bool, hasImportStarOrImportDefault: bool, fileModuleKind: ModuleKind): GoPtr<IdentifierNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::isNamedDefaultReference","kind":"func","status":"implemented","sigHash":"ca448cfc2cb22cd75c5fe871710304ec4a07fa11a04efeaba0c0e45cddce38f4","bodyHash":"549cf93c0e0bd5643cf90cc92698a85a7ddbf2ea91cd654fbc278cd110a027d8"}
 *
 * Go source:
 * func isNamedDefaultReference(e *ast.Node /*ImportSpecifier | ExportSpecifier* /) bool {
 * 	return ast.ModuleExportNameIsDefault(e.PropertyNameOrName())
 * }
 */
export declare function isNamedDefaultReference(e: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::containsDefaultReference","kind":"func","status":"implemented","sigHash":"2e176000f65ce3648785db08d3cdfdaaf9555479f6ebe6f164bc8310c8ec1019","bodyHash":"fa6389bc8b9a50d3608feebf9ef18773953439a5ca175ff277dc1154ea9d2cd3"}
 *
 * Go source:
 * func containsDefaultReference(node *ast.Node /*NamedImportBindings | NamedExportBindings* /) bool {
 * 	return node != nil && (ast.IsNamedImports(node) || ast.IsNamedExports(node)) && core.Some(node.Elements(), isNamedDefaultReference)
 * }
 */
export declare function containsDefaultReference(node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::getExportNeedsImportStarHelper","kind":"func","status":"implemented","sigHash":"fc409e2c1dc13dc7439935147d2ba54ad051488bf43c610497b462be7b16f00c","bodyHash":"727ee745a4f8702069139b079ffa1c166d9f5dc4ed3648f3092e191b6c43cfa5"}
 *
 * Go source:
 * func getExportNeedsImportStarHelper(node *ast.ExportDeclaration) bool {
 * 	return ast.GetNamespaceDeclarationNode(node.AsNode()) != nil
 * }
 */
export declare function getExportNeedsImportStarHelper(node: GoPtr<ExportDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::getImportNeedsImportStarHelper","kind":"func","status":"implemented","sigHash":"578444712dd16a45b87eafad7c6d097c89069984fd0d7987ef3cfa1cb4162327","bodyHash":"f973895a3fe54d612f6f6192d52bc4271f9c75c01df69fa93bff80ca79556227"}
 *
 * Go source:
 * func getImportNeedsImportStarHelper(node *ast.ImportDeclaration) bool {
 * 	if ast.GetNamespaceDeclarationNode(node.AsNode()) != nil {
 * 		return true
 * 	}
 * 	if node.ImportClause == nil {
 * 		return false
 * 	}
 * 	bindings := node.ImportClause.AsImportClause().NamedBindings
 * 	if bindings == nil {
 * 		return false
 * 	}
 * 	if !ast.IsNamedImports(bindings) {
 * 		return false
 * 	}
 * 	namedImports := bindings.AsNamedImports()
 * 	defaultRefCount := 0
 * 	for _, binding := range namedImports.Elements.Nodes {
 * 		if isNamedDefaultReference(binding) {
 * 			defaultRefCount++
 * 		}
 * 	}
 * 	// Import star is required if there's default named refs mixed with non-default refs, or if theres non-default refs and it has a default import
 * 	return (defaultRefCount > 0 && defaultRefCount != len(namedImports.Elements.Nodes)) || ((len(namedImports.Elements.Nodes)-defaultRefCount) != 0 && ast.IsDefaultImport(node.AsNode()))
 * }
 */
export declare function getImportNeedsImportStarHelper(node: GoPtr<ImportDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::getImportNeedsImportDefaultHelper","kind":"func","status":"implemented","sigHash":"6bd1138106740f58bae2ac3a5f02c59c0c1e8211be15eefe636bd56dfcd3afa0","bodyHash":"b135fe81a173e73fbe351e3d3dc49b5beff9119a19ada7bea8c4e96b4daf4313"}
 *
 * Go source:
 * func getImportNeedsImportDefaultHelper(node *ast.ImportDeclaration) bool {
 * 	// Import default is needed if there's a default import or a default ref and no other refs (meaning an import star helper wasn't requested)
 * 	return !getImportNeedsImportStarHelper(node) && (ast.IsDefaultImport(node.AsNode()) || (node.ImportClause != nil &&
 * 		ast.IsNamedImports(node.ImportClause.AsImportClause().NamedBindings) &&
 * 		containsDefaultReference(node.ImportClause.AsImportClause().NamedBindings)))
 * }
 */
export declare function getImportNeedsImportDefaultHelper(node: GoPtr<ImportDeclaration>): bool;
//# sourceMappingURL=externalmoduleinfo.d.ts.map