import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import { createSourceIntegerConstantReader } from "./integer-constant.js";
import { sourceIntegerLiteralValue } from "./integer-literal.js";
import type {
  SourceLiteralIndex,
  SourceLiteralValue,
  SourceScalarLiteralValue,
} from "./literal-values-model.js";
import { parseFiniteNumberLiteral } from "./literal-text.js";

export function analyzeSourceLiteralValues(
  ast: AstReader,
  sourceFiles: readonly SourceFile[],
): SourceLiteralIndex {
  const values = new WeakMap<Node, SourceLiteralValue>();
  const integerConstantOf = createSourceIntegerConstantReader(ast, (node) => values.get(node)?.integer);
  const pending: { readonly node: Node; readonly finish: boolean }[] = [];
  for (const sourceFile of sourceFiles) {
    pending.push({ node: sourceFile, finish: false });
    while (pending.length > 0) {
      const entry = pending.pop()!;
      if (entry.finish) {
        const value = extract(entry.node);
        if (value !== undefined) values.set(entry.node, value);
        continue;
      }
      pending.push({ node: entry.node, finish: true });
      const children: Node[] = [];
      ast.forEachChild(entry.node, (child) => {
        if (child !== undefined) children.push(child);
      });
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push({ node: children[index]!, finish: false });
      }
    }
  }
  return Object.freeze({ literalValue: Object.freeze({ get: (node: Node) => values.get(node) }) });

  function extract(node: Node): SourceLiteralValue | undefined {
    if (ast.is.IsStringLiteral(node)) return Object.freeze({ form: "string", text: ast.text(node) });
    if (ast.is.IsNoSubstitutionTemplateLiteral(node)) return Object.freeze({ form: "template", text: ast.text(node) });
    const kind = ast.kindName(node);
    if (kind === "KindTrueKeyword") return scalar("true", {});
    if (kind === "KindFalseKeyword") return scalar("false", {});
    if (ast.is.IsNumericLiteral(node)) {
      return scalar("numeric", { number: parseFiniteNumberLiteral(ast.text(node)), integer: sourceIntegerLiteralValue(ast, node) });
    }
    if (ast.is.IsBigIntLiteral(node)) return scalar("bigint", { integer: sourceIntegerLiteralValue(ast, node) });
    if (ast.is.IsPrefixUnaryExpression(node)) {
      const operator = ast.operatorKindName(node);
      const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
      const signed = operand !== undefined && (operator === "KindPlusToken" || operator === "KindMinusToken")
        ? values.get(operand) : undefined;
      const literal = signed?.form === "numeric" || signed?.form === "bigint" || signed?.form === "prefix-unary" ||
        signed?.number !== undefined || signed?.integer !== undefined;
      const negative = operator === "KindMinusToken";
      return !literal ? undefined : scalar("prefix-unary", {
        number: signed?.number === undefined ? undefined : negative ? -signed.number : signed.number,
        integer: signed?.integer === undefined ? undefined : negative ? -signed.integer : signed.integer,
      });
    }
    if (ast.is.IsParenthesizedExpression(node)) {
      const inner = ast.as.AsParenthesizedExpression(node)?.Expression;
      const enclosed = inner === undefined ? undefined : values.get(inner);
      const integerConstant = integerConstantOf(node);
      return enclosed?.number === undefined && enclosed?.integer === undefined && integerConstant === undefined ? undefined
        : scalar("parenthesized", { number: enclosed?.number, integer: enclosed?.integer, integerConstant });
    }
    if (ast.is.IsBinaryExpression(node)) {
      const integerConstant = integerConstantOf(node);
      return integerConstant === undefined ? undefined : scalar("binary", { integerConstant });
    }
    if (ast.is.IsArrayLiteralExpression(node)) {
      return Object.freeze({ form: "array", elements: Object.freeze(ast.elements(node).map((element) =>
        element === undefined ? undefined : values.get(element))) });
    }
    return undefined;
  }
}

function scalar(
  form: SourceScalarLiteralValue["form"],
  fields: {
    readonly number?: number | undefined;
    readonly integer?: bigint | undefined;
    readonly integerConstant?: bigint | undefined;
  },
): SourceScalarLiteralValue {
  return Object.freeze({
    form,
    ...(fields.number === undefined ? {} : { number: fields.number }),
    ...(fields.integer === undefined ? {} : { integer: fields.integer }),
    ...(fields.integerConstant === undefined ? {} : { integerConstant: fields.integerConstant }),
  });
}
