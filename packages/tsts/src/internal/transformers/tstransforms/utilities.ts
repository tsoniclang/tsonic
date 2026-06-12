import type { GoPtr } from "../../../go/compat.js";
import type { Expression } from "../../ast/generated/unions.js";
import { KindMinusToken } from "../../ast/generated/kinds.js";
import { NewIdentifier, NewNumericLiteral, NewPrefixUnaryExpression, NewStringLiteral } from "../../ast/generated/factory.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import type { Number } from "../../jsnum/jsnum.js";
import { Number_IsInf, Number_IsNaN } from "../../jsnum/jsnum.js";
import { Number_String } from "../../jsnum/string.js";
import type { NodeFactory } from "../../printer/factory.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/utilities.go::func::constantExpression","kind":"func","status":"implemented","sigHash":"e65e6e90096edac52c1042408a6c297dceaee868456eb7e28fd2ebeb788f9201","bodyHash":"4e5d3e4f0056677f1f81777fae423608bede970c2421ce02496d01a4f229ade4"}
 *
 * Go source:
 * func constantExpression(value any, factory *printer.NodeFactory) *ast.Expression {
 * 	switch value := value.(type) {
 * 	case string:
 * 		return factory.NewStringLiteral(value, ast.TokenFlagsNone)
 * 	case jsnum.Number:
 * 		if value.IsInf() {
 * 			if value > 0 {
 * 				return factory.NewIdentifier("Infinity")
 * 			}
 * 			return factory.NewPrefixUnaryExpression(ast.KindMinusToken, factory.NewIdentifier("Infinity"))
 * 		}
 * 		if value.IsNaN() {
 * 			return factory.NewIdentifier("NaN")
 * 		}
 * 		if value < 0 {
 * 			return factory.NewPrefixUnaryExpression(ast.KindMinusToken, constantExpression(-value, factory))
 * 		}
 * 		return factory.NewNumericLiteral(value.String(), ast.TokenFlagsNone)
 * 	}
 * 	return nil
 * }
 */
export function constantExpression(value: unknown, factory: GoPtr<NodeFactory>): GoPtr<Expression> {
  const f = factory!.__tsgoEmbedded0!;
  if (typeof value === "string") {
    return NewStringLiteral(f, value, TokenFlagsNone);
  }
  if (typeof value === "number") {
    const v: Number = value as Number;
    if (Number_IsInf(v)) {
      if (v > 0) {
        return NewIdentifier(f, "Infinity");
      }
      return NewPrefixUnaryExpression(f, KindMinusToken, NewIdentifier(f, "Infinity"));
    }
    if (Number_IsNaN(v)) {
      return NewIdentifier(f, "NaN");
    }
    if (v < 0) {
      return NewPrefixUnaryExpression(f, KindMinusToken, constantExpression((-v) as Number, factory));
    }
    return NewNumericLiteral(f, Number_String(v), TokenFlagsNone);
  }
  return undefined;
}
