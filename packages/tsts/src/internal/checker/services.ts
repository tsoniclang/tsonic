import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { Index } from "../../go/strings.js";
import type { Node, SourceFile } from "../ast/ast.js";
import { SourceFile_Path, SourceFile_Text } from "../ast/ast.js";
import { byteAt, byteLen, byteSlice } from "../parser/utilities.js";
import type { SymbolTable } from "../ast/symbol.js";
import { Node_Pos, Node_End } from "../ast/spine.js";
import { Node_Locals, Node_Expression, Node_Properties, Node_Elements, Node_TypeArguments, Node_TagName, Node_PropertyNameOrName, Node_ModuleSpecifier, Node_Text, Node_Symbol } from "../ast/ast.js";
import { Node_Name } from "../ast/spine.js";
import type { CallLikeExpression, ExportSpecifier, Expression, Identifier, JsxAttributeLike } from "../ast/ast_generated.js";
import { AsIdentifier, AsQualifiedName, AsTaggedTemplateExpression, AsExportSpecifier, AsClassExpression, AsBinaryExpression } from "../ast/generated/casts.js";
import { IsIdentifier, IsExportSpecifier, IsObjectLiteralExpression, IsJsxAttributes, IsForOfStatement, IsBinaryExpression, IsPropertyAssignment, IsDecorator, IsExpressionStatement, IsExpressionWithTypeArguments, IsJsxNamespacedName, IsSpreadElement } from "../ast/generated/predicates.js";
import { KindSourceFile, KindModuleDeclaration, KindEnumDeclaration, KindClassExpression, KindClassDeclaration, KindInterfaceDeclaration, KindFunctionExpression, KindCallExpression, KindNewExpression, KindTaggedTemplateExpression, KindBinaryExpression, KindJsxSelfClosingElement, KindJsxOpeningElement, KindJsxOpeningFragment, KindSuperKeyword, KindStringLiteral, KindShorthandPropertyAssignment, KindEnumMember, KindPropertyAccessExpression, KindQualifiedName, KindImportType, KindNamespaceExport, KindExportSpecifier, KindDecorator, KindIdentifier } from "../ast/generated/kinds.js";
import type { Symbol } from "../ast/symbol.js";
import { InternalSymbolNameThis, InternalSymbolNameDefault, Symbol_CombinedLocalAndExportSymbolFlags } from "../ast/symbol.js";
import type { SymbolFlags } from "../ast/symbolflags.js";
import { SymbolFlagsAlias, SymbolFlagsValue, SymbolFlagsType, SymbolFlagsNamespace, SymbolFlagsModuleMember, SymbolFlagsEnumMember, SymbolFlagsTransient } from "../ast/symbolflags.js";
import { NodeFlagsInWithStatement } from "../ast/nodeflags.js";
import { CheckFlagsSynthetic } from "../ast/checkflags.js";
import { GetSourceFileOfNode, GetDeclarationOfKind, GetTextOfPropertyName, IsStatic, IsGlobalSourceFile, IsExternalModule, IsEnumConst, IsEntityNameExpression, IsCallLikeExpression, IsCallLikeOrFunctionLikeExpression, IsFunctionExpressionOrArrowFunction, IsTypeNode, IsTypeReferenceType, HasTypeArguments } from "../ast/utilities.js";
import { IsArrayLiteralOrObjectLiteralDestructuringPattern } from "../ast/ast.js";
import { FindAncestor } from "../ast/utilities.js";
import type { CheckFlags } from "../ast/checkflags.js";
import type { NodeFlags } from "../ast/nodeflags.js";
import { Filter, MapNonNil, Deduplicate, OrElse, IfElse, FirstOrNil, Some } from "../core/core.js";
import { Set_Add, Set_Has, Set_Clear } from "../collections/set.js";
import type { LinkStore } from "../core/linkstore.js";
import { LinkStore_Get, LinkStore_Has, LinkStore_TryGet } from "../core/linkstore.js";
import { GetTouchingPropertyName } from "../astnav/tokens.js";
import { IsIdentifierPart } from "../scanner/scanner.js";
import { NewEmitContext, EmitContext_ParseNode } from "../printer/emitcontext.js";
import type { Checker, CheckMode } from "./checker/state.js";
import { CheckModeNormal, CheckModeIsForSignatureHelp } from "./checker/state.js";
import { isTupleType } from "./checker/state.js";
import { Checker_getElementTypeOfArrayType, Checker_removeOptionalTypeMarker, Checker_getUnionType, Checker_getIntersectionType, Checker_getStringLiteralType, Checker_getTypeOfExpression, Checker_getTypeFromTypeNode, Checker_getContextualType, Checker_getContextualTypeForElementExpression, Checker_checkIteratedTypeOrElementType, Checker_checkExpressionWithContextualType, Checker_getTypeOfNode, Checker_instantiateType, Checker_getWidenedType, Checker_isArrayType, Checker_getPropertiesOfType, Checker_getApparentType, Checker_getReducedApparentType } from "./checker/types.js";
import { Type_IsIndex, Type_AsIndexType } from "./types.js";
import { isThisTypeParameter } from "./utilities.js";
import { Checker_getTypeAtPosition } from "./relater.js";
import { Checker_getBaseConstraintOfType } from "./checker/inference.js";
import { Checker_getExportsOfModule, Checker_getIndexTypeOfType, Checker_getMergedSymbol, Checker_GetAliasedSymbol, Checker_resolveExternalModuleSymbol, Checker_getTypeOfSymbol, Checker_getPropertyOfType, Checker_isPropertyAccessible, Checker_createUnionOrIntersectionProperty, Checker_getNamedMembers, Checker_resolveStructuredTypeMembers, Checker_isNamedMember, Checker_getSymbol, Checker_getSymbolOfDeclaration, Checker_getMembersOfSymbol, Checker_getExternalModuleMember, Checker_resolveEntityName, Checker_GetSymbolAtLocation, Checker_getTypeOfPropertyOfType, Checker_getIndexType, Checker_getGlobalSymbol, Checker_getLiteralTypeFromPropertyName } from "./checker/symbols.js";
import { Checker_getSignatureFromDeclaration, Checker_getSignaturesOfType, Checker_getResolvedSignature, Checker_getTypeArguments, Checker_getConstraintOfTypeParameter, Checker_getTypeParametersForTypeReferenceOrImport, Checker_getEffectiveTypeArguments } from "./checker/signatures.js";
import { Checker_GetPropertiesOfType } from "./exports.js";
import { Checker_checkExpression, Checker_checkExpressionCached, Checker_checkRightHandSideOfForOf } from "./checker/syntax-checking.js";
import { Checker_getEnumMemberValue } from "./checker/symbols.js";
import { Checker_checkDestructuringAssignment, Checker_checkObjectLiteralDestructuringPropertyAssignment, Checker_checkArrayLiteralDestructuringElementAssignment } from "./checker/relations.js";
import { Checker_isTypeAssignableTo } from "./relater.js";
import { Checker_getContextualTypeForJsxAttribute, Checker_getJsxType, Checker_getJsxNamespace, JsxNames } from "./jsx.js";
import { Checker_GetJsxFragmentFactory } from "./exports.js";
import { symbolsToArray, createSymbolTable, isReservedMemberName, IsTypeAny, canHaveLocals, isTypeUsableAsPropertyName, getPropertyNameFromType, isJsxIntrinsicTagName } from "./utilities.js";
import { introducesArgumentsExoticObject } from "./utilities.js";
import type { ContextFlags, Signature, Type, SignatureLinks, ValueSymbolLinks, ExportTypeLinks, SpreadLinks, MappedSymbolLinks, SymbolNodeLinks } from "./types.js";
import { ContextFlagsNone, ContextFlagsIgnoreNodeInferences, SignatureKindCall, SignatureKindConstruct, TypeFlagsUnion, TypeFlagsStructuredType, TypeFlagsPrimitive, TypeFlagsNever, ObjectFlagsClass, ObjectFlagsReference, Type_Target, Type_Types, Type_Symbol } from "./types.js";
import { isLiteralType } from "./checker/state.js";
import { newTypeMapper } from "./mapper.js";
import { IterationUseDestructuring } from "./checker/state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetSymbolsInScope","kind":"method","status":"implemented","sigHash":"14ed14fe8a5397b8fde2c5be30207253861fd3c71b66e617fd72b495830e1d2f","bodyHash":"ab0c94a2826f7340040796f7611cac66733a23d72acff6c4fd4a755c59a07bb0"}
 *
 * Go source:
 * func (c *Checker) GetSymbolsInScope(location *ast.Node, meaning ast.SymbolFlags) []*ast.Symbol {
 * 	return c.getSymbolsInScope(location, meaning)
 * }
 */
export function Checker_GetSymbolsInScope(receiver: GoPtr<Checker>, location: GoPtr<Node>, meaning: SymbolFlags): GoSlice<GoPtr<Symbol>> {
  return Checker_getSymbolsInScope(receiver, location, meaning);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getSymbolsInScope","kind":"method","status":"implemented","sigHash":"0b209765eded9a913ffcec3e15384cbe1adfc058168cabbc7f2e36b910d36e10","bodyHash":"e1441f0f84b4a30d41d04d1abb068e670fb632ae8ad6a80a7477297f58130f9c"}
 *
 * Go source:
 * func (c *Checker) getSymbolsInScope(location *ast.Node, meaning ast.SymbolFlags) []*ast.Symbol {
 * 	if location.Flags&ast.NodeFlagsInWithStatement != 0 {
 * 		// We cannot answer semantic questions within a with block, do not proceed any further
 * 		return nil
 * 	}
 * 
 * 	symbols := make(ast.SymbolTable)
 * 	isStaticSymbol := false
 * 
 * 	// Copy the given symbol into symbol tables if the symbol has the given meaning
 * 	// and it doesn't already exists in the symbol table.
 * 	copySymbol := func(symbol *ast.Symbol, meaning ast.SymbolFlags) {
 * 		if symbol.CombinedLocalAndExportSymbolFlags()&meaning != 0 {
 * 			id := symbol.Name
 * 			// We will copy all symbol regardless of its reserved name because
 * 			// symbolsToArray will check whether the key is a reserved name and
 * 			// it will not copy symbol with reserved name to the array
 * 			if _, ok := symbols[id]; !ok {
 * 				symbols[id] = symbol
 * 			}
 * 		}
 * 	}
 * 
 * 	copySymbols := func(source ast.SymbolTable, meaning ast.SymbolFlags) {
 * 		if meaning != 0 {
 * 			for _, symbol := range source {
 * 				copySymbol(symbol, meaning)
 * 			}
 * 		}
 * 	}
 * 
 * 	copyLocallyVisibleExportSymbols := func(source ast.SymbolTable, meaning ast.SymbolFlags) {
 * 		if meaning != 0 {
 * 			for _, symbol := range source {
 * 				// Similar condition as in `resolveNameHelper`
 * 				if ast.GetDeclarationOfKind(symbol, ast.KindExportSpecifier) == nil &&
 * 					ast.GetDeclarationOfKind(symbol, ast.KindNamespaceExport) == nil &&
 * 					symbol.Name != ast.InternalSymbolNameDefault {
 * 					copySymbol(symbol, meaning)
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	populateSymbols := func() {
 * 		for location != nil {
 * 			if canHaveLocals(location) && location.Locals() != nil && !ast.IsGlobalSourceFile(location) {
 * 				copySymbols(location.Locals(), meaning)
 * 			}
 * 
 * 			switch location.Kind {
 * 			case ast.KindSourceFile:
 * 				if !ast.IsExternalModule(location.AsSourceFile()) {
 * 					break
 * 				}
 * 				fallthrough
 * 			case ast.KindModuleDeclaration:
 * 				copyLocallyVisibleExportSymbols(c.getSymbolOfDeclaration(location).Exports, meaning&ast.SymbolFlagsModuleMember)
 * 			case ast.KindEnumDeclaration:
 * 				copySymbols(c.getSymbolOfDeclaration(location).Exports, meaning&ast.SymbolFlagsEnumMember)
 * 			case ast.KindClassExpression:
 * 				className := location.AsClassExpression().Name()
 * 				if className != nil {
 * 					copySymbol(location.Symbol(), meaning)
 * 				}
 * 				// this fall-through is necessary because we would like to handle
 * 				// type parameter inside class expression similar to how we handle it in classDeclaration and interface Declaration.
 * 				fallthrough
 * 			case ast.KindClassDeclaration, ast.KindInterfaceDeclaration:
 * 				// If we didn't come from static member of class or interface,
 * 				// add the type parameters into the symbol table
 * 				// (type parameters of classDeclaration/classExpression and interface are in member property of the symbol.
 * 				// Note: that the memberFlags come from previous iteration.
 * 				if !isStaticSymbol {
 * 					copySymbols(c.getMembersOfSymbol(c.getSymbolOfDeclaration(location)), meaning&ast.SymbolFlagsType)
 * 				}
 * 			case ast.KindFunctionExpression:
 * 				funcName := location.Name()
 * 				if funcName != nil {
 * 					copySymbol(location.Symbol(), meaning)
 * 				}
 * 			}
 * 
 * 			if introducesArgumentsExoticObject(location) {
 * 				copySymbol(c.argumentsSymbol, meaning)
 * 			}
 * 
 * 			isStaticSymbol = ast.IsStatic(location)
 * 			location = location.Parent
 * 		}
 * 
 * 		copySymbols(c.globals, meaning)
 * 	}
 * 
 * 	populateSymbols()
 * 
 * 	delete(symbols, ast.InternalSymbolNameThis) // Not a symbol, a keyword
 * 	return symbolsToArray(symbols)
 * }
 */
export function Checker_getSymbolsInScope(receiver: GoPtr<Checker>, location: GoPtr<Node>, meaning: SymbolFlags): GoSlice<GoPtr<Symbol>> {
  if ((location!.Flags & NodeFlagsInWithStatement) !== 0) {
    // We cannot answer semantic questions within a with block, do not proceed any further
    return [];
  }

  const symbols: SymbolTable = new globalThis.Map();
  let isStaticSymbol = false;

  // Copy the given symbol into symbol tables if the symbol has the given meaning
  // and it doesn't already exists in the symbol table.
  const copySymbol = (symbol_: GoPtr<Symbol>, meaning_: SymbolFlags): void => {
    if ((Symbol_CombinedLocalAndExportSymbolFlags(symbol_) & meaning_) !== 0) {
      const id = symbol_!.Name;
      // We will copy all symbol regardless of its reserved name because
      // symbolsToArray will check whether the key is a reserved name and
      // it will not copy symbol with reserved name to the array
      if (!symbols.has(id)) {
        symbols.set(id, symbol_);
      }
    }
  };

  const copySymbols = (source: SymbolTable, meaning_: SymbolFlags): void => {
    if (meaning_ !== 0) {
      for (const [, symbol_] of source) {
        copySymbol(symbol_, meaning_);
      }
    }
  };

  const copyLocallyVisibleExportSymbols = (source: SymbolTable, meaning_: SymbolFlags): void => {
    if (meaning_ !== 0) {
      for (const [, symbol_] of source) {
        // Similar condition as in `resolveNameHelper`
        if (GetDeclarationOfKind(symbol_, KindExportSpecifier) === undefined &&
          GetDeclarationOfKind(symbol_, KindNamespaceExport) === undefined &&
          symbol_!.Name !== InternalSymbolNameDefault) {
          copySymbol(symbol_, meaning_);
        }
      }
    }
  };

  const populateSymbols = (): void => {
    let loc: GoPtr<Node> = location;
    while (loc !== undefined) {
      if (canHaveLocals(loc) && Node_Locals(loc) !== undefined && !IsGlobalSourceFile(loc)) {
        copySymbols(Node_Locals(loc)!, meaning);
      }

      switch (loc!.Kind) {
      case KindSourceFile:
        if (!IsExternalModule(loc as unknown as GoPtr<SourceFile>)) {
          break;
        }
        // fallthrough
        // eslint-disable-next-line no-fallthrough
      case KindModuleDeclaration:
        copyLocallyVisibleExportSymbols(Checker_getSymbolOfDeclaration(receiver, loc)!.Exports!, (meaning & SymbolFlagsModuleMember) as SymbolFlags);
        break;
      case KindEnumDeclaration:
        copySymbols(Checker_getSymbolOfDeclaration(receiver, loc)!.Exports!, (meaning & SymbolFlagsEnumMember) as SymbolFlags);
        break;
      case KindClassExpression: {
        const className = Node_Name(loc);
        if (className !== undefined) {
          copySymbol(Node_Symbol(loc) as unknown as GoPtr<Symbol>, meaning);
        }
        // this fall-through is necessary because we would like to handle
        // type parameter inside class expression similar to how we handle it in classDeclaration and interface Declaration.
        // eslint-disable-next-line no-fallthrough
      }
      case KindClassDeclaration:
      case KindInterfaceDeclaration:
        // If we didn't come from static member of class or interface,
        // add the type parameters into the symbol table
        // (type parameters of classDeclaration/classExpression and interface are in member property of the symbol.
        // Note: that the memberFlags come from previous iteration.
        if (!isStaticSymbol) {
          copySymbols(Checker_getMembersOfSymbol(receiver, Checker_getSymbolOfDeclaration(receiver, loc)), (meaning & SymbolFlagsType) as SymbolFlags);
        }
        break;
      case KindFunctionExpression: {
        const funcName = Node_Name(loc);
        if (funcName !== undefined) {
          copySymbol(Node_Symbol(loc) as unknown as GoPtr<Symbol>, meaning);
        }
        break;
      }
      }

      if (introducesArgumentsExoticObject(loc)) {
        copySymbol(receiver!.argumentsSymbol, meaning);
      }

      isStaticSymbol = IsStatic(loc);
      loc = loc!.Parent;
    }

    copySymbols(receiver!.globals, meaning);
  };

  populateSymbols();

  symbols.delete(InternalSymbolNameThis); // Not a symbol, a keyword
  return symbolsToArray(symbols);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetExportsOfModule","kind":"method","status":"implemented","sigHash":"1b18614ea75e79769390b440a247cb5bec9ce822f4ad72b9763c9d063b821872","bodyHash":"2eda0a852ec42474a2f6aeda4532c3fa945fcfb79e94866ab36e1a8c73bb9a74"}
 *
 * Go source:
 * func (c *Checker) GetExportsOfModule(symbol *ast.Symbol) []*ast.Symbol {
 * 	return symbolsToArray(c.getExportsOfModule(symbol))
 * }
 */
export function Checker_GetExportsOfModule(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>> {
  return symbolsToArray(Checker_getExportsOfModule(receiver, symbol_));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.ForEachExportAndPropertyOfModule","kind":"method","status":"implemented","sigHash":"1831eaf746938b15cc0b82719abf98b974216fba60d5573395a04113f357aa99","bodyHash":"06c9c356da5166ab112eb4440c8ee1fe891d0fd412ae015d095f32a0ad3310a6"}
 *
 * Go source:
 * func (c *Checker) ForEachExportAndPropertyOfModule(moduleSymbol *ast.Symbol, cb func(*ast.Symbol, string)) {
 * 	for key, exportedSymbol := range c.getExportsOfModule(moduleSymbol) {
 * 		if !isReservedMemberName(key) {
 * 			cb(exportedSymbol, key)
 * 		}
 * 	}
 * 
 * 	exportEquals := c.resolveExternalModuleSymbol(moduleSymbol, false /*dontResolveAlias* /)
 * 	if exportEquals == moduleSymbol {
 * 		return
 * 	}
 * 
 * 	typeOfSymbol := c.getTypeOfSymbol(exportEquals)
 * 	if !c.shouldTreatPropertiesOfExternalModuleAsExports(typeOfSymbol) {
 * 		return
 * 	}
 * 
 * 	// forEachPropertyOfType
 * 	reducedType := c.getReducedApparentType(typeOfSymbol)
 * 	if reducedType.flags&TypeFlagsStructuredType == 0 {
 * 		return
 * 	}
 * 	for name, symbol := range c.resolveStructuredTypeMembers(reducedType).members {
 * 		if c.isNamedMember(symbol, name) {
 * 			cb(symbol, name)
 * 		}
 * 	}
 * }
 */
export function Checker_ForEachExportAndPropertyOfModule(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>, cb: (arg0: GoPtr<Symbol>, arg1: string) => void): void {
  for (const [key, exportedSymbol] of Checker_getExportsOfModule(receiver, moduleSymbol)) {
    if (!isReservedMemberName(key)) {
      cb(exportedSymbol, key);
    }
  }

  const exportEquals = Checker_resolveExternalModuleSymbol(receiver, moduleSymbol, false /*dontResolveAlias*/);
  if (exportEquals === moduleSymbol) {
    return;
  }

  const typeOfSymbol = Checker_getTypeOfSymbol(receiver, exportEquals);
  if (!Checker_shouldTreatPropertiesOfExternalModuleAsExports(receiver, typeOfSymbol)) {
    return;
  }

  // forEachPropertyOfType
  const reducedType = Checker_getReducedApparentType(receiver, typeOfSymbol);
  if ((reducedType!.flags & TypeFlagsStructuredType) === 0) {
    return;
  }
  for (const [name, symbol_] of Checker_resolveStructuredTypeMembers(receiver, reducedType)!.members) {
    if (Checker_isNamedMember(receiver, symbol_, name)) {
      cb(symbol_, name);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsValidPropertyAccess","kind":"method","status":"implemented","sigHash":"99f7551b6db192a55646a920d02bace2714b188da6ab37f8ed6ab1810de2fd95","bodyHash":"fce9e4703eb78f1727cf385a6a4b86c0d521dcc41aef23c6a2bc47b1123909fa"}
 *
 * Go source:
 * func (c *Checker) IsValidPropertyAccess(node *ast.Node, propertyName string) bool {
 * 	return c.isValidPropertyAccess(node, propertyName)
 * }
 */
export function Checker_IsValidPropertyAccess(receiver: GoPtr<Checker>, node: GoPtr<Node>, propertyName: string): bool {
  return Checker_isValidPropertyAccess(receiver, node, propertyName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.isValidPropertyAccess","kind":"method","status":"implemented","sigHash":"89db4c7d7e92d50d8e317cef11681e3838d6253902973805a9a3acf2d12f241a","bodyHash":"59150736c7c7ca1aed6a7a6e12df32e064756500de14a90a96576864ecdd2647"}
 *
 * Go source:
 * func (c *Checker) isValidPropertyAccess(node *ast.Node, propertyName string) bool {
 * 	switch node.Kind {
 * 	case ast.KindPropertyAccessExpression:
 * 		return c.isValidPropertyAccessWithType(node, node.Expression().Kind == ast.KindSuperKeyword, propertyName, c.getWidenedType(c.checkExpression(node.Expression())))
 * 	case ast.KindQualifiedName:
 * 		return c.isValidPropertyAccessWithType(node, false /*isSuper* /, propertyName, c.getWidenedType(c.checkExpression(node.AsQualifiedName().Left)))
 * 	case ast.KindImportType:
 * 		return c.isValidPropertyAccessWithType(node, false /*isSuper* /, propertyName, c.getTypeFromTypeNode(node))
 * 	}
 * 	panic("Unexpected node kind in isValidPropertyAccess: " + node.Kind.String())
 * }
 */
export function Checker_isValidPropertyAccess(receiver: GoPtr<Checker>, node: GoPtr<Node>, propertyName: string): bool {
  switch (node!.Kind) {
  case KindPropertyAccessExpression:
    return Checker_isValidPropertyAccessWithType(receiver, node, Node_Expression(node)!.Kind === KindSuperKeyword, propertyName, Checker_getWidenedType(receiver, Checker_checkExpression(receiver, Node_Expression(node))));
  case KindQualifiedName:
    return Checker_isValidPropertyAccessWithType(receiver, node, false /*isSuper*/, propertyName, Checker_getWidenedType(receiver, Checker_checkExpression(receiver, AsQualifiedName(node)!.Left)));
  case KindImportType:
    return Checker_isValidPropertyAccessWithType(receiver, node, false /*isSuper*/, propertyName, Checker_getTypeFromTypeNode(receiver, node));
  default:
    throw new globalThis.Error("Unexpected node kind in isValidPropertyAccess: " + node!.Kind);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.isValidPropertyAccessWithType","kind":"method","status":"implemented","sigHash":"1f8beb801e7d724476d819e1e325144bfb1f25340d9746cd22303068896f0727","bodyHash":"d1b27efda3895e8130c9ca1c529446c98400fbf544f3f222b4ef6b938da3d03d"}
 *
 * Go source:
 * func (c *Checker) isValidPropertyAccessWithType(node *ast.Node, isSuper bool, propertyName string, t *Type) bool {
 * 	// Short-circuiting for improved performance.
 * 	if IsTypeAny(t) {
 * 		return true
 * 	}
 * 
 * 	prop := c.getPropertyOfType(t, propertyName)
 * 	return prop != nil && c.isPropertyAccessible(node, isSuper, false /*isWrite* /, t, prop)
 * }
 */
export function Checker_isValidPropertyAccessWithType(receiver: GoPtr<Checker>, node: GoPtr<Node>, isSuper: bool, propertyName: string, t: GoPtr<Type>): bool {
  // Short-circuiting for improved performance.
  if (IsTypeAny(t)) {
    return true;
  }

  const prop = Checker_getPropertyOfType(receiver, t, propertyName);
  return prop !== undefined && Checker_isPropertyAccessible(receiver, node, isSuper, false /*isWrite*/, t, prop);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsValidPropertyAccessForCompletions","kind":"method","status":"implemented","sigHash":"6c2f239e58e48e9cc4651f2e792e9cb393ee92e4f1e1cfdbc43944fd863adf90","bodyHash":"e538bec420060f234c430e341d3b0d80d6c485bdb2559e997fb7fe67de7a81d5"}
 *
 * Go source:
 * func (c *Checker) IsValidPropertyAccessForCompletions(node *ast.Node, t *Type, property *ast.Symbol) bool {
 * 	return c.isPropertyAccessible(
 * 		node,
 * 		node.Kind == ast.KindPropertyAccessExpression && node.Expression().Kind == ast.KindSuperKeyword,
 * 		false, /*isWrite* /
 * 		t,
 * 		property,
 * 	)
 * 	// Previously we validated the 'this' type of methods but this adversely affected performance. See #31377 for more context.
 * }
 */
export function Checker_IsValidPropertyAccessForCompletions(receiver: GoPtr<Checker>, node: GoPtr<Node>, t: GoPtr<Type>, property: GoPtr<Symbol>): bool {
  return Checker_isPropertyAccessible(
    receiver,
    node,
    node!.Kind === KindPropertyAccessExpression && Node_Expression(node)!.Kind === KindSuperKeyword,
    false, /*isWrite*/
    t,
    property,
  );
  // Previously we validated the 'this' type of methods but this adversely affected performance. See #31377 for more context.
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetAllPossiblePropertiesOfTypes","kind":"method","status":"implemented","sigHash":"d19bb8358dad6a0c67a7d1155b35a9979963170c9ab52d11f452e4d317c19f00","bodyHash":"ea89b06f40c269e2489063f3b92bc205852e74072f13ec35d1d21c46f4cd3a11"}
 *
 * Go source:
 * func (c *Checker) GetAllPossiblePropertiesOfTypes(types []*Type) []*ast.Symbol {
 * 	unionType := c.getUnionType(types)
 * 	if unionType.flags&TypeFlagsUnion == 0 {
 * 		return c.getAugmentedPropertiesOfType(unionType)
 * 	}
 * 
 * 	props := make(ast.SymbolTable)
 * 	for _, memberType := range types {
 * 		augmentedProps := c.getAugmentedPropertiesOfType(memberType)
 * 		for _, p := range augmentedProps {
 * 			if _, ok := props[p.Name]; !ok {
 * 				prop := c.createUnionOrIntersectionProperty(unionType, p.Name, false /*skipObjectFunctionPropertyAugment* /)
 * 				// May be undefined if the property is private
 * 				if prop != nil {
 * 					props[p.Name] = prop
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return slices.Collect(maps.Values(props))
 * }
 */
export function Checker_GetAllPossiblePropertiesOfTypes(receiver: GoPtr<Checker>, types: GoSlice<GoPtr<Type>>): GoSlice<GoPtr<Symbol>> {
  const unionType = Checker_getUnionType(receiver, types);
  if ((unionType!.flags & TypeFlagsUnion) === 0) {
    return Checker_getAugmentedPropertiesOfType(receiver, unionType);
  }

  const props: SymbolTable = new globalThis.Map();
  for (const memberType of types) {
    const augmentedProps = Checker_getAugmentedPropertiesOfType(receiver, memberType);
    for (const p of augmentedProps) {
      if (!props.has(p!.Name)) {
        const prop = Checker_createUnionOrIntersectionProperty(receiver, unionType, p!.Name, false /*skipObjectFunctionPropertyAugment*/);
        // May be undefined if the property is private
        if (prop !== undefined) {
          props.set(p!.Name, prop);
        }
      }
    }
  }
  return [...props.values()];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsUnknownSymbol","kind":"method","status":"implemented","sigHash":"5c55e456f2fcbb732159cd4c0d18dcfc1664d9cd6012239d002a4c99f21776b0","bodyHash":"a189bd44903f0f4237458dcc69a4da64fc6caf9854b77ae2061881e5600449a7"}
 *
 * Go source:
 * func (c *Checker) IsUnknownSymbol(symbol *ast.Symbol) bool {
 * 	return symbol == c.unknownSymbol
 * }
 */
export function Checker_IsUnknownSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  return symbol_ === receiver!.unknownSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsUndefinedSymbol","kind":"method","status":"implemented","sigHash":"353290e112cc87322b3ff762566c746587555780305c02b08867f54dc27f9bf2","bodyHash":"19a88576db6ccec1d26fb4ba5035d0f349b8e7d63fc5f0342544d8cb9ecb3d49"}
 *
 * Go source:
 * func (c *Checker) IsUndefinedSymbol(symbol *ast.Symbol) bool {
 * 	return symbol == c.undefinedSymbol
 * }
 */
export function Checker_IsUndefinedSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  return symbol_ === receiver!.undefinedSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsArgumentsSymbol","kind":"method","status":"implemented","sigHash":"aa47a77b719ad5025a273f8909faca465c6088b2afea818005316c3e9dd8004a","bodyHash":"aa9fa1ea708fce3542af183071935bd5baf1e887e4afcbd2935ddc4cae8f04a4"}
 *
 * Go source:
 * func (c *Checker) IsArgumentsSymbol(symbol *ast.Symbol) bool {
 * 	return symbol == c.argumentsSymbol
 * }
 */
export function Checker_IsArgumentsSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  return symbol_ === receiver!.argumentsSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetNonOptionalType","kind":"method","status":"implemented","sigHash":"054affb21a00bf7befa971dc75791f3c816b691d9844cf98c2ea93f877d447ba","bodyHash":"be618067a4e92d9dd8034b026c4cb950b4a7ccc2bdcb337bd29b10aaded35311"}
 *
 * Go source:
 * func (c *Checker) GetNonOptionalType(t *Type) *Type {
 * 	return c.removeOptionalTypeMarker(t)
 * }
 */
export function Checker_GetNonOptionalType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_removeOptionalTypeMarker(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetStringIndexType","kind":"method","status":"implemented","sigHash":"8ae7b86a72f8b02e129746234e99633aff292b8dad3c197613477c17d2d88443","bodyHash":"3be4eb1c59f74b0474c82aed48868ac6e3fded2345c5537c6a67c5aa2656ffab"}
 *
 * Go source:
 * func (c *Checker) GetStringIndexType(t *Type) *Type {
 * 	return c.getIndexTypeOfType(t, c.stringType)
 * }
 */
export function Checker_GetStringIndexType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getIndexTypeOfType(receiver, t, receiver!.stringType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetNumberIndexType","kind":"method","status":"implemented","sigHash":"a052cfdb2210416be81f07e7111bd299134fefa4f87834a936623dcc068b0093","bodyHash":"7e641e0e90674647830d85389265d964a6c6b68716e38b13de4e967972896b50"}
 *
 * Go source:
 * func (c *Checker) GetNumberIndexType(t *Type) *Type {
 * 	return c.getIndexTypeOfType(t, c.numberType)
 * }
 */
export function Checker_GetNumberIndexType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getIndexTypeOfType(receiver, t, receiver!.numberType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetElementTypeOfArrayType","kind":"method","status":"implemented","sigHash":"eb56b9875fdacb6e77909127cc9e41d300483fc7431a0fc685db4ee6d7371959","bodyHash":"b7a234aa509db415c7e28b7e7e04f1e7d739de00c7557b54c33cdbcc2d4d265d"}
 *
 * Go source:
 * func (c *Checker) GetElementTypeOfArrayType(t *Type) *Type {
 * 	return c.getElementTypeOfArrayType(t)
 * }
 */
export function Checker_GetElementTypeOfArrayType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  return Checker_getElementTypeOfArrayType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetCallSignatures","kind":"method","status":"implemented","sigHash":"12e8a95a3866ef1f4f8184c4dda07a30d292438ff8164cfc38722374f7be0a40","bodyHash":"c5c4fab28f21d477eb1bd75711b194a6bce83689c93a108f00842faf4ac4ca65"}
 *
 * Go source:
 * func (c *Checker) GetCallSignatures(t *Type) []*Signature {
 * 	return c.getSignaturesOfType(t, SignatureKindCall)
 * }
 */
export function Checker_GetCallSignatures(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Signature>> {
  return Checker_getSignaturesOfType(receiver, t, SignatureKindCall);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetConstructSignatures","kind":"method","status":"implemented","sigHash":"fd400cfaf8daed3fe54f2c14d478ee7cd1f5ba8bc8210fcb0c8a9195f79c9136","bodyHash":"6b0566b58e59590e175de55d592b0d6c805e1f5910bca916a303675a4e180153"}
 *
 * Go source:
 * func (c *Checker) GetConstructSignatures(t *Type) []*Signature {
 * 	return c.getSignaturesOfType(t, SignatureKindConstruct)
 * }
 */
export function Checker_GetConstructSignatures(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Signature>> {
  return Checker_getSignaturesOfType(receiver, t, SignatureKindConstruct);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetApparentProperties","kind":"method","status":"implemented","sigHash":"eb3b5574c5c7e6d8d6b59ec06d28145adda7979d41c923193d7f65ad2bfe3ba4","bodyHash":"4f4656b34ce118905f0c76f2975135470b0bde08e7c78b11afb7483d105da0f0"}
 *
 * Go source:
 * func (c *Checker) GetApparentProperties(t *Type) []*ast.Symbol {
 * 	return c.getAugmentedPropertiesOfType(t)
 * }
 */
export function Checker_GetApparentProperties(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Symbol>> {
  return Checker_getAugmentedPropertiesOfType(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getAugmentedPropertiesOfType","kind":"method","status":"implemented","sigHash":"7f7fb37becbb0a6d440c72a5de821496445c3a1ac4e72b69adc83964cd0b8962","bodyHash":"b0749c05ff2dc12217d46592ffdad5ae331098df519903a482ba97778b86b0e7"}
 *
 * Go source:
 * func (c *Checker) getAugmentedPropertiesOfType(t *Type) []*ast.Symbol {
 * 	t = c.getApparentType(t)
 * 	propsByName := createSymbolTable(c.getPropertiesOfType(t))
 * 	var functionType *Type
 * 	if len(c.getSignaturesOfType(t, SignatureKindCall)) > 0 {
 * 		functionType = c.globalCallableFunctionType
 * 	} else if len(c.getSignaturesOfType(t, SignatureKindConstruct)) > 0 {
 * 		functionType = c.globalNewableFunctionType
 * 	}
 * 
 * 	if propsByName == nil {
 * 		propsByName = make(ast.SymbolTable)
 * 	}
 * 	if functionType != nil {
 * 		for _, p := range c.getPropertiesOfType(functionType) {
 * 			if _, ok := propsByName[p.Name]; !ok {
 * 				propsByName[p.Name] = p
 * 			}
 * 		}
 * 	}
 * 	return c.getNamedMembers(propsByName, nil)
 * }
 */
export function Checker_getAugmentedPropertiesOfType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoSlice<GoPtr<Symbol>> {
  t = Checker_getApparentType(receiver, t);
  let propsByName = createSymbolTable(Checker_getPropertiesOfType(receiver, t));
  let functionType: GoPtr<Type> = undefined;
  if (Checker_getSignaturesOfType(receiver, t, SignatureKindCall).length > 0) {
    functionType = receiver!.globalCallableFunctionType;
  } else if (Checker_getSignaturesOfType(receiver, t, SignatureKindConstruct).length > 0) {
    functionType = receiver!.globalNewableFunctionType;
  }

  if (propsByName === undefined) {
    propsByName = new globalThis.Map();
  }
  if (functionType !== undefined) {
    for (const p of Checker_getPropertiesOfType(receiver, functionType)) {
      if (!propsByName.has(p!.Name)) {
        propsByName.set(p!.Name, p);
      }
    }
  }
  return Checker_getNamedMembers(receiver, propsByName, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.TryGetMemberInModuleExportsAndProperties","kind":"method","status":"implemented","sigHash":"d19367f368d6017674cc64c419b9702856ac02ba12c9faf8199b0cab28a812d2","bodyHash":"b13170f161ebfee81e1ff41f78a9e9ce26bf7d36d38102098e4daf88014ad581"}
 *
 * Go source:
 * func (c *Checker) TryGetMemberInModuleExportsAndProperties(memberName string, moduleSymbol *ast.Symbol) *ast.Symbol {
 * 	symbol := c.TryGetMemberInModuleExports(memberName, moduleSymbol)
 * 	if symbol != nil {
 * 		return symbol
 * 	}
 * 
 * 	exportEquals := c.resolveExternalModuleSymbol(moduleSymbol, false /*dontResolveAlias* /)
 * 	if exportEquals == moduleSymbol {
 * 		return nil
 * 	}
 * 
 * 	t := c.getTypeOfSymbol(exportEquals)
 * 	if c.shouldTreatPropertiesOfExternalModuleAsExports(t) {
 * 		return c.getPropertyOfType(t, memberName)
 * 	}
 * 	return nil
 * }
 */
export function Checker_TryGetMemberInModuleExportsAndProperties(receiver: GoPtr<Checker>, memberName: string, moduleSymbol: GoPtr<Symbol>): GoPtr<Symbol> {
  const symbol_ = Checker_TryGetMemberInModuleExports(receiver, memberName, moduleSymbol);
  if (symbol_ !== undefined) {
    return symbol_;
  }

  const exportEquals = Checker_resolveExternalModuleSymbol(receiver, moduleSymbol, false /*dontResolveAlias*/);
  if (exportEquals === moduleSymbol) {
    return undefined;
  }

  const t = Checker_getTypeOfSymbol(receiver, exportEquals);
  if (Checker_shouldTreatPropertiesOfExternalModuleAsExports(receiver, t)) {
    return Checker_getPropertyOfType(receiver, t, memberName);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.TryGetMemberInModuleExports","kind":"method","status":"implemented","sigHash":"6861cc4139dd43b8c60a17f409ce348c2f295482a62e5828e1154ec57bfb3374","bodyHash":"3a86ad9da0077e290e9bd05398dd9fe50222dfc84310416c6b75f029e2fb618c"}
 *
 * Go source:
 * func (c *Checker) TryGetMemberInModuleExports(memberName string, moduleSymbol *ast.Symbol) *ast.Symbol {
 * 	symbolTable := c.getExportsOfModule(moduleSymbol)
 * 	return symbolTable[memberName]
 * }
 */
export function Checker_TryGetMemberInModuleExports(receiver: GoPtr<Checker>, memberName: string, moduleSymbol: GoPtr<Symbol>): GoPtr<Symbol> {
  const symbolTable = Checker_getExportsOfModule(receiver, moduleSymbol);
  return symbolTable.get(memberName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.shouldTreatPropertiesOfExternalModuleAsExports","kind":"method","status":"implemented","sigHash":"8361d279785997be752fa1f85dafa5225499824a117cdeb4be044ecc84610c75","bodyHash":"b50d55fd5f6c75f5aaccc5ce17ea401997ddc10c64c34ff18883cbfa86b048b0"}
 *
 * Go source:
 * func (c *Checker) shouldTreatPropertiesOfExternalModuleAsExports(resolvedExternalModuleType *Type) bool {
 * 	return resolvedExternalModuleType.flags&TypeFlagsPrimitive == 0 ||
 * 		resolvedExternalModuleType.objectFlags&ObjectFlagsClass != 0 ||
 * 		// `isArrayOrTupleLikeType` is too expensive to use in this auto-imports hot path.
 * 		c.isArrayType(resolvedExternalModuleType) ||
 * 		isTupleType(resolvedExternalModuleType)
 * }
 */
export function Checker_shouldTreatPropertiesOfExternalModuleAsExports(receiver: GoPtr<Checker>, resolvedExternalModuleType: GoPtr<Type>): bool {
  return (resolvedExternalModuleType!.flags & TypeFlagsPrimitive) === 0 ||
    (resolvedExternalModuleType!.objectFlags & ObjectFlagsClass) !== 0 ||
    Checker_isArrayType(receiver, resolvedExternalModuleType) ||
    isTupleType(resolvedExternalModuleType);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetContextualType","kind":"method","status":"implemented","sigHash":"fd664d8d1cbd584c25e8ac122d62cc6b02e5936a8294330eb8ea348841bc54d2","bodyHash":"28376613deb7cf41bf34e7b88508578aaa8f66679f1c1e4acdd07db053da2ee4"}
 *
 * Go source:
 * func (c *Checker) GetContextualType(node *ast.Expression, contextFlags ContextFlags) *Type {
 * 	if contextFlags&ContextFlagsIgnoreNodeInferences != 0 {
 * 		return runWithInferenceBlockedFromSourceNode(c, node, func() *Type { return c.getContextualType(node, contextFlags) })
 * 	}
 * 	return c.getContextualType(node, contextFlags)
 * }
 */
export function Checker_GetContextualType(receiver: GoPtr<Checker>, node: GoPtr<Expression>, contextFlags: ContextFlags): GoPtr<Type> {
  if ((contextFlags & ContextFlagsIgnoreNodeInferences) !== 0) {
    return runWithInferenceBlockedFromSourceNode(receiver, node as unknown as GoPtr<Node>, () => Checker_getContextualType(receiver, node as unknown as GoPtr<Node>, contextFlags));
  }
  return Checker_getContextualType(receiver, node as unknown as GoPtr<Node>, contextFlags);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::func::runWithInferenceBlockedFromSourceNode","kind":"func","status":"implemented","sigHash":"21c0b086cf61177907d14cb861223f22b429806ca42bd4fcb98e16f3cf450f4e","bodyHash":"ec530e9090ba78b403a7cec02e3701e15c22c0082735327b09c71e45bb977711"}
 *
 * Go source:
 * func runWithInferenceBlockedFromSourceNode[T any](c *Checker, node *ast.Node, fn func() T) T {
 * 	containingCall := ast.FindAncestor(node, ast.IsCallLikeExpression)
 * 	if containingCall != nil {
 * 		toMarkSkip := node
 * 		for {
 * 			c.skipDirectInferenceNodes.Add(toMarkSkip)
 * 			toMarkSkip = toMarkSkip.Parent
 * 			if toMarkSkip == nil || toMarkSkip == containingCall {
 * 				break
 * 			}
 * 		}
 * 	}
 * 
 * 	c.isInferencePartiallyBlocked = true
 * 	result := runWithoutResolvedSignatureCaching(c, node, fn)
 * 	c.isInferencePartiallyBlocked = false
 * 
 * 	c.skipDirectInferenceNodes.Clear()
 * 	return result
 * }
 */
export function runWithInferenceBlockedFromSourceNode<T>(c: GoPtr<Checker>, node: GoPtr<Node>, fn: () => T): T {
  const containingCall = FindAncestor(node, IsCallLikeExpression);
  if (containingCall !== undefined) {
    let toMarkSkip: GoPtr<Node> = node;
    for (;;) {
      Set_Add(c!.skipDirectInferenceNodes, toMarkSkip);
      toMarkSkip = toMarkSkip!.Parent;
      if (toMarkSkip === undefined || toMarkSkip === containingCall) {
        break;
      }
    }
  }

  c!.isInferencePartiallyBlocked = true;
  const result = runWithoutResolvedSignatureCaching(c, node, fn);
  c!.isInferencePartiallyBlocked = false;

  Set_Clear(c!.skipDirectInferenceNodes);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::func::GetResolvedSignatureForSignatureHelp","kind":"func","status":"implemented","sigHash":"2f835bae262779696e4c9406d7421d267ef0f46a545e6f24693b35cba96ed9b0","bodyHash":"93f77f76de050c32420d25e50c7cdb3dee8cbc044bc8fa0cd2e42138ba7a5187"}
 *
 * Go source:
 * func GetResolvedSignatureForSignatureHelp(node *ast.Node, argumentCount int, c *Checker) (*Signature, []*Signature) {
 * 	type result struct {
 * 		signature  *Signature
 * 		candidates []*Signature
 * 	}
 * 	res := runWithoutResolvedSignatureCaching(c, node, func() result {
 * 		signature, candidates := c.getResolvedSignatureWorker(node, CheckModeIsForSignatureHelp, argumentCount)
 * 		return result{signature, candidates}
 * 	})
 * 	return res.signature, res.candidates
 * }
 */
export function GetResolvedSignatureForSignatureHelp(node: GoPtr<Node>, argumentCount: int, c: GoPtr<Checker>): [GoPtr<Signature>, GoSlice<GoPtr<Signature>>] {
  const res = runWithoutResolvedSignatureCaching(c, node, () => {
    const [signature, candidates] = Checker_getResolvedSignatureWorker(c, node, CheckModeIsForSignatureHelp, argumentCount);
    return { signature, candidates };
  });
  return [res.signature, res.candidates];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::func::runWithoutResolvedSignatureCaching","kind":"func","status":"implemented","sigHash":"5781b583fb7a3fc2b26cee69853a57d86d36a7fa28ea0cb13f89a61820ac2755","bodyHash":"0026e4f83be9784aaee2b823e840952b1cd82dd057bf645abd402a2105cd0c0b"}
 *
 * Go source:
 * func runWithoutResolvedSignatureCaching[T any](c *Checker, node *ast.Node, fn func() T) T {
 * 	ancestorNode := ast.FindAncestor(node, ast.IsCallLikeOrFunctionLikeExpression)
 * 	if ancestorNode != nil {
 * 		cachedResolvedSignatures := make(map[*SignatureLinks]*Signature)
 * 		cachedTypes := make(map[*ValueSymbolLinks]*Type)
 * 		for ancestorNode != nil {
 * 			signatureLinks := c.signatureLinks.Get(ancestorNode)
 * 			cachedResolvedSignatures[signatureLinks] = signatureLinks.resolvedSignature
 * 			signatureLinks.resolvedSignature = nil
 * 			if ast.IsFunctionExpressionOrArrowFunction(ancestorNode) {
 * 				symbolLinks := c.valueSymbolLinks.Get(c.getSymbolOfDeclaration(ancestorNode))
 * 				resolvedType := symbolLinks.resolvedType
 * 				cachedTypes[symbolLinks] = resolvedType
 * 				symbolLinks.resolvedType = nil
 * 			}
 * 			ancestorNode = ast.FindAncestor(ancestorNode.Parent, ast.IsCallLikeOrFunctionLikeExpression)
 * 		}
 * 		result := fn()
 * 		for signatureLinks, resolvedSignature := range cachedResolvedSignatures {
 * 			signatureLinks.resolvedSignature = resolvedSignature
 * 		}
 * 		for symbolLinks, resolvedType := range cachedTypes {
 * 			symbolLinks.resolvedType = resolvedType
 * 		}
 * 		return result
 * 	}
 * 	return fn()
 * }
 */
export function runWithoutResolvedSignatureCaching<T>(c: GoPtr<Checker>, node: GoPtr<Node>, fn: () => T): T {
  let ancestorNode = FindAncestor(node, IsCallLikeOrFunctionLikeExpression);
  if (ancestorNode !== undefined) {
    const cachedResolvedSignatures: Map<SignatureLinks, GoPtr<Signature>> = new globalThis.Map();
    const cachedTypes: Map<ValueSymbolLinks, GoPtr<Type>> = new globalThis.Map();
    let current: GoPtr<Node> = ancestorNode;
    while (current !== undefined) {
      const signatureLinks = LinkStore_Get<GoPtr<Node>, SignatureLinks>(c!.signatureLinks as unknown as LinkStore<GoPtr<Node>, SignatureLinks>, current)!;
      cachedResolvedSignatures.set(signatureLinks, signatureLinks.resolvedSignature);
      signatureLinks.resolvedSignature = undefined;
      if (IsFunctionExpressionOrArrowFunction(current)) {
        const symbolLinks = LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(c!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, Checker_getSymbolOfDeclaration(c, current))!;
        const resolvedType = symbolLinks.resolvedType;
        cachedTypes.set(symbolLinks, resolvedType);
        symbolLinks.resolvedType = undefined;
      }
      current = FindAncestor(current!.Parent, IsCallLikeOrFunctionLikeExpression);
    }
    const result = fn();
    for (const [signatureLinks, resolvedSignature] of cachedResolvedSignatures) {
      signatureLinks.resolvedSignature = resolvedSignature;
    }
    for (const [symbolLinks, resolvedType] of cachedTypes) {
      symbolLinks.resolvedType = resolvedType;
    }
    return result;
  }
  return fn();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.SkipAlias","kind":"method","status":"implemented","sigHash":"109c3b6afadb4e6b6c4b27ae73bb4262aabb5a9c6c4c9fbffd122df9860fcc10","bodyHash":"c97d4c305e1d8d0fca27be06f9b9c9f2e8ba7d6f283712428a448e23e8015ae5"}
 *
 * Go source:
 * func (c *Checker) SkipAlias(symbol *ast.Symbol) *ast.Symbol {
 * 	if symbol.Flags&ast.SymbolFlagsAlias != 0 {
 * 		return c.GetAliasedSymbol(symbol)
 * 	}
 * 	return symbol
 * }
 */
export function Checker_SkipAlias(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  if ((symbol_!.Flags & SymbolFlagsAlias) !== 0) {
    return Checker_GetAliasedSymbol(receiver, symbol_);
  }
  return symbol_;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetRootSymbols","kind":"method","status":"implemented","sigHash":"e32ffb42d2f40d400c7eeb332e719dbfd19ad638263339a689a4f9720626450d","bodyHash":"cb1b2ae5e0873b525a5f399bd94b0793c7a55010c43fb73f3ebff4c56646f160"}
 *
 * Go source:
 * func (c *Checker) GetRootSymbols(symbol *ast.Symbol) []*ast.Symbol {
 * 	roots := c.getImmediateRootSymbols(symbol)
 * 	if len(roots) == 0 {
 * 		return []*ast.Symbol{symbol}
 * 	}
 * 	var result []*ast.Symbol
 * 	for _, root := range roots {
 * 		result = append(result, c.GetRootSymbols(root)...)
 * 	}
 * 	return result
 * }
 */
export function Checker_GetRootSymbols(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>> {
  const roots = Checker_getImmediateRootSymbols(receiver, symbol_);
  if (roots.length === 0) {
    return [symbol_];
  }
  let result: GoSlice<GoPtr<Symbol>> = [];
  for (const root of roots) {
    result = result.concat(Checker_GetRootSymbols(receiver, root));
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetMappedTypeSymbolOfProperty","kind":"method","status":"implemented","sigHash":"718c631c382952f54b79f9b26278966abea52ff7d42dec8e063eec8ccd9556c7","bodyHash":"39355d0c7db074444297116c9e4a5e28fb96c35eb14995f8e4d36fc07494442f"}
 *
 * Go source:
 * func (c *Checker) GetMappedTypeSymbolOfProperty(symbol *ast.Symbol) *ast.Symbol {
 * 	if valueLinks := c.valueSymbolLinks.TryGet(symbol); valueLinks != nil {
 * 		return valueLinks.containingType.symbol
 * 	}
 * 	return nil
 * }
 */
export function Checker_GetMappedTypeSymbolOfProperty(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  const valueLinks = LinkStore_TryGet<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_);
  if (valueLinks !== undefined) {
    return Type_Symbol((valueLinks as ValueSymbolLinks).containingType);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getImmediateRootSymbols","kind":"method","status":"implemented","sigHash":"0d94ccb84df79308d09f63d3fdd7efb013096f40b1be8fd1508e974c2cbef4e3","bodyHash":"fe0c2170f66da8c1832419e5fc08b7221a83bb3c59b40694146793f6e40c7298"}
 *
 * Go source:
 * func (c *Checker) getImmediateRootSymbols(symbol *ast.Symbol) []*ast.Symbol {
 * 	if symbol.CheckFlags&ast.CheckFlagsSynthetic != 0 {
 * 		return core.MapNonNil(
 * 			c.valueSymbolLinks.Get(symbol).containingType.Types(),
 * 			func(t *Type) *ast.Symbol {
 * 				return c.getPropertyOfType(t, symbol.Name)
 * 			})
 * 	}
 * 	if symbol.Flags&ast.SymbolFlagsTransient != 0 {
 * 		if c.spreadLinks.Has(symbol) {
 * 			leftSpread := c.spreadLinks.Get(symbol).leftSpread
 * 			rightSpread := c.spreadLinks.Get(symbol).rightSpread
 * 			if leftSpread != nil {
 * 				return []*ast.Symbol{leftSpread, rightSpread}
 * 			}
 * 		}
 * 		if c.mappedSymbolLinks.Has(symbol) {
 * 			syntheticOrigin := c.mappedSymbolLinks.Get(symbol).syntheticOrigin
 * 			if syntheticOrigin != nil {
 * 				return []*ast.Symbol{syntheticOrigin}
 * 			}
 * 		}
 * 		target := c.tryGetTarget(symbol)
 * 		if target != nil {
 * 			return []*ast.Symbol{target}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getImmediateRootSymbols(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>> {
  if ((symbol_!.CheckFlags & CheckFlagsSynthetic) !== 0) {
    return MapNonNil(
      Type_Types((LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, symbol_) as ValueSymbolLinks).containingType),
      (t: GoPtr<Type>) => {
        return Checker_getPropertyOfType(receiver, t, symbol_!.Name);
      });
  }
  if ((symbol_!.Flags & SymbolFlagsTransient) !== 0) {
    if (LinkStore_Has(receiver!.spreadLinks, symbol_)) {
      const leftSpread = (LinkStore_Get<GoPtr<Symbol>, SpreadLinks>(receiver!.spreadLinks as unknown as LinkStore<GoPtr<Symbol>, SpreadLinks>, symbol_) as SpreadLinks).leftSpread;
      const rightSpread = (LinkStore_Get<GoPtr<Symbol>, SpreadLinks>(receiver!.spreadLinks as unknown as LinkStore<GoPtr<Symbol>, SpreadLinks>, symbol_) as SpreadLinks).rightSpread;
      if (leftSpread !== undefined) {
        return [leftSpread, rightSpread];
      }
    }
    if (LinkStore_Has(receiver!.mappedSymbolLinks, symbol_)) {
      const syntheticOrigin = (LinkStore_Get<GoPtr<Symbol>, MappedSymbolLinks>(receiver!.mappedSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, MappedSymbolLinks>, symbol_) as MappedSymbolLinks).syntheticOrigin;
      if (syntheticOrigin !== undefined) {
        return [syntheticOrigin];
      }
    }
    const target = Checker_tryGetTarget(receiver, symbol_);
    if (target !== undefined) {
      return [target];
    }
  }
  return [];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.tryGetTarget","kind":"method","status":"implemented","sigHash":"e5dfea124c5f0e196d9dfec60456a7450c7ae309065655c4a8eadcc016e7fa89","bodyHash":"da92c8493de7a5a91f61248c39f2f558b2853c929408c2aa80bfc4c4fafa4e82"}
 *
 * Go source:
 * func (c *Checker) tryGetTarget(symbol *ast.Symbol) *ast.Symbol {
 * 	var target *ast.Symbol
 * 	next := symbol
 * 	for {
 * 		if c.valueSymbolLinks.Has(next) {
 * 			next = c.valueSymbolLinks.Get(next).target
 * 		} else if c.exportTypeLinks.Has(next) {
 * 			next = c.exportTypeLinks.Get(next).target
 * 		} else {
 * 			next = nil
 * 		}
 * 		if next == nil {
 * 			break
 * 		}
 * 		target = next
 * 	}
 * 	return target
 * }
 */
export function Checker_tryGetTarget(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  let target: GoPtr<Symbol> = undefined;
  let next: GoPtr<Symbol> = symbol_;
  for (;;) {
    if (LinkStore_Has(receiver!.valueSymbolLinks, next)) {
      next = (LinkStore_Get<GoPtr<Symbol>, ValueSymbolLinks>(receiver!.valueSymbolLinks as unknown as LinkStore<GoPtr<Symbol>, ValueSymbolLinks>, next) as ValueSymbolLinks).target;
    } else if (LinkStore_Has(receiver!.exportTypeLinks, next)) {
      next = (LinkStore_Get<GoPtr<Symbol>, ExportTypeLinks>(receiver!.exportTypeLinks as unknown as LinkStore<GoPtr<Symbol>, ExportTypeLinks>, next) as ExportTypeLinks).target;
    } else {
      next = undefined;
    }
    if (next === undefined) {
      break;
    }
    target = next;
  }
  return target;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetExportSymbolOfSymbol","kind":"method","status":"implemented","sigHash":"cc50ee5c478892eeef541859e36687366efb00f591d83c58b0bcf63188c3cb6a","bodyHash":"39d182e3bf2da80597d992ec8300c1b07167f3a945a68ccbc2bea26dc3ece17b"}
 *
 * Go source:
 * func (c *Checker) GetExportSymbolOfSymbol(symbol *ast.Symbol) *ast.Symbol {
 * 	return c.getMergedSymbol(core.IfElse(symbol.ExportSymbol != nil, symbol.ExportSymbol, symbol))
 * }
 */
export function Checker_GetExportSymbolOfSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): GoPtr<Symbol> {
  return Checker_getMergedSymbol(receiver, IfElse(symbol_!.ExportSymbol !== undefined, symbol_!.ExportSymbol, symbol_));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetExportSpecifierLocalTargetSymbol","kind":"method","status":"implemented","sigHash":"a05157d6d2640e9095daa79c8da5bf76404186013496deaad9350e88e7ff4c74","bodyHash":"960300ff109f4c9477a8b31cefd67e58be91c42e232f36d4e18af382153b6c80"}
 *
 * Go source:
 * func (c *Checker) GetExportSpecifierLocalTargetSymbol(node *ast.Node) *ast.Symbol {
 * 	// node should be ExportSpecifier | Identifier
 * 	switch node.Kind {
 * 	case ast.KindExportSpecifier:
 * 		if node.Parent.Parent.ModuleSpecifier() != nil {
 * 			return c.getExternalModuleMember(node.Parent.Parent, node, false /*dontResolveAlias* /)
 * 		}
 * 		name := node.PropertyNameOrName()
 * 		if name.Kind == ast.KindStringLiteral {
 * 			// Skip for invalid syntax like this: export { "x" }
 * 			return nil
 * 		}
 * 		return c.resolveEntityName(name, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias, true /*ignoreErrors* /, false, nil)
 * 	case ast.KindIdentifier:
 * 		return c.resolveEntityName(node, ast.SymbolFlagsValue|ast.SymbolFlagsType|ast.SymbolFlagsNamespace|ast.SymbolFlagsAlias, true /*ignoreErrors* /, false, nil)
 * 	}
 * 	panic("Unhandled case in getExportSpecifierLocalTargetSymbol, node should be ExportSpecifier | Identifier")
 * }
 */
export function Checker_GetExportSpecifierLocalTargetSymbol(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Symbol> {
  // node should be ExportSpecifier | Identifier
  switch (node!.Kind) {
  case KindExportSpecifier: {
    if (Node_ModuleSpecifier(node!.Parent!.Parent) !== undefined) {
      return Checker_getExternalModuleMember(receiver, node!.Parent!.Parent, node, false /*dontResolveAlias*/);
    }
    const name = Node_PropertyNameOrName(node);
    if (name!.Kind === KindStringLiteral) {
      // Skip for invalid syntax like this: export { "x" }
      return undefined;
    }
    return Checker_resolveEntityName(receiver, name, SymbolFlagsValue | SymbolFlagsType | SymbolFlagsNamespace | SymbolFlagsAlias, true /*ignoreErrors*/, false, undefined);
  }
  case KindIdentifier:
    return Checker_resolveEntityName(receiver, node, SymbolFlagsValue | SymbolFlagsType | SymbolFlagsNamespace | SymbolFlagsAlias, true /*ignoreErrors*/, false, undefined);
  default:
    throw new globalThis.Error("Unhandled case in getExportSpecifierLocalTargetSymbol, node should be ExportSpecifier | Identifier");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetShorthandAssignmentValueSymbol","kind":"method","status":"implemented","sigHash":"6e700dfddcb9e199fe8f29a18a298d593d13a3d17a0d0352c92401c793fd689b","bodyHash":"b29d804bed18d7d8a88ceb23a80ef7be0598c7e21d4defe85e455e19c6ada86a"}
 *
 * Go source:
 * func (c *Checker) GetShorthandAssignmentValueSymbol(location *ast.Node) *ast.Symbol {
 * 	if location != nil && location.Kind == ast.KindShorthandPropertyAssignment {
 * 		return c.resolveEntityName(location.Name(), ast.SymbolFlagsValue|ast.SymbolFlagsAlias, true /*ignoreErrors* /, false, nil)
 * 	}
 * 	return nil
 * }
 */
export function Checker_GetShorthandAssignmentValueSymbol(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Symbol> {
  if (location !== undefined && location!.Kind === KindShorthandPropertyAssignment) {
    return Checker_resolveEntityName(receiver, Node_Name(location), SymbolFlagsValue | SymbolFlagsAlias, true /*ignoreErrors*/, false, undefined);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetSymbolsOfParameterPropertyDeclaration","kind":"method","status":"implemented","sigHash":"0f952b3ff5190c158b1290a221ad9a229fb98b5581d46df5925d04754339583b","bodyHash":"15f6bbf4fbd85c3990d48ac682764bf6125f010865690142f0b0bc2547818348"}
 *
 * Go source:
 * func (c *Checker) GetSymbolsOfParameterPropertyDeclaration(parameter *ast.Node /*ParameterPropertyDeclaration* /, parameterName string) (*ast.Symbol, *ast.Symbol) {
 * 	constructorDeclaration := parameter.Parent
 * 	classDeclaration := parameter.Parent.Parent
 * 
 * 	parameterSymbol := c.getSymbol(constructorDeclaration.Locals(), parameterName, ast.SymbolFlagsValue)
 * 	propertySymbol := c.getSymbol(c.getMembersOfSymbol(classDeclaration.Symbol()), parameterName, ast.SymbolFlagsValue)
 * 
 * 	if parameterSymbol != nil && propertySymbol != nil {
 * 		return parameterSymbol, propertySymbol
 * 	}
 * 
 * 	panic("There should exist two symbols, one as property declaration and one as parameter declaration")
 * }
 */
export function Checker_GetSymbolsOfParameterPropertyDeclaration(receiver: GoPtr<Checker>, parameter: GoPtr<Node>, parameterName: string): [GoPtr<Symbol>, GoPtr<Symbol>] {
  const constructorDeclaration = parameter!.Parent;
  const classDeclaration = parameter!.Parent!.Parent;

  const parameterSymbol = Checker_getSymbol(receiver, Node_Locals(constructorDeclaration)!, parameterName, SymbolFlagsValue);
  const classSymbol = Node_Symbol(classDeclaration) as unknown as GoPtr<Symbol>;
  const propertySymbol = Checker_getSymbol(receiver, Checker_getMembersOfSymbol(receiver, classSymbol), parameterName, SymbolFlagsValue);

  if (parameterSymbol !== undefined && propertySymbol !== undefined) {
    return [parameterSymbol, propertySymbol];
  }

  throw new globalThis.Error("There should exist two symbols, one as property declaration and one as parameter declaration");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsDeclarationUsed","kind":"method","status":"implemented","sigHash":"2e74f3e145a17071fc0b543ab702c960577ab4d2ab9b7e3164b3dd6a3b45e3c5","bodyHash":"3a2cf8c833e2732b8cdabad494f6076e98f0e28a4775a103f3eadedfa360ed85"}
 *
 * Go source:
 * func (c *Checker) IsDeclarationUsed(
 * 	sourceFile *ast.SourceFile,
 * 	identifier *ast.Identifier,
 * 	jsxElementsPresent bool,
 * 	jsxModeNeedsExplicitImport bool,
 * ) bool {
 * 	if jsxElementsPresent && jsxModeNeedsExplicitImport {
 * 		jsxNamespace := c.getJsxNamespace(sourceFile.AsNode())
 * 		jsxFragmentFactory := c.GetJsxFragmentFactory(sourceFile.AsNode())
 * 		identifierText := identifier.Text
 * 		if identifierText == jsxNamespace {
 * 			return true
 * 		}
 * 		if jsxFragmentFactory != "" && identifierText == jsxFragmentFactory {
 * 			return true
 * 		}
 * 	}
 * 
 * 	symbol := c.GetSymbolAtLocation(identifier.AsNode())
 * 	if symbol == nil {
 * 		return true
 * 	}
 * 
 * 	return c.IsSymbolReferencedInFile(sourceFile, identifier, symbol)
 * }
 */
export function Checker_IsDeclarationUsed(receiver: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>, identifier: GoPtr<Identifier>, jsxElementsPresent: bool, jsxModeNeedsExplicitImport: bool): bool {
  if (jsxElementsPresent && jsxModeNeedsExplicitImport) {
    const jsxNamespace = Checker_getJsxNamespace(receiver, sourceFile as unknown as GoPtr<Node>);
    const jsxFragmentFactory = Checker_GetJsxFragmentFactory(receiver, sourceFile as unknown as GoPtr<Node>);
    const identifierText = identifier!.Text;
    if (identifierText === jsxNamespace) {
      return true;
    }
    if (jsxFragmentFactory !== "" && identifierText === jsxFragmentFactory) {
      return true;
    }
  }

  const symbol_ = Checker_GetSymbolAtLocation(receiver, identifier as unknown as GoPtr<Node>);
  if (symbol_ === undefined) {
    return true;
  }

  return Checker_IsSymbolReferencedInFile(receiver, sourceFile, identifier, symbol_);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsSymbolReferencedInFile","kind":"method","status":"implemented","sigHash":"53b8fd5b4fd069a5c5f06ac319da712db6cc743598b164051228b4d5913645dd","bodyHash":"dec4836b5e8654293f0f2d1fa149b2e7b558568d423178fb703f40d8c6b67c81"}
 *
 * Go source:
 * func (c *Checker) IsSymbolReferencedInFile(
 * 	sourceFile *ast.SourceFile,
 * 	definition *ast.Identifier,
 * 	symbol *ast.Symbol,
 * ) bool {
 * 	identifierText := definition.Text
 * 	for _, token := range getPossibleSymbolReferenceNodes(sourceFile, identifierText, sourceFile.AsNode()) {
 * 		if !ast.IsIdentifier(token) {
 * 			continue
 * 		}
 * 		id := token.AsIdentifier()
 * 		if id == definition || id.Text != identifierText {
 * 			continue
 * 		}
 * 		refSymbol := c.GetSymbolAtLocation(token)
 * 		if refSymbol == symbol {
 * 			return true
 * 		}
 * 		if token.Parent != nil && token.Parent.Kind == ast.KindShorthandPropertyAssignment {
 * 			shorthandSymbol := c.GetShorthandAssignmentValueSymbol(token.Parent)
 * 			if shorthandSymbol == symbol {
 * 				return true
 * 			}
 * 		}
 * 		if token.Parent != nil && ast.IsExportSpecifier(token.Parent) {
 * 			localSymbol := c.getLocalSymbolForExportSpecifier(token.AsIdentifier(), refSymbol, token.Parent.AsExportSpecifier())
 * 			if localSymbol == symbol {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_IsSymbolReferencedInFile(receiver: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>, definition: GoPtr<Identifier>, symbol_: GoPtr<Symbol>): bool {
  const identifierText = definition!.Text;
  for (const token of getPossibleSymbolReferenceNodes(sourceFile, identifierText, sourceFile as unknown as GoPtr<Node>)) {
    if (!IsIdentifier(token)) {
      continue;
    }
    const id = AsIdentifier(token);
    if (id === definition as unknown as GoPtr<Node> || id!.Text !== identifierText) {
      continue;
    }
    const refSymbol = Checker_GetSymbolAtLocation(receiver, token);
    if (refSymbol === symbol_) {
      return true;
    }
    if (token!.Parent !== undefined && token!.Parent!.Kind === KindShorthandPropertyAssignment) {
      const shorthandSymbol = Checker_GetShorthandAssignmentValueSymbol(receiver, token!.Parent);
      if (shorthandSymbol === symbol_) {
        return true;
      }
    }
    if (token!.Parent !== undefined && IsExportSpecifier(token!.Parent)) {
      const localSymbol = Checker_getLocalSymbolForExportSpecifier(receiver, AsIdentifier(token), refSymbol, AsExportSpecifier(token!.Parent));
      if (localSymbol === symbol_) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetReferencesToSymbolInFile","kind":"method","status":"implemented","sigHash":"fe4b890e85dd90ab1a38fa00fab88f3bd6fdbc9fe63de343ff7f988807f5ec80","bodyHash":"983dc4e2bc54ca9e973d6f81adb13e3f7bef349d2829510b7ddb6c7116e8e7b5"}
 *
 * Go source:
 * func (c *Checker) GetReferencesToSymbolInFile(
 * 	sourceFile *ast.SourceFile,
 * 	symbol *ast.Symbol,
 * ) []*ast.Node {
 * 	identifierText := symbol.Name
 * 	var result []*ast.Node
 * 	for _, token := range getPossibleSymbolReferenceNodes(sourceFile, identifierText, sourceFile.AsNode()) {
 * 		if !ast.IsIdentifier(token) {
 * 			continue
 * 		}
 * 		id := token.AsIdentifier()
 * 		if id.Text != identifierText {
 * 			continue
 * 		}
 * 		refSymbol := c.GetSymbolAtLocation(token)
 * 		if refSymbol == symbol {
 * 			result = append(result, token)
 * 			continue
 * 		}
 * 		if token.Parent != nil && token.Parent.Kind == ast.KindShorthandPropertyAssignment {
 * 			shorthandSymbol := c.GetShorthandAssignmentValueSymbol(token.Parent)
 * 			if shorthandSymbol == symbol {
 * 				result = append(result, token)
 * 				continue
 * 			}
 * 		}
 * 		if token.Parent != nil && ast.IsExportSpecifier(token.Parent) {
 * 			localSymbol := c.getLocalSymbolForExportSpecifier(token.AsIdentifier(), refSymbol, token.Parent.AsExportSpecifier())
 * 			if localSymbol == symbol {
 * 				result = append(result, token)
 * 				continue
 * 			}
 * 		}
 * 	}
 * 	return result
 * }
 */
export function Checker_GetReferencesToSymbolInFile(receiver: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>, symbol_: GoPtr<Symbol>): GoSlice<GoPtr<Node>> {
  const identifierText = symbol_!.Name;
  let result: GoSlice<GoPtr<Node>> = [];
  for (const token of getPossibleSymbolReferenceNodes(sourceFile, identifierText, sourceFile as unknown as GoPtr<Node>)) {
    if (!IsIdentifier(token)) {
      continue;
    }
    const id = AsIdentifier(token);
    if (id!.Text !== identifierText) {
      continue;
    }
    const refSymbol = Checker_GetSymbolAtLocation(receiver, token);
    if (refSymbol === symbol_) {
      result = [...result, token];
      continue;
    }
    if (token!.Parent !== undefined && token!.Parent!.Kind === KindShorthandPropertyAssignment) {
      const shorthandSymbol = Checker_GetShorthandAssignmentValueSymbol(receiver, token!.Parent);
      if (shorthandSymbol === symbol_) {
        result = [...result, token];
        continue;
      }
    }
    if (token!.Parent !== undefined && IsExportSpecifier(token!.Parent)) {
      const localSymbol = Checker_getLocalSymbolForExportSpecifier(receiver, AsIdentifier(token), refSymbol, AsExportSpecifier(token!.Parent));
      if (localSymbol === symbol_) {
        result = [...result, token];
        continue;
      }
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getLocalSymbolForExportSpecifier","kind":"method","status":"implemented","sigHash":"47af3957dcb7a7066d16d477beeef6ef00f2d5164347c422fe3012b46da8e750","bodyHash":"b1a7c80abc904a1b06537fbfd12169f9ae7dc2fe8ffef7a8bd3c0404cad031d0"}
 *
 * Go source:
 * func (c *Checker) getLocalSymbolForExportSpecifier(referenceLocation *ast.Identifier, referenceSymbol *ast.Symbol, exportSpecifier *ast.ExportSpecifier) *ast.Symbol {
 * 	if isExportSpecifierAlias(referenceLocation, exportSpecifier) {
 * 		if symbol := c.GetExportSpecifierLocalTargetSymbol(exportSpecifier.AsNode()); symbol != nil {
 * 			return symbol
 * 		}
 * 	}
 * 	return referenceSymbol
 * }
 */
export function Checker_getLocalSymbolForExportSpecifier(receiver: GoPtr<Checker>, referenceLocation: GoPtr<Identifier>, referenceSymbol: GoPtr<Symbol>, exportSpecifier: GoPtr<ExportSpecifier>): GoPtr<Symbol> {
  if (isExportSpecifierAlias(referenceLocation, exportSpecifier)) {
    const symbol_ = Checker_GetExportSpecifierLocalTargetSymbol(receiver, exportSpecifier as unknown as GoPtr<Node>);
    if (symbol_ !== undefined) {
      return symbol_;
    }
  }
  return referenceSymbol;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::func::isExportSpecifierAlias","kind":"func","status":"implemented","sigHash":"d25eef483ad5d6905160e9cc446113cd717b6188b2bdbd7d6932776dc636a4d6","bodyHash":"71e57a86ffa1046e97145c6e8862959ff7ddeb2b6ebba23a1e90ac843e922184"}
 *
 * Go source:
 * func isExportSpecifierAlias(referenceLocation *ast.Identifier, exportSpecifier *ast.ExportSpecifier) bool {
 * 	debug.Assert(exportSpecifier.PropertyName == referenceLocation.AsNode() || exportSpecifier.Name() == referenceLocation.AsNode(), "referenceLocation is not export specifier name or property name")
 * 	propertyName := exportSpecifier.PropertyName
 * 	if propertyName != nil {
 * 		// Given `export { foo as bar } [from "someModule"]`: It's an alias at `foo`, but at `bar` it's a new symbol.
 * 		return propertyName == referenceLocation.AsNode()
 * 	} else {
 * 		// `export { foo } from "foo"` is a re-export.
 * 		// `export { foo };` is not a re-export, it creates an alias for the local variable `foo`.
 * 		return exportSpecifier.Parent.Parent.ModuleSpecifier() == nil
 * 	}
 * }
 */
export function isExportSpecifierAlias(referenceLocation: GoPtr<Identifier>, exportSpecifier: GoPtr<ExportSpecifier>): bool {
  // debug.Assert(...) skipped
  const propertyName = exportSpecifier!.PropertyName;
  if (propertyName !== undefined) {
    // Given `export { foo as bar } [from "someModule"]`: It's an alias at `foo`, but at `bar` it's a new symbol.
    return propertyName === referenceLocation as unknown as GoPtr<Node>;
  } else {
    // `export { foo } from "foo"` is a re-export.
    // `export { foo };` is not a re-export, it creates an alias for the local variable `foo`.
    return Node_ModuleSpecifier(exportSpecifier!.Parent!.Parent) === undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::func::getPossibleSymbolReferenceNodes","kind":"func","status":"implemented","sigHash":"af72b137a8aae24842f2415c1d789728d74f401db10ecf163ca6e1c507938053","bodyHash":"616ff7c830ab423ab0bb7c80435684d3192b4b2c9ad93585c23a085f5c21b5c2"}
 *
 * Go source:
 * func getPossibleSymbolReferenceNodes(sourceFile *ast.SourceFile, symbolName string, container *ast.Node) []*ast.Node {
 * 	return core.MapNonNil(getPossibleSymbolReferencePositions(sourceFile, symbolName, container), func(pos int) *ast.Node {
 * 		if referenceLocation := astnav.GetTouchingPropertyName(sourceFile, pos); referenceLocation != sourceFile.AsNode() {
 * 			return referenceLocation
 * 		}
 * 		return nil
 * 	})
 * }
 */
export function getPossibleSymbolReferenceNodes(sourceFile: GoPtr<SourceFile>, symbolName: string, container: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  return MapNonNil(getPossibleSymbolReferencePositions(sourceFile, symbolName, container), (pos: int) => {
    const referenceLocation = GetTouchingPropertyName(sourceFile, pos);
    if (referenceLocation !== (sourceFile as unknown as GoPtr<Node>)) {
      return referenceLocation;
    }
    return undefined;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::func::getPossibleSymbolReferencePositions","kind":"func","status":"implemented","sigHash":"19329cf2ec6544a463d1e83eab9f62ddd6a50fa0c4df6f8a94341db7949ead23","bodyHash":"06ad78c405ff650e3dd75037e202ab3b483ce20344f175c39cdabc06a06f3275"}
 *
 * Go source:
 * func getPossibleSymbolReferencePositions(sourceFile *ast.SourceFile, symbolName string, container *ast.Node) []int {
 * 	positions := []int{}
 * 
 * 	// TODO: Cache symbol existence for files to save text search
 * 	// Also, need to make this work for unicode escapes.
 * 
 * 	// Be resilient in the face of a symbol with no name or zero length name
 * 	if symbolName == "" {
 * 		return positions
 * 	}
 * 
 * 	text := sourceFile.Text()
 * 	sourceLength := len(text)
 * 	symbolNameLength := len(symbolName)
 * 
 * 	if container == nil {
 * 		container = sourceFile.AsNode()
 * 	}
 * 
 * 	position := strings.Index(text[container.Pos():], symbolName)
 * 	endPos := container.End()
 * 	for position >= 0 && position < endPos {
 * 		// We found a match.  Make sure it's not part of a larger word (i.e. the char
 * 		// before and after it have to be a non-identifier char).
 * 		endPosition := position + symbolNameLength
 * 
 * 		if (position == 0 || !scanner.IsIdentifierPart(rune(text[position-1]))) &&
 * 			(endPosition == sourceLength || !scanner.IsIdentifierPart(rune(text[endPosition]))) {
 * 			// Found a real match.  Keep searching.
 * 			positions = append(positions, position)
 * 		}
 * 		startIndex := position + symbolNameLength + 1
 * 		if startIndex > len(text) {
 * 			break
 * 		}
 * 		if foundIndex := strings.Index(text[startIndex:], symbolName); foundIndex != -1 {
 * 			position = startIndex + foundIndex
 * 		} else {
 * 			break
 * 		}
 * 	}
 * 
 * 	return positions
 * }
 */
export function getPossibleSymbolReferencePositions(sourceFile: GoPtr<SourceFile>, symbolName: string, container: GoPtr<Node>): GoSlice<int> {
  const positions: int[] = [];

  // TODO: Cache symbol existence for files to save text search
  // Also, need to make this work for unicode escapes.

  // Be resilient in the face of a symbol with no name or zero length name
  if (symbolName === "") {
    return positions;
  }

  const text = SourceFile_Text(sourceFile);
  const sourceLength = byteLen(text);
  const symbolNameLength = byteLen(symbolName);

  const containerNode = container ?? (sourceFile as unknown as GoPtr<Node>);

  let position = Index(byteSlice(text, Node_Pos(containerNode)), symbolName);
  const endPos = Node_End(containerNode);
  while (position >= 0 && position < endPos) {
    // We found a match.  Make sure it's not part of a larger word (i.e. the char
    // before and after it have to be a non-identifier char).
    const endPosition = position + symbolNameLength;

    if ((position === 0 || !IsIdentifierPart(byteAt(text, position - 1))) &&
      (endPosition === sourceLength || !IsIdentifierPart(byteAt(text, endPosition)))) {
      // Found a real match.  Keep searching.
      positions.push(position);
    }
    const startIndex = position + symbolNameLength + 1;
    if (startIndex > byteLen(text)) {
      break;
    }
    const foundIndex = Index(byteSlice(text, startIndex), symbolName);
    if (foundIndex !== -1) {
      position = startIndex + foundIndex;
    } else {
      break;
    }
  }

  return positions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetTypeArgumentConstraint","kind":"method","status":"implemented","sigHash":"dedbe9882c00ebe3ad22624823e6255bcec0d29d2d1a4795d9fca421c9fa3e19","bodyHash":"96cc72751097753ca51c6b13a45bfc3b7c88dc650846d53345fa8f1ee481fb74"}
 *
 * Go source:
 * func (c *Checker) GetTypeArgumentConstraint(node *ast.Node) *Type {
 * 	if !ast.IsTypeNode(node) {
 * 		return nil
 * 	}
 * 	return c.getTypeArgumentConstraint(node)
 * }
 */
export function Checker_GetTypeArgumentConstraint(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  if (!IsTypeNode(node)) {
    return undefined;
  }
  return Checker_getTypeArgumentConstraint(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getUninstantiatedSignatures","kind":"method","status":"implemented","sigHash":"815610b82ea0ff071e6fc24541e26c5160a4171fa70d5a98993afa57000570e4","bodyHash":"7e42134d95d09babd8b0b9882a56ae492022882f082ccfe1cbfa99920d9a3d44"}
 *
 * Go source:
 * func (c *Checker) getUninstantiatedSignatures(node *ast.Node) []*Signature {
 * 	switch node.Kind {
 * 	case ast.KindCallExpression, ast.KindDecorator:
 * 		return c.getSignaturesOfType(c.getTypeOfExpression(node.Expression()), SignatureKindCall)
 * 	case ast.KindNewExpression:
 * 		return c.getSignaturesOfType(c.getTypeOfExpression(node.Expression()), SignatureKindConstruct)
 * 	case ast.KindJsxSelfClosingElement, ast.KindJsxOpeningElement:
 * 		if isJsxIntrinsicTagName(node.TagName()) {
 * 			return nil
 * 		}
 * 		return c.getSignaturesOfType(c.getTypeOfExpression(node.TagName()), SignatureKindCall)
 * 	case ast.KindTaggedTemplateExpression:
 * 		return c.getSignaturesOfType(c.getTypeOfExpression(node.AsTaggedTemplateExpression().Tag), SignatureKindCall)
 * 	case ast.KindBinaryExpression, ast.KindJsxOpeningFragment:
 * 		return nil
 * 	}
 * 	return nil
 * }
 */
export function Checker_getUninstantiatedSignatures(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoSlice<GoPtr<Signature>> {
  switch (node!.Kind) {
  case KindCallExpression:
  case KindDecorator:
    return Checker_getSignaturesOfType(receiver, Checker_getTypeOfExpression(receiver, Node_Expression(node)), SignatureKindCall);
  case KindNewExpression:
    return Checker_getSignaturesOfType(receiver, Checker_getTypeOfExpression(receiver, Node_Expression(node)), SignatureKindConstruct);
  case KindJsxSelfClosingElement:
  case KindJsxOpeningElement:
    if (isJsxIntrinsicTagName(Node_TagName(node))) {
      return [];
    }
    return Checker_getSignaturesOfType(receiver, Checker_getTypeOfExpression(receiver, Node_TagName(node)), SignatureKindCall);
  case KindTaggedTemplateExpression:
    return Checker_getSignaturesOfType(receiver, Checker_getTypeOfExpression(receiver, AsTaggedTemplateExpression(node)!.Tag), SignatureKindCall);
  case KindBinaryExpression:
  case KindJsxOpeningFragment:
    return [];
  default:
    return [];
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getTypeParameterConstraintForPositionAcrossSignatures","kind":"method","status":"implemented","sigHash":"d09a677953fb6c832d714f19c77fee7247e9c6798721a40d182daf2dc67e28b7","bodyHash":"6b655cbcf3e80c198f82aa5d677e73ef243d5548628526c8665513d6163787a1"}
 *
 * Go source:
 * func (c *Checker) getTypeParameterConstraintForPositionAcrossSignatures(signatures []*Signature, position int) *Type {
 * 	var relevantConstraints []*Type
 * 	for _, signature := range signatures {
 * 		if position >= len(signature.typeParameters) {
 * 			continue
 * 		}
 * 		relevantTypeParameter := signature.typeParameters[position]
 * 		relevantConstraint := c.getConstraintOfTypeParameter(relevantTypeParameter)
 * 		if relevantConstraint != nil {
 * 			relevantConstraints = append(relevantConstraints, relevantConstraint)
 * 		}
 * 	}
 * 	return c.getUnionType(relevantConstraints)
 * }
 */
export function Checker_getTypeParameterConstraintForPositionAcrossSignatures(receiver: GoPtr<Checker>, signatures: GoSlice<GoPtr<Signature>>, position: int): GoPtr<Type> {
  let relevantConstraints: GoSlice<GoPtr<Type>> = [];
  for (const signature of signatures) {
    if (position >= signature!.typeParameters!.length) {
      continue;
    }
    const relevantTypeParameter = signature!.typeParameters![position];
    const relevantConstraint = Checker_getConstraintOfTypeParameter(receiver, relevantTypeParameter);
    if (relevantConstraint !== undefined) {
      relevantConstraints = relevantConstraints.concat([relevantConstraint]);
    }
  }
  return Checker_getUnionType(receiver, relevantConstraints);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getTypeArgumentConstraint","kind":"method","status":"implemented","sigHash":"0730e99d9d9d3cf8b37ce707dcd838687e4ab8519c17d5136f54c627b2e93291","bodyHash":"ef95d47cbf162df465b8eba1d5ebf7114407678c98c25b8c7a2256b702fd51d8"}
 *
 * Go source:
 * func (c *Checker) getTypeArgumentConstraint(node *ast.Node) *Type {
 * 	var typeArgumentPosition int = -1
 * 	if ast.HasTypeArguments(node.Parent) {
 * 		typeArgs := node.Parent.TypeArguments()
 * 		for i, arg := range typeArgs {
 * 			if arg == node {
 * 				typeArgumentPosition = i
 * 				break
 * 			}
 * 		}
 * 	}
 * 
 * 	if typeArgumentPosition >= 0 {
 * 		// The node could be a type argument of a call, a `new` expression, a decorator, an
 * 		// instantiation expression, or a generic type instantiation.
 * 
 * 		if ast.IsCallLikeExpression(node.Parent) {
 * 			return c.getTypeParameterConstraintForPositionAcrossSignatures(
 * 				c.getUninstantiatedSignatures(node.Parent),
 * 				typeArgumentPosition,
 * 			)
 * 		}
 * 
 * 		if ast.IsDecorator(node.Parent.Parent) {
 * 			return c.getTypeParameterConstraintForPositionAcrossSignatures(
 * 				c.getUninstantiatedSignatures(node.Parent.Parent),
 * 				typeArgumentPosition,
 * 			)
 * 		}
 * 
 * 		if ast.IsExpressionWithTypeArguments(node.Parent) && ast.IsExpressionStatement(node.Parent.Parent) {
 * 			uninstantiatedType := c.checkExpression(node.Parent.Expression())
 * 
 * 			callConstraint := c.getTypeParameterConstraintForPositionAcrossSignatures(
 * 				c.getSignaturesOfType(uninstantiatedType, SignatureKindCall),
 * 				typeArgumentPosition,
 * 			)
 * 			constructConstraint := c.getTypeParameterConstraintForPositionAcrossSignatures(
 * 				c.getSignaturesOfType(uninstantiatedType, SignatureKindConstruct),
 * 				typeArgumentPosition,
 * 			)
 * 
 * 			// An instantiation expression instantiates both call and construct signatures, so
 * 			// if both exist type arguments must be assignable to both constraints.
 * 			if constructConstraint.flags&TypeFlagsNever != 0 {
 * 				return callConstraint
 * 			}
 * 			if callConstraint.flags&TypeFlagsNever != 0 {
 * 				return constructConstraint
 * 			}
 * 			return c.getIntersectionType([]*Type{callConstraint, constructConstraint})
 * 		}
 * 
 * 		if ast.IsTypeReferenceType(node.Parent) {
 * 			typeParameters := c.getTypeParametersForTypeReferenceOrImport(node.Parent)
 * 			if len(typeParameters) == 0 {
 * 				return nil
 * 			}
 * 			if typeArgumentPosition >= len(typeParameters) {
 * 				return nil
 * 			}
 * 			relevantTypeParameter := typeParameters[typeArgumentPosition]
 * 			constraint := c.getConstraintOfTypeParameter(relevantTypeParameter)
 * 			if constraint != nil {
 * 				return c.instantiateType(
 * 					constraint,
 * 					newTypeMapper(typeParameters, c.getEffectiveTypeArguments(node.Parent, typeParameters)))
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getTypeArgumentConstraint(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Type> {
  let typeArgumentPosition: int = -1;
  if (HasTypeArguments(node!.Parent)) {
    const typeArgs = Node_TypeArguments(node!.Parent) ?? [];
    for (let i = 0; i < typeArgs.length; i++) {
      if (typeArgs[i] === node) {
        typeArgumentPosition = i;
        break;
      }
    }
  }

  if (typeArgumentPosition >= 0) {
    // The node could be a type argument of a call, a `new` expression, a decorator, an
    // instantiation expression, or a generic type instantiation.

    if (IsCallLikeExpression(node!.Parent)) {
      return Checker_getTypeParameterConstraintForPositionAcrossSignatures(
        receiver,
        Checker_getUninstantiatedSignatures(receiver, node!.Parent),
        typeArgumentPosition,
      );
    }

    if (IsDecorator(node!.Parent!.Parent)) {
      return Checker_getTypeParameterConstraintForPositionAcrossSignatures(
        receiver,
        Checker_getUninstantiatedSignatures(receiver, node!.Parent!.Parent),
        typeArgumentPosition,
      );
    }

    if (IsExpressionWithTypeArguments(node!.Parent) && IsExpressionStatement(node!.Parent!.Parent)) {
      const uninstantiatedType = Checker_checkExpression(receiver, Node_Expression(node!.Parent));

      const callConstraint = Checker_getTypeParameterConstraintForPositionAcrossSignatures(
        receiver,
        Checker_getSignaturesOfType(receiver, uninstantiatedType, SignatureKindCall),
        typeArgumentPosition,
      );
      const constructConstraint = Checker_getTypeParameterConstraintForPositionAcrossSignatures(
        receiver,
        Checker_getSignaturesOfType(receiver, uninstantiatedType, SignatureKindConstruct),
        typeArgumentPosition,
      );

      // An instantiation expression instantiates both call and construct signatures, so
      // if both exist type arguments must be assignable to both constraints.
      if ((constructConstraint!.flags & TypeFlagsNever) !== 0) {
        return callConstraint;
      }
      if ((callConstraint!.flags & TypeFlagsNever) !== 0) {
        return constructConstraint;
      }
      return Checker_getIntersectionType(receiver, [callConstraint, constructConstraint]);
    }

    if (IsTypeReferenceType(node!.Parent)) {
      const typeParameters = Checker_getTypeParametersForTypeReferenceOrImport(receiver, node!.Parent);
      if (typeParameters.length === 0) {
        return undefined;
      }
      if (typeArgumentPosition >= typeParameters.length) {
        return undefined;
      }
      const relevantTypeParameter = typeParameters[typeArgumentPosition];
      const constraint = Checker_getConstraintOfTypeParameter(receiver, relevantTypeParameter);
      if (constraint !== undefined) {
        return Checker_instantiateType(
          receiver,
          constraint,
          newTypeMapper(typeParameters, Checker_getEffectiveTypeArguments(receiver, node!.Parent, typeParameters)));
      }
    }
  }

  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsTypeInvalidDueToUnionDiscriminant","kind":"method","status":"implemented","sigHash":"bec1ab3a98bf4af5d9a4b46eba4f266dbab9c48c089298e27b38e2594b968631","bodyHash":"66bf8867ed5b37f2dd6eb26b08f7618e3a37aa1dcf190de557a8646886a87dad"}
 *
 * Go source:
 * func (c *Checker) IsTypeInvalidDueToUnionDiscriminant(contextualType *Type, obj *ast.Node) bool {
 * 	properties := obj.Properties()
 * 	return core.Some(properties, func(property *ast.Node) bool {
 * 		var nameType *Type
 * 		propertyName := property.Name()
 * 		if propertyName != nil {
 * 			if ast.IsJsxNamespacedName(propertyName) {
 * 				nameType = c.getStringLiteralType(propertyName.Text())
 * 			} else {
 * 				nameType = c.getLiteralTypeFromPropertyName(propertyName)
 * 			}
 * 		}
 * 		var name string
 * 		if nameType != nil && isTypeUsableAsPropertyName(nameType) {
 * 			name = getPropertyNameFromType(nameType)
 * 		}
 * 		var expected *Type
 * 		if name != "" {
 * 			expected = c.getTypeOfPropertyOfType(contextualType, name)
 * 		}
 * 		return expected != nil && isLiteralType(expected) && !c.isTypeAssignableTo(c.getTypeOfNode(property), expected)
 * 	})
 * }
 */
export function Checker_IsTypeInvalidDueToUnionDiscriminant(receiver: GoPtr<Checker>, contextualType: GoPtr<Type>, obj: GoPtr<Node>): bool {
  const properties = Node_Properties(obj) ?? [];
  return Some(properties, (property: GoPtr<Node>) => {
    let nameType: GoPtr<Type> = undefined;
    const propertyName = Node_Name(property);
    if (propertyName !== undefined) {
      if (IsJsxNamespacedName(propertyName)) {
        nameType = Checker_getStringLiteralType(receiver, Node_Text(propertyName));
      } else {
        nameType = Checker_getLiteralTypeFromPropertyName(receiver, propertyName);
      }
    }
    let name = "";
    if (nameType !== undefined && isTypeUsableAsPropertyName(nameType)) {
      name = getPropertyNameFromType(nameType);
    }
    let expected: GoPtr<Type> = undefined;
    if (name !== "") {
      expected = Checker_getTypeOfPropertyOfType(receiver, contextualType, name);
    }
    return expected !== undefined && isLiteralType(expected) && !Checker_isTypeAssignableTo(receiver, Checker_getTypeOfNode(receiver, property), expected);
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetExportsAndPropertiesOfModule","kind":"method","status":"implemented","sigHash":"de2b2caa23628a12baddef1272ab16e86e1b9d49b2a34fc678a45fb50acc002a","bodyHash":"95edb2e2671b237608a6bc353fb73701e8f29ebf44e2cd14014efac1d87aef1e"}
 *
 * Go source:
 * func (c *Checker) GetExportsAndPropertiesOfModule(moduleSymbol *ast.Symbol) []*ast.Symbol {
 * 	exports := c.getExportsOfModuleAsArray(moduleSymbol)
 * 	exportEquals := c.resolveExternalModuleSymbol(moduleSymbol, false /*dontResolveAlias* /)
 * 	if exportEquals != moduleSymbol {
 * 		t := c.getTypeOfSymbol(exportEquals)
 * 		if c.shouldTreatPropertiesOfExternalModuleAsExports(t) {
 * 			exports = append(exports, c.getPropertiesOfType(t)...)
 * 		}
 * 	}
 * 	return exports
 * }
 */
export function Checker_GetExportsAndPropertiesOfModule(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>> {
  let exports = Checker_getExportsOfModuleAsArray(receiver, moduleSymbol);
  const exportEquals = Checker_resolveExternalModuleSymbol(receiver, moduleSymbol, false /*dontResolveAlias*/);
  if (exportEquals !== moduleSymbol) {
    const t = Checker_getTypeOfSymbol(receiver, exportEquals);
    if (Checker_shouldTreatPropertiesOfExternalModuleAsExports(receiver, t)) {
      exports = exports.concat(Checker_getPropertiesOfType(receiver, t));
    }
  }
  return exports;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getExportsOfModuleAsArray","kind":"method","status":"implemented","sigHash":"52b4bf7d49483b852b6c128277b524957332eb0e0e39eca7d6ea6332bea2ca2b","bodyHash":"cfd211532b1bc7d1581c64daa2e8ea72392d99465b414bba45108b33c4ec7b24"}
 *
 * Go source:
 * func (c *Checker) getExportsOfModuleAsArray(moduleSymbol *ast.Symbol) []*ast.Symbol {
 * 	return symbolsToArray(c.getExportsOfModule(moduleSymbol))
 * }
 */
export function Checker_getExportsOfModuleAsArray(receiver: GoPtr<Checker>, moduleSymbol: GoPtr<Symbol>): GoSlice<GoPtr<Symbol>> {
  return symbolsToArray(Checker_getExportsOfModule(receiver, moduleSymbol));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetJsxIntrinsicTagNamesAt","kind":"method","status":"implemented","sigHash":"b372f7c61e2383a101b488f7f01beb203c865f618e857e27ca8adecb9f5ba5fb","bodyHash":"1dfd961d797cc1bd84edcad6e41973cf5f93fa14060a92ac34e86a66f8d0a0a8"}
 *
 * Go source:
 * func (c *Checker) GetJsxIntrinsicTagNamesAt(location *ast.Node) []*ast.Symbol {
 * 	intrinsics := c.getJsxType(JsxNames.IntrinsicElements, location)
 * 	if intrinsics == nil {
 * 		return nil
 * 	}
 * 	return c.GetPropertiesOfType(intrinsics)
 * }
 */
export function Checker_GetJsxIntrinsicTagNamesAt(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoSlice<GoPtr<Symbol>> {
  const intrinsics = Checker_getJsxType(receiver, JsxNames.IntrinsicElements, location);
  if (intrinsics === undefined) {
    return [];
  }
  return Checker_GetPropertiesOfType(receiver, intrinsics);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetContextualTypeForJsxAttribute","kind":"method","status":"implemented","sigHash":"e8d99ae977f5a5eac4701f191c3cc2124e303be5d9027a60d7aff3ab34da8cf1","bodyHash":"7a5b5ff2bf809854c79b78ee80145b52efd6ca0fd8d3c77571b982c5c4f754f4"}
 *
 * Go source:
 * func (c *Checker) GetContextualTypeForJsxAttribute(attribute *ast.JsxAttributeLike) *Type {
 * 	return c.getContextualTypeForJsxAttribute(attribute, ContextFlagsNone)
 * }
 */
export function Checker_GetContextualTypeForJsxAttribute(receiver: GoPtr<Checker>, attribute: GoPtr<JsxAttributeLike>): GoPtr<Type> {
  return Checker_getContextualTypeForJsxAttribute(receiver, attribute, ContextFlagsNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetConstantValue","kind":"method","status":"implemented","sigHash":"fecd026f13dd0dd5bc22c5fd8c570a82e43e8f0a19846a2d726c31e32c4790af","bodyHash":"722ab3297df0379dec19a5f571897efef9055f7f496fdd85effb1e863f4d57dd"}
 *
 * Go source:
 * func (c *Checker) GetConstantValue(node *ast.Node) any {
 * 	if node.Kind == ast.KindEnumMember {
 * 		return c.getEnumMemberValue(node).Value
 * 	}
 * 
 * 	if c.symbolNodeLinks.Get(node).resolvedSymbol == nil {
 * 		c.checkExpressionCached(node) // ensure cached resolved symbol is set
 * 	}
 * 	symbol := c.symbolNodeLinks.Get(node).resolvedSymbol
 * 	if symbol == nil && ast.IsEntityNameExpression(node) {
 * 		symbol = c.resolveEntityName(
 * 			node,
 * 			ast.SymbolFlagsValue,
 * 			true,  /*ignoreErrors* /
 * 			false, /*dontResolveAlias* /
 * 			nil /*location* /)
 * 	}
 * 	if symbol != nil && symbol.Flags&ast.SymbolFlagsEnumMember != 0 {
 * 		// inline property\index accesses only for const enums
 * 		member := symbol.ValueDeclaration
 * 		if ast.IsEnumConst(member.Parent) {
 * 			return c.getEnumMemberValue(member).Value
 * 		}
 * 	}
 * 
 * 	return nil
 * }
 */
export function Checker_GetConstantValue(receiver: GoPtr<Checker>, node: GoPtr<Node>): unknown {
  if (node!.Kind === KindEnumMember) {
    return Checker_getEnumMemberValue(receiver, node).Value;
  }

  if ((LinkStore_Get<GoPtr<Node>, SymbolNodeLinks>(receiver!.symbolNodeLinks as unknown as LinkStore<GoPtr<Node>, SymbolNodeLinks>, node) as SymbolNodeLinks).resolvedSymbol === undefined) {
    Checker_checkExpressionCached(receiver, node); // ensure cached resolved symbol is set
  }
  let symbol_ = (LinkStore_Get<GoPtr<Node>, SymbolNodeLinks>(receiver!.symbolNodeLinks as unknown as LinkStore<GoPtr<Node>, SymbolNodeLinks>, node) as SymbolNodeLinks).resolvedSymbol as GoPtr<Symbol>;
  if (symbol_ === undefined && IsEntityNameExpression(node)) {
    symbol_ = Checker_resolveEntityName(
      receiver,
      node,
      SymbolFlagsValue,
      true,  /*ignoreErrors*/
      false, /*dontResolveAlias*/
      undefined /*location*/);
  }
  if (symbol_ !== undefined && (symbol_!.Flags & SymbolFlagsEnumMember) !== 0) {
    // inline property\index accesses only for const enums
    const member = symbol_!.ValueDeclaration;
    if (IsEnumConst(member!.Parent)) {
      return Checker_getEnumMemberValue(receiver, member).Value;
    }
  }

  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getResolvedSignatureWorker","kind":"method","status":"implemented","sigHash":"bf8ee9cbf6bafc05a1afee34be6ef2f95386135e6fd3e5adc4de9165a89f25c3","bodyHash":"d3856cb120fe6eb2a6181eb530ff4820bd01f2a912b84d11d497ea656538daaf"}
 *
 * Go source:
 * func (c *Checker) getResolvedSignatureWorker(node *ast.Node, checkMode CheckMode, argumentCount int) (*Signature, []*Signature) {
 * 	parsedNode := printer.NewEmitContext().ParseNode(node)
 * 	c.apparentArgumentCount = &argumentCount
 * 	candidatesOutArray := &[]*Signature{}
 * 	var res *Signature
 * 	if parsedNode != nil {
 * 		res = c.getResolvedSignature(parsedNode, candidatesOutArray, checkMode)
 * 	}
 * 	c.apparentArgumentCount = nil
 * 	return res, *candidatesOutArray
 * }
 */
export function Checker_getResolvedSignatureWorker(receiver: GoPtr<Checker>, node: GoPtr<Node>, checkMode: CheckMode, argumentCount: int): [GoPtr<Signature>, GoSlice<GoPtr<Signature>>] {
  const parsedNode = EmitContext_ParseNode(NewEmitContext(), node);
  receiver!.apparentArgumentCount = argumentCount;
  // In Go: candidatesOutArray := &[]*Signature{}, passed as pointer.
  // Since getResolvedSignature is also a stub, we pass undefined and return [].
  let res: GoPtr<Signature> = undefined;
  if (parsedNode !== undefined) {
    res = Checker_getResolvedSignature(receiver, parsedNode, undefined, checkMode);
  }
  receiver!.apparentArgumentCount = undefined;
  return [res, []];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetCandidateSignaturesForStringLiteralCompletions","kind":"method","status":"implemented","sigHash":"5fb97a798bb9810f1bee355bed1b534a869b8ee518ce9ad0ba0557491466fd25","bodyHash":"2b4a872fdf9cfc33434ec5d8bff6285a05d708af4dfe37be33a413ee4bbb153f"}
 *
 * Go source:
 * func (c *Checker) GetCandidateSignaturesForStringLiteralCompletions(call *ast.CallLikeExpression, editingArgument *ast.Node) []*Signature {
 * 	// first, get candidates when inference is blocked from the source node.
 * 	candidates := runWithInferenceBlockedFromSourceNode(c, editingArgument, func() []*Signature {
 * 		_, blockedInferenceCandidates := c.getResolvedSignatureWorker(call, CheckModeNormal, 0)
 * 		return blockedInferenceCandidates
 * 	})
 * 	candidatesSet := collections.NewSetFromItems(candidates...)
 * 
 * 	// next, get candidates where the source node is considered for inference.
 * 	otherCandidates := runWithoutResolvedSignatureCaching(c, editingArgument, func() []*Signature {
 * 		_, inferenceCandidates := c.getResolvedSignatureWorker(call, CheckModeNormal, 0)
 * 		return inferenceCandidates
 * 	})
 * 
 * 	for _, candidate := range otherCandidates {
 * 		if candidatesSet.Has(candidate) {
 * 			continue
 * 		}
 * 		candidates = append(candidates, candidate)
 * 	}
 * 
 * 	return candidates
 * }
 */
export function Checker_GetCandidateSignaturesForStringLiteralCompletions(receiver: GoPtr<Checker>, call: GoPtr<CallLikeExpression>, editingArgument: GoPtr<Node>): GoSlice<GoPtr<Signature>> {
  // first, get candidates when inference is blocked from the source node.
  let candidates = runWithInferenceBlockedFromSourceNode(receiver, editingArgument, () => {
    const [, blockedInferenceCandidates] = Checker_getResolvedSignatureWorker(receiver, call as unknown as GoPtr<Node>, CheckModeNormal, 0);
    return blockedInferenceCandidates;
  });
  const candidatesSet = new globalThis.Set(candidates);

  // next, get candidates where the source node is considered for inference.
  const otherCandidates = runWithoutResolvedSignatureCaching(receiver, editingArgument, () => {
    const [, inferenceCandidates] = Checker_getResolvedSignatureWorker(receiver, call as unknown as GoPtr<Node>, CheckModeNormal, 0);
    return inferenceCandidates;
  });

  for (const candidate of otherCandidates) {
    if (candidatesSet.has(candidate)) {
      continue;
    }
    candidates = candidates.concat([candidate]);
  }

  return candidates;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetTypeAtPosition","kind":"method","status":"implemented","sigHash":"c27720031507ff0fa6e638dca7b0482b591398c76a83b60e4bb9fe685f67b3b8","bodyHash":"762337844dc89340840ac04544913b75a3420c1c6bcdbfcd3c5b73e221ea733f"}
 *
 * Go source:
 * func (c *Checker) GetTypeAtPosition(s *Signature, pos int) *Type {
 * 	return c.getTypeAtPosition(s, pos)
 * }
 */
export function Checker_GetTypeAtPosition(receiver: GoPtr<Checker>, s: GoPtr<Signature>, pos: int): GoPtr<Type> {
  return Checker_getTypeAtPosition(receiver, s, pos);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetTypeParameterAtPosition","kind":"method","status":"implemented","sigHash":"5986ab31a19ea87107dffe1189d1bc8bab84bfa7af830876280c0ad620ba17c4","bodyHash":"01e6144894d7a1b025f63d3628f55b12c587b4d2cb2dd62ac308ad50ad3e552a"}
 *
 * Go source:
 * func (c *Checker) GetTypeParameterAtPosition(s *Signature, pos int) *Type {
 * 	t := c.getTypeAtPosition(s, pos)
 * 	if t.IsIndex() && isThisTypeParameter(t.AsIndexType().target) {
 * 		constraint := c.getBaseConstraintOfType(t.AsIndexType().target)
 * 		if constraint != nil {
 * 			return c.getIndexType(constraint)
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_GetTypeParameterAtPosition(receiver: GoPtr<Checker>, s: GoPtr<Signature>, pos: int): GoPtr<Type> {
  const t = Checker_getTypeAtPosition(receiver, s, pos);
  if (Type_IsIndex(t) && isThisTypeParameter(Type_AsIndexType(t)!.target)) {
    const constraint = Checker_getBaseConstraintOfType(receiver, Type_AsIndexType(t)!.target);
    if (constraint !== undefined) {
      return Checker_getIndexType(receiver, constraint);
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetContextualTypeForArrayLiteralAtPosition","kind":"method","status":"implemented","sigHash":"2f439d78c928c1dce7a1dbe3d29b694af2eeef272e3931e36cd0bbd649869a9d","bodyHash":"245cf31d768615ec435c561dae4a7c4504e444f9bad3ee41887aac6e69f118df"}
 *
 * Go source:
 * func (c *Checker) GetContextualTypeForArrayLiteralAtPosition(contextualArrayType *Type, arrayLiteral *ast.Node, position int) *Type {
 * 	if contextualArrayType == nil {
 * 		return nil
 * 	}
 * 	firstSpreadIndex, lastSpreadIndex := -1, -1
 * 	elementIndex := 0
 * 	elements := arrayLiteral.Elements()
 * 	for i, elem := range elements {
 * 		if elem.Pos() < position {
 * 			elementIndex++
 * 		}
 * 		if ast.IsSpreadElement(elem) {
 * 			if firstSpreadIndex == -1 {
 * 				firstSpreadIndex = i
 * 			}
 * 			lastSpreadIndex = i
 * 		}
 * 	}
 * 	// The array may be incomplete, so we don't know its final length.
 * 	return c.getContextualTypeForElementExpression(
 * 		contextualArrayType,
 * 		elementIndex,
 * 		-1, /*length* /
 * 		firstSpreadIndex,
 * 		lastSpreadIndex,
 * 	)
 * }
 */
export function Checker_GetContextualTypeForArrayLiteralAtPosition(receiver: GoPtr<Checker>, contextualArrayType: GoPtr<Type>, arrayLiteral: GoPtr<Node>, position: int): GoPtr<Type> {
  if (contextualArrayType === undefined) {
    return undefined;
  }
  let firstSpreadIndex = -1;
  let lastSpreadIndex = -1;
  let elementIndex = 0;
  const elements = Node_Elements(arrayLiteral) ?? [];
  for (let i = 0; i < elements.length; i++) {
    const elem = elements[i];
    if (Node_Pos(elem) < position) {
      elementIndex++;
    }
    if (IsSpreadElement(elem)) {
      if (firstSpreadIndex === -1) {
        firstSpreadIndex = i;
      }
      lastSpreadIndex = i;
    }
  }
  // The array may be incomplete, so we don't know its final length.
  return Checker_getContextualTypeForElementExpression(
    receiver,
    contextualArrayType,
    elementIndex,
    -1, /*length*/
    firstSpreadIndex,
    lastSpreadIndex,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::varGroup::knownGenericTypeNames","kind":"varGroup","status":"implemented","sigHash":"16df52e1e32250df26f6a1f3cb4860a1bdfaf51f84628a56bf30c067c200d4a1","bodyHash":"640dbf5ce378e3989e155c898a1a012cd646364f0e70823f46132f2a9bc7f0d7"}
 *
 * Go source:
 * var knownGenericTypeNames = map[string]struct{}{
 * 	"Array":            {},
 * 	"ArrayLike":        {},
 * 	"ReadonlyArray":    {},
 * 	"Promise":          {},
 * 	"PromiseLike":      {},
 * 	"Iterable":         {},
 * 	"IterableIterator": {},
 * 	"AsyncIterable":    {},
 * 	"Set":              {},
 * 	"WeakSet":          {},
 * 	"ReadonlySet":      {},
 * 	"Map":              {},
 * 	"WeakMap":          {},
 * 	"ReadonlyMap":      {},
 * 	"Partial":          {},
 * 	"Required":         {},
 * 	"Readonly":         {},
 * 	"Pick":             {},
 * 	"Omit":             {},
 * 	"NonNullable":      {},
 * }
 */
export let knownGenericTypeNames: GoMap<string, { readonly __tsgoEmpty?: never }> = new globalThis.Map<string, { readonly __tsgoEmpty?: never }>([
  ["Array", {}],
  ["ArrayLike", {}],
  ["ReadonlyArray", {}],
  ["Promise", {}],
  ["PromiseLike", {}],
  ["Iterable", {}],
  ["IterableIterator", {}],
  ["AsyncIterable", {}],
  ["Set", {}],
  ["WeakSet", {}],
  ["ReadonlySet", {}],
  ["Map", {}],
  ["WeakMap", {}],
  ["ReadonlyMap", {}],
  ["Partial", {}],
  ["Required", {}],
  ["Readonly", {}],
  ["Pick", {}],
  ["Omit", {}],
  ["NonNullable", {}],
]);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::func::isKnownGenericTypeName","kind":"func","status":"implemented","sigHash":"42d60a163bd5b4c1617b9aefa333259087ca1fce75ec3e1e560b6b0244550f5f","bodyHash":"85ceeeed08201be1fc751749b08335b21ac6babf789afe3ce032dcddef89094a"}
 *
 * Go source:
 * func isKnownGenericTypeName(name string) bool {
 * 	_, exists := knownGenericTypeNames[name]
 * 	return exists
 * }
 */
export function isKnownGenericTypeName(name: string): bool {
  return knownGenericTypeNames.has(name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetFirstTypeArgumentFromKnownType","kind":"method","status":"implemented","sigHash":"b49d68427f958e0d383fefc463ed979bf7855ca156ed589a8e9bd39b6c59c178","bodyHash":"bad76f6f96a54214a1f614509d63f7243eaea66c46955e5aa35cece5a4bcce6d"}
 *
 * Go source:
 * func (c *Checker) GetFirstTypeArgumentFromKnownType(t *Type) *Type {
 * 	if t.objectFlags&ObjectFlagsReference != 0 && t.symbol != nil && isKnownGenericTypeName(t.symbol.Name) {
 * 		symbol := c.getGlobalSymbol(t.symbol.Name, ast.SymbolFlagsType, nil)
 * 		if symbol != nil && symbol == t.Target().symbol {
 * 			return core.FirstOrNil(c.getTypeArguments(t))
 * 		}
 * 	}
 * 	if t.alias != nil && isKnownGenericTypeName(t.alias.symbol.Name) {
 * 		symbol := c.getGlobalSymbol(t.alias.symbol.Name, ast.SymbolFlagsType, nil)
 * 		if symbol != nil && symbol == t.alias.symbol {
 * 			return core.FirstOrNil(t.alias.typeArguments)
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_GetFirstTypeArgumentFromKnownType(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type> {
  const tSym = t!.symbol;
  if ((t!.objectFlags & ObjectFlagsReference) !== 0 && tSym !== undefined && isKnownGenericTypeName(tSym.Name)) {
    const symbol_ = Checker_getGlobalSymbol(receiver, tSym.Name, SymbolFlagsType, undefined);
    if (symbol_ !== undefined && symbol_ === Type_Symbol(Type_Target(t))) {
      return FirstOrNil(Checker_getTypeArguments(receiver, t));
    }
  }
  const tAlias = t!.alias;
  if (tAlias !== undefined && tAlias.symbol !== undefined && isKnownGenericTypeName(tAlias.symbol.Name)) {
    const symbol_ = Checker_getGlobalSymbol(receiver, tAlias.symbol.Name, SymbolFlagsType, undefined);
    if (symbol_ !== undefined && symbol_ === tAlias.symbol) {
      return FirstOrNil(tAlias.typeArguments);
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetPropertySymbolsFromContextualType","kind":"method","status":"implemented","sigHash":"8dfadb1ec08a631a684ee65c1889d3c4dfacc8ead9ddf6d6ede8b3eee36bbc1e","bodyHash":"b441926573f51ff8e77565e0b7fdf55f427fde413dc42b74dac05c681325e6f8"}
 *
 * Go source:
 * func (c *Checker) GetPropertySymbolsFromContextualType(node *ast.Node, contextualType *Type, unionSymbolOk bool) []*ast.Symbol {
 * 	name := ast.GetTextOfPropertyName(node.Name())
 * 	if name == "" {
 * 		return nil
 * 	}
 * 	if contextualType.flags&TypeFlagsUnion == 0 {
 * 		if symbol := c.getPropertyOfType(contextualType, name); symbol != nil {
 * 			return []*ast.Symbol{symbol}
 * 		}
 * 		return nil
 * 	}
 * 	filteredTypes := contextualType.Types()
 * 	if ast.IsObjectLiteralExpression(node.Parent) || ast.IsJsxAttributes(node.Parent) {
 * 		filteredTypes = core.Filter(filteredTypes, func(t *Type) bool {
 * 			return !c.IsTypeInvalidDueToUnionDiscriminant(t, node.Parent)
 * 		})
 * 	}
 * 	discriminatedPropertySymbols := core.MapNonNil(filteredTypes, func(t *Type) *ast.Symbol {
 * 		return c.getPropertyOfType(t, name)
 * 	})
 * 	if unionSymbolOk && (len(discriminatedPropertySymbols) == 0 || len(discriminatedPropertySymbols) == len(contextualType.Types())) {
 * 		if symbol := c.getPropertyOfType(contextualType, name); symbol != nil {
 * 			return []*ast.Symbol{symbol}
 * 		}
 * 	}
 * 	if len(filteredTypes) == 0 && len(discriminatedPropertySymbols) == 0 {
 * 		// Bad discriminant -- do again without discriminating
 * 		return core.MapNonNil(contextualType.Types(), func(t *Type) *ast.Symbol {
 * 			return c.getPropertyOfType(t, name)
 * 		})
 * 	}
 * 	// by eliminating duplicates we might even end up with a single symbol
 * 	// that helps with displaying better quick infos on properties of union types
 * 	return core.Deduplicate(discriminatedPropertySymbols)
 * }
 */
export function Checker_GetPropertySymbolsFromContextualType(receiver: GoPtr<Checker>, node: GoPtr<Node>, contextualType: GoPtr<Type>, unionSymbolOk: bool): GoSlice<GoPtr<Symbol>> {
  const name = GetTextOfPropertyName(Node_Name(node));
  if (name === "") {
    return [];
  }
  if ((contextualType!.flags & TypeFlagsUnion) === 0) {
    const symbol_ = Checker_getPropertyOfType(receiver, contextualType, name);
    if (symbol_ !== undefined) {
      return [symbol_];
    }
    return [];
  }
  let filteredTypes = Type_Types(contextualType);
  if (IsObjectLiteralExpression(node!.Parent) || IsJsxAttributes(node!.Parent)) {
    filteredTypes = Filter(filteredTypes, (t: GoPtr<Type>) => {
      return !Checker_IsTypeInvalidDueToUnionDiscriminant(receiver, t, node!.Parent);
    });
  }
  const discriminatedPropertySymbols = MapNonNil(filteredTypes, (t: GoPtr<Type>) => {
    return Checker_getPropertyOfType(receiver, t, name);
  });
  if (unionSymbolOk && (discriminatedPropertySymbols.length === 0 || discriminatedPropertySymbols.length === Type_Types(contextualType).length)) {
    const symbol_ = Checker_getPropertyOfType(receiver, contextualType, name);
    if (symbol_ !== undefined) {
      return [symbol_];
    }
  }
  if (filteredTypes.length === 0 && discriminatedPropertySymbols.length === 0) {
    // Bad discriminant -- do again without discriminating
    return MapNonNil(Type_Types(contextualType), (t: GoPtr<Type>) => {
      return Checker_getPropertyOfType(receiver, t, name);
    });
  }
  // by eliminating duplicates we might even end up with a single symbol
  // that helps with displaying better quick infos on properties of union types
  return Deduplicate(discriminatedPropertySymbols);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetPropertySymbolOfDestructuringAssignment","kind":"method","status":"implemented","sigHash":"48e2a546b107af4a382ad5ea41e90c361362c673a6aea12c63cd5f1dc3921bb3","bodyHash":"5e861a48c3774b13235ff2d5e42ac4335c54ef70583664105549c200f9c7d4f6"}
 *
 * Go source:
 * func (c *Checker) GetPropertySymbolOfDestructuringAssignment(location *ast.Node) *ast.Symbol {
 * 	if ast.IsArrayLiteralOrObjectLiteralDestructuringPattern(location.Parent.Parent) {
 * 		// Get the type of the object or array literal and then look for property of given name in the type
 * 		if typeOfObjectLiteral := c.getTypeOfAssignmentPattern(location.Parent.Parent); typeOfObjectLiteral != nil {
 * 			return c.getPropertyOfType(typeOfObjectLiteral, location.Text())
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_GetPropertySymbolOfDestructuringAssignment(receiver: GoPtr<Checker>, location: GoPtr<Node>): GoPtr<Symbol> {
  if (IsArrayLiteralOrObjectLiteralDestructuringPattern(location!.Parent!.Parent)) {
    // Get the type of the object or array literal and then look for property of given name in the type
    const typeOfObjectLiteral = Checker_getTypeOfAssignmentPattern(receiver, location!.Parent!.Parent);
    if (typeOfObjectLiteral !== undefined) {
      return Checker_getPropertyOfType(receiver, typeOfObjectLiteral, Node_Text(location));
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.getTypeOfAssignmentPattern","kind":"method","status":"implemented","sigHash":"2529d6a29263410934acc184582d341c589621207b599f48715e02e8489f006d","bodyHash":"5ef48e94a19a1ad96fbf829854c373f64741f7ea677009fe8da927c12a262198"}
 *
 * Go source:
 * func (c *Checker) getTypeOfAssignmentPattern(expr *ast.Node) *Type {
 * 	// If this is from "for of"
 * 	//     for ( { a } of elems) {
 * 	//     }
 * 	if ast.IsForOfStatement(expr.Parent) {
 * 		iteratedType := c.checkRightHandSideOfForOf(expr.Parent)
 * 		return c.checkDestructuringAssignment(expr, core.OrElse(iteratedType, c.errorType), CheckModeNormal, false)
 * 	}
 * 	// If this is from "for" initializer
 * 	//     for ({a } = elems[0];.....) { }
 * 	if ast.IsBinaryExpression(expr.Parent) {
 * 		iteratedType := c.getTypeOfExpression(expr.Parent.AsBinaryExpression().Right)
 * 		return c.checkDestructuringAssignment(expr, core.OrElse(iteratedType, c.errorType), CheckModeNormal, false)
 * 	}
 * 	// If this is from nested object binding pattern
 * 	//     for ({ skills: { primary, secondary } } = multiRobot, i = 0; i < 1; i++) {
 * 	if ast.IsPropertyAssignment(expr.Parent) {
 * 		node := expr.Parent.Parent
 * 		typeOfParentObjectLiteral := core.OrElse(c.getTypeOfAssignmentPattern(node), c.errorType)
 * 		propertyIndex := slices.Index(node.Properties(), expr.Parent)
 * 		return c.checkObjectLiteralDestructuringPropertyAssignment(node, typeOfParentObjectLiteral, propertyIndex, nil, false)
 * 	}
 * 	// Array literal assignment - array destructuring pattern
 * 	node := expr.Parent
 * 	//    [{ property1: p1, property2 }] = elems;
 * 	typeOfArrayLiteral := core.OrElse(c.getTypeOfAssignmentPattern(node), c.errorType)
 * 	elementType := core.OrElse(c.checkIteratedTypeOrElementType(IterationUseDestructuring, typeOfArrayLiteral, c.undefinedType, expr.Parent), c.errorType)
 * 	return c.checkArrayLiteralDestructuringElementAssignment(node, typeOfArrayLiteral, slices.Index(node.Elements(), expr), elementType, CheckModeNormal)
 * }
 */
export function Checker_getTypeOfAssignmentPattern(receiver: GoPtr<Checker>, expr: GoPtr<Node>): GoPtr<Type> {
  // If this is from "for of"
  //     for ( { a } of elems) {
  //     }
  if (IsForOfStatement(expr!.Parent)) {
    const iteratedType = Checker_checkRightHandSideOfForOf(receiver, expr!.Parent);
    return Checker_checkDestructuringAssignment(receiver, expr, OrElse(iteratedType, receiver!.errorType), CheckModeNormal, false);
  }
  // If this is from "for" initializer
  //     for ({a } = elems[0];.....) { }
  if (IsBinaryExpression(expr!.Parent)) {
    const iteratedType = Checker_getTypeOfExpression(receiver, AsBinaryExpression(expr!.Parent)!.Right);
    return Checker_checkDestructuringAssignment(receiver, expr, OrElse(iteratedType, receiver!.errorType), CheckModeNormal, false);
  }
  // If this is from nested object binding pattern
  //     for ({ skills: { primary, secondary } } = multiRobot, i = 0; i < 1; i++) {
  if (IsPropertyAssignment(expr!.Parent)) {
    const node = expr!.Parent!.Parent;
    const typeOfParentObjectLiteral = OrElse(Checker_getTypeOfAssignmentPattern(receiver, node), receiver!.errorType);
    const propertyIndex = Node_Properties(node)!.indexOf(expr!.Parent);
    return Checker_checkObjectLiteralDestructuringPropertyAssignment(receiver, node, typeOfParentObjectLiteral, propertyIndex, undefined, false);
  }
  // Array literal assignment - array destructuring pattern
  const node = expr!.Parent;
  //    [{ property1: p1, property2 }] = elems;
  const typeOfArrayLiteral = OrElse(Checker_getTypeOfAssignmentPattern(receiver, node), receiver!.errorType);
  const elementType = OrElse(Checker_checkIteratedTypeOrElementType(receiver, IterationUseDestructuring, typeOfArrayLiteral, receiver!.undefinedType, expr!.Parent), receiver!.errorType);
  return Checker_checkArrayLiteralDestructuringElementAssignment(receiver, node, typeOfArrayLiteral, Node_Elements(node)!.indexOf(expr), elementType, CheckModeNormal);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.GetSignatureFromDeclaration","kind":"method","status":"implemented","sigHash":"5fc4737a5fc20290ce203540b6615602514e243fbc398e608f86d0acb5fe5be1","bodyHash":"14c6204787c88ed2df9dbdb6d6f84c14cf7f669c077a6d057cbd2ddc6552cd8d"}
 *
 * Go source:
 * func (c *Checker) GetSignatureFromDeclaration(node *ast.Node) *Signature {
 * 	return c.getSignatureFromDeclaration(node)
 * }
 */
export function Checker_GetSignatureFromDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Signature> {
  return Checker_getSignatureFromDeclaration(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsLibSymbolForHoverVerbosity","kind":"method","status":"implemented","sigHash":"c1950386dc9a0cbd6a0c75d7dc5fa394691d982dd65a867feeb8a197af1032df","bodyHash":"72b5dbda455de3912c8f982268820651f4dc62425f04dcf3ae886d5df8d88d37"}
 *
 * Go source:
 * func (c *Checker) IsLibSymbolForHoverVerbosity(symbol *ast.Symbol) bool {
 * 	if symbol == nil {
 * 		return false
 * 	}
 * 	for _, decl := range symbol.Declarations {
 * 		sf := ast.GetSourceFileOfNode(decl)
 * 		if sf != nil && c.program.IsSourceFileDefaultLibrary(sf.Path()) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_IsLibSymbolForHoverVerbosity(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  if (symbol_ === undefined) {
    return false;
  }
  for (const decl of symbol_!.Declarations ?? []) {
    const sf = GetSourceFileOfNode(decl);
    if (sf !== undefined && receiver!.program.IsSourceFileDefaultLibrary(SourceFile_Path(sf))) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/services.go::method::Checker.IsLibTypeForHoverVerbosity","kind":"method","status":"implemented","sigHash":"a6181fb59739e393a6240e1708befa62eaf4e7ee7d70106e1b883a47f5248978","bodyHash":"93c2ae143beb784431ec309819a96f5cef44849f0dea46b7e19ede76e81aa55b"}
 *
 * Go source:
 * func (c *Checker) IsLibTypeForHoverVerbosity(t *Type) bool {
 * 	var symbol *ast.Symbol
 * 	if t.objectFlags&ObjectFlagsReference != 0 {
 * 		symbol = t.Target().Symbol()
 * 	} else {
 * 		symbol = t.Symbol()
 * 	}
 * 	if c.IsLibSymbolForHoverVerbosity(symbol) {
 * 		return true
 * 	}
 * 	return isTupleType(t)
 * }
 */
export function Checker_IsLibTypeForHoverVerbosity(receiver: GoPtr<Checker>, t: GoPtr<Type>): bool {
  let symbol_: GoPtr<Symbol>;
  if ((t!.objectFlags & ObjectFlagsReference) !== 0) {
    symbol_ = Type_Symbol(Type_Target(t));
  } else {
    symbol_ = Type_Symbol(t);
  }
  if (Checker_IsLibSymbolForHoverVerbosity(receiver, symbol_ as GoPtr<Symbol>)) {
    return true;
  }
  return isTupleType(t);
}
