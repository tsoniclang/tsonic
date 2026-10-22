import type { Node, Type } from "@tsonic/tsts";
import { AsCaseBlock, AsCaseOrDefaultClause, AsSwitchStatement } from "../../source-navigation/checked-casts.js";
import type { SourceFinalTypeQueries, TargetSourceProgram } from "../../source-semantics/types.js";

/**
 * Answers whether a switch statement without a default clause selects a case for every value its discriminant can
 * hold: the checked discriminant type is a union of literal unit types (string, number, bigint or boolean literals)
 * and every unit equals the checked type of some case expression. Anything else, including a discriminant with a
 * non-literal member, is not proven covered, so the switch keeps its normal fallthrough exit.
 */
export function createSourceSwitchCoverage(source: TargetSourceProgram): (switchStatement: Node) => boolean {
  const { ast } = source;
  return (switchStatement) => {
    const statement = AsSwitchStatement(ast, switchStatement);
    const block = statement?.CaseBlock;
    const clauses = block === undefined ? undefined : AsCaseBlock(ast, block)?.Clauses?.Nodes;
    if (statement?.Expression === undefined || clauses === undefined) return false;
    const types = source.semantics.forNode(switchStatement).types;
    const discriminant = types.expressionType(statement.Expression);
    if (discriminant === undefined) return false;
    const members = types.isUnion(discriminant) ? types.unionOrIntersectionTypes(discriminant) : [discriminant];
    const required = new Set<string>();
    for (const member of members) {
      const key = literalUnitKey(types, member);
      if (key === undefined) return false;
      required.add(key);
    }
    for (const clause of clauses) {
      if (clause === undefined || ast.is.IsDefaultClause(clause)) return false;
      const expression = AsCaseOrDefaultClause(ast, clause)?.Expression;
      const caseType = expression === undefined ? undefined : types.expressionType(expression);
      const key = caseType === undefined ? undefined : literalUnitKey(types, caseType);
      if (key !== undefined) required.delete(key);
    }
    return required.size === 0;
  };
}

function literalUnitKey(types: SourceFinalTypeQueries, type: Type): string | undefined {
  const text = types.stringLiteralValue(type);
  if (text !== undefined) return `string:${text}`;
  const numeric = types.numericLiteralValue(type);
  if (typeof numeric === "bigint") return `bigint:${numeric}`;
  // Strict equality, which a case uses, does not distinguish 0 and -0.
  if (numeric !== undefined) return `number:${numeric === 0 ? 0 : numeric}`;
  const truth = types.booleanLiteralValue(type);
  return truth === undefined ? undefined : `boolean:${truth}`;
}
