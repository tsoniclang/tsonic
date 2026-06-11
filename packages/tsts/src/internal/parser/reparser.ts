import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { ModifierList, Node, NodeList } from "../ast/spine.js";
import { Node_Modifiers, Node_FunctionLikeData, Node_Name, NodeFactory_NewNodeList } from "../ast/spine.js";
import { NodeFlagsReparsed, NodeFlagsHasJSDoc } from "../ast/generated/flags.js";
import type { ClassLikeBase } from "../ast/generated/node.js";
import type { JSDocParameterOrPropertyTag, ParameterDeclaration } from "../ast/generated/data.js";
import type { TypeNode } from "../ast/generated/unions.js";
import type { Parser } from "./parser/state.js";
import { Parser_overrideParentInImmediateChildren } from "./parser/support.js";
import {
  AsJSDoc,
  AsJSDocCallbackTag,
  AsJSDocImportTag,
  AsJSDocOverloadTag,
  AsJSDocTypedefTag,
  AsJSDocParameterOrPropertyTag,
  AsJSDocTemplateTag,
  AsJSDocThisTag,
  AsJSDocSatisfiesTag,
  AsJSDocImplementsTag,
  AsJSDocAugmentsTag,
  AsJSDocVariadicType,
  AsJSDocTypeLiteral,
  AsTypeParameterDeclaration,
  AsQualifiedName,
  AsVariableStatement,
  AsVariableDeclarationList,
  AsBinaryExpression,
  AsShorthandPropertyAssignment,
  AsHeritageClause,
  AsClassDeclaration,
  AsClassExpression,
  AsExpressionWithTypeArguments,
  AsImportClause,
  AsPropertySignatureDeclaration,
  AsParameterDeclaration,
  AsTypeAliasDeclaration,
  AsJSDocSignature,
  AsModuleDeclaration,
} from "../ast/generated/casts.js";
import {
  IsFunctionDeclaration,
  IsMethodDeclaration,
  IsConstructorDeclaration,
  IsJSDocTypedefTag,
  IsJSDocCallbackTag,
  IsJSDocTemplateTag,
  IsModuleDeclaration,
  IsQualifiedName,
} from "../ast/generated/predicates.js";
import {
  KindJSDocTypedefTag,
  KindJSDocCallbackTag,
  KindJSDocImportTag,
  KindJSDocOverloadTag,
  KindJSDocTypeTag,
  KindJSDocSatisfiesTag,
  KindJSDocTemplateTag,
  KindJSDocParameterTag,
  KindJSDocPropertyTag,
  KindJSDocThisTag,
  KindJSDocReturnTag,
  KindJSDocReadonlyTag,
  KindJSDocPrivateTag,
  KindJSDocPublicTag,
  KindJSDocProtectedTag,
  KindJSDocOverrideTag,
  KindJSDocImplementsTag,
  KindJSDocAugmentsTag,
  KindJSDocVariadicType,
  KindJSDocOptionalType,
  KindJSDocTypeLiteral,
  KindJSDocTypeExpression,
  KindFunctionDeclaration,
  KindMethodDeclaration,
  KindConstructor,
  KindVariableStatement,
  KindVariableDeclaration,
  KindExportAssignment,
  KindPropertyDeclaration,
  KindPropertyAssignment,
  KindShorthandPropertyAssignment,
  KindParameter,
  KindExpressionStatement,
  KindReturnStatement,
  KindParenthesizedExpression,
  KindBinaryExpression,
  KindClassDeclaration,
  KindClassExpression,
  KindIdentifier,
  KindReadonlyKeyword,
  KindPrivateKeyword,
  KindPublicKeyword,
  KindProtectedKeyword,
  KindOverrideKeyword,
  KindExportKeyword,
  KindQuestionToken,
  KindDotDotDotToken,
  KindImplementsKeyword,
  KindExtendsKeyword,
  KindAnyKeyword,
  KindNamespaceKeyword,
  KindTypeKeyword,
  KindThisKeyword,
  KindGetAccessor,
  KindSatisfiesExpression,
  KindSetAccessor,
} from "../ast/generated/kinds.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  GetAssignmentDeclarationKind,
  GetRightMostAssignedExpression,
  JSDeclarationKindNone,
  HasSamePropertyAccessName,
  IsFunctionLike,
  IsFunctionLikeDeclaration,
} from "../ast/utilities.js";
import {
  Node_AsMutable,
  Node_Text,
  Node_Body,
  Node_ModifierNodes,
  MutableNode_SetType,
  MutableNode_SetInitializer,
  MutableNode_SetExpression,
  MutableNode_SetModifiers,
  Node_TagName,
  Node_TypeExpression,
  Node_CommentList,
  Node_ClassName,
  Node_Parameters,
  Node_ParameterList,
  Node_Type,
  Node_Initializer,
  Node_Expression,
  Node_TypeParameterList,
  Node_TypeParameters,
} from "../ast/ast.js";
import { Node_Pos, Node_End } from "../ast/spine.js";
import {
  NewToken,
  NewIdentifier,
  NewKeywordTypeNode,
  NewParameterDeclaration,
  NewFunctionDeclaration,
  NewMethodDeclaration,
  NewConstructorDeclaration,
  NewFunctionTypeNode,
  NewPropertySignatureDeclaration,
  NewTypeLiteralNode,
  NewArrayTypeNode,
  NewAsExpression,
  NewSatisfiesExpression,
  NewJSTypeAliasDeclaration,
  NewJSImportDeclaration,
  NewJSDoc,
  NewHeritageClause,
  NewModuleBlock,
  NewModuleDeclaration,
  NewTypeParameterDeclaration,
} from "../ast/generated/factory.js";
import {
  NodeFactory_DeepCloneReparse,
  NodeFactory_DeepCloneReparseModifiers,
} from "../ast/deepclone.js";
import { Every, Find, Map as core_Map } from "../core/core.js";
import { NewTextRange } from "../core/text.js";
import type { TextRange } from "../core/text.js";
import { Arena_NewSlice, Arena_NewSlice1 } from "../core/arena.js";
import { Parser_newNodeList, Parser_newModifierList } from "./parser/lists.js";
import { Parser_finishNodeWithEnd } from "./parser/statements-declarations.js";
import { PCObjectLiteralMembers } from "./parser/state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.finishReparsedNode","kind":"method","status":"implemented","sigHash":"9746fe8b20ebd2539697c4040b2a128334306a1a0d090567ea8bdba97f6a5691","bodyHash":"3dd5f736e3ddbd9486e0f32fbca391f7d4819aaa1565b658123015f0cb4fcd3f"}
 *
 * Go source:
 * func (p *Parser) finishReparsedNode(node *ast.Node, locationNode *ast.Node) {
 * 	node.Flags = p.contextFlags | ast.NodeFlagsReparsed
 * 	node.Loc = locationNode.Loc
 * 	p.overrideParentInImmediateChildren(node)
 * }
 */
export function Parser_finishReparsedNode(receiver: GoPtr<Parser>, node: GoPtr<Node>, locationNode: GoPtr<Node>): void {
  node!.Flags = receiver!.contextFlags | NodeFlagsReparsed;
  node!.Loc = locationNode!.Loc;
  Parser_overrideParentInImmediateChildren(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.finishMutatedNode","kind":"method","status":"implemented","sigHash":"096abd4f1a06b0bf66559823d1a15e3f624b269a7d37bd67dca0af3f5982b471","bodyHash":"b0a9effb1e712784c8ddbb37b4f061fcb011541208cfc47fe71c7e0acd181770"}
 *
 * Go source:
 * func (p *Parser) finishMutatedNode(node *ast.Node) {
 * 	p.overrideParentInImmediateChildren(node)
 * }
 */
export function Parser_finishMutatedNode(receiver: GoPtr<Parser>, node: GoPtr<Node>): void {
  Parser_overrideParentInImmediateChildren(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.addDeepCloneReparse","kind":"method","status":"implemented","sigHash":"29db37e91a484a94960b9180e2184ad32f5de34e96b0609db77354b5b9919a4b","bodyHash":"2023024853d04e68a9dab0b74c4c68922584c7dd3dab5ad7b4744af7f95147bc"}
 *
 * Go source:
 * func (p *Parser) addDeepCloneReparse(node *ast.Node) *ast.Node {
 * 	clone := p.factory.DeepCloneReparse(node)
 * 	if clone != nil {
 * 		p.reparsedClones = append(p.reparsedClones, clone)
 * 	}
 * 	return clone
 * }
 */
export function Parser_addDeepCloneReparse(receiver: GoPtr<Parser>, node: GoPtr<Node>): GoPtr<Node> {
  const clone = NodeFactory_DeepCloneReparse(receiver!.factory, node);
  if (clone !== undefined) {
    receiver!.reparsedClones = [...receiver!.reparsedClones, clone];
  }
  return clone;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.reparseTags","kind":"method","status":"implemented","sigHash":"75b2d992a3104a44b40e0fae3d99b923c0e702cf7df7972a2bbe7eba5f3f08be","bodyHash":"49267c03a8ccd1b16741fea1700e4eee8964a5f8fe92476761aa99b34afc5947"}
 *
 * Go source:
 * func (p *Parser) reparseTags(parent *ast.Node, jsDoc []*ast.Node) {
 * 	for _, j := range jsDoc {
 * 		isLast := j == jsDoc[len(jsDoc)-1]
 * 		tags := j.AsJSDoc().Tags
 * 		if tags == nil {
 * 			continue
 * 		}
 * 		for _, tag := range tags.Nodes {
 * 			p.reparseUnhosted(tag, parent, j)
 * 			if isLast {
 * 				p.reparseHosted(tag, parent, j)
 * 			}
 * 		}
 * 	}
 * }
 */
export function Parser_reparseTags(receiver: GoPtr<Parser>, parent: GoPtr<Node>, jsDoc: GoSlice<GoPtr<Node>>): void {
  for (const j of jsDoc) {
    const isLast = j === jsDoc[jsDoc.length - 1];
    const tags = AsJSDoc(j)!.Tags;
    if (tags === undefined) {
      continue;
    }
    for (const tag of tags!.Nodes) {
      Parser_reparseUnhosted(receiver, tag, parent, j);
      if (isLast) {
        Parser_reparseHosted(receiver, tag, parent, j);
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.reparseUnhosted","kind":"method","status":"implemented","sigHash":"dde604f1c50ebedb28ab84d37632a0d54944cffb728423ba5b489b46c172cdce","bodyHash":"32d6237f6dc8b3158e6b4d0205c608cfe84fff8621f3b62085d7331a1b3a707f"}
 *
 * Go source:
 * func (p *Parser) reparseUnhosted(tag *ast.Node, parent *ast.Node, jsDoc *ast.Node) {
 * 	switch tag.Kind {
 * 	case ast.KindJSDocTypedefTag:
 * 		typeExpression := tag.TypeExpression()
 * 		if typeExpression == nil {
 * 			break
 * 		}
 * 		typeAlias := p.factory.NewJSTypeAliasDeclaration(nil, p.addDeepCloneReparse(tag.AsJSDocTypedefTag().Name()), nil, nil)
 * 		typeAlias.AsTypeAliasDeclaration().TypeParameters = p.gatherTypeParameters(jsDoc, tag)
 * 		var t *ast.Node
 * 		switch typeExpression.Kind {
 * 		case ast.KindJSDocTypeExpression:
 * 			t = p.addDeepCloneReparse(typeExpression.Type())
 * 		case ast.KindJSDocTypeLiteral:
 * 			t = p.reparseJSDocTypeLiteral(typeExpression)
 * 		default:
 * 			panic("typedef tag type expression should be a name reference or a type expression" + typeExpression.Kind.String())
 * 		}
 * 		typeAlias.AsTypeAliasDeclaration().Type = t
 * 		p.finishReparsedNode(typeAlias, tag)
 * 		p.jsdocInfos = append(p.jsdocInfos, JSDocInfo{parent: typeAlias, jsDocs: []*ast.Node{jsDoc}})
 * 		typeAlias.Flags |= ast.NodeFlagsHasJSDoc
 * 		p.reparseList = append(p.reparseList, typeAlias)
 * 	case ast.KindJSDocCallbackTag:
 * 		callbackTag := tag.AsJSDocCallbackTag()
 * 		if callbackTag.TypeExpression == nil {
 * 			break
 * 		}
 * 		functionType := p.reparseJSDocSignature(callbackTag.TypeExpression, tag, jsDoc, tag, nil)
 * 		typeAlias := p.factory.NewJSTypeAliasDeclaration(nil, p.addDeepCloneReparse(callbackTag.FullName), nil, functionType)
 * 		typeAlias.AsTypeAliasDeclaration().TypeParameters = p.gatherTypeParameters(jsDoc, tag)
 * 		p.finishReparsedNode(typeAlias, tag)
 * 		p.jsdocInfos = append(p.jsdocInfos, JSDocInfo{parent: typeAlias, jsDocs: []*ast.Node{jsDoc}})
 * 		typeAlias.Flags |= ast.NodeFlagsHasJSDoc
 * 		p.reparseList = append(p.reparseList, typeAlias)
 * 	case ast.KindJSDocImportTag:
 * 		importTag := tag.AsJSDocImportTag()
 * 		if importTag.ImportClause == nil {
 * 			break
 * 		}
 * 		importClause := p.addDeepCloneReparse(importTag.ImportClause)
 * 		importClause.AsImportClause().PhaseModifier = ast.KindTypeKeyword
 * 		importDeclaration := p.factory.NewJSImportDeclaration(
 * 			p.factory.DeepCloneReparseModifiers(importTag.Modifiers()),
 * 			importClause,
 * 			p.addDeepCloneReparse(importTag.ModuleSpecifier),
 * 			p.addDeepCloneReparse(importTag.Attributes),
 * 		)
 * 		p.finishReparsedNode(importDeclaration, tag)
 * 		p.reparseList = append(p.reparseList, importDeclaration)
 * 	case ast.KindJSDocOverloadTag:
 * 		// Create overload signatures only for function, method, and constructor declarations outside object literals
 * 		if (ast.IsFunctionDeclaration(parent) || ast.IsMethodDeclaration(parent) || ast.IsConstructorDeclaration(parent)) && p.parsingContexts&(1<<PCObjectLiteralMembers) == 0 {
 * 			p.reparseList = append(p.reparseList, p.reparseJSDocSignature(tag.AsJSDocOverloadTag().TypeExpression, parent, jsDoc, tag, parent.Modifiers()))
 * 		}
 * 	}
 * }
 */
export function Parser_reparseUnhosted(receiver: GoPtr<Parser>, tag: GoPtr<Node>, parent: GoPtr<Node>, jsDoc: GoPtr<Node>): void {
  switch (tag!.Kind) {
    case KindJSDocTypedefTag: {
      const typeExpression = Node_TypeExpression(tag);
      if (typeExpression === undefined) {
        break;
      }
      const typeAlias = NewJSTypeAliasDeclaration(receiver!.factory, undefined, Parser_addDeepCloneReparse(receiver, Node_Name(tag)), undefined, undefined);
      AsTypeAliasDeclaration(typeAlias)!.TypeParameters = Parser_gatherTypeParameters(receiver, jsDoc, tag);
      let t: GoPtr<Node>;
      switch (typeExpression!.Kind) {
        case KindJSDocTypeExpression:
          t = Parser_addDeepCloneReparse(receiver, Node_Type(typeExpression));
          break;
        case KindJSDocTypeLiteral:
          t = Parser_reparseJSDocTypeLiteral(receiver, typeExpression);
          break;
        default:
          throw new globalThis.Error("typedef tag type expression should be a name reference or a type expression");
      }
      AsTypeAliasDeclaration(typeAlias)!.Type = t;
      Parser_finishReparsedNode(receiver, typeAlias, tag);
      receiver!.jsdocInfos = [...receiver!.jsdocInfos, { parent: typeAlias, jsDocs: [jsDoc] }];
      typeAlias!.Flags |= NodeFlagsHasJSDoc;
      receiver!.reparseList = [...receiver!.reparseList, typeAlias];
      break;
    }
    case KindJSDocCallbackTag: {
      const callbackTag = AsJSDocCallbackTag(tag);
      const typeExpression = callbackTag!.TypeExpression;
      if (typeExpression === undefined) {
        break;
      }
      const functionType = Parser_reparseJSDocSignature(receiver, typeExpression, tag, jsDoc, tag, undefined);
      const typeAlias = NewJSTypeAliasDeclaration(receiver!.factory, undefined, Parser_addDeepCloneReparse(receiver, callbackTag!.FullName), undefined, functionType);
      AsTypeAliasDeclaration(typeAlias)!.TypeParameters = Parser_gatherTypeParameters(receiver, jsDoc, tag);
      Parser_finishReparsedNode(receiver, typeAlias, tag);
      receiver!.jsdocInfos = [...receiver!.jsdocInfos, { parent: typeAlias, jsDocs: [jsDoc] }];
      typeAlias!.Flags |= NodeFlagsHasJSDoc;
      receiver!.reparseList = [...receiver!.reparseList, typeAlias];
      break;
    }
    case KindJSDocImportTag: {
      const importTag = AsJSDocImportTag(tag);
      if (importTag!.ImportClause === undefined) {
        break;
      }
      const importClause = Parser_addDeepCloneReparse(receiver, importTag!.ImportClause);
      AsImportClause(importClause)!.PhaseModifier = KindTypeKeyword;
      const importDeclaration = NewJSImportDeclaration(
        receiver!.factory,
        NodeFactory_DeepCloneReparseModifiers(receiver!.factory, Node_Modifiers(tag)),
        importClause,
        Parser_addDeepCloneReparse(receiver, importTag!.ModuleSpecifier),
        Parser_addDeepCloneReparse(receiver, importTag!.Attributes),
      );
      Parser_finishReparsedNode(receiver, importDeclaration, tag);
      receiver!.reparseList = [...receiver!.reparseList, importDeclaration];
      break;
    }
    case KindJSDocOverloadTag: {
      if ((IsFunctionDeclaration(parent) || IsMethodDeclaration(parent) || IsConstructorDeclaration(parent)) && (receiver!.parsingContexts & (1 << PCObjectLiteralMembers)) === 0) {
        receiver!.reparseList = [...receiver!.reparseList, Parser_reparseJSDocSignature(receiver, AsJSDocOverloadTag(tag)!.TypeExpression, parent, jsDoc, tag, Node_Modifiers(parent))];
      }
      break;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.reparseJSDocSignature","kind":"method","status":"implemented","sigHash":"881a921d17f7c9183951c1d845aeb86c49ccdf85c86b24464694aa2349c35fd2","bodyHash":"b33929501086918c40d99c654fa2845a6d1207fc2076efae381ffabe44dd275c"}
 *
 * Go source:
 * func (p *Parser) reparseJSDocSignature(jsSignature *ast.Node, fun *ast.Node, jsDoc *ast.Node, tag *ast.Node, modifiers *ast.ModifierList) *ast.Node {
 * 	var signature *ast.Node
 * 	clonedModifiers := p.factory.DeepCloneReparseModifiers(modifiers)
 * 	switch fun.Kind {
 * 	case ast.KindFunctionDeclaration:
 * 		signature = p.factory.NewFunctionDeclaration(clonedModifiers, nil, p.factory.DeepCloneReparse(fun.Name()), nil, nil, nil, nil, nil)
 * 	case ast.KindMethodDeclaration:
 * 		signature = p.factory.NewMethodDeclaration(clonedModifiers, nil, p.factory.DeepCloneReparse(fun.Name()), nil, nil, nil, nil, nil, nil)
 * 	case ast.KindConstructor:
 * 		signature = p.factory.NewConstructorDeclaration(clonedModifiers, nil, nil, nil, nil, nil)
 * 	case ast.KindJSDocCallbackTag:
 * 		signature = p.factory.NewFunctionTypeNode(nil, nil, p.factory.NewKeywordTypeNode(ast.KindAnyKeyword))
 * 	default:
 * 		panic("Unexpected kind " + fun.Kind.String())
 * 	}
 * 
 * 	if tag.Kind != ast.KindJSDocCallbackTag {
 * 		signature.FunctionLikeData().TypeParameters = p.gatherTypeParameters(jsDoc, tag)
 * 	}
 * 	parameters := p.nodeSliceArena.NewSlice(0)
 * 	for _, param := range jsSignature.Parameters() {
 * 		var parameter *ast.Node
 * 		if param.Kind == ast.KindJSDocThisTag {
 * 			thisTag := param.AsJSDocThisTag()
 * 			thisIdent := p.factory.NewIdentifier("this")
 * 			thisIdent.Loc = thisTag.Loc
 * 			thisIdent.Flags = p.contextFlags | ast.NodeFlagsReparsed
 * 			parameter = p.factory.NewParameterDeclaration(nil, nil, thisIdent, nil, nil, nil)
 * 			if thisTag.TypeExpression != nil {
 * 				parameter.AsParameterDeclaration().Type = p.addDeepCloneReparse(thisTag.TypeExpression.Type())
 * 			}
 * 		} else if param.Kind == ast.KindJSDocParameterTag || param.Kind == ast.KindJSDocPropertyTag {
 * 			jsparam := param.AsJSDocParameterOrPropertyTag()
 * 			var dotDotDotToken *ast.Node
 * 			var paramType *ast.TypeNode
 * 
 * 			if jsparam.TypeExpression != nil {
 * 				if jsparam.TypeExpression.Type().Kind == ast.KindJSDocVariadicType {
 * 					dotDotDotToken = p.factory.NewToken(ast.KindDotDotDotToken)
 * 					dotDotDotToken.Loc = jsparam.Loc
 * 					dotDotDotToken.Flags = p.contextFlags | ast.NodeFlagsReparsed
 * 
 * 					variadicType := jsparam.TypeExpression.Type().AsJSDocVariadicType()
 * 					paramType = p.reparseJSDocTypeLiteral(variadicType.Type)
 * 				} else {
 * 					paramType = p.reparseJSDocTypeLiteral(jsparam.TypeExpression.Type())
 * 				}
 * 			}
 * 
 * 			parameter = p.factory.NewParameterDeclaration(nil, dotDotDotToken, p.addDeepCloneReparse(jsparam.Name()), p.makeQuestionIfOptional(jsparam), paramType, nil)
 * 		}
 * 		p.finishReparsedNode(parameter, param)
 * 		parameters = append(parameters, parameter)
 * 		p.reparseJSDocComment(parameter, param)
 * 	}
 * 	signature.FunctionLikeData().Parameters = p.newNodeList(jsSignature.AsJSDocSignature().Parameters.Loc, parameters)
 * 
 * 	if jsSignature.Type() != nil && jsSignature.Type().TypeExpression() != nil {
 * 		signature.FunctionLikeData().Type = p.addDeepCloneReparse(jsSignature.Type().TypeExpression().Type())
 * 	}
 * 	loc := jsSignature
 * 	if tag.Kind == ast.KindJSDocOverloadTag {
 * 		loc = tag.TagName()
 * 	}
 * 	p.finishReparsedNode(signature, loc)
 * 	return signature
 * }
 */
export function Parser_reparseJSDocSignature(receiver: GoPtr<Parser>, jsSignature: GoPtr<Node>, fun: GoPtr<Node>, jsDoc: GoPtr<Node>, tag: GoPtr<Node>, modifiers: GoPtr<ModifierList>): GoPtr<Node> {
  let signature: GoPtr<Node>;
  const clonedModifiers = NodeFactory_DeepCloneReparseModifiers(receiver!.factory, modifiers);
  switch (fun!.Kind) {
    case KindFunctionDeclaration:
      signature = NewFunctionDeclaration(receiver!.factory, clonedModifiers, undefined, NodeFactory_DeepCloneReparse(receiver!.factory, Node_Name(fun)), undefined, undefined, undefined, undefined, undefined);
      break;
    case KindMethodDeclaration:
      signature = NewMethodDeclaration(receiver!.factory, clonedModifiers, undefined, NodeFactory_DeepCloneReparse(receiver!.factory, Node_Name(fun)), undefined, undefined, undefined, undefined, undefined, undefined);
      break;
    case KindConstructor:
      signature = NewConstructorDeclaration(receiver!.factory, clonedModifiers, undefined, undefined, undefined, undefined, undefined);
      break;
    case KindJSDocCallbackTag:
      signature = NewFunctionTypeNode(receiver!.factory, undefined, undefined, NewKeywordTypeNode(receiver!.factory, KindAnyKeyword));
      break;
    default:
      throw new globalThis.Error("Unexpected kind in reparseJSDocSignature");
  }

  if (tag!.Kind !== KindJSDocCallbackTag) {
    Node_FunctionLikeData(signature)!.TypeParameters = Parser_gatherTypeParameters(receiver, jsDoc, tag);
  }
  let parameters = Arena_NewSlice(receiver!.nodeSliceArena, 0) as GoSlice<GoPtr<Node>>;
  for (const param of Node_Parameters(jsSignature)) {
    let parameter: GoPtr<Node>;
    if (param!.Kind === KindJSDocThisTag) {
      const thisTag = AsJSDocThisTag(param);
      const thisIdent = NewIdentifier(receiver!.factory, "this");
      thisIdent!.Loc = thisTag!.Loc;
      thisIdent!.Flags = receiver!.contextFlags | NodeFlagsReparsed;
      parameter = NewParameterDeclaration(receiver!.factory, undefined, undefined, thisIdent, undefined, undefined, undefined);
      if (thisTag!.TypeExpression !== undefined) {
        AsParameterDeclaration(parameter)!.Type = Parser_addDeepCloneReparse(receiver, Node_Type(thisTag!.TypeExpression));
      }
    } else if (param!.Kind === KindJSDocParameterTag || param!.Kind === KindJSDocPropertyTag) {
      const jsparam = AsJSDocParameterOrPropertyTag(param);
      // Skip sub-property parameters (e.g., @param x.y)
      if (IsQualifiedName(Node_Name(param))) {
        continue;
      }
      let dotDotDotToken: GoPtr<Node> = undefined;
      let paramType: GoPtr<TypeNode> = undefined;

      if (jsparam!.TypeExpression !== undefined) {
        if (Node_Type(jsparam!.TypeExpression)!.Kind === KindJSDocVariadicType) {
          dotDotDotToken = NewToken(receiver!.factory, KindDotDotDotToken);
          dotDotDotToken!.Loc = jsparam!.Loc;
          dotDotDotToken!.Flags = receiver!.contextFlags | NodeFlagsReparsed;

          const variadicType = AsJSDocVariadicType(Node_Type(jsparam!.TypeExpression));
          paramType = Parser_reparseJSDocTypeLiteral(receiver, variadicType!.Type);
        } else {
          paramType = Parser_reparseJSDocTypeLiteral(receiver, Node_Type(jsparam!.TypeExpression));
        }
      }

      parameter = NewParameterDeclaration(receiver!.factory, undefined, dotDotDotToken, Parser_addDeepCloneReparse(receiver, Node_Name(param)), Parser_makeQuestionIfOptional(receiver, jsparam), paramType, undefined);
    } else {
      continue;
    }
    Parser_finishReparsedNode(receiver, parameter, param);
    parameters = [...parameters, parameter];
    Parser_reparseJSDocComment(receiver, parameter, param);
  }
  Node_FunctionLikeData(signature)!.Parameters = Parser_newNodeList(receiver, AsJSDocSignature(jsSignature)!.Parameters!.Loc, parameters);

  const jsSignatureType = Node_Type(jsSignature);
  if (jsSignatureType !== undefined && Node_TypeExpression(jsSignatureType) !== undefined) {
    Node_FunctionLikeData(signature)!.Type = Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(jsSignatureType)));
  }
  let loc: GoPtr<Node> = jsSignature;
  if (tag!.Kind === KindJSDocOverloadTag) {
    loc = Node_TagName(tag);
  }
  Parser_finishReparsedNode(receiver, signature, loc);
  return signature;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.reparseJSDocTypeLiteral","kind":"method","status":"implemented","sigHash":"a4682e2befe712409f58292eb3e2e7bdfcd956b87fb6e48257915874b23e5898","bodyHash":"0f8aebd63293dfc9d9c47fe3719579a5de0aa194bbefd1ab361d4e1487fc780c"}
 *
 * Go source:
 * func (p *Parser) reparseJSDocTypeLiteral(t *ast.TypeNode) *ast.Node {
 * 	if t == nil {
 * 		return nil
 * 	}
 * 	if t.Kind == ast.KindJSDocTypeLiteral {
 * 		jstypeliteral := t.AsJSDocTypeLiteral()
 * 		isArrayType := jstypeliteral.IsArrayType
 * 		properties := p.nodeSliceArena.NewSlice(0)
 * 		for _, prop := range jstypeliteral.JSDocPropertyTags {
 * 			jsprop := prop.AsJSDocParameterOrPropertyTag()
 * 			name := prop.Name()
 * 			if name.Kind == ast.KindQualifiedName {
 * 				name = name.AsQualifiedName().Right
 * 			}
 * 			property := p.factory.NewPropertySignatureDeclaration(nil, p.addDeepCloneReparse(name), p.makeQuestionIfOptional(jsprop), nil, nil)
 * 			if jsprop.TypeExpression != nil {
 * 				property.AsPropertySignatureDeclaration().Type = p.reparseJSDocTypeLiteral(jsprop.TypeExpression.Type())
 * 			}
 * 			p.finishReparsedNode(property, prop)
 * 			properties = append(properties, property)
 * 			p.reparseJSDocComment(property, prop)
 * 		}
 * 		t = p.factory.NewTypeLiteralNode(p.newNodeList(jstypeliteral.Loc, properties))
 * 		if isArrayType {
 * 			p.finishReparsedNode(t, jstypeliteral.AsNode())
 * 			t = p.factory.NewArrayTypeNode(t)
 * 		}
 * 		p.finishReparsedNode(t, jstypeliteral.AsNode())
 * 		return t
 * 	}
 * 	return p.addDeepCloneReparse(t)
 * }
 */
export function Parser_reparseJSDocTypeLiteral(receiver: GoPtr<Parser>, t: GoPtr<TypeNode>): GoPtr<Node> {
  if (t === undefined) {
    return undefined;
  }
  if (t!.Kind === KindJSDocTypeLiteral) {
    const jstypeliteral = AsJSDocTypeLiteral(t);
    const isArrayType = jstypeliteral!.IsArrayType;
    let properties = Arena_NewSlice(receiver!.nodeSliceArena, 0) as GoSlice<GoPtr<Node>>;
    for (const prop of jstypeliteral!.JSDocPropertyTags) {
      if (prop!.Kind !== KindJSDocPropertyTag && prop!.Kind !== KindJSDocParameterTag) {
        continue;
      }
      const jsprop = AsJSDocParameterOrPropertyTag(prop);
      let name = Node_Name(prop);
      if (IsQualifiedName(name)) {
        name = AsQualifiedName(name)!.Right;
      }
      const property = NewPropertySignatureDeclaration(receiver!.factory, undefined, Parser_addDeepCloneReparse(receiver, name), Parser_makeQuestionIfOptional(receiver, jsprop), undefined, undefined);
      if (jsprop!.TypeExpression !== undefined) {
        AsPropertySignatureDeclaration(property)!.Type = Parser_reparseJSDocTypeLiteral(receiver, Node_Type(jsprop!.TypeExpression));
      }
      Parser_finishReparsedNode(receiver, property, prop);
      properties = [...properties, property];
      Parser_reparseJSDocComment(receiver, property, prop);
    }
    let result: GoPtr<Node> = NewTypeLiteralNode(receiver!.factory, Parser_newNodeList(receiver, jstypeliteral!.Loc, properties));
    if (isArrayType) {
      Parser_finishReparsedNode(receiver, result, t);
      result = NewArrayTypeNode(receiver!.factory, result);
    }
    Parser_finishReparsedNode(receiver, result, t);
    return result;
  }
  return Parser_addDeepCloneReparse(receiver, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.reparseJSDocComment","kind":"method","status":"implemented","sigHash":"1b89b82a4a8e5627bb168423057de736be8c1037bc00868867f2b458895009ab","bodyHash":"902aac91e74b1ee753baaef6058a218c43660cea7ffd7816ab90e18673fa32fc"}
 *
 * Go source:
 * func (p *Parser) reparseJSDocComment(node *ast.Node, tag *ast.Node) {
 * 	if comment := tag.CommentList(); comment != nil {
 * 		newComment := p.factory.NewNodeList(core.Map(comment.Nodes, p.factory.DeepCloneReparse))
 * 		newComment.Loc = comment.Loc
 * 		propJSDoc := p.factory.NewJSDoc(newComment, nil)
 * 		p.finishReparsedNode(propJSDoc, tag)
 * 		propJSDoc.Parent = node
 * 		p.jsdocInfos = append(p.jsdocInfos, JSDocInfo{parent: node, jsDocs: []*ast.Node{propJSDoc}})
 * 		node.Flags |= ast.NodeFlagsHasJSDoc
 * 	}
 * }
 */
export function Parser_reparseJSDocComment(receiver: GoPtr<Parser>, node: GoPtr<Node>, tag: GoPtr<Node>): void {
  const comment = Node_CommentList(tag);
  if (comment !== undefined) {
    const newComment = NodeFactory_NewNodeList(receiver!.factory, core_Map(comment!.Nodes, (n) => NodeFactory_DeepCloneReparse(receiver!.factory, n)));
    newComment!.Loc = comment!.Loc;
    const propJSDoc = NewJSDoc(receiver!.factory, newComment, undefined);
    Parser_finishReparsedNode(receiver, propJSDoc, tag);
    propJSDoc!.Parent = node;
    receiver!.jsdocInfos = [...receiver!.jsdocInfos, { parent: node, jsDocs: [propJSDoc] }];
    node!.Flags |= NodeFlagsHasJSDoc;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.gatherTypeParameters","kind":"method","status":"implemented","sigHash":"4f31726282c81734ddd3254fd10f835dd6456ff4baebd465a11f97a7c1bb2328","bodyHash":"ff6857a16be9a1df407b75173f07dbfc53e1165a86d91cc9cbaefbd432deba39"}
 *
 * Go source:
 * func (p *Parser) gatherTypeParameters(j *ast.Node, tagWithTypeParameters *ast.Node) *ast.NodeList {
 * 	var typeParameters []*ast.Node
 * 	pos := -1
 * 	endPos := -1
 * 	firstTemplate := true
 * 	// type parameters only apply to the tag or node they occur before, so record a place to stop
 * 	start := 0
 * 	for i, other := range j.AsJSDoc().Tags.Nodes {
 * 		if other == tagWithTypeParameters {
 * 			break
 * 		}
 * 		if other.Kind == ast.KindJSDocTypedefTag || other.Kind == ast.KindJSDocCallbackTag || other.Kind == ast.KindJSDocOverloadTag {
 * 			start = i + 1
 * 		}
 * 	}
 * 	for i, tag := range j.AsJSDoc().Tags.Nodes {
 * 		if tag == tagWithTypeParameters {
 * 			break
 * 		}
 * 		if i < start || tag.Kind != ast.KindJSDocTemplateTag {
 * 			continue
 * 		}
 * 		if firstTemplate {
 * 			pos = tag.Pos()
 * 			firstTemplate = false
 * 		}
 * 		endPos = tag.End()
 * 
 * 		constraint := tag.AsJSDocTemplateTag().Constraint
 * 		firstTypeParameter := true
 * 		for _, tp := range tag.TypeParameters() {
 * 			var reparse *ast.Node
 * 			if constraint != nil && firstTypeParameter {
 * 				reparse = p.factory.NewTypeParameterDeclaration(
 * 					p.factory.DeepCloneReparseModifiers(tp.Modifiers()),
 * 					p.addDeepCloneReparse(tp.Name()),
 * 					p.addDeepCloneReparse(constraint.Type()),
 * 					nil, // expression
 * 					p.addDeepCloneReparse(tp.AsTypeParameterDeclaration().DefaultType),
 * 				)
 * 				p.finishReparsedNode(reparse, tp)
 * 			} else {
 * 				reparse = p.addDeepCloneReparse(tp)
 * 			}
 * 			if typeParameters == nil {
 * 				typeParameters = p.nodeSliceArena.NewSlice(0)
 * 			}
 * 			typeParameters = append(typeParameters, reparse)
 * 			firstTypeParameter = false
 * 		}
 * 	}
 * 	if len(typeParameters) == 0 {
 * 		return nil
 * 	} else {
 * 		return p.newNodeList(core.NewTextRange(pos, endPos), typeParameters)
 * 	}
 * }
 */
export function Parser_gatherTypeParameters(receiver: GoPtr<Parser>, j: GoPtr<Node>, tagWithTypeParameters: GoPtr<Node>): GoPtr<NodeList> {
  let typeParameters: GoSlice<GoPtr<Node>> | undefined;
  let pos: int = -1;
  let endPos: int = -1;
  let firstTemplate = true;
  // type parameters only apply to the tag or node they occur before, so record a place to stop
  let start: int = 0;
  const jsTags = AsJSDoc(j)!.Tags!.Nodes;
  for (let i: int = 0; i < jsTags.length; i++) {
    const other = jsTags[i];
    if (other === tagWithTypeParameters) {
      break;
    }
    if (other!.Kind === KindJSDocTypedefTag || other!.Kind === KindJSDocCallbackTag || other!.Kind === KindJSDocOverloadTag) {
      start = i + 1;
    }
  }
  for (let i: int = 0; i < jsTags.length; i++) {
    const tag = jsTags[i];
    if (tag === tagWithTypeParameters) {
      break;
    }
    if (i < start || tag!.Kind !== KindJSDocTemplateTag) {
      continue;
    }
    if (firstTemplate) {
      pos = Node_Pos(tag);
      firstTemplate = false;
    }
    endPos = Node_End(tag);

    const constraint = AsJSDocTemplateTag(tag)!.Constraint;
    let firstTypeParameter = true;
    for (const tp of Node_TypeParameters(tag)!) {
      let reparse: GoPtr<Node>;
      if (constraint !== undefined && firstTypeParameter) {
        reparse = NewTypeParameterDeclaration(
          receiver!.factory,
          NodeFactory_DeepCloneReparseModifiers(receiver!.factory, Node_Modifiers(tp)),
          Parser_addDeepCloneReparse(receiver, Node_Name(tp)),
          Parser_addDeepCloneReparse(receiver, Node_Type(constraint)),
          undefined, // expression
          Parser_addDeepCloneReparse(receiver, AsTypeParameterDeclaration(tp)!.DefaultType),
        );
        Parser_finishReparsedNode(receiver, reparse, tp);
      } else {
        reparse = Parser_addDeepCloneReparse(receiver, tp);
      }
      if (typeParameters === undefined) {
        typeParameters = Arena_NewSlice(receiver!.nodeSliceArena, 0) as GoSlice<GoPtr<Node>>;
      }
      typeParameters = [...typeParameters!, reparse];
      firstTypeParameter = false;
    }
  }
  if (typeParameters === undefined || typeParameters.length === 0) {
    return undefined;
  } else {
    return Parser_newNodeList(receiver, NewTextRange(pos, endPos), typeParameters);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.reparseHosted","kind":"method","status":"implemented","sigHash":"58c0beaf2d77b4b5417d21aa21df5af9e683885ced520fefffc94702c21dffea","bodyHash":"30d98fe8662a97e2ad03f4dd6cd361aab14e4bd3c1bc9d2e7c27a9e7a7f7900a"}
 *
 * Go source:
 * func (p *Parser) reparseHosted(tag *ast.Node, parent *ast.Node, jsDoc *ast.Node) {
 * 	switch tag.Kind {
 * 	case ast.KindJSDocTypeTag:
 * 		switch parent.Kind {
 * 		case ast.KindVariableStatement:
 * 			if parent.AsVariableStatement().DeclarationList != nil {
 * 				for _, declaration := range parent.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 					if declaration.Type() == nil && tag.TypeExpression() != nil {
 * 						declaration.AsMutable().SetType(p.addDeepCloneReparse(tag.TypeExpression().Type()))
 * 						p.finishMutatedNode(declaration)
 * 						return
 * 					}
 * 				}
 * 			}
 * 		case ast.KindVariableDeclaration, ast.KindExportAssignment, ast.KindPropertyDeclaration, ast.KindPropertyAssignment,
 * 			ast.KindShorthandPropertyAssignment:
 * 			if parent.Type() == nil && tag.TypeExpression() != nil {
 * 				parent.AsMutable().SetType(p.addDeepCloneReparse(tag.TypeExpression().Type()))
 * 				p.finishMutatedNode(parent)
 * 				return
 * 			}
 * 		case ast.KindParameter:
 * 			if parent.Type() == nil && tag.TypeExpression() != nil {
 * 				parent.AsMutable().SetType(p.reparseJSDocTypeLiteral(tag.TypeExpression().Type()))
 * 				p.finishMutatedNode(parent)
 * 				return
 * 			}
 * 		case ast.KindExpressionStatement:
 * 			if parent.Expression().Kind == ast.KindBinaryExpression {
 * 				bin := parent.Expression().AsBinaryExpression()
 * 				if kind := ast.GetAssignmentDeclarationKind(bin.AsNode()); kind != ast.JSDeclarationKindNone && tag.TypeExpression() != nil {
 * 					bin.AsMutable().SetType(p.addDeepCloneReparse(tag.TypeExpression().Type()))
 * 					p.finishMutatedNode(bin.AsNode())
 * 					return
 * 				}
 * 			}
 * 		case ast.KindReturnStatement, ast.KindParenthesizedExpression:
 * 			if parent.Expression() != nil && tag.TypeExpression() != nil {
 * 				parent.AsMutable().SetExpression(p.makeNewCast(
 * 					p.addDeepCloneReparse(tag.TypeExpression().Type()),
 * 					parent.Expression(),
 * 					true /*isAssertion* /))
 * 				p.finishMutatedNode(parent)
 * 				return
 * 			}
 * 		}
 * 		if fun := getFunctionLikeHost(parent); fun != nil {
 * 			noTypedParams := core.Every(fun.Parameters(), func(param *ast.Node) bool { return param.Type() == nil })
 * 			if fun.TypeParameterList() == nil && fun.Type() == nil && noTypedParams && tag.TypeExpression() != nil {
 * 				fun.FunctionLikeData().FullSignature = p.addDeepCloneReparse(tag.TypeExpression().Type())
 * 				p.finishMutatedNode(fun)
 * 			}
 * 		}
 * 	case ast.KindJSDocSatisfiesTag:
 * 		switch parent.Kind {
 * 		case ast.KindVariableStatement:
 * 			if parent.AsVariableStatement().DeclarationList != nil {
 * 				for _, declaration := range parent.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 					if declaration.Initializer() != nil && tag.TypeExpression() != nil {
 * 						declaration.AsMutable().SetInitializer(p.makeNewCast(
 * 							p.addDeepCloneReparse(tag.TypeExpression().Type()),
 * 							declaration.Initializer(),
 * 							false /*isAssertion* /))
 * 						p.finishMutatedNode(declaration)
 * 						break
 * 					}
 * 				}
 * 			}
 * 		case ast.KindVariableDeclaration, ast.KindPropertyDeclaration, ast.KindPropertyAssignment:
 * 			if parent.Initializer() != nil && tag.TypeExpression() != nil {
 * 				parent.AsMutable().SetInitializer(p.makeNewCast(
 * 					p.addDeepCloneReparse(tag.TypeExpression().Type()),
 * 					parent.Initializer(),
 * 					false /*isAssertion* /))
 * 				p.finishMutatedNode(parent)
 * 			}
 * 		case ast.KindShorthandPropertyAssignment:
 * 			shorthand := parent.AsShorthandPropertyAssignment()
 * 			if shorthand.ObjectAssignmentInitializer != nil && tag.AsJSDocSatisfiesTag().TypeExpression != nil {
 * 				shorthand.ObjectAssignmentInitializer = p.makeNewCast(
 * 					p.addDeepCloneReparse(tag.AsJSDocSatisfiesTag().TypeExpression.Type()),
 * 					shorthand.ObjectAssignmentInitializer,
 * 					false /*isAssertion* /)
 * 				p.finishMutatedNode(parent)
 * 			}
 * 		case ast.KindReturnStatement, ast.KindParenthesizedExpression, ast.KindExportAssignment:
 * 			if parent.Expression() != nil && tag.TypeExpression() != nil {
 * 				parent.AsMutable().SetExpression(p.makeNewCast(
 * 					p.addDeepCloneReparse(tag.TypeExpression().Type()),
 * 					parent.Expression(),
 * 					false /*isAssertion* /))
 * 				p.finishMutatedNode(parent)
 * 			}
 * 		case ast.KindExpressionStatement:
 * 			if parent.Expression().Kind == ast.KindBinaryExpression {
 * 				bin := parent.Expression().AsBinaryExpression()
 * 				if kind := ast.GetAssignmentDeclarationKind(bin.AsNode()); kind != ast.JSDeclarationKindNone && tag.TypeExpression() != nil {
 * 					bin.Right = p.makeNewCast(
 * 						p.addDeepCloneReparse(tag.TypeExpression().Type()),
 * 						bin.Right,
 * 						false /*isAssertion* /)
 * 					p.finishMutatedNode(bin.AsNode())
 * 				}
 * 			}
 * 		}
 * 	case ast.KindJSDocTemplateTag:
 * 		if fun := getFunctionLikeHost(parent); fun != nil {
 * 			if fun.TypeParameters() == nil && fun.FunctionLikeData().FullSignature == nil {
 * 				fun.FunctionLikeData().TypeParameters = p.gatherTypeParameters(jsDoc, nil /*tagWithTypeParameters* /)
 * 				p.finishMutatedNode(fun)
 * 			}
 * 		} else if parent.Kind == ast.KindClassDeclaration {
 * 			class := parent.AsClassDeclaration()
 * 			if class.TypeParameters == nil {
 * 				class.TypeParameters = p.gatherTypeParameters(jsDoc, nil /*tagWithTypeParameters* /)
 * 				p.finishMutatedNode(parent)
 * 			}
 * 		} else if parent.Kind == ast.KindClassExpression {
 * 			class := parent.AsClassExpression()
 * 			if class.TypeParameters == nil {
 * 				class.TypeParameters = p.gatherTypeParameters(jsDoc, nil /*tagWithTypeParameters* /)
 * 				p.finishMutatedNode(parent)
 * 			}
 * 		}
 * 	case ast.KindJSDocParameterTag:
 * 		if fun := getFunctionLikeHost(parent); fun != nil && fun.FunctionLikeData().FullSignature == nil {
 * 			parameterTag := tag.AsJSDocParameterOrPropertyTag()
 * 			if param, ok := findMatchingParameter(fun, parameterTag, jsDoc); ok {
 * 				if param.Type == nil && parameterTag.TypeExpression != nil {
 * 					param.AsParameterDeclaration().Type = p.reparseJSDocTypeLiteral(parameterTag.TypeExpression.Type())
 * 				}
 * 				if param.QuestionToken == nil && param.Initializer == nil {
 * 					if question := p.makeQuestionIfOptional(parameterTag); question != nil {
 * 						param.QuestionToken = question
 * 					}
 * 				}
 * 				p.finishMutatedNode(param.AsNode())
 * 			}
 * 		}
 * 	case ast.KindJSDocThisTag:
 * 		if fun := getFunctionLikeHost(parent); fun != nil {
 * 			params := fun.Parameters()
 * 			if len(params) == 0 || params[0].Name().Kind != ast.KindThisKeyword {
 * 				thisParam := p.factory.NewParameterDeclaration(
 * 					nil, /* decorators * /
 * 					nil, /* modifiers * /
 * 					p.factory.NewIdentifier("this"),
 * 					nil, /* questionToken * /
 * 					nil, /* type * /
 * 					nil, /* initializer * /
 * 				)
 * 				if tag.AsJSDocThisTag().TypeExpression != nil {
 * 					thisParam.AsParameterDeclaration().Type = p.addDeepCloneReparse(tag.AsJSDocThisTag().TypeExpression.Type())
 * 				}
 * 				p.finishReparsedNode(thisParam, tag.TagName())
 * 
 * 				newParams := p.nodeSliceArena.NewSlice(len(params) + 1)
 * 				newParams[0] = thisParam
 * 				for i, param := range params {
 * 					newParams[i+1] = param
 * 				}
 * 
 * 				fun.FunctionLikeData().Parameters = p.newNodeList(fun.ParameterList().Loc, newParams)
 * 				p.finishMutatedNode(fun)
 * 			}
 * 		}
 * 	case ast.KindJSDocReturnTag:
 * 		if fun := getFunctionLikeHost(parent); fun != nil && fun.FunctionLikeData().FullSignature == nil {
 * 			if fun.Type() == nil && tag.TypeExpression() != nil {
 * 				fun.FunctionLikeData().Type = p.addDeepCloneReparse(tag.TypeExpression().Type())
 * 				p.finishMutatedNode(fun)
 * 			}
 * 		}
 * 	case ast.KindJSDocReadonlyTag, ast.KindJSDocPrivateTag, ast.KindJSDocPublicTag, ast.KindJSDocProtectedTag, ast.KindJSDocOverrideTag:
 * 		if parent.Kind == ast.KindExpressionStatement {
 * 			parent = parent.Expression()
 * 		}
 * 		switch parent.Kind {
 * 		case ast.KindPropertyDeclaration, ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor, ast.KindBinaryExpression:
 * 			var keyword ast.Kind
 * 			switch tag.Kind {
 * 			case ast.KindJSDocReadonlyTag:
 * 				keyword = ast.KindReadonlyKeyword
 * 			case ast.KindJSDocPrivateTag:
 * 				keyword = ast.KindPrivateKeyword
 * 			case ast.KindJSDocPublicTag:
 * 				keyword = ast.KindPublicKeyword
 * 			case ast.KindJSDocProtectedTag:
 * 				keyword = ast.KindProtectedKeyword
 * 			case ast.KindJSDocOverrideTag:
 * 				keyword = ast.KindOverrideKeyword
 * 			}
 * 			modifier := p.factory.NewModifier(keyword)
 * 			modifier.Loc = tag.Loc
 * 			modifier.Flags = p.contextFlags | ast.NodeFlagsReparsed
 * 			var nodes []*ast.Node
 * 			var loc core.TextRange
 * 			if parent.Modifiers() == nil {
 * 				nodes = p.nodeSliceArena.NewSlice(1)
 * 				nodes[0] = modifier
 * 				loc = tag.Loc
 * 			} else {
 * 				nodes = append(parent.ModifierNodes(), modifier)
 * 				loc = parent.Modifiers().Loc
 * 			}
 * 			parent.AsMutable().SetModifiers(p.newModifierList(loc, nodes))
 * 			p.finishMutatedNode(parent)
 * 		}
 * 	case ast.KindJSDocImplementsTag:
 * 		if class := getClassLikeData(parent); class != nil {
 * 			implementsTag := tag.AsJSDocImplementsTag()
 * 
 * 			if class.HeritageClauses != nil {
 * 				if implementsClause := core.Find(class.HeritageClauses.Nodes, func(node *ast.Node) bool {
 * 					return node.AsHeritageClause().Token == ast.KindImplementsKeyword
 * 				}); implementsClause != nil {
 * 					implementsClause.AsHeritageClause().Types.Nodes = append(implementsClause.AsHeritageClause().Types.Nodes, p.addDeepCloneReparse(implementsTag.ClassName))
 * 					p.finishMutatedNode(implementsClause)
 * 					return
 * 				}
 * 			}
 * 			typesList := p.newNodeList(implementsTag.ClassName.Loc, p.nodeSliceArena.NewSlice1(p.addDeepCloneReparse(implementsTag.ClassName)))
 * 
 * 			heritageClause := p.factory.NewHeritageClause(ast.KindImplementsKeyword, typesList)
 * 			p.finishReparsedNode(heritageClause, implementsTag.ClassName)
 * 
 * 			if class.HeritageClauses == nil {
 * 				heritageClauses := p.newNodeList(implementsTag.ClassName.Loc, p.nodeSliceArena.NewSlice1(heritageClause))
 * 				class.HeritageClauses = heritageClauses
 * 			} else {
 * 				class.HeritageClauses.Nodes = append(class.HeritageClauses.Nodes, heritageClause)
 * 			}
 * 			p.finishMutatedNode(parent)
 * 		}
 * 	case ast.KindJSDocAugmentsTag:
 * 		if class := getClassLikeData(parent); class != nil && class.HeritageClauses != nil {
 * 			if extendsClause := core.Find(class.HeritageClauses.Nodes, func(node *ast.Node) bool {
 * 				return node.AsHeritageClause().Token == ast.KindExtendsKeyword
 * 			}); extendsClause != nil && len(extendsClause.AsHeritageClause().Types.Nodes) == 1 {
 * 				target := extendsClause.AsHeritageClause().Types.Nodes[0].AsExpressionWithTypeArguments()
 * 				source := tag.ClassName().AsExpressionWithTypeArguments()
 * 				if ast.HasSamePropertyAccessName(target.Expression, source.Expression) {
 * 					if target.TypeArguments == nil && source.TypeArguments != nil {
 * 						newArguments := p.nodeSliceArena.NewSlice(len(source.TypeArguments.Nodes))
 * 						for i, arg := range source.TypeArguments.Nodes {
 * 							newArguments[i] = p.addDeepCloneReparse(arg)
 * 						}
 * 						target.TypeArguments = p.newNodeList(source.TypeArguments.Loc, newArguments)
 * 						p.finishMutatedNode(target.AsNode())
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function Parser_reparseHosted(receiver: GoPtr<Parser>, tag: GoPtr<Node>, parent: GoPtr<Node>, jsDoc: GoPtr<Node>): void {
  switch (tag!.Kind) {
    case KindJSDocTypeTag: {
      switch (parent!.Kind) {
        case KindVariableStatement: {
          if (AsVariableStatement(parent)!.DeclarationList !== undefined) {
            for (const declaration of AsVariableDeclarationList(AsVariableStatement(parent)!.DeclarationList)!.Declarations!.Nodes) {
              if (Node_Type(declaration) === undefined && Node_TypeExpression(tag) !== undefined) {
                MutableNode_SetType(Node_AsMutable(declaration), Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))));
                Parser_finishMutatedNode(receiver, declaration);
                return;
              }
            }
          }
          break;
        }
        case KindVariableDeclaration:
        case KindExportAssignment:
        case KindPropertyDeclaration:
        case KindPropertyAssignment:
        case KindShorthandPropertyAssignment: {
          if (Node_Type(parent) === undefined && Node_TypeExpression(tag) !== undefined) {
            MutableNode_SetType(Node_AsMutable(parent), Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))));
            Parser_finishMutatedNode(receiver, parent);
            return;
          }
          break;
        }
        case KindParameter: {
          if (Node_Type(parent) === undefined && Node_TypeExpression(tag) !== undefined) {
            MutableNode_SetType(Node_AsMutable(parent), Parser_reparseJSDocTypeLiteral(receiver, Node_Type(Node_TypeExpression(tag))));
            Parser_finishMutatedNode(receiver, parent);
            return;
          }
          break;
        }
        case KindExpressionStatement: {
          if (Node_Expression(parent)!.Kind === KindBinaryExpression) {
            const bin = AsBinaryExpression(Node_Expression(parent));
            if (GetAssignmentDeclarationKind(Node_AsMutable(bin)) !== JSDeclarationKindNone && Node_TypeExpression(tag) !== undefined) {
              MutableNode_SetType(Node_AsMutable(bin), Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))));
              Parser_finishMutatedNode(receiver, Node_AsMutable(bin));
              return;
            }
          }
          break;
        }
        case KindReturnStatement:
        case KindParenthesizedExpression: {
          if (Node_Expression(parent) !== undefined && Node_TypeExpression(tag) !== undefined) {
            MutableNode_SetExpression(Node_AsMutable(parent), Parser_makeNewCast(
              receiver,
              Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))),
              Node_Expression(parent),
              true,
            ));
            Parser_finishMutatedNode(receiver, parent);
            return;
          }
          break;
        }
      }
      const fun = getFunctionLikeHost(parent);
      if (fun !== undefined) {
        const noTypedParams = Every(Node_Parameters(fun), (param) => (Node_Type(param) === undefined) as bool);
        if (Node_TypeParameterList(fun) === undefined && Node_Type(fun) === undefined && noTypedParams && Node_TypeExpression(tag) !== undefined) {
          Node_FunctionLikeData(fun)!.FullSignature = Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag)));
          Parser_finishMutatedNode(receiver, fun);
        }
      }
      break;
    }
    case KindJSDocSatisfiesTag: {
      switch (parent!.Kind) {
        case KindVariableStatement: {
          if (AsVariableStatement(parent)!.DeclarationList !== undefined) {
            for (const declaration of AsVariableDeclarationList(AsVariableStatement(parent)!.DeclarationList)!.Declarations!.Nodes) {
              if (Node_Initializer(declaration) !== undefined && Node_TypeExpression(tag) !== undefined) {
                MutableNode_SetInitializer(Node_AsMutable(declaration), Parser_makeNewCast(
                  receiver,
                  Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))),
                  Node_Initializer(declaration),
                  false,
                ));
                Parser_finishMutatedNode(receiver, declaration);
                break;
              }
            }
          }
          break;
        }
        case KindVariableDeclaration:
        case KindPropertyDeclaration:
        case KindPropertyAssignment: {
          if (Node_Initializer(parent) !== undefined && Node_TypeExpression(tag) !== undefined) {
            MutableNode_SetInitializer(Node_AsMutable(parent), Parser_makeNewCast(
              receiver,
              Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))),
              Node_Initializer(parent),
              false,
            ));
            Parser_finishMutatedNode(receiver, parent);
          }
          break;
        }
        case KindShorthandPropertyAssignment: {
          const shorthand = AsShorthandPropertyAssignment(parent);
          if (shorthand!.ObjectAssignmentInitializer !== undefined && AsJSDocSatisfiesTag(tag)!.TypeExpression !== undefined) {
            shorthand!.ObjectAssignmentInitializer = Parser_makeNewCast(
              receiver,
              Parser_addDeepCloneReparse(receiver, Node_Type(AsJSDocSatisfiesTag(tag)!.TypeExpression!)),
              shorthand!.ObjectAssignmentInitializer,
              false,
            );
            Parser_finishMutatedNode(receiver, parent);
          }
          break;
        }
        case KindReturnStatement:
        case KindParenthesizedExpression:
        case KindExportAssignment: {
          if (Node_Expression(parent) !== undefined && Node_TypeExpression(tag) !== undefined) {
            MutableNode_SetExpression(Node_AsMutable(parent), Parser_makeNewCast(
              receiver,
              Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))),
              Node_Expression(parent),
              false,
            ));
            Parser_finishMutatedNode(receiver, parent);
          }
          break;
        }
        case KindExpressionStatement: {
          if (Node_Expression(parent)!.Kind === KindBinaryExpression) {
            const bin = AsBinaryExpression(Node_Expression(parent));
            if (GetAssignmentDeclarationKind(Node_AsMutable(bin)) !== JSDeclarationKindNone && Node_TypeExpression(tag) !== undefined) {
              bin!.Right = Parser_makeNewCast(
                receiver,
                Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag))),
                bin!.Right,
                false,
              );
              Parser_finishMutatedNode(receiver, Node_AsMutable(bin));
            }
          }
          break;
        }
      }
      break;
    }
    case KindJSDocTemplateTag: {
      const fun = getFunctionLikeHost(parent);
      if (fun !== undefined) {
        if (Node_TypeParameters(fun) === undefined && Node_FunctionLikeData(fun)!.FullSignature === undefined) {
          Node_FunctionLikeData(fun)!.TypeParameters = Parser_gatherTypeParameters(receiver, jsDoc, undefined);
          Parser_finishMutatedNode(receiver, fun);
        }
      } else if (parent!.Kind === KindClassDeclaration) {
        const cls = AsClassDeclaration(parent);
        if (cls!.TypeParameters === undefined) {
          cls!.TypeParameters = Parser_gatherTypeParameters(receiver, jsDoc, undefined);
          Parser_finishMutatedNode(receiver, parent);
        }
      } else if (parent!.Kind === KindClassExpression) {
        const cls = AsClassExpression(parent);
        if (cls!.TypeParameters === undefined) {
          cls!.TypeParameters = Parser_gatherTypeParameters(receiver, jsDoc, undefined);
          Parser_finishMutatedNode(receiver, parent);
        }
      }
      break;
    }
    case KindJSDocParameterTag: {
      const fun = getFunctionLikeHost(parent);
      if (fun !== undefined && Node_FunctionLikeData(fun)!.FullSignature === undefined) {
        const parameterTag = AsJSDocParameterOrPropertyTag(tag);
        const [param, ok] = findMatchingParameter(fun, parameterTag, jsDoc);
        if (ok) {
          if (param!.Type === undefined && parameterTag!.TypeExpression !== undefined) {
            param!.Type = Parser_reparseJSDocTypeLiteral(receiver, Node_Type(parameterTag!.TypeExpression));
          }
          if (param!.QuestionToken === undefined && param!.Initializer === undefined) {
            const question = Parser_makeQuestionIfOptional(receiver, parameterTag);
            if (question !== undefined) {
              param!.QuestionToken = question;
            }
          }
          Parser_finishMutatedNode(receiver, Node_AsMutable(param));
        }
      }
      break;
    }
    case KindJSDocThisTag: {
      const fun = getFunctionLikeHost(parent);
      if (fun !== undefined) {
        const params = Node_Parameters(fun);
        if (params.length === 0 || Node_Name(params[0])!.Kind !== KindThisKeyword) {
          const thisParam = NewParameterDeclaration(
            receiver!.factory,
            undefined, // decorators
            undefined, // modifiers
            NewIdentifier(receiver!.factory, "this"),
            undefined, // questionToken
            undefined, // type
            undefined, // initializer
          );
          if (AsJSDocThisTag(tag)!.TypeExpression !== undefined) {
            AsParameterDeclaration(thisParam)!.Type = Parser_addDeepCloneReparse(receiver, Node_Type(AsJSDocThisTag(tag)!.TypeExpression!));
          }
          Parser_finishReparsedNode(receiver, thisParam, Node_TagName(tag));

          const newParams = Arena_NewSlice(receiver!.nodeSliceArena, (params.length + 1) as int) as GoSlice<GoPtr<Node>>;
          newParams[0] = thisParam;
          for (let i: int = 0; i < params.length; i++) {
            newParams[i + 1] = params[i];
          }

          Node_FunctionLikeData(fun)!.Parameters = Parser_newNodeList(receiver, Node_ParameterList(fun)!.Loc, newParams);
          Parser_finishMutatedNode(receiver, fun);
        }
      }
      break;
    }
    case KindJSDocReturnTag: {
      const fun = getFunctionLikeHost(parent);
      if (fun !== undefined && Node_FunctionLikeData(fun)!.FullSignature === undefined) {
        if (Node_Type(fun) === undefined && Node_TypeExpression(tag) !== undefined) {
          Node_FunctionLikeData(fun)!.Type = Parser_addDeepCloneReparse(receiver, Node_Type(Node_TypeExpression(tag)));
          Parser_finishMutatedNode(receiver, fun);
        }
      }
      break;
    }
    case KindJSDocReadonlyTag:
    case KindJSDocPrivateTag:
    case KindJSDocPublicTag:
    case KindJSDocProtectedTag:
    case KindJSDocOverrideTag: {
      let p = parent;
      if (p!.Kind === KindExpressionStatement) {
        p = Node_Expression(p);
      }
      switch (p!.Kind) {
        case KindPropertyDeclaration:
        case KindMethodDeclaration:
        case KindGetAccessor:
        case KindSetAccessor:
        case KindBinaryExpression: {
          let keyword: Kind;
          switch (tag!.Kind) {
            case KindJSDocReadonlyTag:
              keyword = KindReadonlyKeyword;
              break;
            case KindJSDocPrivateTag:
              keyword = KindPrivateKeyword;
              break;
            case KindJSDocPublicTag:
              keyword = KindPublicKeyword;
              break;
            case KindJSDocProtectedTag:
              keyword = KindProtectedKeyword;
              break;
            default: // KindJSDocOverrideTag
              keyword = KindOverrideKeyword;
              break;
          }
          const modifier = NewToken(receiver!.factory, keyword);
          modifier!.Loc = tag!.Loc;
          modifier!.Flags = receiver!.contextFlags | NodeFlagsReparsed;
          let nodes: GoSlice<GoPtr<Node>>;
          let loc: TextRange;
          if (Node_Modifiers(p) === undefined) {
            nodes = Arena_NewSlice(receiver!.nodeSliceArena, 1 as int) as GoSlice<GoPtr<Node>>;
            nodes[0] = modifier;
            loc = tag!.Loc;
          } else {
            nodes = [...Node_ModifierNodes(p)!, modifier];
            loc = Node_Modifiers(p)!.Loc;
          }
          MutableNode_SetModifiers(Node_AsMutable(p), Parser_newModifierList(receiver, loc, nodes));
          Parser_finishMutatedNode(receiver, p);
          break;
        }
      }
      break;
    }
    case KindJSDocImplementsTag: {
      const cls = getClassLikeData(parent);
      if (cls !== undefined) {
        const implementsTag = AsJSDocImplementsTag(tag);

        if (cls!.HeritageClauses !== undefined) {
          const implementsClause = Find(cls!.HeritageClauses!.Nodes, (node) => (AsHeritageClause(node)!.Token === KindImplementsKeyword) as bool);
          if (implementsClause !== undefined) {
            AsHeritageClause(implementsClause)!.Types!.Nodes = [...AsHeritageClause(implementsClause)!.Types!.Nodes, Parser_addDeepCloneReparse(receiver, implementsTag!.ClassName)];
            Parser_finishMutatedNode(receiver, implementsClause);
            return;
          }
        }
        const typesList = Parser_newNodeList(receiver, implementsTag!.ClassName!.Loc, Arena_NewSlice1(receiver!.nodeSliceArena, Parser_addDeepCloneReparse(receiver, implementsTag!.ClassName)) as GoSlice<GoPtr<Node>>);

        const heritageClause = NewHeritageClause(receiver!.factory, KindImplementsKeyword, typesList);
        Parser_finishReparsedNode(receiver, heritageClause, implementsTag!.ClassName);

        if (cls!.HeritageClauses === undefined) {
          cls!.HeritageClauses = Parser_newNodeList(receiver, implementsTag!.ClassName!.Loc, Arena_NewSlice1(receiver!.nodeSliceArena, heritageClause) as GoSlice<GoPtr<Node>>);
        } else {
          cls!.HeritageClauses!.Nodes = [...cls!.HeritageClauses!.Nodes, heritageClause];
        }
        Parser_finishMutatedNode(receiver, parent);
      }
      break;
    }
    case KindJSDocAugmentsTag: {
      const cls = getClassLikeData(parent);
      if (cls !== undefined && cls!.HeritageClauses !== undefined) {
        const extendsClause = Find(cls!.HeritageClauses!.Nodes, (node) => (AsHeritageClause(node)!.Token === KindExtendsKeyword) as bool);
        if (extendsClause !== undefined && AsHeritageClause(extendsClause)!.Types!.Nodes.length === 1) {
          const target = AsExpressionWithTypeArguments(AsHeritageClause(extendsClause)!.Types!.Nodes[0]);
          const source = AsExpressionWithTypeArguments(Node_ClassName(tag));
          if (HasSamePropertyAccessName(target!.Expression, source!.Expression)) {
            if (target!.TypeArguments === undefined && source!.TypeArguments !== undefined) {
              const newArguments = Arena_NewSlice(receiver!.nodeSliceArena, source!.TypeArguments!.Nodes.length as int) as GoSlice<GoPtr<Node>>;
              for (let i: int = 0; i < source!.TypeArguments!.Nodes.length; i++) {
                newArguments[i] = Parser_addDeepCloneReparse(receiver, source!.TypeArguments!.Nodes[i]);
              }
              target!.TypeArguments = Parser_newNodeList(receiver, source!.TypeArguments!.Loc, newArguments);
              Parser_finishMutatedNode(receiver, target);
            }
          }
        }
      }
      break;
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.makeQuestionIfOptional","kind":"method","status":"implemented","sigHash":"f9013aff64b81e1ab037bb03d2040bdb4dd13a70f164a79121dee270d156ca2b","bodyHash":"5495a69d366087362aeb3c927b78acb246544e75d9c7f8ed53f67883884b8bfa"}
 *
 * Go source:
 * func (p *Parser) makeQuestionIfOptional(parameter *ast.JSDocParameterOrPropertyTag) *ast.Node {
 * 	var questionToken *ast.Node
 * 	if parameter.IsBracketed || parameter.TypeExpression != nil && parameter.TypeExpression.Type().Kind == ast.KindJSDocOptionalType {
 * 		questionToken = p.factory.NewToken(ast.KindQuestionToken)
 * 		questionToken.Loc = parameter.Loc
 * 		questionToken.Flags = p.contextFlags | ast.NodeFlagsReparsed
 * 	}
 * 	return questionToken
 * }
 */
export function Parser_makeQuestionIfOptional(receiver: GoPtr<Parser>, parameter: GoPtr<JSDocParameterOrPropertyTag>): GoPtr<Node> {
  let questionToken: GoPtr<Node> = undefined;
  if (parameter!.IsBracketed || (parameter!.TypeExpression !== undefined && Node_Type(parameter!.TypeExpression)!.Kind === KindJSDocOptionalType)) {
    questionToken = NewToken(receiver!.factory, KindQuestionToken);
    questionToken!.Loc = parameter!.Loc;
    questionToken!.Flags = receiver!.contextFlags | NodeFlagsReparsed;
  }
  return questionToken;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::func::findMatchingParameter","kind":"func","status":"implemented","sigHash":"6896d32d45ce17714e39b6bb9fc480642f5d9384d208a3451965710159c2dce7","bodyHash":"3f28290932568d157619227a347698f60356b8efbe1248498e6489dcb86fabe9"}
 *
 * Go source:
 * func findMatchingParameter(fun *ast.Node, parameterTag *ast.JSDocParameterOrPropertyTag, jsDoc *ast.Node) (*ast.ParameterDeclaration, bool) {
 * 	tagIndex := -1
 * 	paramCount := -1
 * 	for _, tag := range jsDoc.AsJSDoc().Tags.Nodes {
 * 		if tag.Kind == ast.KindJSDocParameterTag {
 * 			paramCount++
 * 			if tag.AsJSDocParameterOrPropertyTag() == parameterTag {
 * 				tagIndex = paramCount
 * 				break
 * 			}
 * 		}
 * 	}
 * 	for parameterIndex, parameter := range fun.Parameters() {
 * 		if parameter.Name().Kind == ast.KindIdentifier {
 * 			if parameterTag.Name().Kind == ast.KindIdentifier &&
 * 				((parameter.Name().Text() == parameterTag.Name().Text()) || (parameterIndex == tagIndex && len(parameterTag.Name().Text()) == 0)) {
 * 				return parameter.AsParameterDeclaration(), true
 * 			}
 * 		} else if parameterIndex == tagIndex {
 * 			return parameter.AsParameterDeclaration(), true
 * 		}
 * 	}
 * 	return nil, false
 * }
 */
export function findMatchingParameter(fun: GoPtr<Node>, parameterTag: GoPtr<JSDocParameterOrPropertyTag>, jsDoc: GoPtr<Node>): [GoPtr<ParameterDeclaration>, bool] {
  let tagIndex: int = -1;
  let paramCount: int = -1;
  for (const tag of AsJSDoc(jsDoc)!.Tags!.Nodes) {
    if (tag!.Kind === KindJSDocParameterTag) {
      paramCount++;
      if (AsJSDocParameterOrPropertyTag(tag) === parameterTag) {
        tagIndex = paramCount;
        break;
      }
    }
  }
  const parameters = Node_Parameters(fun);
  for (let parameterIndex: int = 0; parameterIndex < parameters.length; parameterIndex++) {
    const parameter = parameters[parameterIndex];
    if (Node_Name(parameter)!.Kind === KindIdentifier) {
      if (parameterTag!.name!.Kind === KindIdentifier &&
          ((Node_Text(Node_Name(parameter)) === Node_Text(parameterTag!.name)) || (parameterIndex === tagIndex && Node_Text(parameterTag!.name).length === 0))) {
        return [AsParameterDeclaration(parameter), true as bool];
      }
    } else if (parameterIndex === tagIndex) {
      return [AsParameterDeclaration(parameter), true as bool];
    }
  }
  return [undefined, false as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::func::getFunctionLikeHost","kind":"func","status":"implemented","sigHash":"e903b09f9d78eb4f62c4bd055e03147abe72b6be14628ae8746d6b00f18265c6","bodyHash":"50cdc7588123899466cf0ce2a084dc8728a58f0f7161dbf217c413c235a0e307"}
 *
 * Go source:
 * func getFunctionLikeHost(host *ast.Node) *ast.Node {
 * 	fun := host
 * 	if host.Kind == ast.KindVariableStatement && host.AsVariableStatement().DeclarationList != nil {
 * 		for _, declaration := range host.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes {
 * 			if ast.IsFunctionLike(declaration.Initializer()) {
 * 				fun = declaration.Initializer()
 * 				break
 * 			}
 * 		}
 * 	} else if host.Kind == ast.KindPropertyAssignment {
 * 		fun = host.Initializer()
 * 	} else if host.Kind == ast.KindPropertyDeclaration {
 * 		fun = host.Initializer()
 * 	} else if host.Kind == ast.KindExportAssignment {
 * 		fun = host.Expression()
 * 	} else if host.Kind == ast.KindReturnStatement {
 * 		fun = host.Expression()
 * 	} else if host.Kind == ast.KindExpressionStatement {
 * 		fun = ast.GetRightMostAssignedExpression(host.Expression())
 * 	}
 * 	if ast.IsFunctionLike(fun) {
 * 		return fun
 * 	}
 * 	return nil
 * }
 */
export function getFunctionLikeHost(host: GoPtr<Node>): GoPtr<Node> {
  // Faithful to Go: NO skipping of satisfies/as wrappers — once a @satisfies
  // tag has wrapped an initializer in a SatisfiesExpression, later tags (e.g.
  // @param) no longer find a function-like host and intentionally no-op.
  let fun: GoPtr<Node> = host;
  if (host!.Kind === KindVariableStatement && AsVariableStatement(host)!.DeclarationList !== undefined) {
    for (const declaration of AsVariableDeclarationList(AsVariableStatement(host)!.DeclarationList)!.Declarations!.Nodes) {
      if (IsFunctionLike(Node_Initializer(declaration))) {
        fun = Node_Initializer(declaration);
        break;
      }
    }
  } else if (host!.Kind === KindPropertyAssignment) {
    fun = Node_Initializer(host);
  } else if (host!.Kind === KindPropertyDeclaration) {
    fun = Node_Initializer(host);
  } else if (host!.Kind === KindExportAssignment) {
    fun = Node_Expression(host);
  } else if (host!.Kind === KindReturnStatement) {
    fun = Node_Expression(host);
  } else if (host!.Kind === KindExpressionStatement) {
    fun = GetRightMostAssignedExpression(Node_Expression(host));
  }
  if (IsFunctionLike(fun)) {
    return fun;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.makeNewCast","kind":"method","status":"implemented","sigHash":"5ff33fdd9fdba0845585d01a806e43db99a2e9eef89bbf092761298104a2c32b","bodyHash":"1009433c0edd56947178b5566b8b30ac73db983501d0e3fb1dd3ba58fd84fb4a"}
 *
 * Go source:
 * func (p *Parser) makeNewCast(t *ast.TypeNode, e *ast.Node, isAssertion bool) *ast.Node {
 * 	var assert *ast.Node
 * 	if isAssertion {
 * 		assert = p.factory.NewAsExpression(e, t)
 * 	} else {
 * 		assert = p.factory.NewSatisfiesExpression(e, t)
 * 	}
 * 	p.finishNodeWithEnd(assert, e.Pos(), e.End())
 * 	return assert
 * }
 */
export function Parser_makeNewCast(receiver: GoPtr<Parser>, t: GoPtr<TypeNode>, e: GoPtr<Node>, isAssertion: bool): GoPtr<Node> {
  let assert: GoPtr<Node>;
  if (isAssertion) {
    assert = NewAsExpression(receiver!.factory, e, t);
  } else {
    assert = NewSatisfiesExpression(receiver!.factory, e, t);
  }
  Parser_finishNodeWithEnd(receiver, assert, Node_Pos(e), Node_End(e));
  return assert;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::func::getClassLikeData","kind":"func","status":"implemented","sigHash":"f5b050cea08cf21dbcfb7234f0bdcd87842be15166d32dcca70319d727b19b14","bodyHash":"7e585ecba90eaf5415e95580e0d161118188a9045ee9022b9e261daab2cf1ecb"}
 *
 * Go source:
 * func getClassLikeData(parent *ast.Node) *ast.ClassLikeBase {
 * 	var class *ast.ClassLikeBase
 * 	switch parent.Kind {
 * 	case ast.KindClassDeclaration:
 * 		class = parent.AsClassDeclaration().ClassLikeData()
 * 	case ast.KindClassExpression:
 * 		class = parent.AsClassExpression().ClassLikeData()
 * 	}
 * 	return class
 * }
 */
export function getClassLikeData(parent: GoPtr<Node>): GoPtr<ClassLikeBase> {
  let cls: GoPtr<ClassLikeBase> = undefined;
  switch (parent!.Kind) {
    case KindClassDeclaration:
      cls = AsClassDeclaration(parent);
      break;
    case KindClassExpression:
      cls = AsClassExpression(parent);
      break;
  }
  return cls;
}

// Helper: create an export modifier node attached to locationNode
function Parser_createExportModifier(receiver: GoPtr<Parser>, locationNode: GoPtr<Node>): GoPtr<ModifierList> {
  const exportModifier = NewToken(receiver!.factory, KindExportKeyword);
  exportModifier!.Loc = locationNode!.Loc;
  exportModifier!.Flags = receiver!.contextFlags | NodeFlagsReparsed;
  const nodes = Arena_NewSlice1(receiver!.nodeSliceArena, exportModifier) as GoSlice<GoPtr<Node>>;
  return Parser_newModifierList(receiver, locationNode!.Loc, nodes);
}

// Helper: return the innermost identifier from a JSDoc namespace chain
function Parser_getInnermostNameOfJSDocNamespace(receiver: GoPtr<Parser>, fullName: GoPtr<Node>): GoPtr<Node> {
  if (fullName === undefined) {
    return undefined;
  }
  let current: GoPtr<Node> = fullName;
  while (IsModuleDeclaration(current)) {
    const body: GoPtr<Node> = AsModuleDeclaration(current)!.Body;
    if (body === undefined) {
      return Node_Name(current);
    }
    current = body;
  }
  return current;
}

// Helper: wrap a statement in namespace declarations corresponding to a JSDoc dotted name
function Parser_wrapInJSDocNamespace(receiver: GoPtr<Parser>, fullName: GoPtr<Node>, statement: GoPtr<Node>, nested: bool): GoPtr<Node> {
  if (fullName === undefined || !IsModuleDeclaration(fullName)) {
    return statement;
  }
  const wrapped = Parser_wrapInJSDocNamespace(receiver, Node_Body(fullName), statement, true);
  const block = NewModuleBlock(receiver!.factory, Parser_newNodeList(receiver, fullName!.Loc, Arena_NewSlice1(receiver!.nodeSliceArena, wrapped) as GoSlice<GoPtr<Node>>));
  Parser_finishReparsedNode(receiver, block, fullName);
  let modifiers: GoPtr<ModifierList> = undefined;
  if (nested) {
    modifiers = Parser_createExportModifier(receiver, fullName);
  }
  const result = NewModuleDeclaration(receiver!.factory, modifiers, KindNamespaceKeyword, Parser_addDeepCloneReparse(receiver, Node_Name(fullName)), block);
  Parser_finishReparsedNode(receiver, result, fullName);
  receiver!.reparsedClones = [...receiver!.reparsedClones, result];
  return result;
}
