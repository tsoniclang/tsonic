import { BinaryExpression_Left, BinaryExpression_Right, BinaryExpression_OperatorToken, Node_Expression } from "../source-model/ast.js";
import { createSourceSyntaxDomain } from "../source-navigation/node-inventory.js";
import { sourceTypeDescriptorIsAbsent } from "./descriptor-arms.js";
export function selectSourceNativeValueGuard({ ast, navigation, values }, expression) {
    const contains = createSourceSyntaxDomain(ast, expression);
    const transparent = (node) => {
        const visited = new Set();
        while (node !== undefined) {
            if (!contains(node) || visited.has(node))
                return undefined;
            visited.add(node);
            if (!ast.is.IsParenthesizedExpression(node) && !ast.is.IsSatisfiesExpression(node) && !ast.is.IsNonNullExpression(node))
                return node;
            node = Node_Expression(ast, node);
        }
        return undefined;
    };
    const left = transparent(BinaryExpression_Left(ast, expression));
    const right = transparent(BinaryExpression_Right(ast, expression));
    const token = BinaryExpression_OperatorToken(ast, expression);
    if (left === undefined || right === undefined || token === undefined)
        return undefined;
    const operator = ast.kindName(token);
    if (operator === "KindInstanceOfKeyword") {
        const declaration = navigation.sourceReferenceFor(right)?.declaration;
        return declaration === undefined ? undefined : Object.freeze({ kind: "nominal", sourceOperand: left, sourceConstructor: right, declaration });
    }
    const equal = operator === "KindEqualsEqualsEqualsToken" || operator === "KindEqualsEqualsToken";
    const different = operator === "KindExclamationEqualsEqualsToken" || operator === "KindExclamationEqualsToken";
    if (!equal && !different)
        return undefined;
    for (const [sourceOperand, absent] of [[left, right], [right, left]]) {
        if (ast.kindName(absent) === "KindNullKeyword") {
            return Object.freeze({ kind: "absence", sourceOperand, negated: different });
        }
        if (ast.is.IsIdentifier(absent) && absenceValue(values, absent)) {
            return Object.freeze({ kind: "absence", sourceOperand, negated: different });
        }
    }
    for (const [value, category] of [[left, right], [right, left]]) {
        if (!ast.is.IsTypeOfExpression(value) || !ast.is.IsStringLiteral(category))
            continue;
        const sourceOperand = transparent(Node_Expression(ast, value));
        if (sourceOperand !== undefined)
            return Object.freeze({ kind: "typeof", sourceOperand,
                value: ast.text(category), negated: different });
    }
    if (operator === "KindEqualsEqualsEqualsToken" || operator === "KindExclamationEqualsEqualsToken") {
        for (const [sourceOperand, literal] of [[left, right], [right, left]]) {
            const category = ast.is.IsStringLiteral(literal) || ast.kindName(literal) === "KindNoSubstitutionTemplateLiteral" ? "string"
                : ast.is.IsNumericLiteral(literal) ? "number"
                    : ast.is.IsBigIntLiteral(literal) ? "bigint"
                        : ast.kindName(literal) === "KindTrueKeyword" || ast.kindName(literal) === "KindFalseKeyword" ? "boolean" : undefined;
            if (category !== undefined)
                return Object.freeze({ kind: "literal", sourceOperand, category, negated: different });
        }
    }
    return undefined;
}
/**
 * Whether an identifier operand is the absence value: its Host descriptor (R3: never the checked type) is the absence
 * value: every arm of its Host descriptor is absence (`undefined`, or a binding whose Host type is exactly null/undefined/void;
 * the one Host classifier, descriptor-arms.ts).
 */
function absenceValue(values, operand) {
    const outcome = values.type(operand);
    if (outcome.kind === "refused")
        return false;
    return sourceTypeDescriptorIsAbsent(outcome.type);
}
//# sourceMappingURL=native-value-guards.js.map