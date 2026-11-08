import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceDescriptorView, SourcePresence, SourceTypeBinding, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceLiteralKey } from "../source-model/literals/key.js";
import type { SourceLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceProductionResult } from "../source-model/production.js";
import type { SourceConstructionMemberContribution, SourceConstructionMemberReducers, SourceConstructionMembers,
  SourceIndexInventoryRow, SourceMemberInventoryQueries, SourceMemberInventoryRow } from "./member-inventory.js";

export function createSourceConstructionMemberQuery(input: {
  readonly ast: AstReader;
  readonly view: SourceDescriptorView;
  readonly inventory: SourceMemberInventoryQueries;
  assertNode(node: Node): void;
  key(value: SourceLiteralKey): string | Node;
}): (occurrence: Node, before: Node, reducers: SourceConstructionMemberReducers) => SourceProductionResult<SourceConstructionMembers> {
  const { ast, view, inventory, assertNode, key } = input;
  interface Alternative {
    readonly rows: readonly SourceMemberInventoryRow[];
    readonly contributions: readonly SourceConstructionMemberContribution[];
  }
  interface Group {
    readonly key: SourceLiteralKey;
    readonly name: string;
    readonly alternatives: readonly Alternative[];
    readonly optional: boolean;
  }
  const frozen = <Value>(values: readonly Value[]): readonly Value[] => Object.freeze([...values]);
  const unique = <Value>(values: readonly Value[]): readonly Value[] => frozen([...new Set(values)]);
  function copied(row: SourceMemberInventoryRow): SourceMemberInventoryRow {
    return Object.freeze({ ...row, readonly: false, read: "property", getters: frozen([]), setters: frozen([]),
      writeType: row.readType });
  }
  function prototype(row: SourceMemberInventoryRow): boolean {
    return row.origins.some(origin => origin.kind === "class-prototype") || row.declarations.length > 0 && row.declarations.every(declaration => {
      const owner = ast.parent(declaration);
      return owner !== undefined && (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) &&
        (ast.is.IsMethodDeclaration(declaration) || ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration));
    });
  }
  return (occurrence, before, reducers) => {
    assertNode(occurrence);
    assertNode(before);
    const history = inventory.constructionHistory(occurrence);
    if (history.kind !== "resolved") return history;
    if (history.value.occurrence !== occurrence) throw new Error("Construction selection requires its exact authenticated original history.");
    const boundary = before === occurrence ? history.value.steps.length : history.value.steps.findIndex(step => step.evaluation === before);
    if (boundary < 0) throw new Error("A construction prefix requires an actual original evaluation boundary.");
    const order = new Map(history.value.steps.map((step, index) => [step.evaluation, index]));
    const groups = new Map<string | Node, Group>();
    const indexes: SourceIndexInventoryRow[] = [];
    for (const step of history.value.steps.slice(0, boundary)) {
      assertNode(step.evaluation);
      if (step.kind === "own") {
        const row = step.member;
        const identity = key(row.key);
        const previous = groups.get(identity);
        const contribution = Object.freeze({ kind: "own" as const, evaluation: step.evaluation, declarations: row.declarations });
        const own: Alternative = { rows: [row], contributions: [contribution] };
        const accessor = row.getters.length > 0 || row.setters.length > 0;
        const alternatives: Alternative[] = [];
        if (accessor && previous !== undefined) {
          for (const alternative of previous.alternatives) {
            const retained = alternative.rows.filter(original => original.read === "accessor" || original.getters.length > 0 || original.setters.length > 0)
              .filter(original => row.getters.length > 0 ? original.setters.length > 0 : original.getters.length > 0);
            const contributions = alternative.contributions.filter(original => original.kind === "own" &&
              original.declarations.some(declaration => retained.some(row => row.declarations.includes(declaration))));
            alternatives.push({ rows: [...retained, row], contributions: [...contributions, contribution] });
          }
          if (previous.optional) alternatives.push(own);
        } else alternatives.push(own);
        groups.set(identity, { key: row.key, name: row.name, alternatives: frozen(alternatives), optional: false });
        continue;
      }
      assertNode(step.operand);
      const source = step.source();
      if (source.kind !== "resolved") return source;
      view.assertEvidence(source.value);
      const arms = source.value.sum?.arms ?? [source.value];
      const candidates = new Map<string | Node, { readonly key: SourceLiteralKey; readonly name: string;
        readonly rows: { readonly receiver: SourceTypeEvidence; readonly member: SourceMemberInventoryRow }[]; readonly definite: Set<number> }>();
      for (const [index, arm] of arms.entries()) {
        view.assertEvidence(arm);
        const selected = inventory.members(arm);
        if (selected.kind !== "resolved") return selected;
        if (selected.value.kind !== "complete") return { kind: "resolved", value: { kind: "unavailable" } };
        for (const row of selected.value.members) {
          if (prototype(row) || step.excluded.some(excluded => key(excluded) === key(row.key))) continue;
          const identity = key(row.key);
          let group = candidates.get(identity);
          if (group === undefined) { group = { key: row.key, name: row.name, rows: [], definite: new Set() }; candidates.set(identity, group); }
          group.rows.push({ receiver: arm, member: row });
          if (!row.optional) group.definite.add(index);
        }
        indexes.push(...selected.value.indexes.map(row => Object.freeze({ ...row, readonly: false, writeType: row.readType })));
      }
      for (const [identity, candidate] of candidates) {
        const definite = candidate.definite.size === arms.length;
        const previous = groups.get(identity);
        const alternatives: Alternative[] = definite ? [] : [...previous?.alternatives ?? []];
        for (const original of candidate.rows) alternatives.push({ rows: [copied(original.member)], contributions: [Object.freeze({
          kind: "copy", evaluation: step.evaluation, operand: step.operand, receiver: original.receiver, member: original.member, definite })] });
        groups.set(identity, { key: candidate.key, name: candidate.name, alternatives: frozen(alternatives),
          optional: !definite && (previous === undefined || previous.optional) });
      }
    }
    const members: { readonly member: SourceMemberInventoryRow; readonly contributions: readonly SourceConstructionMemberContribution[] }[] = [];
    for (const group of groups.values()) {
      const rows = unique(group.alternatives.flatMap(alternative => alternative.rows));
      const contributions = unique(group.alternatives.flatMap(alternative => alternative.contributions))
        .slice().sort((left, right) => order.get(left.evaluation)! - order.get(right.evaluation)!);
      const reduce = (role: "readType" | "writeType"): SourceProductionResult<SourcePresence<SourceTypeEvidence>> => {
        const values: SourceTypeEvidence[] = [];
        for (const alternative of group.alternatives) {
          const selected: SourceTypeEvidence[] = [];
          for (const row of alternative.rows) {
            const current = row[role]();
            if (current.kind !== "resolved") return current;
            if (current.value.kind === "present") { view.assertEvidence(current.value.value); selected.push(current.value.value); }
          }
          if (selected.length === 0) return { kind: "resolved", value: { kind: "none" } };
          values.push(...selected);
        }
        const selected = reducers.read(occurrence, frozen(values));
        return selected.kind !== "resolved" ? selected : { kind: "resolved", value: { kind: "present", value: selected.value } };
      };
      const member: SourceMemberInventoryRow = Object.freeze({ key: group.key, name: group.name,
        declarations: unique(rows.flatMap(row => row.declarations)), origins: frozen(rows.flatMap(row => row.origins)),
        readOrigins: frozen(rows.flatMap(row => row.readOrigins)), writeOrigins: frozen(rows.flatMap(row => row.writeOrigins)),
        getters: unique(rows.flatMap(row => row.getters)), setters: unique(rows.flatMap(row => row.setters)),
        read: rows.some(row => row.read !== "unavailable") ? rows.some(row => row.read === "accessor") ? "accessor"
          : rows.every(row => row.read === "method") ? "method" : "property" : "unavailable",
        optional: group.optional, readonly: group.alternatives.some(alternative => alternative.rows.every(row => row.readonly)),
        readType: () => reduce("readType"), writeType: () => reduce("writeType"),
        readDomain(bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain> {
          const values: SourceLiteralDomain[] = [];
          for (const row of rows) if (row.read !== "unavailable") {
            const selected = row.readDomain(bindings);
            if (selected.kind !== "resolved") return selected;
            values.push(selected.value);
          }
          return { kind: "resolved", value: reducers.domain(frozen(values)) };
        } });
      members.push(Object.freeze({ member, contributions: frozen(contributions) }));
    }
    return { kind: "resolved", value: Object.freeze({ kind: "complete", inventory: Object.freeze({ kind: "complete",
      members: frozen(members.map(value => value.member)), indexes: frozen(indexes) }), members: frozen(members) }) };
  };
}
