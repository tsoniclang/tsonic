import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDescriptorInput, SourceInputTypeFacts } from "../../host-input/descriptor-input.js";
import type { SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceDescriptorBuilder, SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import {
  sourceFiniteLiteralDomain, sourceOpenLiteralDomain, sourcePresentLiteralDomain, sourceUnreachableLiteralDomain,
} from "../../source-model/literals/domain.js";
import { sourceIntegerLiteralValue } from "../../source-model/literals/integer.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "../../source-model/literals/token.js";

export function produceSourceScalarLiteralDomain(ast: AstReader, original: Node, facts: SourceInputTypeFacts): SourceLiteralDomain {
  let node = original;
  let negative = false;
  const seen = new Set<Node>();
  for (;;) {
    if (seen.has(node)) throw new Error("An original literal syntax component cannot contain a parent cycle.");
    seen.add(node);
    if (ast.is.IsLiteralTypeNode(node)) {
      const literal = ast.as.AsLiteralTypeNode(node)?.Literal;
      if (literal === undefined) throw new Error("A literal type requires its exact original literal occurrence.");
      node = literal;
      continue;
    }
    if (ast.is.IsParenthesizedTypeNode(node)) {
      const type = ast.as.AsParenthesizedTypeNode(node)?.Type;
      if (type === undefined) throw new Error("A parenthesized literal type requires its original inner type.");
      node = type;
      continue;
    }
    if (ast.is.IsPrefixUnaryExpression(node)) {
      const operator = ast.operatorKindName(node);
      if (operator !== "KindPlusToken" && operator !== "KindMinusToken") break;
      const operand = ast.as.AsPrefixUnaryExpression(node)?.Operand;
      if (operand === undefined) throw new Error("An original signed literal requires its actual operand.");
      negative = operator === "KindMinusToken" ? !negative : negative;
      node = operand;
      continue;
    }
    break;
  }
  if (ast.is.IsNumericLiteral(node)) {
    const token = sourceLiteralToken(ast, node);
    if (token.kind === "authored") {
      const value = parseSourceNumericLiteral(token.text);
      if (value === undefined) throw new Error("An original authored numeric literal requires its exact valid token.");
      return sourceFiniteLiteralDomain([{ kind: "number", value: { kind: "authored", token: { ...value.token, negative } } }]);
    }
  }
  if (ast.is.IsBigIntLiteral(node)) {
    const integer = sourceIntegerLiteralValue(ast, node);
    if (integer !== undefined) return sourceFiniteLiteralDomain([{ kind: "bigint", value: negative ? -integer : integer }]);
  }
  if (ast.is.IsStringLiteral(node) || ast.is.IsNoSubstitutionTemplateLiteral(node)) {
    return sourceFiniteLiteralDomain([{ kind: "string", value: ast.text(node) }]);
  }
  const kind = ast.kindName(node);
  if (kind === "KindTrueKeyword" || kind === "KindFalseKeyword") return sourceFiniteLiteralDomain([{ kind: "boolean", value: kind === "KindTrueKeyword" }]);
  if (kind === "KindNullKeyword") return sourceFiniteLiteralDomain([{ kind: "absence" }]);
  const literal = facts.literal;
  if (literal !== undefined) return sourceFiniteLiteralDomain([literal.kind === "number"
    ? { kind: "number", value: { kind: "checked-float64", value: literal.value } } : literal]);
  if (facts.kind === "scalar") {
    if (facts.scalar === "never") return sourceUnreachableLiteralDomain;
    if (facts.scalar === "absence" || facts.scalar === "void") return sourceFiniteLiteralDomain([{ kind: "absence" }]);
    if (facts.scalar === "number" || facts.scalar === "bigint" || facts.scalar === "boolean") return sourcePresentLiteralDomain;
  }
  return sourceOpenLiteralDomain;
}

export function createSourceLiteralDomainQueries(input: {
  readonly ast: AstReader;
  readonly input: SourceDescriptorInput;
  readonly builder: SourceDescriptorBuilder;
  readonly value: (node: Node) => SourceProductionResult<SourceTypeEvidence>;
  readonly syntaxValue: (node: Node) => SourceProductionResult<SourceTypeEvidence>;
}): {
  literalDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
  syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
} {
  return Object.freeze({
    literalDomain(node: Node): SourceProductionResult<SourceLiteralDomain> {
      const result = input.value(node);
      return result.kind === "resolved" ? { kind: "resolved", value: input.builder.domain(result.value) } : result;
    },
    syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain> {
      input.input.assertNode(node);
      const result = input.syntaxValue(node);
      return result.kind === "resolved" ? { kind: "resolved", value: input.builder.domain(result.value) } : result;
    },
  });
}
