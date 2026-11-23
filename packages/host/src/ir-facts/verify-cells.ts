import type { Violation } from "../diag/contract.js";
import type { DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Execution } from "../ir-types/contract.js";
import { executionKey } from "../ir-types/index.js";
import type { MirBody, MirStatement } from "../ir-mir/contract.js";
import type { FactsRule, FactsSite, FactsVerification, FactsVerificationContext, MirPoint, RelationalArena, RelationalOwner,
  RelationalSite, StableReference } from "./contract.js";
import { collectStorageChecks, nodeOwnedBy, validIndex } from "./verify-relations.js";
import { sameSource } from "./verify-position.js";
import { admitExecutionIdentity, recordFinding, selectedMirBody } from "./verification.js";

export function verifyCells(arena: RelationalArena, owner: RelationalOwner,
  context: FactsVerificationContext, account: DataflowAccount): FactsVerification<FactsRule> {
  const initial = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
  if (initial !== null) return initial;
  const violations: Violation<FactsRule, FactsSite>[] = [];
  const execution = owner.kind === "body" ? owner.execution : owner.key.kind === "body" ? owner.key.execution : null;
  if (execution !== null) {
    const stop = admitExecutionIdentity(execution, account);
    if (stop !== null) return stop;
  }
  const selectedKey = execution === null ? null : executionKey(execution);
  const bodies = new Map<string, MirBody | null>();
  const body = (selected: Execution): DataflowResult<MirBody | null> => {
    const stop = admitExecutionIdentity(selected, account);
    if (stop !== null) return stop;
    const key = executionKey(selected);
    if (selectedKey === null || key !== selectedKey) return { kind: "complete", value: null };
    const known = bodies.get(key);
    if (known !== undefined) return { kind: "complete", value: known };
    const selectedBody = selectedMirBody(selected, context, account);
    if (selectedBody.kind !== "complete") return selectedBody;
    const growth = chargeResultEntries(account, 1);
    if (growth !== null) return growth;
    bodies.set(key, selectedBody.value);
    return selectedBody;
  };
  const statement = (selected: Execution, point: MirPoint): DataflowResult<MirStatement | null> => {
    const selectedBody = body(selected);
    if (selectedBody.kind !== "complete") return selectedBody;
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const mir = selectedBody.value;
    const block = mir !== null && validIndex(point.block, mir.blocks.length) ? mir.blocks[point.block] : undefined;
    return { kind: "complete", value: block !== undefined && block.id === point.block && point.statement !== null
      && validIndex(point.statement, block.statements.length) ? block.statements[point.statement] ?? null : null };
  };
  for (const [index, cell] of arena.cells.entries()) {
    const step = chargeWork(account, 1);
    if (step !== null) return step;
    const site: FactsSite = { kind: "cell", owner, cell: index };
    const report = (rule: FactsRule, text: string): DataflowStop | null => recordFinding(account, violations, "last", rule, site, text);
    if (cell === undefined || !Object.is(cell.id, index)) {
      const stop = report("cell-id-dense", "Logical cell IDs equal their dense positions in this exact arena.");
      if (stop !== null) return stop;
      if (cell === undefined) continue;
    }
    const checkSite = (at: RelationalSite): DataflowStop | null => {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      if (at.kind === "node") return !context.nodeExists(at.node) || !nodeOwnedBy(owner, at.node, context)
        ? report("cell-occurrence-resolves", "A cell retains its actual qualified declaration/source occurrence.") : null;
      const count = context.declaredSiteCount(at.identity);
      return !context.libraryExportExists(at.identity) || count === null || !validIndex(at.site, count)
        ? report("cell-occurrence-resolves", "A declared cell retains an actual admitted native logical site.") : null;
    };
    const occurrence = cell.occurrence;
    const role = cell.role;
    if (role.kind === "static") {
      let matches = false;
      if (occurrence.kind === "declared" && occurrence.at.kind === "node") {
        const admission = chargeWork(account, 1 + role.declaration.definition.length);
        if (admission !== null) return admission;
        const declaration = context.declarationSourceOf(role.declaration.definition);
        const lookupStop = accountFailure(account);
        if (lookupStop !== null) return lookupStop;
        if (declaration !== null) {
          const equal = sameSource(occurrence.at.node, declaration, account);
          if (equal.kind !== "complete") return equal;
          if (equal.value) {
            const read = chargeWork(account, 1);
            if (read !== null) return read;
            matches = context.nodeExists(declaration);
            const nodeStop = accountFailure(account);
            if (nodeStop !== null) return nodeStop;
          }
        }
      }
      if (!matches) {
        const stop = report("cell-occurrence-resolves", "A static cell retains the exact source occurrence of its qualified declaration.");
        if (stop !== null) return stop;
      }
    } else if (occurrence.kind === "declared") {
      const stop = checkSite(occurrence.at);
      if (stop !== null) return stop;
    } else if (occurrence.kind === "entry") {
      const selected = body(occurrence.execution);
      if (selected.kind !== "complete") return selected;
      const mir = selected.value;
      const local = mir !== null && validIndex(occurrence.local, mir.locals.length) ? mir.locals[occurrence.local] : undefined;
      if (local === undefined || !Object.is(local.id, occurrence.local)
        || local.role.kind !== "receiver" && local.role.kind !== "parameter" && local.role.kind !== "capture") {
        const stop = report("cell-occurrence-resolves", "An entry cell retains its real selected execution and incoming MIR local.");
        if (stop !== null) return stop;
      }
    } else {
      const selected = statement(occurrence.execution, occurrence.point);
      if (selected.kind !== "complete") return selected;
      if (selected.value === null || selected.value.kind !== "assign" && selected.value.kind !== "storage-live") {
        const stop = report("cell-occurrence-resolves", "A cell-producing statement is an actual assignment or storage-live position, never a terminator.");
        if (stop !== null) return stop;
      }
    }
    for (const marker of cell.lifetimes) {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      const selected = statement(marker.execution, marker.point);
      if (selected.kind !== "complete") return selected;
      const actual = selected.value;
      if (actual === null || actual.kind !== (marker.kind === "live" ? "storage-live" : "storage-dead")
        || !Object.is(actual.local, marker.local)) {
        const stop = report("cell-occurrence-resolves", "A lifetime witness retains the exact reached storage marker and local, not a dynamic lifetime identity.");
        if (stop !== null) return stop;
      }
    }
    const stable = (reference: StableReference): DataflowStop | null => {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      if (reference.kind === "static") return !context.definitionExists(reference.declaration.definition)
        ? report("cell-role-resolves", "A static cell retains its actual qualified declaration.") : null;
      if (reference.kind === "local") {
        const selected: DataflowResult<MirBody | null> = execution === null ? { kind: "complete", value: null } : body(execution);
        if (selected.kind !== "complete") return selected;
        const mir = selected.value;
        return mir === null || !validIndex(reference.local, mir.locals.length) || mir.locals[reference.local]?.id !== reference.local
          ? report("cell-role-resolves", "A local cell retains an actual local of its owning execution.") : null;
      }
      const signature = owner.kind === "summary" ? owner.key.kind === "declared"
        ? context.signatureIdOf(owner.key.execution.request) : context.tirBody(owner.key.execution.instance).signature
        : context.tirBody(owner.execution.instance).signature;
      const selected = signature === null || !validIndex(signature, context.types.signatures.length) ? undefined : context.types.signatures[signature];
      if (reference.kind === "capture") {
        const execution = owner.kind === "body" ? owner.execution : owner.key.kind === "body" ? owner.key.execution : null;
        if (execution !== null) {
          const read = chargeWork(account, 1);
          if (read !== null) return read;
          if (context.tirBody(execution.instance)?.captures[reference.index]?.capture === "captured-value")
            return report("cell-role-resolves", "A copied capture has no incoming caller cell.");
        }
      }
      return reference.kind === "receiver" ? selected === undefined || selected.receiver === null
        ? report("cell-role-resolves", "A formal cell retains the actual receiver, parameter or capture inventory.") : null
        : reference.kind === "parameter" ? selected === undefined || !validIndex(reference.index, selected.parameters.length)
          ? report("cell-role-resolves", "A formal cell retains the actual receiver, parameter or capture inventory.") : null
          : !validIndex(reference.index, owner.kind === "body" ? context.tirBody(owner.execution.instance).captures.length : context.captureCount(owner.key) ?? 0)
            ? report("cell-role-resolves", "A formal cell retains the actual receiver, parameter or capture inventory.") : null;
    };
    if (role.kind === "created") {
      if (role.anchor.kind !== "result") {
        const stop = stable(role.anchor);
        if (stop !== null) return stop;
      }
      switch (role.slot.kind) {
        case "local":
          if (!context.localExists(role.slot.local)) {
            const stop = report("cell-role-resolves", "A created local slot retains its actual qualified source local.");
            if (stop !== null) return stop;
          }
          break;
        case "capture":
          if (!validIndex(role.slot.path, arena.projections.length) || !Number.isSafeInteger(role.slot.index)
            || role.slot.index < 0 || Object.is(role.slot.index, -0)) {
            const stop = report("cell-role-resolves", "A created capture slot retains an actual projection and nonnegative slot index.");
            if (stop !== null) return stop;
          }
          break;
        case "field": {
          const stop = collectStorageChecks(role.slot.member, site, context, violations, account);
          if (stop !== null) return stop;
          break;
        }
        case "entity": break;
      }
    } else if (role.kind !== "detached") {
      const stop = stable(role);
      if (stop !== null) return stop;
    }
  }
  return { kind: "complete", violations };
}
