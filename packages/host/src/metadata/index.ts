import type { ErrorValue, UnitResult } from "../diag/contract.js";
import { hostDiagnosticCode, throwInvariant } from "../diag/index.js";
import type { DefId, Origin } from "../ids/contract.js";
import type { LayoutAnswer, LayoutDeps, LayoutOf, LayoutRequest, LayoutStep, MaterializeMetadata, ReadyLayout, ReadyLayoutField, ResumeLayout } from "./contract.js";
import { materializeMetadata as materialize } from "./materialize.js";

export const materializeMetadata: MaterializeMetadata = materialize;

type Refusal = Extract<UnitResult<never>, { readonly kind: "refused" }>;
type Completed<Value> = { readonly kind: "complete"; readonly value: Value };

function invariant(message: string): never {
  return throwInvariant({ owner: "metadata", query: null, origin: null, message });
}

function refused(value: Refusal): LayoutStep {
  return { kind: "done", value };
}

function invalid(origin: Origin, message: string): LayoutStep {
  const name = hostDiagnosticCode("TSONIC_CONSTANT_EVALUATION_FAILED");
  return refused({ kind: "refused", diagnostics: [{ code: { kind: "host", name, rendered: name }, severity: "error",
    site: { kind: "source", origin }, source: "metadata", evidence: [], message, arguments: [], related: [], fix: null }] });
}

function ready(value: ReadyLayout | ErrorValue): LayoutStep {
  return { kind: "done", value: { kind: "ok", value, diagnostics: [],
    positions: [{ position: { kind: "result" }, error: value.kind === "error" ? value : null }], emissions: [] } };
}

function meter(deps: LayoutDeps, origin: Origin, spent: number) {
  return {
    used: () => spent,
    admit: (work: number, records = 0): Refusal | null => {
      const maximum = deps.limits.maximumWork;
      if (work > maximum - spent) return deps.limit(origin, "work", maximum);
      const stop = deps.admit(work, records);
      if (stop === null) spent += work;
      return stop;
    },
    geometry: (bits: number): Refusal | null => bits > deps.limits.maximumGeometryBits
      ? deps.limit(origin, "geometry-bits", deps.limits.maximumGeometryBits) : null,
  };
}

export const layoutOf: LayoutOf = (deps, declaration) => {
  const work = meter(deps, declaration.origin, 0);
  const setup = work.admit(1, 2);
  if (setup !== null) return refused(setup);
  if (declaration.kind === "data-layout") return ready(declaration);
  const pending = work.admit(1, 2);
  if (pending !== null) return refused(pending);
  const requests: [LayoutRequest, ...LayoutRequest[]] = declaration.kind === "field"
    ? [{ kind: "descriptor", key: declaration.child }] : [{ kind: "descriptor", key: declaration.abi }];
  const constant = (read: () => Extract<LayoutRequest, { readonly kind: "constant" }>["reference"]): Refusal | null => {
    const stop = work.admit(1, 1);
    if (stop === null) requests.push({ kind: "constant", reference: read() });
    return stop;
  };
  const descriptor = (read: () => Extract<LayoutRequest, { readonly kind: "descriptor" }>["key"]): Refusal | null => {
    const stop = work.admit(1, 1);
    if (stop === null) requests.push({ kind: "descriptor", key: read() });
    return stop;
  };
  if (declaration.kind === "field") {
    const stop = constant(() => declaration.byteOffset) ?? constant(() => declaration.byteAlignment);
    if (stop !== null) return refused(stop);
  } else {
    const stop = constant(() => declaration.measures.byteSize) ?? constant(() => declaration.measures.byteAlignment)
      ?? constant(() => declaration.measures.stride);
    if (stop !== null) return refused(stop);
    if (declaration.kind === "array") {
      const stopped = constant(() => declaration.length) ?? descriptor(() => declaration.element);
      if (stopped !== null) return refused(stopped);
    } else {
      for (let position = 0; position < declaration.fields.length; position += 1) {
        const stopped = descriptor(() => declaration.fields[position] ?? invariant("Layout fields must be dense."));
        if (stopped !== null) return refused(stopped);
      }
    }
  }
  return { kind: "paused", requests, paused: { declaration, requests, work: work.used() }, earned: [] };
};

function powerOfTwo(value: bigint): boolean {
  return value > 0n && (value & (value - 1n)) === 0n;
}

export const resumeLayout: ResumeLayout = (deps, paused, answers) => {
  const { declaration, requests } = paused;
  const origin = declaration.origin;
  const work = meter(deps, origin, paused.work);
  const setup = work.admit(1, 2);
  if (setup !== null) return refused(setup);
  if (answers.length !== requests.length) return invariant("Layout must receive the exact answers to its pending operands.");
  let cursor = 0;
  const pull = (): Completed<LayoutAnswer> | { readonly kind: "stop"; readonly result: LayoutStep } => {
    const stop = work.admit(1);
    if (stop !== null) return { kind: "stop", result: refused(stop) };
    const answer = answers[cursor];
    const expected = requests[cursor];
    cursor += 1;
    if (answer === undefined || expected === undefined || answer.request !== expected)
      return invariant("Layout must receive each answer at the request that produced it.");
    if (answer.kind === "grounded-error")
      return { kind: "stop", result: ready({ kind: "error", causes: [{ kind: "unit", unit: answer.unit }] }) };
    if (answer.kind === "not-constant")
      return { kind: "stop", result: invalid(answer.origin, "A layout geometry operand must complete as a constant.") };
    return { kind: "complete", value: answer };
  };
  const descriptor = (): Completed<ReadyLayout> | { readonly kind: "stop"; readonly result: LayoutStep } => {
    const answer = pull();
    if (answer.kind !== "complete") return answer;
    if (answer.value.kind !== "descriptor" || answer.value.request.kind !== "descriptor")
      return invariant("A requested layout descriptor received a different answer kind.");
    const match = deps.matchesKey(answer.value.request.key, answer.value.value.key);
    if (match.kind === "refused") return { kind: "stop", result: refused(match) };
    if (!match.matches) return invariant("A layout answer must belong to the requested declaration and complete bindings.");
    return { kind: "complete", value: answer.value.value };
  };
  const quantity = (bits: number): Completed<bigint> | { readonly kind: "stop"; readonly result: LayoutStep } => {
    const bound = work.geometry(bits);
    if (bound !== null) return { kind: "stop", result: refused(bound) };
    const answer = pull();
    if (answer.kind !== "complete") return answer;
    if (answer.value.kind !== "constant" || answer.value.request.kind !== "constant")
      return invariant("A requested layout constant received a different answer kind.");
    const stop = work.admit(bits);
    if (stop !== null) return { kind: "stop", result: refused(stop) };
    const constant = answer.value.value;
    if (constant.kind === "error") return invariant("A layout needs its originating completed error position.");
    const value = constant.kind === "bigint" ? constant.value
      : constant.kind === "number" && constant.value.denominator === 1n ? constant.value.numerator : null;
    return value !== null && BigInt.asUintN(bits, value) === value
      ? { kind: "complete", value }
      : { kind: "stop", result: invalid(origin, "An exact nonnegative integer must fit the selected layout address domain.") };
  };
  const base = descriptor();
  if (base.kind !== "complete") return base.result;
  if (declaration.kind === "field") {
    const child = base.value;
    if (child.kind !== "value" && child.kind !== "array") return invalid(origin, "A field requires its actual physical child layout.");
    const bits = child.abi.addressWidth;
    const offset = quantity(bits);
    if (offset.kind !== "complete") return offset.result;
    const alignment = quantity(bits);
    if (alignment.kind !== "complete") return alignment.result;
    const stop = work.admit(bits, 1);
    if (stop !== null) return refused(stop);
    if (!powerOfTwo(alignment.value) || offset.value % alignment.value !== 0n || declaration.value !== child.source)
      return invalid(origin, "A physical field must retain its selected value type and a correctly aligned offset.");
    const { key, occurrence, owner, value, selector, selection, member } = declaration;
    return ready({ key, occurrence, origin, kind: "field", owner, value, selector, selection, member, child,
      byteOffset: offset.value, byteAlignment: alignment.value });
  }
  const abi = base.value;
  if (abi.kind !== "data-layout") return invalid(origin, "The layout requires its actual registered platform descriptor.");
  const bits = abi.addressWidth;
  const size = quantity(bits);
  if (size.kind !== "complete") return size.result;
  const alignment = quantity(bits);
  if (alignment.kind !== "complete") return alignment.result;
  const stride = quantity(bits);
  if (stride.kind !== "complete") return stride.result;
  const geometry = work.admit(bits, 1);
  if (geometry !== null) return refused(geometry);
  if (!powerOfTwo(alignment.value) || stride.value < size.value || stride.value % alignment.value !== 0n)
    return invalid(origin, "A layout stride must contain the value and preserve its exact positive power-of-two alignment.");
  const { key, occurrence, source } = declaration;
  const sourceRead = work.admit(1);
  if (sourceRead !== null) return refused(sourceRead);
  const type = deps.typeOf(source);
  if (type === null) return invariant("A layout must retain its checked source type.");
  const header = { key, occurrence, origin, source, abi, byteSize: size.value, byteAlignment: alignment.value, stride: stride.value };
  if (declaration.kind === "array") {
    const length = quantity(bits);
    if (length.kind !== "complete") return length.result;
    const element = descriptor();
    if (element.kind !== "complete") return element.result;
    const stopped = work.admit(bits * 2, 1);
    if (stopped !== null) return refused(stopped);
    const child = element.value;
    if ((child.kind !== "value" && child.kind !== "array") || child.abi !== abi || type.kind !== "fixed-array" ||
      type.element !== child.source || type.extent.length !== length.value || type.extent.runtimeBase !== declaration.runtimeBase ||
      length.value > 0n && ((length.value - 1n) * child.stride + child.byteSize > size.value ||
        alignment.value % child.byteAlignment !== 0n))
      return invalid(origin, "An array must contain its actual element layout in the same selected platform descriptor.");
    return ready({ ...header, kind: "array", element: child, length: length.value, runtimeBase: declaration.runtimeBase });
  }
  const retained = work.admit(1, 3);
  if (retained !== null) return refused(retained);
  const fields: ReadyLayoutField[] = [];
  const members = new Set<DefId>();
  for (let position = 0; position < declaration.fields.length; position += 1) {
    const received = descriptor();
    if (received.kind !== "complete") return received.result;
    const stopped = work.admit(bits, 2);
    if (stopped !== null) return refused(stopped);
    const field = received.value;
    if (field.kind !== "field" || field.child.abi !== abi || field.owner !== source || field.member.primary === null ||
      members.has(field.member.primary) || field.byteOffset > size.value - field.child.byteSize ||
      alignment.value % field.byteAlignment !== 0n)
      return invalid(origin, "A physical field must retain a unique selected member and fit its own containing layout.");
    members.add(field.member.primary);
    fields.push(field);
  }
  if (fields.length > 1) {
    const allowance = work.admit(fields.length * bits * (1 + Math.ceil(Math.log2(fields.length + 1))), 1);
    if (allowance !== null) return refused(allowance);
    const ordered = fields.filter(field => field.child.byteSize !== 0n).sort((left, right) =>
      left.byteOffset < right.byteOffset ? -1 : left.byteOffset > right.byteOffset ? 1 : 0);
    let end = 0n;
    for (const field of ordered) {
      if (field.byteOffset < end) return invalid(origin, "Nonempty physical fields may not overlap.");
      end = field.byteOffset + field.child.byteSize;
    }
  }
  return ready({ ...header, kind: "value", fields });
};
