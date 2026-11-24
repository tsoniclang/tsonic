import type { ErrorValue, UnitResult } from "../diag/contract.js";
import { hostDiagnosticCode, throwInvariant } from "../diag/index.js";
import type { DefId, Origin } from "../ids/contract.js";
import type { ConstValue } from "../ir-types/contract.js";
import { floatingBitsFit, floatingFormatWidth, isNativeBinaryFloatPrimitive } from "../ir-types/index.js";
import type { LayoutAnswer, LayoutDeps, LayoutOf, LayoutRequest, LayoutStep, MaterializeMetadata, ObserveLayout, ReadyLayout, ReadyLayoutField, ResumeLayout } from "./contract.js";
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
  return refused(invalidRefusal(origin, message));
}

function invalidRefusal(origin: Origin, message: string): Refusal {
  const name = hostDiagnosticCode("TSONIC_CONSTANT_EVALUATION_FAILED");
  return { kind: "refused", diagnostics: [{ code: { kind: "host", name, rendered: name }, severity: "error",
    site: { kind: "source", origin }, source: "metadata", evidence: [], message, arguments: [], related: [], fix: null }] };
}

export const observeLayout: ObserveLayout = (deps, layout, request, origin) => {
  const initial = deps.admit(1, 0);
  if (initial !== null) return initial;
  if (layout.kind !== "array" && layout.kind !== "value")
    return invalidRefusal(origin, "An observation needs its actual value or array layout.");
  if (request.kind === "field-offset") {
    if (layout.kind === "value") for (let position = 0; position < layout.fields.length; position += 1) {
      const read = deps.admit(1, 0);
      if (read !== null) return read;
      const field = layout.fields[position];
      if (field === undefined) return invariant("A completed value layout must retain its dense field inventory.");
      const matches = deps.matchesKey(request.field, field.key);
      if (matches.kind === "refused") return matches;
      if (!matches.matches) continue;
      const publish = deps.admit(1, 1);
      return publish ?? { kind: "complete", value: { layout, field, value: field.byteOffset } };
    }
    return invalidRefusal(origin, "The selected field does not belong to its actual containing value layout.");
  }
  const publish = deps.admit(1, 1);
  if (publish !== null) return publish;
  const value = request.kind === "size" ? layout.byteSize : request.kind === "alignment" ? layout.byteAlignment : layout.stride;
  return { kind: "complete", value: { layout, field: null, value } };
};

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

function floatingQuantity(deps: LayoutDeps, work: ReturnType<typeof meter>,
  value: Extract<ConstValue, { readonly kind: "floating" }>, bits: number): Completed<bigint | null> | Refusal {
  const header = work.admit(1);
  if (header !== null) return header;
  const type = deps.typeOf(value.type);
  let carrier = type;
  if (type?.kind === "literal") {
    const read = work.admit(1);
    if (read !== null) return read;
    carrier = deps.typeOf(type.base);
  }
  if (carrier?.kind !== "primitive" || !isNativeBinaryFloatPrimitive(carrier.primitive))
    return { kind: "complete", value: null };
  for (let index = 0; index < deps.nativeFacts.floatingFormats.length; index += 1) {
    const read = work.admit(1);
    if (read !== null) return read;
    const format = deps.nativeFacts.floatingFormats[index];
    if (format === undefined) return invariant("A selected native format inventory is dense.");
    if (format.carrier !== carrier.primitive) continue;
    const width = floatingFormatWidth(format);
    if (width === null) return { kind: "complete", value: null };
    const payload = work.admit(width + bits);
    if (payload !== null) return payload;
    if (!floatingBitsFit(value.bits, format)) return { kind: "complete", value: null };
    const fractionWidth = width === 64 ? 52 : width === 32 ? 23 : 10;
    const exponentWidth = width - fractionWidth - 1;
    const exponentLimit = (1 << exponentWidth) - 1;
    const exponent = Number((value.bits >> BigInt(fractionWidth)) & BigInt(exponentLimit));
    const fraction = BigInt.asUintN(fractionWidth, value.bits);
    if (exponent === 0 && fraction === 0n) return { kind: "complete", value: 0n };
    if (value.bits >> BigInt(width - 1) !== 0n || exponent === 0 || exponent === exponentLimit)
      return { kind: "complete", value: null };
    const shift = exponent - (exponentLimit >> 1) - fractionWidth;
    const significand = (1n << BigInt(fractionWidth)) | fraction;
    if (shift >= 0)
      return { kind: "complete", value: shift < bits && BigInt.asUintN(bits - shift, significand) === significand
        ? significand << BigInt(shift) : null };
    const discarded = -shift;
    return { kind: "complete", value: discarded <= fractionWidth && BigInt.asUintN(discarded, significand) === 0n
      ? significand >> BigInt(discarded) : null };
  }
  return { kind: "complete", value: null };
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
  const quantity = (bits: number, runtimeBase: "number" | "bigint" | null): Completed<bigint> |
    { readonly kind: "stop"; readonly result: LayoutStep } => {
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
    if (runtimeBase !== null && (constant.kind === "bigint") !== (runtimeBase === "bigint"))
      return { kind: "stop", result: invalid(origin, "An array length must retain the selected extent's native runtime base.") };
    const converted = constant.kind === "floating" ? floatingQuantity(deps, work, constant, bits) : null;
    if (converted?.kind === "refused") return { kind: "stop", result: refused(converted) };
    const value = converted !== null ? converted.value : constant.kind === "bigint" ? constant.value
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
    const offset = quantity(bits, null);
    if (offset.kind !== "complete") return offset.result;
    const alignment = quantity(bits, null);
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
  const size = quantity(bits, null);
  if (size.kind !== "complete") return size.result;
  const alignment = quantity(bits, null);
  if (alignment.kind !== "complete") return alignment.result;
  const stride = quantity(bits, null);
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
    const length = quantity(bits, declaration.runtimeBase);
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
