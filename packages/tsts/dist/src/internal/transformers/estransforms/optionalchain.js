import { Node_Clone, Node_SubtreeFacts, NodeFactory_AsNodeFactory } from "../../ast/spine.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitNode, NodeVisitor_VisitNodes } from "../../ast/visitor.js";
import { AsCallExpression, AsDeleteExpression, AsElementAccessExpression, AsParenthesizedExpression, AsPropertyAccessExpression, AsSyntheticReferenceExpression, } from "../../ast/generated/casts.js";
import { IsCallExpression, IsNonNullExpression, IsParenthesizedExpression, IsSyntheticReferenceExpression, IsTaggedTemplateExpression, } from "../../ast/generated/predicates.js";
import { KindCallExpression, KindColonToken, KindDeleteExpression, KindElementAccessExpression, KindParenthesizedExpression, KindPropertyAccessExpression, KindQuestionToken, KindSuperKeyword, } from "../../ast/generated/kinds.js";
import { NodeFlagsNone, NodeFlagsOptionalChain } from "../../ast/generated/flags.js";
import { SubtreeContainsOptionalChaining } from "../../ast/subtreefacts.js";
import { OEKPartiallyEmittedExpressions, SkipPartiallyEmittedExpressions, SkipParentheses } from "../../ast/utilities.js";
import { Node_Expression, Node_QuestionDotToken, NodeFactory_UpdateCallExpression, NodeFactory_UpdateElementAccessExpression, NodeFactory_UpdateParenthesizedExpression, NodeFactory_UpdatePropertyAccessExpression } from "../../ast/ast.js";
import { createNotNullCondition } from "./utilities.js";
import { IsSimpleCopiableExpression } from "../utilities.js";
import { NewCallExpression, NewConditionalExpression, NewDeleteExpression, NewElementAccessExpression, NewPropertyAccessExpression, NewSyntheticReferenceExpression, NewToken, } from "../../ast/generated/factory.js";
import { NodeFactory_NewAssignmentExpression, NodeFactory_NewFunctionCallCall, NodeFactory_RestoreOuterExpressions, NodeFactory_NewTempVariable, NodeFactory_NewThisExpression, NodeFactory_NewVoidZeroExpression, NodeFactory_NewTrueExpression, } from "../../printer/factory.js";
import { EmitContext_AddEmitFlags, EmitContext_AddVariableDeclaration, EmitContext_HasAutoGenerateInfo, EmitContext_SetOriginal, } from "../../printer/emitcontext.js";
import { EFNoComments } from "../../printer/emitflags.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visit","kind":"method","status":"implemented","sigHash":"dbb11e0033208825634aece952d75819462fbb7c6e8d785fca71f6caacf62093","bodyHash":"9f78a1f31c76bb8b8b79810c44e5e073547a39ede886ac9c6135895e87efb98c"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsOptionalChaining == 0 {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindCallExpression:
 * 		return ch.visitCallExpression(node.AsCallExpression(), false)
 * 	case ast.KindPropertyAccessExpression,
 * 		ast.KindElementAccessExpression:
 * 		if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 			return ch.visitOptionalExpression(node, false, false)
 * 		}
 * 		return ch.Visitor().VisitEachChild(node)
 * 	case ast.KindDeleteExpression:
 * 		return ch.visitDeleteExpression(node.AsDeleteExpression())
 * 	default:
 * 		return ch.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function optionalChainTransformer_visit(receiver, node) {
    if ((Node_SubtreeFacts(node) & SubtreeContainsOptionalChaining) === 0) {
        return node;
    }
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    switch (node.Kind) {
        case KindCallExpression:
            return optionalChainTransformer_visitCallExpression(receiver, AsCallExpression(node), false);
        case KindPropertyAccessExpression:
        case KindElementAccessExpression:
            if ((node.Flags & NodeFlagsOptionalChain) !== 0) {
                return optionalChainTransformer_visitOptionalExpression(receiver, node, false, false);
            }
            return NodeVisitor_VisitEachChild(visitor, node);
        case KindDeleteExpression:
            return optionalChainTransformer_visitDeleteExpression(receiver, AsDeleteExpression(node));
        default:
            return NodeVisitor_VisitEachChild(visitor, node);
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitCallExpression","kind":"method","status":"implemented","sigHash":"8e52b576b86b10d39a329d1c7115fe17d6f6f744b1c1e9bcf38367f964754ff0","bodyHash":"1e99d888a3323ecca2ee93c729d2dae1c636535ce8329b72c39f7246f515a068"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitCallExpression(node *ast.CallExpression, captureThisArg bool) *ast.Node {
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		// If `node` is an optional chain, then it is the outermost chain of an optional expression.
 * 		return ch.visitOptionalExpression(node.AsNode(), captureThisArg, false)
 * 	}
 * 	if ast.IsParenthesizedExpression(node.Expression) {
 * 		unwrapped := ast.SkipParentheses(node.Expression)
 * 		if unwrapped.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 			// capture thisArg for calls of parenthesized optional chains like `(foo?.bar)()`
 * 			expression := ch.visitParenthesizedExpression(node.Expression.AsParenthesizedExpression(), true, false)
 * 			args := ch.Visitor().VisitNodes(node.Arguments)
 * 			if ast.IsSyntheticReferenceExpression(expression) {
 * 				res := ch.Factory().NewFunctionCallCall(expression.AsSyntheticReferenceExpression().Expression, expression.AsSyntheticReferenceExpression().ThisArg, args.Nodes)
 * 				res.Loc = node.Loc
 * 				ch.EmitContext().SetOriginal(res, node.AsNode())
 * 				return res
 * 			}
 * 			return ch.Factory().UpdateCallExpression(node, expression, nil /*questionDotToken* /, nil /*typeArguments* /, args, node.Flags)
 * 		}
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function optionalChainTransformer_visitCallExpression(receiver, node, captureThisArg) {
    const pf = Transformer_Factory(receiver.__tsgoEmbedded0);
    const af = pf.__tsgoEmbedded0;
    const emitContext = Transformer_EmitContext(receiver.__tsgoEmbedded0);
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    const nodeAsNode = node;
    if ((nodeAsNode.Flags & NodeFlagsOptionalChain) !== 0) {
        return optionalChainTransformer_visitOptionalExpression(receiver, nodeAsNode, captureThisArg, false);
    }
    if (IsParenthesizedExpression(node.Expression)) {
        const unwrapped = SkipParentheses(node.Expression);
        if ((unwrapped.Flags & NodeFlagsOptionalChain) !== 0) {
            const expression = optionalChainTransformer_visitParenthesizedExpression(receiver, AsParenthesizedExpression(node.Expression), true, false);
            const args = NodeVisitor_VisitNodes(visitor, node.Arguments);
            if (IsSyntheticReferenceExpression(expression)) {
                const synth = AsSyntheticReferenceExpression(expression);
                const res = NodeFactory_NewFunctionCallCall(pf, synth.Expression, synth.ThisArg, args.Nodes);
                res.Loc = nodeAsNode.Loc;
                EmitContext_SetOriginal(emitContext, res, nodeAsNode);
                return res;
            }
            return NodeFactory_UpdateCallExpression(af, node, expression, undefined, undefined, args, nodeAsNode.Flags);
        }
    }
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitParenthesizedExpression","kind":"method","status":"implemented","sigHash":"d08a7e3ba35bf3d75a14002752b47a96a6ffcabcf1c0d624421089772abdaef9","bodyHash":"b860e7e7b05a15d0ede33fa53d14bbc1f37a2e10cd466d46c5eba65c29736ab0"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitParenthesizedExpression(node *ast.ParenthesizedExpression, captureThisArg bool, isDelete bool) *ast.Node {
 * 	expr := ch.visitNonOptionalExpression(node.Expression, captureThisArg, isDelete)
 * 	if ast.IsSyntheticReferenceExpression(expr) {
 * 		// `(a.b)` -> { expression `((_a = a).b)`, thisArg: `_a` }
 * 		// `(a[b])` -> { expression `((_a = a)[b])`, thisArg: `_a` }
 * 		synth := expr.AsSyntheticReferenceExpression()
 * 		res := ch.Factory().NewSyntheticReferenceExpression(ch.Factory().UpdateParenthesizedExpression(node, synth.Expression), synth.ThisArg)
 * 		ch.EmitContext().SetOriginal(res, node.AsNode())
 * 		return res
 * 	}
 * 	return ch.Factory().UpdateParenthesizedExpression(node, expr)
 * }
 */
export function optionalChainTransformer_visitParenthesizedExpression(receiver, node, captureThisArg, isDelete) {
    const pf = Transformer_Factory(receiver.__tsgoEmbedded0);
    const af = pf.__tsgoEmbedded0;
    const emitContext = Transformer_EmitContext(receiver.__tsgoEmbedded0);
    const nodeAsNode = node;
    const expr = optionalChainTransformer_visitNonOptionalExpression(receiver, node.Expression, captureThisArg, isDelete);
    if (IsSyntheticReferenceExpression(expr)) {
        const synth = AsSyntheticReferenceExpression(expr);
        const updated = NodeFactory_UpdateParenthesizedExpression(af, node, synth.Expression);
        const res = NewSyntheticReferenceExpression(af, updated, synth.ThisArg);
        EmitContext_SetOriginal(emitContext, res, nodeAsNode);
        return res;
    }
    return NodeFactory_UpdateParenthesizedExpression(af, node, expr);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitPropertyOrElementAccessExpression","kind":"method","status":"implemented","sigHash":"0e4be773ba8ce1f858b94c481a9730d55fa8b72d4183a4924499106221ad6e1e","bodyHash":"d1bbdb71cf54834188bfca5c199b04cc2eac463295e05c2c40481e90ae6515bd"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitPropertyOrElementAccessExpression(node *ast.Expression, captureThisArg bool, isDelete bool) *ast.Expression {
 * 	if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		// If `node` is an optional chain, then it is the outermost chain of an optional expression.
 * 		return ch.visitOptionalExpression(node.AsNode(), captureThisArg, isDelete)
 * 	}
 * 	expression := ch.Visitor().VisitNode(node.Expression())
 * 	debug.Assert(expression == nil || !ast.IsSyntheticReferenceExpression(expression))
 *
 * 	var thisArg *ast.Expression
 * 	if captureThisArg {
 * 		if !transformers.IsSimpleCopiableExpression(expression) {
 * 			thisArg = ch.Factory().NewTempVariable()
 * 			ch.EmitContext().AddVariableDeclaration(thisArg)
 * 			expression = ch.Factory().NewAssignmentExpression(thisArg, expression)
 * 		} else {
 * 			thisArg = expression
 * 		}
 * 	}
 *
 * 	if node.Kind == ast.KindPropertyAccessExpression {
 * 		p := node.AsPropertyAccessExpression()
 * 		expression = ch.Factory().UpdatePropertyAccessExpression(p, expression, nil /*questionDotToken* /, ch.Visitor().VisitNode(p.Name()), p.Flags)
 * 	} else {
 * 		p := node.AsElementAccessExpression()
 * 		expression = ch.Factory().UpdateElementAccessExpression(p, expression, nil, ch.Visitor().VisitNode(p.AsElementAccessExpression().ArgumentExpression), p.Flags)
 * 	}
 *
 * 	if thisArg != nil {
 * 		res := ch.Factory().NewSyntheticReferenceExpression(expression, thisArg)
 * 		ch.EmitContext().SetOriginal(res, node.AsNode())
 * 		return res
 * 	}
 * 	return expression
 * }
 */
export function optionalChainTransformer_visitPropertyOrElementAccessExpression(receiver, node, captureThisArg, isDelete) {
    const pf = Transformer_Factory(receiver.__tsgoEmbedded0);
    const af = pf.__tsgoEmbedded0;
    const emitContext = Transformer_EmitContext(receiver.__tsgoEmbedded0);
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    const nodeAsNode = node;
    if ((nodeAsNode.Flags & NodeFlagsOptionalChain) !== 0) {
        return optionalChainTransformer_visitOptionalExpression(receiver, nodeAsNode, captureThisArg, isDelete);
    }
    let expression = NodeVisitor_VisitNode(visitor, Node_Expression(nodeAsNode));
    let thisArg = undefined;
    if (captureThisArg) {
        if (!IsSimpleCopiableExpression(expression)) {
            thisArg = NodeFactory_NewTempVariable(pf);
            EmitContext_AddVariableDeclaration(emitContext, thisArg);
            expression = NodeFactory_NewAssignmentExpression(pf, thisArg, expression);
        }
        else {
            thisArg = expression;
        }
    }
    if (nodeAsNode.Kind === KindPropertyAccessExpression) {
        const p = AsPropertyAccessExpression(nodeAsNode);
        const visitedName = NodeVisitor_VisitNode(visitor, p.name);
        expression = NodeFactory_UpdatePropertyAccessExpression(af, p, expression, undefined, visitedName, nodeAsNode.Flags);
    }
    else {
        const p = AsElementAccessExpression(nodeAsNode);
        const visitedArg = NodeVisitor_VisitNode(visitor, p.ArgumentExpression);
        expression = NodeFactory_UpdateElementAccessExpression(af, p, expression, undefined, visitedArg, nodeAsNode.Flags);
    }
    if (thisArg !== undefined) {
        const res = NewSyntheticReferenceExpression(af, expression, thisArg);
        EmitContext_SetOriginal(emitContext, res, nodeAsNode);
        return res;
    }
    return expression;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitDeleteExpression","kind":"method","status":"implemented","sigHash":"ecff27c43020084217a3ce4eb5892931fb7163ca3a6c46910b18501143e0c88a","bodyHash":"a464412ab36bfc37ceb5624a56e09fdef1ee428eb955bd908e96be4b49e8b200"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitDeleteExpression(node *ast.DeleteExpression) *ast.Node {
 * 	unwrapped := ast.SkipParentheses(node.Expression)
 * 	if unwrapped.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		return ch.visitNonOptionalExpression(node.Expression, false, true)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function optionalChainTransformer_visitDeleteExpression(receiver, node) {
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    const nodeAsNode = node;
    const unwrapped = SkipParentheses(node.Expression);
    if ((unwrapped.Flags & NodeFlagsOptionalChain) !== 0) {
        return optionalChainTransformer_visitNonOptionalExpression(receiver, node.Expression, false, true);
    }
    return NodeVisitor_VisitEachChild(visitor, nodeAsNode);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitNonOptionalExpression","kind":"method","status":"implemented","sigHash":"3f9ab6a96fbc99844d4abd3b579deb944cf64b8f779cfde9e14bc2e14ac26db1","bodyHash":"ed923f7442c7ec212e9496ca7f44f1b20775897473a206d14723ea8ade578cec"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitNonOptionalExpression(node *ast.Expression, captureThisArg bool, isDelete bool) *ast.Expression {
 * 	switch node.Kind {
 * 	case ast.KindParenthesizedExpression:
 * 		return ch.visitParenthesizedExpression(node.AsParenthesizedExpression(), captureThisArg, isDelete)
 * 	case ast.KindElementAccessExpression, ast.KindPropertyAccessExpression:
 * 		return ch.visitPropertyOrElementAccessExpression(node, captureThisArg, isDelete)
 * 	case ast.KindCallExpression:
 * 		return ch.visitCallExpression(node.AsCallExpression(), captureThisArg)
 * 	default:
 * 		return ch.Visitor().VisitNode(node.AsNode())
 * 	}
 * }
 */
export function optionalChainTransformer_visitNonOptionalExpression(receiver, node, captureThisArg, isDelete) {
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    const nodeAsNode = node;
    switch (nodeAsNode.Kind) {
        case KindParenthesizedExpression:
            return optionalChainTransformer_visitParenthesizedExpression(receiver, AsParenthesizedExpression(nodeAsNode), captureThisArg, isDelete);
        case KindElementAccessExpression:
        case KindPropertyAccessExpression:
            return optionalChainTransformer_visitPropertyOrElementAccessExpression(receiver, node, captureThisArg, isDelete);
        case KindCallExpression:
            return optionalChainTransformer_visitCallExpression(receiver, AsCallExpression(nodeAsNode), captureThisArg);
        default:
            return NodeVisitor_VisitNode(visitor, nodeAsNode);
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::isNonNullChain","kind":"func","status":"implemented","sigHash":"e0b4568e2ce0258afd2f552f9873d429a7766f9f06d50ce6ed39de300a0bf561","bodyHash":"c295cb1694d9848b5367fc6f625b2b5213ec0531614d57f921a91235c062106b"}
 *
 * Go source:
 * func isNonNullChain(node *ast.Node) bool {
 * 	return ast.IsNonNullExpression(node) && node.Flags&ast.NodeFlagsOptionalChain != 0
 * }
 */
export function isNonNullChain(node) {
    return IsNonNullExpression(node) && (node.Flags & NodeFlagsOptionalChain) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::flattenChain","kind":"func","status":"implemented","sigHash":"d6e09ae3909143e2579daf7ad3d6ea00b6bae59f6e433c0682e34e13a2afe0f9","bodyHash":"1f3670a7ee716151575ee2b95c8342fb8bdcbafed9787e1d486046b506a171ec"}
 *
 * Go source:
 * func flattenChain(chain *ast.Node) flattenResult {
 * 	debug.Assert(!isNonNullChain(chain))
 * 	links := []*ast.Node{chain}
 * 	for !ast.IsTaggedTemplateExpression(chain) && chain.QuestionDotToken() == nil {
 * 		chain = ast.SkipPartiallyEmittedExpressions(chain.Expression())
 * 		debug.Assert(!isNonNullChain(chain))
 * 		links = append([]*ast.Node{chain}, links...)
 * 	}
 * 	return flattenResult{chain.Expression(), links}
 * }
 */
export function flattenChain(chain) {
    let links = [chain];
    while (!IsTaggedTemplateExpression(chain) && Node_QuestionDotToken(chain) === undefined) {
        chain = SkipPartiallyEmittedExpressions(Node_Expression(chain));
        links = [chain, ...links];
    }
    return { expression: Node_Expression(chain), chain: links };
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::isCallChain","kind":"func","status":"implemented","sigHash":"86b2ae21ffee1c312ea7ea061f782a06855803fada2bbb1f9b83c23840bafc9a","bodyHash":"18ac8f0180a6246c8cd91f949cd8c5bbc4793dee9f4ace217eb7cff5aabc8038"}
 *
 * Go source:
 * func isCallChain(node *ast.Node) bool {
 * 	return ast.IsCallExpression(node) && node.Flags&ast.NodeFlagsOptionalChain != 0
 * }
 */
export function isCallChain(node) {
    return IsCallExpression(node) && (node.Flags & NodeFlagsOptionalChain) !== 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::method::optionalChainTransformer.visitOptionalExpression","kind":"method","status":"implemented","sigHash":"e65de19f41c10f036300881c45dfd469cbc92b8c4ad23a1e49207799ac524d11","bodyHash":"9ab21c6b97a9426377bfc20a1eb85e2eade41f1dbf791dd56cf5862283b31e1f"}
 *
 * Go source:
 * func (ch *optionalChainTransformer) visitOptionalExpression(node *ast.Node, captureThisArg bool, isDelete bool) *ast.Node {
 * 	r := flattenChain(node)
 * 	expression := r.expression
 * 	chain := r.chain
 * 	left := ch.visitNonOptionalExpression(ast.SkipPartiallyEmittedExpressions(expression), isCallChain(chain[0]), false)
 * 	var leftThisArg *ast.Expression
 * 	capturedLeft := left
 * 	if ast.IsSyntheticReferenceExpression(left) {
 * 		leftThisArg = left.AsSyntheticReferenceExpression().ThisArg
 * 		capturedLeft = left.AsSyntheticReferenceExpression().Expression
 * 	}
 * 	leftExpression := ch.Factory().RestoreOuterExpressions(expression, capturedLeft, ast.OEKPartiallyEmittedExpressions)
 * 	if !transformers.IsSimpleCopiableExpression(capturedLeft) {
 * 		capturedLeft = ch.Factory().NewTempVariable()
 * 		ch.EmitContext().AddVariableDeclaration(capturedLeft)
 * 		leftExpression = ch.Factory().NewAssignmentExpression(capturedLeft, leftExpression)
 * 	}
 * 	rightExpression := capturedLeft
 * 	var thisArg *ast.Expression
 *
 * 	for i, segment := range chain {
 * 		switch segment.Kind {
 * 		case ast.KindElementAccessExpression, ast.KindPropertyAccessExpression:
 * 			if i == len(chain)-1 && captureThisArg {
 * 				if !transformers.IsSimpleCopiableExpression(rightExpression) {
 * 					thisArg = ch.Factory().NewTempVariable()
 * 					ch.EmitContext().AddVariableDeclaration(thisArg)
 * 					rightExpression = ch.Factory().NewAssignmentExpression(thisArg, rightExpression)
 * 				} else {
 * 					thisArg = rightExpression
 * 				}
 * 			}
 * 			if segment.Kind == ast.KindElementAccessExpression {
 * 				rightExpression = ch.Factory().NewElementAccessExpression(rightExpression, nil, ch.Visitor().VisitNode(segment.AsElementAccessExpression().ArgumentExpression), ast.NodeFlagsNone)
 * 			} else {
 * 				rightExpression = ch.Factory().NewPropertyAccessExpression(rightExpression, nil, ch.Visitor().VisitNode(segment.AsPropertyAccessExpression().Name()), ast.NodeFlagsNone)
 * 			}
 * 		case ast.KindCallExpression:
 * 			if i == 0 && leftThisArg != nil {
 * 				if !ch.EmitContext().HasAutoGenerateInfo(leftThisArg) {
 * 					leftThisArg = leftThisArg.Clone(ch.Factory())
 * 					ch.EmitContext().AddEmitFlags(leftThisArg, printer.EFNoComments)
 * 				}
 * 				callThisArg := leftThisArg
 * 				if leftThisArg.Kind == ast.KindSuperKeyword {
 * 					callThisArg = ch.Factory().NewThisExpression()
 * 				}
 * 				rightExpression = ch.Factory().NewFunctionCallCall(rightExpression, callThisArg, ch.Visitor().VisitNodes(segment.ArgumentList()).Nodes)
 * 			} else {
 * 				rightExpression = ch.Factory().NewCallExpression(
 * 					rightExpression,
 * 					nil,
 * 					nil,
 * 					ch.Visitor().VisitNodes(segment.ArgumentList()),
 * 					ast.NodeFlagsNone,
 * 				)
 * 			}
 * 		}
 * 		ch.EmitContext().SetOriginal(rightExpression, segment)
 * 	}
 *
 * 	var target *ast.Node
 * 	if isDelete {
 * 		target = ch.Factory().NewConditionalExpression(
 * 			createNotNullCondition(ch.EmitContext(), leftExpression, capturedLeft, true),
 * 			ch.Factory().NewToken(ast.KindQuestionToken),
 * 			ch.Factory().NewTrueExpression(),
 * 			ch.Factory().NewToken(ast.KindColonToken),
 * 			ch.Factory().NewDeleteExpression(rightExpression),
 * 		)
 * 	} else {
 * 		target = ch.Factory().NewConditionalExpression(
 * 			createNotNullCondition(ch.EmitContext(), leftExpression, capturedLeft, true),
 * 			ch.Factory().NewToken(ast.KindQuestionToken),
 * 			ch.Factory().NewVoidZeroExpression(),
 * 			ch.Factory().NewToken(ast.KindColonToken),
 * 			rightExpression,
 * 		)
 * 	}
 * 	target.Loc = node.Loc
 * 	if thisArg != nil {
 * 		target = ch.Factory().NewSyntheticReferenceExpression(target, thisArg)
 * 	}
 * 	ch.EmitContext().SetOriginal(target, node.AsNode())
 * 	return target
 * }
 */
export function optionalChainTransformer_visitOptionalExpression(receiver, node, captureThisArg, isDelete) {
    const pf = Transformer_Factory(receiver.__tsgoEmbedded0);
    const af = pf.__tsgoEmbedded0;
    const emitContext = Transformer_EmitContext(receiver.__tsgoEmbedded0);
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    const r = flattenChain(node);
    const expression = r.expression;
    const chain = r.chain;
    const left = optionalChainTransformer_visitNonOptionalExpression(receiver, SkipPartiallyEmittedExpressions(expression), isCallChain(chain[0]), false);
    let leftThisArg = undefined;
    let capturedLeft = left;
    if (IsSyntheticReferenceExpression(left)) {
        const synth = AsSyntheticReferenceExpression(left);
        leftThisArg = synth.ThisArg;
        capturedLeft = synth.Expression;
    }
    let leftExpression = NodeFactory_RestoreOuterExpressions(pf, expression, capturedLeft, OEKPartiallyEmittedExpressions);
    if (!IsSimpleCopiableExpression(capturedLeft)) {
        capturedLeft = NodeFactory_NewTempVariable(pf);
        EmitContext_AddVariableDeclaration(emitContext, capturedLeft);
        leftExpression = NodeFactory_NewAssignmentExpression(pf, capturedLeft, leftExpression);
    }
    let rightExpression = capturedLeft;
    let thisArg = undefined;
    for (let i = 0; i < chain.length; i++) {
        const segment = chain[i];
        switch (segment.Kind) {
            case KindElementAccessExpression:
            case KindPropertyAccessExpression:
                if (i === chain.length - 1 && captureThisArg) {
                    if (!IsSimpleCopiableExpression(rightExpression)) {
                        thisArg = NodeFactory_NewTempVariable(pf);
                        EmitContext_AddVariableDeclaration(emitContext, thisArg);
                        rightExpression = NodeFactory_NewAssignmentExpression(pf, thisArg, rightExpression);
                    }
                    else {
                        thisArg = rightExpression;
                    }
                }
                if (segment.Kind === KindElementAccessExpression) {
                    const p = AsElementAccessExpression(chain[i]);
                    const visitedArg = NodeVisitor_VisitNode(visitor, p.ArgumentExpression);
                    rightExpression = NewElementAccessExpression(af, rightExpression, undefined, visitedArg, NodeFlagsNone);
                }
                else {
                    const p = AsPropertyAccessExpression(chain[i]);
                    const visitedName = NodeVisitor_VisitNode(visitor, p.name);
                    rightExpression = NewPropertyAccessExpression(af, rightExpression, undefined, visitedName, NodeFlagsNone);
                }
                break;
            case KindCallExpression: {
                const segmentCallExpr = AsCallExpression(chain[i]);
                const segmentArgList = NodeVisitor_VisitNodes(visitor, segmentCallExpr.Arguments);
                if (i === 0 && leftThisArg !== undefined) {
                    let lta = leftThisArg;
                    if (!EmitContext_HasAutoGenerateInfo(emitContext, lta)) {
                        lta = Node_Clone(lta, NodeFactory_AsNodeFactory(af));
                        EmitContext_AddEmitFlags(emitContext, lta, EFNoComments);
                    }
                    let callThisArg = lta;
                    if (lta.Kind === KindSuperKeyword) {
                        callThisArg = NodeFactory_NewThisExpression(pf);
                    }
                    rightExpression = NodeFactory_NewFunctionCallCall(pf, rightExpression, callThisArg, segmentArgList.Nodes);
                }
                else {
                    rightExpression = NewCallExpression(af, rightExpression, undefined, undefined, segmentArgList, NodeFlagsNone);
                }
                break;
            }
        }
        EmitContext_SetOriginal(emitContext, rightExpression, chain[i]);
    }
    const notNullCond = createNotNullCondition(emitContext, leftExpression, capturedLeft, true);
    let target;
    if (isDelete) {
        target = NewConditionalExpression(af, notNullCond, NewToken(af, KindQuestionToken), NodeFactory_NewTrueExpression(pf), NewToken(af, KindColonToken), NewDeleteExpression(af, rightExpression));
    }
    else {
        target = NewConditionalExpression(af, notNullCond, NewToken(af, KindQuestionToken), NodeFactory_NewVoidZeroExpression(pf), NewToken(af, KindColonToken), rightExpression);
    }
    target.Loc = node.Loc;
    if (thisArg !== undefined) {
        target = NewSyntheticReferenceExpression(af, target, thisArg);
    }
    EmitContext_SetOriginal(emitContext, target, node);
    return target;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalchain.go::func::newOptionalChainTransformer","kind":"func","status":"implemented","sigHash":"cbad995a2b745db86987da159e9e4ea78e4faa8ef2f0a4ce7f2dd39c3895a899","bodyHash":"99abb9eb2b2142fb47eaa44e3d7a30dd4037b0e4cf1ab349adcd6975c1d0f439"}
 *
 * Go source:
 * func newOptionalChainTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &optionalChainTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export function newOptionalChainTransformer(opts) {
    const tx = { __tsgoEmbedded0: {} };
    return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => optionalChainTransformer_visit(tx, node), opts.Context);
}
//# sourceMappingURL=optionalchain.js.map