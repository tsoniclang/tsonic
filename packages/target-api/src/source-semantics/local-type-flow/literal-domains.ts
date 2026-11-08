import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDescriptorInput, SourceInputTypeFacts } from "../../host-input/descriptor-input.js";
import type { SourceTypeBinding, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceDescriptorBuilder, SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceLiteralDomain } from "../../source-model/literals/domain.js";
import {
  sourceFiniteLiteralDomain, sourceLiteralDomainUnion, sourceOpenLiteralDomain, sourcePresentLiteralDomain, sourceUnreachableLiteralDomain,
} from "../../source-model/literals/domain.js";
import { sourceIntegerLiteralValue } from "../../source-model/literals/integer.js";
import { parseSourceNumericLiteral, sourceLiteralToken } from "../../source-model/literals/token.js";
import { sourceTypeFlowTypeSyntax } from "./value-syntax.js";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { sourceProductionValues } from "./semantic-production.js";

function sourceOriginalLiteralDomain(ast: AstReader, original: Node): SourceLiteralDomain | undefined {
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
  if (ast.is.IsObjectLiteralExpression(node) || ast.is.IsArrayLiteralExpression(node) || ast.is.IsNewExpression(node) ||
    ast.is.IsArrowFunction(node) || ast.is.IsFunctionExpression(node) || ast.is.IsFunctionDeclaration(node)) return sourcePresentLiteralDomain;
  return undefined;
}

export function produceSourceScalarLiteralDomain(ast: AstReader, original: Node, facts: SourceInputTypeFacts): SourceLiteralDomain {
  const originalDomain = sourceOriginalLiteralDomain(ast, original);
  if (originalDomain !== undefined) return originalDomain;
  const literal = facts.literal;
  if (literal !== undefined) return sourceFiniteLiteralDomain([literal.kind === "number"
    ? { kind: "number", value: { kind: "checked-float64", value: literal.value } } : literal]);
  if (facts.kind === "scalar") {
    if (facts.scalar === "never") return sourceUnreachableLiteralDomain;
    if (facts.scalar === "absence" || facts.scalar === "void") return sourceFiniteLiteralDomain([{ kind: "absence" }]);
    if (facts.scalar === "number" || facts.scalar === "bigint" || facts.scalar === "boolean" || facts.scalar === "string") return sourcePresentLiteralDomain;
  }
  return sourceOpenLiteralDomain;
}

export function produceSourceComponentLiteralDomain(context: {
  readonly ast: AstReader;
  readonly input: SourceDescriptorInput;
  readonly builder: SourceDescriptorBuilder;
  value(node: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  component(original: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
}, original: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain> {
  const { ast, input, builder } = context;
  input.assertComponent(original);
  const facts = input.describe(original);
  if (original.path.length === 0) {
    const parent = ast.parent(original.root);
    if (parent !== undefined && ast.name(parent) === original.root &&
      (ast.is.IsPropertyDeclaration(parent) || ast.is.IsPropertySignatureDeclaration(parent) ||
        ast.is.IsPropertyAssignment(parent) || ast.is.IsMethodDeclaration(parent) || ast.is.IsMethodSignatureDeclaration(parent) ||
        ast.is.IsGetAccessorDeclaration(parent) || ast.is.IsSetAccessorDeclaration(parent))) {
      if (ast.is.IsIdentifier(original.root)) return { kind: "resolved", value: sourceFiniteLiteralDomain([{ kind: "string", value: ast.text(original.root) }]) };
    }
    if (ast.is.IsComputedPropertyName(original.root)) {
      const expression = ast.as.AsComputedPropertyName(original.root)?.Expression;
      if (expression === undefined) throw new Error("An original computed name requires its exact original expression.");
      return produceSourceComponentLiteralDomain(context, input.syntax(expression), bindings);
    }
  }
  if (facts.kind === "parameter") {
    const bound = bindings.find(binding => binding.declaration === facts.parameter);
    return { kind: "resolved", value: bound === undefined ? sourceOpenLiteralDomain : builder.domain(bound.value) };
  }
  const syntax = facts.authoredTypeNode ?? (original.path.length === 0 ? original.root : undefined);
  if (syntax !== undefined && sourceTypeFlowTypeSyntax(ast, syntax)) {
    if (facts.kind === "union") {
      const values = sourceProductionValues(facts.members.map(member => produceSourceComponentLiteralDomain(context, member, bindings)));
      return values.kind !== "resolved" ? values : { kind: "resolved", value: sourceLiteralDomainUnion(values.value) };
    }
    if (facts.kind === "scalar") return { kind: "resolved", value: produceSourceScalarLiteralDomain(ast, syntax, facts) };
  }
  if (original.path.length === 0) {
    const literal = sourceOriginalLiteralDomain(ast, original.root);
    if (literal !== undefined) return { kind: "resolved", value: literal };
  }
  const part = original.path[original.path.length - 1];
  if (part?.kind === "member" && (ast.is.IsPropertyAssignment(part.declaration) || ast.is.IsPropertyDeclaration(part.declaration))) {
    const initializer = Node_Initializer(ast, part.declaration);
    if (initializer !== undefined && ast.is.IsObjectLiteralExpression(original.root))
      return produceSourceComponentLiteralDomain(context, input.syntax(initializer), bindings);
  }
  const produced = original.path.length === 0 && !sourceTypeFlowTypeSyntax(ast, original.root)
    ? context.value(original.root, bindings) : context.component(original, bindings);
  return produced.kind !== "resolved" ? produced : { kind: "resolved", value: builder.domain(produced.value) };
}

export function createSourceLiteralDomainQueries(input: {
  readonly ast: AstReader;
  readonly input: SourceDescriptorInput;
  readonly builder: SourceDescriptorBuilder;
  readonly value: (node: Node, bindings: readonly SourceTypeBinding[]) => SourceProductionResult<SourceTypeEvidence>;
  readonly syntaxValue: (node: Node, bindings: readonly SourceTypeBinding[]) => SourceProductionResult<SourceTypeEvidence>;
  readonly component: (component: SourceInputComponent, bindings: readonly SourceTypeBinding[]) => SourceProductionResult<SourceTypeEvidence>;
}): {
  literalDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
  syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain>;
} {
  return Object.freeze({
    literalDomain(node: Node): SourceProductionResult<SourceLiteralDomain> {
      const result = input.value(node, []);
      return result.kind === "resolved" ? { kind: "resolved", value: input.builder.domain(result.value) } : result;
    },
    syntaxDomain(node: Node): SourceProductionResult<SourceLiteralDomain> {
      input.input.assertNode(node);
      return produceSourceComponentLiteralDomain({ ast: input.ast, input: input.input, builder: input.builder,
        value: input.syntaxValue, component: input.component }, input.input.syntax(node), []);
    },
  });
}
