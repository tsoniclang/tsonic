import type { Violation } from "../diag/contract.js";
import type { BlockId, NodeId, PlaceId } from "../ids/contract.js";
import type { MirBody, MirClosureCapture, MirOperand, MirRule, MirStepRef, MirVerificationContext, MirViolationSite } from "./contract.js";
import { densePosition, findSourceNode } from "./verify-control.js";
import type { SourceNode, SourceStep, WireTexts } from "./verify-control.js";
import type { PlaceLocation } from "./verify-storage.js";

// The graph laws a lowered body satisfies beyond reference and type validity. Every check is a pass over the
// records of the body; none follows paths. Law numbers are those of the lowering specification's list of ten.
// Law 2 (a statement executes only a pure decision), the receiver half of law 4 and the agreement of a failure
// kind with its decision need the execution fields of the decision records and are added with them. Law 3 (the
// region in which a checked place may be used) is not decided and is not enforced here.
export function verifyLaws(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>, texts: WireTexts,
  places: ReadonlyMap<PlaceId, PlaceLocation>,
): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  // A site record is built only when a finding is reported.
  const reportBody = (rule: MirRule): void => { violations.push({ rule, site: { kind: "body", body: body.body }, detail: [] }); };
  const reportPlace = (rule: MirRule, place: PlaceId): void => { violations.push({ rule, site: { kind: "place", body: body.body, place }, detail: [] }); };
  const reportAt = (rule: MirRule, block: BlockId, statement: number | null): void => {
    violations.push({ rule, site: { kind: "instruction", body: body.body, block, statement }, detail: [] });
  };

  // Law 7: one entry for each admissible supplied count: the full count first and at the first block, each next
  // count one less, down to the count that omits every trailing parameter the signature lets be omitted.
  let fixed = 0;
  let omissible = 0;
  for (const parameter of context.source.params) {
    if (parameter.role === "rest" || parameter.role === "this") continue;
    fixed += 1;
    omissible = parameter.role === "optional" || parameter.role === "default" ? omissible + 1 : 0;
  }
  let exact = body.entries.length === omissible + 1;
  for (const [position, entry] of body.entries.entries()) {
    if (!Object.is(entry.provided, fixed - position) || !densePosition(entry.block, body.blocks.length)
      || position === 0 && !Object.is(entry.block, 0)) exact = false;
  }
  if (!exact) reportBody("entries-exact");

  const sourceOf = (node: { readonly body: string; readonly node: NodeId }): SourceNode | undefined =>
    node.body === context.source.body ? findSourceNode(nodes, node.node) : undefined;
  const named = (reference: MirStepRef, source: SourceNode): SourceStep | undefined => {
    const row = densePosition(reference.protocol, source.steps.length) ? source.steps[reference.protocol] : undefined;
    return row === undefined || !densePosition(reference.step, row.length) ? undefined : row[reference.step];
  };

  // Every way a local's cell can be written, counted on the local the written place is rooted at: an assignment,
  // a value a terminator delivers, a place handed to a call for writing, an address taken, a capture.
  const writes = new Uint32Array(body.locals.length);
  const rootOf = (place: PlaceId | null): number | null => {
    if (place === null) return null;
    const location = places.get(place);
    return location === undefined || location.root === null ? null : location.root.id;
  };
  const written = (place: PlaceId | null): void => {
    const root = rootOf(place);
    if (root !== null) writes[root] = (writes[root] ?? 0) + 1;
  };
  const captured = (captures: readonly MirClosureCapture[]): void => { for (const capture of captures) written(capture.place); };
  // The locals that hold the result of a completion test (a step of role `done`).
  const completions = new Set<number>();
  const completion = (reference: MirStepRef | null, source: SourceNode | undefined, destination: PlaceId | null): void => {
    if (reference === null || source === undefined) return;
    const root = rootOf(destination);
    if (root !== null && named(reference, source)?.role === "done") completions.add(root);
  };
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const statement of block.statements) {
      if (statement.kind !== "assign") continue;
      written(statement.place);
      if (statement.value.kind === "address-of") written(statement.value.place);
      else if (statement.value.kind === "closure") captured(statement.value.captures);
      completion(statement.step, sourceOf(statement.tir), statement.place);
    }
    const terminator = block.terminator;
    switch (terminator.kind) {
      case "call":
        written(terminator.destination);
        for (const argument of terminator.arguments) {
          if (argument.kind === "place" && argument.passing !== "byref-readonly" && argument.passing !== "borrow-shared") written(argument.place);
        }
        if (terminator.callee.kind === "body") captured(terminator.callee.captures);
        completion(terminator.step, sourceOf(terminator.tir), terminator.destination);
        break;
      case "invoke":
        written(terminator.destination);
        completion(terminator.step, sourceOf(terminator.tir), terminator.destination);
        break;
      case "await": written(terminator.destination); break;
      case "yield": case "delegate": written(terminator.destination); written(terminator.return.destination); break;
      case "goto": case "switch": case "check": case "throw": case "return": case "unreachable": break;
    }
    if ("unwind" in terminator && terminator.unwind.kind === "handler") written(terminator.unwind.exception);
  }

  for (const place of body.places) {
    if (place === undefined || place.base.kind !== "place" && place.base.kind !== "checked") continue;
    // A narrowed view of a cell exists only as the result of its check.
    if (place.base.projection.kind === "refined" && place.base.kind !== "checked") reportPlace("refined-under-check", place.id);
    // Law 4: an index, once evaluated, cannot be changed by a later write. It is a constant, or a local whose cell
    // is written once (an entry-present local that the body never writes counts as written once, at entry).
    if (place.base.projection.kind === "index" && place.base.projection.operand.kind === "place") {
      const operand = densePosition(place.base.projection.operand.place, body.places.length) ? body.places[place.base.projection.operand.place] : undefined;
      if (operand !== undefined && operand.base.kind === "local") {
        const local = densePosition(operand.base.local, body.locals.length) ? body.locals[operand.base.local] : undefined;
        const count = densePosition(operand.base.local, writes.length) ? writes[operand.base.local] ?? 0 : 0;
        const present = local !== undefined && (local.role.kind === "parameter" || local.role.kind === "receiver" || local.role.kind === "capture");
        if (!(present ? count === 0 : count === 1)) reportPlace("index-operand-stable", place.id);
      } else if (operand !== undefined) reportPlace("index-operand-stable", place.id);
    }
  }

  // Law 6: a protocol step names its step. A record that names a step executes that step's callee or operation, and
  // a record that executes the callee or operation of a step of its node's protocols names it. A record that names
  // a step and carries no selection of its own (a call of an internal body, an assignment without an operation) is
  // held to the step's form only.
  const step = (reference: MirStepRef | null, source: SourceNode | undefined, callee: string | null, operation: string | null,
    block: BlockId, statement: number | null): void => {
    if (source === undefined) return;
    if (reference === null) {
      if (callee === null && operation === null) return;
      for (const row of source.steps) for (const candidate of row) {
        if (callee !== null ? candidate.callee === callee : candidate.callee === null && candidate.operation === operation) {
          reportAt("protocol-step-exact", block, statement);
          return;
        }
      }
      return;
    }
    const selected = named(reference, source);
    if (selected === undefined || (callee !== null ? selected.callee !== callee
      : selected.callee !== null || operation !== null && selected.operation !== operation)) reportAt("protocol-step-exact", block, statement);
  };
  const hasRole = (source: SourceNode, role: SourceStep["role"]): boolean => source.steps.some(row => row.some(candidate => candidate.role === role));
  const completionOperand = (operand: MirOperand): boolean => {
    const root = operand.kind === "place" ? rootOf(operand.place) : null;
    return root !== null && completions.has(root);
  };

  const effects = new Set<string>();
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const [position, statement] of block.statements.entries()) {
      if (statement.kind === "assign") {
        const source = sourceOf(statement.tir);
        if (source === undefined || statement.step === null && source.steps.length === 0) continue;
        const value = statement.value;
        step(statement.step, source, null, value.kind === "unary" || value.kind === "binary" || value.kind === "convert"
          ? texts.operation(value.operation) : null, block.id, position);
        continue;
      }
      // Law 8: a local that is present on entry carries no begin marker.
      if (statement.kind !== "storage-live") continue;
      const local = densePosition(statement.local, body.locals.length) ? body.locals[statement.local] : undefined;
      if (local !== undefined && (local.role.kind === "parameter" || local.role.kind === "receiver" || local.role.kind === "capture"))
        reportAt("storage-marker-exact", block.id, position);
    }
    const terminator = block.terminator;
    const source = sourceOf(terminator.tir);
    // Law 1: a check is a control point whose failure goes to a handler, out of the body, or ends the process. The
    // terminators that run code of their own can only unwind.
    switch (terminator.kind) {
      case "check": {
        if (terminator.unwind.kind === "none") reportAt("failure-kind-exact", block.id, null);
        const place = densePosition(terminator.place, body.places.length) ? body.places[terminator.place] : undefined;
        if (place === undefined || place.base.kind !== "checked" || place.base.tir.body !== terminator.tir.body
          || !Object.is(place.base.tir.node, terminator.tir.node)) reportAt("check-place-exact", block.id, null);
        break;
      }
      case "call": case "await": case "yield": case "delegate": case "throw":
        if (terminator.unwind.kind !== "handler" && terminator.unwind.kind !== "escape") reportAt("failure-kind-exact", block.id, null);
        break;
      case "invoke": case "goto": case "switch": case "return": case "unreachable": break;
    }
    // Law 9: no effect occurrence is emitted twice. The occurrence is the node, the step and the selection executed.
    let occurrence: string | null = null;
    switch (terminator.kind) {
      case "call": {
        const callee = terminator.callee.kind === "body" ? null : texts.callee(terminator.callee.resolution);
        step(terminator.step, source, callee, null, block.id, null);
        occurrence = terminator.callee.kind === "body" ? `body:${terminator.callee.instance.body}` : `call:${callee}`;
        break;
      }
      case "invoke": {
        const operation = texts.operation(terminator.operation);
        step(terminator.step, source, null, operation, block.id, null);
        occurrence = `invoke:${operation}`;
        break;
      }
      case "await": {
        occurrence = terminator.kind;
        if (source === undefined) break;
        // An await at a node whose protocols list an await step is that step.
        if (terminator.step === null ? hasRole(source, "await") : named(terminator.step, source)?.role !== "await")
          reportAt("protocol-step-exact", block.id, null);
        break;
      }
      case "yield": case "delegate": {
        occurrence = terminator.kind;
        if (source === undefined) break;
        // The suspension of a yield or a delegation is the protocol itself: it names the protocol, and the step it
        // performs if one is listed.
        const reference = terminator.step;
        if (reference === null) {
          if (source.protocols.some(protocol => protocol.kind === terminator.kind)) reportAt("protocol-step-exact", block.id, null);
          break;
        }
        const protocol = densePosition(reference.protocol, source.protocols.length) ? source.protocols[reference.protocol] : undefined;
        if (protocol === undefined || protocol.kind !== terminator.kind || reference.step !== 0 && named(reference, source) === undefined)
          reportAt("protocol-step-exact", block.id, null);
        break;
      }
      case "switch": {
        if (terminator.step === null) {
          // A branch on the result of a completion test is the completion branch and names the step.
          if (completionOperand(terminator.operand)) reportAt("protocol-step-exact", block.id, null);
          break;
        }
        if (source !== undefined && named(terminator.step, source)?.role !== "done") reportAt("protocol-step-exact", block.id, null);
        // Law 6: the completion branch of an iteration has one canonical shape.
        const only = terminator.targets.length === 1 ? terminator.targets[0] : undefined;
        const constant = only !== undefined && densePosition(only.constant, body.constants.length) ? body.constants[only.constant] : undefined;
        const complete = constant !== undefined && constant.value.kind === "literal" && constant.value.value.kind === "boolean"
          && constant.value.value.value === true;
        if (only === undefined || !complete || Object.is(only.target, terminator.otherwise)) reportAt("completion-branch-canonical", block.id, null);
        break;
      }
      case "throw": occurrence = terminator.kind; break;
      case "check": case "goto": case "return": case "unreachable": break;
    }
    if (occurrence === null) continue;
    const identity = "step" in terminator && terminator.step !== null ? `${terminator.step.protocol}.${terminator.step.step}` : "-";
    const key = `${terminator.tir.node}\u0000${identity}\u0000${occurrence}`;
    if (effects.has(key)) reportAt("effect-site-unique", block.id, null);
    effects.add(key);
  }
  return violations;
}
