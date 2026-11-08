import type { Node } from "@tsonic/tsts";
import type { SourceResult, SourceTypeEvidence } from "../../public/source/contracts.js";
import { sourceLiteralUnitsEqual, type SourceLiteralUnit } from "../../source-model/literals/domain.js";
import { AsCaseBlock, AsCaseOrDefaultClause, AsSwitchStatement } from "../../source-navigation/checked-casts.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";

export function createSourceSwitchCoverage(source: TargetSourceProgram): (switchStatement: Node) => SourceResult<boolean> {
  const { ast } = source;
  const { navigation, values, descriptors } = source.facts;
  const retained = new WeakMap<Node, SourceResult<boolean>>();
  const resolved = (value: boolean): SourceResult<boolean> => Object.freeze({ kind: "resolved", value });
  const units = (value: SourceTypeEvidence): readonly SourceLiteralUnit[] | undefined => {
    descriptors.assertEvidence(value);
    const selected: SourceLiteralUnit[] = [];
    for (const arm of value.sum?.arms ?? [value]) {
      descriptors.assertEvidence(arm);
      const unit = descriptors.scalarLiteral(arm);
      if (unit.kind === "none" || unit.value.kind === "absence" || unit.value.kind === "symbol") return undefined;
      if (!selected.some(previous => sourceLiteralUnitsEqual(previous, unit.value))) selected.push(unit.value);
    }
    return Object.freeze(selected);
  };
  const produce = (switchStatement: Node): SourceResult<boolean> => {
    const statement = AsSwitchStatement(ast, switchStatement);
    const block = statement?.CaseBlock;
    const clauses = block === undefined ? undefined : AsCaseBlock(ast, block)?.Clauses?.Nodes;
    if (statement?.Expression === undefined || clauses === undefined) return resolved(false);
    const discriminant = values.type(statement.Expression);
    if (discriminant.kind === "refused") return discriminant;
    const required = units(discriminant.value);
    if (required === undefined || required.length === 0) return resolved(false);
    let remaining = [...required];
    for (const clause of clauses) {
      if (clause === undefined || ast.is.IsDefaultClause(clause)) return resolved(false);
      const expression = AsCaseOrDefaultClause(ast, clause)?.Expression;
      if (expression === undefined) return resolved(false);
      const selected = values.type(expression);
      if (selected.kind === "refused") return selected;
      const cases = units(selected.value);
      if (cases?.length === 1) remaining = remaining.filter(unit => !sourceLiteralUnitsEqual(unit, cases[0]!));
    }
    return resolved(remaining.length === 0);
  };
  return switchStatement => {
    navigation.callableRoles(switchStatement);
    const previous = retained.get(switchStatement);
    if (previous !== undefined) return previous;
    const selected = produce(switchStatement);
    retained.set(switchStatement, selected);
    return selected;
  };
}
