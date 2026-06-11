import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import { SortFunc } from "../../../go/slices.js";
import type { SourceFile } from "../../ast/ast.js";
import { Node_Elements, Node_PropertyNameOrName, Node_Text } from "../../ast/ast.js";
import type { Node } from "../../ast/spine.js";
import { Node_AsNode, Node_Name } from "../../ast/spine.js";
import type { ExportAssignment, ExportDeclaration, ExportSpecifier, FunctionDeclaration, ImportDeclaration } from "../../ast/generated/data.js";
import type { Declaration, FunctionDeclarationNode, IdentifierNode, ModuleExportName } from "../../ast/generated/unions.js";
import { AsBindingElement, AsClassDeclaration, AsExportAssignment, AsExportDeclaration, AsExportSpecifier, AsFunctionDeclaration, AsImportClause, AsImportDeclaration, AsImportEqualsDeclaration, AsNamedImports, AsNamespaceExport, AsVariableDeclarationList, AsVariableStatement } from "../../ast/generated/casts.js";
import { NewExternalModuleReference, NewIdentifier, NewImportClause, NewImportDeclaration, NewImportEqualsDeclaration, NewImportSpecifier, NewNamedImports, NewStringLiteral } from "../../ast/generated/factory.js";
import { KindClassDeclaration, KindExportAssignment, KindExportDeclaration, KindFunctionDeclaration, KindImportDeclaration, KindImportEqualsDeclaration, KindStringLiteral, KindUnknown, KindVariableStatement } from "../../ast/generated/kinds.js";
import { IsExportAssignment, IsExternalModuleReference, IsNamedExports, IsNamedImports, IsNotEmittedStatement } from "../../ast/generated/predicates.js";
import { GetNamespaceDeclarationNode, HasSyntacticModifier, IsBindingPattern, IsDefaultImport, IsEffectiveExternalModule, ModuleExportNameIsDefault } from "../../ast/utilities.js";
import { ModifierFlagsDefault, ModifierFlagsExport } from "../../ast/modifierflags.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { MultiMap } from "../../collections/multimap.js";
import { MultiMap_Add, NewMultiMapWithSizeHint } from "../../collections/multimap.js";
import type { OrderedSet } from "../../collections/ordered_set.js";
import { NewOrderedSetWithSizeHint, OrderedSet_Add } from "../../collections/ordered_set.js";
import type { Set } from "../../collections/set.js";
import { NewSetWithSizeHint, Set_Add, Set_Delete, Set_Has } from "../../collections/set.js";
import type { CompilerOptions, ModuleKind } from "../../core/compileroptions.js";
import { CompilerOptions_GetEmitModuleKind, ModuleKindCommonJS, ModuleKindNone, ModuleKindSystem } from "../../core/compileroptions.js";
import { AppendIfUnique, Map as CoreMap, Some } from "../../core/core.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import { EmitContext_AddEmitFlags, EmitContext_GetEmitHelpers, EmitContext_GetExternalHelpersModuleName, EmitContext_HasAutoGenerateInfo, EmitContext_MostOriginal, EmitContext_SetExternalHelpersModuleName } from "../../printer/emitcontext.js";
import { EFCustomPrologue, EFExternalHelpers } from "../../printer/emitflags.js";
import type { NodeFactory } from "../../printer/factory.js";
import { NodeFactory_NewGeneratedNameForNode, NodeFactory_NewUniqueName, NodeFactory_NewUnscopedHelperName } from "../../printer/factory.js";
import { NodeFactory_NewNodeList } from "../../ast/spine.js";
import type { EmitHelper } from "../../printer/helpers.js";
import { IsFileLevelUniqueName } from "../../printer/utilities.js";
import { IsLocalName } from "../utilities.js";
import { CompareStringsCaseSensitive } from "../../stringutil/compare.js";

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
export function collectExternalModuleInfo(sourceFile: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>, emitContext: GoPtr<EmitContext>, resolver: ReferenceResolver): GoPtr<externalModuleInfo> {
  const c: externalModuleInfoCollector = {
    sourceFile: sourceFile,
    compilerOptions: compilerOptions,
    emitContext: emitContext,
    resolver: resolver,
    uniqueExports: NewSetWithSizeHint<string>(0)!,
    hasExportDefault: false,
    output: {
      externalImports: [],
      exportSpecifiers: NewMultiMapWithSizeHint<string, GoPtr<ExportSpecifier>>(0)!,
      exportedBindings: NewMultiMapWithSizeHint<GoPtr<Declaration>, GoPtr<ModuleExportName>>(0)!,
      exportedNames: [],
      exportedFunctions: NewOrderedSetWithSizeHint<GoPtr<FunctionDeclarationNode>>(0)!,
      exportEquals: undefined,
      hasExportStarsToExportValues: false,
    },
  };
  return externalModuleInfoCollector_collect(c);
}

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
export function externalModuleInfoCollector_collect(receiver: GoPtr<externalModuleInfoCollector>): GoPtr<externalModuleInfo> {
  let hasImportStar = false;
  let hasImportDefault = false;
  for (const node of receiver!.sourceFile!.Statements!.Nodes) {
    // Look through NotEmittedStatement to find elided export= declarations
    // (e.g., `declare export = x` is elided by the type eraser but must still be collected)
    if (IsNotEmittedStatement(node)) {
      const original = EmitContext_MostOriginal(receiver!.emitContext, node);
      if (original !== undefined && IsExportAssignment(original)) {
        const n = AsExportAssignment(original);
        if (n!.IsExportEquals && receiver!.output!.exportEquals === undefined) {
          receiver!.output!.exportEquals = n;
        }
      }
      continue;
    }
    switch (node!.Kind) {
      case KindImportDeclaration: {
        // import "mod"
        // import x from "mod"
        // import * as x from "mod"
        // import { x, y } from "mod"
        const n = AsImportDeclaration(node);
        externalModuleInfoCollector_addExternalImport(receiver, node);
        if (!hasImportStar && getImportNeedsImportStarHelper(n)) {
          hasImportStar = true;
        }
        if (!hasImportDefault && getImportNeedsImportDefaultHelper(n)) {
          hasImportDefault = true;
        }
        break;
      }
      case KindImportEqualsDeclaration: {
        const n = AsImportEqualsDeclaration(node);
        if (IsExternalModuleReference(n!.ModuleReference)) {
          // import x = require("mod")
          externalModuleInfoCollector_addExternalImport(receiver, node);
        }
        break;
      }
      case KindExportDeclaration: {
        const n = AsExportDeclaration(node);
        if (n!.ModuleSpecifier !== undefined) {
          // export * from "mod"
          // export * as ns from "mod"
          // export { x, y } from "mod"
          externalModuleInfoCollector_addExternalImport(receiver, node);
          if (n!.ExportClause === undefined) {
            // export * from "mod"
            receiver!.output!.hasExportStarsToExportValues = true;
          } else if (IsNamedExports(n!.ExportClause)) {
            // export { x, y } from "mod"
            externalModuleInfoCollector_addExportedNamesForExportDeclaration(receiver, n);
            if (!hasImportDefault) {
              hasImportDefault = containsDefaultReference(n!.ExportClause);
            }
          } else {
            // export * as ns from "mod"
            const nsExport = AsNamespaceExport(n!.ExportClause);
            const name = nsExport!.name;
            const nameText = Node_Text(name);
            if (externalModuleInfoCollector_addUniqueExport(receiver, nameText)) {
              externalModuleInfoCollector_addExportedBinding(receiver, node, name);
              externalModuleInfoCollector_addExportedName(receiver, name);
            }
            // we use the same helpers for `export * as ns` as we do for `import * as ns`
            hasImportStar = true;
          }
        } else {
          // export { x, y }
          externalModuleInfoCollector_addExportedNamesForExportDeclaration(receiver, AsExportDeclaration(node));
        }
        break;
      }
      case KindExportAssignment: {
        const n = AsExportAssignment(node);
        if (n!.IsExportEquals && receiver!.output!.exportEquals === undefined) {
          // export = x
          receiver!.output!.exportEquals = n;
        }
        break;
      }
      case KindVariableStatement: {
        const n = AsVariableStatement(node);
        if (HasSyntacticModifier(node, ModifierFlagsExport)) {
          for (const decl of AsVariableDeclarationList(n!.DeclarationList)!.Declarations!.Nodes) {
            externalModuleInfoCollector_collectExportedVariableInfo(receiver, decl);
          }
        }
        break;
      }
      case KindFunctionDeclaration: {
        const n = AsFunctionDeclaration(node);
        if (HasSyntacticModifier(node, ModifierFlagsExport)) {
          externalModuleInfoCollector_addExportedFunctionDeclaration(receiver, n, undefined, HasSyntacticModifier(node, ModifierFlagsDefault));
        }
        break;
      }
      case KindClassDeclaration: {
        const n = AsClassDeclaration(node);
        if (HasSyntacticModifier(node, ModifierFlagsExport)) {
          if (HasSyntacticModifier(node, ModifierFlagsDefault)) {
            // export default class { }
            if (!receiver!.hasExportDefault) {
              let name: GoPtr<ModuleExportName> = n!.name;
              if (name === undefined) {
                name = NodeFactory_NewGeneratedNameForNode(receiver!.emitContext!.Factory, node);
              }
              externalModuleInfoCollector_addExportedBinding(receiver, node, name);
              receiver!.hasExportDefault = true;
            }
          } else {
            // export class x { }
            const name = n!.name;
            if (name !== undefined) {
              if (externalModuleInfoCollector_addUniqueExport(receiver, Node_Text(name))) {
                externalModuleInfoCollector_addExportedBinding(receiver, node, name);
                externalModuleInfoCollector_addExportedName(receiver, name);
              }
            }
          }
        }
        break;
      }
    }
  }

  return receiver!.output;
}

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
export function externalModuleInfoCollector_addUniqueExport(receiver: GoPtr<externalModuleInfoCollector>, name: string): bool {
  if (!Set_Has(receiver!.uniqueExports, name)) {
    Set_Add(receiver!.uniqueExports, name);
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExportedBinding","kind":"method","status":"implemented","sigHash":"400fefe950c86ac54e2390013a22d89ea0e98c15d0cf1182ebf67d595f6a0568","bodyHash":"85063aa4b18f1a5f16265f531ce6e635f43d999f2e0eeffa6438fec0d828002f"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExportedBinding(decl *ast.Declaration, name *ast.ModuleExportName) {
 * 	c.output.exportedBindings.Add(c.emitContext.MostOriginal(decl), name)
 * }
 */
export function externalModuleInfoCollector_addExportedBinding(receiver: GoPtr<externalModuleInfoCollector>, decl: GoPtr<Declaration>, name: GoPtr<ModuleExportName>): void {
  MultiMap_Add(receiver!.output!.exportedBindings, EmitContext_MostOriginal(receiver!.emitContext, decl), name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExternalImport","kind":"method","status":"implemented","sigHash":"543d9915f0dcb8323b5f1e06a8ce384675a17e0e467df06b44c876a84810b368","bodyHash":"4c2300bc384be9bb00680f842ce52eb811666ab5128a8e35d9a21889546e25b6"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExternalImport(node *ast.Node /*ImportDeclaration | ImportEqualsDeclaration | ExportDeclaration* /) {
 * 	c.output.externalImports = append(c.output.externalImports, node)
 * }
 */
export function externalModuleInfoCollector_addExternalImport(receiver: GoPtr<externalModuleInfoCollector>, node: GoPtr<Node>): void {
  receiver!.output!.externalImports.push(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::method::externalModuleInfoCollector.addExportedName","kind":"method","status":"implemented","sigHash":"44929fe0897f6b70f034728853c9d2033c9c2289a61ecd949b0ef76d249088a6","bodyHash":"ad9ddfd67ea52997998a19e23bd2b7022939646d48b43e08a62d62919aa31c51"}
 *
 * Go source:
 * func (c *externalModuleInfoCollector) addExportedName(name *ast.ModuleExportName) {
 * 	c.output.exportedNames = append(c.output.exportedNames, name)
 * }
 */
export function externalModuleInfoCollector_addExportedName(receiver: GoPtr<externalModuleInfoCollector>, name: GoPtr<ModuleExportName>): void {
  receiver!.output!.exportedNames.push(name);
}

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
export function externalModuleInfoCollector_addExportedNamesForExportDeclaration(receiver: GoPtr<externalModuleInfoCollector>, node: GoPtr<ExportDeclaration>): void {
  const elements = Node_Elements(node!.ExportClause);
  if (elements === undefined) return;
  for (const specifier of elements) {
    const specifierName = Node_Name(specifier);
    const specifierNameText = Node_Text(specifierName);
    if (externalModuleInfoCollector_addUniqueExport(receiver, specifierNameText)) {
      const propName = Node_PropertyNameOrName(specifier);
      if (propName!.Kind !== KindStringLiteral) {
        if (node!.ModuleSpecifier === undefined) {
          MultiMap_Add(receiver!.output!.exportSpecifiers, Node_Text(propName), AsExportSpecifier(specifier));
        }

        let decl = receiver!.resolver.GetReferencedImportDeclaration(EmitContext_MostOriginal(receiver!.emitContext, propName));
        if (decl === undefined) {
          decl = receiver!.resolver.GetReferencedValueDeclaration(EmitContext_MostOriginal(receiver!.emitContext, propName));
        }
        if (decl !== undefined) {
          if (decl!.Kind === KindFunctionDeclaration) {
            Set_Delete(receiver!.uniqueExports, specifierNameText);
            externalModuleInfoCollector_addExportedFunctionDeclaration(receiver, AsFunctionDeclaration(decl), Node_Name(specifier), ModuleExportNameIsDefault(Node_Name(specifier)));
            continue;
          }
          externalModuleInfoCollector_addExportedBinding(receiver, decl, Node_Name(specifier));
        }
      }

      externalModuleInfoCollector_addExportedName(receiver, Node_Name(specifier));
    }
  }
}

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
export function externalModuleInfoCollector_addExportedFunctionDeclaration(receiver: GoPtr<externalModuleInfoCollector>, node: GoPtr<FunctionDeclaration>, name: GoPtr<ModuleExportName>, isDefault: bool): void {
  OrderedSet_Add(receiver!.output!.exportedFunctions, EmitContext_MostOriginal(receiver!.emitContext, Node_AsNode(node)));
  if (isDefault) {
    // export default function() { }
    // function x() { } + export { x as default };
    if (!receiver!.hasExportDefault) {
      let resolvedName: GoPtr<ModuleExportName> = name;
      if (resolvedName === undefined) {
        resolvedName = NodeFactory_NewGeneratedNameForNode(receiver!.emitContext!.Factory, Node_AsNode(node));
      }
      externalModuleInfoCollector_addExportedBinding(receiver, Node_AsNode(node), resolvedName);
      receiver!.hasExportDefault = true;
    }
  } else {
    // export function x() { }
    // function x() { } + export { x }
    let resolvedName: GoPtr<ModuleExportName> = name;
    if (resolvedName === undefined) {
      resolvedName = node!.name;
    }
    const nameText = Node_Text(resolvedName);
    if (externalModuleInfoCollector_addUniqueExport(receiver, nameText)) {
      externalModuleInfoCollector_addExportedBinding(receiver, Node_AsNode(node), resolvedName);
    }
  }
}

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
export function externalModuleInfoCollector_collectExportedVariableInfo(receiver: GoPtr<externalModuleInfoCollector>, decl: GoPtr<Node>): void {
  const declName = Node_Name(decl);
  if (IsBindingPattern(declName)) {
    const elements = Node_Elements(declName);
    if (elements !== undefined) {
      for (const element of elements) {
        const e = AsBindingElement(element);
        if (e!.name !== undefined) {
          externalModuleInfoCollector_collectExportedVariableInfo(receiver, element);
        }
      }
    }
  } else if (!EmitContext_HasAutoGenerateInfo(receiver!.emitContext, declName)) {
    const text = Node_Text(declName);
    if (externalModuleInfoCollector_addUniqueExport(receiver, text)) {
      externalModuleInfoCollector_addExportedName(receiver, declName);
      if (IsLocalName(receiver!.emitContext, declName)) {
        externalModuleInfoCollector_addExportedBinding(receiver, decl, declName);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::constGroup::externalHelpersModuleNameText","kind":"constGroup","status":"implemented","sigHash":"42b8d30f6cec123c960fc65215bb7957d60e1e2100a713e6f60422dd65ee175e","bodyHash":"3a84e0e3d22c1db0bc8672e8e58062771a665415a82256bcf69ae99de8d0f1f2"}
 *
 * Go source:
 * const externalHelpersModuleNameText = "tslib"
 */
export const externalHelpersModuleNameText: string = "tslib";

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
export function createExternalHelpersImportDeclarationIfNeeded(emitContext: GoPtr<EmitContext>, sourceFile: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>, fileModuleKind: ModuleKind, hasExportStarsToExportValues: bool, hasImportStar: bool, hasImportDefault: bool): GoPtr<Node> {
  if (Tristate_IsTrue(compilerOptions!.ImportHelpers) && IsEffectiveExternalModule(sourceFile, compilerOptions)) {
    const moduleKind = CompilerOptions_GetEmitModuleKind(compilerOptions);
    const helpers = getImportedHelpers(emitContext, sourceFile);
    if (fileModuleKind === ModuleKindCommonJS || (fileModuleKind === ModuleKindNone && moduleKind === ModuleKindCommonJS)) {
      // When we emit to a non-ES module, generate a synthetic `import tslib = require("tslib")` to be further transformed.
      const externalHelpersModuleName = getOrCreateExternalHelpersModuleNameIfNeeded(emitContext, sourceFile, compilerOptions, helpers, hasExportStarsToExportValues, hasImportStar || hasImportDefault, fileModuleKind);
      if (externalHelpersModuleName !== undefined) {
        const f = emitContext!.Factory!.__tsgoEmbedded0!;
        const externalHelpersImportDeclaration = NewImportEqualsDeclaration(
          f,
          undefined, /*modifiers*/
          false, /*isTypeOnly*/
          externalHelpersModuleName,
          NewExternalModuleReference(f, NewStringLiteral(f, externalHelpersModuleNameText, TokenFlagsNone)),
        );
        EmitContext_AddEmitFlags(emitContext, externalHelpersImportDeclaration, EFCustomPrologue);
        return externalHelpersImportDeclaration;
      }
    } else {
      // When we emit as an ES module, generate an `import` declaration that uses named imports for helpers.
      // If we cannot determine the implied module kind under `module: preserve` we assume ESM.
      let helperNames: GoSlice<string> = [];
      for (const helper of helpers) {
        const importName = helper!.ImportName;
        if (importName.length > 0) {
          helperNames = AppendIfUnique(helperNames, importName);
        }
      }
      if (helperNames.length > 0) {
        SortFunc(helperNames, CompareStringsCaseSensitive);
        // Alias the imports if the names are used somewhere in the file.
        // NOTE: We don't need to care about global import collisions as this is a module.

        const f = emitContext!.Factory!.__tsgoEmbedded0!;
        const importSpecifiers = CoreMap(helperNames, (name: string) => {
          if (IsFileLevelUniqueName(sourceFile, name, undefined!)) {
            return NewImportSpecifier(f, false /*isTypeOnly*/, undefined /*propertyName*/, NewIdentifier(f, name));
          } else {
            return NewImportSpecifier(f, false /*isTypeOnly*/, NewIdentifier(f, name), NodeFactory_NewUnscopedHelperName(emitContext!.Factory, name));
          }
        });
        const namedBindings = NewNamedImports(f, NodeFactory_NewNodeList(f, importSpecifiers));
        const parseNode = EmitContext_MostOriginal(emitContext, Node_AsNode(sourceFile));
        EmitContext_AddEmitFlags(emitContext, parseNode, EFExternalHelpers);

        const externalHelpersImportDeclaration = NewImportDeclaration(
          f,
          undefined, /*modifiers*/
          NewImportClause(f, KindUnknown /*phaseModifier*/, undefined /*name*/, namedBindings),
          NewStringLiteral(f, externalHelpersModuleNameText, TokenFlagsNone),
          undefined, /*attributes*/
        );

        EmitContext_AddEmitFlags(emitContext, externalHelpersImportDeclaration, EFCustomPrologue);
        return externalHelpersImportDeclaration;
      }
    }
  }
  return undefined;
}

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
export function getImportedHelpers(emitContext: GoPtr<EmitContext>, sourceFile: GoPtr<SourceFile>): GoSlice<GoPtr<EmitHelper>> {
  let helpers: GoSlice<GoPtr<EmitHelper>> = [];
  for (const helper of EmitContext_GetEmitHelpers(emitContext, Node_AsNode(sourceFile))) {
    if (!helper!.Scoped) {
      helpers = [...helpers, helper];
    }
  }
  return helpers;
}

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
export function getOrCreateExternalHelpersModuleNameIfNeeded(emitContext: GoPtr<EmitContext>, node: GoPtr<SourceFile>, compilerOptions: GoPtr<CompilerOptions>, helpers: GoSlice<GoPtr<EmitHelper>>, hasExportStarsToExportValues: bool, hasImportStarOrImportDefault: bool, fileModuleKind: ModuleKind): GoPtr<IdentifierNode> {
  let externalHelpersModuleName = EmitContext_GetExternalHelpersModuleName(emitContext, node);
  if (externalHelpersModuleName !== undefined) {
    return externalHelpersModuleName;
  }

  const create = helpers.length > 0 ||
    ((hasExportStarsToExportValues || hasImportStarOrImportDefault) &&
      fileModuleKind < ModuleKindSystem);

  if (create) {
    externalHelpersModuleName = NodeFactory_NewUniqueName(emitContext!.Factory, externalHelpersModuleNameText);
    EmitContext_SetExternalHelpersModuleName(emitContext, node, externalHelpersModuleName);
  }

  return externalHelpersModuleName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::isNamedDefaultReference","kind":"func","status":"implemented","sigHash":"ca448cfc2cb22cd75c5fe871710304ec4a07fa11a04efeaba0c0e45cddce38f4","bodyHash":"549cf93c0e0bd5643cf90cc92698a85a7ddbf2ea91cd654fbc278cd110a027d8"}
 *
 * Go source:
 * func isNamedDefaultReference(e *ast.Node /*ImportSpecifier | ExportSpecifier* /) bool {
 * 	return ast.ModuleExportNameIsDefault(e.PropertyNameOrName())
 * }
 */
export function isNamedDefaultReference(e: GoPtr<Node>): bool {
  return ModuleExportNameIsDefault(Node_PropertyNameOrName(e));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::containsDefaultReference","kind":"func","status":"implemented","sigHash":"2e176000f65ce3648785db08d3cdfdaaf9555479f6ebe6f164bc8310c8ec1019","bodyHash":"fa6389bc8b9a50d3608feebf9ef18773953439a5ca175ff277dc1154ea9d2cd3"}
 *
 * Go source:
 * func containsDefaultReference(node *ast.Node /*NamedImportBindings | NamedExportBindings* /) bool {
 * 	return node != nil && (ast.IsNamedImports(node) || ast.IsNamedExports(node)) && core.Some(node.Elements(), isNamedDefaultReference)
 * }
 */
export function containsDefaultReference(node: GoPtr<Node>): bool {
  if (node === undefined) return false;
  if (!IsNamedImports(node) && !IsNamedExports(node)) return false;
  const elements = Node_Elements(node);
  if (elements === undefined) return false;
  return Some(elements, isNamedDefaultReference);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/moduletransforms/externalmoduleinfo.go::func::getExportNeedsImportStarHelper","kind":"func","status":"implemented","sigHash":"fc409e2c1dc13dc7439935147d2ba54ad051488bf43c610497b462be7b16f00c","bodyHash":"727ee745a4f8702069139b079ffa1c166d9f5dc4ed3648f3092e191b6c43cfa5"}
 *
 * Go source:
 * func getExportNeedsImportStarHelper(node *ast.ExportDeclaration) bool {
 * 	return ast.GetNamespaceDeclarationNode(node.AsNode()) != nil
 * }
 */
export function getExportNeedsImportStarHelper(node: GoPtr<ExportDeclaration>): bool {
  return GetNamespaceDeclarationNode(Node_AsNode(node)) !== undefined;
}

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
export function getImportNeedsImportStarHelper(node: GoPtr<ImportDeclaration>): bool {
  if (GetNamespaceDeclarationNode(Node_AsNode(node)) !== undefined) {
    return true;
  }
  if (node!.ImportClause === undefined) {
    return false;
  }
  const bindings = AsImportClause(node!.ImportClause)!.NamedBindings;
  if (bindings === undefined) {
    return false;
  }
  if (!IsNamedImports(bindings)) {
    return false;
  }
  const namedImports = AsNamedImports(bindings);
  let defaultRefCount = 0;
  for (const binding of namedImports!.Elements!.Nodes) {
    if (isNamedDefaultReference(binding)) {
      defaultRefCount++;
    }
  }
  // Import star is required if there's default named refs mixed with non-default refs, or if theres non-default refs and it has a default import
  return (defaultRefCount > 0 && defaultRefCount !== namedImports!.Elements!.Nodes.length) || ((namedImports!.Elements!.Nodes.length - defaultRefCount) !== 0 && IsDefaultImport(Node_AsNode(node)));
}

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
export function getImportNeedsImportDefaultHelper(node: GoPtr<ImportDeclaration>): bool {
  // Import default is needed if there's a default import or a default ref and no other refs (meaning an import star helper wasn't requested)
  return !getImportNeedsImportStarHelper(node) && (IsDefaultImport(Node_AsNode(node)) || (node!.ImportClause !== undefined &&
    IsNamedImports(AsImportClause(node!.ImportClause)!.NamedBindings) &&
    containsDefaultReference(AsImportClause(node!.ImportClause)!.NamedBindings)));
}
