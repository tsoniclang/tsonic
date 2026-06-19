import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import * as core from "../core/core.js";
import type { Node } from "../ast/spine.js";
import { Node_ForEachChild, Node_Name } from "../ast/spine.js";
import type { SourceFile } from "../ast/ast.js";
import { Node_Decorators, Node_Members, Node_Type, SourceFile_FileName, SourceFile_Path, AsSourceFile } from "../ast/ast.js";
import type { ClassExpressionNode, PropertyName } from "../ast/generated/unions.js";
import { AsImportEqualsDeclaration } from "../ast/generated/casts.js";
import { FindAncestorKind, ClassOrConstructorParameterIsDecorated, ClassElementOrClassElementParameterIsDecorated, IsPrivateIdentifierClassElementDeclaration, IsInitializedProperty, IsStatic, IsNamedEvaluationSource, GetModuleInstanceState, ModuleInstanceStateInstantiated, GetDeclarationContainer, IsExternalOrCommonJSModule, IsClassLike, IsFunctionExpressionOrArrowFunction, IsFunctionLike, GetSourceFileOfNode, IsEffectiveExternalModule, NewHasFileName } from "../ast/utilities.js";
import { IsClassStaticBlockDeclaration, IsComputedPropertyName, IsModuleDeclaration, IsPropertyAssignment, IsPropertyDeclaration, IsBindingElement, IsSourceFile } from "../ast/generated/predicates.js";
import { KindImportEqualsDeclaration } from "../ast/generated/kinds.js";
import type { Symbol } from "../ast/symbol.js";
import { SymbolFlagsValue } from "../ast/symbolflags.js";
import { NodeFlagsAmbient } from "../ast/generated/flags.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import { DiagnosticsCollection_Add } from "../ast/diagnostic.js";
import { DeclarationNameToString } from "../scanner/utilities.js";
import { ModuleKindCommonJS } from "../core/compileroptions.js";
import { CompilerOptions_GetUseDefineForClassFields } from "../core/compileroptions.js";
import { Tristate_IsTrue } from "../core/tristate.js";
import {
  Static_property_0_conflicts_with_built_in_property_Function_0_of_constructor_function_1,
  Duplicate_identifier_0_Compiler_reserves_name_1_in_top_level_scope_of_a_module,
  This_syntax_requires_an_imported_helper_named_1_which_does_not_exist_in_0_Consider_upgrading_your_version_of_0,
  This_syntax_requires_an_imported_helper_named_1_with_2_parameters_which_is_not_compatible_with_the_one_in_0_Consider_upgrading_your_version_of_0,
  This_syntax_requires_an_imported_helper_but_module_0_cannot_be_found,
} from "../diagnostics/generated/messages.js";
import type { ObjectFlags, Type } from "./types.js";
import {
  ObjectFlagsReference,
  TypeFlagsNone,
  TypeFlagsNever,
  TypeFlagsUnion,
  TypeFlagsInstantiable,
  TypeFlagsNumberLike,
  TypeFlagsNumber,
  ElementFlagsNonRequired,
  ElementFlagsVariadic,
  externalHelpersModuleNameText,
  ExternalEmitHelpersFirstEmitHelper,
  ExternalEmitHelpersLastEmitHelper,
  ExternalEmitHelpersRest,
  ExternalEmitHelpersDecorate,
  ExternalEmitHelpersMetadata,
  ExternalEmitHelpersParam,
  ExternalEmitHelpersAwaiter,
  ExternalEmitHelpersAwait,
  ExternalEmitHelpersAsyncGenerator,
  ExternalEmitHelpersAsyncDelegator,
  ExternalEmitHelpersAsyncValues,
  ExternalEmitHelpersExportStar,
  ExternalEmitHelpersImportStar,
  ExternalEmitHelpersImportDefault,
  ExternalEmitHelpersMakeTemplateObject,
  ExternalEmitHelpersClassPrivateFieldGet,
  ExternalEmitHelpersClassPrivateFieldSet,
  ExternalEmitHelpersClassPrivateFieldIn,
  ExternalEmitHelpersSetFunctionName,
  ExternalEmitHelpersPropKey,
  ExternalEmitHelpersAddDisposableResourceAndDisposeResources,
  ExternalEmitHelpersRewriteRelativeImportExtension,
  LanguageFeatureMinimumTarget,
  Type_AsTupleType,
  Type_AsObjectType,
  Type_AsTypeReference,
  Type_AsIndexedAccessType,
  Type_TargetTupleType,
} from "./types.js";
import type { ExternalEmitHelpers } from "./types.js";
import { walkUpOuterExpressions } from "./utilities.js";
import {
  Checker_mergeSymbol,
  Checker_getMergedSymbol,
  Checker_getSymbolOfDeclaration,
  Checker_getEffectivePropertyNameForPropertyNameNode,
  Checker_getSymbolOfNode,
  Checker_needCollisionCheckForIdentifier,
  Checker_distributeObjectOverIndexType,
  Checker_distributeIndexOverObjectType,
  Checker_getMappedTypeNameTypeKind,
  Checker_substituteIndexedMappedType,
  Checker_resolveSymbol,
  Checker_getExportsOfModule,
  Checker_getSymbol,
} from "./checker/symbols.js";
import { Checker_isMatchingReference } from "./flow.js";
import { Checker_symbolToString } from "./printer.js";
import { Checker_getParameterCount } from "./relater.js";
import {
  Checker_newObjectType,
  Checker_getPropagatingFlagsOfTypes,
  Checker_getTupleTargetType,
  Checker_checkCrossProductUnion,
  Checker_isGenericTupleType,
  Checker_isGenericMappedType,
  Checker_getElementTypeOfSliceOfTupleType,
  Checker_getSimplifiedType,
  Checker_mapType,
  TupleNormalizer_normalize,
} from "./checker/types.js";
import { Checker_getSignaturesOfSymbol } from "./checker/signatures.js";
import { Checker_resolveExternalModule } from "./checker/modules.js";
import { Checker_error, Checker_errorSkippedOnNoEmit } from "./checker/support.js";
import { Checker_getSourceFileLinks, MappedTypeNameTypeKindRemapping, getTypeListKey } from "./checker/state.js";
import type { Checker, TupleNormalizer } from "./checker/state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::constGroup::maxSerializationLevel","kind":"constGroup","status":"implemented","sigHash":"4f33ed9bc67d2935ce4a292f29d806a3d388a0b9587156cde0dd07382ca83f3a","bodyHash":"34754ef0971946b870a548e5a3238eaf27e321dd1b27840c3328674928059887"}
 *
 * Go source:
 * const maxSerializationLevel = 2
 */
export const maxSerializationLevel: int = 2;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.mergeGlobalSymbol","kind":"method","status":"implemented","sigHash":"b82155f00b9e944fa6046f8522635dcde3d4d3c4fb7db381a91d7c6ea6ea67b0","bodyHash":"40a4475948a3fd12369dbf2342c776b42e91b7c2a76f36f6f0fdf0007bb96407"}
 *
 * Go source:
 * func (c *Checker) mergeGlobalSymbol(symbol *ast.Symbol) {
 * 	globalSymbol := c.globals[symbol.Name]
 * 	var merged *ast.Symbol
 * 	if globalSymbol != nil {
 * 		merged = c.mergeSymbol(globalSymbol, symbol, false /*unidirectional* /)
 * 	} else {
 * 		merged = c.getMergedSymbol(symbol)
 * 	}
 * 	c.globals[symbol.Name] = merged
 * }
 */
export function Checker_mergeGlobalSymbol(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): void {
  const globalSymbol = receiver!.globals.get(symbol_!.Name);
  let merged: GoPtr<Symbol>;
  if (globalSymbol !== undefined) {
    merged = Checker_mergeSymbol(receiver, globalSymbol, symbol_, false as bool);
  } else {
    merged = Checker_getMergedSymbol(receiver, symbol_);
  }
  receiver!.globals.set(symbol_!.Name, merged);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassForStaticPropertyNameConflicts","kind":"method","status":"implemented","sigHash":"f7c0ab2ba593a876fa2b492e489c56c75ceb04268fa9cc1146b6edf96cd29f78","bodyHash":"482f776916205b99ef91c2bde1e39c74b28c222b58bbc1893c61566aba29a511"}
 *
 * Go source:
 * func (c *Checker) checkClassForStaticPropertyNameConflicts(node *ast.Node) {
 * 	if c.compilerOptions.GetUseDefineForClassFields() {
 * 		return
 * 	}
 * 	for _, member := range node.Members() {
 * 		memberNameNode := member.Name()
 * 		isStaticMember := ast.IsStatic(member)
 * 		if isStaticMember && memberNameNode != nil {
 * 			memberName, _ := c.getEffectivePropertyNameForPropertyNameNode(memberNameNode)
 * 			switch memberName {
 * 			case "name", "length", "caller", "arguments":
 * 				c.error(
 * 					memberNameNode,
 * 					diagnostics.Static_property_0_conflicts_with_built_in_property_Function_0_of_constructor_function_1,
 * 					memberName,
 * 					c.symbolToString(c.getSymbolOfDeclaration(node)),
 * 				)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkClassForStaticPropertyNameConflicts(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  if (CompilerOptions_GetUseDefineForClassFields(receiver!.compilerOptions)) {
    return;
  }
  for (const member of Node_Members(node) ?? []) {
    const memberNameNode = Node_Name(member);
    const isStaticMember = IsStatic(member);
    if (isStaticMember && memberNameNode !== undefined) {
      const [memberName] = Checker_getEffectivePropertyNameForPropertyNameNode(receiver, memberNameNode as GoPtr<PropertyName>);
      switch (memberName) {
        case "name":
        case "length":
        case "caller":
        case "arguments":
          Checker_error(
            receiver,
            memberNameNode,
            Static_property_0_conflicts_with_built_in_property_Function_0_of_constructor_function_1,
            memberName,
            Checker_symbolToString(receiver, Checker_getSymbolOfDeclaration(receiver, node)),
          );
          break;
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getFirstTransformableStaticClassElement","kind":"method","status":"implemented","sigHash":"e7a98e6cd6a28d730bd3c2f87ed253de70db7725a64886d518255332d5c7e4b6","bodyHash":"10ff3550d8fc4a486ffc7820aa434a0861fb418583a86867bb0d70a0e7c0c14b"}
 *
 * Go source:
 * func (c *Checker) getFirstTransformableStaticClassElement(node *ast.Node) *ast.Node {
 * 	willTransformStaticElementsOfDecoratedClass := !c.legacyDecorators &&
 * 		c.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators &&
 * 		ast.ClassOrConstructorParameterIsDecorated(false, node)
 * 	willTransformPrivateElementsOrClassStaticBlocks := c.languageVersion < LanguageFeatureMinimumTarget.PrivateNamesAndClassStaticBlocks || c.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators
 * 	willTransformInitializers := !c.emitStandardClassFields
 * 	if willTransformStaticElementsOfDecoratedClass || willTransformPrivateElementsOrClassStaticBlocks {
 * 		for _, member := range node.Members() {
 * 			if willTransformStaticElementsOfDecoratedClass && ast.ClassElementOrClassElementParameterIsDecorated(false, member, node) {
 * 				if firstDecorator := core.FirstOrNil(node.Decorators()); firstDecorator != nil {
 * 					return firstDecorator
 * 				}
 * 				return node
 * 			} else if willTransformPrivateElementsOrClassStaticBlocks {
 * 				if ast.IsClassStaticBlockDeclaration(member) {
 * 					return member
 * 				} else if ast.IsStatic(member) &&
 * 					(ast.IsPrivateIdentifierClassElementDeclaration(member) ||
 * 						willTransformInitializers && ast.IsInitializedProperty(member)) {
 * 					return member
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function Checker_getFirstTransformableStaticClassElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node> {
  const willTransformStaticElementsOfDecoratedClass = (!receiver!.legacyDecorators &&
    receiver!.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators &&
    ClassOrConstructorParameterIsDecorated(false as bool, node)) as bool;
  const willTransformPrivateElementsOrClassStaticBlocks = (receiver!.languageVersion < LanguageFeatureMinimumTarget.PrivateNamesAndClassStaticBlocks || receiver!.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators) as bool;
  const willTransformInitializers = (!receiver!.emitStandardClassFields) as bool;
  if (willTransformStaticElementsOfDecoratedClass || willTransformPrivateElementsOrClassStaticBlocks) {
    for (const member of Node_Members(node) ?? []) {
      if (willTransformStaticElementsOfDecoratedClass && ClassElementOrClassElementParameterIsDecorated(false as bool, member, node)) {
        const firstDecorator = core.FirstOrNil(Node_Decorators(node) ?? []);
        if (firstDecorator !== undefined) {
          return firstDecorator;
        }
        return node;
      } else if (willTransformPrivateElementsOrClassStaticBlocks) {
        if (IsClassStaticBlockDeclaration(member)) {
          return member;
        } else if (IsStatic(member) &&
          (IsPrivateIdentifierClassElementDeclaration(member) ||
            (willTransformInitializers && IsInitializedProperty(member)))) {
          return member;
        }
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkClassExpressionExternalHelpers","kind":"method","status":"implemented","sigHash":"bf4da360b68f8d8b35a17846e8122eb64e918c0a40215aed304f9e325c986dcf","bodyHash":"ff5245a366749b221ba50256087964b2b45859fb1b30a6cf938a4984e129841d"}
 *
 * Go source:
 * func (c *Checker) checkClassExpressionExternalHelpers(node *ast.ClassExpressionNode) {
 * 	if node.Name() != nil {
 * 		return
 * 	}
 * 	parent := walkUpOuterExpressions(node)
 * 	if !ast.IsNamedEvaluationSource(parent) {
 * 		return
 * 	}
 *
 * 	willTransformESDecorators := !c.legacyDecorators && c.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators
 * 	var location *ast.Node
 * 	if willTransformESDecorators && ast.ClassOrConstructorParameterIsDecorated(false, node) {
 * 		location = node
 * 		if firstDecorator := core.FirstOrNil(node.Decorators()); firstDecorator != nil {
 * 			location = firstDecorator
 * 		}
 * 	} else {
 * 		location = c.getFirstTransformableStaticClassElement(node)
 * 	}
 *
 * 	if location != nil {
 * 		c.checkExternalEmitHelpers(location, ExternalEmitHelpersSetFunctionName)
 * 		if (ast.IsPropertyAssignment(parent) || ast.IsPropertyDeclaration(parent) || ast.IsBindingElement(parent)) && ast.IsComputedPropertyName(parent.Name()) {
 * 			c.checkExternalEmitHelpers(location, ExternalEmitHelpersPropKey)
 * 		}
 * 	}
 * }
 */
export function Checker_checkClassExpressionExternalHelpers(receiver: GoPtr<Checker>, node: GoPtr<ClassExpressionNode>): void {
  if (Node_Name(node) !== undefined) {
    return;
  }
  const parent = walkUpOuterExpressions(node);
  if (!IsNamedEvaluationSource(parent)) {
    return;
  }

  const willTransformESDecorators = (!receiver!.legacyDecorators && receiver!.languageVersion < LanguageFeatureMinimumTarget.ClassAndClassElementDecorators) as bool;
  let location: GoPtr<Node>;
  if (willTransformESDecorators && ClassOrConstructorParameterIsDecorated(false as bool, node)) {
    location = node;
    const firstDecorator = core.FirstOrNil(Node_Decorators(node) ?? []);
    if (firstDecorator !== undefined) {
      location = firstDecorator;
    }
  } else {
    location = Checker_getFirstTransformableStaticClassElement(receiver, node);
  }

  if (location !== undefined) {
    Checker_checkExternalEmitHelpers(receiver, location, ExternalEmitHelpersSetFunctionName);
    if ((IsPropertyAssignment(parent) || IsPropertyDeclaration(parent) || IsBindingElement(parent)) && IsComputedPropertyName(Node_Name(parent))) {
      Checker_checkExternalEmitHelpers(receiver, location, ExternalEmitHelpersPropKey);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkCollisionWithGlobalObjectInGeneratedCode","kind":"method","status":"implemented","sigHash":"50f2b193c1cc24e78a4390d9400e10b9c076107f58e90d1a4e79863833f77ff3","bodyHash":"083c36d5969c29b0e235de89b15d30200a2f0e9671ebea02d7a52e1950bc425f"}
 *
 * Go source:
 * func (c *Checker) checkCollisionWithGlobalObjectInGeneratedCode(node *ast.Node, name *ast.Node) {
 * 	if name == nil || ast.IsClassLike(node) || !c.needCollisionCheckForIdentifier(node, name, "Object") {
 * 		return
 * 	}
 * 	// Uninstantiated modules shouldn't do this check
 * 	if ast.IsModuleDeclaration(node) && ast.GetModuleInstanceState(node) != ast.ModuleInstanceStateInstantiated {
 * 		return
 * 	}
 * 	// In case of variable declaration, node.parent is variable statement so look at the variable statement's parent
 * 	parent := ast.GetDeclarationContainer(node)
 * 	if ast.IsSourceFile(parent) && ast.IsExternalOrCommonJSModule(parent.AsSourceFile()) && c.program.GetEmitModuleFormatOfFile(parent.AsSourceFile()) == core.ModuleKindCommonJS {
 * 		// If the declaration happens to be in external module, report error that Object is a reserved identifier.
 * 		c.errorSkippedOnNoEmit(name, diagnostics.Duplicate_identifier_0_Compiler_reserves_name_1_in_top_level_scope_of_a_module, scanner.DeclarationNameToString(name), scanner.DeclarationNameToString(name))
 * 	}
 * }
 */
export function Checker_checkCollisionWithGlobalObjectInGeneratedCode(receiver: GoPtr<Checker>, node: GoPtr<Node>, name: GoPtr<Node>): void {
  if (name === undefined || IsClassLike(node) || !Checker_needCollisionCheckForIdentifier(receiver, node, name, "Object")) {
    return;
  }
  // Uninstantiated modules shouldn't do this check
  if (IsModuleDeclaration(node) && GetModuleInstanceState(node) !== ModuleInstanceStateInstantiated) {
    return;
  }
  // In case of variable declaration, node.parent is variable statement so look at the variable statement's parent
  const parent = GetDeclarationContainer(node);
  if (IsSourceFile(parent) && IsExternalOrCommonJSModule(AsSourceFile(parent)) && receiver!.program.GetEmitModuleFormatOfFile(NewHasFileName(SourceFile_FileName(AsSourceFile(parent)), SourceFile_Path(AsSourceFile(parent)))) === ModuleKindCommonJS) {
    // If the declaration happens to be in external module, report error that Object is a reserved identifier.
    Checker_errorSkippedOnNoEmit(receiver, name, Duplicate_identifier_0_Compiler_reserves_name_1_in_top_level_scope_of_a_module, DeclarationNameToString(name), DeclarationNameToString(name));
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addDiagnostic","kind":"method","status":"implemented","sigHash":"c245f83ad6b1b61ff59661705c0c44e5d9f6ba820211ac05481f23f348039643","bodyHash":"509c27d0820361e19284d0e8ddf566cb737624a6de87e5387aef246b02dfbe6e"}
 *
 * Go source:
 * func (c *Checker) addDiagnostic(diagnostic *ast.Diagnostic) {
 * 	// Discard diagnostics created while at the maximum number of recursive TypeToString invocations.
 * 	if c.serializationLevel < maxSerializationLevel {
 * 		c.diagnostics.Add(diagnostic)
 * 	}
 * }
 */
export function Checker_addDiagnostic(receiver: GoPtr<Checker>, diagnostic: GoPtr<Diagnostic>): void {
  // Discard diagnostics created while at the maximum number of recursive TypeToString invocations.
  if (receiver!.serializationLevel < maxSerializationLevel) {
    DiagnosticsCollection_Add(receiver!.diagnostics, diagnostic);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addSuggestionDiagnostic","kind":"method","status":"implemented","sigHash":"3b7aac864c2b84d4e6837b964c2b22550ee15aae0a53cbb1e0ad70d85bbe1cdb","bodyHash":"63a5a0d649622d211888b45d908b7b9cc6c1dbb53686ca7c5eb22dd048253618"}
 *
 * Go source:
 * func (c *Checker) addSuggestionDiagnostic(diagnostic *ast.Diagnostic) {
 * 	// Discard diagnostics created while at the maximum number of recursive TypeToString invocations.
 * 	if c.serializationLevel < maxSerializationLevel {
 * 		c.suggestionDiagnostics.Add(diagnostic)
 * 	}
 * }
 */
export function Checker_addSuggestionDiagnostic(receiver: GoPtr<Checker>, diagnostic: GoPtr<Diagnostic>): void {
  // Discard diagnostics created while at the maximum number of recursive TypeToString invocations.
  if (receiver!.serializationLevel < maxSerializationLevel) {
    DiagnosticsCollection_Add(receiver!.suggestionDiagnostics, diagnostic);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasParentWithTypeAnnotation","kind":"method","status":"implemented","sigHash":"cc0c96f546156b3b14b18cb31c46839afc79b06a48bc55d8e359182f03925e36","bodyHash":"0306c1f90e75ec3d456b959aa1b5ab6203f42e395a2c5a6193a36be731be7b8a"}
 *
 * Go source:
 * func (c *Checker) hasParentWithTypeAnnotation(symbol *ast.Symbol) bool {
 * 	if symbol.Parent != nil && symbol.Parent.ValueDeclaration != nil && ast.IsFunctionExpressionOrArrowFunction(symbol.Parent.ValueDeclaration) {
 * 		if possiblyAnnotatedSymbol := c.getSymbolOfNode(symbol.Parent.ValueDeclaration.Parent); possiblyAnnotatedSymbol != nil && possiblyAnnotatedSymbol.ValueDeclaration != nil {
 * 			return possiblyAnnotatedSymbol.ValueDeclaration.Type() != nil
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_hasParentWithTypeAnnotation(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool {
  if (symbol_!.Parent !== undefined && symbol_!.Parent!.ValueDeclaration !== undefined && IsFunctionExpressionOrArrowFunction(symbol_!.Parent!.ValueDeclaration)) {
    const possiblyAnnotatedSymbol = Checker_getSymbolOfNode(receiver, symbol_!.Parent!.ValueDeclaration!.Parent);
    if (possiblyAnnotatedSymbol !== undefined && possiblyAnnotatedSymbol!.ValueDeclaration !== undefined) {
      return (Node_Type(possiblyAnnotatedSymbol!.ValueDeclaration) !== undefined) as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.containsSameNamedThisProperty","kind":"method","status":"implemented","sigHash":"29e2910e244ceeab79973876dc82a3f07b59abf79d5673cd299569d4f8bd4b23","bodyHash":"ef5d0735bde23380f8ff07e129a4e0b7e17de500f446d56867439c3e4fd01a0a"}
 *
 * Go source:
 * func (c *Checker) containsSameNamedThisProperty(thisProperty *ast.Node, expression *ast.Node) bool {
 * 	var visit func(node *ast.Node) bool
 * 	visit = func(node *ast.Node) bool {
 * 		if c.isMatchingReference(thisProperty, node) {
 * 			return true
 * 		}
 * 		if ast.IsFunctionLike(node) {
 * 			return false
 * 		}
 * 		return node.ForEachChild(visit)
 * 	}
 * 	return visit(expression)
 * }
 */
export function Checker_containsSameNamedThisProperty(receiver: GoPtr<Checker>, thisProperty: GoPtr<Node>, expression: GoPtr<Node>): bool {
  const visit = (node: GoPtr<Node>): bool => {
    if (Checker_isMatchingReference(receiver, thisProperty, node)) {
      return true as bool;
    }
    if (IsFunctionLike(node)) {
      return false as bool;
    }
    return Node_ForEachChild(node, visit);
  };
  return visit(expression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createNormalizedTupleTypeEx","kind":"method","status":"implemented","sigHash":"4f4ea628889c0e9a6e31fef37e0d5172f7a5ee1c446daeb8e4807b11234d3dbd","bodyHash":"bf557dff42ce8274ac85e3c849834a4eaa6ab5d6e54c2fb6d0c7ddeadae42274"}
 *
 * Go source:
 * func (c *Checker) createNormalizedTupleTypeEx(target *Type, elementTypes []*Type, objectFlags ObjectFlags) *Type {
 * 	d := target.AsTupleType()
 * 	if d.combinedFlags&ElementFlagsNonRequired == 0 {
 * 		// No need to normalize when we only have regular required elements
 * 		return c.createTypeReferenceEx(target, elementTypes, objectFlags)
 * 	}
 * 	if d.combinedFlags&ElementFlagsVariadic != 0 {
 * 		for i, e := range elementTypes {
 * 			if i < len(d.elementInfos) && d.elementInfos[i].flags&ElementFlagsVariadic != 0 && e.flags&(TypeFlagsNever|TypeFlagsUnion) != 0 {
 * 				// Transform [A, ...(X | Y | Z)] into [A, ...X] | [A, ...Y] | [A, ...Z]
 * 				checkTypes := core.MapIndex(elementTypes, func(t *Type, i int) *Type {
 * 					if i < len(d.elementInfos) && d.elementInfos[i].flags&ElementFlagsVariadic != 0 {
 * 						return t
 * 					}
 * 					return c.unknownType
 * 				})
 * 				if c.checkCrossProductUnion(checkTypes) {
 * 					return c.mapType(e, func(t *Type) *Type {
 * 						return c.createNormalizedTupleTypeEx(target, core.ReplaceElement(elementTypes, i, t), objectFlags)
 * 					})
 * 				}
 * 			}
 * 		}
 * 	}
 * 	n := &TupleNormalizer{}
 * 	if !n.normalize(c, elementTypes[:len(d.elementInfos)], d.elementInfos) {
 * 		return c.errorType
 * 	}
 * 	if len(elementTypes) > len(d.elementInfos) {
 * 		n.types = append(n.types, elementTypes[len(d.elementInfos)])
 * 	}
 * 	tupleTarget := c.getTupleTargetType(n.infos, d.readonly)
 * 	switch {
 * 	case tupleTarget == c.emptyGenericType:
 * 		return c.emptyObjectType
 * 	case len(n.types) != 0:
 * 		return c.createTypeReferenceEx(tupleTarget, n.types, objectFlags)
 * 	}
 * 	return tupleTarget
 * }
 */
export function Checker_createNormalizedTupleTypeEx(receiver: GoPtr<Checker>, target: GoPtr<Type>, elementTypes: GoSlice<GoPtr<Type>>, objectFlags: ObjectFlags): GoPtr<Type> {
  const d = Type_AsTupleType(target)!;
  if ((d.combinedFlags & ElementFlagsNonRequired) === 0) {
    // No need to normalize when we only have regular required elements
    return Checker_createTypeReferenceEx(receiver, target, elementTypes, objectFlags);
  }
  if ((d.combinedFlags & ElementFlagsVariadic) !== 0) {
    for (let i = 0; i < elementTypes.length; i++) {
      const e = elementTypes[i];
      if (i < d.elementInfos.length && (d.elementInfos[i]!.flags & ElementFlagsVariadic) !== 0 && (e!.flags & (TypeFlagsNever | TypeFlagsUnion)) !== 0) {
        // Transform [A, ...(X | Y | Z)] into [A, ...X] | [A, ...Y] | [A, ...Z]
        const checkTypes = core.MapIndex(elementTypes, (t: GoPtr<Type>, ti: int): GoPtr<Type> => {
          if (ti < d.elementInfos.length && (d.elementInfos[ti]!.flags & ElementFlagsVariadic) !== 0) {
            return t;
          }
          return receiver!.unknownType;
        });
        if (Checker_checkCrossProductUnion(receiver, checkTypes)) {
          return Checker_mapType(receiver, e, (t: GoPtr<Type>): GoPtr<Type> =>
            Checker_createNormalizedTupleTypeEx(receiver, target, core.ReplaceElement(elementTypes, i, t), objectFlags));
        }
      }
    }
  }
  const n: TupleNormalizer = {
    c: undefined,
    types: [],
    infos: [],
    lastRequiredIndex: -1,
    firstRestIndex: -1,
    lastOptionalOrRestIndex: -1,
  };
  if (!TupleNormalizer_normalize(n, receiver, elementTypes.slice(0, d.elementInfos.length), d.elementInfos)) {
    return receiver!.errorType;
  }
  if (elementTypes.length > d.elementInfos.length) {
    n.types.push(elementTypes[d.elementInfos.length]);
  }
  const tupleTarget = Checker_getTupleTargetType(receiver, n.infos, d.readonly);
  if (tupleTarget === receiver!.emptyGenericType) {
    return receiver!.emptyObjectType;
  }
  if (n.types.length !== 0) {
    return Checker_createTypeReferenceEx(receiver, tupleTarget, n.types, objectFlags);
  }
  return tupleTarget;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createTypeReferenceEx","kind":"method","status":"implemented","sigHash":"f0e2d94fd9968195c4af11835051df6ae56b8f3af4769906866aa93b8f84f5d8","bodyHash":"61bdb57e6fe5c0cad5507b6a79b8f56a047891727c167e9b28819bfefe687c9b"}
 *
 * Go source:
 * func (c *Checker) createTypeReferenceEx(target *Type, typeArguments []*Type, objectFlags ObjectFlags) *Type {
 * 	id := getTypeListKey(typeArguments)
 * 	intf := target.AsInterfaceType()
 * 	if t, ok := intf.instantiations[id]; ok {
 * 		return t
 * 	}
 * 	t := c.newObjectType(ObjectFlagsReference|objectFlags|c.getPropagatingFlagsOfTypes(typeArguments, TypeFlagsNone), target.symbol)
 * 	d := t.AsTypeReference()
 * 	d.target = target
 * 	d.resolvedTypeArguments = typeArguments
 * 	intf.instantiations[id] = t
 * 	return t
 * }
 */
export function Checker_createTypeReferenceEx(receiver: GoPtr<Checker>, target: GoPtr<Type>, typeArguments: GoSlice<GoPtr<Type>>, objectFlags: ObjectFlags): GoPtr<Type> {
  const id = getTypeListKey(typeArguments);
  const intf = Type_AsObjectType(target);
  const cached = intf!.instantiations.get(id);
  if (cached !== undefined) {
    return cached;
  }
  const t = Checker_newObjectType(receiver, (ObjectFlagsReference | objectFlags | Checker_getPropagatingFlagsOfTypes(receiver, typeArguments, TypeFlagsNone)) as ObjectFlags, target!["symbol"]);
  Type_AsObjectType(t)!.target = target;
  Type_AsTypeReference(t)!.resolvedTypeArguments = typeArguments;
  intf!.instantiations.set(id, t);
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSimplifiedIndexedAccessTypeWorker","kind":"method","status":"implemented","sigHash":"3b9a57400da8c44daf0aff8604ba01e99a5a90ae6d3a0a5f9d0a417e9540349c","bodyHash":"a21b38b13a94cd1d10a988859946161df9025cb6a2f65791a68ebd41b36b5ffb"}
 *
 * Go source:
 * func (c *Checker) getSimplifiedIndexedAccessTypeWorker(t *Type, writing bool) *Type {
 * 	// We recursively simplify the object type as it may in turn be an indexed access type. For example, with
 * 	// '{ [P in T]: { [Q in U]: number } }[T][U]' we want to first simplify the inner indexed access type.
 * 	objectType := c.getSimplifiedType(t.AsIndexedAccessType().objectType, writing)
 * 	indexType := c.getSimplifiedType(t.AsIndexedAccessType().indexType, writing)
 * 	// T[A | B] -> T[A] | T[B] (reading)
 * 	// T[A | B] -> T[A] & T[B] (writing)
 * 	distributedOverIndex := c.distributeObjectOverIndexType(objectType, indexType, writing)
 * 	if distributedOverIndex != nil {
 * 		return distributedOverIndex
 * 	}
 * 	// Only do the inner distributions if the index can no longer be instantiated to cause index distribution again
 * 	if indexType.flags&TypeFlagsInstantiable == 0 {
 * 		// (T | U)[K] -> T[K] | U[K] (reading)
 * 		// (T | U)[K] -> T[K] & U[K] (writing)
 * 		// (T & U)[K] -> T[K] & U[K]
 * 		distributedOverObject := c.distributeIndexOverObjectType(objectType, indexType, writing)
 * 		if distributedOverObject != nil {
 * 			return distributedOverObject
 * 		}
 * 	}
 * 	// So ultimately (reading):
 * 	// ((A & B) | C)[K1 | K2] -> ((A & B) | C)[K1] | ((A & B) | C)[K2] -> (A & B)[K1] | C[K1] | (A & B)[K2] | C[K2] -> (A[K1] & B[K1]) | C[K1] | (A[K2] & B[K2]) | C[K2]
 * 	// A generic tuple type indexed by a number exists only when the index type doesn't select a
 * 	// fixed element. We simplify to either the combined type of all elements (when the index type
 * 	// the actual number type) or to the combined type of all non-fixed elements.
 * 	if c.isGenericTupleType(objectType) && indexType.flags&TypeFlagsNumberLike != 0 {
 * 		elementType := c.getElementTypeOfSliceOfTupleType(objectType, core.IfElse(indexType.flags&TypeFlagsNumber != 0, 0, objectType.TargetTupleType().fixedLength), 0 /*endSkipCount* /, writing, false)
 * 		if elementType != nil {
 * 			return elementType
 * 		}
 * 	}
 * 	// If the object type is a mapped type { [P in K]: E }, where K is generic, or { [P in K as N]: E }, where
 * 	// K is generic and N is assignable to P, instantiate E using a mapper that substitutes the index type for P.
 * 	// For example, for an index access { [P in K]: Box<T[P]> }[X], we construct the type Box<T[X]>.
 * 	if c.isGenericMappedType(objectType) {
 * 		if c.getMappedTypeNameTypeKind(objectType) != MappedTypeNameTypeKindRemapping {
 * 			return c.mapType(c.substituteIndexedMappedType(objectType, t.AsIndexedAccessType().indexType), func(t *Type) *Type {
 * 				return c.getSimplifiedType(t, writing)
 * 			})
 * 		}
 * 	}
 * 	return t
 * }
 */
export function Checker_getSimplifiedIndexedAccessTypeWorker(receiver: GoPtr<Checker>, t: GoPtr<Type>, writing: bool): GoPtr<Type> {
  // We recursively simplify the object type as it may in turn be an indexed access type. For example, with
  // '{ [P in T]: { [Q in U]: number } }[T][U]' we want to first simplify the inner indexed access type.
  const objectType = Checker_getSimplifiedType(receiver, Type_AsIndexedAccessType(t)!.objectType, writing);
  const indexType = Checker_getSimplifiedType(receiver, Type_AsIndexedAccessType(t)!.indexType, writing);
  // T[A | B] -> T[A] | T[B] (reading)
  // T[A | B] -> T[A] & T[B] (writing)
  const distributedOverIndex = Checker_distributeObjectOverIndexType(receiver, objectType, indexType, writing);
  if (distributedOverIndex !== undefined) {
    return distributedOverIndex;
  }
  // Only do the inner distributions if the index can no longer be instantiated to cause index distribution again
  if ((indexType!.flags & TypeFlagsInstantiable) === 0) {
    // (T | U)[K] -> T[K] | U[K] (reading)
    // (T | U)[K] -> T[K] & U[K] (writing)
    // (T & U)[K] -> T[K] & U[K]
    const distributedOverObject = Checker_distributeIndexOverObjectType(receiver, objectType, indexType, writing);
    if (distributedOverObject !== undefined) {
      return distributedOverObject;
    }
  }
  // So ultimately (reading):
  // ((A & B) | C)[K1 | K2] -> ((A & B) | C)[K1] | ((A & B) | C)[K2] -> (A & B)[K1] | C[K1] | (A & B)[K2] | C[K2] -> (A[K1] & B[K1]) | C[K1] | (A[K2] & B[K2]) | C[K2]
  // A generic tuple type indexed by a number exists only when the index type doesn't select a
  // fixed element. We simplify to either the combined type of all elements (when the index type
  // the actual number type) or to the combined type of all non-fixed elements.
  if (Checker_isGenericTupleType(receiver, objectType) && (indexType!.flags & TypeFlagsNumberLike) !== 0) {
    const elementType = Checker_getElementTypeOfSliceOfTupleType(receiver, objectType, core.IfElse((indexType!.flags & TypeFlagsNumber) !== 0, 0 as int, Type_TargetTupleType(objectType)!.fixedLength), 0 as int, writing, false as bool);
    if (elementType !== undefined) {
      return elementType;
    }
  }
  // If the object type is a mapped type { [P in K]: E }, where K is generic, or { [P in K as N]: E }, where
  // K is generic and N is assignable to P, instantiate E using a mapper that substitutes the index type for P.
  // For example, for an index access { [P in K]: Box<T[P]> }[X], we construct the type Box<T[X]>.
  if (Checker_isGenericMappedType(receiver, objectType)) {
    if (Checker_getMappedTypeNameTypeKind(receiver, objectType) !== MappedTypeNameTypeKindRemapping) {
      return Checker_mapType(receiver, Checker_substituteIndexedMappedType(receiver, objectType, Type_AsIndexedAccessType(t)!.indexType), (t2: GoPtr<Type>): GoPtr<Type> =>
        Checker_getSimplifiedType(receiver, t2, writing));
    }
  }
  return t;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::func::isPartOfImportEqualsModuleReference","kind":"func","status":"implemented","sigHash":"a950a4def9705bfed6ba83a617502908aeb58317a1142716cf78bdea9c05a60e","bodyHash":"a365cfc83e0f432e1f0a508d3372c48d6c5a4d704fdeb30d954bb9cd0a17e7a8"}
 *
 * Go source:
 * func isPartOfImportEqualsModuleReference(location *ast.Node) bool {
 * 	importEquals := ast.FindAncestorKind(location, ast.KindImportEqualsDeclaration)
 * 	if importEquals == nil {
 * 		return false
 * 	}
 * 	for node := location; node != nil && node != importEquals; node = node.Parent {
 * 		if node == importEquals.AsImportEqualsDeclaration().ModuleReference {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function isPartOfImportEqualsModuleReference(location: GoPtr<Node>): bool {
  const importEquals = FindAncestorKind(location, KindImportEqualsDeclaration);
  if (importEquals === undefined) {
    return false as bool;
  }
  for (let node: GoPtr<Node> = location; node !== undefined && node !== importEquals; node = node!.Parent) {
    if (node === AsImportEqualsDeclaration(importEquals)!.ModuleReference) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.checkExternalEmitHelpers","kind":"method","status":"implemented","sigHash":"de1f80d09f30e3f9413675ca7238f830f0f1cf83754f6b7da21d7e7cd6d59703","bodyHash":"3400aa1d1e7397f267630ddaf369c9ef47546546cc3ac993f76e4ff15f638ef9"}
 *
 * Go source:
 * func (c *Checker) checkExternalEmitHelpers(location *ast.Node, helpers ExternalEmitHelpers) {
 * 	if !c.compilerOptions.ImportHelpers.IsTrue() {
 * 		return
 * 	}
 * 	sourceFile := ast.GetSourceFileOfNode(location)
 * 	if !ast.IsEffectiveExternalModule(sourceFile, c.compilerOptions) || location.Flags&ast.NodeFlagsAmbient != 0 {
 * 		return
 * 	}
 * 	helpersModule := c.resolveHelpersModule(sourceFile, location)
 * 	if helpersModule == c.unknownSymbol {
 * 		return
 * 	}
 * 	links := c.sourceFileLinks.Get(sourceFile)
 * 	if links.requestedExternalEmitHelpers&helpers != helpers {
 * 		uncheckedHelpers := helpers &^ links.requestedExternalEmitHelpers
 * 		for helper := ExternalEmitHelpersFirstEmitHelper; helper <= ExternalEmitHelpersLastEmitHelper; helper <<= 1 {
 * 			if uncheckedHelpers&helper == 0 {
 * 				continue
 * 			}
 * 			for _, name := range c.getHelperNames(helper) {
 * 				symbol := c.resolveSymbol(c.getSymbol(c.getExportsOfModule(helpersModule), name, ast.SymbolFlagsValue))
 * 				if symbol == nil {
 * 					c.error(location, diagnostics.This_syntax_requires_an_imported_helper_named_1_which_does_not_exist_in_0_Consider_upgrading_your_version_of_0, externalHelpersModuleNameText, name)
 * 				} else if helper&ExternalEmitHelpersClassPrivateFieldGet != 0 {
 * 					if !c.hasSignatureWithArityGreaterThan(symbol, 3) {
 * 						c.error(location, diagnostics.This_syntax_requires_an_imported_helper_named_1_with_2_parameters_which_is_not_compatible_with_the_one_in_0_Consider_upgrading_your_version_of_0, externalHelpersModuleNameText, name, 4)
 * 					}
 * 				} else if helper&ExternalEmitHelpersClassPrivateFieldSet != 0 {
 * 					if !c.hasSignatureWithArityGreaterThan(symbol, 4) {
 * 						c.error(location, diagnostics.This_syntax_requires_an_imported_helper_named_1_with_2_parameters_which_is_not_compatible_with_the_one_in_0_Consider_upgrading_your_version_of_0, externalHelpersModuleNameText, name, 5)
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 	links.requestedExternalEmitHelpers |= helpers
 * }
 */
export function Checker_checkExternalEmitHelpers(receiver: GoPtr<Checker>, location: GoPtr<Node>, helpers: ExternalEmitHelpers): void {
  if (!Tristate_IsTrue(receiver!.compilerOptions!.ImportHelpers)) {
    return;
  }
  const sourceFile = GetSourceFileOfNode(location);
  if (!IsEffectiveExternalModule(sourceFile, receiver!.compilerOptions) || (location!.Flags & NodeFlagsAmbient) !== 0) {
    return;
  }
  const helpersModule = Checker_resolveHelpersModule(receiver, sourceFile, location);
  if (helpersModule === receiver!.unknownSymbol) {
    return;
  }
  const links = Checker_getSourceFileLinks(receiver, sourceFile);
  if ((links!.requestedExternalEmitHelpers & helpers) !== helpers) {
    const uncheckedHelpers = (helpers & ~links!.requestedExternalEmitHelpers) as ExternalEmitHelpers;
    for (let helper: ExternalEmitHelpers = ExternalEmitHelpersFirstEmitHelper; helper <= ExternalEmitHelpersLastEmitHelper; helper = (helper << 1) as ExternalEmitHelpers) {
      if ((uncheckedHelpers & helper) === 0) {
        continue;
      }
      for (const name of Checker_getHelperNames(receiver, helper)) {
        const symbol_ = Checker_resolveSymbol(receiver, Checker_getSymbol(receiver, Checker_getExportsOfModule(receiver, helpersModule), name, SymbolFlagsValue));
        if (symbol_ === undefined) {
          Checker_error(receiver, location, This_syntax_requires_an_imported_helper_named_1_which_does_not_exist_in_0_Consider_upgrading_your_version_of_0, externalHelpersModuleNameText, name);
        } else if ((helper & ExternalEmitHelpersClassPrivateFieldGet) !== 0) {
          if (!Checker_hasSignatureWithArityGreaterThan(receiver, symbol_, 3 as int)) {
            Checker_error(receiver, location, This_syntax_requires_an_imported_helper_named_1_with_2_parameters_which_is_not_compatible_with_the_one_in_0_Consider_upgrading_your_version_of_0, externalHelpersModuleNameText, name, 4);
          }
        } else if ((helper & ExternalEmitHelpersClassPrivateFieldSet) !== 0) {
          if (!Checker_hasSignatureWithArityGreaterThan(receiver, symbol_, 4 as int)) {
            Checker_error(receiver, location, This_syntax_requires_an_imported_helper_named_1_with_2_parameters_which_is_not_compatible_with_the_one_in_0_Consider_upgrading_your_version_of_0, externalHelpersModuleNameText, name, 5);
          }
        }
      }
    }
  }
  links!.requestedExternalEmitHelpers |= helpers;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasSignatureWithArityGreaterThan","kind":"method","status":"implemented","sigHash":"27276a265828914ec376ec804590661cca66ba4a5f333a765fbb15840841b71b","bodyHash":"41e345f969b7a64a4c11ef6eaa8b8d6cd206aaa0acbfb15dd776c68edaae5e3d"}
 *
 * Go source:
 * func (c *Checker) hasSignatureWithArityGreaterThan(symbol *ast.Symbol, arity int) bool {
 * 	for _, signature := range c.getSignaturesOfSymbol(symbol) {
 * 		if c.getParameterCount(signature) > arity {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function Checker_hasSignatureWithArityGreaterThan(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>, arity: int): bool {
  for (const signature of Checker_getSignaturesOfSymbol(receiver, symbol_)) {
    if (Checker_getParameterCount(receiver, signature) > arity) {
      return true as bool;
    }
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getHelperNames","kind":"method","status":"implemented","sigHash":"9e91b611363a7beb8e2f0d256af104458e5c92db51ac8c555bfcb8e072009b19","bodyHash":"a2a0b8f7d0c3e3fbad73c69c50b481d18657a52accf1fa61c1ac67e6f4b40c1e"}
 *
 * Go source:
 * func (c *Checker) getHelperNames(helper ExternalEmitHelpers) []string {
 * 	switch helper {
 * 	case ExternalEmitHelpersRest:
 * 		return []string{"__rest"}
 * 	case ExternalEmitHelpersDecorate:
 * 		if c.legacyDecorators {
 * 			return []string{"__decorate"}
 * 		}
 * 		return []string{"__esDecorate", "__runInitializers"}
 * 	case ExternalEmitHelpersMetadata:
 * 		return []string{"__metadata"}
 * 	case ExternalEmitHelpersParam:
 * 		return []string{"__param"}
 * 	case ExternalEmitHelpersAwaiter:
 * 		return []string{"__awaiter"}
 * 	case ExternalEmitHelpersAwait:
 * 		return []string{"__await"}
 * 	case ExternalEmitHelpersAsyncGenerator:
 * 		return []string{"__asyncGenerator"}
 * 	case ExternalEmitHelpersAsyncDelegator:
 * 		return []string{"__asyncDelegator"}
 * 	case ExternalEmitHelpersAsyncValues:
 * 		return []string{"__asyncValues"}
 * 	case ExternalEmitHelpersExportStar:
 * 		return []string{"__exportStar"}
 * 	case ExternalEmitHelpersImportStar:
 * 		return []string{"__importStar"}
 * 	case ExternalEmitHelpersImportDefault:
 * 		return []string{"__importDefault"}
 * 	case ExternalEmitHelpersMakeTemplateObject:
 * 		return []string{"__makeTemplateObject"}
 * 	case ExternalEmitHelpersClassPrivateFieldGet:
 * 		return []string{"__classPrivateFieldGet"}
 * 	case ExternalEmitHelpersClassPrivateFieldSet:
 * 		return []string{"__classPrivateFieldSet"}
 * 	case ExternalEmitHelpersClassPrivateFieldIn:
 * 		return []string{"__classPrivateFieldIn"}
 * 	case ExternalEmitHelpersSetFunctionName:
 * 		return []string{"__setFunctionName"}
 * 	case ExternalEmitHelpersPropKey:
 * 		return []string{"__propKey"}
 * 	case ExternalEmitHelpersAddDisposableResourceAndDisposeResources:
 * 		return []string{"__addDisposableResource", "__disposeResources"}
 * 	case ExternalEmitHelpersRewriteRelativeImportExtension:
 * 		return []string{"__rewriteRelativeImportExtension"}
 * 	default:
 * 		panic("Unrecognized helper")
 * 	}
 * }
 */
export function Checker_getHelperNames(receiver: GoPtr<Checker>, helper: ExternalEmitHelpers): GoSlice<string> {
  switch (helper) {
    case ExternalEmitHelpersRest:
      return ["__rest"];
    case ExternalEmitHelpersDecorate:
      if (receiver!.legacyDecorators) {
        return ["__decorate"];
      }
      return ["__esDecorate", "__runInitializers"];
    case ExternalEmitHelpersMetadata:
      return ["__metadata"];
    case ExternalEmitHelpersParam:
      return ["__param"];
    case ExternalEmitHelpersAwaiter:
      return ["__awaiter"];
    case ExternalEmitHelpersAwait:
      return ["__await"];
    case ExternalEmitHelpersAsyncGenerator:
      return ["__asyncGenerator"];
    case ExternalEmitHelpersAsyncDelegator:
      return ["__asyncDelegator"];
    case ExternalEmitHelpersAsyncValues:
      return ["__asyncValues"];
    case ExternalEmitHelpersExportStar:
      return ["__exportStar"];
    case ExternalEmitHelpersImportStar:
      return ["__importStar"];
    case ExternalEmitHelpersImportDefault:
      return ["__importDefault"];
    case ExternalEmitHelpersMakeTemplateObject:
      return ["__makeTemplateObject"];
    case ExternalEmitHelpersClassPrivateFieldGet:
      return ["__classPrivateFieldGet"];
    case ExternalEmitHelpersClassPrivateFieldSet:
      return ["__classPrivateFieldSet"];
    case ExternalEmitHelpersClassPrivateFieldIn:
      return ["__classPrivateFieldIn"];
    case ExternalEmitHelpersSetFunctionName:
      return ["__setFunctionName"];
    case ExternalEmitHelpersPropKey:
      return ["__propKey"];
    case ExternalEmitHelpersAddDisposableResourceAndDisposeResources:
      return ["__addDisposableResource", "__disposeResources"];
    case ExternalEmitHelpersRewriteRelativeImportExtension:
      return ["__rewriteRelativeImportExtension"];
    default:
      throw new globalThis.Error("Unrecognized helper");
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.resolveHelpersModule","kind":"method","status":"implemented","sigHash":"f0e074944d9d5b5ee6e67fae501ba469de0bdc83c644df5b3fca5e78ae387adf","bodyHash":"4c65c973436d0901136e19139b660e5e5bd9e919e84e16ff3645e84f5e56f030"}
 *
 * Go source:
 * func (c *Checker) resolveHelpersModule(file *ast.SourceFile, errorNode *ast.Node) *ast.Symbol {
 * 	links := c.sourceFileLinks.Get(file)
 * 	if links.externalHelpersModule == nil {
 * 		location := c.program.GetImportHelpersImportSpecifier(file.Path())
 * 		helpersModule := c.resolveExternalModule(location, externalHelpersModuleNameText, diagnostics.This_syntax_requires_an_imported_helper_but_module_0_cannot_be_found, errorNode, false /*isForAugmentation* /)
 * 		if helpersModule == nil {
 * 			helpersModule = c.unknownSymbol
 * 		}
 * 		links.externalHelpersModule = helpersModule
 * 	}
 * 	return links.externalHelpersModule
 * }
 */
export function Checker_resolveHelpersModule(receiver: GoPtr<Checker>, file: GoPtr<SourceFile>, errorNode: GoPtr<Node>): GoPtr<Symbol> {
  const links = Checker_getSourceFileLinks(receiver, file);
  if (links!.externalHelpersModule === undefined) {
    const location = receiver!.program.GetImportHelpersImportSpecifier(SourceFile_Path(file));
    let helpersModule = Checker_resolveExternalModule(receiver, location, externalHelpersModuleNameText, This_syntax_requires_an_imported_helper_but_module_0_cannot_be_found, errorNode, false as bool);
    if (helpersModule === undefined) {
      helpersModule = receiver!.unknownSymbol;
    }
    links!.externalHelpersModule = helpersModule;
  }
  return links!.externalHelpersModule;
}
