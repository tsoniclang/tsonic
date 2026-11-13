import type { Violation } from "../diag/contract.js";
import type { LocalId } from "../ids/contract.js";
import type { MirBody, MirRule, MirStepRef, MirTerminator, MirVerificationContext, MirViolationSite } from "./contract.js";
import { densePosition, findSourceNode } from "./verify-control.js";
import type { SourceNode } from "./verify-control.js";
import type { NodeId } from "../ids/contract.js";
import { wireText } from "./text.js";
import type { DecisionWires } from "./text-decisions.js";

// The graph laws a lowered body satisfies beyond reference and type validity. Every check is one pass over the
// records of the body; none follows paths. Law numbers are those of the lowering specification's list of ten.
// Law 2 (a statement executes only a pure decision) and the agreement of a failure kind with its decision need
// the execution fields of the decision records and are added with them. Law 3 (the region in which a checked
// place may be used) is not decided and is not enforced here.
export function verifyLaws(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>, wires: DecisionWires,
): readonly Violation<MirRule, MirViolationSite>[] {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const report = (rule: MirRule, site: MirViolationSite): void => { violations.push({ rule, site, detail: [] }); };
  const bodySite: MirViolationSite = { kind: "body", body: body.body };

  // Law 7: entries are ordered by supplied count and offer only admissible counts.
  const fixed = context.source.params.filter(parameter => parameter.role !== "rest" && parameter.role !== "this");
  const first = body.entries[0];
  if (first === undefined || first.provided !== fixed.length || !Object.is(first.block, 0)) report("entries-exact", bodySite);
  let previous: number | null = null;
  for (const entry of body.entries) {
    const block = densePosition(entry.block, body.blocks.length) ? body.blocks[entry.block] : undefined;
    const admissible = Number.isSafeInteger(entry.provided) && entry.provided >= 0 && entry.provided <= fixed.length
      && fixed.slice(entry.provided).every(parameter => parameter.role === "optional" || parameter.role === "default");
    if (block === undefined || !admissible || previous !== null && !(entry.provided < previous)) report("entries-exact", bodySite);
    previous = entry.provided;
  }

  // Writes of each local: an assignment to the local itself, or a terminator that delivers a value into it.
  const writes = new Map<LocalId, number>();
  const written = (place: number | null): void => {
    if (place === null || !densePosition(place, body.places.length)) return;
    const selected = body.places[place];
    if (selected === undefined || selected.base.kind !== "local") return;
    writes.set(selected.base.local, (writes.get(selected.base.local) ?? 0) + 1);
  };
  const destinations = (terminator: MirTerminator): void => {
    switch (terminator.kind) {
      case "call": case "invoke": written(terminator.destination); break;
      case "await": written(terminator.destination); break;
      case "yield": case "delegate": written(terminator.destination); written(terminator.return.destination); break;
      case "goto": case "switch": case "check": case "throw": case "return": case "unreachable": break;
    }
    if ("unwind" in terminator && terminator.unwind.kind === "handler") written(terminator.unwind.exception);
  };
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const statement of block.statements) if (statement.kind === "assign") written(statement.place);
    destinations(block.terminator);
  }

  for (const place of body.places) {
    if (place === undefined || place.base.kind !== "place" && place.base.kind !== "checked") continue;
    const site: MirViolationSite = { kind: "place", body: body.body, place: place.id };
    // A narrowed view of a cell exists only as the result of its check.
    if (place.base.projection.kind === "refined" && place.base.kind !== "checked") report("refined-under-check", site);
    // Law 4: an index, once evaluated, cannot be changed by a later write. It is a constant, or a local written once
    // (an entry-present local that the body never writes counts as written once, at entry).
    if (place.base.projection.kind === "index" && place.base.projection.operand.kind === "place") {
      const operand = densePosition(place.base.projection.operand.place, body.places.length) ? body.places[place.base.projection.operand.place] : undefined;
      if (operand !== undefined && operand.base.kind === "local") {
        const local = densePosition(operand.base.local, body.locals.length) ? body.locals[operand.base.local] : undefined;
        const count = writes.get(operand.base.local) ?? 0;
        const present = local !== undefined && (local.role.kind === "parameter" || local.role.kind === "receiver" || local.role.kind === "capture");
        if (!(present ? count === 0 : count === 1)) report("index-operand-stable", site);
      } else if (operand !== undefined) report("index-operand-stable", site);
    }
  }

  const sourceOf = (node: { readonly body: string; readonly node: NodeId }): SourceNode | undefined =>
    node.body === context.source.body ? findSourceNode(nodes, node.node) : undefined;
  // Law 6: a protocol step names its step.
  const step = (reference: MirStepRef | null, source: SourceNode | undefined, form: "call" | "operation" | "await" | "yield" | "delegate" | "done",
    site: MirViolationSite): void => {
    if (reference === null || source === undefined) return;
    const protocol = densePosition(reference.protocol, source.protocols.length) ? source.protocols[reference.protocol] : undefined;
    const selected = protocol === undefined || !densePosition(reference.step, protocol.steps.length) ? undefined : protocol.steps[reference.step];
    if (protocol === undefined) { report("protocol-step-exact", site); return; }
    if (form === "yield" || form === "delegate") {
      // The suspension of a yield or a delegation is the protocol itself; it names the protocol and the step it performs if one is listed.
      if (protocol.kind !== form || reference.step !== 0 && selected === undefined) report("protocol-step-exact", site);
      return;
    }
    if (selected === undefined) { report("protocol-step-exact", site); return; }
    const agrees = form === "call" ? selected.callee !== null
      : form === "operation" ? selected.callee === null
      : form === "await" ? selected.role === "await"
      : selected.role === "done";
    if (!agrees) report("protocol-step-exact", site);
  };

  const effects = new Set<string>();
  const { calleeWire, operationWire } = wires;
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const [position, statement] of block.statements.entries()) {
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: position };
      if (statement.kind === "assign") { step(statement.step, sourceOf(statement.tir), "operation", site); continue; }
      // Law 8: a local that is present on entry carries no begin marker.
      if (statement.kind !== "storage-live") continue;
      const local = densePosition(statement.local, body.locals.length) ? body.locals[statement.local] : undefined;
      if (local !== undefined && (local.role.kind === "parameter" || local.role.kind === "receiver" || local.role.kind === "capture"))
        report("storage-marker-exact", site);
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    const terminator = block.terminator;
    const source = sourceOf(terminator.tir);
    // Law 1: a check is a control point whose failure goes to a handler, out of the body, or ends the process. The
    // terminators that run code of their own can only unwind.
    switch (terminator.kind) {
      case "check": {
        if (terminator.unwind.kind === "none") report("failure-kind-exact", site);
        const place = densePosition(terminator.place, body.places.length) ? body.places[terminator.place] : undefined;
        if (place === undefined || place.base.kind !== "checked" || place.base.tir.body !== terminator.tir.body
          || !Object.is(place.base.tir.node, terminator.tir.node)) report("check-place-exact", site);
        break;
      }
      case "call": case "await": case "yield": case "delegate": case "throw":
        if (terminator.unwind.kind !== "handler" && terminator.unwind.kind !== "escape") report("failure-kind-exact", site);
        break;
      case "invoke": case "goto": case "switch": case "return": case "unreachable": break;
    }
    switch (terminator.kind) {
      case "call": step(terminator.step, source, terminator.callee.kind === "body" ? "operation" : "call", site); break;
      case "invoke": step(terminator.step, source, "operation", site); break;
      case "await": step(terminator.step, source, "await", site); break;
      case "yield": step(terminator.step, source, "yield", site); break;
      case "delegate": step(terminator.step, source, "delegate", site); break;
      case "switch": {
        step(terminator.step, source, "done", site);
        if (terminator.step === null) break;
        // Law 6: the completion branch of an iteration has one canonical shape.
        const only = terminator.targets.length === 1 ? terminator.targets[0] : undefined;
        const constant = only !== undefined && densePosition(only.constant, body.constants.length) ? body.constants[only.constant] : undefined;
        const complete = constant !== undefined && constant.value.kind === "literal" && constant.value.value.kind === "boolean"
          && constant.value.value.value === true;
        if (only === undefined || !complete || Object.is(only.target, terminator.otherwise)) report("completion-branch-canonical", site);
        break;
      }
      case "check": case "goto": case "throw": case "return": case "unreachable": break;
    }
    // Law 9: no effect occurrence is emitted twice.
    let occurrence: string | null = null;
    switch (terminator.kind) {
      case "call": occurrence = terminator.callee.kind === "body" ? `body:${terminator.callee.instance.body}`
        : `call:${wireText(calleeWire, terminator.callee.resolution)}`; break;
      case "invoke": occurrence = `invoke:${wireText(operationWire, terminator.operation)}`; break;
      case "await": case "yield": case "delegate": case "throw": occurrence = terminator.kind; break;
      case "check": case "goto": case "switch": case "return": case "unreachable": break;
    }
    if (occurrence === null) continue;
    const identity = "step" in terminator && terminator.step !== null ? `${terminator.step.protocol}.${terminator.step.step}` : "-";
    const key = `${terminator.tir.body}\u0000${terminator.tir.node}\u0000${identity}\u0000${occurrence}`;
    if (effects.has(key)) report("effect-site-unique", site);
    effects.add(key);
  }
  return violations;
}
