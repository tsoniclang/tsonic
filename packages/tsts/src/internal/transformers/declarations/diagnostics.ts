import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Kind } from "../../ast/generated/kinds.js";
import {
  KindArrayLiteralExpression,
  KindArrowFunction,
  KindBinaryExpression,
  KindBindingElement,
  KindCallSignature,
  KindClassDeclaration,
  KindComputedPropertyName,
  KindConstructor,
  KindConstructSignature,
  KindConstructorType,
  KindElementAccessExpression,
  KindExportAssignment,
  KindFunctionDeclaration,
  KindFunctionExpression,
  KindFunctionType,
  KindGetAccessor,
  KindImplementsKeyword,
  KindIndexSignature,
  KindInferType,
  KindInterfaceDeclaration,
  KindJSTypeAliasDeclaration,
  KindMappedType,
  KindMethodDeclaration,
  KindMethodSignature,
  KindParameter,
  KindPropertyAccessExpression,
  KindPropertyDeclaration,
  KindPropertySignature,
  KindSetAccessor,
  KindShorthandPropertyAssignment,
  KindSpreadAssignment,
  KindSpreadElement,
  KindTypeAliasDeclaration,
  KindVariableDeclaration,
  KindClassExpression,
  KindPropertyAssignment,
} from "../../ast/generated/kinds.js";
import {
  AsExportAssignment,
  AsHeritageClause,
} from "../../ast/generated/casts.js";
import {
  IsBindingElement,
  IsBinaryExpression,
  IsClassDeclaration,
  IsConstructorDeclaration,
  IsConstructSignatureDeclaration,
  IsCallSignatureDeclaration,
  IsElementAccessExpression,
  IsExportAssignment,
  IsExpressionWithTypeArguments,
  IsFunctionDeclaration,
  IsGetAccessorDeclaration,
  IsHeritageClause,
  IsImportEqualsDeclaration,
  IsIndexSignatureDeclaration,
  IsJSTypeAliasDeclaration,
  IsMethodDeclaration,
  IsMethodSignatureDeclaration,
  IsParameterDeclaration,
  IsParenthesizedExpression,
  IsPropertyAccessExpression,
  IsPropertyDeclaration,
  IsPropertySignatureDeclaration,
  IsReturnStatement,
  IsSetAccessorDeclaration,
  IsTypeAliasDeclaration,
  IsTypeParameterDeclaration,
  IsTypeQueryNode,
  IsVariableDeclaration,
} from "../../ast/generated/predicates.js";
import {
  IsAssertionExpression,
  IsEntityName,
  IsEntityNameExpression,
  IsPartOfTypeNode,
  FindAncestor,
  FindAncestorOrQuit,
  FindAncestorTrue,
  FindAncestorQuit,
  ToFindAncestorResult,
  GetNameOfDeclaration,
  HasSyntacticModifier,
  IsFunctionLikeDeclaration,
  IsParameterPropertyDeclaration,
  IsStatement,
  IsStatic,
  GetAllAccessorDeclarationsForDeclaration,
} from "../../ast/utilities.js";
import { Node_Name } from "../../ast/spine.js";
import { Node_Type, Node_Parameters, Node_Symbol, Node_Initializer } from "../../ast/ast.js";
import { ModifierFlagsPrivate } from "../../ast/modifierflags.js";
import type { FindAncestorResult } from "../../ast/utilities.js";
import type { Message } from "../../diagnostics/diagnostics.js";
import * as diagnostics from "../../diagnostics/generated/messages.js";
import type { EmitResolver, SymbolAccessibilityResult } from "../../printer/emitresolver.js";
import { SymbolAccessibilityCannotBeNamed } from "../../printer/emitresolver.js";
import { GetTextOfNode, DeclarationNameToString } from "../../scanner/utilities.js";
import { NewDiagnosticForNode } from "../../checker/utilities.js";
import { Diagnostic_AddRelatedInfo } from "../../ast/diagnostic.js";
import type { AccessorDeclaration } from "../../ast/generated/unions.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::type::GetSymbolAccessibilityDiagnostic","kind":"type","status":"implemented","sigHash":"30009a2944c1b67c2d004de1a53a6347b93993270876a094093214a1dd3b294d","bodyHash":"4690a42c6a896f808be1de81243ee38276220e9254501e06249727e1731785fa"}
 *
 * Go source:
 * GetSymbolAccessibilityDiagnostic = func(symbolAccessibilityResult printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic
 */
export type GetSymbolAccessibilityDiagnostic = (symbolAccessibilityResult: SymbolAccessibilityResult) => GoPtr<SymbolAccessibilityDiagnostic>;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::type::SymbolAccessibilityDiagnostic","kind":"type","status":"implemented","sigHash":"df75e237fca71aa20b900c85bfdd8a0fd7f6062768000d12e37abddf7dec3618","bodyHash":"e24e261749d6da8468f88b98a67fce9e8ccf790abdbfac1d64858ec69a7dcbe9"}
 *
 * Go source:
 * SymbolAccessibilityDiagnostic struct {
 * 	errorNode         *ast.Node
 * 	diagnosticMessage *diagnostics.Message
 * 	typeName          *ast.Node
 * }
 */
export interface SymbolAccessibilityDiagnostic {
  errorNode: GoPtr<Node>;
  diagnosticMessage: GoPtr<Message>;
  typeName: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::wrapSimpleDiagnosticSelector","kind":"func","status":"implemented","sigHash":"39b7195b797c3bd8cf789d7c6fa88f087be56316a3cf70803972ea0fffc64b50","bodyHash":"ed2710d12cb52587416131a77e933ad7e1f051481bc8eee3d2117dc3d5911829"}
 *
 * Go source:
 * func wrapSimpleDiagnosticSelector(node *ast.Node, selector func(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message) GetSymbolAccessibilityDiagnostic {
 * 	return func(symbolAccessibilityResult printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 		diagnosticMessage := selector(node, symbolAccessibilityResult)
 * 		if diagnosticMessage == nil {
 * 			return nil
 * 		}
 * 		return &SymbolAccessibilityDiagnostic{
 * 			errorNode:         node,
 * 			diagnosticMessage: diagnosticMessage,
 * 			typeName:          ast.GetNameOfDeclaration(node),
 * 		}
 * 	}
 * }
 */
export function wrapSimpleDiagnosticSelector(node: GoPtr<Node>, selector: (node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult) => GoPtr<Message>): GetSymbolAccessibilityDiagnostic {
  return (symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<SymbolAccessibilityDiagnostic> => {
    const diagnosticMessage = selector(node, symbolAccessibilityResult);
    if (diagnosticMessage === undefined) {
      return undefined;
    }
    return {
      errorNode: node,
      diagnosticMessage: diagnosticMessage,
      typeName: GetNameOfDeclaration(node),
    };
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::wrapNamedDiagnosticSelector","kind":"func","status":"implemented","sigHash":"f833c31c05646729073b126af7be455424b5637e4db7f1557395096ade6590cc","bodyHash":"8be08e999b811be6efc5d830d7731e3d79ca838b0512163d57197f45af576b48"}
 *
 * Go source:
 * func wrapNamedDiagnosticSelector(node *ast.Node, selector func(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message) GetSymbolAccessibilityDiagnostic {
 * 	return func(symbolAccessibilityResult printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 		diagnosticMessage := selector(node, symbolAccessibilityResult)
 * 		if diagnosticMessage == nil {
 * 			return nil
 * 		}
 * 		name := ast.GetNameOfDeclaration(node)
 * 		return &SymbolAccessibilityDiagnostic{
 * 			errorNode:         name,
 * 			diagnosticMessage: diagnosticMessage,
 * 			typeName:          name,
 * 		}
 * 	}
 * }
 */
export function wrapNamedDiagnosticSelector(node: GoPtr<Node>, selector: (node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult) => GoPtr<Message>): GetSymbolAccessibilityDiagnostic {
  return (symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<SymbolAccessibilityDiagnostic> => {
    const diagnosticMessage = selector(node, symbolAccessibilityResult);
    if (diagnosticMessage === undefined) {
      return undefined;
    }
    const name = GetNameOfDeclaration(node);
    return {
      errorNode: name,
      diagnosticMessage: diagnosticMessage,
      typeName: name,
    };
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::wrapFallbackErrorDiagnosticSelector","kind":"func","status":"implemented","sigHash":"6964f610e0893918765d41dca5a511bfc717f40e868d76a024d3db39786f294f","bodyHash":"9471f10197e075252179cc96648d7942479a5af622688e208570fad0d7751807"}
 *
 * Go source:
 * func wrapFallbackErrorDiagnosticSelector(node *ast.Node, selector func(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message) GetSymbolAccessibilityDiagnostic {
 * 	return func(symbolAccessibilityResult printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 		diagnosticMessage := selector(node, symbolAccessibilityResult)
 * 		if diagnosticMessage == nil {
 * 			return nil
 * 		}
 * 		errorNode := ast.GetNameOfDeclaration(node)
 * 		if errorNode == nil {
 * 			errorNode = node
 * 		}
 * 		return &SymbolAccessibilityDiagnostic{
 * 			errorNode:         errorNode,
 * 			diagnosticMessage: diagnosticMessage,
 * 		}
 * 	}
 * }
 */
export function wrapFallbackErrorDiagnosticSelector(node: GoPtr<Node>, selector: (node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult) => GoPtr<Message>): GetSymbolAccessibilityDiagnostic {
  return (symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<SymbolAccessibilityDiagnostic> => {
    const diagnosticMessage = selector(node, symbolAccessibilityResult);
    if (diagnosticMessage === undefined) {
      return undefined;
    }
    let errorNode = GetNameOfDeclaration(node);
    if (errorNode === undefined) {
      errorNode = node;
    }
    return {
      errorNode: errorNode,
      diagnosticMessage: diagnosticMessage,
      typeName: undefined,
    };
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::selectDiagnosticBasedOnModuleName","kind":"func","status":"implemented","sigHash":"92d59b25a1daed2aeaa0cbf049a3dad840d82a541d99347f41e9d8ca8f83d4a1","bodyHash":"ff597024f9596cbaec653065154c9bf5d04af2512eaea101bdb45014c9905ded"}
 *
 * Go source:
 * func selectDiagnosticBasedOnModuleName(symbolAccessibilityResult printer.SymbolAccessibilityResult, moduleNotNameable *diagnostics.Message, privateModule *diagnostics.Message, nonModule *diagnostics.Message) *diagnostics.Message {
 * 	if len(symbolAccessibilityResult.ErrorModuleName) > 0 {
 * 		if symbolAccessibilityResult.Accessibility == printer.SymbolAccessibilityCannotBeNamed {
 * 			return moduleNotNameable
 * 		}
 * 		return privateModule
 * 	}
 * 	return nonModule
 * }
 */
export function selectDiagnosticBasedOnModuleName(symbolAccessibilityResult: SymbolAccessibilityResult, moduleNotNameable: GoPtr<Message>, privateModule: GoPtr<Message>, nonModule: GoPtr<Message>): GoPtr<Message> {
  if (symbolAccessibilityResult.ErrorModuleName.length > 0) {
    if (symbolAccessibilityResult.Accessibility === SymbolAccessibilityCannotBeNamed) {
      return moduleNotNameable;
    }
    return privateModule;
  }
  return nonModule;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::selectDiagnosticBasedOnModuleNameNoNameCheck","kind":"func","status":"implemented","sigHash":"5d2f8ed1a9967ac7dac7d429391b641bcc0e27782230c859193a62cea082c7f1","bodyHash":"d2df837178bf168d053a4ec377b6b437c735fc96f8ac167b916fa2d072cac66b"}
 *
 * Go source:
 * func selectDiagnosticBasedOnModuleNameNoNameCheck(symbolAccessibilityResult printer.SymbolAccessibilityResult, privateModule *diagnostics.Message, nonModule *diagnostics.Message) *diagnostics.Message {
 * 	if len(symbolAccessibilityResult.ErrorModuleName) > 0 {
 * 		return privateModule
 * 	}
 * 	return nonModule
 * }
 */
export function selectDiagnosticBasedOnModuleNameNoNameCheck(symbolAccessibilityResult: SymbolAccessibilityResult, privateModule: GoPtr<Message>, nonModule: GoPtr<Message>): GoPtr<Message> {
  if (symbolAccessibilityResult.ErrorModuleName.length > 0) {
    return privateModule;
  }
  return nonModule;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createGetSymbolAccessibilityDiagnosticForNodeName","kind":"func","status":"implemented","sigHash":"ccfd316e92737e7d9903d86a09f604ad77befdeea2ddb4d77c99e2e477202ba4","bodyHash":"164393ce724fbc3b3c5264858fd05549c57b61924ff390a40402cb7153d44bda"}
 *
 * Go source:
 * func createGetSymbolAccessibilityDiagnosticForNodeName(node *ast.Node) GetSymbolAccessibilityDiagnostic {
 * 	if ast.IsSetAccessorDeclaration(node) || ast.IsGetAccessorDeclaration(node) {
 * 		return wrapSimpleDiagnosticSelector(node, getAccessorNameVisibilityDiagnosticMessage)
 * 	} else if ast.IsMethodDeclaration(node) || ast.IsMethodSignatureDeclaration(node) {
 * 		return wrapSimpleDiagnosticSelector(node, getMethodNameVisibilityDiagnosticMessage)
 * 	} else {
 * 		return createGetSymbolAccessibilityDiagnosticForNode(node)
 * 	}
 * }
 */
export function createGetSymbolAccessibilityDiagnosticForNodeName(node: GoPtr<Node>): GetSymbolAccessibilityDiagnostic {
  if (IsSetAccessorDeclaration(node) || IsGetAccessorDeclaration(node)) {
    return wrapSimpleDiagnosticSelector(node, getAccessorNameVisibilityDiagnosticMessage);
  } else if (IsMethodDeclaration(node) || IsMethodSignatureDeclaration(node)) {
    return wrapSimpleDiagnosticSelector(node, getMethodNameVisibilityDiagnosticMessage);
  } else {
    return createGetSymbolAccessibilityDiagnosticForNode(node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getAccessorNameVisibilityDiagnosticMessage","kind":"func","status":"implemented","sigHash":"4e277d3313ad53f83b57d1ddd3879f370600e3083d88b59ef7b0dc1e9aa71552","bodyHash":"6b70c778c8a5355cfe210c5a7a9e255dbcc7ed217d0313a3e2b6f6be6b744561"}
 *
 * Go source:
 * func getAccessorNameVisibilityDiagnosticMessage(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 	if ast.IsStatic(node) {
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_private_name_1,
 * 		)
 * 	} else if node.Parent.Kind == ast.KindClassDeclaration {
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Public_property_0_of_exported_class_has_or_is_using_private_name_1,
 * 		)
 * 	} else {
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Property_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Property_0_of_exported_interface_has_or_is_using_private_name_1,
 * 		)
 * 	}
 * }
 */
export function getAccessorNameVisibilityDiagnosticMessage(node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<Message> {
  if (IsStatic(node)) {
    return selectDiagnosticBasedOnModuleName(
      symbolAccessibilityResult,
      diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
      diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
      diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_private_name_1,
    );
  } else if (node!.Parent!.Kind === KindClassDeclaration) {
    return selectDiagnosticBasedOnModuleName(
      symbolAccessibilityResult,
      diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
      diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
      diagnostics.Public_property_0_of_exported_class_has_or_is_using_private_name_1,
    );
  } else {
    return selectDiagnosticBasedOnModuleNameNoNameCheck(
      symbolAccessibilityResult,
      diagnostics.Property_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2,
      diagnostics.Property_0_of_exported_interface_has_or_is_using_private_name_1,
    );
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getMethodNameVisibilityDiagnosticMessage","kind":"func","status":"implemented","sigHash":"e7ca00ffdd093143c1d6867ff938ff95bd1a36c35ef62b276102c2ab84373fef","bodyHash":"2811fd0fb2b1f2f53c6ca9520c4b0c213593563300a5cb3705b2a4df8ecf53eb"}
 *
 * Go source:
 * func getMethodNameVisibilityDiagnosticMessage(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 	if ast.IsStatic(node) {
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Public_static_method_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Public_static_method_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Public_static_method_0_of_exported_class_has_or_is_using_private_name_1,
 * 		)
 * 	} else if node.Parent.Kind == ast.KindClassDeclaration {
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Public_method_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Public_method_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Public_method_0_of_exported_class_has_or_is_using_private_name_1,
 * 		)
 * 	} else {
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Method_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Method_0_of_exported_interface_has_or_is_using_private_name_1,
 * 		)
 * 	}
 * }
 */
export function getMethodNameVisibilityDiagnosticMessage(node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<Message> {
  if (IsStatic(node)) {
    return selectDiagnosticBasedOnModuleName(
      symbolAccessibilityResult,
      diagnostics.Public_static_method_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
      diagnostics.Public_static_method_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
      diagnostics.Public_static_method_0_of_exported_class_has_or_is_using_private_name_1,
    );
  } else if (node!.Parent!.Kind === KindClassDeclaration) {
    return selectDiagnosticBasedOnModuleName(
      symbolAccessibilityResult,
      diagnostics.Public_method_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
      diagnostics.Public_method_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
      diagnostics.Public_method_0_of_exported_class_has_or_is_using_private_name_1,
    );
  } else {
    return selectDiagnosticBasedOnModuleNameNoNameCheck(
      symbolAccessibilityResult,
      diagnostics.Method_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2,
      diagnostics.Method_0_of_exported_interface_has_or_is_using_private_name_1,
    );
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createGetSymbolAccessibilityDiagnosticForNode","kind":"func","status":"implemented","sigHash":"7294371cc69b7ee95c2a714d89a3ba32e0374e09cc3c52242791ce8ddf5d46af","bodyHash":"2b2c6129ebfeac167ba46e5239b3a12a71f02cdc6ccbd0784d1711541e489fcf"}
 *
 * Go source:
 * func createGetSymbolAccessibilityDiagnosticForNode(node *ast.Node) GetSymbolAccessibilityDiagnostic {
 * 	if ast.IsVariableDeclaration(node) || ast.IsPropertyDeclaration(node) || ast.IsPropertySignatureDeclaration(node) || ast.IsPropertyAccessExpression(node) || ast.IsElementAccessExpression(node) || ast.IsBinaryExpression(node) || ast.IsBindingElement(node) || ast.IsConstructorDeclaration(node) {
 * 		return wrapSimpleDiagnosticSelector(node, getVariableDeclarationTypeVisibilityDiagnosticMessage)
 * 	} else if ast.IsSetAccessorDeclaration(node) || ast.IsGetAccessorDeclaration(node) {
 * 		return wrapNamedDiagnosticSelector(node, getAccessorDeclarationTypeVisibilityDiagnosticMessage)
 * 	} else if ast.IsConstructSignatureDeclaration(node) || ast.IsCallSignatureDeclaration(node) || ast.IsMethodDeclaration(node) || ast.IsMethodSignatureDeclaration(node) || ast.IsFunctionDeclaration(node) || ast.IsIndexSignatureDeclaration(node) {
 * 		return wrapFallbackErrorDiagnosticSelector(node, getReturnTypeVisibilityDiagnosticMessage)
 * 	} else if ast.IsParameterDeclaration(node) {
 * 		if ast.IsParameterPropertyDeclaration(node, node.Parent) && ast.HasSyntacticModifier(node.Parent, ast.ModifierFlagsPrivate) {
 * 			return wrapSimpleDiagnosticSelector(node, getVariableDeclarationTypeVisibilityDiagnosticMessage)
 * 		}
 * 		return wrapSimpleDiagnosticSelector(node, getParameterDeclarationTypeVisibilityDiagnosticMessage)
 * 	} else if ast.IsTypeParameterDeclaration(node) {
 * 		return wrapSimpleDiagnosticSelector(node, getTypeParameterConstraintVisibilityDiagnosticMessage)
 * 	} else if ast.IsExpressionWithTypeArguments(node) {
 * 		// unique node selection behavior, inline closure
 * 		return func(symbolAccessibilityResult printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 			var diagnosticMessage *diagnostics.Message
 * 			// Heritage clause is written by user so it can always be named
 * 			if ast.IsClassDeclaration(node.Parent.Parent) {
 * 				// Class or Interface implemented/extended is inaccessible
 * 				if ast.IsHeritageClause(node.Parent) && node.Parent.AsHeritageClause().Token == ast.KindImplementsKeyword {
 * 					diagnosticMessage = diagnostics.Implements_clause_of_exported_class_0_has_or_is_using_private_name_1
 * 				} else {
 * 					if node.Parent.Parent.Name() != nil {
 * 						diagnosticMessage = diagnostics.X_extends_clause_of_exported_class_0_has_or_is_using_private_name_1
 * 					} else {
 * 						diagnosticMessage = diagnostics.X_extends_clause_of_exported_class_has_or_is_using_private_name_0
 * 					}
 * 				}
 * 			} else {
 * 				// interface is inaccessible
 * 				diagnosticMessage = diagnostics.X_extends_clause_of_exported_interface_0_has_or_is_using_private_name_1
 * 			}
 * 
 * 			return &SymbolAccessibilityDiagnostic{
 * 				diagnosticMessage: diagnosticMessage,
 * 				errorNode:         node,
 * 				typeName:          ast.GetNameOfDeclaration(node.Parent.Parent),
 * 			}
 * 		}
 * 	} else if ast.IsImportEqualsDeclaration(node) {
 * 		return wrapSimpleDiagnosticSelector(node, func(_ *ast.Node, _ printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 			return diagnostics.Import_declaration_0_is_using_private_name_1
 * 		})
 * 	} else if ast.IsTypeAliasDeclaration(node) || ast.IsJSTypeAliasDeclaration(node) {
 * 		// unique node selection behavior, inline closure
 * 		return func(symbolAccessibilityResult printer.SymbolAccessibilityResult) *SymbolAccessibilityDiagnostic {
 * 			diagnosticMessage := selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Exported_type_alias_0_has_or_is_using_private_name_1_from_module_2,
 * 				diagnostics.Exported_type_alias_0_has_or_is_using_private_name_1,
 * 			)
 * 			errorNode := node.Type()
 * 			typeName := node.Name()
 * 			return &SymbolAccessibilityDiagnostic{
 * 				errorNode:         errorNode,
 * 				diagnosticMessage: diagnosticMessage,
 * 				typeName:          typeName,
 * 			}
 * 		}
 * 	} else {
 * 		panic("Attempted to set a declaration diagnostic context for unhandled node kind: " + node.Kind.String())
 * 	}
 * }
 */
export function createGetSymbolAccessibilityDiagnosticForNode(node: GoPtr<Node>): GetSymbolAccessibilityDiagnostic {
  if (IsVariableDeclaration(node) || IsPropertyDeclaration(node) || IsPropertySignatureDeclaration(node) || IsPropertyAccessExpression(node) || IsElementAccessExpression(node) || IsBinaryExpression(node) || IsBindingElement(node) || IsConstructorDeclaration(node)) {
    return wrapSimpleDiagnosticSelector(node, getVariableDeclarationTypeVisibilityDiagnosticMessage);
  } else if (IsSetAccessorDeclaration(node) || IsGetAccessorDeclaration(node)) {
    return wrapNamedDiagnosticSelector(node, getAccessorDeclarationTypeVisibilityDiagnosticMessage);
  } else if (IsConstructSignatureDeclaration(node) || IsCallSignatureDeclaration(node) || IsMethodDeclaration(node) || IsMethodSignatureDeclaration(node) || IsFunctionDeclaration(node) || IsIndexSignatureDeclaration(node)) {
    return wrapFallbackErrorDiagnosticSelector(node, getReturnTypeVisibilityDiagnosticMessage);
  } else if (IsParameterDeclaration(node)) {
    if (IsParameterPropertyDeclaration(node, node!.Parent) && HasSyntacticModifier(node!.Parent, ModifierFlagsPrivate)) {
      return wrapSimpleDiagnosticSelector(node, getVariableDeclarationTypeVisibilityDiagnosticMessage);
    }
    return wrapSimpleDiagnosticSelector(node, getParameterDeclarationTypeVisibilityDiagnosticMessage);
  } else if (IsTypeParameterDeclaration(node)) {
    return wrapSimpleDiagnosticSelector(node, getTypeParameterConstraintVisibilityDiagnosticMessage);
  } else if (IsExpressionWithTypeArguments(node)) {
    return (symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<SymbolAccessibilityDiagnostic> => {
      let diagnosticMessage: GoPtr<Message>;
      // Heritage clause is written by user so it can always be named
      if (IsClassDeclaration(node!.Parent!.Parent)) {
        // Class or Interface implemented/extended is inaccessible
        if (IsHeritageClause(node!.Parent) && AsHeritageClause(node!.Parent)!.Token === KindImplementsKeyword) {
          diagnosticMessage = diagnostics.Implements_clause_of_exported_class_0_has_or_is_using_private_name_1;
        } else {
          if (Node_Name(node!.Parent!.Parent) !== undefined) {
            diagnosticMessage = diagnostics.X_extends_clause_of_exported_class_0_has_or_is_using_private_name_1;
          } else {
            diagnosticMessage = diagnostics.X_extends_clause_of_exported_class_has_or_is_using_private_name_0;
          }
        }
      } else {
        // interface is inaccessible
        diagnosticMessage = diagnostics.X_extends_clause_of_exported_interface_0_has_or_is_using_private_name_1;
      }
      return {
        diagnosticMessage: diagnosticMessage,
        errorNode: node,
        typeName: GetNameOfDeclaration(node!.Parent!.Parent),
      };
    };
  } else if (IsImportEqualsDeclaration(node)) {
    return wrapSimpleDiagnosticSelector(node, (_: GoPtr<Node>, _2: SymbolAccessibilityResult): GoPtr<Message> => {
      return diagnostics.Import_declaration_0_is_using_private_name_1;
    });
  } else if (IsTypeAliasDeclaration(node) || IsJSTypeAliasDeclaration(node)) {
    return (symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<SymbolAccessibilityDiagnostic> => {
      const diagnosticMessage = selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Exported_type_alias_0_has_or_is_using_private_name_1_from_module_2,
        diagnostics.Exported_type_alias_0_has_or_is_using_private_name_1,
      );
      const errorNode = Node_Type(node);
      const typeName = Node_Name(node);
      return {
        errorNode: errorNode,
        diagnosticMessage: diagnosticMessage,
        typeName: typeName,
      };
    };
  } else {
    throw new globalThis.Error("Attempted to set a declaration diagnostic context for unhandled node kind: " + node!.Kind);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getVariableDeclarationTypeVisibilityDiagnosticMessage","kind":"func","status":"implemented","sigHash":"525f3d25b78af09cbd54fb1b1c9af773e126dd6589761a1032345307a260407e","bodyHash":"1f962c95b08a30c4aa68258e6aab8e7bee39dd92148a9a4353b30a110ae3932a"}
 *
 * Go source:
 * func getVariableDeclarationTypeVisibilityDiagnosticMessage(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 	if node.Kind == ast.KindVariableDeclaration || node.Kind == ast.KindBindingElement {
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Exported_variable_0_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Exported_variable_0_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Exported_variable_0_has_or_is_using_private_name_1,
 * 		)
 * 
 * 		// This check is to ensure we don't report error on constructor parameter property as that error would be reported during parameter emit
 * 		// The only exception here is if the constructor was marked as private. we are not emitting the constructor parameters at all.
 * 	} else if node.Kind == ast.KindPropertyDeclaration || node.Kind == ast.KindPropertyAccessExpression || node.Kind == ast.KindElementAccessExpression || node.Kind == ast.KindBinaryExpression || node.Kind == ast.KindPropertySignature ||
 * 		(node.Kind == ast.KindParameter && ast.HasSyntacticModifier(node.Parent, ast.ModifierFlagsPrivate)) {
 * 		// TODO(jfreeman): Deal with computed properties in error reporting.
 * 		if ast.IsStatic(node) {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 				diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		} else if node.Parent.Kind == ast.KindClassDeclaration || node.Kind == ast.KindParameter {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 				diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Public_property_0_of_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		} else {
 * 			// Interfaces cannot have types that cannot be named
 * 			return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Property_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Property_0_of_exported_interface_has_or_is_using_private_name_1,
 * 			)
 * 		}
 * 	}
 * 	return nil // TODO: Audit behavior - should this panic? potentially silent error state in strada
 * }
 */
export function getVariableDeclarationTypeVisibilityDiagnosticMessage(node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<Message> {
  if (node!.Kind === KindVariableDeclaration || node!.Kind === KindBindingElement) {
    return selectDiagnosticBasedOnModuleName(
      symbolAccessibilityResult,
      diagnostics.Exported_variable_0_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
      diagnostics.Exported_variable_0_has_or_is_using_name_1_from_private_module_2,
      diagnostics.Exported_variable_0_has_or_is_using_private_name_1,
    );
  } else if (node!.Kind === KindPropertyDeclaration || node!.Kind === KindPropertyAccessExpression || node!.Kind === KindElementAccessExpression || node!.Kind === KindBinaryExpression || node!.Kind === KindPropertySignature ||
    (node!.Kind === KindParameter && HasSyntacticModifier(node!.Parent, ModifierFlagsPrivate))) {
    if (IsStatic(node)) {
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
        diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_private_name_1,
      );
    } else if (node!.Parent!.Kind === KindClassDeclaration || node!.Kind === KindParameter) {
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
        diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Public_property_0_of_exported_class_has_or_is_using_private_name_1,
      );
    } else {
      // Interfaces cannot have types that cannot be named
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Property_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Property_0_of_exported_interface_has_or_is_using_private_name_1,
      );
    }
  }
  return undefined; // TODO: Audit behavior - should this panic? potentially silent error state in strada
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getAccessorDeclarationTypeVisibilityDiagnosticMessage","kind":"func","status":"implemented","sigHash":"8d488dba72543202d56174122cbec86bb2daf08bc21eadbf7d0bc085b31936ba","bodyHash":"5e7030ddff7b395cf8886ebdc91e54a895c3574d9239e58b45109ce3d06ca932"}
 *
 * Go source:
 * func getAccessorDeclarationTypeVisibilityDiagnosticMessage(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 	if node.Kind == ast.KindSetAccessor {
 * 		// Getters can infer the return type from the returned expression, but setters cannot, so the
 * 		// "_from_external_module_1_but_cannot_be_named" case cannot occur.
 * 		if ast.IsStatic(node) {
 * 			return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Parameter_type_of_public_static_setter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Parameter_type_of_public_static_setter_0_from_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		} else {
 * 			return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Parameter_type_of_public_setter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Parameter_type_of_public_setter_0_from_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		}
 * 	} else {
 * 		if ast.IsStatic(node) {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Return_type_of_public_static_getter_0_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 				diagnostics.Return_type_of_public_static_getter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Return_type_of_public_static_getter_0_from_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		} else {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Return_type_of_public_getter_0_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 				diagnostics.Return_type_of_public_getter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Return_type_of_public_getter_0_from_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		}
 * 	}
 * }
 */
export function getAccessorDeclarationTypeVisibilityDiagnosticMessage(node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<Message> {
  if (node!.Kind === KindSetAccessor) {
    // Getters can infer the return type from the returned expression, but setters cannot, so the
    // "_from_external_module_1_but_cannot_be_named" case cannot occur.
    if (IsStatic(node)) {
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Parameter_type_of_public_static_setter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_type_of_public_static_setter_0_from_exported_class_has_or_is_using_private_name_1,
      );
    } else {
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Parameter_type_of_public_setter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_type_of_public_setter_0_from_exported_class_has_or_is_using_private_name_1,
      );
    }
  } else {
    if (IsStatic(node)) {
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Return_type_of_public_static_getter_0_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
        diagnostics.Return_type_of_public_static_getter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Return_type_of_public_static_getter_0_from_exported_class_has_or_is_using_private_name_1,
      );
    } else {
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Return_type_of_public_getter_0_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
        diagnostics.Return_type_of_public_getter_0_from_exported_class_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Return_type_of_public_getter_0_from_exported_class_has_or_is_using_private_name_1,
      );
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getReturnTypeVisibilityDiagnosticMessage","kind":"func","status":"implemented","sigHash":"43ffc132be21f492406d78e3b72d739d5a062cef54d3a05719fbdf295d1e26db","bodyHash":"49b1ce48a9facaa0c2655e70eb179cf10f9ea390b5584d9297e61b3cde3e3ccb"}
 *
 * Go source:
 * func getReturnTypeVisibilityDiagnosticMessage(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 	switch node.Kind {
 * 	case ast.KindConstructSignature:
 * 		// Interfaces cannot have return types that cannot be named
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
 * 			diagnostics.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_0,
 * 		)
 * 	case ast.KindCallSignature:
 * 		// Interfaces cannot have return types that cannot be named
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Return_type_of_call_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
 * 			diagnostics.Return_type_of_call_signature_from_exported_interface_has_or_is_using_private_name_0,
 * 		)
 * 	case ast.KindIndexSignature:
 * 		// Interfaces cannot have return types that cannot be named
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Return_type_of_index_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
 * 			diagnostics.Return_type_of_index_signature_from_exported_interface_has_or_is_using_private_name_0,
 * 		)
 * 
 * 	case ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 		if ast.IsStatic(node) {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named,
 * 				diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_name_0_from_private_module_1,
 * 				diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_private_name_0,
 * 			)
 * 		} else if node.Parent.Kind == ast.KindClassDeclaration {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named,
 * 				diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_name_0_from_private_module_1,
 * 				diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_private_name_0,
 * 			)
 * 		} else {
 * 			// Interfaces cannot have return types that cannot be named
 * 			return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Return_type_of_method_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
 * 				diagnostics.Return_type_of_method_from_exported_interface_has_or_is_using_private_name_0,
 * 			)
 * 		}
 * 	case ast.KindFunctionDeclaration:
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Return_type_of_exported_function_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named,
 * 			diagnostics.Return_type_of_exported_function_has_or_is_using_name_0_from_private_module_1,
 * 			diagnostics.Return_type_of_exported_function_has_or_is_using_private_name_0,
 * 		)
 * 	default:
 * 		panic("This is unknown kind for signature: " + node.Kind.String())
 * 	}
 * }
 */
export function getReturnTypeVisibilityDiagnosticMessage(node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<Message> {
  switch (node!.Kind) {
    case KindConstructSignature:
      // Interfaces cannot have return types that cannot be named
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
        diagnostics.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_0,
      );
    case KindCallSignature:
      // Interfaces cannot have return types that cannot be named
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Return_type_of_call_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
        diagnostics.Return_type_of_call_signature_from_exported_interface_has_or_is_using_private_name_0,
      );
    case KindIndexSignature:
      // Interfaces cannot have return types that cannot be named
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Return_type_of_index_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
        diagnostics.Return_type_of_index_signature_from_exported_interface_has_or_is_using_private_name_0,
      );
    case KindMethodDeclaration:
    // fallthrough
    case KindMethodSignature:
      if (IsStatic(node)) {
        return selectDiagnosticBasedOnModuleName(
          symbolAccessibilityResult,
          diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named,
          diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_name_0_from_private_module_1,
          diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_private_name_0,
        );
      } else if (node!.Parent!.Kind === KindClassDeclaration) {
        return selectDiagnosticBasedOnModuleName(
          symbolAccessibilityResult,
          diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named,
          diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_name_0_from_private_module_1,
          diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_private_name_0,
        );
      } else {
        // Interfaces cannot have return types that cannot be named
        return selectDiagnosticBasedOnModuleNameNoNameCheck(
          symbolAccessibilityResult,
          diagnostics.Return_type_of_method_from_exported_interface_has_or_is_using_name_0_from_private_module_1,
          diagnostics.Return_type_of_method_from_exported_interface_has_or_is_using_private_name_0,
        );
      }
    case KindFunctionDeclaration:
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Return_type_of_exported_function_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named,
        diagnostics.Return_type_of_exported_function_has_or_is_using_name_0_from_private_module_1,
        diagnostics.Return_type_of_exported_function_has_or_is_using_private_name_0,
      );
    default:
      throw new globalThis.Error("This is unknown kind for signature: " + node!.Kind);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getParameterDeclarationTypeVisibilityDiagnosticMessage","kind":"func","status":"implemented","sigHash":"f9f876bf9880203b8c1ed47b8eb5a868739c2e61347636357eac20b94ccadad2","bodyHash":"c648f0b1ea90f687f1692ea62688b0d7a4a3adce19651aa22f7ce391888000ad"}
 *
 * Go source:
 * func getParameterDeclarationTypeVisibilityDiagnosticMessage(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 	switch node.Parent.Kind {
 * 	case ast.KindConstructor:
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_private_name_1,
 * 		)
 * 
 * 	case ast.KindConstructSignature, ast.KindConstructorType:
 * 		// Interfaces cannot have parameter types that cannot be named
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_1,
 * 		)
 * 
 * 	case ast.KindCallSignature:
 * 		// Interfaces cannot have parameter types that cannot be named
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Parameter_0_of_call_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_name_1,
 * 		)
 * 
 * 	case ast.KindIndexSignature:
 * 		// Interfaces cannot have parameter types that cannot be named
 * 		return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Parameter_0_of_index_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Parameter_0_of_index_signature_from_exported_interface_has_or_is_using_private_name_1,
 * 		)
 * 
 * 	case ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 		if ast.IsStatic(node.Parent) {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 				diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		} else if node.Parent.Parent.Kind == ast.KindClassDeclaration {
 * 			return selectDiagnosticBasedOnModuleName(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 				diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_private_name_1,
 * 			)
 * 		} else {
 * 			// Interfaces cannot have parameter types that cannot be named
 * 			return selectDiagnosticBasedOnModuleNameNoNameCheck(
 * 				symbolAccessibilityResult,
 * 				diagnostics.Parameter_0_of_method_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
 * 				diagnostics.Parameter_0_of_method_from_exported_interface_has_or_is_using_private_name_1,
 * 			)
 * 		}
 * 
 * 	case ast.KindFunctionDeclaration, ast.KindFunctionType:
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Parameter_0_of_exported_function_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Parameter_0_of_exported_function_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Parameter_0_of_exported_function_has_or_is_using_private_name_1,
 * 		)
 * 	case ast.KindSetAccessor, ast.KindGetAccessor:
 * 		return selectDiagnosticBasedOnModuleName(
 * 			symbolAccessibilityResult,
 * 			diagnostics.Parameter_0_of_accessor_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
 * 			diagnostics.Parameter_0_of_accessor_has_or_is_using_name_1_from_private_module_2,
 * 			diagnostics.Parameter_0_of_accessor_has_or_is_using_private_name_1,
 * 		)
 * 	default:
 * 		panic("Unknown parent for parameter: " + node.Parent.Kind.String())
 * 	}
 * }
 */
export function getParameterDeclarationTypeVisibilityDiagnosticMessage(node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<Message> {
  switch (node!.Parent!.Kind) {
    case KindConstructor:
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
        diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_private_name_1,
      );

    case KindConstructSignature:
    // fallthrough
    case KindConstructorType:
      // Interfaces cannot have parameter types that cannot be named
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_1,
      );

    case KindCallSignature:
      // Interfaces cannot have parameter types that cannot be named
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Parameter_0_of_call_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_name_1,
      );

    case KindIndexSignature:
      // Interfaces cannot have parameter types that cannot be named
      return selectDiagnosticBasedOnModuleNameNoNameCheck(
        symbolAccessibilityResult,
        diagnostics.Parameter_0_of_index_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_0_of_index_signature_from_exported_interface_has_or_is_using_private_name_1,
      );

    case KindMethodDeclaration:
    // fallthrough
    case KindMethodSignature:
      if (IsStatic(node!.Parent)) {
        return selectDiagnosticBasedOnModuleName(
          symbolAccessibilityResult,
          diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
          diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_name_1_from_private_module_2,
          diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_name_1,
        );
      } else if (node!.Parent!.Parent!.Kind === KindClassDeclaration) {
        return selectDiagnosticBasedOnModuleName(
          symbolAccessibilityResult,
          diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
          diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_name_1_from_private_module_2,
          diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_private_name_1,
        );
      } else {
        // Interfaces cannot have parameter types that cannot be named
        return selectDiagnosticBasedOnModuleNameNoNameCheck(
          symbolAccessibilityResult,
          diagnostics.Parameter_0_of_method_from_exported_interface_has_or_is_using_name_1_from_private_module_2,
          diagnostics.Parameter_0_of_method_from_exported_interface_has_or_is_using_private_name_1,
        );
      }

    case KindFunctionDeclaration:
    // fallthrough
    case KindFunctionType:
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Parameter_0_of_exported_function_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
        diagnostics.Parameter_0_of_exported_function_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_0_of_exported_function_has_or_is_using_private_name_1,
      );
    case KindSetAccessor:
    // fallthrough
    case KindGetAccessor:
      return selectDiagnosticBasedOnModuleName(
        symbolAccessibilityResult,
        diagnostics.Parameter_0_of_accessor_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named,
        diagnostics.Parameter_0_of_accessor_has_or_is_using_name_1_from_private_module_2,
        diagnostics.Parameter_0_of_accessor_has_or_is_using_private_name_1,
      );
    default:
      throw new globalThis.Error("Unknown parent for parameter: " + node!.Parent!.Kind);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getTypeParameterConstraintVisibilityDiagnosticMessage","kind":"func","status":"implemented","sigHash":"5e49436df86a2f0bb2bc217937a17a36c2cd4c7a99016ea8d1b8368c0691ff57","bodyHash":"9611b14a982713689280c456c2a8f784836eacd5e1a96a8c6eaa38ca885a923f"}
 *
 * Go source:
 * func getTypeParameterConstraintVisibilityDiagnosticMessage(node *ast.Node, symbolAccessibilityResult printer.SymbolAccessibilityResult) *diagnostics.Message {
 * 	// Type parameter constraints are named by user so we should always be able to name it
 * 	switch node.Parent.Kind {
 * 	case ast.KindClassDeclaration:
 * 		return diagnostics.Type_parameter_0_of_exported_class_has_or_is_using_private_name_1
 * 	case ast.KindInterfaceDeclaration:
 * 		return diagnostics.Type_parameter_0_of_exported_interface_has_or_is_using_private_name_1
 * 	case ast.KindMappedType:
 * 		return diagnostics.Type_parameter_0_of_exported_mapped_object_type_is_using_private_name_1
 * 	case ast.KindConstructorType, ast.KindConstructSignature:
 * 		return diagnostics.Type_parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_1
 * 	case ast.KindCallSignature:
 * 		return diagnostics.Type_parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_name_1
 * 	case ast.KindMethodDeclaration, ast.KindMethodSignature:
 * 		if ast.IsStatic(node.Parent) {
 * 			return diagnostics.Type_parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_name_1
 * 		} else if node.Parent.Parent.Kind == ast.KindClassDeclaration {
 * 			return diagnostics.Type_parameter_0_of_public_method_from_exported_class_has_or_is_using_private_name_1
 * 		} else {
 * 			return diagnostics.Type_parameter_0_of_method_from_exported_interface_has_or_is_using_private_name_1
 * 		}
 * 	case ast.KindFunctionType, ast.KindFunctionDeclaration:
 * 		return diagnostics.Type_parameter_0_of_exported_function_has_or_is_using_private_name_1
 * 
 * 	case ast.KindInferType:
 * 		return diagnostics.Extends_clause_for_inferred_type_0_has_or_is_using_private_name_1
 * 
 * 	case ast.KindTypeAliasDeclaration, ast.KindJSTypeAliasDeclaration:
 * 		return diagnostics.Type_parameter_0_of_exported_type_alias_has_or_is_using_private_name_1
 * 
 * 	default:
 * 		panic("This is unknown parent for type parameter: " + node.Parent.Kind.String())
 * 	}
 * }
 */
export function getTypeParameterConstraintVisibilityDiagnosticMessage(node: GoPtr<Node>, symbolAccessibilityResult: SymbolAccessibilityResult): GoPtr<Message> {
  // Type parameter constraints are named by user so we should always be able to name it
  switch (node!.Parent!.Kind) {
    case KindClassDeclaration:
      return diagnostics.Type_parameter_0_of_exported_class_has_or_is_using_private_name_1;
    case KindInterfaceDeclaration:
      return diagnostics.Type_parameter_0_of_exported_interface_has_or_is_using_private_name_1;
    case KindMappedType:
      return diagnostics.Type_parameter_0_of_exported_mapped_object_type_is_using_private_name_1;
    case KindConstructorType:
    // fallthrough
    case KindConstructSignature:
      return diagnostics.Type_parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_1;
    case KindCallSignature:
      return diagnostics.Type_parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_name_1;
    case KindMethodDeclaration:
    // fallthrough
    case KindMethodSignature:
      if (IsStatic(node!.Parent)) {
        return diagnostics.Type_parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_name_1;
      } else if (node!.Parent!.Parent!.Kind === KindClassDeclaration) {
        return diagnostics.Type_parameter_0_of_public_method_from_exported_class_has_or_is_using_private_name_1;
      } else {
        return diagnostics.Type_parameter_0_of_method_from_exported_interface_has_or_is_using_private_name_1;
      }
    case KindFunctionType:
    // fallthrough
    case KindFunctionDeclaration:
      return diagnostics.Type_parameter_0_of_exported_function_has_or_is_using_private_name_1;

    case KindInferType:
      return diagnostics.Extends_clause_for_inferred_type_0_has_or_is_using_private_name_1;

    case KindTypeAliasDeclaration:
    // fallthrough
    case KindJSTypeAliasDeclaration:
      return diagnostics.Type_parameter_0_of_exported_type_alias_has_or_is_using_private_name_1;

    default:
      throw new globalThis.Error("This is unknown parent for type parameter: " + node!.Parent!.Kind);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getRelatedSuggestionByDeclarationKind","kind":"func","status":"implemented","sigHash":"75b3cbe9c18d0f3a439b0275908c95b39033b7ca417cfb0b63c581de5f1a4fcc","bodyHash":"fbf9a2b8ff40696034538987412b1d894168528aeb2251964c6af33500ef8f1e"}
 *
 * Go source:
 * func getRelatedSuggestionByDeclarationKind(kind ast.Kind) *diagnostics.Message {
 * 	switch kind {
 * 	case ast.KindArrowFunction:
 * 		return diagnostics.Add_a_return_type_to_the_function_expression
 * 	case ast.KindFunctionExpression:
 * 		return diagnostics.Add_a_return_type_to_the_function_expression
 * 	case ast.KindMethodDeclaration:
 * 		return diagnostics.Add_a_return_type_to_the_method
 * 	case ast.KindGetAccessor:
 * 		return diagnostics.Add_a_return_type_to_the_get_accessor_declaration
 * 	case ast.KindSetAccessor:
 * 		return diagnostics.Add_a_type_to_parameter_of_the_set_accessor_declaration
 * 	case ast.KindFunctionDeclaration:
 * 		return diagnostics.Add_a_return_type_to_the_function_declaration
 * 	case ast.KindConstructSignature:
 * 		return diagnostics.Add_a_return_type_to_the_function_declaration
 * 	case ast.KindParameter:
 * 		return diagnostics.Add_a_type_annotation_to_the_parameter_0
 * 	case ast.KindVariableDeclaration:
 * 		return diagnostics.Add_a_type_annotation_to_the_variable_0
 * 	case ast.KindPropertyDeclaration:
 * 		return diagnostics.Add_a_type_annotation_to_the_property_0
 * 	case ast.KindPropertySignature:
 * 		return diagnostics.Add_a_type_annotation_to_the_property_0
 * 	case ast.KindExportAssignment:
 * 		return diagnostics.Move_the_expression_in_default_export_to_a_variable_and_add_a_type_annotation_to_it
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function getRelatedSuggestionByDeclarationKind(kind: Kind): GoPtr<Message> {
  switch (kind) {
    case KindArrowFunction:
      return diagnostics.Add_a_return_type_to_the_function_expression;
    case KindFunctionExpression:
      return diagnostics.Add_a_return_type_to_the_function_expression;
    case KindMethodDeclaration:
      return diagnostics.Add_a_return_type_to_the_method;
    case KindGetAccessor:
      return diagnostics.Add_a_return_type_to_the_get_accessor_declaration;
    case KindSetAccessor:
      return diagnostics.Add_a_type_to_parameter_of_the_set_accessor_declaration;
    case KindFunctionDeclaration:
      return diagnostics.Add_a_return_type_to_the_function_declaration;
    case KindConstructSignature:
      return diagnostics.Add_a_return_type_to_the_function_declaration;
    case KindParameter:
      return diagnostics.Add_a_type_annotation_to_the_parameter_0;
    case KindVariableDeclaration:
      return diagnostics.Add_a_type_annotation_to_the_variable_0;
    case KindPropertyDeclaration:
      return diagnostics.Add_a_type_annotation_to_the_property_0;
    case KindPropertySignature:
      return diagnostics.Add_a_type_annotation_to_the_property_0;
    case KindExportAssignment:
      return diagnostics.Move_the_expression_in_default_export_to_a_variable_and_add_a_type_annotation_to_it;
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::getErrorByDeclarationKind","kind":"func","status":"implemented","sigHash":"7a515392b6366b667494dbdca1ef536427ef0146f1ca12cf67953ad1d5c6fa1a","bodyHash":"a760272571b3e233ee0812ebb1b25ecf11d8283c188c214c8bdd4f73c4922dc2"}
 *
 * Go source:
 * func getErrorByDeclarationKind(kind ast.Kind) *diagnostics.Message {
 * 	switch kind {
 * 	case ast.KindFunctionExpression:
 * 		return diagnostics.Function_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations
 * 	case ast.KindFunctionDeclaration:
 * 		return diagnostics.Function_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations
 * 	case ast.KindArrowFunction:
 * 		return diagnostics.Function_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations
 * 	case ast.KindMethodDeclaration:
 * 		return diagnostics.Method_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations
 * 	case ast.KindConstructSignature:
 * 		return diagnostics.Method_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations
 * 	case ast.KindGetAccessor:
 * 		return diagnostics.At_least_one_accessor_must_have_an_explicit_type_annotation_with_isolatedDeclarations
 * 	case ast.KindSetAccessor:
 * 		return diagnostics.At_least_one_accessor_must_have_an_explicit_type_annotation_with_isolatedDeclarations
 * 	case ast.KindParameter:
 * 		return diagnostics.Parameter_must_have_an_explicit_type_annotation_with_isolatedDeclarations
 * 	case ast.KindVariableDeclaration:
 * 		return diagnostics.Variable_must_have_an_explicit_type_annotation_with_isolatedDeclarations
 * 	case ast.KindPropertyDeclaration:
 * 		return diagnostics.Property_must_have_an_explicit_type_annotation_with_isolatedDeclarations
 * 	case ast.KindPropertySignature:
 * 		return diagnostics.Property_must_have_an_explicit_type_annotation_with_isolatedDeclarations
 * 	case ast.KindComputedPropertyName:
 * 		return diagnostics.Computed_property_names_on_class_or_object_literals_cannot_be_inferred_with_isolatedDeclarations
 * 	case ast.KindSpreadAssignment:
 * 		return diagnostics.Objects_that_contain_spread_assignments_can_t_be_inferred_with_isolatedDeclarations
 * 	case ast.KindShorthandPropertyAssignment:
 * 		return diagnostics.Objects_that_contain_shorthand_properties_can_t_be_inferred_with_isolatedDeclarations
 * 	case ast.KindArrayLiteralExpression:
 * 		return diagnostics.Only_const_arrays_can_be_inferred_with_isolatedDeclarations
 * 	case ast.KindExportAssignment:
 * 		return diagnostics.Default_exports_can_t_be_inferred_with_isolatedDeclarations
 * 	case ast.KindSpreadElement:
 * 		return diagnostics.Arrays_with_spread_elements_can_t_inferred_with_isolatedDeclarations
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export function getErrorByDeclarationKind(kind: Kind): GoPtr<Message> {
  switch (kind) {
    case KindFunctionExpression:
      return diagnostics.Function_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations;
    case KindFunctionDeclaration:
      return diagnostics.Function_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations;
    case KindArrowFunction:
      return diagnostics.Function_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations;
    case KindMethodDeclaration:
      return diagnostics.Method_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations;
    case KindConstructSignature:
      return diagnostics.Method_must_have_an_explicit_return_type_annotation_with_isolatedDeclarations;
    case KindGetAccessor:
      return diagnostics.At_least_one_accessor_must_have_an_explicit_type_annotation_with_isolatedDeclarations;
    case KindSetAccessor:
      return diagnostics.At_least_one_accessor_must_have_an_explicit_type_annotation_with_isolatedDeclarations;
    case KindParameter:
      return diagnostics.Parameter_must_have_an_explicit_type_annotation_with_isolatedDeclarations;
    case KindVariableDeclaration:
      return diagnostics.Variable_must_have_an_explicit_type_annotation_with_isolatedDeclarations;
    case KindPropertyDeclaration:
      return diagnostics.Property_must_have_an_explicit_type_annotation_with_isolatedDeclarations;
    case KindPropertySignature:
      return diagnostics.Property_must_have_an_explicit_type_annotation_with_isolatedDeclarations;
    case KindComputedPropertyName:
      return diagnostics.Computed_property_names_on_class_or_object_literals_cannot_be_inferred_with_isolatedDeclarations;
    case KindSpreadAssignment:
      return diagnostics.Objects_that_contain_spread_assignments_can_t_be_inferred_with_isolatedDeclarations;
    case KindShorthandPropertyAssignment:
      return diagnostics.Objects_that_contain_shorthand_properties_can_t_be_inferred_with_isolatedDeclarations;
    case KindArrayLiteralExpression:
      return diagnostics.Only_const_arrays_can_be_inferred_with_isolatedDeclarations;
    case KindExportAssignment:
      return diagnostics.Default_exports_can_t_be_inferred_with_isolatedDeclarations;
    case KindSpreadElement:
      return diagnostics.Arrays_with_spread_elements_can_t_inferred_with_isolatedDeclarations;
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::isDeclarationEnoughForErrors","kind":"func","status":"implemented","sigHash":"5ba62eafc5f0fa752c625076fe34095bfe090ce43d2d86e95f4432d1728e0fb3","bodyHash":"235d51f7f80549f6c66076a273fac5cc08fd41dbfb315093da64e0c932e36a63"}
 *
 * Go source:
 * func isDeclarationEnoughForErrors(node *ast.Node) bool {
 * 	return ast.IsExportAssignment(node) || ast.IsStatement(node) || ast.IsVariableDeclaration(node) || ast.IsPropertyDeclaration(node) || ast.IsParameterDeclaration(node)
 * }
 */
export function isDeclarationEnoughForErrors(node: GoPtr<Node>): bool {
  return IsExportAssignment(node) || IsStatement(node) || IsVariableDeclaration(node) || IsPropertyDeclaration(node) || IsParameterDeclaration(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::isFunctionLikeAndNotConstructor","kind":"func","status":"implemented","sigHash":"46be484dbd10796d61331c582245d5aa5638d1410e02f3e9a52770827f4f9982","bodyHash":"82e149d77ab123a564a80d96b1c75b43c01528e3139466e04363b971f9e855b4"}
 *
 * Go source:
 * func isFunctionLikeAndNotConstructor(node *ast.Node) bool {
 * 	return ast.IsFunctionLikeDeclaration(node) && !ast.IsConstructorDeclaration(node)
 * }
 */
export function isFunctionLikeAndNotConstructor(node: GoPtr<Node>): bool {
  return IsFunctionLikeDeclaration(node) && !IsConstructorDeclaration(node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::findNearestDeclaration","kind":"func","status":"implemented","sigHash":"fd701bfdc3dc5de614c38bfeeb1f9ba9a041eb3dfce56dabefd53db24a838876","bodyHash":"5a792c058cbc386078e411c2a562ac1e94dcc8bc76c4590ea07bad9a59c0d252"}
 *
 * Go source:
 * func findNearestDeclaration(node *ast.Node) *ast.Node {
 * 	result := ast.FindAncestor(node, isDeclarationEnoughForErrors)
 * 	if result == nil {
 * 		return nil
 * 	}
 * 	if ast.IsExportAssignment(result) {
 * 		return result
 * 	}
 * 	if ast.IsReturnStatement(result) {
 * 		return ast.FindAncestor(result, isFunctionLikeAndNotConstructor)
 * 	}
 * 	if ast.IsStatement(result) {
 * 		return nil
 * 	}
 * 	return result
 * }
 */
export function findNearestDeclaration(node: GoPtr<Node>): GoPtr<Node> {
  const result = FindAncestor(node, isDeclarationEnoughForErrors);
  if (result === undefined) {
    return undefined;
  }
  if (IsExportAssignment(result)) {
    return result;
  }
  if (IsReturnStatement(result)) {
    return FindAncestor(result, isFunctionLikeAndNotConstructor);
  }
  if (IsStatement(result)) {
    return undefined;
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createEntityInTypeNodeError","kind":"func","status":"implemented","sigHash":"6aa3fb404ca1091dc458d2ecd0d2915a14c0ec3acf1be77e125003c3b44b3996","bodyHash":"c83e6d71377617e4be471219ca053c78d6a725410af8ee2ec2c4e8f94e60ebd1"}
 *
 * Go source:
 * func createEntityInTypeNodeError(node *ast.Node) *ast.Diagnostic {
 * 	diag := createDiagnosticForNode(node, diagnostics.Type_containing_private_name_0_can_t_be_used_with_isolatedDeclarations, scanner.GetTextOfNode(node))
 * 	addParentDeclarationRelatedInfo(node, diag)
 * 	return diag
 * }
 */
export function createEntityInTypeNodeError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  const diag = NewDiagnosticForNode(node, diagnostics.Type_containing_private_name_0_can_t_be_used_with_isolatedDeclarations, GetTextOfNode(node));
  addParentDeclarationRelatedInfo(node, diag);
  return diag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::addParentDeclarationRelatedInfo","kind":"func","status":"implemented","sigHash":"19d2e58e7b920ec53f31dc32ad86342daecdad3ba8c2c315d220086c961aae5a","bodyHash":"fcce212f01c7c5976cba8e3f157c308b5cd031d0ef31ec0d361a95e8fe266fb3"}
 *
 * Go source:
 * func addParentDeclarationRelatedInfo(node *ast.Node, diag *ast.Diagnostic) {
 * 	parentDeclaration := findNearestDeclaration(node)
 * 	if parentDeclaration == nil {
 * 		return
 * 	}
 * 	targetStr := ""
 * 	if !ast.IsExportAssignment(parentDeclaration) && parentDeclaration.Name() != nil {
 * 		targetStr = scanner.GetTextOfNode(parentDeclaration.Name())
 * 	}
 * 	diag.AddRelatedInfo(createDiagnosticForNode(parentDeclaration, getRelatedSuggestionByDeclarationKind(parentDeclaration.Kind), targetStr))
 * }
 */
export function addParentDeclarationRelatedInfo(node: GoPtr<Node>, diag: GoPtr<Diagnostic>): void {
  const parentDeclaration = findNearestDeclaration(node);
  if (parentDeclaration === undefined) {
    return;
  }
  let targetStr = "";
  if (!IsExportAssignment(parentDeclaration) && Node_Name(parentDeclaration) !== undefined) {
    targetStr = GetTextOfNode(Node_Name(parentDeclaration));
  }
  Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(parentDeclaration, getRelatedSuggestionByDeclarationKind(parentDeclaration!.Kind), targetStr));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createAccessorTypeError","kind":"func","status":"implemented","sigHash":"a5653dce3d3d651475314c6a4572c6a1d6f9fe60a1c830ea55a6bfbba0bd59e9","bodyHash":"ceca6fb05610284ca86cd94b5ccf08dc5481f15ecee3d14c56746ab3e9d28644"}
 *
 * Go source:
 * func createAccessorTypeError(node *ast.Node) *ast.Diagnostic {
 * 	allDeclarations := ast.GetAllAccessorDeclarationsForDeclaration(node, node.Symbol().Declarations)
 * 	getAccessor := allDeclarations.GetAccessor
 * 	setAccessor := allDeclarations.SetAccessor
 * 	targetNode := node
 * 	if ast.IsSetAccessorDeclaration(node) && len(node.Parameters()) > 0 {
 * 		targetNode = node.Parameters()[0]
 * 	}
 * 	diag := createDiagnosticForNode(targetNode, getErrorByDeclarationKind(node.Kind))
 * 	if setAccessor != nil {
 * 		diag.AddRelatedInfo(createDiagnosticForNode(setAccessor.AsNode(), getRelatedSuggestionByDeclarationKind(setAccessor.Kind)))
 * 	}
 * 	if getAccessor != nil {
 * 		diag.AddRelatedInfo(createDiagnosticForNode(getAccessor.AsNode(), getRelatedSuggestionByDeclarationKind(getAccessor.Kind)))
 * 	}
 * 	return diag
 * }
 */
export function createAccessorTypeError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  const allDeclarations = GetAllAccessorDeclarationsForDeclaration(node as unknown as AccessorDeclaration, Node_Symbol(node)!.Declarations ?? []);
  const getAccessor = allDeclarations.GetAccessor;
  const setAccessor = allDeclarations.SetAccessor;
  let targetNode = node;
  if (IsSetAccessorDeclaration(node) && Node_Parameters(node).length > 0) {
    targetNode = Node_Parameters(node)[0];
  }
  const diag = NewDiagnosticForNode(targetNode, getErrorByDeclarationKind(node!.Kind));
  if (setAccessor !== undefined) {
    Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(setAccessor as unknown as GoPtr<Node>, getRelatedSuggestionByDeclarationKind(setAccessor!.Kind)));
  }
  if (getAccessor !== undefined) {
    Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(getAccessor as unknown as GoPtr<Node>, getRelatedSuggestionByDeclarationKind(getAccessor!.Kind)));
  }
  return diag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createObjectLiteralError","kind":"func","status":"implemented","sigHash":"0575ce46984d56d65d175bb6c97a2c755c2d04a7cf3a88d46dedc83a9c4f0b6e","bodyHash":"0f2432d5388e41f2cda5ba5fdf68a369d78138df3c2660c89578c2ff2b251ed1"}
 *
 * Go source:
 * func createObjectLiteralError(node *ast.Node) *ast.Diagnostic {
 * 	diag := createDiagnosticForNode(node, getErrorByDeclarationKind(node.Kind))
 * 	addParentDeclarationRelatedInfo(node, diag)
 * 	return diag
 * }
 */
export function createObjectLiteralError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  const diag = NewDiagnosticForNode(node, getErrorByDeclarationKind(node!.Kind));
  addParentDeclarationRelatedInfo(node, diag);
  return diag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createArrayLiteralError","kind":"func","status":"implemented","sigHash":"8e300c654ae7c7092bbef116a33654b856c50561392fac2b7485ec7e28b79a13","bodyHash":"94bfc738014e91e2307ac1c9402bde949c2e7d635145f34b9ee928b82e0f0e84"}
 *
 * Go source:
 * func createArrayLiteralError(node *ast.Node) *ast.Diagnostic {
 * 	diag := createDiagnosticForNode(node, getErrorByDeclarationKind(node.Kind))
 * 	addParentDeclarationRelatedInfo(node, diag)
 * 	return diag
 * }
 */
export function createArrayLiteralError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  const diag = NewDiagnosticForNode(node, getErrorByDeclarationKind(node!.Kind));
  addParentDeclarationRelatedInfo(node, diag);
  return diag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createReturnTypeError","kind":"func","status":"implemented","sigHash":"5c8f240c67f7a266f128814df82b8b943fcbe6e15ca1f3c18b4131aabecb1f44","bodyHash":"83ef3415fc9d34b19a24b25f6d29fa936f5ff6c1ee4747f0109e2ac8b789b988"}
 *
 * Go source:
 * func createReturnTypeError(node *ast.Node) *ast.Diagnostic {
 * 	diag := createDiagnosticForNode(node, getErrorByDeclarationKind(node.Kind))
 * 	addParentDeclarationRelatedInfo(node, diag)
 * 	diag.AddRelatedInfo(createDiagnosticForNode(node, getRelatedSuggestionByDeclarationKind(node.Kind)))
 * 	return diag
 * }
 */
export function createReturnTypeError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  const diag = NewDiagnosticForNode(node, getErrorByDeclarationKind(node!.Kind));
  addParentDeclarationRelatedInfo(node, diag);
  Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(node, getRelatedSuggestionByDeclarationKind(node!.Kind)));
  return diag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createBindingElementError","kind":"func","status":"implemented","sigHash":"ab7034e703d1812f0c782e80c45079a6abf89028b090890d3a878190add303fb","bodyHash":"3607a51053f90fcd7af3b46de7d8055d0475bb2d7b565458b76698fef3c87c62"}
 *
 * Go source:
 * func createBindingElementError(node *ast.Node) *ast.Diagnostic {
 * 	return createDiagnosticForNode(node, diagnostics.Binding_elements_can_t_be_exported_directly_with_isolatedDeclarations)
 * }
 */
export function createBindingElementError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  return NewDiagnosticForNode(node, diagnostics.Binding_elements_can_t_be_exported_directly_with_isolatedDeclarations);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createVariableOrPropertyError","kind":"func","status":"implemented","sigHash":"4e07f7de0b7ff61aa7ef95a4b28c35cf9188f6e6081eb52a77c162550b0e1b6c","bodyHash":"bd3b5e2bc63956857afe48bc0a119b7b71ed52dfebe6189fbcd729651bd9e056"}
 *
 * Go source:
 * func createVariableOrPropertyError(node *ast.Node) *ast.Diagnostic {
 * 	diag := createDiagnosticForNode(node, getErrorByDeclarationKind(node.Kind))
 * 	diag.AddRelatedInfo(createDiagnosticForNode(node, getRelatedSuggestionByDeclarationKind(node.Kind), scanner.GetTextOfNode(node.Name())))
 * 	return diag
 * }
 */
export function createVariableOrPropertyError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  const diag = NewDiagnosticForNode(node, getErrorByDeclarationKind(node!.Kind));
  Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(node, getRelatedSuggestionByDeclarationKind(node!.Kind), GetTextOfNode(Node_Name(node))));
  return diag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createExpressionError","kind":"func","status":"implemented","sigHash":"83d70fd1f18a87fd9e577729fe795cf4a4a20eb4f621ef399fd37e75ff7c654e","bodyHash":"20c407683b9dc3a64d83dc16b0b0b70a8f4c9feb460f1d60dc9bd6384a442dca"}
 *
 * Go source:
 * func createExpressionError(node *ast.Node) *ast.Diagnostic {
 * 	return createExpressionErrorEx(node, nil)
 * }
 */
export function createExpressionError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  return createExpressionErrorEx(node, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createClassExpressionError","kind":"func","status":"implemented","sigHash":"b9e83524ffd5459d229135420b1e32fd65e1badfef08841d2169f1a8e22189f0","bodyHash":"5c2200c8316c5da1150aba09321cef4c76957fa01fc1cc0100477cd22eb5b2c2"}
 *
 * Go source:
 * func createClassExpressionError(node *ast.Node) *ast.Diagnostic {
 * 	return createExpressionErrorEx(node, diagnostics.Inference_from_class_expressions_is_not_supported_with_isolatedDeclarations)
 * }
 */
export function createClassExpressionError(node: GoPtr<Node>): GoPtr<Diagnostic> {
  return createExpressionErrorEx(node, diagnostics.Inference_from_class_expressions_is_not_supported_with_isolatedDeclarations);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::isParentForIDDIagnostic","kind":"func","status":"implemented","sigHash":"4755c25266ae1f8f278997562f4fb4a216eefd515f0d0e9694faced564089034","bodyHash":"f08bc4633fae2efea2a722d2e1072e74bf42e457b6d48f6c8f80729e75e51dd8"}
 *
 * Go source:
 * func isParentForIDDIagnostic(node *ast.Node) ast.FindAncestorResult {
 * 	if ast.IsExportAssignment(node) {
 * 		return ast.FindAncestorTrue
 * 	}
 * 	if ast.IsStatement(node) {
 * 		return ast.FindAncestorQuit
 * 	}
 * 	return ast.ToFindAncestorResult(!ast.IsParenthesizedExpression(node) && !ast.IsAssertionExpression(node))
 * }
 */
export function isParentForIDDIagnostic(node: GoPtr<Node>): FindAncestorResult {
  if (IsExportAssignment(node)) {
    return FindAncestorTrue;
  }
  if (IsStatement(node)) {
    return FindAncestorQuit;
  }
  return ToFindAncestorResult(!IsParenthesizedExpression(node) && !IsAssertionExpression(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createExpressionErrorEx","kind":"func","status":"implemented","sigHash":"e0d2f382993af9e40c332bc754242e40578b72f72ec63ade7f33ce407de4533f","bodyHash":"717ca0323eb14a651a25660a0829b2034a97f975a3c16e1ada473c727cfb7d1d"}
 *
 * Go source:
 * func createExpressionErrorEx(node *ast.Node, diagnosticMessage *diagnostics.Message) *ast.Diagnostic {
 * 	parentDeclaration := findNearestDeclaration(node)
 * 	if parentDeclaration == nil {
 * 		if diagnosticMessage == nil {
 * 			diagnosticMessage = diagnostics.Expression_type_can_t_be_inferred_with_isolatedDeclarations
 * 		}
 * 		return createDiagnosticForNode(node, diagnosticMessage)
 * 	}
 * 
 * 	targetStr := ""
 * 	if !ast.IsExportAssignment(parentDeclaration) && parentDeclaration.Name() != nil {
 * 		targetStr = scanner.GetTextOfNode(parentDeclaration.Name())
 * 	}
 * 	parent := ast.FindAncestorOrQuit(node.Parent, isParentForIDDIagnostic)
 * 
 * 	if parentDeclaration == parent {
 * 		if diagnosticMessage == nil {
 * 			diagnosticMessage = getErrorByDeclarationKind(parentDeclaration.Kind)
 * 		}
 * 		diag := createDiagnosticForNode(node, diagnosticMessage)
 * 		diag.AddRelatedInfo(createDiagnosticForNode(parentDeclaration, getRelatedSuggestionByDeclarationKind(parentDeclaration.Kind), targetStr))
 * 		return diag
 * 	}
 * 	if diagnosticMessage == nil {
 * 		diagnosticMessage = diagnostics.Expression_type_can_t_be_inferred_with_isolatedDeclarations
 * 	}
 * 	diag := createDiagnosticForNode(node, diagnosticMessage)
 * 	diag.AddRelatedInfo(createDiagnosticForNode(parentDeclaration, getRelatedSuggestionByDeclarationKind(parentDeclaration.Kind), targetStr))
 * 	diag.AddRelatedInfo(createDiagnosticForNode(node, diagnostics.Add_satisfies_and_a_type_assertion_to_this_expression_satisfies_T_as_T_to_make_the_type_explicit))
 * 	return diag
 * }
 */
export function createExpressionErrorEx(node: GoPtr<Node>, diagnosticMessage: GoPtr<Message>): GoPtr<Diagnostic> {
  const parentDeclaration = findNearestDeclaration(node);
  if (parentDeclaration === undefined) {
    const msg = diagnosticMessage !== undefined ? diagnosticMessage : diagnostics.Expression_type_can_t_be_inferred_with_isolatedDeclarations;
    return NewDiagnosticForNode(node, msg);
  }

  let targetStr = "";
  if (!IsExportAssignment(parentDeclaration) && Node_Name(parentDeclaration) !== undefined) {
    targetStr = GetTextOfNode(Node_Name(parentDeclaration));
  }
  const parent = FindAncestorOrQuit(node!.Parent, isParentForIDDIagnostic);

  if (parentDeclaration === parent) {
    const msg = diagnosticMessage !== undefined ? diagnosticMessage : getErrorByDeclarationKind(parentDeclaration!.Kind);
    const diag = NewDiagnosticForNode(node, msg);
    Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(parentDeclaration, getRelatedSuggestionByDeclarationKind(parentDeclaration!.Kind), targetStr));
    return diag;
  }
  const msg = diagnosticMessage !== undefined ? diagnosticMessage : diagnostics.Expression_type_can_t_be_inferred_with_isolatedDeclarations;
  const diag = NewDiagnosticForNode(node, msg);
  Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(parentDeclaration, getRelatedSuggestionByDeclarationKind(parentDeclaration!.Kind), targetStr));
  Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(node, diagnostics.Add_satisfies_and_a_type_assertion_to_this_expression_satisfies_T_as_T_to_make_the_type_explicit));
  return diag;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/diagnostics.go::func::createGetIsolatedDeclarationErrors","kind":"func","status":"implemented","sigHash":"5926979ad783d5255841864ef06b176aaeef555f8a8527ddba243fcf0997e09f","bodyHash":"8954135718b1b9667b6f83abc52f944762cdf4e6321694d52c48bcbf6fde88c0"}
 *
 * Go source:
 * func createGetIsolatedDeclarationErrors(resolver printer.EmitResolver) func(node *ast.Node) *ast.Diagnostic {
 * 	createParameterError := func(node *ast.Node) *ast.Diagnostic {
 * 		if ast.IsSetAccessorDeclaration(node.Parent) {
 * 			return createAccessorTypeError(node.Parent)
 * 		}
 * 		addUndefined := resolver.RequiresAddingImplicitUndefinedUnsafe(node, nil, nil) // skip checker lock - node builder will already have one
 * 		if !addUndefined && node.Initializer() != nil {
 * 			return createExpressionError(node)
 * 		}
 * 		message := getErrorByDeclarationKind(node.Kind)
 * 		if addUndefined {
 * 			message = diagnostics.Declaration_emit_for_this_parameter_requires_implicitly_adding_undefined_to_its_type_This_is_not_supported_with_isolatedDeclarations
 * 		}
 * 		diag := createDiagnosticForNode(node, message)
 * 		targetStr := scanner.GetTextOfNode(node.Name())
 * 		diag.AddRelatedInfo(createDiagnosticForNode(node, getRelatedSuggestionByDeclarationKind(node.Kind), targetStr))
 * 		return diag
 * 	}
 * 
 * 	return func(node *ast.Node) *ast.Diagnostic {
 * 		heritageClause := ast.FindAncestor(node, ast.IsHeritageClause)
 * 		if heritageClause != nil {
 * 			return createDiagnosticForNode(node, diagnostics.Extends_clause_can_t_contain_an_expression_with_isolatedDeclarations)
 * 		}
 * 		if ast.IsPartOfTypeNode(node) || ast.IsTypeQueryNode(node) {
 * 			return createEntityInTypeNodeError(node)
 * 		}
 * 		if ast.IsEntityName(node) || ast.IsEntityNameExpression(node) {
 * 			return createEntityInTypeNodeError(node)
 * 		}
 * 		switch node.Kind {
 * 		case ast.KindGetAccessor, ast.KindSetAccessor:
 * 			return createAccessorTypeError(node)
 * 		case ast.KindComputedPropertyName, ast.KindShorthandPropertyAssignment, ast.KindSpreadAssignment:
 * 			return createObjectLiteralError(node)
 * 		case ast.KindArrayLiteralExpression, ast.KindSpreadElement:
 * 			return createArrayLiteralError(node)
 * 		case ast.KindMethodDeclaration, ast.KindConstructSignature, ast.KindFunctionExpression, ast.KindArrowFunction, ast.KindFunctionDeclaration:
 * 			return createReturnTypeError(node)
 * 		case ast.KindBindingElement:
 * 			return createBindingElementError(node)
 * 		case ast.KindPropertyDeclaration, ast.KindVariableDeclaration:
 * 			return createVariableOrPropertyError(node)
 * 		case ast.KindParameter:
 * 			return createParameterError(node)
 * 		case ast.KindPropertyAssignment:
 * 			return createExpressionError(node.Initializer())
 * 		case ast.KindClassExpression:
 * 			return createClassExpressionError(node)
 * 		default:
 * 			return createExpressionError(node)
 * 		}
 * 	}
 * }
 */
export function createGetIsolatedDeclarationErrors(resolver: EmitResolver): (node: GoPtr<Node>) => GoPtr<Diagnostic> {
  const createParameterError = (node: GoPtr<Node>): GoPtr<Diagnostic> => {
    if (IsSetAccessorDeclaration(node!.Parent)) {
      return createAccessorTypeError(node!.Parent);
    }
    const addUndefined = resolver.RequiresAddingImplicitUndefinedUnsafe(node, undefined, undefined); // skip checker lock - node builder will already have one
    if (!addUndefined && Node_Initializer(node) !== undefined) {
      return createExpressionError(node);
    }
    let message = getErrorByDeclarationKind(node!.Kind);
    if (addUndefined) {
      message = diagnostics.Declaration_emit_for_this_parameter_requires_implicitly_adding_undefined_to_its_type_This_is_not_supported_with_isolatedDeclarations;
    }
    const diag = NewDiagnosticForNode(node, message);
    const targetStr = GetTextOfNode(Node_Name(node));
    Diagnostic_AddRelatedInfo(diag, NewDiagnosticForNode(node, getRelatedSuggestionByDeclarationKind(node!.Kind), targetStr));
    return diag;
  };

  return (node: GoPtr<Node>): GoPtr<Diagnostic> => {
    const heritageClause = FindAncestor(node, IsHeritageClause);
    if (heritageClause !== undefined) {
      return NewDiagnosticForNode(node, diagnostics.Extends_clause_can_t_contain_an_expression_with_isolatedDeclarations);
    }
    if (IsPartOfTypeNode(node) || IsTypeQueryNode(node)) {
      return createEntityInTypeNodeError(node);
    }
    if (IsEntityName(node) || IsEntityNameExpression(node)) {
      return createEntityInTypeNodeError(node);
    }
    switch (node!.Kind) {
      case KindGetAccessor:
      // fallthrough
      case KindSetAccessor:
        return createAccessorTypeError(node);
      case KindComputedPropertyName:
      // fallthrough
      case KindShorthandPropertyAssignment:
      // fallthrough
      case KindSpreadAssignment:
        return createObjectLiteralError(node);
      case KindArrayLiteralExpression:
      // fallthrough
      case KindSpreadElement:
        return createArrayLiteralError(node);
      case KindMethodDeclaration:
      // fallthrough
      case KindConstructSignature:
      // fallthrough
      case KindFunctionExpression:
      // fallthrough
      case KindArrowFunction:
      // fallthrough
      case KindFunctionDeclaration:
        return createReturnTypeError(node);
      case KindBindingElement:
        return createBindingElementError(node);
      case KindPropertyDeclaration:
      // fallthrough
      case KindVariableDeclaration:
        return createVariableOrPropertyError(node);
      case KindParameter:
        return createParameterError(node);
      case KindPropertyAssignment:
        return createExpressionError(Node_Initializer(node));
      case KindClassExpression:
        return createClassExpressionError(node);
      default:
        return createExpressionError(node);
    }
  };
}
