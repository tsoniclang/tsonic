import type { bool, int, ulong } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { NewGoStructMap } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { NodeId, SymbolId } from "../ast/ids.js";
import { GetNodeId, GetSymbolId } from "../ast/utilities.js";
import type { Symbol, SymbolTable } from "../ast/symbol.js";
import { InternalSymbolNameExportEquals, InternalSymbolNameDefault } from "../ast/symbol.js";
import type { SymbolFlags } from "../ast/generated/flags.js";
import { SymbolFlagsNamespace, SymbolFlagsValue, SymbolFlagsAlias, SymbolFlagsType, SymbolFlagsTypeParameter, SymbolFlagsAssignment } from "../ast/generated/flags.js";
import type { Kind } from "../ast/generated/kinds.js";
import { KindEqualsToken, KindExportSpecifier, KindSourceFile, KindModuleDeclaration, KindClassDeclaration, KindClassExpression, KindInterfaceDeclaration, KindPropertyDeclaration, KindMethodDeclaration, KindGetAccessor, KindSetAccessor } from "../ast/generated/kinds.js";
import { GetDeclarationOfKind, IsGlobalSourceFile, IsExternalModule, IsAmbientModule, IsModuleWithStringLiteralName, IsExternalOrCommonJSModule, IsAccessExpression, IsModuleExportsAccessExpression, IsExportsIdentifier, IsInJSFile, IsExternalModuleImportEqualsDeclaration, IsEntityNameExpression } from "../ast/utilities.js";
import { IsSourceFile, IsClassExpression, IsModuleBlock, IsVariableDeclaration, IsTypeLiteralNode, IsNamespaceExportDeclaration, IsNamespaceExport, IsObjectLiteralExpression } from "../ast/generated/predicates.js";
import { FindAncestor } from "../ast/utilities.js";
import { GetSourceFileOfNode, NodeIsSynthesized } from "../ast/utilities.js";
import { Node_Locals, Node_Initializer, Node_Type, Node_ModuleSpecifier, AsSourceFile, Node_Expression } from "../ast/ast.js";
import type { SourceFile } from "../ast/ast.js";
import { SourceFile_Imports } from "../ast/ast.js";
import type { LinkStore } from "../core/linkstore.js";
import { LinkStore_Get, LinkStore_TryGet } from "../core/linkstore.js";
import { canHaveLocals } from "./utilities.js";
import { getDeclarationsOfKind } from "./utilities.js";
import { Some, FirstNonNil, IfElse } from "../core/core.js";
import type { Checker } from "./checker/state.js";
import { Checker_getMergedSymbol, Checker_getSymbolOfDeclaration, Checker_getExportsOfSymbol, Checker_resolveExternalModuleName, Checker_resolveExternalModuleSymbol, Checker_resolveAlias, Checker_getSymbolFlags, Checker_getParentOfSymbol, Checker_getSymbolIfSameReference, Checker_getDeclaredTypeOfSymbol, Checker_getTypeOfSymbol } from "./checker/symbols.js";
import { Checker_checkExpressionCached } from "./checker/syntax-checking.js";
import { Checker_sortSymbols, Checker_compareSymbolsWorker } from "./utilities.js";
import { Checker_GetEmitResolver } from "./checker/support.js";
import type { EmitResolver } from "./emitresolver.js";
import { EmitResolver_hasVisibleDeclarations } from "./emitresolver.js";
import type { SymbolNodeLinks, ContainingSymbolLinks, Type, accessibleChainCacheKey } from "./types.js";
import { TypeFlagsObject, SymbolFormatFlagsAllowAnyNodeKind } from "./types.js";
import { Type_Symbol } from "./types.js";
import type { SymbolFormatFlags } from "./types.js";
import type { SymbolAccessibilityResult, SymbolAccessibility } from "../printer/emitresolver.js";
import { SymbolAccessibilityAccessible, SymbolAccessibilityNotAccessible, SymbolAccessibilityCannotBeNamed } from "../printer/emitresolver.js";
import { IsBinaryExpression } from "../ast/generated/predicates.js";
import { AsBinaryExpression } from "../ast/generated/casts.js";
import { Checker_symbolToString, Checker_symbolToStringEx } from "./printer.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.IsTypeSymbolAccessible","kind":"method","status":"implemented","sigHash":"440a2ce92fa318d7affc71ef085015b5296f863b84860c64ce4cbc198626c4a9","bodyHash":"b1471e7486983ecf11d899c18aa8c14cddd7dae610557101d1f841c5bf959069"}
 *
 * Go source:
 * func (c *Checker) IsTypeSymbolAccessible(typeSymbol *ast.Symbol, enclosingDeclaration *ast.Node) bool {
 * 	access := c.isSymbolAccessibleWorker(typeSymbol, enclosingDeclaration, ast.SymbolFlagsType /*shouldComputeAliasesToMakeVisible* /, false /*allowModules* /, true)
 * 	return access.Accessibility == printer.SymbolAccessibilityAccessible
 * }
 */
export function Checker_IsTypeSymbolAccessible(receiver: GoPtr<Checker>, typeSymbol: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>): bool {
  const access = Checker_isSymbolAccessibleWorker(receiver, typeSymbol, enclosingDeclaration, SymbolFlagsType /*shouldComputeAliasesToMakeVisible*/, false /*allowModules*/, true);
  return access.Accessibility === SymbolAccessibilityAccessible;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.IsValueSymbolAccessible","kind":"method","status":"implemented","sigHash":"be5158b8179811037e80f5bd92969182dc0884e6f8120d624954af84b056e061","bodyHash":"19327006c7aa497c7849b9ed0538c423e482d879c8fbd7e40a16310ca5c0b7f6"}
 *
 * Go source:
 * func (c *Checker) IsValueSymbolAccessible(symbol *ast.Symbol, enclosingDeclaration *ast.Node) bool {
 * 	access := c.isSymbolAccessibleWorker(symbol, enclosingDeclaration, ast.SymbolFlagsValue /*shouldComputeAliasesToMakeVisible* /, false /*allowModules* /, true)
 * 	return access.Accessibility == printer.SymbolAccessibilityAccessible
 * }
 */
export function Checker_IsValueSymbolAccessible(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>): bool {
  const access = Checker_isSymbolAccessibleWorker(receiver, symbol_, enclosingDeclaration, SymbolFlagsValue /*shouldComputeAliasesToMakeVisible*/, false /*allowModules*/, true);
  return access.Accessibility === SymbolAccessibilityAccessible;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.IsSymbolAccessibleByFlags","kind":"method","status":"implemented","sigHash":"2b43f21e2f45b6c7a63ad8db3295128663dafa3c1c061b659083eb2c40660739","bodyHash":"5a3222ff2f0fcc4f0985625234b779a6ad31dc208680a0c8818a1acc80641eaf"}
 *
 * Go source:
 * func (c *Checker) IsSymbolAccessibleByFlags(symbol *ast.Symbol, enclosingDeclaration *ast.Node, flags ast.SymbolFlags) bool {
 * 	access := c.isSymbolAccessibleWorker(symbol, enclosingDeclaration, flags /*shouldComputeAliasesToMakeVisible* /, false /*allowModules* /, false) // TODO: Strada bug? Why is this allowModules: false?
 * 	return access.Accessibility == printer.SymbolAccessibilityAccessible
 * }
 */
export function Checker_IsSymbolAccessibleByFlags(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, flags: SymbolFlags): bool {
  const access = Checker_isSymbolAccessibleWorker(receiver, symbol_, enclosingDeclaration, flags /*shouldComputeAliasesToMakeVisible*/, false /*allowModules*/, false); // TODO: Strada bug? Why is this allowModules: false?
  return access.Accessibility === SymbolAccessibilityAccessible;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.IsAnySymbolAccessible","kind":"method","status":"implemented","sigHash":"beed5d67cec121ec1a540ab7601fbb7ff790a26d42127607dad889562411aad7","bodyHash":"cba4981de48f601ab510cf1f52b77e7841a1de3ff7c8e6cab71eec98f78e7c28"}
 *
 * Go source:
 * func (c *Checker) IsAnySymbolAccessible(symbols []*ast.Symbol, enclosingDeclaration *ast.Node, initialSymbol *ast.Symbol, meaning ast.SymbolFlags, shouldComputeAliasesToMakeVisible bool, allowModules bool) *printer.SymbolAccessibilityResult {
 * 	if len(symbols) == 0 {
 * 		return nil
 * 	}
 * 
 * 	var hadAccessibleChain *ast.Symbol
 * 	earlyModuleBail := false
 * 	for _, symbol := range symbols {
 * 		// Symbol is accessible if it by itself is accessible
 * 		accessibleSymbolChain := c.getAccessibleSymbolChain(symbol, enclosingDeclaration, meaning /*useOnlyExternalAliasing* /, false)
 * 		if len(accessibleSymbolChain) > 0 {
 * 			hadAccessibleChain = symbol
 * 			// TODO: going through emit resolver here is weird. Relayer these APIs.
 * 			hasAccessibleDeclarations := c.GetEmitResolver().hasVisibleDeclarations(accessibleSymbolChain[0], shouldComputeAliasesToMakeVisible)
 * 			if hasAccessibleDeclarations != nil {
 * 				return hasAccessibleDeclarations
 * 			}
 * 		}
 * 		if allowModules {
 * 			if core.Some(symbol.Declarations, hasNonGlobalAugmentationExternalModuleSymbol) {
 * 				if shouldComputeAliasesToMakeVisible {
 * 					earlyModuleBail = true
 * 					// Generally speaking, we want to use the aliases that already exist to refer to a module, if present
 * 					// In order to do so, we need to find those aliases in order to retain them in declaration emit; so
 * 					// if we are in declaration emit, we cannot use the fast path for module visibility until we've exhausted
 * 					// all other visibility options (in order to capture the possible aliases used to reference the module)
 * 					continue
 * 				}
 * 				// Any meaning of a module symbol is always accessible via an `import` type
 * 				return &printer.SymbolAccessibilityResult{
 * 					Accessibility: printer.SymbolAccessibilityAccessible,
 * 				}
 * 			}
 * 		}
 * 
 * 		// If we haven't got the accessible symbol, it doesn't mean the symbol is actually inaccessible.
 * 		// It could be a qualified symbol and hence verify the path
 * 		// e.g.:
 * 		// module m {
 * 		//     export class c {
 * 		//     }
 * 		// }
 * 		// const x: typeof m.c
 * 		// In the above example when we start with checking if typeof m.c symbol is accessible,
 * 		// we are going to see if c can be accessed in scope directly.
 * 		// But it can't, hence the accessible is going to be undefined, but that doesn't mean m.c is inaccessible
 * 		// It is accessible if the parent m is accessible because then m.c can be accessed through qualification
 * 
 * 		containers := c.getContainersOfSymbol(symbol, enclosingDeclaration, meaning)
 * 		nextMeaning := meaning
 * 		if initialSymbol == symbol {
 * 			nextMeaning = getQualifiedLeftMeaning(meaning)
 * 		}
 * 		parentResult := c.IsAnySymbolAccessible(containers, enclosingDeclaration, initialSymbol, nextMeaning, shouldComputeAliasesToMakeVisible, allowModules)
 * 		if parentResult != nil {
 * 			return parentResult
 * 		}
 * 	}
 * 
 * 	if earlyModuleBail {
 * 		return &printer.SymbolAccessibilityResult{
 * 			Accessibility: printer.SymbolAccessibilityAccessible,
 * 		}
 * 	}
 * 
 * 	if hadAccessibleChain != nil {
 * 		var moduleName string
 * 		if hadAccessibleChain != initialSymbol {
 * 			moduleName = c.symbolToStringEx(hadAccessibleChain, enclosingDeclaration, ast.SymbolFlagsNamespace, SymbolFormatFlagsAllowAnyNodeKind)
 * 		}
 * 		return &printer.SymbolAccessibilityResult{
 * 			Accessibility:   printer.SymbolAccessibilityNotAccessible,
 * 			ErrorSymbolName: c.symbolToStringEx(initialSymbol, enclosingDeclaration, meaning, SymbolFormatFlagsAllowAnyNodeKind),
 * 			ErrorModuleName: moduleName,
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_IsAnySymbolAccessible(receiver: GoPtr<Checker>, symbols: GoSlice<GoPtr<Symbol>>, enclosingDeclaration: GoPtr<Node>, initialSymbol: GoPtr<Symbol>, meaning: SymbolFlags, shouldComputeAliasesToMakeVisible: bool, allowModules: bool): GoPtr<SymbolAccessibilityResult> {
  if (symbols.length === 0) {
    return undefined;
  }

  let hadAccessibleChain: GoPtr<Symbol> = undefined;
  let earlyModuleBail = false;
  for (const symbol_ of symbols) {
    // Symbol is accessible if it by itself is accessible
    const accessibleSymbolChain = Checker_getAccessibleSymbolChain(receiver, symbol_, enclosingDeclaration, meaning /*useOnlyExternalAliasing*/, false);
    if (accessibleSymbolChain.length > 0) {
      hadAccessibleChain = symbol_;
      // TODO: going through emit resolver here is weird. Relayer these APIs.
      const hasAccessibleDeclarations = EmitResolver_hasVisibleDeclarations(Checker_GetEmitResolver(receiver), accessibleSymbolChain[0], shouldComputeAliasesToMakeVisible);
      if (hasAccessibleDeclarations !== undefined) {
        return hasAccessibleDeclarations;
      }
    }
    if (allowModules) {
      if (Some(symbol_!.Declarations, hasNonGlobalAugmentationExternalModuleSymbol)) {
        if (shouldComputeAliasesToMakeVisible) {
          earlyModuleBail = true;
          // Generally speaking, we want to use the aliases that already exist to refer to a module, if present
          // In order to do so, we need to find those aliases in order to retain them in declaration emit; so
          // if we are in declaration emit, we cannot use the fast path for module visibility until we've exhausted
          // all other visibility options (in order to capture the possible aliases used to reference the module)
          continue;
        }
        // Any meaning of a module symbol is always accessible via an `import` type
        return { Accessibility: SymbolAccessibilityAccessible, AliasesToMakeVisible: [], ErrorSymbolName: "", ErrorNode: undefined, ErrorModuleName: "" };
      }
    }

    // If we haven't got the accessible symbol, it doesn't mean the symbol is actually inaccessible.
    // It could be a qualified symbol and hence verify the path
    const containers = Checker_getContainersOfSymbol(receiver, symbol_, enclosingDeclaration, meaning);
    let nextMeaning = meaning;
    if (initialSymbol === symbol_) {
      nextMeaning = getQualifiedLeftMeaning(meaning);
    }
    const parentResult = Checker_IsAnySymbolAccessible(receiver, containers, enclosingDeclaration, initialSymbol, nextMeaning, shouldComputeAliasesToMakeVisible, allowModules);
    if (parentResult !== undefined) {
      return parentResult;
    }
  }

  if (earlyModuleBail) {
    return { Accessibility: SymbolAccessibilityAccessible, AliasesToMakeVisible: [], ErrorSymbolName: "", ErrorNode: undefined, ErrorModuleName: "" };
  }

  if (hadAccessibleChain !== undefined) {
    let moduleName = "";
    if (hadAccessibleChain !== initialSymbol) {
      moduleName = Checker_symbolToStringEx(receiver, hadAccessibleChain, enclosingDeclaration, SymbolFlagsNamespace, SymbolFormatFlagsAllowAnyNodeKind);
    }
    return {
      Accessibility: SymbolAccessibilityNotAccessible,
      AliasesToMakeVisible: [],
      ErrorSymbolName: Checker_symbolToStringEx(receiver, initialSymbol, enclosingDeclaration, meaning, SymbolFormatFlagsAllowAnyNodeKind),
      ErrorModuleName: moduleName,
      ErrorNode: undefined,
    };
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::hasNonGlobalAugmentationExternalModuleSymbol","kind":"func","status":"implemented","sigHash":"8129e08ce073f071d8beb4ae53fe9d8ff8f616c00e36124cff00b653373c2d72","bodyHash":"b1d9bc0ce5945b02f2c97c9debb41ee928935931e8c8f243ee2feb770df67f22"}
 *
 * Go source:
 * func hasNonGlobalAugmentationExternalModuleSymbol(declaration *ast.Node) bool {
 * 	return ast.IsModuleWithStringLiteralName(declaration) || (declaration.Kind == ast.KindSourceFile && ast.IsExternalOrCommonJSModule(declaration.AsSourceFile()))
 * }
 */
export function hasNonGlobalAugmentationExternalModuleSymbol(declaration: GoPtr<Node>): bool {
  return IsModuleWithStringLiteralName(declaration) || (IsSourceFile(declaration) && IsExternalOrCommonJSModule(AsSourceFile(declaration)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::getQualifiedLeftMeaning","kind":"func","status":"implemented","sigHash":"ef67567c8235be554bdb2bf357aa089077414b4f7a37e8276a4babf0e88c2f85","bodyHash":"881405ecbafde53fa48307f6311cb92db16c2059c516bf229904e14476645ce7"}
 *
 * Go source:
 * func getQualifiedLeftMeaning(rightMeaning ast.SymbolFlags) ast.SymbolFlags {
 * 	// If we are looking in value space, the parent meaning is value, other wise it is namespace
 * 	if rightMeaning == ast.SymbolFlagsValue {
 * 		return ast.SymbolFlagsValue
 * 	}
 * 	return ast.SymbolFlagsNamespace
 * }
 */
export function getQualifiedLeftMeaning(rightMeaning: SymbolFlags): SymbolFlags {
  // If we are looking in value space, the parent meaning is value, other wise it is namespace
  if (rightMeaning === SymbolFlagsValue) {
    return SymbolFlagsValue;
  }
  return SymbolFlagsNamespace;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getWithAlternativeContainers","kind":"method","status":"implemented","sigHash":"d43bad3406b231609766cef1db3cae37aa02f0c102c28c832dbbdec04909e62b","bodyHash":"24938ed34ba28154714718d7633dff07b193d24dffc2f5de5259003731258205"}
 *
 * Go source:
 * func (c *Checker) getWithAlternativeContainers(container *ast.Symbol, symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags) []*ast.Symbol {
 * 	additionalContainers := core.MapNonNil(container.Declarations, func(d *ast.Node) *ast.Symbol {
 * 		return c.getFileSymbolIfFileSymbolExportEqualsContainer(d, container)
 * 	})
 * 	var reexportContainers []*ast.Symbol
 * 	if enclosingDeclaration != nil {
 * 		reexportContainers = c.getAlternativeContainingModules(symbol, enclosingDeclaration)
 * 	}
 * 	objectLiteralContainer := c.getVariableDeclarationOfObjectLiteral(container, meaning)
 * 	leftMeaning := getQualifiedLeftMeaning(meaning)
 * 	if enclosingDeclaration != nil &&
 * 		container.Flags&leftMeaning != 0 &&
 * 		len(c.getAccessibleSymbolChain(container, enclosingDeclaration, ast.SymbolFlagsNamespace /*useOnlyExternalAliasing* /, false)) > 0 {
 * 		// This order expresses a preference for the real container if it is in scope
 * 		res := append(append([]*ast.Symbol{container}, additionalContainers...), reexportContainers...)
 * 		if objectLiteralContainer != nil {
 * 			res = append(res, objectLiteralContainer)
 * 		}
 * 		return res
 * 	}
 * 	// we potentially have a symbol which is a member of the instance side of something - look for a variable in scope with the container's type
 * 	// which may be acting like a namespace (eg, `Symbol` acts like a namespace when looking up `Symbol.toStringTag`)
 * 	var variableMatches []*ast.Symbol
 * 	if (meaning == ast.SymbolFlagsValue &&
 * 		container.Flags&leftMeaning == 0) &&
 * 		container.Flags&ast.SymbolFlagsType != 0 &&
 * 		c.getDeclaredTypeOfSymbol(container).flags&TypeFlagsObject != 0 {
 * 		c.someSymbolTableInScope(enclosingDeclaration, func(t ast.SymbolTable, _ symbolTableID, _ bool, _ bool, _ *ast.Node) bool {
 * 			found := false
 * 			for _, s := range t {
 * 				if s.Flags&leftMeaning != 0 && c.getTypeOfSymbol(s) == c.getDeclaredTypeOfSymbol(container) {
 * 					variableMatches = append(variableMatches, s)
 * 					found = true
 * 				}
 * 			}
 * 			return found
 * 		})
 * 		c.sortSymbols(variableMatches)
 * 	}
 * 
 * 	var res []*ast.Symbol
 * 	res = append(res, variableMatches...)
 * 	res = append(res, additionalContainers...)
 * 	res = append(res, container)
 * 	if objectLiteralContainer != nil {
 * 		res = append(res, objectLiteralContainer)
 * 	}
 * 	res = append(res, reexportContainers...)
 * 	return res
 * }
 */
export function Checker_getWithAlternativeContainers(receiver: GoPtr<Checker>, container: GoPtr<Symbol>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags): GoSlice<GoPtr<Symbol>> {
  const additionalContainers: GoSlice<GoPtr<Symbol>> = container!.Declarations?.flatMap((d: GoPtr<Node>) => {
    const s = Checker_getFileSymbolIfFileSymbolExportEqualsContainer(receiver, d, container);
    return s !== undefined ? [s] : [];
  }) ?? [];
  let reexportContainers: GoSlice<GoPtr<Symbol>> = [];
  if (enclosingDeclaration !== undefined) {
    reexportContainers = Checker_getAlternativeContainingModules(receiver, symbol_, enclosingDeclaration);
  }
  const objectLiteralContainer = Checker_getVariableDeclarationOfObjectLiteral(receiver, container, meaning);
  const leftMeaning = getQualifiedLeftMeaning(meaning);
  if (enclosingDeclaration !== undefined &&
    (container!.Flags & leftMeaning) !== 0 &&
    Checker_getAccessibleSymbolChain(receiver, container, enclosingDeclaration, SymbolFlagsNamespace /*useOnlyExternalAliasing*/, false).length > 0) {
    // This order expresses a preference for the real container if it is in scope
    let res: GoSlice<GoPtr<Symbol>> = [container, ...additionalContainers, ...reexportContainers];
    if (objectLiteralContainer !== undefined) {
      res = [...res, objectLiteralContainer];
    }
    return res;
  }
  // we potentially have a symbol which is a member of the instance side of something
  let variableMatches: GoSlice<GoPtr<Symbol>> = [];
  if ((meaning === SymbolFlagsValue &&
    (container!.Flags & leftMeaning) === 0) &&
    (container!.Flags & SymbolFlagsType) !== 0 &&
    (Checker_getDeclaredTypeOfSymbol(receiver, container)!.flags & TypeFlagsObject) !== 0) {
    Checker_someSymbolTableInScope(receiver, enclosingDeclaration, (t: GoPtr<SymbolTable>, _tableId: symbolTableID, _ignoreQ: bool, _isLocal: bool, _node: GoPtr<Node>): bool => {
      let found = false;
      for (const [, s] of t ?? []) {
        if ((s!.Flags & leftMeaning) !== 0 && Checker_getTypeOfSymbol(receiver, s) === Checker_getDeclaredTypeOfSymbol(receiver, container)) {
          variableMatches = [...variableMatches, s];
          found = true;
        }
      }
      return found;
    });
    Checker_sortSymbols(receiver, variableMatches);
  }

  let res: GoSlice<GoPtr<Symbol>> = [...variableMatches, ...additionalContainers, container];
  if (objectLiteralContainer !== undefined) {
    res = [...res, objectLiteralContainer];
  }
  res = [...res, ...reexportContainers];
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getAlternativeContainingModules","kind":"method","status":"implemented","sigHash":"404fc9a75bdf062460afd60963f1242e507fb3f8e8eb389c34c3c1a39abee0e2","bodyHash":"d6933642b32f9d403194d9807caa8b5bc05bbcb200cbb0b1472c5038cca604f3"}
 *
 * Go source:
 * func (c *Checker) getAlternativeContainingModules(symbol *ast.Symbol, enclosingDeclaration *ast.Node) []*ast.Symbol {
 * 	if enclosingDeclaration == nil {
 * 		return nil
 * 	}
 * 	containingFile := ast.GetSourceFileOfNode(enclosingDeclaration)
 * 	id := ast.GetNodeId(containingFile.AsNode())
 * 	links := c.symbolContainerLinks.Get(symbol)
 * 	if links.extendedContainersByFile == nil {
 * 		links.extendedContainersByFile = make(map[ast.NodeId][]*ast.Symbol)
 * 	}
 * 	existing, ok := links.extendedContainersByFile[id]
 * 	if ok && existing != nil {
 * 		return existing
 * 	}
 * 	var results []*ast.Symbol
 * 	if len(containingFile.Imports()) > 0 {
 * 		// Try to make an import using an import already in the enclosing file, if possible
 * 		for _, importRef := range containingFile.Imports() {
 * 			if ast.NodeIsSynthesized(importRef) {
 * 				// Synthetic names can't be resolved by `resolveExternalModuleName` - they'll cause a debug assert if they error
 * 				continue
 * 			}
 * 			resolvedModule := c.resolveExternalModuleName(enclosingDeclaration, importRef /*ignoreErrors* /, true)
 * 			if resolvedModule == nil {
 * 				continue
 * 			}
 * 			ref := c.getAliasForSymbolInContainer(resolvedModule, symbol)
 * 			if ref == nil {
 * 				continue
 * 			}
 * 			results = append(results, resolvedModule)
 * 		}
 * 		if len(results) > 0 {
 * 			links.extendedContainersByFile[id] = results
 * 			return results
 * 		}
 * 	}
 * 
 * 	if links.extendedContainers != nil {
 * 		return *links.extendedContainers
 * 	}
 * 	// No results from files already being imported by this file - expand search (expensive, but not location-specific, so cached)
 * 	otherFiles := c.program.SourceFiles()
 * 	for _, file := range otherFiles {
 * 		if !ast.IsExternalModule(file) {
 * 			continue
 * 		}
 * 		sym := c.getSymbolOfDeclaration(file.AsNode())
 * 		ref := c.getAliasForSymbolInContainer(sym, symbol)
 * 		if ref == nil {
 * 			continue
 * 		}
 * 		results = append(results, sym)
 * 	}
 * 	links.extendedContainers = &results
 * 	return results
 * }
 */
export function Checker_getAlternativeContainingModules(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>): GoSlice<GoPtr<Symbol>> {
  if (enclosingDeclaration === undefined) {
    return [];
  }
  const containingFile = GetSourceFileOfNode(enclosingDeclaration);
  const id = GetNodeId(containingFile as unknown as GoPtr<Node>);
  const links = LinkStore_Get<GoPtr<Symbol>, ContainingSymbolLinks>(receiver!.symbolContainerLinks as unknown as LinkStore<GoPtr<Symbol>, ContainingSymbolLinks>, symbol_) as ContainingSymbolLinks;
  if (links.extendedContainersByFile === undefined) {
    links.extendedContainersByFile = new globalThis.Map<NodeId, GoSlice<GoPtr<Symbol>>>();
  }
  const existing = links.extendedContainersByFile.get(id);
  if (existing !== undefined) {
    return existing;
  }
  let results: GoSlice<GoPtr<Symbol>> = [];
  const imports = SourceFile_Imports(containingFile as unknown as GoPtr<SourceFile>);
  if (imports !== undefined && imports.length > 0) {
    // Try to make an import using an import already in the enclosing file, if possible
    for (const importRef of imports) {
      if (NodeIsSynthesized(importRef)) {
        // Synthetic names can't be resolved by `resolveExternalModuleName` - they'll cause a debug assert if they error
        continue;
      }
      const resolvedModule = Checker_resolveExternalModuleName(receiver, enclosingDeclaration, importRef /*ignoreErrors*/, true);
      if (resolvedModule === undefined) {
        continue;
      }
      const ref = Checker_getAliasForSymbolInContainer(receiver, resolvedModule, symbol_);
      if (ref === undefined) {
        continue;
      }
      results = [...results, resolvedModule];
    }
    if (results.length > 0) {
      links.extendedContainersByFile.set(id, results);
      return results;
    }
  }

  if (links.extendedContainers !== undefined) {
    return links.extendedContainers;
  }
  // No results from files already being imported by this file - expand search (expensive, but not location-specific, so cached)
  const otherFiles = receiver!.files;
  for (const file of otherFiles) {
    if (!IsExternalModule(file)) {
      continue;
    }
      const sym = Checker_getSymbolOfDeclaration(receiver, file as unknown as GoPtr<Node>);
    const ref = Checker_getAliasForSymbolInContainer(receiver, sym, symbol_);
    if (ref === undefined) {
      continue;
    }
    results = [...results, sym];
  }
  links.extendedContainers = results;
  return results;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getVariableDeclarationOfObjectLiteral","kind":"method","status":"implemented","sigHash":"02cc306de5f465be22092f68907a8883eedcde6f2e737172bbfb65430c1f8b53","bodyHash":"1f66a97aad34d92190d2346aab872a3a694510cbf2bc5dd1292c3786a9dfa7fc"}
 *
 * Go source:
 * func (c *Checker) getVariableDeclarationOfObjectLiteral(symbol *ast.Symbol, meaning ast.SymbolFlags) *ast.Symbol {
 * 	// If we're trying to reference some object literal in, eg `var a = { x: 1 }`, the symbol for the literal, `__object`, is distinct
 * 	// from the symbol of the declaration it is being assigned to. Since we can use the declaration to refer to the literal, however,
 * 	// we'd like to make that connection here - potentially causing us to paint the declaration's visibility, and therefore the literal.
 * 	if meaning&ast.SymbolFlagsValue == 0 {
 * 		return nil
 * 	}
 * 	if len(symbol.Declarations) == 0 {
 * 		return nil
 * 	}
 * 	firstDecl := symbol.Declarations[0]
 * 	if firstDecl.Parent == nil {
 * 		return nil
 * 	}
 * 	if !ast.IsVariableDeclaration(firstDecl.Parent) {
 * 		return nil
 * 	}
 * 	if ast.IsObjectLiteralExpression(firstDecl) && firstDecl == firstDecl.Parent.Initializer() || ast.IsTypeLiteralNode(firstDecl) && firstDecl == firstDecl.Parent.Type() {
 * 		return c.getSymbolOfDeclaration(firstDecl.Parent)
 * 	}
 * 	return nil
 * }
 */
export function Checker_getVariableDeclarationOfObjectLiteral(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, meaning: SymbolFlags): GoPtr<Symbol> {
  // If we're trying to reference some object literal in, eg `var a = { x: 1 }`, the symbol for the literal, `__object`, is distinct
  // from the symbol of the declaration it is being assigned to. Since we can use the declaration to refer to the literal, however,
  // we'd like to make that connection here - potentially causing us to paint the declaration's visibility, and therefore the literal.
  if ((meaning & SymbolFlagsValue) === 0) {
    return undefined;
  }
  if (symbol_!.Declarations === undefined || symbol_!.Declarations.length === 0) {
    return undefined;
  }
  const firstDecl = symbol_!.Declarations[0];
  if (firstDecl!.Parent === undefined) {
    return undefined;
  }
  if (!IsVariableDeclaration(firstDecl!.Parent)) {
    return undefined;
  }
  if (IsObjectLiteralExpression(firstDecl) && firstDecl === Node_Initializer(firstDecl!.Parent) || IsTypeLiteralNode(firstDecl) && firstDecl === Node_Type(firstDecl!.Parent)) {
    return Checker_getSymbolOfDeclaration(receiver, firstDecl!.Parent);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::hasExternalModuleSymbol","kind":"func","status":"implemented","sigHash":"59984e628de83074fabf37810f41cbe9c02eb70a7f319ca6d9844823817fbe96","bodyHash":"ee14558b9dd055b3b0881e4038149c85e05898eaf6d9b179e3b40df79add80fe"}
 *
 * Go source:
 * func hasExternalModuleSymbol(declaration *ast.Node) bool {
 * 	return ast.IsAmbientModule(declaration) || (declaration.Kind == ast.KindSourceFile && ast.IsExternalOrCommonJSModule(declaration.AsSourceFile()))
 * }
 */
export function hasExternalModuleSymbol(declaration: GoPtr<Node>): bool {
  return IsAmbientModule(declaration) || (IsSourceFile(declaration) && IsExternalOrCommonJSModule(AsSourceFile(declaration)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getExternalModuleContainer","kind":"method","status":"implemented","sigHash":"e2d1237f8c8aca720b5ae222e1fed2087d80607e17abd5b920530250aefa921d","bodyHash":"b8e36d4404edc37ddcdc67dca53a7c40b98c592ed80379bc9894e1a24700b360"}
 *
 * Go source:
 * func (c *Checker) getExternalModuleContainer(declaration *ast.Node) *ast.Symbol {
 * 	node := ast.FindAncestor(declaration, hasExternalModuleSymbol)
 * 	if node == nil {
 * 		return nil
 * 	}
 * 	return c.getSymbolOfDeclaration(node)
 * }
 */
export function Checker_getExternalModuleContainer(receiver: GoPtr<Checker>, declaration: GoPtr<Node>): GoPtr<Symbol> {
  const node = FindAncestor(declaration, hasExternalModuleSymbol);
  if (node === undefined) {
    return undefined;
  }
  return Checker_getSymbolOfDeclaration(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getFileSymbolIfFileSymbolExportEqualsContainer","kind":"method","status":"implemented","sigHash":"befb72be60014d41f88e29b266894e20c680085e16f7c8034c3624a334f71368","bodyHash":"7ac93a6e290c0996db73951438f25a5e7f9a5211d610569d3b5bee90077d6248"}
 *
 * Go source:
 * func (c *Checker) getFileSymbolIfFileSymbolExportEqualsContainer(d *ast.Node, container *ast.Symbol) *ast.Symbol {
 * 	fileSymbol := c.getExternalModuleContainer(d)
 * 	if fileSymbol == nil || fileSymbol.Exports == nil {
 * 		return nil
 * 	}
 * 	exported, ok := fileSymbol.Exports[ast.InternalSymbolNameExportEquals]
 * 	if !ok || exported == nil {
 * 		return nil
 * 	}
 * 	if c.getSymbolIfSameReference(exported, container) != nil {
 * 		return fileSymbol
 * 	}
 * 	return nil
 * }
 */
export function Checker_getFileSymbolIfFileSymbolExportEqualsContainer(receiver: GoPtr<Checker>, d: GoPtr<Node>, container: GoPtr<Symbol>): GoPtr<Symbol> {
  const fileSymbol = Checker_getExternalModuleContainer(receiver, d);
  if (fileSymbol === undefined || fileSymbol!.Exports === undefined) {
    return undefined;
  }
  const exported = fileSymbol!.Exports.get(InternalSymbolNameExportEquals);
  if (exported === undefined) {
    return undefined;
  }
  if (Checker_getSymbolIfSameReference(receiver, exported, container) !== undefined) {
    return fileSymbol;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getContainersOfSymbol","kind":"method","status":"implemented","sigHash":"d3d5199afeef6ea00c449a490b60a240a609f5d8d6a743236052752a804a0501","bodyHash":"7667bdbbcfca1d405becd9e5f4f5f4b9a7e14b340c8d7bc75e564f2444568047"}
 *
 * Go source:
 * func (c *Checker) getContainersOfSymbol(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags) []*ast.Symbol {
 * 	container := c.getParentOfSymbol(symbol)
 * 	// Type parameters end up in the `members` lists but are not externally visible
 * 	if container != nil && (symbol.Flags&ast.SymbolFlagsTypeParameter == 0) {
 * 		return c.getWithAlternativeContainers(container, symbol, enclosingDeclaration, meaning)
 * 	}
 * 	var candidates []*ast.Symbol
 * 	for _, d := range symbol.Declarations {
 * 		if !ast.IsAmbientModule(d) && d.Parent != nil {
 * 			// direct children of a module
 * 			if hasNonGlobalAugmentationExternalModuleSymbol(d.Parent) {
 * 				sym := c.getSymbolOfDeclaration(d.Parent)
 * 				if sym != nil && !slices.Contains(candidates, sym) {
 * 					candidates = append(candidates, sym)
 * 				}
 * 				continue
 * 			}
 * 			// export ='d member of an ambient module
 * 			if ast.IsModuleBlock(d.Parent) && d.Parent.Parent != nil && c.resolveExternalModuleSymbol(c.getSymbolOfDeclaration(d.Parent.Parent), false) == symbol {
 * 				sym := c.getSymbolOfDeclaration(d.Parent.Parent)
 * 				if sym != nil && !slices.Contains(candidates, sym) {
 * 					candidates = append(candidates, sym)
 * 				}
 * 				continue
 * 			}
 * 		}
 * 		if ast.IsClassExpression(d) && ast.IsBinaryExpression(d.Parent) && d.Parent.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken && ast.IsAccessExpression(d.Parent.AsBinaryExpression().Left) && ast.IsEntityNameExpression(d.Parent.AsBinaryExpression().Left.Expression()) {
 * 			if ast.IsModuleExportsAccessExpression(d.Parent.AsBinaryExpression().Left) || ast.IsExportsIdentifier(d.Parent.AsBinaryExpression().Left.Expression()) {
 * 				sym := c.getSymbolOfDeclaration(ast.GetSourceFileOfNode(d).AsNode())
 * 				if sym != nil && !slices.Contains(candidates, sym) {
 * 					candidates = append(candidates, sym)
 * 				}
 * 				continue
 * 			}
 * 			c.checkExpressionCached(d.Parent.AsBinaryExpression().Left.Expression())
 * 			sym := c.symbolNodeLinks.Get(d.Parent.AsBinaryExpression().Left.Expression()).resolvedSymbol
 * 			if sym != nil && !slices.Contains(candidates, sym) {
 * 				candidates = append(candidates, sym)
 * 			}
 * 			continue
 * 		}
 * 	}
 * 	if len(candidates) == 0 {
 * 		return nil
 * 	}
 * 
 * 	var bestContainers []*ast.Symbol
 * 	var alternativeContainers []*ast.Symbol
 * 	for _, container := range candidates {
 * 		if c.getAliasForSymbolInContainer(container, symbol) == nil {
 * 			continue
 * 		}
 * 		allAlts := c.getWithAlternativeContainers(container, symbol, enclosingDeclaration, meaning)
 * 		if len(allAlts) == 0 {
 * 			continue
 * 		}
 * 		bestContainers = append(bestContainers, allAlts[0])
 * 		alternativeContainers = append(alternativeContainers, allAlts[1:]...)
 * 	}
 * 	return append(bestContainers, alternativeContainers...)
 * }
 */
export function Checker_getContainersOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags): GoSlice<GoPtr<Symbol>> {
  const container = Checker_getParentOfSymbol(receiver, symbol_);
  // Type parameters end up in the `members` lists but are not externally visible
  if (container !== undefined && (symbol_!.Flags & SymbolFlagsTypeParameter) === 0) {
    return Checker_getWithAlternativeContainers(receiver, container, symbol_, enclosingDeclaration, meaning);
  }
  let candidates: GoSlice<GoPtr<Symbol>> = [];
  for (const d of (symbol_!.Declarations ?? [])) {
    if (!IsAmbientModule(d) && d!.Parent !== undefined) {
      // direct children of a module
      if (hasNonGlobalAugmentationExternalModuleSymbol(d!.Parent)) {
        const sym = Checker_getSymbolOfDeclaration(receiver, d!.Parent);
        if (sym !== undefined && !candidates.includes(sym)) {
          candidates = [...candidates, sym];
        }
        continue;
      }
      // export ='d member of an ambient module
      if (IsModuleBlock(d!.Parent) && d!.Parent!.Parent !== undefined && Checker_resolveExternalModuleSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, d!.Parent!.Parent), false) === symbol_) {
        const sym = Checker_getSymbolOfDeclaration(receiver, d!.Parent!.Parent);
        if (sym !== undefined && !candidates.includes(sym)) {
          candidates = [...candidates, sym];
        }
        continue;
      }
    }
    if (IsClassExpression(d) && IsBinaryExpression(d!.Parent) && AsBinaryExpression(d!.Parent)!.OperatorToken!.Kind === KindEqualsToken && IsAccessExpression(AsBinaryExpression(d!.Parent)!.Left) && IsEntityNameExpression(Node_Expression(AsBinaryExpression(d!.Parent)!.Left))) {
      if (IsModuleExportsAccessExpression(AsBinaryExpression(d!.Parent)!.Left) || IsExportsIdentifier(Node_Expression(AsBinaryExpression(d!.Parent)!.Left))) {
        const sym = Checker_getSymbolOfDeclaration(receiver, GetSourceFileOfNode(d) as unknown as GoPtr<Node>);
        if (sym !== undefined && !candidates.includes(sym)) {
          candidates = [...candidates, sym];
        }
        continue;
      }
      Checker_checkExpressionCached(receiver, Node_Expression(AsBinaryExpression(d!.Parent)!.Left));
      const sym = (LinkStore_Get<GoPtr<Node>, SymbolNodeLinks>(receiver!.symbolNodeLinks as unknown as LinkStore<GoPtr<Node>, SymbolNodeLinks>, Node_Expression(AsBinaryExpression(d!.Parent)!.Left)) as SymbolNodeLinks).resolvedSymbol as GoPtr<Symbol>;
      if (sym !== undefined && !candidates.includes(sym)) {
        candidates = [...candidates, sym];
      }
      continue;
    }
  }
  if (candidates.length === 0) {
    return [];
  }

  let bestContainers: GoSlice<GoPtr<Symbol>> = [];
  let alternativeContainers: GoSlice<GoPtr<Symbol>> = [];
  for (const cont of candidates) {
    if (Checker_getAliasForSymbolInContainer(receiver, cont, symbol_) === undefined) {
      continue;
    }
    const allAlts = Checker_getWithAlternativeContainers(receiver, cont, symbol_, enclosingDeclaration, meaning);
    if (allAlts.length === 0) {
      continue;
    }
    bestContainers = [...bestContainers, allAlts[0]];
    alternativeContainers = [...alternativeContainers, ...allAlts.slice(1)];
  }
  return [...bestContainers, ...alternativeContainers];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getAliasForSymbolInContainer","kind":"method","status":"implemented","sigHash":"99403912a0c86db211698ae264120df15b857203f91cf2b2bb83f41b026ff846","bodyHash":"f53d9e2d95f2803443e26bbe8d691bdfc3942ae7798363054268da1087e2bdac"}
 *
 * Go source:
 * func (c *Checker) getAliasForSymbolInContainer(container *ast.Symbol, symbol *ast.Symbol) *ast.Symbol {
 * 	if container == c.getParentOfSymbol(symbol) {
 * 		// fast path, `symbol` is either already the alias or isn't aliased
 * 		return symbol
 * 	}
 * 	// Check if container is a thing with an `export=` which points directly at `symbol`, and if so, return
 * 	// the container itself as the alias for the symbol
 * 	if container.Exports != nil {
 * 		exportEquals, ok := container.Exports[ast.InternalSymbolNameExportEquals]
 * 		if ok && exportEquals != nil && c.getSymbolIfSameReference(exportEquals, symbol) != nil {
 * 			return container
 * 		}
 * 	}
 * 	exports := c.getExportsOfSymbol(container)
 * 	quick, ok := exports[symbol.Name]
 * 	if ok && quick != nil && c.getSymbolIfSameReference(quick, symbol) != nil {
 * 		return quick
 * 	}
 * 	var candidates []*ast.Symbol
 * 	for _, exported := range exports {
 * 		if c.getSymbolIfSameReference(exported, symbol) != nil {
 * 			candidates = append(candidates, exported)
 * 		}
 * 	}
 * 	if len(candidates) > 0 {
 * 		c.sortSymbols(candidates) // _must_ sort exports for stable results - symbol table is randomly iterated
 * 		return candidates[0]
 * 	}
 * 	return nil
 * }
 */
export function Checker_getAliasForSymbolInContainer(receiver: GoPtr<Checker>, container: GoPtr<Symbol>, symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  if (container === Checker_getParentOfSymbol(receiver, symbol_)) {
    // fast path, `symbol` is either already the alias or isn't aliased
    return symbol_;
  }
  // Check if container is a thing with an `export=` which points directly at `symbol`, and if so, return
  // the container itself as the alias for the symbol
  if (container!.Exports !== undefined) {
    const exportEquals = container!.Exports.get(InternalSymbolNameExportEquals);
    if (exportEquals !== undefined && Checker_getSymbolIfSameReference(receiver, exportEquals, symbol_) !== undefined) {
      return container;
    }
  }
  const exports_ = Checker_getExportsOfSymbol(receiver, container);
  const quick = exports_?.get(symbol_!.Name);
  if (quick !== undefined && Checker_getSymbolIfSameReference(receiver, quick, symbol_) !== undefined) {
    return quick;
  }
  let candidates: GoSlice<GoPtr<Symbol>> = [];
  for (const [, exported] of exports_ ?? []) {
    if (Checker_getSymbolIfSameReference(receiver, exported, symbol_) !== undefined) {
      candidates = [...candidates, exported];
    }
  }
  if (candidates.length > 0) {
    Checker_sortSymbols(receiver, candidates); // _must_ sort exports for stable results
    return candidates[0];
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getAccessibleSymbolChain","kind":"method","status":"implemented","sigHash":"3172e3df25a783c2b929528a807d80632d5b7f4a320b4e62d8832750c801cf1a","bodyHash":"eaeaa2f57dde7fcad336d2ca771ff7d84d9dab9d34bd7d2c95c02e60a3a1152b"}
 *
 * Go source:
 * func (c *Checker) getAccessibleSymbolChain(
 * 	symbol *ast.Symbol,
 * 	enclosingDeclaration *ast.Node,
 * 	meaning ast.SymbolFlags,
 * 	useOnlyExternalAliasing bool,
 * ) []*ast.Symbol {
 * 	return c.getAccessibleSymbolChainEx(accessibleSymbolChainContext{symbol, enclosingDeclaration, meaning, useOnlyExternalAliasing, make(map[ast.SymbolId]map[symbolTableID]struct{})})
 * }
 */
export function Checker_getAccessibleSymbolChain(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, useOnlyExternalAliasing: bool): GoSlice<GoPtr<Symbol>> {
  return Checker_getAccessibleSymbolChainEx(receiver, { symbol: symbol_, enclosingDeclaration, meaning, useOnlyExternalAliasing, visitedSymbolTablesMap: new globalThis.Map() });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.GetAccessibleSymbolChain","kind":"method","status":"implemented","sigHash":"e490d9286680028af20d9e205971511e00cb6058a2965fc7209c73134ce4b83d","bodyHash":"78f5f607f847a36a983669e0c3c5dadd027d0f9c7dbfeeac132788b00f280516"}
 *
 * Go source:
 * func (c *Checker) GetAccessibleSymbolChain(
 * 	symbol *ast.Symbol,
 * 	enclosingDeclaration *ast.Node,
 * 	meaning ast.SymbolFlags,
 * 	useOnlyExternalAliasing bool,
 * ) []*ast.Symbol {
 * 	return c.getAccessibleSymbolChain(symbol, enclosingDeclaration, meaning, useOnlyExternalAliasing)
 * }
 */
export function Checker_GetAccessibleSymbolChain(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, useOnlyExternalAliasing: bool): GoSlice<GoPtr<Symbol>> {
  return Checker_getAccessibleSymbolChain(receiver, symbol_, enclosingDeclaration, meaning, useOnlyExternalAliasing);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::type::accessibleSymbolChainContext","kind":"type","status":"implemented","sigHash":"3e04eabddf95b2b08160376186b51804f33d8ef7a2d2575c9939183f645f7824","bodyHash":"9617e087602d543fb795e4df6414c0795002402cc2dc8150d045f374d6de713f"}
 *
 * Go source:
 * accessibleSymbolChainContext struct {
 * 	symbol                  *ast.Symbol
 * 	enclosingDeclaration    *ast.Node
 * 	meaning                 ast.SymbolFlags
 * 	useOnlyExternalAliasing bool
 * 	visitedSymbolTablesMap  map[ast.SymbolId]map[symbolTableID]struct{}
 * }
 */
export interface accessibleSymbolChainContext {
  "symbol": GoPtr<Symbol>;
  enclosingDeclaration: GoPtr<Node>;
  meaning: SymbolFlags;
  useOnlyExternalAliasing: bool;
  visitedSymbolTablesMap: GoMap<SymbolId, GoMap<symbolTableID, { readonly __tsgoEmpty?: never }>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::type::symbolTableID","kind":"type","status":"implemented","sigHash":"7d916951f176c6805edfce9e2d5f9dac91e7f93f5cac7779cbd82c2eebe07a68","bodyHash":"e4d8f17a06214af5cbb86cf016de038b56ad098083e7441de2dd69142d2594a4"}
 *
 * Go source:
 * symbolTableID uint64
 */
export type symbolTableID = ulong;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::constGroup::stKindLocals+stKindExports+stKindMembers+stKindGlobals","kind":"constGroup","status":"implemented","sigHash":"7ca064d9b66995f10029dfbebec5241acbecb873728f7296d6ae96581e63a850","bodyHash":"04c7ca4fdf36a5629103d7c34acec9e76b4341fb830b599e5352755523d00cad"}
 *
 * Go source:
 * const (
 * 	stKindLocals symbolTableID = iota << 62
 * 	stKindExports
 * 	stKindMembers
 * 	stKindGlobals
 * )
 */
export const stKindLocals: symbolTableID = 0; // 0 << 62
export const stKindExports: symbolTableID = 0x4000000000000000; // 1 << 62
export const stKindMembers: symbolTableID = 0x8000000000000000; // 2 << 62
export const stKindGlobals: symbolTableID = 0xC000000000000000; // 3 << 62

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::symbolTableIDFromLocals","kind":"func","status":"implemented","sigHash":"ddb7a7e67dd745b636984a46c8f2c498d351cc6dce505161c74f29c31d7e90af","bodyHash":"f1a25251eb4bacfe964a69e28ec6e9fee67838fed9495d42726dce8982ae5366"}
 *
 * Go source:
 * func symbolTableIDFromLocals(node *ast.Node) symbolTableID {
 * 	return stKindLocals | symbolTableID(ast.GetNodeId(node))
 * }
 */
export function symbolTableIDFromLocals(node: GoPtr<Node>): symbolTableID {
  return stKindLocals | GetNodeId(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::symbolTableIDFromExports","kind":"func","status":"implemented","sigHash":"4995e36ac1e761b27fc93851b47bf1d3e2ae49faf903b296aa28e25660a864da","bodyHash":"42779ececd912743e17aa050db649e2a7d987eb201063d59abe5c5333a428b98"}
 *
 * Go source:
 * func symbolTableIDFromExports(sym *ast.Symbol) symbolTableID {
 * 	return stKindExports | symbolTableID(ast.GetSymbolId(sym))
 * }
 */
export function symbolTableIDFromExports(sym: GoPtr<Symbol>): symbolTableID {
  return stKindExports | GetSymbolId(sym);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::symbolTableIDFromMembers","kind":"func","status":"implemented","sigHash":"47c1c84e17b88965d2ee097c8bc642e9dcd0e50066b0a3cad374edb045dc93a1","bodyHash":"b94ea1b0ec0a646154b7617626803d5a27b74de7f053b423d976612c1ca0bc88"}
 *
 * Go source:
 * func symbolTableIDFromMembers(sym *ast.Symbol) symbolTableID {
 * 	return stKindMembers | symbolTableID(ast.GetSymbolId(sym))
 * }
 */
export function symbolTableIDFromMembers(sym: GoPtr<Symbol>): symbolTableID {
  return stKindMembers | GetSymbolId(sym);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::symbolTableIDFromGlobals","kind":"func","status":"implemented","sigHash":"463d80b9eb71617ad3dcd3c08273a8d74ead1edf82754ac66fe866fa17edad96","bodyHash":"7826fb603bfc8a2a17ba2da54efe69e43bb9018dd3cdba4655a7b2792714551a"}
 *
 * Go source:
 * func symbolTableIDFromGlobals() symbolTableID {
 * 	return stKindGlobals
 * }
 */
export function symbolTableIDFromGlobals(): symbolTableID {
  return stKindGlobals;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getAccessibleSymbolChainEx","kind":"method","status":"implemented","sigHash":"43140cf3dfdb279f973bd87b28695e1c40dfd905cf03858721b7f3352b2a1ef5","bodyHash":"8be8db14e509306f75b69b57c53e96db6b895f8aca3d8c7546adcffe695411dd"}
 *
 * Go source:
 * func (c *Checker) getAccessibleSymbolChainEx(ctx accessibleSymbolChainContext) []*ast.Symbol {
 * 	if ctx.symbol == nil {
 * 		return nil
 * 	}
 * 	if isPropertyOrMethodDeclarationSymbol(ctx.symbol) {
 * 		return nil
 * 	}
 * 	// Go from enclosingDeclaration to the first scope we check, so the cache is keyed off the scope and thus shared more
 * 	var firstRelevantLocation *ast.Node
 * 	c.someSymbolTableInScope(ctx.enclosingDeclaration, func(_ ast.SymbolTable, _ symbolTableID, _ bool, _ bool, node *ast.Node) bool {
 * 		firstRelevantLocation = node
 * 		return true
 * 	})
 * 	links := c.symbolContainerLinks.Get(ctx.symbol)
 * 	linkKey := accessibleChainCacheKey{ctx.useOnlyExternalAliasing, firstRelevantLocation, ctx.meaning}
 * 	if links.accessibleChainCache == nil {
 * 		links.accessibleChainCache = make(map[accessibleChainCacheKey][]*ast.Symbol)
 * 	}
 * 	existing, ok := links.accessibleChainCache[linkKey]
 * 	if ok {
 * 		return existing
 * 	}
 * 
 * 	var result []*ast.Symbol
 * 
 * 	c.someSymbolTableInScope(ctx.enclosingDeclaration, func(t ast.SymbolTable, tableId symbolTableID, ignoreQualification bool, isLocalNameLookup bool, _ *ast.Node) bool {
 * 		res := c.getAccessibleSymbolChainFromSymbolTable(ctx, t, tableId, ignoreQualification, isLocalNameLookup)
 * 		if len(res) > 0 {
 * 			result = res
 * 			return true
 * 		}
 * 		return false
 * 	})
 * 	links.accessibleChainCache[linkKey] = result
 * 	return result
 * }
 */
export function Checker_getAccessibleSymbolChainEx(receiver: GoPtr<Checker>, ctx: accessibleSymbolChainContext): GoSlice<GoPtr<Symbol>> {
  if (ctx.symbol === undefined) {
    return [];
  }
  if (isPropertyOrMethodDeclarationSymbol(ctx.symbol)) {
    return [];
  }
  // Go from enclosingDeclaration to the first scope we check, so the cache is keyed off the scope and thus shared more
  let firstRelevantLocation: GoPtr<Node> = undefined;
  Checker_someSymbolTableInScope(receiver, ctx.enclosingDeclaration, (_t: GoPtr<SymbolTable>, _tableId: symbolTableID, _iq: bool, _il: bool, node: GoPtr<Node>): bool => {
    firstRelevantLocation = node;
    return true;
  });
  const links = LinkStore_Get<GoPtr<Symbol>, ContainingSymbolLinks>(receiver!.symbolContainerLinks as unknown as LinkStore<GoPtr<Symbol>, ContainingSymbolLinks>, ctx.symbol) as ContainingSymbolLinks;
  const linkKey: accessibleChainCacheKey = { useOnlyExternalAliasing: ctx.useOnlyExternalAliasing, location: firstRelevantLocation, meaning: ctx.meaning };
  if (links.accessibleChainCache === undefined) {
    links.accessibleChainCache = NewGoStructMap<accessibleChainCacheKey, GoSlice<GoPtr<Symbol>>>();
  }
  const existing = links.accessibleChainCache.get(linkKey);
  if (existing !== undefined) {
    return existing;
  }

  let result: GoSlice<GoPtr<Symbol>> = [];

  Checker_someSymbolTableInScope(receiver, ctx.enclosingDeclaration, (t: GoPtr<SymbolTable>, tableId: symbolTableID, ignoreQualification: bool, isLocalNameLookup: bool, _node: GoPtr<Node>): bool => {
    const res = Checker_getAccessibleSymbolChainFromSymbolTable(receiver, ctx, t, tableId, ignoreQualification, isLocalNameLookup);
    if (res.length > 0) {
      result = res;
      return true;
    }
    return false;
  });
  links.accessibleChainCache.set(linkKey, result);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getAccessibleSymbolChainFromSymbolTable","kind":"method","status":"implemented","sigHash":"50288451713710d32338473d9fa4cac13be1b87024fe2aaec0a29e9af5be3e82","bodyHash":"e69c17642d0e1960fe2276948e6846da691a2cbc2aa434b2aa3149eca7a7fd62"}
 *
 * Go source:
 * func (c *Checker) getAccessibleSymbolChainFromSymbolTable(ctx accessibleSymbolChainContext, t ast.SymbolTable, tableId symbolTableID, ignoreQualification bool, isLocalNameLookup bool) []*ast.Symbol {
 * 	symId := ast.GetSymbolId(ctx.symbol)
 * 	visitedSymbolTables, ok := ctx.visitedSymbolTablesMap[symId]
 * 	if !ok {
 * 		visitedSymbolTables = make(map[symbolTableID]struct{})
 * 		ctx.visitedSymbolTablesMap[symId] = visitedSymbolTables
 * 	}
 * 
 * 	_, present := visitedSymbolTables[tableId]
 * 	if present {
 * 		return nil
 * 	}
 * 	visitedSymbolTables[tableId] = struct{}{}
 * 
 * 	res := c.trySymbolTable(ctx, t, tableId == stKindGlobals, ignoreQualification, isLocalNameLookup)
 * 
 * 	delete(visitedSymbolTables, tableId)
 * 	return res
 * }
 */
export function Checker_getAccessibleSymbolChainFromSymbolTable(receiver: GoPtr<Checker>, ctx: accessibleSymbolChainContext, t: GoPtr<SymbolTable>, tableId: symbolTableID, ignoreQualification: bool, isLocalNameLookup: bool): GoSlice<GoPtr<Symbol>> {
  const symId = GetSymbolId(ctx.symbol);
  let visitedSymbolTables = ctx.visitedSymbolTablesMap.get(symId);
  if (visitedSymbolTables === undefined) {
    visitedSymbolTables = new globalThis.Map<symbolTableID, { readonly __tsgoEmpty?: never }>();
    ctx.visitedSymbolTablesMap.set(symId, visitedSymbolTables);
  }

  if (visitedSymbolTables.has(tableId)) {
    return [];
  }
  visitedSymbolTables.set(tableId, {});

  const res = Checker_trySymbolTable(receiver, ctx, t, tableId === stKindGlobals, ignoreQualification, isLocalNameLookup);

  visitedSymbolTables.delete(tableId);
  return res;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.trySymbolTable","kind":"method","status":"implemented","sigHash":"42387c2d716f9c91e6813fbaa6bb2873344a2527fafd22b79de20bc2fb495dc0","bodyHash":"ea4d64e757efe4564d9ebf33cfa400b2ffdad30b0b2b2be2746fa270199a5e7a"}
 *
 * Go source:
 * func (c *Checker) trySymbolTable(
 * 	ctx accessibleSymbolChainContext,
 * 	symbols ast.SymbolTable,
 * 	isGlobals bool,
 * 	ignoreQualification bool,
 * 	isLocalNameLookup bool,
 * ) []*ast.Symbol {
 * 	// If symbol is directly available by its name in the symbol table
 * 	res, ok := symbols[ctx.symbol.Name]
 * 	if ok && res != nil && c.isAccessible(ctx, res /*resolvedAliasSymbol* /, nil, ignoreQualification) {
 * 		return []*ast.Symbol{ctx.symbol}
 * 	}
 * 
 * 	var candidateChains [][]*ast.Symbol
 * 	// collect all possible chains to sort them and return the shortest/best
 * 	for _, symbolFromSymbolTable := range symbols {
 * 		// for every non-default, non-export= alias symbol in scope, check if it refers to or can chain to the target symbol
 * 		if symbolFromSymbolTable.Flags&ast.SymbolFlagsAlias != 0 &&
 * 			symbolFromSymbolTable.Name != ast.InternalSymbolNameExportEquals &&
 * 			symbolFromSymbolTable.Name != ast.InternalSymbolNameDefault &&
 * 			!(isUMDExportSymbol(symbolFromSymbolTable) && ctx.enclosingDeclaration != nil && ast.IsExternalModule(ast.GetSourceFileOfNode(ctx.enclosingDeclaration))) &&
 * 			// If `!useOnlyExternalAliasing`, we can use any type of alias to get the name
 * 			(!ctx.useOnlyExternalAliasing || core.Some(symbolFromSymbolTable.Declarations, ast.IsExternalModuleImportEqualsDeclaration)) &&
 * 			// If we're looking up a local name to reference directly, omit namespace reexports, otherwise when we're trawling through an export list to make a dotted name, we can keep it
 * 			(isLocalNameLookup && !core.Some(symbolFromSymbolTable.Declarations, isNamespaceReexportDeclaration) || !isLocalNameLookup) &&
 * 			// While exports are generally considered to be in scope, export-specifier declared symbols are _not_
 * 			// See similar comment in `resolveName` for details
 * 			(ignoreQualification || len(getDeclarationsOfKind(symbolFromSymbolTable, ast.KindExportSpecifier)) == 0) {
 * 			resolvedImportedSymbol := c.resolveAlias(symbolFromSymbolTable)
 * 			candidate := c.getCandidateListForSymbol(ctx, symbolFromSymbolTable, resolvedImportedSymbol, ignoreQualification)
 * 			if len(candidate) > 0 {
 * 				candidateChains = append(candidateChains, candidate)
 * 			}
 * 		}
 * 		if symbolFromSymbolTable.Name == ctx.symbol.Name && symbolFromSymbolTable.ExportSymbol != nil {
 * 			if c.isAccessible(ctx, c.getMergedSymbol(symbolFromSymbolTable.ExportSymbol) /*resolvedAliasSymbol* /, nil, ignoreQualification) {
 * 				candidateChains = append(candidateChains, []*ast.Symbol{ctx.symbol})
 * 			}
 * 		}
 * 	}
 * 
 * 	if len(candidateChains) > 0 {
 * 		// pick first, shortest
 * 		slices.SortStableFunc(candidateChains, c.compareSymbolChains)
 * 		return candidateChains[0]
 * 	}
 * 
 * 	// If there's no result and we're looking at the global symbol table, treat `globalThis` like an alias and try to lookup thru that
 * 	if isGlobals {
 * 		return c.getCandidateListForSymbol(ctx, c.globalThisSymbol, c.globalThisSymbol, ignoreQualification)
 * 	}
 * 	return nil
 * }
 */
export function Checker_trySymbolTable(receiver: GoPtr<Checker>, ctx: accessibleSymbolChainContext, symbols: GoPtr<SymbolTable>, isGlobals: bool, ignoreQualification: bool, isLocalNameLookup: bool): GoSlice<GoPtr<Symbol>> {
  // If symbol is directly available by its name in the symbol table
  const res = symbols?.get(ctx.symbol!.Name);
  if (res !== undefined && Checker_isAccessible(receiver, ctx, res /*resolvedAliasSymbol*/, undefined, ignoreQualification)) {
    return [ctx.symbol!];
  }

  let candidateChains: GoSlice<GoSlice<GoPtr<Symbol>>> = [];
  // collect all possible chains to sort them and return the shortest/best
  for (const [, symbolFromSymbolTable] of symbols ?? []) {
    // for every non-default, non-export= alias symbol in scope, check if it refers to or can chain to the target symbol
    if ((symbolFromSymbolTable!.Flags & SymbolFlagsAlias) !== 0 &&
      symbolFromSymbolTable!.Name !== InternalSymbolNameExportEquals &&
      symbolFromSymbolTable!.Name !== InternalSymbolNameDefault &&
      !(isUMDExportSymbol(symbolFromSymbolTable) && ctx.enclosingDeclaration !== undefined && IsExternalModule(GetSourceFileOfNode(ctx.enclosingDeclaration))) &&
      // If `!useOnlyExternalAliasing`, we can use any type of alias to get the name
      (!ctx.useOnlyExternalAliasing || Some(symbolFromSymbolTable!.Declarations, IsExternalModuleImportEqualsDeclaration)) &&
      // If we're looking up a local name to reference directly, omit namespace reexports
      (isLocalNameLookup && !Some(symbolFromSymbolTable!.Declarations, isNamespaceReexportDeclaration) || !isLocalNameLookup) &&
      // While exports are generally considered to be in scope, export-specifier declared symbols are _not_
      (ignoreQualification || getDeclarationsOfKind(symbolFromSymbolTable, KindExportSpecifier).length === 0)) {
      const resolvedImportedSymbol = Checker_resolveAlias(receiver, symbolFromSymbolTable);
      const candidate = Checker_getCandidateListForSymbol(receiver, ctx, symbolFromSymbolTable, resolvedImportedSymbol, ignoreQualification);
      if (candidate.length > 0) {
        candidateChains = [...candidateChains, candidate];
      }
    }
    if (symbolFromSymbolTable!.Name === ctx.symbol!.Name && symbolFromSymbolTable!.ExportSymbol !== undefined) {
      if (Checker_isAccessible(receiver, ctx, Checker_getMergedSymbol(receiver, symbolFromSymbolTable!.ExportSymbol) /*resolvedAliasSymbol*/, undefined, ignoreQualification)) {
        candidateChains = [...candidateChains, [ctx.symbol!]];
      }
    }
  }

  if (candidateChains.length > 0) {
    // pick first, shortest
    candidateChains.sort((a, b) => Checker_compareSymbolChainsWorker(receiver, a, b));
    return candidateChains[0]!;
  }

  // If there's no result and we're looking at the global symbol table, treat `globalThis` like an alias
  if (isGlobals) {
    return Checker_getCandidateListForSymbol(receiver, ctx, receiver!.globalThisSymbol, receiver!.globalThisSymbol, ignoreQualification);
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.compareSymbolChainsWorker","kind":"method","status":"implemented","sigHash":"b70c44126c655774086bb9d8b90d04ea6438a32a48a177b67c6a8805748d6227","bodyHash":"e74099c7b1925f7389df272df559b97fb193a8f24e9b9df0a284cd2399f01112"}
 *
 * Go source:
 * func (c *Checker) compareSymbolChainsWorker(a []*ast.Symbol, b []*ast.Symbol) int {
 * 	chainLen := len(a) - len(b)
 * 	if chainLen != 0 {
 * 		return chainLen
 * 	}
 * 
 * 	idx := 0
 * 	for idx < len(a) {
 * 		comparison := c.compareSymbols(a[idx], b[idx])
 * 		if comparison != 0 {
 * 			return comparison
 * 		}
 * 		idx++
 * 	}
 * 	return 0
 * }
 */
export function Checker_compareSymbolChainsWorker(receiver: GoPtr<Checker>, a: GoSlice<GoPtr<Symbol>>, b: GoSlice<GoPtr<Symbol>>): int {
  const chainLen = a.length - b.length;
  if (chainLen !== 0) {
    return chainLen;
  }

  let idx = 0;
  while (idx < a.length) {
    const comparison = Checker_compareSymbolsWorker(receiver, a[idx], b[idx]);
    if (comparison !== 0) {
      return comparison;
    }
    idx++;
  }
  return 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::isUMDExportSymbol","kind":"func","status":"implemented","sigHash":"83979fc1ff5b1312713633f0181a4b210ab58095d550346ac65ed4e01e761f18","bodyHash":"1f118e4df37f9452b0b7d059d8b3e9774c1d704e085a66be2ccee531efca08fe"}
 *
 * Go source:
 * func isUMDExportSymbol(symbol *ast.Symbol) bool {
 * 	return symbol != nil && len(symbol.Declarations) > 0 && symbol.Declarations[0] != nil && ast.IsNamespaceExportDeclaration(symbol.Declarations[0])
 * }
 */
export function isUMDExportSymbol(symbol_: GoPtr<Symbol>): bool {
  return symbol_ !== undefined && symbol_!.Declarations !== undefined && symbol_!.Declarations.length > 0 && symbol_!.Declarations[0] !== undefined && IsNamespaceExportDeclaration(symbol_!.Declarations[0]);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::isNamespaceReexportDeclaration","kind":"func","status":"implemented","sigHash":"6739ace25b3ca23858bf9b82faba73dcdef740f37abeaae0b47abc12d444d428","bodyHash":"a62e04577fed3132265ce1423b624066a55b7d5dfaf0d716952b5b9b8f411aac"}
 *
 * Go source:
 * func isNamespaceReexportDeclaration(node *ast.Node) bool {
 * 	return ast.IsNamespaceExport(node) && node.Parent.ModuleSpecifier() != nil
 * }
 */
export function isNamespaceReexportDeclaration(node: GoPtr<Node>): bool {
  return IsNamespaceExport(node) && Node_ModuleSpecifier(node!.Parent) !== undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.getCandidateListForSymbol","kind":"method","status":"implemented","sigHash":"13aefa587d457fd99b9365cdab677d6b4023e88216076efafabf226f3acc5780","bodyHash":"913c03b236548a6fa76fc4a05d0322ff697296ac1a6f1586f638f06010fe170d"}
 *
 * Go source:
 * func (c *Checker) getCandidateListForSymbol(
 * 	ctx accessibleSymbolChainContext,
 * 	symbolFromSymbolTable *ast.Symbol,
 * 	resolvedImportedSymbol *ast.Symbol,
 * 	ignoreQualification bool,
 * ) []*ast.Symbol {
 * 	if c.isAccessible(ctx, symbolFromSymbolTable, resolvedImportedSymbol, ignoreQualification) {
 * 		return []*ast.Symbol{symbolFromSymbolTable}
 * 	}
 * 
 * 	// Look in the exported members, if we can find accessibleSymbolChain, symbol is accessible using this chain
 * 	// but only if the symbolFromSymbolTable can be qualified
 * 	candidateTable := c.getExportsOfSymbol(resolvedImportedSymbol)
 * 	if candidateTable == nil {
 * 		return nil
 * 	}
 * 	candidateTableId := symbolTableIDFromExports(resolvedImportedSymbol)
 * 	accessibleSymbolsFromExports := c.getAccessibleSymbolChainFromSymbolTable(ctx, candidateTable, candidateTableId /*ignoreQualification* /, true, false)
 * 	if len(accessibleSymbolsFromExports) == 0 {
 * 		return nil
 * 	}
 * 	if !c.canQualifySymbol(ctx, symbolFromSymbolTable, getQualifiedLeftMeaning(ctx.meaning)) {
 * 		return nil
 * 	}
 * 	return append([]*ast.Symbol{symbolFromSymbolTable}, accessibleSymbolsFromExports...)
 * }
 */
export function Checker_getCandidateListForSymbol(receiver: GoPtr<Checker>, ctx: accessibleSymbolChainContext, symbolFromSymbolTable: GoPtr<Symbol>, resolvedImportedSymbol: GoPtr<Symbol>, ignoreQualification: bool): GoSlice<GoPtr<Symbol>> {
  if (Checker_isAccessible(receiver, ctx, symbolFromSymbolTable, resolvedImportedSymbol, ignoreQualification)) {
    return [symbolFromSymbolTable];
  }

  // Look in the exported members, if we can find accessibleSymbolChain, symbol is accessible using this chain
  // but only if the symbolFromSymbolTable can be qualified
  const candidateTable = Checker_getExportsOfSymbol(receiver, resolvedImportedSymbol);
  if (candidateTable === undefined) {
    return [];
  }
  const candidateTableId = symbolTableIDFromExports(resolvedImportedSymbol);
  const accessibleSymbolsFromExports = Checker_getAccessibleSymbolChainFromSymbolTable(receiver, ctx, candidateTable, candidateTableId /*ignoreQualification*/, true, false);
  if (accessibleSymbolsFromExports.length === 0) {
    return [];
  }
  if (!Checker_canQualifySymbol(receiver, ctx, symbolFromSymbolTable, getQualifiedLeftMeaning(ctx.meaning))) {
    return [];
  }
  return [symbolFromSymbolTable, ...accessibleSymbolsFromExports];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.isAccessible","kind":"method","status":"implemented","sigHash":"3878a30e0c7b4a881edab68c10c1e1fdd752cac2139da2b048fa64f338cd4096","bodyHash":"52ecc705cc54d9268cb678498e1a5101f31280c7c7570e49eb6dd31d5196ca6e"}
 *
 * Go source:
 * func (c *Checker) isAccessible(
 * 	ctx accessibleSymbolChainContext,
 * 	symbolFromSymbolTable *ast.Symbol,
 * 	resolvedAliasSymbol *ast.Symbol,
 * 	ignoreQualification bool,
 * ) bool {
 * 	likeSymbols := false
 * 	if ctx.symbol == resolvedAliasSymbol {
 * 		likeSymbols = true
 * 	}
 * 	if ctx.symbol == symbolFromSymbolTable {
 * 		likeSymbols = true
 * 	}
 * 	symbol := c.getMergedSymbol(ctx.symbol)
 * 	if symbol == c.getMergedSymbol(resolvedAliasSymbol) {
 * 		likeSymbols = true
 * 	}
 * 	if symbol == c.getMergedSymbol(symbolFromSymbolTable) {
 * 		likeSymbols = true
 * 	}
 * 	if !likeSymbols {
 * 		return false
 * 	}
 * 	// if the symbolFromSymbolTable is not external module (it could be if it was determined as ambient external module and would be in globals table)
 * 	// and if symbolFromSymbolTable or alias resolution matches the symbol,
 * 	// check the symbol can be qualified, it is only then this symbol is accessible
 * 	return !core.Some(symbolFromSymbolTable.Declarations, hasNonGlobalAugmentationExternalModuleSymbol) &&
 * 		(ignoreQualification || c.canQualifySymbol(ctx, c.getMergedSymbol(symbolFromSymbolTable), ctx.meaning))
 * }
 */
export function Checker_isAccessible(receiver: GoPtr<Checker>, ctx: accessibleSymbolChainContext, symbolFromSymbolTable: GoPtr<Symbol>, resolvedAliasSymbol: GoPtr<Symbol>, ignoreQualification: bool): bool {
  let likeSymbols = false;
  if (ctx.symbol === resolvedAliasSymbol) {
    likeSymbols = true;
  }
  if (ctx.symbol === symbolFromSymbolTable) {
    likeSymbols = true;
  }
  const symbol_ = Checker_getMergedSymbol(receiver, ctx.symbol);
  if (symbol_ === Checker_getMergedSymbol(receiver, resolvedAliasSymbol)) {
    likeSymbols = true;
  }
  if (symbol_ === Checker_getMergedSymbol(receiver, symbolFromSymbolTable)) {
    likeSymbols = true;
  }
  if (!likeSymbols) {
    return false;
  }
  // if the symbolFromSymbolTable is not external module (it could be if it was determined as ambient external module and would be in globals table)
  // and if symbolFromSymbolTable or alias resolution matches the symbol,
  // check the symbol can be qualified, it is only then this symbol is accessible
  return !Some(symbolFromSymbolTable!.Declarations, hasNonGlobalAugmentationExternalModuleSymbol) &&
    (ignoreQualification || Checker_canQualifySymbol(receiver, ctx, Checker_getMergedSymbol(receiver, symbolFromSymbolTable), ctx.meaning));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.canQualifySymbol","kind":"method","status":"implemented","sigHash":"d5b68c2d0fd2d8dda02c090c35318ad0292b1f269d0cfd136473c414bb750f3c","bodyHash":"397af9c1afe7627e9d2c0bddd9ab4b6393526a2af33366adfb0d1728f82bb9fd"}
 *
 * Go source:
 * func (c *Checker) canQualifySymbol(
 * 	ctx accessibleSymbolChainContext,
 * 	symbolFromSymbolTable *ast.Symbol,
 * 	meaning ast.SymbolFlags,
 * ) bool {
 * 	// If the symbol is equivalent and doesn't need further qualification, this symbol is accessible
 * 	return !c.needsQualification(symbolFromSymbolTable, ctx.enclosingDeclaration, meaning) ||
 * 		// If symbol needs qualification, make sure that parent is accessible, if it is then this symbol is accessible too
 * 		len(c.getAccessibleSymbolChainEx(accessibleSymbolChainContext{symbolFromSymbolTable.Parent, ctx.enclosingDeclaration, getQualifiedLeftMeaning(meaning), ctx.useOnlyExternalAliasing, ctx.visitedSymbolTablesMap})) > 0
 * }
 */
export function Checker_canQualifySymbol(receiver: GoPtr<Checker>, ctx: accessibleSymbolChainContext, symbolFromSymbolTable: GoPtr<Symbol>, meaning: SymbolFlags): bool {
  // If the symbol is equivalent and doesn't need further qualification, this symbol is accessible
  return !Checker_needsQualification(receiver, symbolFromSymbolTable, ctx.enclosingDeclaration, meaning) ||
    // If symbol needs qualification, make sure that parent is accessible, if it is then this symbol is accessible too
    Checker_getAccessibleSymbolChainEx(receiver, { symbol: symbolFromSymbolTable!.Parent, enclosingDeclaration: ctx.enclosingDeclaration, meaning: getQualifiedLeftMeaning(meaning), useOnlyExternalAliasing: ctx.useOnlyExternalAliasing, visitedSymbolTablesMap: ctx.visitedSymbolTablesMap }).length > 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.needsQualification","kind":"method","status":"implemented","sigHash":"3e7a188b4685b6c27bd723978e4408b775e823427f9f9f56601b7057a4cc76a9","bodyHash":"676300f6ed170d2daff702493056b3c6601c3a7081238e83cf6312d46ca668f9"}
 *
 * Go source:
 * func (c *Checker) needsQualification(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags) bool {
 * 	qualify := false
 * 	c.someSymbolTableInScope(enclosingDeclaration, func(symbolTable ast.SymbolTable, _ symbolTableID, _ bool, _ bool, _ *ast.Node) bool {
 * 		// If symbol of this name is not available in the symbol table we are ok
 * 		res, ok := symbolTable[symbol.Name]
 * 		if !ok || res == nil {
 * 			return false
 * 		}
 * 		symbolFromSymbolTable := c.getMergedSymbol(res)
 * 		if symbolFromSymbolTable == nil {
 * 			// Continue to the next symbol table
 * 			return false
 * 		}
 * 		// If the symbol with this name is present it should refer to the symbol
 * 		if symbolFromSymbolTable == symbol {
 * 			// No need to qualify
 * 			return true
 * 		}
 * 
 * 		// Qualify if the symbol from symbol table has same meaning as expected
 * 		shouldResolveAlias := symbolFromSymbolTable.Flags&ast.SymbolFlagsAlias != 0 && ast.GetDeclarationOfKind(symbolFromSymbolTable, ast.KindExportSpecifier) == nil
 * 		if shouldResolveAlias {
 * 			symbolFromSymbolTable = c.resolveAlias(symbolFromSymbolTable)
 * 		}
 * 		flags := symbolFromSymbolTable.Flags
 * 		if shouldResolveAlias {
 * 			flags = c.getSymbolFlags(symbolFromSymbolTable)
 * 		}
 * 		if flags&meaning != 0 {
 * 			qualify = true
 * 			return true
 * 		}
 * 
 * 		// Continue to the next symbol table
 * 		return false
 * 	})
 * 
 * 	return qualify
 * }
 */
export function Checker_needsQualification(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags): bool {
  let qualify = false;
  Checker_someSymbolTableInScope(receiver, enclosingDeclaration, (symbolTable: GoPtr<SymbolTable>, _tableId: symbolTableID, _iq: bool, _il: bool, _node: GoPtr<Node>): bool => {
    // If symbol of this name is not available in the symbol table we are ok
    const res = symbolTable?.get(symbol_!.Name);
    if (res === undefined) {
      return false;
    }
    let symbolFromSymbolTable = Checker_getMergedSymbol(receiver, res);
    if (symbolFromSymbolTable === undefined) {
      // Continue to the next symbol table
      return false;
    }
    // If the symbol with this name is present it should refer to the symbol
    if (symbolFromSymbolTable === symbol_) {
      // No need to qualify
      return true;
    }

    // Qualify if the symbol from symbol table has same meaning as expected
    const shouldResolveAlias = (symbolFromSymbolTable!.Flags & SymbolFlagsAlias) !== 0 && GetDeclarationOfKind(symbolFromSymbolTable, KindExportSpecifier) === undefined;
    if (shouldResolveAlias) {
      symbolFromSymbolTable = Checker_resolveAlias(receiver, symbolFromSymbolTable);
    }
    let flags = symbolFromSymbolTable!.Flags;
    if (shouldResolveAlias) {
      flags = Checker_getSymbolFlags(receiver, symbolFromSymbolTable);
    }
    if ((flags & meaning) !== 0) {
      qualify = true;
      return true;
    }

    // Continue to the next symbol table
    return false;
  });

  return qualify;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::func::isPropertyOrMethodDeclarationSymbol","kind":"func","status":"implemented","sigHash":"63f9b081998e01af8b56b0a76488a087c4470ea2c65d39f9c85b8ef23a2a4b1c","bodyHash":"a1ae3177e6f080e936fd9e9c3a2f1f6eb969c6aa688fc1cd298cf07f4c867c24"}
 *
 * Go source:
 * func isPropertyOrMethodDeclarationSymbol(symbol *ast.Symbol) bool {
 * 	if len(symbol.Declarations) > 0 {
 * 		for _, declaration := range symbol.Declarations {
 * 			switch declaration.Kind {
 * 			case ast.KindPropertyDeclaration,
 * 				ast.KindMethodDeclaration,
 * 				ast.KindGetAccessor,
 * 				ast.KindSetAccessor:
 * 				continue
 * 			default:
 * 				return false
 * 			}
 * 		}
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isPropertyOrMethodDeclarationSymbol(symbol_: GoPtr<Symbol>): bool {
  if (symbol_!.Declarations !== undefined && symbol_!.Declarations.length > 0) {
    for (const declaration of symbol_!.Declarations) {
      switch (declaration!.Kind) {
      case KindPropertyDeclaration:
      case KindMethodDeclaration:
      case KindGetAccessor:
      case KindSetAccessor:
        continue;
      default:
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.someSymbolTableInScope","kind":"method","status":"implemented","sigHash":"104479f1509bdc3a2737399b431fe194d408c34a7e53bcd1929ab4ff7359006b","bodyHash":"0fc3ec43bac2776b6b389adb9e33382cd2e5f0a04c01a91be474e895d9a07a0f"}
 *
 * Go source:
 * func (c *Checker) someSymbolTableInScope(
 * 	enclosingDeclaration *ast.Node,
 * 	callback func(symbolTable ast.SymbolTable, tableId symbolTableID, ignoreQualification bool, isLocalNameLookup bool, scopeNode *ast.Node) bool,
 * ) bool {
 * 	for location := enclosingDeclaration; location != nil; location = location.Parent {
 * 		// Locals of a source file are not in scope (because they get merged into the global symbol table)
 * 		if canHaveLocals(location) && location.Locals() != nil && !ast.IsGlobalSourceFile(location) {
 * 			if callback(location.Locals(), symbolTableIDFromLocals(location.AsNode()), false, true, location) {
 * 				return true
 * 			}
 * 		}
 * 		switch location.Kind {
 * 		case ast.KindSourceFile, ast.KindModuleDeclaration:
 * 			if ast.IsSourceFile(location) && !ast.IsExternalOrCommonJSModule(location.AsSourceFile()) {
 * 				break
 * 			}
 * 			sym := c.getSymbolOfDeclaration(location)
 * 			if callback(sym.Exports, symbolTableIDFromExports(sym), false, true, location) {
 * 				return true
 * 			}
 * 		case ast.KindClassDeclaration, ast.KindClassExpression, ast.KindInterfaceDeclaration:
 * 			// Type parameters are bound into `members` lists so they can merge across declarations
 * 			// This is troublesome, since in all other respects, they behave like locals :cries:
 * 			// TODO: the below is shared with similar code in `resolveName` - in fact, rephrasing all this symbol
 * 			// lookup logic in terms of `resolveName` would be nice
 * 			// The below is used to lookup type parameters within a class or interface, as they are added to the class/interface locals
 * 			// These can never be latebound, so the symbol's raw members are sufficient. `getMembersOfNode` cannot be used, as it would
 * 			// trigger resolving late-bound names, which we may already be in the process of doing while we're here!
 * 			var table ast.SymbolTable
 * 			sym := c.getSymbolOfDeclaration(location)
 * 			// TODO: Should this filtered table be cached in some way?
 * 			for key, memberSymbol := range sym.Members {
 * 				if memberSymbol.Flags&(ast.SymbolFlagsType & ^ast.SymbolFlagsAssignment) != 0 {
 * 					if table == nil {
 * 						table = make(ast.SymbolTable)
 * 					}
 * 					table[key] = memberSymbol
 * 				}
 * 			}
 * 			if table != nil && callback(table, symbolTableIDFromMembers(sym), false, false, location) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 
 * 	return callback(c.globals, symbolTableIDFromGlobals(), false, true, nil)
 * }
 */
export function Checker_someSymbolTableInScope(receiver: GoPtr<Checker>, enclosingDeclaration: GoPtr<Node>, callback: (symbolTable: GoPtr<SymbolTable>, tableId: symbolTableID, ignoreQualification: bool, isLocalNameLookup: bool, scopeNode: GoPtr<Node>) => bool): bool {
  let location: GoPtr<Node> = enclosingDeclaration;
  while (location !== undefined) {
    // Locals of a source file are not in scope (because they get merged into the global symbol table)
    if (canHaveLocals(location) && Node_Locals(location) !== undefined && !IsGlobalSourceFile(location)) {
      if (callback(Node_Locals(location)!, symbolTableIDFromLocals(location), false, true, location)) {
        return true;
      }
    }
    switch (location!.Kind) {
    case KindSourceFile:
    case KindModuleDeclaration: {
      if (IsSourceFile(location) && !IsExternalOrCommonJSModule(AsSourceFile(location))) {
        break;
      }
      const sym = Checker_getSymbolOfDeclaration(receiver, location);
      if (callback(sym!.Exports!, symbolTableIDFromExports(sym), false, true, location)) {
        return true;
      }
      break;
    }
    case KindClassDeclaration:
    case KindClassExpression:
    case KindInterfaceDeclaration: {
      // Type parameters are bound into `members` lists so they can merge across declarations
      let table: SymbolTable | undefined = undefined;
      const sym = Checker_getSymbolOfDeclaration(receiver, location);
      for (const [key, memberSymbol] of (sym!.Members ?? [])) {
        if ((memberSymbol!.Flags & (SymbolFlagsType & ~SymbolFlagsAssignment)) !== 0) {
          if (table === undefined) {
            table = new globalThis.Map<string, GoPtr<Symbol>>();
          }
          table.set(key, memberSymbol);
        }
      }
      if (table !== undefined && callback(table, symbolTableIDFromMembers(sym), false, false, location)) {
        return true;
      }
      break;
    }
    }
    location = location!.Parent;
  }

  return callback(receiver!.globals, symbolTableIDFromGlobals(), false, true, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.IsSymbolAccessible","kind":"method","status":"implemented","sigHash":"86d7e73193f7600cf44c2098d28229353de49d2801b80e73823007c7e854fab6","bodyHash":"e377f1c8b9206f449479466a15d3d0b9465917f5f26aeb75d07247c0236418b2"}
 *
 * Go source:
 * func (c *Checker) IsSymbolAccessible(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags, shouldComputeAliasesToMakeVisible bool) printer.SymbolAccessibilityResult {
 * 	return c.isSymbolAccessibleWorker(symbol, enclosingDeclaration, meaning, shouldComputeAliasesToMakeVisible, true /*allowModules* /)
 * }
 */
export function Checker_IsSymbolAccessible(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, shouldComputeAliasesToMakeVisible: bool): SymbolAccessibilityResult {
  return Checker_isSymbolAccessibleWorker(receiver, symbol_, enclosingDeclaration, meaning, shouldComputeAliasesToMakeVisible, true /*allowModules*/);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/symbolaccessibility.go::method::Checker.isSymbolAccessibleWorker","kind":"method","status":"implemented","sigHash":"c10693b2331715b2ca9c13464bbb92e23eb6e79044b73b2262be5aac60aa46a5","bodyHash":"698f630ae422b966dca51b0a8b8c152173ce3b7cb88e0a2945710e1f8a22369c"}
 *
 * Go source:
 * func (c *Checker) isSymbolAccessibleWorker(symbol *ast.Symbol, enclosingDeclaration *ast.Node, meaning ast.SymbolFlags, shouldComputeAliasesToMakeVisible bool, allowModules bool) printer.SymbolAccessibilityResult {
 * 	if symbol != nil && enclosingDeclaration != nil {
 * 		result := c.IsAnySymbolAccessible([]*ast.Symbol{symbol}, enclosingDeclaration, symbol, meaning, shouldComputeAliasesToMakeVisible, allowModules)
 * 		if result != nil {
 * 			return *result
 * 		}
 * 
 * 		// This could be a symbol that is not exported in the external module
 * 		// or it could be a symbol from different external module that is not aliased and hence cannot be named
 * 		symbolExternalModule := core.FirstNonNil(symbol.Declarations, c.getExternalModuleContainer)
 * 		if symbolExternalModule != nil {
 * 			enclosingExternalModule := c.getExternalModuleContainer(enclosingDeclaration)
 * 			if symbolExternalModule != enclosingExternalModule {
 * 				// name from different external module that is not visible
 * 				return printer.SymbolAccessibilityResult{
 * 					Accessibility:   printer.SymbolAccessibilityCannotBeNamed,
 * 					ErrorSymbolName: c.symbolToStringEx(symbol, enclosingDeclaration, meaning, SymbolFormatFlagsAllowAnyNodeKind),
 * 					ErrorModuleName: c.symbolToString(symbolExternalModule),
 * 					ErrorNode:       core.IfElse(ast.IsInJSFile(enclosingDeclaration), enclosingDeclaration, nil),
 * 				}
 * 			}
 * 		}
 * 
 * 		// Just a local name that is not accessible
 * 		return printer.SymbolAccessibilityResult{
 * 			Accessibility:   printer.SymbolAccessibilityNotAccessible,
 * 			ErrorSymbolName: c.symbolToStringEx(symbol, enclosingDeclaration, meaning, SymbolFormatFlagsAllowAnyNodeKind),
 * 		}
 * 	}
 * 
 * 	return printer.SymbolAccessibilityResult{
 * 		Accessibility: printer.SymbolAccessibilityAccessible,
 * 	}
 * }
 */
export function Checker_isSymbolAccessibleWorker(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, enclosingDeclaration: GoPtr<Node>, meaning: SymbolFlags, shouldComputeAliasesToMakeVisible: bool, allowModules: bool): SymbolAccessibilityResult {
  if (symbol_ !== undefined && enclosingDeclaration !== undefined) {
    const result = Checker_IsAnySymbolAccessible(receiver, [symbol_], enclosingDeclaration, symbol_, meaning, shouldComputeAliasesToMakeVisible, allowModules);
    if (result !== undefined) {
      return result;
    }

    // This could be a symbol that is not exported in the external module
    // or it could be a symbol from different external module that is not aliased and hence cannot be named
    const symbolExternalModule = FirstNonNil(symbol_!.Declarations ?? [], (d: GoPtr<Node>) => Checker_getExternalModuleContainer(receiver, d));
    if (symbolExternalModule !== undefined) {
      const enclosingExternalModule = Checker_getExternalModuleContainer(receiver, enclosingDeclaration);
      if (symbolExternalModule !== enclosingExternalModule) {
        // name from different external module that is not visible
        return {
          Accessibility: SymbolAccessibilityCannotBeNamed,
          AliasesToMakeVisible: [],
          ErrorSymbolName: Checker_symbolToStringEx(receiver, symbol_, enclosingDeclaration, meaning, SymbolFormatFlagsAllowAnyNodeKind),
          ErrorModuleName: Checker_symbolToString(receiver, symbolExternalModule),
          ErrorNode: IfElse(IsInJSFile(enclosingDeclaration), enclosingDeclaration, undefined),
        };
      }
    }

    // Just a local name that is not accessible
    return {
      Accessibility: SymbolAccessibilityNotAccessible,
      AliasesToMakeVisible: [],
      ErrorSymbolName: Checker_symbolToStringEx(receiver, symbol_, enclosingDeclaration, meaning, SymbolFormatFlagsAllowAnyNodeKind),
      ErrorNode: undefined,
      ErrorModuleName: "",
    };
  }

  return {
    Accessibility: SymbolAccessibilityAccessible,
    AliasesToMakeVisible: [],
    ErrorSymbolName: "",
    ErrorNode: undefined,
    ErrorModuleName: "",
  };
}
