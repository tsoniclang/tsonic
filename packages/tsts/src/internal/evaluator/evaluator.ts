import type { bool } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import type { Node } from "../ast/spine.js";
import { Node_Expression, Node_Text } from "../ast/ast.js";
import { AsBinaryExpression, AsPrefixUnaryExpression, AsTemplateExpression, AsTemplateSpan } from "../ast/generated/casts.js";
import {
  KindAmpersandToken,
  KindAsteriskAsteriskToken,
  KindAsteriskToken,
  KindBarToken,
  KindBinaryExpression,
  KindCaretToken,
  KindElementAccessExpression,
  KindGreaterThanGreaterThanGreaterThanToken,
  KindGreaterThanGreaterThanToken,
  KindIdentifier,
  KindLessThanLessThanToken,
  KindMinusToken,
  KindNoSubstitutionTemplateLiteral,
  KindNumericLiteral,
  KindPercentToken,
  KindPlusToken,
  KindPrefixUnaryExpression,
  KindPropertyAccessExpression,
  KindSlashToken,
  KindStringLiteral,
  KindTemplateExpression,
  KindTildeToken,
} from "../ast/generated/kinds.js";
import { IsEntityNameExpression, OEKParentheses, SkipOuterExpressions } from "../ast/utilities.js";
import type { OuterExpressionKinds } from "../ast/utilities.js";
import { IfElse } from "../core/core.js";
import type { Number } from "../jsnum/jsnum.js";
import {
  Number_BitwiseAND,
  Number_BitwiseNOT,
  Number_BitwiseOR,
  Number_BitwiseXOR,
  Number_Exponentiate,
  Number_IsNaN,
  Number_LeftShift,
  Number_Remainder,
  Number_SignedRightShift,
  Number_UnsignedRightShift,
} from "../jsnum/jsnum.js";
import type { PseudoBigInt } from "../jsnum/pseudobigint.js";
import { PseudoBigInt_String } from "../jsnum/pseudobigint.js";
import { FromString, Number_String } from "../jsnum/string.js";

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
export function NewResult(value: unknown, isSyntacticallyString: bool, resolvedOtherFiles: bool, hasExternalReferences: bool): Result {
  return {
    Value: value,
    IsSyntacticallyString: isSyntacticallyString,
    ResolvedOtherFiles: resolvedOtherFiles,
    HasExternalReferences: hasExternalReferences,
  };
}

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
export function NewEvaluator(evaluateEntity: Evaluator, outerExpressionsToSkip: OuterExpressionKinds): Evaluator {
  let evaluate!: Evaluator;
  evaluate = (expr: GoPtr<Node>, location: GoPtr<Node>): Result => {
    let isSyntacticallyString: bool = false;
    let resolvedOtherFiles: bool = false;
    let hasExternalReferences: bool = false;
    // It's unclear when/whether we should consider skipping other kinds of outer expressions.
    // Type assertions intentionally break evaluation when evaluating literal types, such as:
    //     type T = `one ${"two" as any} three`; // string
    // But it's less clear whether such an assertion should break enum member evaluation:
    //     enum E {
    //       A = "one" as any
    //     }
    // SatisfiesExpressions and non-null assertions seem to have even less reason to break
    // emitting enum members as literals. However, these expressions also break Babel's
    // evaluation (but not esbuild's), and the isolatedModules errors we give depend on
    // our evaluation results, so we're currently being conservative so as to issue errors
    // on code that might break Babel.
    expr = SkipOuterExpressions(expr, (outerExpressionsToSkip | OEKParentheses) as OuterExpressionKinds);
    switch (expr!.Kind) {
      case KindPrefixUnaryExpression: {
        const prefix = AsPrefixUnaryExpression(expr)!;
        const result: Result = evaluate(prefix.Operand, location);
        resolvedOtherFiles = result.ResolvedOtherFiles;
        hasExternalReferences = result.HasExternalReferences;
        if (typeof result.Value === "number") {
          const value = result.Value as Number;
          switch (prefix.Operator) {
            case KindPlusToken:
              return { Value: value, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindMinusToken:
              return { Value: -value, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindTildeToken:
              return { Value: Number_BitwiseNOT(value), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
          }
        }
        break;
      }
      case KindBinaryExpression: {
        const binary = AsBinaryExpression(expr)!;
        const left: Result = evaluate(binary.Left, location);
        const right: Result = evaluate(binary.Right, location);
        const operator = binary.OperatorToken!.Kind;
        isSyntacticallyString = ((left.IsSyntacticallyString || right.IsSyntacticallyString) && binary.OperatorToken!.Kind === KindPlusToken) as bool;
        resolvedOtherFiles = (left.ResolvedOtherFiles || right.ResolvedOtherFiles) as bool;
        hasExternalReferences = (left.HasExternalReferences || right.HasExternalReferences) as bool;
        const leftIsNum: bool = typeof left.Value === "number";
        const rightIsNum: bool = typeof right.Value === "number";
        const leftNum: Number = leftIsNum ? left.Value as Number : 0;
        const rightNum: Number = rightIsNum ? right.Value as Number : 0;
        if (leftIsNum && rightIsNum) {
          switch (operator) {
            case KindBarToken:
              return { Value: Number_BitwiseOR(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindAmpersandToken:
              return { Value: Number_BitwiseAND(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindGreaterThanGreaterThanToken:
              return { Value: Number_SignedRightShift(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindGreaterThanGreaterThanGreaterThanToken:
              return { Value: Number_UnsignedRightShift(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindLessThanLessThanToken:
              return { Value: Number_LeftShift(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindCaretToken:
              return { Value: Number_BitwiseXOR(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindAsteriskToken:
              return { Value: leftNum * rightNum, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindSlashToken:
              return { Value: leftNum / rightNum, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindPlusToken:
              return { Value: leftNum + rightNum, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindMinusToken:
              return { Value: leftNum - rightNum, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindPercentToken:
              return { Value: Number_Remainder(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
            case KindAsteriskAsteriskToken:
              return { Value: Number_Exponentiate(leftNum, rightNum), IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
          }
        }
        const leftIsStr: bool = typeof left.Value === "string";
        const rightIsStr: bool = typeof right.Value === "string";
        let leftStr: string = leftIsStr ? left.Value as string : "";
        let rightStr: string = rightIsStr ? right.Value as string : "";
        if ((leftIsStr || leftIsNum) && (rightIsStr || rightIsNum) && operator === KindPlusToken) {
          if (leftIsNum) {
            leftStr = Number_String(leftNum);
          }
          if (rightIsNum) {
            rightStr = Number_String(rightNum);
          }
          return { Value: leftStr + rightStr, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
        }
        break;
      }
      case KindStringLiteral:
      case KindNoSubstitutionTemplateLiteral:
        return { Value: Node_Text(expr), IsSyntacticallyString: true, ResolvedOtherFiles: false, HasExternalReferences: false };
      case KindTemplateExpression:
        return evaluateTemplateExpression(expr, location, evaluate);
      case KindNumericLiteral:
        return { Value: FromString(Node_Text(expr)), IsSyntacticallyString: false, ResolvedOtherFiles: false, HasExternalReferences: false };
      case KindIdentifier:
        return evaluateEntity(expr, location);
      case KindElementAccessExpression:
      case KindPropertyAccessExpression:
        if (IsEntityNameExpression(Node_Expression(expr))) {
          return evaluateEntity(expr, location);
        }
        break;
    }
    return { Value: undefined, IsSyntacticallyString: isSyntacticallyString, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
  };
  return evaluate;
}

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
export function evaluateTemplateExpression(expr: GoPtr<Node>, location: GoPtr<Node>, evaluate: Evaluator): Result {
  let sb: string = "";
  const templateExpression = AsTemplateExpression(expr)!;
  sb += Node_Text(templateExpression.Head);
  let resolvedOtherFiles: bool = false;
  let hasExternalReferences: bool = false;
  for (const span of templateExpression.TemplateSpans!.Nodes) {
    const templateSpan = AsTemplateSpan(span)!;
    const spanResult: Result = evaluate(templateSpan.Expression, location);
    if (spanResult.Value === undefined) {
      return { Value: undefined, IsSyntacticallyString: true, ResolvedOtherFiles: false, HasExternalReferences: false };
    }
    sb += AnyToString(spanResult.Value);
    sb += Node_Text(templateSpan.Literal);
    resolvedOtherFiles = (resolvedOtherFiles || spanResult.ResolvedOtherFiles) as bool;
    hasExternalReferences = (hasExternalReferences || spanResult.HasExternalReferences) as bool;
  }
  return { Value: sb, IsSyntacticallyString: true, ResolvedOtherFiles: resolvedOtherFiles, HasExternalReferences: hasExternalReferences };
}

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
export function AnyToString(v: unknown): string {
  if (typeof v === "string") {
    return v;
  }
  if (typeof v === "number") {
    return Number_String(v as Number);
  }
  if (typeof v === "boolean") {
    return IfElse(v, "true", "false");
  }
  if (typeof v === "object" && v !== undefined) {
    return PseudoBigInt_String(v as PseudoBigInt);
  }
  throw new globalThis.Error("Unhandled case in AnyToString");
}

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
export function IsTruthy(v: unknown): bool {
  if (typeof v === "string") {
    return v.length !== 0;
  }
  if (typeof v === "number") {
    const n: Number = v as Number;
    return n !== 0 && !Number_IsNaN(n);
  }
  if (typeof v === "boolean") {
    return v;
  }
  if (typeof v === "object" && v !== undefined) {
    const pbi: PseudoBigInt = v as PseudoBigInt;
    return pbi.Negative !== false || pbi.Base10Value !== "";
  }
  throw new globalThis.Error("Unhandled case in IsTruthy");
}
