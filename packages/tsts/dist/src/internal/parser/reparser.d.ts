import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { ModifierList, Node, NodeList } from "../ast/spine.js";
import type { ClassLikeBase } from "../ast/generated/node.js";
import type { JSDocParameterOrPropertyTag, ParameterDeclaration } from "../ast/generated/data.js";
import type { TypeNode } from "../ast/generated/unions.js";
import type { Parser } from "./parser/state.js";
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
export declare function Parser_finishReparsedNode(receiver: GoPtr<Parser>, node: GoPtr<Node>, locationNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/parser/reparser.go::method::Parser.finishMutatedNode","kind":"method","status":"implemented","sigHash":"096abd4f1a06b0bf66559823d1a15e3f624b269a7d37bd67dca0af3f5982b471","bodyHash":"b0a9effb1e712784c8ddbb37b4f061fcb011541208cfc47fe71c7e0acd181770"}
 *
 * Go source:
 * func (p *Parser) finishMutatedNode(node *ast.Node) {
 * 	p.overrideParentInImmediateChildren(node)
 * }
 */
export declare function Parser_finishMutatedNode(receiver: GoPtr<Parser>, node: GoPtr<Node>): void;
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
export declare function Parser_addDeepCloneReparse(receiver: GoPtr<Parser>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function Parser_reparseTags(receiver: GoPtr<Parser>, parent: GoPtr<Node>, jsDoc: GoSlice<GoPtr<Node>>): void;
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
export declare function Parser_reparseUnhosted(receiver: GoPtr<Parser>, tag: GoPtr<Node>, parent: GoPtr<Node>, jsDoc: GoPtr<Node>): void;
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
export declare function Parser_reparseJSDocSignature(receiver: GoPtr<Parser>, jsSignature: GoPtr<Node>, fun: GoPtr<Node>, jsDoc: GoPtr<Node>, tag: GoPtr<Node>, modifiers: GoPtr<ModifierList>): GoPtr<Node>;
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
export declare function Parser_reparseJSDocTypeLiteral(receiver: GoPtr<Parser>, t: GoPtr<TypeNode>): GoPtr<Node>;
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
export declare function Parser_reparseJSDocComment(receiver: GoPtr<Parser>, node: GoPtr<Node>, tag: GoPtr<Node>): void;
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
export declare function Parser_gatherTypeParameters(receiver: GoPtr<Parser>, j: GoPtr<Node>, tagWithTypeParameters: GoPtr<Node>): GoPtr<NodeList>;
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
export declare function Parser_reparseHosted(receiver: GoPtr<Parser>, tag: GoPtr<Node>, parent: GoPtr<Node>, jsDoc: GoPtr<Node>): void;
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
export declare function Parser_makeQuestionIfOptional(receiver: GoPtr<Parser>, parameter: GoPtr<JSDocParameterOrPropertyTag>): GoPtr<Node>;
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
export declare function findMatchingParameter(fun: GoPtr<Node>, parameterTag: GoPtr<JSDocParameterOrPropertyTag>, jsDoc: GoPtr<Node>): [GoPtr<ParameterDeclaration>, bool];
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
export declare function getFunctionLikeHost(host: GoPtr<Node>): GoPtr<Node>;
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
export declare function Parser_makeNewCast(receiver: GoPtr<Parser>, t: GoPtr<TypeNode>, e: GoPtr<Node>, isAssertion: bool): GoPtr<Node>;
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
export declare function getClassLikeData(parent: GoPtr<Node>): GoPtr<ClassLikeBase>;
//# sourceMappingURL=reparser.d.ts.map