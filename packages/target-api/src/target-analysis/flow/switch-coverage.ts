import type { Node } from "@tsonic/tsts";
import { AsCaseBlock, AsCaseOrDefaultClause, AsSwitchStatement } from "../../source-navigation/checked-casts.js";
import type { SourceLiteralValue } from "../../source-semantics/literal-values-model.js";
import { sourceTypeDescriptorStructure } from "../../source-semantics/local-type-flow/terms.js";
import { sourceAnalysisValueType, type SourceAnalysisProgram } from "../analysis-program.js";

/**
 * Answers whether a switch statement without a default clause selects a case for every value its discriminant can
 * hold. The discriminant's units come from the Host (I3): a `boolean` Host type has the units true/false; an enum Host
 * type has one unit per enum member; otherwise the authored annotation of the discriminant's declaration (through type
 * aliases) must be a union of literal types (string, number, bigint or boolean). Each case contributes the unit of its
 * literal value or the enum member it references. Anything else is not proven covered, so the switch keeps its
 * normal fallthrough exit. Flow narrowing of the discriminant is not applied (the declared units are used).
 */
export function createSourceSwitchCoverage(source: SourceAnalysisProgram): (switchStatement: Node) => boolean {
  const { ast, navigation } = source;
  const literalKey = (literal: SourceLiteralValue | undefined): string | undefined => {
    if (literal === undefined) return undefined;
    if (literal.form === "string" || literal.form === "template") return `string:${literal.text}`;
    if (literal.form === "true" || literal.form === "false") return `boolean:${literal.form === "true"}`;
    if (literal.form === "bigint" || literal.form === "prefix-unary" && literal.number === undefined && literal.integer !== undefined)
      return literal.integer === undefined ? undefined : `bigint:${literal.integer}`;
    if (literal.form === "numeric" || literal.form === "prefix-unary") {
      // Strict equality, which a case uses, does not distinguish 0 and -0.
      return literal.number === undefined ? undefined : `number:${literal.number === 0 ? 0 : literal.number}`;
    }
    return undefined;
  };
  const enumUnits = (declaration: Node): Set<string> => new Set(ast.members(declaration)
    .filter((member): member is Node => member !== undefined).map(member => enumKey(member)));
  const enumKeys = new WeakMap<Node, string>();
  let nextEnumKey = 0;
  const enumKey = (member: Node): string => {
    let key = enumKeys.get(member);
    if (key === undefined) { key = `enum:${nextEnumKey++}`; enumKeys.set(member, key); }
    return key;
  };
  const authoredUnits = (typeNode: Node | undefined, depth: number): Set<string> | undefined => {
    if (typeNode === undefined || depth > 32) return undefined;
    if (ast.is.IsParenthesizedTypeNode(typeNode)) return authoredUnits(ast.as.AsParenthesizedTypeNode(typeNode)?.Type, depth + 1);
    if (ast.is.IsUnionTypeNode(typeNode)) {
      const units = new Set<string>();
      for (const member of ast.as.AsUnionTypeNode(typeNode)?.Types?.Nodes ?? []) {
        const selected = authoredUnits(member, depth + 1);
        if (selected === undefined) return undefined;
        for (const unit of selected) units.add(unit);
      }
      return units;
    }
    if (ast.is.IsLiteralTypeNode(typeNode)) {
      const literal = ast.as.AsLiteralTypeNode(typeNode)?.Literal;
      const key = literal === undefined ? undefined : literalKey(source.facts.values.literal(literal));
      return key === undefined ? undefined : new Set([key]);
    }
    if (ast.is.IsTypeReferenceNode(typeNode)) {
      const reference = ast.as.AsTypeReferenceNode(typeNode);
      if (reference?.TypeArguments !== undefined || reference?.TypeName === undefined) return undefined;
      const declaration = navigation.declarationFor(reference.TypeName);
      if (declaration === undefined) return undefined;
      if (ast.is.IsEnumDeclaration(declaration)) return enumUnits(declaration);
      if (ast.is.IsTypeAliasDeclaration(declaration) && ast.typeParameters(declaration).length === 0)
        return authoredUnits(ast.as.AsTypeAliasDeclaration(declaration)?.Type, depth + 1);
    }
    return undefined;
  };
  const discriminantUnits = (expression: Node): Set<string> | undefined => {
    const type = sourceAnalysisValueType(source, expression);
    const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
    if (structure?.kind === "primitive" && structure.primitive === "bool") return new Set(["boolean:true", "boolean:false"]);
    if (structure?.kind === "declared" && ast.is.IsEnumDeclaration(structure.declaration)) return enumUnits(structure.declaration);
    const declaration = navigation.declarationFor(expression);
    return declaration === undefined ? undefined : authoredUnits(ast.typeNode(declaration), 0);
  };
  const caseKey = (expression: Node): string | undefined => {
    const literal = literalKey(source.facts.values.literal(expression));
    if (literal !== undefined) return literal;
    const declaration = navigation.declarationFor(expression);
    return declaration !== undefined && ast.is.IsEnumMember(declaration) ? enumKey(declaration) : undefined;
  };
  return (switchStatement) => {
    const statement = AsSwitchStatement(ast, switchStatement);
    const block = statement?.CaseBlock;
    const clauses = block === undefined ? undefined : AsCaseBlock(ast, block)?.Clauses?.Nodes;
    if (statement?.Expression === undefined || clauses === undefined) return false;
    const required = discriminantUnits(statement.Expression);
    if (required === undefined || required.size === 0) return false;
    for (const clause of clauses) {
      if (clause === undefined || ast.is.IsDefaultClause(clause)) return false;
      const expression = AsCaseOrDefaultClause(ast, clause)?.Expression;
      const key = expression === undefined ? undefined : caseKey(expression);
      if (key !== undefined) required.delete(key);
    }
    return required.size === 0;
  };
}
