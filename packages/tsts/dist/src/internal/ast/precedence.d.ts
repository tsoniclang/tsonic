import type { bool, int } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import type { Kind } from "./generated/kinds.js";
import type { Expression, TypeNode } from "./generated/unions.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::type::OperatorPrecedence","kind":"type","status":"implemented","sigHash":"c62f51b1c191c2059f000bd24246388dd89d39d1d9a76efdd483390616fb7880","bodyHash":"6c9c33d26f15ea56fe8d93924377c98642eebe6af14b975bb6b35c5b7758a728"}
 *
 * Go source:
 * OperatorPrecedence int
 */
export type OperatorPrecedence = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::constGroup::OperatorPrecedenceComma+OperatorPrecedenceSpread+OperatorPrecedenceYield+OperatorPrecedenceAssignment+OperatorPrecedenceConditional+OperatorPrecedenceLogicalOR+OperatorPrecedenceLogicalAND+OperatorPrecedenceBitwiseOR+OperatorPrecedenceBitwiseXOR+OperatorPrecedenceBitwiseAND+OperatorPrecedenceEquality+OperatorPrecedenceRelational+OperatorPrecedenceShift+OperatorPrecedenceAdditive+OperatorPrecedenceMultiplicative+OperatorPrecedenceExponentiation+OperatorPrecedenceUnary+OperatorPrecedenceUpdate+OperatorPrecedenceLeftHandSide+OperatorPrecedenceOptionalChain+OperatorPrecedenceMember+OperatorPrecedencePrimary+OperatorPrecedenceParentheses+OperatorPrecedenceLowest+OperatorPrecedenceHighest+OperatorPrecedenceDisallowComma+OperatorPrecedenceCoalesce+OperatorPrecedenceInvalid","kind":"constGroup","status":"implemented","sigHash":"58bc38bc59ce42af4ba210a032bd122ba85056a29a2d16c734987b9672953dc7","bodyHash":"2ddc77a63bfcaa2fd53e665eea9f476fd6af256f4e35229d49f5b20a972782a8"}
 *
 * Go source:
 * const (
 * 	// Expression:
 * 	//     AssignmentExpression
 * 	//     Expression `,` AssignmentExpression
 * 	OperatorPrecedenceComma OperatorPrecedence = iota
 * 	// NOTE: `Spread` is higher than `Comma` due to how it is parsed in |ElementList|
 * 	// SpreadElement:
 * 	//     `...` AssignmentExpression
 * 	OperatorPrecedenceSpread
 * 	// AssignmentExpression:
 * 	//     ConditionalExpression
 * 	//     YieldExpression
 * 	//     ArrowFunction
 * 	//     AsyncArrowFunction
 * 	//     LeftHandSideExpression `=` AssignmentExpression
 * 	//     LeftHandSideExpression AssignmentOperator AssignmentExpression
 * 	//
 * 	// NOTE: AssignmentExpression is broken down into several precedences due to the requirements
 * 	//       of the parenthesizer rules.
 * 	// AssignmentExpression: YieldExpression
 * 	// YieldExpression:
 * 	//     `yield`
 * 	//     `yield` AssignmentExpression
 * 	//     `yield` `*` AssignmentExpression
 * 	OperatorPrecedenceYield
 * 	// AssignmentExpression: LeftHandSideExpression `=` AssignmentExpression
 * 	// AssignmentExpression: LeftHandSideExpression AssignmentOperator AssignmentExpression
 * 	// AssignmentOperator: one of
 * 	//     `*=` `/=` `%=` `+=` `-=` `<<=` `>>=` `>>>=` `&=` `^=` `|=` `**=`
 * 	OperatorPrecedenceAssignment
 * 	// NOTE: `Conditional` is considered higher than `Assignment` here, but in reality they have
 * 	//       the same precedence.
 * 	// AssignmentExpression: ConditionalExpression
 * 	// ConditionalExpression:
 * 	//     ShortCircuitExpression
 * 	//     ShortCircuitExpression `?` AssignmentExpression `:` AssignmentExpression
 * 	OperatorPrecedenceConditional
 * 	// LogicalORExpression:
 * 	//     LogicalANDExpression
 * 	//     LogicalORExpression `||` LogicalANDExpression
 * 	OperatorPrecedenceLogicalOR
 * 	// LogicalANDExpression:
 * 	//     BitwiseORExpression
 * 	//     LogicalANDExprerssion `&&` BitwiseORExpression
 * 	OperatorPrecedenceLogicalAND
 * 	// BitwiseORExpression:
 * 	//     BitwiseXORExpression
 * 	//     BitwiseORExpression `|` BitwiseXORExpression
 * 	OperatorPrecedenceBitwiseOR
 * 	// BitwiseXORExpression:
 * 	//     BitwiseANDExpression
 * 	//     BitwiseXORExpression `^` BitwiseANDExpression
 * 	OperatorPrecedenceBitwiseXOR
 * 	// BitwiseANDExpression:
 * 	//     EqualityExpression
 * 	//     BitwiseANDExpression `&` EqualityExpression
 * 	OperatorPrecedenceBitwiseAND
 * 	// EqualityExpression:
 * 	//     RelationalExpression
 * 	//     EqualityExpression `==` RelationalExpression
 * 	//     EqualityExpression `!=` RelationalExpression
 * 	//     EqualityExpression `===` RelationalExpression
 * 	//     EqualityExpression `!==` RelationalExpression
 * 	OperatorPrecedenceEquality
 * 	// RelationalExpression:
 * 	//     ShiftExpression
 * 	//     RelationalExpression `<` ShiftExpression
 * 	//     RelationalExpression `>` ShiftExpression
 * 	//     RelationalExpression `<=` ShiftExpression
 * 	//     RelationalExpression `>=` ShiftExpression
 * 	//     RelationalExpression `instanceof` ShiftExpression
 * 	//     RelationalExpression `in` ShiftExpression
 * 	//     [+TypeScript] RelationalExpression `as` Type
 * 	OperatorPrecedenceRelational
 * 	// ShiftExpression:
 * 	//     AdditiveExpression
 * 	//     ShiftExpression `<<` AdditiveExpression
 * 	//     ShiftExpression `>>` AdditiveExpression
 * 	//     ShiftExpression `>>>` AdditiveExpression
 * 	OperatorPrecedenceShift
 * 	// AdditiveExpression:
 * 	//     MultiplicativeExpression
 * 	//     AdditiveExpression `+` MultiplicativeExpression
 * 	//     AdditiveExpression `-` MultiplicativeExpression
 * 	OperatorPrecedenceAdditive
 * 	// MultiplicativeExpression:
 * 	//     ExponentiationExpression
 * 	//     MultiplicativeExpression MultiplicativeOperator ExponentiationExpression
 * 	// MultiplicativeOperator: one of `*`, `/`, `%`
 * 	OperatorPrecedenceMultiplicative
 * 	// ExponentiationExpression:
 * 	//     UnaryExpression
 * 	//     UpdateExpression `**` ExponentiationExpression
 * 	OperatorPrecedenceExponentiation
 * 	// UnaryExpression:
 * 	//     UpdateExpression
 * 	//     `delete` UnaryExpression
 * 	//     `void` UnaryExpression
 * 	//     `typeof` UnaryExpression
 * 	//     `+` UnaryExpression
 * 	//     `-` UnaryExpression
 * 	//     `~` UnaryExpression
 * 	//     `!` UnaryExpression
 * 	//     AwaitExpression
 * 	// UpdateExpression:            // TODO: Do we need to investigate the precedence here?
 * 	//     `++` UnaryExpression
 * 	//     `--` UnaryExpression
 * 	OperatorPrecedenceUnary
 * 	// UpdateExpression:
 * 	//     LeftHandSideExpression
 * 	//     LeftHandSideExpression `++`
 * 	//     LeftHandSideExpression `--`
 * 	OperatorPrecedenceUpdate
 * 	// LeftHandSideExpression:
 * 	//     NewExpression
 * 	// NewExpression:
 * 	//     MemberExpression
 * 	//     `new` NewExpression
 * 	OperatorPrecedenceLeftHandSide
 * 	// LeftHandSideExpression:
 * 	//     OptionalExpression
 * 	// OptionalExpression:
 * 	//     MemberExpression OptionalChain
 * 	//     CallExpression OptionalChain
 * 	//     OptionalExpression OptionalChain
 * 	OperatorPrecedenceOptionalChain
 * 	// LeftHandSideExpression:
 * 	//     CallExpression
 * 	// CallExpression:
 * 	//     CoverCallExpressionAndAsyncArrowHead
 * 	//     SuperCall
 * 	//     ImportCall
 * 	//     CallExpression Arguments
 * 	//     CallExpression `[` Expression `]`
 * 	//     CallExpression `.` IdentifierName
 * 	//     CallExpression TemplateLiteral
 * 	// MemberExpression:
 * 	//     PrimaryExpression
 * 	//     MemberExpression `[` Expression `]`
 * 	//     MemberExpression `.` IdentifierName
 * 	//     MemberExpression TemplateLiteral
 * 	//     SuperProperty
 * 	//     MetaProperty
 * 	//     `new` MemberExpression Arguments
 * 	OperatorPrecedenceMember
 * 	// TODO: JSXElement?
 * 	// PrimaryExpression:
 * 	//     `this`
 * 	//     IdentifierReference
 * 	//     Literal
 * 	//     ArrayLiteral
 * 	//     ObjectLiteral
 * 	//     FunctionExpression
 * 	//     ClassExpression
 * 	//     GeneratorExpression
 * 	//     AsyncFunctionExpression
 * 	//     AsyncGeneratorExpression
 * 	//     RegularExpressionLiteral
 * 	//     TemplateLiteral
 * 	OperatorPrecedencePrimary
 * 	// PrimaryExpression:
 * 	//     CoverParenthesizedExpressionAndArrowParameterList
 * 	OperatorPrecedenceParentheses
 * 	OperatorPrecedenceLowest        = OperatorPrecedenceComma
 * 	OperatorPrecedenceHighest       = OperatorPrecedenceParentheses
 * 	OperatorPrecedenceDisallowComma = OperatorPrecedenceYield
 * 	// ShortCircuitExpression:
 * 	//     LogicalORExpression
 * 	//     CoalesceExpression
 * 	// CoalesceExpression:
 * 	//     CoalesceExpressionHead `??` BitwiseORExpression
 * 	// CoalesceExpressionHead:
 * 	//     CoalesceExpression
 * 	//     BitwiseORExpression
 * 	OperatorPrecedenceCoalesce = OperatorPrecedenceLogicalOR
 * 	// -1 is lower than all other precedences. Returning it will cause binary expression
 * 	// parsing to stop.
 * 	OperatorPrecedenceInvalid OperatorPrecedence = -1
 * )
 */
export declare const OperatorPrecedenceComma: OperatorPrecedence;
export declare const OperatorPrecedenceSpread: OperatorPrecedence;
export declare const OperatorPrecedenceYield: OperatorPrecedence;
export declare const OperatorPrecedenceAssignment: OperatorPrecedence;
export declare const OperatorPrecedenceConditional: OperatorPrecedence;
export declare const OperatorPrecedenceLogicalOR: OperatorPrecedence;
export declare const OperatorPrecedenceLogicalAND: OperatorPrecedence;
export declare const OperatorPrecedenceBitwiseOR: OperatorPrecedence;
export declare const OperatorPrecedenceBitwiseXOR: OperatorPrecedence;
export declare const OperatorPrecedenceBitwiseAND: OperatorPrecedence;
export declare const OperatorPrecedenceEquality: OperatorPrecedence;
export declare const OperatorPrecedenceRelational: OperatorPrecedence;
export declare const OperatorPrecedenceShift: OperatorPrecedence;
export declare const OperatorPrecedenceAdditive: OperatorPrecedence;
export declare const OperatorPrecedenceMultiplicative: OperatorPrecedence;
export declare const OperatorPrecedenceExponentiation: OperatorPrecedence;
export declare const OperatorPrecedenceUnary: OperatorPrecedence;
export declare const OperatorPrecedenceUpdate: OperatorPrecedence;
export declare const OperatorPrecedenceLeftHandSide: OperatorPrecedence;
export declare const OperatorPrecedenceOptionalChain: OperatorPrecedence;
export declare const OperatorPrecedenceMember: OperatorPrecedence;
export declare const OperatorPrecedencePrimary: OperatorPrecedence;
export declare const OperatorPrecedenceParentheses: OperatorPrecedence;
export declare const OperatorPrecedenceLowest: OperatorPrecedence;
export declare const OperatorPrecedenceHighest: OperatorPrecedence;
export declare const OperatorPrecedenceDisallowComma: OperatorPrecedence;
export declare const OperatorPrecedenceCoalesce: OperatorPrecedence;
export declare const OperatorPrecedenceInvalid: OperatorPrecedence;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::func::getOperator","kind":"func","status":"implemented","sigHash":"29331344614a72e32588c92655e69fa97588faacece545c6c6f38b2940426f97","bodyHash":"a8c61d4ec145f09ef49e7e29f350a0469dd0049dd77f58392857e7c120d4391e"}
 *
 * Go source:
 * func getOperator(expression *Expression) Kind {
 * 	switch expression.Kind {
 * 	case KindBinaryExpression:
 * 		return expression.AsBinaryExpression().OperatorToken.Kind
 * 	case KindPrefixUnaryExpression:
 * 		return expression.AsPrefixUnaryExpression().Operator
 * 	case KindPostfixUnaryExpression:
 * 		return expression.AsPostfixUnaryExpression().Operator
 * 	default:
 * 		return expression.Kind
 * 	}
 * }
 */
export declare function getOperator(expression: GoPtr<Expression>): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::func::GetExpressionPrecedence","kind":"func","status":"implemented","sigHash":"82400c78c3762cad7a37127c31c2b0149a77bd34e259ee6c6622b7feec8f4eab","bodyHash":"8a5fad42c0ae054d274d0671054c88cf4cd714e5b38f640012c3856a0ccd243c"}
 *
 * Go source:
 * func GetExpressionPrecedence(expression *Expression) OperatorPrecedence {
 * 	operator := getOperator(expression)
 * 	var flags OperatorPrecedenceFlags
 * 	if expression.Kind == KindNewExpression && expression.ArgumentList() == nil {
 * 		flags = OperatorPrecedenceFlagsNewWithoutArguments
 * 	} else if IsOptionalChain(expression) {
 * 		flags = OperatorPrecedenceFlagsOptionalChain
 * 	}
 * 	return GetOperatorPrecedence(expression.Kind, operator, flags)
 * }
 */
export declare function GetExpressionPrecedence(expression: GoPtr<Expression>): OperatorPrecedence;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::type::OperatorPrecedenceFlags","kind":"type","status":"implemented","sigHash":"ba2617b82eece2c9bad4533259ae51870b15606758c59dc5a200767255e3dd34","bodyHash":"170f7c898cd1429d33f0c50455403fe667d4d5696f207d570220e81be7c29409"}
 *
 * Go source:
 * OperatorPrecedenceFlags int
 */
export type OperatorPrecedenceFlags = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::constGroup::OperatorPrecedenceFlagsNone+OperatorPrecedenceFlagsNewWithoutArguments+OperatorPrecedenceFlagsOptionalChain","kind":"constGroup","status":"implemented","sigHash":"7cede0dc1980fd408f1623901b22b4bce55b692ff89fbbbec0ede98e7d71e30a","bodyHash":"148a6f146917ee614d3b589aa54812ba7bd2a3d851e115a1642380765b2a803f"}
 *
 * Go source:
 * const (
 * 	OperatorPrecedenceFlagsNone                OperatorPrecedenceFlags = 0
 * 	OperatorPrecedenceFlagsNewWithoutArguments OperatorPrecedenceFlags = 1 << 0
 * 	OperatorPrecedenceFlagsOptionalChain       OperatorPrecedenceFlags = 1 << 1
 * )
 */
export declare const OperatorPrecedenceFlagsNone: OperatorPrecedenceFlags;
export declare const OperatorPrecedenceFlagsNewWithoutArguments: OperatorPrecedenceFlags;
export declare const OperatorPrecedenceFlagsOptionalChain: OperatorPrecedenceFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::func::GetOperatorPrecedence","kind":"func","status":"implemented","sigHash":"39e9a47a3230eaad566ce873e4c361842cd90acd8f020f3b5d269113bfb8f079","bodyHash":"fcc695deea125624c70bd9b23c89e4a3dcc9f8552e70ead04ae23da03d5ef97e"}
 *
 * Go source:
 * func GetOperatorPrecedence(nodeKind Kind, operatorKind Kind, flags OperatorPrecedenceFlags) OperatorPrecedence {
 * 	switch nodeKind {
 * 	case KindSpreadElement:
 * 		return OperatorPrecedenceSpread
 * 	case KindYieldExpression:
 * 		return OperatorPrecedenceYield
 * 	// !!! By necessity, this differs from the old compiler to better align with ParenthesizerRules. consider backporting
 * 	case KindArrowFunction:
 * 		return OperatorPrecedenceAssignment
 * 	case KindConditionalExpression:
 * 		return OperatorPrecedenceConditional
 * 	case KindBinaryExpression:
 * 		switch operatorKind {
 * 		case KindCommaToken:
 * 			return OperatorPrecedenceComma
 *
 * 		case KindEqualsToken,
 * 			KindPlusEqualsToken,
 * 			KindMinusEqualsToken,
 * 			KindAsteriskAsteriskEqualsToken,
 * 			KindAsteriskEqualsToken,
 * 			KindSlashEqualsToken,
 * 			KindPercentEqualsToken,
 * 			KindLessThanLessThanEqualsToken,
 * 			KindGreaterThanGreaterThanEqualsToken,
 * 			KindGreaterThanGreaterThanGreaterThanEqualsToken,
 * 			KindAmpersandEqualsToken,
 * 			KindCaretEqualsToken,
 * 			KindBarEqualsToken,
 * 			KindBarBarEqualsToken,
 * 			KindAmpersandAmpersandEqualsToken,
 * 			KindQuestionQuestionEqualsToken:
 * 			return OperatorPrecedenceAssignment
 *
 * 		default:
 * 			return GetBinaryOperatorPrecedence(operatorKind)
 * 		}
 * 	// TODO: Should prefix `++` and `--` be moved to the `Update` precedence?
 * 	case KindTypeAssertionExpression,
 * 		KindNonNullExpression,
 * 		KindPrefixUnaryExpression,
 * 		KindTypeOfExpression,
 * 		KindVoidExpression,
 * 		KindDeleteExpression,
 * 		KindAwaitExpression:
 * 		return OperatorPrecedenceUnary
 *
 * 	case KindPostfixUnaryExpression:
 * 		return OperatorPrecedenceUpdate
 *
 * 	// !!! By necessity, this differs from the old compiler to better align with ParenthesizerRules. consider backporting
 * 	case KindPropertyAccessExpression, KindElementAccessExpression:
 * 		if flags&OperatorPrecedenceFlagsOptionalChain != 0 {
 * 			return OperatorPrecedenceOptionalChain
 * 		}
 * 		return OperatorPrecedenceMember
 *
 * 	case KindCallExpression:
 * 		if flags&OperatorPrecedenceFlagsOptionalChain != 0 {
 * 			return OperatorPrecedenceOptionalChain
 * 		}
 * 		return OperatorPrecedenceMember
 *
 * 	// !!! By necessity, this differs from the old compiler to better align with ParenthesizerRules. consider backporting
 * 	case KindNewExpression:
 * 		if flags&OperatorPrecedenceFlagsNewWithoutArguments != 0 {
 * 			return OperatorPrecedenceLeftHandSide
 * 		}
 * 		return OperatorPrecedenceMember
 *
 * 	// !!! By necessity, this differs from the old compiler to better align with ParenthesizerRules. consider backporting
 * 	case KindTaggedTemplateExpression, KindMetaProperty, KindExpressionWithTypeArguments:
 * 		return OperatorPrecedenceMember
 *
 * 	case KindAsExpression,
 * 		KindSatisfiesExpression:
 * 		return OperatorPrecedenceRelational
 *
 * 	case KindThisKeyword,
 * 		KindSuperKeyword,
 * 		KindImportKeyword,
 * 		KindIdentifier,
 * 		KindPrivateIdentifier,
 * 		KindNullKeyword,
 * 		KindTrueKeyword,
 * 		KindFalseKeyword,
 * 		KindNumericLiteral,
 * 		KindBigIntLiteral,
 * 		KindStringLiteral,
 * 		KindArrayLiteralExpression,
 * 		KindObjectLiteralExpression,
 * 		KindFunctionExpression,
 * 		KindClassExpression,
 * 		KindRegularExpressionLiteral,
 * 		KindNoSubstitutionTemplateLiteral,
 * 		KindTemplateExpression,
 * 		KindOmittedExpression,
 * 		KindJsxElement,
 * 		KindJsxSelfClosingElement,
 * 		KindJsxFragment,
 * 		KindMissingDeclaration:
 * 		return OperatorPrecedencePrimary
 *
 * 	// !!! By necessity, this differs from the old compiler to support emit. consider backporting
 * 	case KindParenthesizedExpression:
 * 		return OperatorPrecedenceParentheses
 *
 * 	default:
 * 		return OperatorPrecedenceInvalid
 * 	}
 * }
 */
export declare function GetOperatorPrecedence(nodeKind: Kind, operatorKind: Kind, flags: OperatorPrecedenceFlags): OperatorPrecedence;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::func::GetBinaryOperatorPrecedence","kind":"func","status":"implemented","sigHash":"786a2c7a0eb8fe075e778786079b714d0cf9b55c204748435b7203b672449fbe","bodyHash":"00aec4d174fb4d7e37675cbb8441280c7c493c64ecb0bd8ead5f2bfc39d9b9bd"}
 *
 * Go source:
 * func GetBinaryOperatorPrecedence(operatorKind Kind) OperatorPrecedence {
 * 	switch operatorKind {
 * 	case KindQuestionQuestionToken:
 * 		return OperatorPrecedenceCoalesce
 * 	case KindBarBarToken:
 * 		return OperatorPrecedenceLogicalOR
 * 	case KindAmpersandAmpersandToken:
 * 		return OperatorPrecedenceLogicalAND
 * 	case KindBarToken:
 * 		return OperatorPrecedenceBitwiseOR
 * 	case KindCaretToken:
 * 		return OperatorPrecedenceBitwiseXOR
 * 	case KindAmpersandToken:
 * 		return OperatorPrecedenceBitwiseAND
 * 	case KindEqualsEqualsToken, KindExclamationEqualsToken, KindEqualsEqualsEqualsToken, KindExclamationEqualsEqualsToken:
 * 		return OperatorPrecedenceEquality
 * 	case KindLessThanToken, KindGreaterThanToken, KindLessThanEqualsToken, KindGreaterThanEqualsToken,
 * 		KindInstanceOfKeyword, KindInKeyword, KindAsKeyword, KindSatisfiesKeyword:
 * 		return OperatorPrecedenceRelational
 * 	case KindLessThanLessThanToken, KindGreaterThanGreaterThanToken, KindGreaterThanGreaterThanGreaterThanToken:
 * 		return OperatorPrecedenceShift
 * 	case KindPlusToken, KindMinusToken:
 * 		return OperatorPrecedenceAdditive
 * 	case KindAsteriskToken, KindSlashToken, KindPercentToken:
 * 		return OperatorPrecedenceMultiplicative
 * 	case KindAsteriskAsteriskToken:
 * 		return OperatorPrecedenceExponentiation
 * 	}
 * 	// -1 is lower than all other precedences.  Returning it will cause binary expression
 * 	// parsing to stop.
 * 	return OperatorPrecedenceInvalid
 * }
 */
export declare function GetBinaryOperatorPrecedence(operatorKind: Kind): OperatorPrecedence;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::func::GetLeftmostExpression","kind":"func","status":"implemented","sigHash":"3a4ba1ea1fc539a837a85cd98b16dc8baec6289eae9a145c46ff92f1b1afa46d","bodyHash":"e1334e7bc984d1ef8c8388bc37d7b6bb3b56d489a83bb2d81c237e3989f340c3"}
 *
 * Go source:
 * func GetLeftmostExpression(node *Expression, stopAtCallExpressions bool) *Expression {
 * 	for {
 * 		switch node.Kind {
 * 		case KindPostfixUnaryExpression:
 * 			node = node.AsPostfixUnaryExpression().Operand
 * 			continue
 * 		case KindBinaryExpression:
 * 			node = node.AsBinaryExpression().Left
 * 			continue
 * 		case KindConditionalExpression:
 * 			node = node.AsConditionalExpression().Condition
 * 			continue
 * 		case KindTaggedTemplateExpression:
 * 			node = node.AsTaggedTemplateExpression().Tag
 * 			continue
 * 		case KindCallExpression:
 * 			if stopAtCallExpressions {
 * 				return node
 * 			}
 * 			fallthrough
 * 		case KindAsExpression,
 * 			KindElementAccessExpression,
 * 			KindPropertyAccessExpression,
 * 			KindNonNullExpression,
 * 			KindPartiallyEmittedExpression,
 * 			KindSatisfiesExpression:
 * 			node = node.Expression()
 * 			continue
 * 		}
 * 		return node
 * 	}
 * }
 */
export declare function GetLeftmostExpression(node: GoPtr<Expression>, stopAtCallExpressions: bool): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::type::TypePrecedence","kind":"type","status":"implemented","sigHash":"7a514cd39f51350a2f2d329264b6b528b9bad316ef5949391622222a096dc01a","bodyHash":"e7bcd80456da6c1c7486881de4390a20c954281324e176d935687ef10452281d"}
 *
 * Go source:
 * TypePrecedence int32
 */
export type TypePrecedence = int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::constGroup::TypePrecedenceConditional+TypePrecedenceJSDoc+TypePrecedenceFunction+TypePrecedenceUnion+TypePrecedenceIntersection+TypePrecedenceTypeOperator+TypePrecedencePostfix+TypePrecedenceNonArray+TypePrecedenceLowest+TypePrecedenceHighest","kind":"constGroup","status":"implemented","sigHash":"8842df0ef03998708cba058b464cb567ac0f3f20276d6802116fcc727c700e2d","bodyHash":"6f9aa62c058961dcf3c2eee05135fef299da0923985c758bb5bdc65bbd7de54f"}
 *
 * Go source:
 * const (
 * 	// Conditional precedence (lowest)
 * 	//
 * 	//   Type[Extends]:
 * 	//       ConditionalTypeNode[?Extends]
 * 	//
 * 	//   ConditionalTypeNode[Extends]:
 * 	//       [~Extends] UnionTypeNode `extends` Type[+Extends] `?` Type[~Extends] `:` Type[~Extends]
 * 	//
 * 	TypePrecedenceConditional TypePrecedence = iota
 *
 * 	// JSDoc precedence (optional and variadic types)
 * 	//
 * 	//    JSDocType:
 * 	//      `...`? Type `=`?
 * 	TypePrecedenceJSDoc
 *
 * 	// Function precedence
 * 	//
 * 	//   Type[Extends]:
 * 	//       ConditionalTypeNode[?Extends]
 * 	//       FunctionTypeNode[?Extends]
 * 	//       ConstructorTypeNode[?Extends]
 * 	//
 * 	//   ConditionalTypeNode[Extends]:
 * 	//       UnionTypeNode
 * 	//
 * 	//   FunctionTypeNode[Extends]:
 * 	//       TypeParameters? ArrowParameters `=>` Type[?Extends]
 * 	//
 * 	//   ConstructorTypeNode[Extends]:
 * 	//       `abstract`? TypeParameters? ArrowParameters `=>` Type[?Extends]
 * 	//
 * 	TypePrecedenceFunction
 *
 * 	// Union precedence
 * 	//
 * 	//   UnionTypeNode:
 * 	//       `|`? UnionTypeNoBar
 * 	//
 * 	//   UnionTypeNoBar:
 * 	//       IntersectionTypeNode
 * 	//       UnionTypeNoBar `|` IntersectionTypeNode
 * 	//
 * 	TypePrecedenceUnion
 *
 * 	// Intersection precedence
 * 	//
 * 	//   IntersectionTypeNode:
 * 	//       `&`? IntersectionTypeNoAmpersand
 * 	//
 * 	//   IntersectionTypeNoAmpersand:
 * 	//       TypeOperatorNode
 * 	//       IntersectionTypeNoAmpersand `&` TypeOperatorNode
 * 	//
 * 	TypePrecedenceIntersection
 *
 * 	// TypeOperatorNode precedence
 * 	//
 * 	//   TypeOperatorNode:
 * 	//     PostfixType
 * 	//     InferTypeNode
 * 	//     `keyof` TypeOperatorNode
 * 	//     `unique` TypeOperatorNode
 * 	//     `readonly` PostfixType
 * 	//
 * 	//   InferTypeNode:
 * 	//     `infer` BindingIdentifier
 * 	//     `infer` BindingIdentifier `extends` Type[+Extends]
 * 	//
 * 	TypePrecedenceTypeOperator
 *
 * 	// Postfix precedence
 * 	//
 * 	//   PostfixType:
 * 	//       NonArrayType
 * 	//       OptionalTypeNode
 * 	//       ArrayTypeNode
 * 	//       IndexedAccessTypeNode
 * 	//
 * 	//   OptionalTypeNode:
 * 	//       PostfixType `?`
 * 	//
 * 	//   ArrayTypeNode:
 * 	//       PostfixType `[` `]`
 * 	//
 * 	//   IndexedAccessTypeNode:
 * 	//       PostfixType `[` Type[~Extends] `]`
 * 	//
 * 	TypePrecedencePostfix
 *
 * 	// NonArray precedence (highest)
 * 	//
 * 	//   NonArrayType:
 * 	//       KeywordType
 * 	//       LiteralTypeNode
 * 	//       ThisTypeNode
 * 	//       ImportType
 * 	//       TypeQueryNode
 * 	//       MappedTypeNode
 * 	//       TypeLiteralNode
 * 	//       TupleTypeNode
 * 	//       ParenthesizedTypeNode
 * 	//       TypePredicateNode
 * 	//       TypeReferenceNode
 * 	//       TemplateType
 * 	//
 * 	//   KeywordType: one of
 * 	//       `any`       `unknown` `string`    `number` `bigint`
 * 	//       `symbol`    `boolean` `undefined` `never`  `object`
 * 	//       `intrinsic` `void`
 * 	//
 * 	//   LiteralTypeNode:
 * 	//       StringLiteral
 * 	//       NoSubstitutionTemplateLiteral
 * 	//       NumericLiteral
 * 	//       BigIntLiteral
 * 	//       `-` NumericLiteral
 * 	//       `-` BigIntLiteral
 * 	//       `true`
 * 	//       `false`
 * 	//       `null`
 * 	//
 * 	//   ThisTypeNode:
 * 	//       `this`
 * 	//
 * 	//   ImportType:
 * 	//       `typeof`? `import` `(` Type[~Extends] `,`? `)` ImportTypeQualifier? TypeArguments?
 * 	//       `typeof`? `import` `(` Type[~Extends] `,` ImportTypeAttributes `,`? `)` ImportTypeQualifier? TypeArguments?
 * 	//
 * 	//   ImportTypeQualifier:
 * 	//       `.` EntityName
 * 	//
 * 	//   ImportTypeAttributes:
 * 	//       `{` `with` `:` ImportAttributes `,`? `}`
 * 	//
 * 	//   TypeQueryNode:
 * 	//
 * 	//   MappedTypeNode:
 * 	//       `{` MappedTypePrefix? MappedTypePropertyName MappedTypeSuffix? `:` Type[~Extends] `;` `}`
 * 	//
 * 	//   MappedTypePrefix:
 * 	//       `readonly`
 * 	//       `+` `readonly`
 * 	//       `-` `readonly`
 * 	//
 * 	//   MappedTypePropertyName:
 * 	//       `[` BindingIdentifier `in` Type[~Extends] `]`
 * 	//       `[` BindingIdentifier `in` Type[~Extends] `as` Type[~Extends] `]`
 * 	//
 * 	//   MappedTypeSuffix:
 * 	//       `?`
 * 	//       `+` `?`
 * 	//       `-` `?`
 * 	//
 * 	//   TypeLiteralNode:
 * 	//       `{` TypeElementList `}`
 * 	//
 * 	//   TypeElementList:
 * 	//       [empty]
 * 	//       TypeElementList TypeElement
 * 	//
 * 	//   TypeElement:
 * 	//       PropertySignatureDeclaration
 * 	//       MethodSignatureDeclaration
 * 	//       IndexSignatureDeclaration
 * 	//       CallSignatureDeclaration
 * 	//       ConstructSignatureDeclaration
 * 	//
 * 	//   PropertySignatureDeclaration:
 * 	//       PropertyName `?`? TypeAnnotation? `;`
 * 	//
 * 	//   MethodSignatureDeclaration:
 * 	//       PropertyName `?`? TypeParameters? `(` FormalParameterList `)` TypeAnnotation? `;`
 * 	//       `get` PropertyName TypeParameters? `(` FormalParameterList `)` TypeAnnotation? `;` // GetAccessorDeclaration
 * 	//       `set` PropertyName TypeParameters? `(` FormalParameterList `)` TypeAnnotation? `;` // SetAccessorDeclaration
 * 	//
 * 	//   IndexSignatureDeclaration:
 * 	//       `[` IdentifierName`]` TypeAnnotation `;`
 * 	//
 * 	//   CallSignatureDeclaration:
 * 	//       TypeParameters? `(` FormalParameterList `)` TypeAnnotation? `;`
 * 	//
 * 	//   ConstructSignatureDeclaration:
 * 	//       `new` TypeParameters? `(` FormalParameterList `)` TypeAnnotation? `;`
 * 	//
 * 	//   TupleTypeNode:
 * 	//       `[` `]`
 * 	//       `[` NamedTupleElementTypes `,`? `]`
 * 	//       `[` TupleElementTypes `,`? `]`
 * 	//
 * 	//   NamedTupleElementTypes:
 * 	//       NamedTupleMember
 * 	//       NamedTupleElementTypes `,` NamedTupleMember
 * 	//
 * 	//   NamedTupleMember:
 * 	//       IdentifierName `?`? `:` Type[~Extends]
 * 	//       `...` IdentifierName `:` Type[~Extends]
 * 	//
 * 	//   TupleElementTypes:
 * 	//       TupleElementType
 * 	//       TupleElementTypes `,` TupleElementType
 * 	//
 * 	//   TupleElementType:
 * 	//       Type[~Extends]
 * 	//       OptionalTypeNode
 * 	//       RestTypeNode
 * 	//
 * 	//   RestTypeNode:
 * 	//       `...` Type[~Extends]
 * 	//
 * 	//   ParenthesizedTypeNode:
 * 	//       `(` Type[~Extends] `)`
 * 	//
 * 	//   TypePredicateNode:
 * 	//       `asserts`? TypePredicateParameterName
 * 	//       `asserts`? TypePredicateParameterName `is` Type[~Extends]
 * 	//
 * 	//   TypePredicateParameterName:
 * 	//       `this`
 * 	//       IdentifierReference
 * 	//
 * 	//   TypeReferenceNode:
 * 	//       EntityName TypeArguments?
 * 	//
 * 	//   TemplateType:
 * 	//       TemplateHead Type[~Extends] TemplateTypeSpans
 * 	//
 * 	//   TemplateTypeSpans:
 * 	//       TemplateTail
 * 	//       TemplateTypeMiddleList TemplateTail
 * 	//
 * 	//   TemplateTypeMiddleList:
 * 	//       TemplateMiddle Type[~Extends]
 * 	//       TemplateTypeMiddleList TemplateMiddle Type[~Extends]
 * 	//
 * 	//   TypeArguments:
 * 	//       `<` TypeArgumentList `,`? `>`
 * 	//
 * 	//   TypeArgumentList:
 * 	//       Type[~Extends]
 * 	//       TypeArgumentList `,` Type[~Extends]
 * 	//
 * 	TypePrecedenceNonArray
 *
 * 	TypePrecedenceLowest  = TypePrecedenceConditional
 * 	TypePrecedenceHighest = TypePrecedenceNonArray
 * )
 */
export declare const TypePrecedenceConditional: TypePrecedence;
export declare const TypePrecedenceJSDoc: TypePrecedence;
export declare const TypePrecedenceFunction: TypePrecedence;
export declare const TypePrecedenceUnion: TypePrecedence;
export declare const TypePrecedenceIntersection: TypePrecedence;
export declare const TypePrecedenceTypeOperator: TypePrecedence;
export declare const TypePrecedencePostfix: TypePrecedence;
export declare const TypePrecedenceNonArray: TypePrecedence;
export declare const TypePrecedenceLowest: TypePrecedence;
export declare const TypePrecedenceHighest: TypePrecedence;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/precedence.go::func::GetTypeNodePrecedence","kind":"func","status":"implemented","sigHash":"47125c65cfce820cff19d4e3df24699ba8d458939db5530e5069630ffb70e197","bodyHash":"a0b697f4e54deb9eb94e805ed79690fdc05629d629975427645e511996527e35"}
 *
 * Go source:
 * func GetTypeNodePrecedence(n *TypeNode) TypePrecedence {
 * 	switch n.Kind {
 * 	case KindConditionalType:
 * 		return TypePrecedenceConditional
 * 	case KindJSDocOptionalType, KindJSDocVariadicType:
 * 		return TypePrecedenceJSDoc
 * 	case KindFunctionType, KindConstructorType:
 * 		return TypePrecedenceFunction
 * 	case KindUnionType:
 * 		return TypePrecedenceUnion
 * 	case KindIntersectionType:
 * 		return TypePrecedenceIntersection
 * 	case KindTypeOperator:
 * 		return TypePrecedenceTypeOperator
 * 	case KindInferType:
 * 		if n.AsInferTypeNode().TypeParameter.AsTypeParameterDeclaration().Constraint != nil {
 * 			// `infer T extends U` must be treated as FunctionTypeNode precedence as the `extends` clause eagerly consumes
 * 			// TypeNode
 * 			return TypePrecedenceFunction
 * 		}
 * 		return TypePrecedenceTypeOperator
 * 	case KindIndexedAccessType, KindArrayType, KindOptionalType:
 * 		return TypePrecedencePostfix
 * 	case KindTypeQuery:
 * 		// TypeQueryNode is actually a NonArrayType, but we treat it as TypeOperatorNode
 * 		// precedence so that it is parenthesized when used in a PostfixType
 * 		// context (e.g., `(typeof C)[]` instead of `typeof C[]`)
 * 		return TypePrecedenceTypeOperator
 * 	case KindAnyKeyword,
 * 		KindUnknownKeyword,
 * 		KindStringKeyword,
 * 		KindNumberKeyword,
 * 		KindBigIntKeyword,
 * 		KindSymbolKeyword,
 * 		KindBooleanKeyword,
 * 		KindUndefinedKeyword,
 * 		KindNeverKeyword,
 * 		KindObjectKeyword,
 * 		KindIntrinsicKeyword,
 * 		KindVoidKeyword,
 * 		KindJSDocAllType,
 * 		KindJSDocNullableType,
 * 		KindJSDocNonNullableType,
 * 		KindLiteralType,
 * 		KindTypePredicate,
 * 		KindTypeReference,
 * 		KindTypeLiteral,
 * 		KindTupleType,
 * 		KindRestType,
 * 		KindParenthesizedType,
 * 		KindThisType,
 * 		KindMappedType,
 * 		KindNamedTupleMember,
 * 		KindTemplateLiteralType,
 * 		KindImportType,
 * 		// These occur in pseudo-types like `f<T>.C`, where `f` is a generic function and `C` is a local type
 * 		KindPropertyAccessExpression,
 * 		KindExpressionWithTypeArguments:
 * 		return TypePrecedenceNonArray
 * 	default:
 * 		panic(fmt.Sprintf("unhandled TypeNode: %v", n.Kind))
 * 	}
 * }
 */
export declare function GetTypeNodePrecedence(n: GoPtr<TypeNode>): TypePrecedence;
//# sourceMappingURL=precedence.d.ts.map