import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import type { OuterExpressionKinds } from "../ast/utilities.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/evaluator/evaluator.go::type::Result","kind":"type","status":"implemented","sigHash":"a3a9d32c3240f54837956a383b258f44f9026492dadd7240384a097b26b6d6ca","bodyHash":"cd145909ea83e547879d8fed4cb79259fcdd3e81aa150c04e711b7e67dad21c0"}
 *
 * Go source:
 * Result struct {
 * 	Value                 any
 * 	IsSyntacticallyString bool
 * 	ResolvedOtherFiles    bool
 * 	HasExternalReferences bool
 * }
 */
export interface Result {
    Value: unknown;
    IsSyntacticallyString: bool;
    ResolvedOtherFiles: bool;
    HasExternalReferences: bool;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/evaluator/evaluator.go::func::NewResult","kind":"func","status":"implemented","sigHash":"a7d1123ccb3a776d722f05482385eeed88c35b337bec96779612586823f85f64","bodyHash":"9d17774cfa52ac50f85b6124ac7ffd3b2f30562c15d64fb27b6b45a03e379a30"}
 *
 * Go source:
 * func NewResult(value any, isSyntacticallyString bool, resolvedOtherFiles bool, hasExternalReferences bool) Result {
 * 	return Result{value, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * }
 */
export declare function NewResult(value: unknown, isSyntacticallyString: bool, resolvedOtherFiles: bool, hasExternalReferences: bool): Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/evaluator/evaluator.go::type::Evaluator","kind":"type","status":"implemented","sigHash":"f594ca3f1ce7909d0008027e88ba1127240136fcb93450fbb1a39342caeeeab0","bodyHash":"357e603396eb62091101745635d91e01cdcefeae63247e08b328af2df4a9f916"}
 *
 * Go source:
 * Evaluator func(expr *ast.Node, location *ast.Node) Result
 */
export type Evaluator = (expr: GoPtr<Node>, location: GoPtr<Node>) => Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/evaluator/evaluator.go::func::NewEvaluator","kind":"func","status":"implemented","sigHash":"c788e7be8c5a4a7b604fc445b31bf83a466c0b2ab9747563519c09d25af6b42b","bodyHash":"b6e2b80e11d91c71127807eb17266c7286a377aadb316adc67362dd67ec2213d"}
 *
 * Go source:
 * func NewEvaluator(evaluateEntity Evaluator, outerExpressionsToSkip ast.OuterExpressionKinds) Evaluator {
 * 	var evaluate Evaluator
 * 	evaluate = func(expr *ast.Node, location *ast.Node) Result {
 * 		isSyntacticallyString := false
 * 		resolvedOtherFiles := false
 * 		hasExternalReferences := false
 * 		// It's unclear when/whether we should consider skipping other kinds of outer expressions.
 * 		// Type assertions intentionally break evaluation when evaluating literal types, such as:
 * 		//     type T = `one ${"two" as any} three`; // string
 * 		// But it's less clear whether such an assertion should break enum member evaluation:
 * 		//     enum E {
 * 		//       A = "one" as any
 * 		//     }
 * 		// SatisfiesExpressions and non-null assertions seem to have even less reason to break
 * 		// emitting enum members as literals. However, these expressions also break Babel's
 * 		// evaluation (but not esbuild's), and the isolatedModules errors we give depend on
 * 		// our evaluation results, so we're currently being conservative so as to issue errors
 * 		// on code that might break Babel.
 * 		expr = ast.SkipOuterExpressions(expr, outerExpressionsToSkip|ast.OEKParentheses)
 * 		switch expr.Kind {
 * 		case ast.KindPrefixUnaryExpression:
 * 			result := evaluate(expr.AsPrefixUnaryExpression().Operand, location)
 * 			resolvedOtherFiles = result.ResolvedOtherFiles
 * 			hasExternalReferences = result.HasExternalReferences
 * 			if value, ok := result.Value.(jsnum.Number); ok {
 * 				switch expr.AsPrefixUnaryExpression().Operator {
 * 				case ast.KindPlusToken:
 * 					return Result{value, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindMinusToken:
 * 					return Result{-value, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindTildeToken:
 * 					return Result{value.BitwiseNOT(), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				}
 * 			}
 * 		case ast.KindBinaryExpression:
 * 			left := evaluate(expr.AsBinaryExpression().Left, location)
 * 			right := evaluate(expr.AsBinaryExpression().Right, location)
 * 			operator := expr.AsBinaryExpression().OperatorToken.Kind
 * 			isSyntacticallyString = (left.IsSyntacticallyString || right.IsSyntacticallyString) && expr.AsBinaryExpression().OperatorToken.Kind == ast.KindPlusToken
 * 			resolvedOtherFiles = left.ResolvedOtherFiles || right.ResolvedOtherFiles
 * 			hasExternalReferences = left.HasExternalReferences || right.HasExternalReferences
 * 			leftNum, leftIsNum := left.Value.(jsnum.Number)
 * 			rightNum, rightIsNum := right.Value.(jsnum.Number)
 * 			if leftIsNum && rightIsNum {
 * 				switch operator {
 * 				case ast.KindBarToken:
 * 					return Result{leftNum.BitwiseOR(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindAmpersandToken:
 * 					return Result{leftNum.BitwiseAND(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindGreaterThanGreaterThanToken:
 * 					return Result{leftNum.SignedRightShift(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindGreaterThanGreaterThanGreaterThanToken:
 * 					return Result{leftNum.UnsignedRightShift(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindLessThanLessThanToken:
 * 					return Result{leftNum.LeftShift(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindCaretToken:
 * 					return Result{leftNum.BitwiseXOR(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindAsteriskToken:
 * 					return Result{leftNum * rightNum, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindSlashToken:
 * 					return Result{leftNum / rightNum, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindPlusToken:
 * 					return Result{leftNum + rightNum, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindMinusToken:
 * 					return Result{leftNum - rightNum, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindPercentToken:
 * 					return Result{leftNum.Remainder(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				case ast.KindAsteriskAsteriskToken:
 * 					return Result{leftNum.Exponentiate(rightNum), isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 				}
 * 			}
 * 			leftStr, leftIsStr := left.Value.(string)
 * 			rightStr, rightIsStr := right.Value.(string)
 * 			if (leftIsStr || leftIsNum) && (rightIsStr || rightIsNum) && operator == ast.KindPlusToken {
 * 				if leftIsNum {
 * 					leftStr = leftNum.String()
 * 				}
 * 				if rightIsNum {
 * 					rightStr = rightNum.String()
 * 				}
 * 				return Result{leftStr + rightStr, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 			}
 * 		case ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral:
 * 			return Result{expr.Text(), true /*isSyntacticallyString* /, false, false}
 * 		case ast.KindTemplateExpression:
 * 			return evaluateTemplateExpression(expr, location, evaluate)
 * 		case ast.KindNumericLiteral:
 * 			return Result{jsnum.FromString(expr.Text()), false, false, false}
 * 		case ast.KindIdentifier:
 * 			return evaluateEntity(expr, location)
 * 		case ast.KindElementAccessExpression, ast.KindPropertyAccessExpression:
 * 			if ast.IsEntityNameExpression(expr.Expression()) {
 * 				return evaluateEntity(expr, location)
 * 			}
 * 		}
 * 		return Result{nil, isSyntacticallyString, resolvedOtherFiles, hasExternalReferences}
 * 	}
 * 	return evaluate
 * }
 */
export declare function NewEvaluator(evaluateEntity: Evaluator, outerExpressionsToSkip: OuterExpressionKinds): Evaluator;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/evaluator/evaluator.go::func::evaluateTemplateExpression","kind":"func","status":"implemented","sigHash":"6c29c77ddc6dad3fe14851dfd638b973dfce35e64ae865b7b9eb2a4ed74873d1","bodyHash":"289189194c5aeaa963b81e7420205e134470572d1a9817d2f6d63f8e5f8379bc"}
 *
 * Go source:
 * func evaluateTemplateExpression(expr *ast.Node, location *ast.Node, evaluate Evaluator) Result {
 * 	var sb strings.Builder
 * 	sb.WriteString(expr.AsTemplateExpression().Head.Text())
 * 	resolvedOtherFiles := false
 * 	hasExternalReferences := false
 * 	for _, span := range expr.AsTemplateExpression().TemplateSpans.Nodes {
 * 		spanResult := evaluate(span.Expression(), location)
 * 		if spanResult.Value == nil {
 * 			return Result{nil, true /*isSyntacticallyString* /, false, false}
 * 		}
 * 		sb.WriteString(AnyToString(spanResult.Value))
 * 		sb.WriteString(span.AsTemplateSpan().Literal.Text())
 * 		resolvedOtherFiles = resolvedOtherFiles || spanResult.ResolvedOtherFiles
 * 		hasExternalReferences = hasExternalReferences || spanResult.HasExternalReferences
 * 	}
 * 	return Result{sb.String(), true, resolvedOtherFiles, hasExternalReferences}
 * }
 */
export declare function evaluateTemplateExpression(expr: GoPtr<Node>, location: GoPtr<Node>, evaluate: Evaluator): Result;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/evaluator/evaluator.go::func::AnyToString","kind":"func","status":"implemented","sigHash":"f9d183c37dd2985faab5464559e31ea071a960043772a653d8d02b7704bc620a","bodyHash":"783b785da087aa339110f1b2d2deb24f8f893f3aee83cdb75125956cefe75a61"}
 *
 * Go source:
 * func AnyToString(v any) string {
 * 	switch v := v.(type) {
 * 	case string:
 * 		return v
 * 	case jsnum.Number:
 * 		return v.String()
 * 	case bool:
 * 		return core.IfElse(v, "true", "false")
 * 	case jsnum.PseudoBigInt:
 * 		return v.String()
 * 	}
 * 	panic("Unhandled case in AnyToString")
 * }
 */
export declare function AnyToString(v: unknown): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/evaluator/evaluator.go::func::IsTruthy","kind":"func","status":"implemented","sigHash":"fcbb13ee14800f3342731fb7ae1f47e0128fd4f88f02782c598e7be4098dc2b5","bodyHash":"bed8314f4d4215bfde56b61d5f7f4fb185e22c899298e49dbbe7394f5e96b3e3"}
 *
 * Go source:
 * func IsTruthy(v any) bool {
 * 	switch v := v.(type) {
 * 	case string:
 * 		return len(v) != 0
 * 	case jsnum.Number:
 * 		return v != 0 && !v.IsNaN()
 * 	case bool:
 * 		return v
 * 	case jsnum.PseudoBigInt:
 * 		return v != jsnum.PseudoBigInt{}
 * 	}
 * 	panic("Unhandled case in IsTruthy")
 * }
 */
export declare function IsTruthy(v: unknown): bool;
//# sourceMappingURL=evaluator.d.ts.map