import type { ErrorValue, UnitRef } from "../diag/contract.js";
import { requirePresent, throwInvariant, unitPositionData } from "../diag/index.js";
import type { BlockId, BodyId, LocalId, Origin, PlaceId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { MirBody, MirOperand, MirSite, MirTerminator, MirUnwind } from "../ir-mir/contract.js";
import { localOwnershipOfMir } from "../ir-mir/index.js";
import type { OperationIdentity } from "../ir-infer/contract.js";
import type { BodyInstance, ConstValue, ExactRational } from "../ir-types/contract.js";
import { nativeCarrierOf, sameInstance } from "../ir-types/index.js";
import type { Evaluate, EvaluateDeps, EvaluationStep, ResumeEvaluate } from "./contract.js";
import type { Cell, Frame, Machine as EvaluationMachine, ReadyCall, Task, UnwindSignal } from "./pause.js";
import { arithmetic, evaluationFault, limit, selectedFloatingFormat, selectedOptionalDomain, step, validateLimits, valueFits } from "./budget.js";
import { current, enterUnwind, finish, notConstant, takeCarriedFailure, transferCleanup } from "./execution.js";
import { EvaluationSuspension } from "./pause.js";
import { nativeNumericOperation } from "./integer.js";
import { packFloat64Literal, selectedConversion } from "./conversions.js";

type Machine = EvaluationMachine<EvaluateDeps>;

const fail = (message: string, origin: Origin | null = null): never => throwInvariant({ owner: "evaluate", query: null, origin, message });
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

function materializeFloat64(machine: Machine, value: ExactRational, selected: TyId, site: MirSite,
  source: "authored" | "observation"): ConstValue | null {
  const format = selectedFloatingFormat(machine, "float64", site.origin);
  if (format === null) return null;
  const bits = packFloat64Literal(machine, value, value, site, format, source);
  return bits === null ? null : { kind: "floating", type: selected, bits };
}

function putNumber(machine: Machine, value: ExactRational, selected: TyId, site: MirSite,
  source: "authored" | "observation"): void {
  if (!arithmetic(machine, 1, site.origin)) return;
  if (!Number.isSafeInteger(selected) || selected < 0 || Object.is(selected, -0) || selected >= machine.deps.types.terms.length)
    return fail("A numeric literal requires its actual ready type domain.", site.origin);
  const type = machine.deps.typeOf(selected);
  if (type === undefined) return fail("A numeric literal requires a complete ready type row.", site.origin);
  if (type.kind === "primitive" && type.primitive === "float64") {
    const packed = materializeFloat64(machine, value, selected, site, source);
    if (packed !== null) put(machine, packed, site);
    return;
  }
  const result: ConstValue = { kind: "number", value, type: selected };
  if (type.kind === "literal" && type.value.kind === "number")
    (machine.pendingNumericLiterals ??= new Map()).set(result, { base: type.base, source });
  put(machine, result, site);
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
      if (selected.value.kind === "number") putNumber(machine, selected.value.value, constant.type, site, "authored");
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

function returnValue(machine: Machine, value: ConstValue | null, site: MirSite): void {
  const frame = current(machine);
  if (frame.cleanups !== null || frame.carriedFailure !== null) return fail("A return cannot bypass a pending completion.", site.origin);
  const caller = frame.caller;
  if (caller === null) {
    let result: ConstValue = value ?? { kind: "absence", type: frame.body.result };
    const pending = result.kind === "number" ? machine.pendingNumericLiterals?.get(result) : undefined;
    if (result.kind === "number" && pending !== undefined) {
      const carrier = nativeCarrierOf(machine.deps.types, pending.base, type =>
        arithmetic(machine, 1, site.origin) ? machine.deps.typeOf(type) : null);
      if (carrier.kind === "resource-stop") return;
      if (carrier.kind === "primitive" && carrier.primitive === "float64") {
        const packed = materializeFloat64(machine, result.value, result.type, site, pending.source);
        if (packed === null) return;
        result = packed;
      }
    }
    if (valueFits(machine, result, "maximumResultBits", site.origin)) finish(machine, { kind: "value", value: result });
    return;
  }
  machine.frames.pop();
  if (caller.destination === null) return;
  if (value === null) return fail("A call destination requires its actual returned value.", site.origin);
  put(machine, value, site);
}

function unwindValue(machine: Machine, failure: MirUnwind, signal: UnwindSignal): void {
  const handler = enterUnwind(machine, failure, signal);
  if (handler === null || handler.exception === null || signal.kind !== "value") return;
  const local = localPlace(machine, handler.exception, signal.site);
  if (local !== null) store(machine, local, signal.value);
}

function selectBranch(machine: Machine, terminator: Extract<MirTerminator, { readonly kind: "switch" }>): void {
  const frame = current(machine);
  const operand = frame.values[0];
  if (operand === undefined) return fail("A verified branch must have its actual discriminant.", terminator.origin);
  frame.block = terminator.otherwise;
  frame.statement = 0;
  for (let position = 0; position < terminator.targets.length; position += 1) {
    if (!arithmetic(machine, 2, terminator.origin)) return;
    const target = terminator.targets[position];
    if (target === undefined) return fail("A verified switch must have its complete target vector.", terminator.origin);
    const constant = frame.body.constants[target.constant];
    if (constant?.value.kind !== "literal") return fail("A verified switch case must name its literal constant.", terminator.origin);
    const value = constant.value.value;
    if (value.kind === "absence" && constant.type !== operand.type)
      return fail("Evaluate needs the selected native discriminant relation.", terminator.origin);
    if (operand.kind !== "boolean" && operand.kind !== "absence") {
      if (value.kind !== "absence") return fail("Evaluate needs the selected native discriminant relation.", terminator.origin);
      const domain = selectedOptionalDomain(machine, operand.type, terminator.origin);
      if (domain.kind === "resource-stop") return;
      if (domain.kind !== "optional-value" || domain.payload !== (operand.kind === "floating" ? "float64" : operand.kind))
        return fail("Evaluate needs the selected native discriminant relation.", terminator.origin);
      continue;
    }
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
  let provided = ready.arguments.length;
  while (provided > 0 && ready.arguments[provided - 1] === null) provided -= 1;
  const entry = body.entries.find(entry => entry.provided === provided);
  if (entry === undefined) return fail("A selected call must name an actually admissible provided entry.", ready.terminator.origin);
  const frame: Frame = { instance, body, cells: new Map(), work: [], values: [], caller: ready.terminator, block: entry.block, statement: 0,
    cleanups: null, carriedFailure: null };
  let parameters = 0;
  for (const local of body.locals) {
    let cell: Cell | null | undefined;
    if (local.role.kind === "parameter") {
      parameters += 1;
      cell = ready.arguments[local.role.index];
    }
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
  if (parameters !== ready.arguments.length)
    return fail("A selected call must carry every fixed argument or explicit omission.", ready.terminator.origin);
  machine.frames.push(frame);
}

function execute(machine: Machine): void {
  const task = current(machine).work.pop();
  if (task !== undefined) {
    if (task.kind === "read") read(machine, task.operand, task.site);
    else if (task.kind === "jump") { current(machine).block = task.block; current(machine).statement = 0; }
    else if (task.kind === "apply") apply(machine, task.operation, task.site, task.unwind);
    else if (task.kind === "switch") selectBranch(machine, task.terminator);
    else if (task.kind === "call") call(machine, task.terminator);
    else if (task.kind === "throw") {
      const value = requirePresent(current(machine).values.at(-1), { owner: "evaluate", query: null, origin: task.site.origin,
        message: "A throw continuation must retain its actual evaluated value." });
      unwindValue(machine, task.unwind, { kind: "value", value, site: task.site });
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
          frame.work.push({ kind: "apply", operation: statement.value.operation, site: statement, unwind: null }, { kind: "read", operand: statement.value.operand, site: statement });
          break;
        case "binary":
          frame.work.push({ kind: "apply", operation: statement.value.operation, site: statement, unwind: null },
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
      if (terminator.value === null) returnValue(machine, null, terminator);
      else frame.work.push({ kind: "return", site: terminator }, { kind: "read", operand: terminator.value, site: terminator });
      return;
    case "throw":
      frame.work.push({ kind: "throw", site: terminator, unwind: terminator.unwind }, { kind: "read", operand: terminator.operand, site: terminator });
      return;
    case "cleanup-enter": case "cleanup-resume": case "cleanup-discard": transferCleanup(frame, terminator); return;
    case "unwind-propagate": unwindValue(machine, terminator.unwind, takeCarriedFailure(frame, terminator)); return;
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
      frame.work.push({ kind: "apply", operation: terminator.operation, site: terminator, unwind: terminator.unwind });
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


function stringOperation(
  machine: Machine, operation: Extract<OperationIdentity, { readonly kind: "string-operator" }>,
  result: ConstValue["type"], site: MirSite,
): void {
  if (operation.operator !== "+" && operation.operator !== "==" && operation.operator !== "!=" && operation.operator !== "===" && operation.operator !== "!==")
    return fail("Evaluate needs the actual selected native string operation law.", site.origin);
  const values = current(machine).values;
  const left = values[0];
  const right = values[1];
  if (values.length !== 2 || left?.kind !== "string" || right?.kind !== "string")
    return fail("A selected string comparison requires its two actual string operands.", site.origin);
  if (operation.operator === "+") {
    const maximum = Math.floor(machine.deps.limits.maximumIntermediateBits / 16);
    if (left.value.length > maximum - right.value.length) { limit(machine, "maximumIntermediateBits", site.origin); return; }
  } else if (machine.deps.limits.maximumIntermediateBits < 1) { limit(machine, "maximumIntermediateBits", site.origin); return; }
  if (!arithmetic(machine, left.value.length, site.origin) || !arithmetic(machine, right.value.length, site.origin)
    || !arithmetic(machine, 1, site.origin)) return;
  if (operation.operator === "+") {
    put(machine, { kind: "string", type: result, value: left.value + right.value }, site);
    return;
  }
  const equal = left.value === right.value;
  put(machine, { kind: "boolean", type: result,
    value: operation.operator === "==" || operation.operator === "===" ? equal : !equal }, site);
}


function nativeBooleanCarrier(machine: Machine, type: TyId, site: MirSite): boolean {
  const selected = nativeCarrierOf(machine.deps.types, type, current => {
    if (!arithmetic(machine, 1, site.origin)) return null;
    return machine.deps.typeOf(current);
  });
  if (selected.kind === "resource-stop") return false;
  if (selected.kind !== "primitive" || selected.primitive !== "bool")
    return fail("Evaluate needs the actual selected native boolean carrier association.", site.origin);
  return true;
}

function apply(machine: Machine, selected: Extract<Task, { readonly kind: "apply" }>["operation"], site: MirSite, unwind: MirUnwind | null): void {
  const operation = selected.decision.operation;
  if (operation.kind === "library" || operation.kind === "core") {
    notConstant(machine, site, "external-operation");
    return;
  }
  if (operation.kind === "discard") {
    put(machine, { kind: "absence", type: selected.decision.result }, site);
    return;
  }
  if (operation.kind === "conversion") {
    const value = selectedConversion(machine, operation, selected.decision.result, site, current(machine).values);
    if (value !== null) put(machine, value, site);
    return;
  }
  const nativeBoolean = operation.kind === "native-operator" && operation.carrier === "bool" && operation.operator === "!";
  if (operation.kind === "native-operator" && !nativeBoolean) {
    const value = nativeNumericOperation(machine, operation, selected.decision.result, site, unwind, current(machine).values);
    if (value !== null) put(machine, value, site);
    return;
  }
  if (operation.kind === "string-operator") {
    stringOperation(machine, operation, selected.decision.result, site);
    return;
  }
  if (!nativeBoolean && operation.kind !== "boolean-operator" && operation.kind !== "absence-test") return fail("Evaluate needs the actual selected native operation law.", site.origin);
  const first = current(machine).values[0];
  if (first === undefined) return fail("A selected boolean operation must have its actual operand.", site.origin);
  if (machine.deps.limits.maximumIntermediateBits < 1) { limit(machine, "maximumIntermediateBits", site.origin); return; }
  if (!arithmetic(machine, current(machine).values.length, site.origin)) return;
  let value: boolean;
  if (operation.kind === "absence-test") value = operation.negated ? first.kind !== "absence" : first.kind === "absence";
  else {
    if (first.kind !== "boolean") return fail("A selected boolean operation must receive its verified boolean value.", site.origin);
    if (nativeBoolean && (!nativeBooleanCarrier(machine, selected.decision.result, site) || !nativeBooleanCarrier(machine, first.type, site))) return;
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
  const frame: Frame = { instance: entry, body, cells: new Map(), work: [], values: [], caller: null, block: selected, statement: 0,
    cleanups: null, carriedFailure: null };
  const machine: Machine = { deps, context, unit, frames: [frame], steps: 0, arithmetic: 0,
    pendingNumericLiterals: null, result: null, pending: null };
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
    putNumber(machine, { numerator: answer.value.value.value, denominator: 1n, negativeZero: false }, pending.type, pending.site, "observation");
  }
  else if (answer.value.value.kind === "not-constant") finish(machine, answer.value.value);
  else {
    if (answer.value.value.value.type !== pending.type) return fail("A constant answer must retain its actual selected result type.", pending.site.origin);
    put(machine, answer.value.value.value, pending.site);
  }
  return run(machine);
};
