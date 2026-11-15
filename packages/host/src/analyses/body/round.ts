import type { DataflowStop } from "../../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork, refuseAccount } from "../../dataflow/index.js";
import type { Diagnostic, DiagnosticIdentity, ErrorValue, UnitResult } from "../../diag/contract.js";
import { hostDiagnosticCode, requirePresent, resourceLimitDiagnostic } from "../../diag/index.js";
import type { NodeId, TyId } from "../../ids/contract.js";
import { originsId, valueContextId } from "../../ids/index.js";
import type { InitializationFact, IntegerFact, ReadOriginsFact, SubjectOriginsFact, Summary, WriteFact } from "../../ir-facts/contract.js";
import { admitSummaryIdentity } from "../../ir-facts/index.js";
import type { MirOperand, MirSite } from "../../ir-mir/contract.js";
import { localOwnershipOfMir } from "../../ir-mir/index.js";
import type { TirNode } from "../../ir-tir/contract.js";
import { nativeCarrierOf, sameInstance } from "../../ir-types/index.js";
import type { BodyRoundDeps, BodyRoundInput, BodyRoundResult, BodyRoundValue } from "./contract.js";
import { orderedRows, sourceOccurrences } from "./source.js";
import { assignedEntry, bodyFrontier, readLocal, solveAssigned, statementOperands, terminatorOperands, transferAssigned } from "./storage.js";

function noStorageReferences(deps: BodyRoundDeps, type: TyId): boolean {
  const selected = nativeCarrierOf(deps.types, type, current =>
    chargeWork(deps.account, 1) === null ? deps.typeOf(current) : null);
  if (selected.kind === "resource-stop") return false;
  return selected.kind === "primitive";
}

function uninitialized(deps: BodyRoundDeps, site: MirSite): UnitResult<ErrorValue> {
  const code = hostDiagnosticCode("TSONIC_READ_BEFORE_INITIALIZATION");
  const identity: DiagnosticIdentity = { kind: "host", unit: { request: deps.unit, position: { kind: "result" } }, code };
  const diagnostic: Diagnostic = { code: { kind: "host", name: code, rendered: code }, severity: "error",
    site: { kind: "source", origin: site.origin }, source: "analyses/initialization", evidence: [],
    message: "The execution reads its own storage before initialization.", arguments: [], related: [], fix: null };
  const error: ErrorValue = { kind: "error", causes: [{ kind: "diagnostic", diagnostic: identity }] };
  return { kind: "ok", value: error, positions: [{ position: { kind: "result" }, error }], diagnostics: [diagnostic],
    emissions: [{ identity, diagnostic }] };
}

function operandSite(node: TirNode | undefined, position: number, fallback: NodeId): NodeId {
  if (node?.kind === "BinaryExpression") return position === 0 ? node.left.id : node.right.id;
  if (node?.kind === "PrefixUnaryExpression" || node?.kind === "PostfixUnaryExpression") return node.operand.id;
  if (node?.kind === "ReturnStatement" && node.expression !== null) return node.expression.id;
  return fallback;
}

export function analyzeRound(deps: BodyRoundDeps, input: BodyRoundInput): BodyRoundResult {
  const { account } = deps;
  const prior = accountFailure(account);
  if (prior !== null) return prior;
  const { execution, mir, tir, liveness } = input;
  const identity = admitSummaryIdentity({ kind: "body", execution }, account)
    ?? admitSummaryIdentity({ kind: "body", execution: { instance: { body: mir.body, bindings: mir.bindings }, provided: execution.provided } }, account)
    ?? admitSummaryIdentity({ kind: "body", execution }, account)
    ?? admitSummaryIdentity({ kind: "body", execution: { instance: { body: tir.body, bindings: tir.bindings }, provided: execution.provided } }, account);
  if (identity !== null) return identity;
  if (!sameInstance(execution.instance, { body: mir.body, bindings: mir.bindings })
    || !sameInstance(execution.instance, { body: tir.body, bindings: tir.bindings }) || mir.bindings.kind !== "instantiated")
    return bodyFrontier("A body round requires the same complete selected execution, MIR and TIR.");
  const setup = chargeWork(account, mir.locals.length + mir.places.length + mir.constants.length + tir.captures.length)
    ?? chargeResultEntries(account, 8);
  if (setup !== null) return setup;
  if (tir.captures.length !== 0) return bodyFrontier("BodyAnalysis requires the actual Origins capture-to-cell association for captured execution.");
  for (const local of mir.locals) {
    if (localOwnershipOfMir(local.mode) !== "body")
      return bodyFrontier("BodyAnalysis requires the actual caller-cell binding of this external storage mode.");
    if (!noStorageReferences(deps, local.storage)) {
      const stop = accountFailure(account);
      return stop ?? bodyFrontier("BodyAnalysis requires the actual Origins reference/cell producer for this selected local.");
    }
  }
  for (const place of mir.places) if (place.base.kind !== "local")
    return bodyFrontier("BodyAnalysis requires the actual selected projection or static-cell producer for this place.");
  for (const constant of mir.constants) {
    if (constant.value.kind !== "literal" || constant.value.value.kind === "absence" || !noStorageReferences(deps, constant.type)) {
      const stop = accountFailure(account);
      return stop ?? bodyFrontier("BodyAnalysis requires the actual selected non-scalar constant relation.");
    }
  }
  const source = sourceOccurrences(tir, account);
  if (source.kind !== "complete") return source;
  const solved = solveAssigned(mir, execution.provided, account);
  if (solved.kind !== "complete") return solved;
  const initialized = new Map<NodeId, InitializationFact>();
  const reads: ReadOriginsFact[] = [];
  const subjects: SubjectOriginsFact[] = [];
  const writes: WriteFact[] = [];
  let returns = false;
  const empty = originsId(0);
  const read = (operand: MirOperand, node: NodeId, assigned: ReadonlySet<number>): boolean => {
    if (chargeWork(account, 1) !== null || chargeResultEntries(account, 2) !== null) return false;
    if (operand.kind === "constant") return true;
    const local = readLocal(mir, operand);
    const previous = initialized.get(node);
    if (previous !== undefined && previous.place !== operand.place)
      return bodyFrontier("Initialization needs the canonical separate occurrence relation for this multiple-place source read.");
    const present = assigned.has(local);
    initialized.set(node, { node, place: operand.place, assigned: present });
    if (previous === undefined) reads.push({ node, place: operand.place, origins: empty });
    return present;
  };
  for (const block of mir.blocks) {
    const blockWork = chargeWork(account, 1);
    if (blockWork !== null) return blockWork;
    if (solved.value.reachable[block.id] !== true) continue;
    let assigned = assignedEntry(solved.value.entry, block.id);
    let position = 0;
    for (const row of block.statements) {
      const statementWork = chargeWork(account, 4) ?? chargeResultEntries(account, 3);
      if (statementWork !== null) return statementWork;
      const statement = requirePresent(row, { owner: "analyses/body", query: null, origin: null,
        message: "A verified block retains its actual statement." });
      const operands = statementOperands(statement);
      let index = 0;
      for (const operand of operands) {
        if (!read(operand, operandSite(source.value.get(statement.tir.node), index, statement.tir.node), assigned)) {
          const stop = accountFailure(account);
          if (stop !== null) return stop;
          const failure = chargeWork(account, 5) ?? chargeResultEntries(account, 8);
          return failure ?? { kind: "complete", value: uninitialized(deps, statement) };
        }
        index += 1;
      }
      if (statement.kind === "assign") {
        const value = statement.value;
        if (value.kind !== "use" && (value.kind !== "unary" && value.kind !== "binary" && value.kind !== "convert"
          || value.operation.decision.kind !== "selected" || value.operation.decision.operation.kind !== "native-operator"))
          return bodyFrontier("BodyAnalysis requires the actual selected operation effect and Origins transport.");
        const local = readLocal(mir, { kind: "place", place: statement.place });
        const storeWork = chargeResultEntries(account, 3);
        if (storeWork !== null) return storeWork;
        writes.push({ point: { block: block.id, statement: position }, node: statement.tir.node,
          operation: assigned.has(local) ? "mutation" : "initialization", destination: "binding", targets: [], owner: null,
          values: [{ source: statement.tir, origins: empty, reason: null }], boundaries: [] });
      }
      const next = transferAssigned(mir, statement, assigned, account);
      const transferStop = accountFailure(account);
      if (transferStop !== null) return transferStop;
      assigned = next;
      position += 1;
    }
    const terminatorWork = chargeWork(account, 3) ?? chargeResultEntries(account, 2);
    if (terminatorWork !== null) return terminatorWork;
    const terminator = block.terminator;
    for (const operand of terminatorOperands(terminator)) {
      if (!read(operand, operandSite(source.value.get(terminator.tir.node), 0, terminator.tir.node), assigned)) {
        const stop = accountFailure(account);
        if (stop !== null) return stop;
        const failure = chargeWork(account, 5) ?? chargeResultEntries(account, 8);
        return failure ?? { kind: "complete", value: uninitialized(deps, terminator) };
      }
    }
    if (terminator.kind === "return") {
      returns = true;
      if (terminator.value !== null) subjects.push({ node: terminator.tir.node, role: "return", path: null, origins: empty });
    }
  }
  const collection = chargeWork(account, initialized.size) ?? chargeResultEntries(account, initialized.size);
  if (collection !== null) return collection;
  const initialization = orderedRows([...initialized.values()], (left, right) => left.node - right.node, account);
  if (initialization.kind !== "complete") return initialization;
  const readRows = orderedRows(reads, (left, right) => left.node - right.node, account);
  if (readRows.kind !== "complete") return readRows;
  const subjectRows = orderedRows(subjects, (left, right) => left.node - right.node, account);
  if (subjectRows.kind !== "complete") return subjectRows;
  const integers: IntegerFact[] = [];
  for (const node of source.value.values()) {
    const nodeWork = chargeWork(account, 1);
    if (nodeWork !== null) return nodeWork;
    if (node.tsonic !== null && "convertedType" in node.tsonic) {
      if (node.tsonic.narrowing !== null)
        return bodyFrontier("BodyAnalysis requires the actual selected guard proof/invalidation relation for this refinement.");
      const integerWork = chargeResultEntries(account, 1);
      if (integerWork !== null) return integerWork;
      integers.push({ node: node.id, range: null, nonnegative: false });
    }
  }
  const integerRows = orderedRows(integers, (left, right) => left.node - right.node, account);
  if (integerRows.kind !== "complete") return integerRows;
  const signatureWork = chargeWork(account, 1);
  if (signatureWork !== null) return signatureWork;
  const signature = deps.signatureOf(tir.signature);
  const summaryWork = chargeResultEntries(account, 40 + signature.parameters.length * 4);
  if (summaryWork !== null) return summaryWork;
  const bounded = (limit: "maximumRelationalRecordsPerBody" | "maximumRelationalReferencesPerBody" | "maximumConditionAlternatives", size: number): DataflowStop | null =>
    size <= deps.limits[limit] ? null : refuseAccount(account, { kind: "refused", diagnostics: [
      resourceLimitDiagnostic({ owner: "analyses/origins", limit: `analysis.${limit}`, maximum: deps.limits[limit],
        site: { kind: "source", origin: tir.root.origin }, unit: { request: deps.unit, position: { kind: "result" } } })] });
  const bound = bounded("maximumRelationalRecordsPerBody", 2)
    ?? bounded("maximumRelationalReferencesPerBody", signature.parameters.length + (signature.receiver === null ? 0 : 1))
    ?? bounded("maximumConditionAlternatives", 1);
  if (bound !== null) return bound;
  const arena = { cells: [], projections: [], producers: [], boundProducers: [], boundaries: [],
    contexts: [{ id: valueContextId(0), receiver: signature.receiver === null ? null : empty,
      arguments: signature.parameters.map(() => empty), captures: [] }],
    origins: [{ id: empty, kind: "complete", producers: [], includesAbsence: false }] } satisfies BodyRoundValue["facts"]["arena"];
  const summary: Summary = { key: { kind: "body", execution }, signature: tir.signature, arena,
    parameters: [], captures: [], result: empty, thrown: empty, writes: [], retention: [], callbacks: [],
    concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns, unwinds: false,
    initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
      points: returns ? [{ kind: "return" }] : [], rows: returns ? [{ point: 0, cell: null, condition: 0 }] : [] },
    resultCells: [], backing: [], suspends: false, bindingDependent: tir.dependence === "binding-dependent" };
  const effects: Summary["parameters"][number][] = [];
  if (signature.receiver !== null) effects.push({ slot: { kind: "receiver" }, reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  for (let index = 0; index < signature.parameters.length; index += 1) effects.push({ slot: { kind: "parameter", index },
    reads: { kind: "complete", paths: [] }, writes: { kind: "complete", paths: [] } });
  const value: BodyRoundValue = { facts: { execution, arena, liveness, initialization: { reads: initialization.value },
    refinements: { refinements: [], integers: integerRows.value, countedLoops: [] }, origins: { points: [], reads: readRows.value,
      subjects: subjectRows.value, writes, escapes: [], invocations: [], callbacks: [], activations: [], frontiers: [],
      constructions: [], instanceRegions: [], exitContents: { onReturn: [], onUnwind: [] } },
    suspension: { suspensions: [] }, errorStorage: { errors: [] }, pointerBacking: { pointers: [] }, rawLocations: [],
    fieldBindings: [], recordBindings: [], memoryBindings: [], selectedMemoryDeclarations: [], closedArrays: [] },
    summary: { ...summary, parameters: effects } };
  return { kind: "complete", value: { kind: "ok", value, diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] } };
}
