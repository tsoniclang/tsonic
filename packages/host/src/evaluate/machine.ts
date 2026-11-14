import type { ErrorValue, UnitRef } from "../diag/contract.js";
import { requirePresent, throwInvariant, unitPositionData } from "../diag/index.js";
import type { BlockId, BodyId, LocalId, Origin, PlaceId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { MirBody, MirOperand, MirSite, MirTerminator, MirUnwind } from "../ir-mir/contract.js";
import { localOwnershipOfMir } from "../ir-mir/index.js";
import type { BodyInstance, ConstValue } from "../ir-types/contract.js";
import { sameInstance } from "../ir-types/index.js";
import type { Evaluate, EvaluateDeps, EvaluationStep, ResumeEvaluate } from "./contract.js";
import type { EvaluationResult } from "./data.js";
import type { Cell, Frame, Machine as EvaluationMachine, ReadyCall, Task } from "./pause.js";
import { arithmetic, evaluationFault, limit, step, validateLimits, valueFits } from "./budget.js";
import { EvaluationSuspension } from "./pause.js";

type Machine = EvaluationMachine<EvaluateDeps>;

const fail = (message: string, origin: Origin | null = null): never => throwInvariant({ owner: "evaluate", query: null, origin, message });
const current = (machine: Machine): Frame => requirePresent(machine.frames.at(-1), { owner: "evaluate", query: null, origin: null,
  message: "An active evaluation must have an executing frame." });

function finish(machine: Machine, value: EvaluationResult): void {
  machine.result = { kind: "ok", value, diagnostics: [], positions: [{ position: { kind: "result" }, error: null }], emissions: [] };
}

function notConstant(machine: Machine, site: MirSite, reason: Extract<EvaluationResult, { readonly kind: "not-constant" }>["reason"]): void {
  finish(machine, { kind: "not-constant", at: site.tir, reason });
}

function absorb(machine: Machine, unit: UnitRef, error: ErrorValue): void {
  if (error.causes.length === 0) return fail("An incoming error must have its original grounded cause.");
  const frame = machine.frames[0];
  machine.result = { kind: "ok", value: { kind: "value", value: { kind: "error", type: frame.body.result } }, diagnostics: [],
    positions: [{ position: { kind: "result" }, error: { kind: "error", causes: [{ kind: "unit", unit }] } }], emissions: [] };
}

function put(machine: Machine, value: ConstValue, site: MirSite): void {
  if (value.kind === "error") return fail("An error-valued dependency must supply its actual unit error position.", site.origin);
  if (valueFits(machine, value, "maximumIntermediateBits", site.origin)) current(machine).values.push(value);
}

function localPlace(machine: Machine, place: PlaceId, site: MirSite): LocalId | null {
  const frame = current(machine);
  for (let next = place;;) {
    const selected = frame.body.places[next];
    if (selected === undefined || selected.id !== next) return fail("A verified place must resolve in its executing frame.", site.origin);
    switch (selected.base.kind) {
      case "local": {
        const local = frame.body.locals[selected.base.local];
        if (local === undefined) return fail("A verified local place must name its actual local.", site.origin);
        if (localOwnershipOfMir(local.mode) === "external" && !frame.cells.has(local.id)) {
          notConstant(machine, site, "external-storage");
          return null;
        }
        return local.id;
      }
      case "static": notConstant(machine, site, "external-storage"); return null;
      case "checked":
        if (selected.base.projection.kind !== "refined") return fail("Evaluate has not implemented this selected checked projection.", site.origin);
        next = selected.base.place;
        break;
      default: return fail("Evaluate has not implemented this selected storage projection.", site.origin);
    }
  }
}

function read(machine: Machine, operand: MirOperand, site: MirSite): void {
  const frame = current(machine);
  if (operand.kind === "place") {
    const local = localPlace(machine, operand.place, site);
    if (local === null) return;
    const value = frame.cells.get(local)?.value;
    if (value === undefined || value === null) {
      const selected = frame.body.locals[local];
      if (value === undefined && (selected?.role.kind === "receiver" || selected?.role.kind === "capture"))
        return fail("Evaluate needs the actual selected incoming receiver or captured value.", site.origin);
      evaluationFault(machine, site.origin, "Constant evaluation reached a read of unwritten storage.");
      return;
    }
    put(machine, value, site);
    return;
  }
  const constant = frame.body.constants[operand.constant];
  if (constant === undefined) return fail("A verified constant operand must resolve in its actual frame.", site.origin);
  const selected = constant.value;
  switch (selected.kind) {
    case "literal":
      if (selected.value.kind === "number") put(machine, { kind: "number", value: selected.value.value, type: constant.type }, site);
      else if (selected.value.kind === "bigint") put(machine, { kind: "bigint", value: selected.value.value, type: constant.type }, site);
      else put(machine, { ...selected.value, type: constant.type }, site);
      return;
    case "constant":
      machine.pending = { request: { kind: "const-value", reference: selected.reference }, type: constant.type, site, call: null };
      return;
    case "observation":
      if (selected.at.body !== frame.instance.body) return fail("An observation must belong to the actual executing frame.", site.origin);
      machine.pending = { request: { kind: "observation-value", instance: frame.instance, at: selected.at }, type: constant.type, site, call: null };
      return;
    case "metadata": return fail("A metadata descriptor cannot be materialized by constant evaluation.", site.origin);
    case "definition": return fail("A selected definition constant needs its actual initializer association.", site.origin);
  }
}

function store(machine: Machine, local: LocalId, value: ConstValue): void {
  const frame = current(machine);
  const cell = frame.cells.get(local);
  if (cell === undefined) frame.cells.set(local, { value });
  else cell.value = value;
}

function returnValue(machine: Machine, value: ConstValue, site: MirSite): void {
  if (machine.frames.length === 1) {
    if (valueFits(machine, value, "maximumResultBits", site.origin)) finish(machine, { kind: "value", value });
    return;
  }
  machine.frames.pop();
  put(machine, value, site);
}

function unwind(machine: Machine, value: ConstValue, failure: MirUnwind, site: MirSite): void {
  for (;;) {
    if (failure.kind === "none") return fail("An operation marked unable to fail reached its failure arm.", site.origin);
    if (failure.kind === "abort") { evaluationFault(machine, site.origin, "A process-ending failure occurred during constant evaluation."); return; }
    if (failure.kind === "handler") {
      const frame = current(machine);
      const local = localPlace(machine, failure.exception, site);
      if (local === null) return;
      store(machine, local, value);
      frame.work.length = 0;
      frame.values = [];
      frame.block = failure.target;
      frame.statement = 0;
      return;
    }
    const caller = current(machine).caller;
    if (caller === null) { evaluationFault(machine, site.origin, "A thrown value escaped constant evaluation."); return; }
    machine.frames.pop();
    failure = caller.unwind;
  }
}

function selectBranch(machine: Machine, terminator: Extract<MirTerminator, { readonly kind: "switch" }>): void {
  const frame = current(machine);
  const operand = frame.values[0];
  if (operand === undefined) return fail("A verified branch must have its actual discriminant.", terminator.origin);
  frame.block = terminator.otherwise;
  frame.statement = 0;
  for (const target of terminator.targets) {
    const constant = frame.body.constants[target.constant];
    if (constant?.value.kind !== "literal") return fail("A verified switch case must name its literal constant.", terminator.origin);
    const value = constant.value.value;
    if (operand.kind !== "boolean" && operand.kind !== "absence") return fail("Evaluate needs the selected native discriminant relation.", terminator.origin);
    if (!arithmetic(machine, 2, terminator.origin)) return;
    if (operand.kind === value.kind && (operand.kind === "absence" || value.kind === "boolean" && operand.value === value.value)) {
      frame.block = target.target;
      return;
    }
  }
}

function call(machine: Machine, terminator: Extract<MirTerminator, { readonly kind: "call" }>): void {
  const frame = current(machine);
  const callee = terminator.callee;
  if (callee.kind === "indirect") return fail("Evaluate needs the actual selected callable value and its environment.", terminator.origin);
  const instance = callee.kind === "body" ? callee.instance : callee.resolution.activation;
  if (instance === null) { notConstant(machine, terminator, "external-operation"); return; }
  if (callee.kind === "direct" && callee.resolution.decision.activation !== null)
    return fail("Evaluate needs the selected native handle value and its activation.", terminator.origin);
  let position = 0;
  let receiver: ReadyCall["receiver"] = null;
  if (terminator.receiver !== null) {
    const value = requirePresent(frame.values[position++], {
      owner: "evaluate", query: null, origin: terminator.origin, message: "A call must retain its actual receiver." });
    let cell: Cell | null = null;
    if (terminator.receiver.kind === "place") {
      const local = localPlace(machine, terminator.receiver.place, terminator);
      if (local === null) return;
      cell = frame.cells.get(local) ?? null;
    }
    receiver = { value, cell };
  }
  const arguments_: (Cell | null)[] = [];
  for (const argument of terminator.arguments) {
    if (argument.kind === "omitted") arguments_.push(null);
    else if (argument.kind === "value") arguments_.push({ value: requirePresent(frame.values[position++], {
      owner: "evaluate", query: null, origin: terminator.origin, message: "A call must retain each actual argument." }) });
    else {
      const local = localPlace(machine, argument.place, terminator);
      if (local === null) return;
      let cell = frame.cells.get(local);
      if (cell === undefined) { cell = { value: null }; frame.cells.set(local, cell); }
      arguments_.push(cell);
    }
  }
  const captures = new Map<BodyId, Map<LocalId, Cell>>();
  if (callee.kind === "body") for (const capture of callee.captures) {
    const local = localPlace(machine, capture.place, terminator);
    if (local === null) return;
    let cell = frame.cells.get(local);
    if (cell === undefined) { cell = { value: null }; frame.cells.set(local, cell); }
    if (capture.capture === null) return fail("An instantiated callee must have its actual capture decision.", terminator.origin);
    if (capture.capture === "captured-value") {
      if (cell.value === null) { evaluationFault(machine, terminator.origin, "Constant evaluation captured unwritten storage by value."); return; }
      cell = { value: cell.value };
    }
    let bodyCaptures = captures.get(capture.local.body);
    if (bodyCaptures === undefined) { bodyCaptures = new Map(); captures.set(capture.local.body, bodyCaptures); }
    bodyCaptures.set(capture.local.local, cell);
  }
  frame.work.push({ kind: "jump", block: terminator.next });
  if (terminator.destination !== null) {
    const local = localPlace(machine, terminator.destination, terminator);
    if (local === null) return;
    frame.work.push({ kind: "store", local, site: terminator });
  }
  machine.pending = { request: { kind: "mir-body", instance }, type: null, site: terminator,
    call: { terminator, arguments: arguments_, receiver, captures } };
}

function enter(machine: Machine, instance: BodyInstance, body: MirBody, ready: ReadyCall): void {
  if (instance.bindings.kind !== "instantiated" || !sameInstance(instance, { body: body.body, bindings: body.bindings }))
    return fail("A body answer must be the exact requested complete callee instance.", ready.terminator.origin);
  const full = body.entries[0];
  if (full === undefined) return fail("A verified callee must publish its full fixed-argument entry.", ready.terminator.origin);
  let provided = full.provided;
  while (provided > 0 && ready.arguments[provided - 1] === null) provided -= 1;
  if (ready.arguments.length < full.provided) return fail("A selected call must carry every fixed argument or explicit omission.", ready.terminator.origin);
  const entry = body.entries.find(entry => entry.provided === provided);
  if (entry === undefined) return fail("A selected call must name an actually admissible provided entry.", ready.terminator.origin);
  const frame: Frame = { instance, body, cells: new Map(), work: [], values: [], caller: ready.terminator, block: entry.block, statement: 0 };
  for (const local of body.locals) {
    let cell: Cell | null | undefined;
    if (local.role.kind === "parameter") cell = ready.arguments[local.role.index];
    else if (local.role.kind === "receiver") {
      const ownership = localOwnershipOfMir(local.mode);
      if (ownership === "undecided") return fail("A selected receiver must have its complete storage mode.", local.origin);
      cell = ready.receiver === null ? null : ownership === "body" ? { value: ready.receiver.value } : ready.receiver.cell;
    }
    else if (local.role.kind === "capture" && local.source !== null) cell = ready.captures.get(local.source.body)?.get(local.source.local);
    else continue;
    if (cell === null && local.role.kind === "parameter") continue;
    if (cell === undefined || cell === null) return fail("Evaluate needs the selected callee's actual incoming storage association.", local.origin);
    frame.cells.set(local.id, cell);
  }
  machine.frames.push(frame);
}

function execute(machine: Machine): void {
  const task = current(machine).work.pop();
  if (task !== undefined) {
    if (task.kind === "read") read(machine, task.operand, task.site);
    else if (task.kind === "jump") { current(machine).block = task.block; current(machine).statement = 0; }
    else if (task.kind === "apply") apply(machine, task.operation, task.site);
    else if (task.kind === "switch") selectBranch(machine, task.terminator);
    else if (task.kind === "call") call(machine, task.terminator);
    else if (task.kind === "throw") {
      const value = requirePresent(current(machine).values.at(-1), { owner: "evaluate", query: null, origin: task.site.origin,
        message: "A throw continuation must retain its actual evaluated value." });
      unwind(machine, value, task.unwind, task.site);
    }
    else {
      const value = requirePresent(current(machine).values.at(-1), { owner: "evaluate", query: null, origin: task.site.origin,
        message: "An evaluation continuation must have its actual evaluated operand." });
      if (task.kind === "store") store(machine, task.local, value);
      else returnValue(machine, value, task.site);
    }
    return;
  }
  const frame = current(machine);
  frame.values = [];
  const block = frame.body.blocks[frame.block];
  if (block === undefined || block.id !== frame.block) return fail("A verified evaluation edge must target its actual block.");
  const statement = block.statements[frame.statement];
  if (statement !== undefined) {
    if (!step(machine, statement.origin)) return;
    frame.statement += 1;
    if (statement.kind === "storage-live") frame.cells.set(statement.local, { value: null });
    else if (statement.kind === "storage-dead") frame.cells.delete(statement.local);
    else {
      const local = localPlace(machine, statement.place, statement);
      if (local === null) return;
      frame.work.push({ kind: "store", local, site: statement });
      switch (statement.value.kind) {
        case "use": frame.work.push({ kind: "read", operand: statement.value.operand, site: statement }); break;
        case "unary": case "convert":
          frame.work.push({ kind: "apply", operation: statement.value.operation, site: statement }, { kind: "read", operand: statement.value.operand, site: statement });
          break;
        case "binary":
          frame.work.push({ kind: "apply", operation: statement.value.operation, site: statement },
            { kind: "read", operand: statement.value.right, site: statement }, { kind: "read", operand: statement.value.left, site: statement });
          break;
        default: return fail("Evaluate has not implemented this selected rvalue.", statement.origin);
      }
    }
    return;
  }
  const terminator = block.terminator;
  if (!step(machine, terminator.origin)) return;
  switch (terminator.kind) {
    case "goto": frame.block = terminator.target; frame.statement = 0; return;
    case "return":
      if (terminator.value === null) {
        const value: ConstValue = { kind: "absence", type: frame.body.result };
        returnValue(machine, value, terminator);
      } else frame.work.push({ kind: "return", site: terminator }, { kind: "read", operand: terminator.value, site: terminator });
      return;
    case "throw":
      frame.work.push({ kind: "throw", site: terminator, unwind: terminator.unwind }, { kind: "read", operand: terminator.operand, site: terminator });
      return;
    case "await": case "yield": case "delegate": notConstant(machine, terminator, "suspension"); return;
    case "call":
      frame.work.push({ kind: "call", terminator });
      for (let position = terminator.arguments.length - 1; position >= 0; position -= 1) {
        const argument = terminator.arguments[position];
        if (argument === undefined) return fail("A verified call must have its complete argument vector.", terminator.origin);
        if (argument.kind === "value") frame.work.push({ kind: "read", operand: argument.operand, site: terminator });
      }
      if (terminator.receiver !== null) frame.work.push({ kind: "read", operand: terminator.receiver, site: terminator });
      if (terminator.callee.kind === "indirect") frame.work.push({ kind: "read", operand: terminator.callee.operand, site: terminator });
      return;
    case "switch": frame.work.push({ kind: "switch", terminator }, { kind: "read", operand: terminator.operand, site: terminator }); return;
    case "invoke":
      frame.work.push({ kind: "jump", block: terminator.next });
      if (terminator.destination !== null) {
        const local = localPlace(machine, terminator.destination, terminator);
        if (local === null) return;
        frame.work.push({ kind: "store", local, site: terminator });
      }
      frame.work.push({ kind: "apply", operation: terminator.operation, site: terminator });
      for (let position = terminator.operands.length - 1; position >= 0; position -= 1) {
        const operand = terminator.operands[position];
        if (operand === undefined) return fail("A verified invocation must have its complete operand vector.", terminator.origin);
        frame.work.push({ kind: "read", operand, site: terminator });
      }
      return;
    case "unreachable": return fail("A verified constant execution reached an unreachable terminator.", terminator.origin);
    default: return fail(`Evaluate has not implemented the selected ${terminator.kind} terminator.`, terminator.origin);
  }
}

function apply(machine: Machine, selected: Extract<Task, { readonly kind: "apply" }>["operation"], site: MirSite): void {
  const operation = selected.decision.operation;
  if (operation.kind === "library" || operation.kind === "core") {
    notConstant(machine, site, "external-operation");
    return;
  }
  if (operation.kind === "discard") {
    put(machine, { kind: "absence", type: selected.decision.result }, site);
    return;
  }
  if (operation.kind !== "boolean-operator" && operation.kind !== "absence-test") return fail("Evaluate needs the actual selected native operation law.", site.origin);
  const first = current(machine).values[0];
  if (first === undefined) return fail("A selected boolean operation must have its actual operand.", site.origin);
  if (machine.deps.limits.maximumIntermediateBits < 1) { limit(machine, "maximumIntermediateBits", site.origin); return; }
  if (!arithmetic(machine, current(machine).values.length, site.origin)) return;
  let value: boolean;
  if (operation.kind === "absence-test") value = operation.negated ? first.kind !== "absence" : first.kind === "absence";
  else {
    if (first.kind !== "boolean") return fail("A selected boolean operation must receive its verified boolean value.", site.origin);
    if (operation.operator === "!") value = !first.value;
    else {
      const second = current(machine).values[1];
      if (second?.kind !== "boolean") return fail("A selected binary boolean operation must receive two verified boolean values.", site.origin);
      value = operation.operator === "&&" ? first.value && second.value : operation.operator === "||" ? first.value || second.value
        : operation.operator === "==" || operation.operator === "===" ? first.value === second.value : first.value !== second.value;
    }
  }
  put(machine, { kind: "boolean", value, type: selected.decision.result }, site);
}

function run(machine: Machine): EvaluationStep {
  for (;;) {
    if (machine.result !== null) return { kind: "done", value: machine.result };
    const pending = machine.pending;
    if (pending !== null) return { kind: "paused", requests: [pending.request], paused: { continuation: EvaluationSuspension.create(machine), witness: {
      instance: current(machine).instance, site: pending.site, request: pending.request, type: pending.type,
      ready: { values: current(machine).values, count: current(machine).values.length },
    } }, earned: [] };
    execute(machine);
  }
}

export const evaluate: Evaluate = (deps, entry, body, arguments_, context, unit) => {
  validateLimits(deps.limits);
  if (entry.bindings.kind !== "instantiated" || !sameInstance(entry, { body: body.body, bindings: body.bindings }))
    return fail("Evaluate needs the actual complete verified entry instance.");
  let selected: BlockId | null = null;
  for (const entry of body.entries) if (entry.provided === arguments_.length) selected = entry.block;
  if (selected === null) return fail("The constant invocation must name an actually provided entry.");
  const frame: Frame = { instance: entry, body, cells: new Map(), work: [], values: [], caller: null, block: selected, statement: 0 };
  const machine: Machine = { deps, context, unit, frames: [frame], steps: 0, arithmetic: 0, result: null, pending: null };
  for (const local of body.locals) {
    if (local.role.kind !== "parameter") continue;
    const value = arguments_[local.role.index];
    if (value === undefined) continue;
    if (!valueFits(machine, value, "maximumIntermediateBits", local.origin)) return run(machine);
    if (localOwnershipOfMir(local.mode) === "body") frame.cells.set(local.id, { value });
  }
  return run(machine);
};

export const resumeEvaluate: ResumeEvaluate = (deps, paused, answers) => {
  const machine = EvaluationSuspension.consume(paused.continuation);
  if (deps !== machine.deps) return fail("Evaluate must resume against the same actual run views and limits.");
  const pending = machine.pending;
  if (pending === null || paused.witness.request !== pending.request || paused.witness.site !== pending.site
    || paused.witness.instance !== current(machine).instance || paused.witness.type !== pending.type
    || paused.witness.ready.values !== current(machine).values || paused.witness.ready.count !== current(machine).values.length)
    return fail("Evaluate must resume its actual immutable pending witness.");
  const answer = answers[0];
  if (answers.length !== 1 || answer === undefined || answer.kind !== pending.request.kind)
    return fail("Evaluate must receive exactly the answer to its one pending request.");
  machine.pending = null;
  if (answer.kind === "mir-body") {
    if (pending.request.kind !== "mir-body" || pending.call === null) return fail("A body answer needs its actual pending call.");
    enter(machine, pending.request.instance, answer.body, pending.call);
    return run(machine);
  }
  if (pending.type === null) return fail("A semantic value answer needs its actual selected result type.");
  const expected = encodeKey(unitPositionData(answer.unit.position));
  const position = answer.value.positions.find(position => encodeKey(unitPositionData(position.position)) === expected);
  if (position === undefined) return fail("A semantic answer must carry its actual result position.");
  if (position.error !== null) absorb(machine, answer.unit, position.error);
  else if (answer.kind === "observation-value") {
    if (answer.value.value.kind === "error") return fail("An error-valued observation needs its actual original error position.", pending.site.origin);
    put(machine, { kind: "number", type: pending.type,
      value: { numerator: answer.value.value.value, denominator: 1n, negativeZero: false } }, pending.site);
  }
  else if (answer.value.value.kind === "not-constant") finish(machine, answer.value.value);
  else {
    if (answer.value.value.value.type !== pending.type) return fail("A constant answer must retain its actual selected result type.", pending.site.origin);
    put(machine, answer.value.value.value, pending.site);
  }
  return run(machine);
};
