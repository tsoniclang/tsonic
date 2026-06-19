import type { bool } from "../../../go/scalars.js";
import type { GoPtr } from "../../../go/compat.js";
import { Every, Some } from "../../core/core.js";
import type { Node } from "../../ast/spine.js";
import { Node_Name, Node_SubtreeFacts, NodeDefault_AsNode } from "../../ast/spine.js";
import { AsFunctionDeclaration } from "../../ast/generated/casts.js";
import { Node_Elements, Node_Symbol, Node_Expression } from "../../ast/ast.js";
import { GetClassExtendsHeritageElement } from "../../ast/utilities.js";
import type { FunctionDeclaration, TypeParameterDeclaration } from "../../ast/generated/data.js";
import type { StatementList } from "../../ast/generated/unions.js";
import {
  KindClassStaticBlockDeclaration,
  KindClassDeclaration,
  KindEnumDeclaration,
  KindExportAssignment,
  KindExportDeclaration,
  KindFunctionDeclaration,
  KindImportDeclaration,
  KindImportEqualsDeclaration,
  KindInterfaceDeclaration,
  KindJSImportDeclaration,
  KindJSTypeAliasDeclaration,
  KindMethodDeclaration,
  KindModuleDeclaration,
  KindParameter,
  KindParenthesizedExpression,
  KindPropertyDeclaration,
  KindPropertySignature,
  KindTypeAliasDeclaration,
  KindVariableDeclaration,
} from "../../ast/generated/kinds.js";
import type { ModifierFlags } from "../../ast/modifierflags.js";
import {
  ModifierFlagsAmbient,
  ModifierFlagsDefault,
  ModifierFlagsExport,
  ModifierFlagsPrivate,
} from "../../ast/modifierflags.js";
import {
  IsBinaryExpression,
  IsBindingElement,
  IsCallExpression,
  IsCallSignatureDeclaration,
  IsClassDeclaration,
  IsConstructSignatureDeclaration,
  IsConstructorDeclaration,
  IsElementAccessExpression,
  IsExportAssignment,
  IsExportDeclaration,
  IsExpressionWithTypeArguments,
  IsFunctionDeclaration,
  IsGetAccessorDeclaration,
  IsImportEqualsDeclaration,
  IsIndexSignatureDeclaration,
  IsInterfaceDeclaration,
  IsJSTypeAliasDeclaration,
  IsMappedTypeNode,
  IsMethodDeclaration,
  IsMethodSignatureDeclaration,
  IsModuleDeclaration,
  IsOmittedExpression,
  IsParameterDeclaration,
  IsPropertyAccessExpression,
  IsPropertyDeclaration,
  IsPropertySignatureDeclaration,
  IsSetAccessorDeclaration,
  IsSourceFile,
  IsTypeAliasDeclaration,
  IsTypeParameterDeclaration,
  IsVariableDeclaration,
} from "../../ast/generated/predicates.js";
import {
  IsAmbientModule,
  IsAnyImportOrReExport,
  IsBindingPattern,
  IsFunctionLike,
  HasSyntacticModifier,
  GetCombinedModifierFlags,
} from "../../ast/utilities.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import { EmitContext_ParseNode } from "../../printer/emitcontext.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import type { DeclarationEmitHost } from "./transform.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::needsScopeMarker","kind":"func","status":"implemented","sigHash":"7d7f40e3a8c63a70c2706f7e671f76debd787e6ecd343c7b0a1a101016f32933","bodyHash":"0193b40fc4d14b1b5da8852c1dff25eed2eab9a176c8f40f532ff5e047a74227"}
 *
 * Go source:
 * func needsScopeMarker(result *ast.Node) bool {
 * 	return !ast.IsAnyImportOrReExport(result) && !ast.IsExportAssignment(result) && !ast.HasSyntacticModifier(result, ast.ModifierFlagsExport) && !ast.IsAmbientModule(result)
 * }
 */
export function needsScopeMarker(result: GoPtr<Node>): bool {
  return (!IsAnyImportOrReExport(result) && !IsExportAssignment(result) && !HasSyntacticModifier(result, ModifierFlagsExport) && !IsAmbientModule(result)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::canHaveLiteralInitializer","kind":"func","status":"implemented","sigHash":"499fa813f7479096e87aaec7a8c2f189eaa61f77e836a90180e44ac614ae2eff","bodyHash":"620dfdb52cb2dade77fc5c47739349d5e253c76009edde06f74dae3d7f1835f7"}
 *
 * Go source:
 * func canHaveLiteralInitializer(host DeclarationEmitHost, node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature:
 * 		return host.GetEffectiveDeclarationFlags(node, ast.ModifierFlagsPrivate) == 0
 * 	case ast.KindParameter,
 * 		ast.KindVariableDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function canHaveLiteralInitializer(host: DeclarationEmitHost, node: GoPtr<Node>): bool {
  switch (node!.Kind) {
    case KindPropertyDeclaration:
    case KindPropertySignature:
      return (host.GetEffectiveDeclarationFlags(node, ModifierFlagsPrivate) === 0) as bool;
    case KindParameter:
    case KindVariableDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::canProduceDiagnostics","kind":"func","status":"implemented","sigHash":"e23aba0a5f9955eeb93bbcb851c626c720ea88b6305bb26f6c78876d1c238266","bodyHash":"e4567f4c2e67fb9ae439aca33d8526870696723ed3269b77261816089384e7fd"}
 *
 * Go source:
 * func canProduceDiagnostics(node *ast.Node) bool {
 * 	return ast.IsVariableDeclaration(node) ||
 * 		ast.IsPropertyDeclaration(node) ||
 * 		ast.IsPropertySignatureDeclaration(node) ||
 * 		ast.IsBindingElement(node) ||
 * 		ast.IsSetAccessorDeclaration(node) ||
 * 		ast.IsGetAccessorDeclaration(node) ||
 * 		ast.IsConstructSignatureDeclaration(node) ||
 * 		ast.IsCallSignatureDeclaration(node) ||
 * 		ast.IsMethodDeclaration(node) ||
 * 		ast.IsMethodSignatureDeclaration(node) ||
 * 		ast.IsFunctionDeclaration(node) ||
 * 		ast.IsParameterDeclaration(node) ||
 * 		ast.IsTypeParameterDeclaration(node) ||
 * 		ast.IsExpressionWithTypeArguments(node) ||
 * 		ast.IsImportEqualsDeclaration(node) ||
 * 		ast.IsTypeAliasDeclaration(node) ||
 * 		ast.IsJSTypeAliasDeclaration(node) ||
 * 		ast.IsConstructorDeclaration(node) ||
 * 		ast.IsIndexSignatureDeclaration(node) ||
 * 		ast.IsPropertyAccessExpression(node) ||
 * 		ast.IsElementAccessExpression(node) ||
 * 		ast.IsBinaryExpression(node) ||
 * 		ast.IsCallExpression(node) // || // !!! TODO: JSDoc support
 * 	/* ast.IsJSDocTypeAlias(node); * /
 * }
 */
export function canProduceDiagnostics(node: GoPtr<Node>): bool {
  return (IsVariableDeclaration(node) ||
    IsPropertyDeclaration(node) ||
    IsPropertySignatureDeclaration(node) ||
    IsBindingElement(node) ||
    IsSetAccessorDeclaration(node) ||
    IsGetAccessorDeclaration(node) ||
    IsConstructSignatureDeclaration(node) ||
    IsCallSignatureDeclaration(node) ||
    IsMethodDeclaration(node) ||
    IsMethodSignatureDeclaration(node) ||
    IsFunctionDeclaration(node) ||
    IsParameterDeclaration(node) ||
    IsTypeParameterDeclaration(node) ||
    IsExpressionWithTypeArguments(node) ||
    IsImportEqualsDeclaration(node) ||
    IsTypeAliasDeclaration(node) ||
    IsJSTypeAliasDeclaration(node) ||
    IsConstructorDeclaration(node) ||
    IsIndexSignatureDeclaration(node) ||
    IsPropertyAccessExpression(node) ||
    IsElementAccessExpression(node) ||
    IsBinaryExpression(node) ||
    IsCallExpression(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::isDeclarationAndNotVisible","kind":"func","status":"implemented","sigHash":"22f3ad7e95b5a5f6e1b23c741fb2b5959d1cbf82841f6c40d0801623630d7d08","bodyHash":"71a196a05cdcdfc6252fff90de375cd3075f07b58f26dda190992810c6d40a3c"}
 *
 * Go source:
 * func isDeclarationAndNotVisible(emitContext *printer.EmitContext, resolver printer.EmitResolver, node *ast.Node) bool {
 * 	node = emitContext.ParseNode(node)
 * 	switch node.Kind {
 * 	case ast.KindFunctionDeclaration,
 * 		ast.KindModuleDeclaration,
 * 		ast.KindInterfaceDeclaration,
 * 		ast.KindClassDeclaration,
 * 		ast.KindTypeAliasDeclaration,
 * 		ast.KindJSTypeAliasDeclaration,
 * 		ast.KindEnumDeclaration:
 * 		return !resolver.IsDeclarationVisible(node)
 * 	// The following should be doing their own visibility checks based on filtering their members
 * 	case ast.KindVariableDeclaration:
 * 		return !getBindingNameVisible(resolver, node)
 * 	case ast.KindImportEqualsDeclaration,
 * 		ast.KindImportDeclaration,
 * 		ast.KindJSImportDeclaration,
 * 		ast.KindExportDeclaration,
 * 		ast.KindExportAssignment:
 * 		return false
 * 	case ast.KindClassStaticBlockDeclaration:
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isDeclarationAndNotVisible(emitContext: GoPtr<EmitContext>, resolver: EmitResolver, node: GoPtr<Node>): bool {
  const parseNode = EmitContext_ParseNode(emitContext, node);
  switch (parseNode!.Kind) {
    case KindFunctionDeclaration:
    case KindModuleDeclaration:
    case KindInterfaceDeclaration:
    case KindClassDeclaration:
    case KindTypeAliasDeclaration:
    case KindJSTypeAliasDeclaration:
    case KindEnumDeclaration:
      return (!resolver.IsDeclarationVisible(parseNode)) as bool;
    // The following should be doing their own visibility checks based on filtering their members
    case KindVariableDeclaration:
      return (!getBindingNameVisible(resolver, parseNode)) as bool;
    case KindImportEqualsDeclaration:
    case KindImportDeclaration:
    case KindJSImportDeclaration:
    case KindExportDeclaration:
    case KindExportAssignment:
      return false as bool;
    case KindClassStaticBlockDeclaration:
      return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::getBindingNameVisible","kind":"func","status":"implemented","sigHash":"b22483ac11dd007659fc4b438344149334ee5fadc1fc543064026b239271843f","bodyHash":"c30c295ee6b82fc3e86f5366fa2f07a2b464e1d76abaf0eaad45bf1918824342"}
 *
 * Go source:
 * func getBindingNameVisible(resolver printer.EmitResolver, elem *ast.Node) bool {
 * 	if ast.IsOmittedExpression(elem) {
 * 		return false
 * 	}
 * 	// TODO: parseArrayBindingElement _never_ parses out an OmittedExpression anymore, instead producing a nameless binding element
 * 	// Audit if OmittedExpression should be removed
 * 	if elem.Name() == nil {
 * 		return false
 * 	}
 * 	if ast.IsBindingPattern(elem.Name()) {
 * 		// If any child binding pattern element has been marked visible (usually by collect linked aliases), then this is visible
 * 		for _, elem := range elem.Name().Elements() {
 * 			if getBindingNameVisible(resolver, elem) {
 * 				return true
 * 			}
 * 		}
 * 		return false
 * 	} else {
 * 		return resolver.IsDeclarationVisible(elem)
 * 	}
 * }
 */
export function getBindingNameVisible(resolver: EmitResolver, elem: GoPtr<Node>): bool {
  if (IsOmittedExpression(elem)) {
    return false as bool;
  }
  // TODO: parseArrayBindingElement _never_ parses out an OmittedExpression anymore, instead producing a nameless binding element
  // Audit if OmittedExpression should be removed
  if (Node_Name(elem) === undefined) {
    return false as bool;
  }
  if (IsBindingPattern(Node_Name(elem))) {
    // If any child binding pattern element has been marked visible (usually by collect linked aliases), then this is visible
    for (const el of Node_Elements(Node_Name(elem))!) {
      if (getBindingNameVisible(resolver, el)) {
        return true as bool;
      }
    }
    return false as bool;
  } else {
    return resolver.IsDeclarationVisible(elem) as bool;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::isEnclosingDeclaration","kind":"func","status":"implemented","sigHash":"18333c60bdfe553107e0c66a5dd5aeaad7786d55145ce470992902561fa715ac","bodyHash":"cbf6d472c671faa96578fdd44173e96c18f85f228f8266f4ee8a818d2173b4ad"}
 *
 * Go source:
 * func isEnclosingDeclaration(node *ast.Node) bool {
 * 	return ast.IsSourceFile(node) ||
 * 		ast.IsTypeAliasDeclaration(node) ||
 * 		ast.IsJSTypeAliasDeclaration(node) ||
 * 		ast.IsModuleDeclaration(node) ||
 * 		ast.IsClassDeclaration(node) ||
 * 		ast.IsInterfaceDeclaration(node) ||
 * 		ast.IsFunctionLike(node) ||
 * 		ast.IsIndexSignatureDeclaration(node) ||
 * 		ast.IsMappedTypeNode(node)
 * }
 */
export function isEnclosingDeclaration(node: GoPtr<Node>): bool {
  return (IsSourceFile(node) ||
    IsTypeAliasDeclaration(node) ||
    IsJSTypeAliasDeclaration(node) ||
    IsModuleDeclaration(node) ||
    IsClassDeclaration(node) ||
    IsInterfaceDeclaration(node) ||
    IsFunctionLike(node) ||
    IsIndexSignatureDeclaration(node) ||
    IsMappedTypeNode(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::isAlwaysType","kind":"func","status":"implemented","sigHash":"0c48daea82de0ca5411a19aa6dbd929fdfa1c0d817e6e05278665c21d379b4d0","bodyHash":"d7c439a4c15bf02220eab1f187d65a11bfd0b1282d267dc9ea0520ad796d2d04"}
 *
 * Go source:
 * func isAlwaysType(node *ast.Node) bool {
 * 	if node.Kind == ast.KindInterfaceDeclaration {
 * 		return true
 * 	}
 * 	return false
 * }
 */
export function isAlwaysType(node: GoPtr<Node>): bool {
  if (node!.Kind === KindInterfaceDeclaration) {
    return true as bool;
  }
  return false as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::maskModifierFlags","kind":"func","status":"implemented","sigHash":"d52749acacff48feaf8f008c345fad6c60ee42d366c6697eba3bc55079f6f976","bodyHash":"33980b7e7e0efd22ef8072c1efffa8bd752d5bd4b10962cf041e02ae4c9ac26c"}
 *
 * Go source:
 * func maskModifierFlags(node *ast.Node, modifierMask ast.ModifierFlags, modifierAdditions ast.ModifierFlags) ast.ModifierFlags {
 * 	flags := (ast.GetCombinedModifierFlags(node) & modifierMask) | modifierAdditions
 * 	if flags&ast.ModifierFlagsDefault != 0 && (flags&ast.ModifierFlagsExport == 0) {
 * 		// A non-exported default is a nonsequitor - we usually try to remove all export modifiers
 * 		// from statements in ambient declarations; but a default export must retain its export modifier to be syntactically valid
 * 		flags ^= ast.ModifierFlagsExport
 * 	}
 * 	if flags&ast.ModifierFlagsDefault != 0 && flags&ast.ModifierFlagsAmbient != 0 {
 * 		flags ^= ast.ModifierFlagsAmbient // `declare` is never required alongside `default` (and would be an error if printed)
 * 	}
 * 	return flags
 * }
 */
export function maskModifierFlags(node: GoPtr<Node>, modifierMask: ModifierFlags, modifierAdditions: ModifierFlags): ModifierFlags {
  let flags: ModifierFlags = (((GetCombinedModifierFlags(node) & modifierMask) >>> 0) | modifierAdditions) >>> 0;
  if ((flags & ModifierFlagsDefault) !== 0 && ((flags & ModifierFlagsExport) === 0)) {
    // A non-exported default is a nonsequitor - we usually try to remove all export modifiers
    // from statements in ambient declarations; but a default export must retain its export modifier to be syntactically valid
    flags = (flags ^ ModifierFlagsExport) >>> 0;
  }
  if ((flags & ModifierFlagsDefault) !== 0 && (flags & ModifierFlagsAmbient) !== 0) {
    flags = (flags ^ ModifierFlagsAmbient) >>> 0; // `declare` is never required alongside `default` (and would be an error if printed)
  }
  return flags;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::unwrapParenthesizedExpression","kind":"func","status":"implemented","sigHash":"f1e11a8429623cb78e4afeeeb5dbad0a4b3940ee57b7aa34f7fb4fb1fe0929b4","bodyHash":"28c3378ac3ad425d509b82c64936c631c12b82cd9fb54a987172e89eaf755bc7"}
 *
 * Go source:
 * func unwrapParenthesizedExpression(o *ast.Node) *ast.Node {
 * 	for o.Kind == ast.KindParenthesizedExpression {
 * 		o = o.Expression()
 * 	}
 * 	return o
 * }
 */
export function unwrapParenthesizedExpression(o: GoPtr<Node>): GoPtr<Node> {
  while (o!.Kind === KindParenthesizedExpression) {
    o = Node_Expression(o);
  }
  return o;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::isPrivateMethodTypeParameter","kind":"func","status":"implemented","sigHash":"57f6d289f376bfbccdc52a1cbc60e4bc1de52f675dba18b8965ef7713c9892b6","bodyHash":"6f5f3c7f3d15b1cff1588620db8758e875e40d759682e18fd9d9fd788e03a383"}
 *
 * Go source:
 * func isPrivateMethodTypeParameter(host DeclarationEmitHost, node *ast.TypeParameterDeclaration) bool {
 * 	return node.AsNode().Parent.Kind == ast.KindMethodDeclaration && host.GetEffectiveDeclarationFlags(node.AsNode().Parent, ast.ModifierFlagsPrivate) != 0
 * }
 */
export function isPrivateMethodTypeParameter(host: DeclarationEmitHost, node: GoPtr<TypeParameterDeclaration>): bool {
  return (NodeDefault_AsNode(node)!.Parent!.Kind === KindMethodDeclaration && host.GetEffectiveDeclarationFlags(NodeDefault_AsNode(node)!.Parent, ModifierFlagsPrivate) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::shouldEmitFunctionProperties","kind":"func","status":"implemented","sigHash":"9f69d137b57130cdec0a098bc830b16299a5aba56531ccfc7ea955185a87eacd","bodyHash":"c2183f2ce74142e188233f377dfcd3a9f4ca352b3da0a91464894d0488d3d542"}
 *
 * Go source:
 * func shouldEmitFunctionProperties(input *ast.FunctionDeclaration) bool {
 * 	if input.Body != nil {
 * 		return true
 * 	}
 * 	return !core.Every(input.Symbol.Declarations, func(decl *ast.Node) bool {
 * 		return !ast.IsFunctionDeclaration(decl) || decl.AsFunctionDeclaration().Body == nil
 * 	})
 * }
 */
export function shouldEmitFunctionProperties(input: GoPtr<FunctionDeclaration>): bool {
  if (input!.Body !== undefined) {
    return true as bool;
  }
  return (!Every(Node_Symbol(NodeDefault_AsNode(input))!.Declarations, (decl: GoPtr<Node>) => {
    return (!IsFunctionDeclaration(decl) || AsFunctionDeclaration(decl)!.Body === undefined) as bool;
  })) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::getEffectiveBaseTypeNode","kind":"func","status":"implemented","sigHash":"44b42b4f12b8ede2a340739236e0234e7da73dd869f4702255a687b12e692ed2","bodyHash":"eccae320d8748f6c80c5cbc5bc5f476554a263fe86a7c26623839e736cb47036"}
 *
 * Go source:
 * func getEffectiveBaseTypeNode(node *ast.Node) *ast.Node {
 * 	baseType := ast.GetClassExtendsHeritageElement(node)
 * 	// !!! TODO: JSDoc support
 * 	// if (baseType && isInJSFile(node)) {
 * 	//     // Prefer an @augments tag because it may have type parameters.
 * 	//     const tag = getJSDocAugmentsTag(node);
 * 	//     if (tag) {
 * 	//         return tag.class;
 * 	//     }
 * 	// }
 * 	return baseType
 * }
 */
export function getEffectiveBaseTypeNode(node: GoPtr<Node>): GoPtr<Node> {
  const baseType = GetClassExtendsHeritageElement(node);
  // !!! TODO: JSDoc support
  // if (baseType && isInJSFile(node)) {
  //     // Prefer an @augments tag because it may have type parameters.
  //     const tag = getJSDocAugmentsTag(node);
  //     if (tag) {
  //         return tag.class;
  //     }
  // }
  return baseType;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::isScopeMarker","kind":"func","status":"implemented","sigHash":"94a0775b2c4dd2596dc714072023bd43b3da5fcd89ea52d2e7bbc9b12f57ed54","bodyHash":"3d1c06e30c4dc5d0ba31bd8c974d6a7054b31fef89e37e6f3156e1145a66fa24"}
 *
 * Go source:
 * func isScopeMarker(node *ast.Node) bool {
 * 	return ast.IsExportAssignment(node) || ast.IsExportDeclaration(node)
 * }
 */
export function isScopeMarker(node: GoPtr<Node>): bool {
  return (IsExportAssignment(node) || IsExportDeclaration(node)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/declarations/util.go::func::hasScopeMarker","kind":"func","status":"implemented","sigHash":"8fc21ece0e9395e575a890742e2dc95ced5b7df517d727fc3e4de3e2c6a380e4","bodyHash":"c41e80d581699f7fff8fc4716f54eca357a34dc6443c289737edd73f0526f1b1"}
 *
 * Go source:
 * func hasScopeMarker(statements *ast.StatementList) bool {
 * 	if statements == nil {
 * 		return false
 * 	}
 * 	return core.Some(statements.Nodes, isScopeMarker)
 * }
 */
export function hasScopeMarker(statements: GoPtr<StatementList>): bool {
  if (statements === undefined) {
    return false as bool;
  }
  return Some(statements!.Nodes, isScopeMarker);
}
