import type { NodeId, SigId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { CallExpression, HirApplication, HirCallableEndpoint, HirCandidate, HirNode, HirProtocolFact } from "../ir-hir/contract.js";
import { callableEndpointKey, selectedEndpointRoleFaults } from "../ir-hir/index.js";
import type { ApplicationDecision, InferenceDeclaration, MemberDecision, ParameterMapping } from "../ir-infer/contract.js";
import type { MemberInventory, MemberInventoryEntry, MemberKey, MemberOrigin, Signature, SignatureParameter, TypeTable } from "../ir-types/contract.js";
import { bindingVectorKey } from "../ir-types/index.js";
import type { MemberSelection, ResolvedCallee, TirApplication, TirArgument, TirBody, TirNode, TirProtocol, TirReadyReadAdmission, TypedOperation, TypedPhase } from "./contract.js";
import type { TirOccurrenceEmit } from "./verify-occurrences.js";
import type { TupleArgumentOperation } from "./contract.js";
import { typedValueOf } from "./verify-occurrences.js";

export interface TirDeclarationInventory {
  readonly declaration: InferenceDeclaration;
  readonly endpoints: ReadonlySet<string>;
  readonly overloaded: boolean;
}

export const tupleArgumentOperation: TupleArgumentOperation = (application, invocation, parameter) => {
  const { decision } = application.callee;
  const mapping = decision.parameters[parameter];
  const argument = application.arguments[parameter];
  if (mapping?.kind !== "converted-argument" || argument?.kind !== "provided"
    || mapping.parameter !== parameter || argument.parameter !== parameter) return null;
  const { from, to, kind } = mapping.conversion;
  return {
    permissionScope: null, decision: {
      kind: "selected", operation: { kind: "conversion", from, to, embedding: {
        kind: "conversion", conversion: kind, check: { kind: "none" },
        proof: { steps: [{ rule: kind, premises: [],
          from: { root: { kind: "body", value: { body: invocation.body, node: argument.expression } },
            path: [{ kind: "tuple-element", index: mapping.component }] },
          to: { root: { kind: "body", value: invocation },
            path: [{ kind: "parameter", signature: decision.completion.signature, index: parameter }] },
        }], conclusion: 0 },
      } },
      operands: [from], result: to, execution: { kind: "pure" },
    },
  };
};

export interface TirCallDeclarations {
  readonly advertised: TirDeclarationInventory | null;
  readonly api: TirDeclarationInventory | null;
  readonly candidates: readonly HirCandidate[] | null;
  readonly activated: TirBody | null | undefined;
}

export const declarationEndpoints = (declaration: InferenceDeclaration): ReadonlySet<string> => {
  const endpoints = new Set<string>();
  for (const endpoint of declaration.endpoints) if (endpoint !== undefined) endpoints.add(callableEndpointKey(endpoint));
  return endpoints;
};

const validOrdinal = (value: number): boolean => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

export function checkedAppliedSignature(decision: ApplicationDecision, candidate: HirCandidate | undefined): SigId | null {
  return candidate?.ordinal === decision.candidate && candidate.declaration === decision.advertised.declaration
    && callableEndpointKey(decision.advertised) === callableEndpointKey(decision.api) && candidate.appliedSignature.kind === "available"
    ? candidate.appliedSignature.value : null;
}

export const verifyCallEndpoints = (
  decision: ApplicationDecision, node: TirNode, types: TypeTable, declarations: TirCallDeclarations, emit: TirOccurrenceEmit,
): void => {
  const candidate = declarations.candidates?.[decision.candidate];
  const advertisedSignature = types.signatures[decision.advertised.signature];
  const apiSignature = types.signatures[decision.api.signature];
  const activated = declarations.activated;
  const applied = activated !== undefined ? activated?.signature
    : checkedAppliedSignature(decision, candidate) ?? decision.api.signature;
  const appliedSignature = applied === undefined ? undefined : types.signatures[applied];
  let valid = declarations.advertised !== null && declarations.api !== null &&
    declarations.advertised.endpoints.has(callableEndpointKey(decision.advertised)) &&
    declarations.api.endpoints.has(callableEndpointKey(decision.api)) &&
    declarations.advertised.endpoints.has(callableEndpointKey(decision.api)) &&
    selectedEndpointRoleFaults(declarations.advertised.overloaded, decision.advertised, decision.api) === 0 &&
    advertisedSignature !== undefined && apiSignature !== undefined;
  if (declarations.candidates !== null) {
    valid = valid && Number.isSafeInteger(decision.candidate) && decision.candidate >= 0 && !Object.is(decision.candidate, -0) &&
      candidate !== undefined && candidate.ordinal === decision.candidate && candidate.declaration === decision.advertised.declaration;
  }
  if (advertisedSignature?.declaration !== null && advertisedSignature?.declaration !== decision.advertised.declaration) valid = false;
  if (apiSignature?.declaration !== null && apiSignature?.declaration !== decision.api.declaration) valid = false;
  if (!valid) emit("call-endpoints", node, "selected callable endpoints do not belong to their actual declarations and candidate");
  const completion = decision.completion;
  if (activated !== undefined && activated !== null) {
    if (completion.signature !== activated.signature || completion.completion !== activated.completion
      || completion.yielded !== activated.yielded || completion.sent !== activated.sent
      || appliedSignature === undefined || appliedSignature.declaration !== decision.api.declaration)
      emit("completion-endpoint", node, "selected completion does not retain the actual activated body's signature and channels");
  } else if (activated === undefined && (completion.signature !== applied || applied !== decision.api.signature && (appliedSignature === undefined
    || appliedSignature.declaration !== decision.api.declaration))) {
    emit("completion-endpoint", node, "selected completion does not retain its actual API signature");
  }
  if (appliedSignature !== undefined) verifyDecisionFormals(decision, node, appliedSignature, emit);
};

const verifyDecisionFormals = (decision: ApplicationDecision, node: TirNode, signature: Signature, emit: TirOccurrenceEmit): void => {
  let total = decision.parameters.length === signature.parameters.length;
  let order = true;
  let passing = true;
  let omission = true;
  for (let position = 0; position < Math.max(decision.parameters.length, signature.parameters.length); position++) {
    const mapping = decision.parameters[position];
    const parameter = signature.parameters[position];
    if (mapping === undefined || parameter === undefined) { total = false; continue; }
    if (!Object.is(mapping.parameter, position)) order = false;
    if ((mapping.kind === "argument" || mapping.kind === "reference-argument" || mapping.kind === "converted-argument")
      && (!validOrdinal(mapping.argument) || mapping.kind === "converted-argument" && !validOrdinal(mapping.component)
        || mapping.component !== null && !validOrdinal(mapping.component))) order = false;
    if (mapping.kind === "rest") {
      let previous = -1;
      for (const argument of mapping.arguments) {
        if (!validOrdinal(argument) || argument <= previous) order = false;
        previous = argument;
      }
    }
    if ((mapping.kind === "argument" || mapping.kind === "reference-argument" || mapping.kind === "converted-argument" || mapping.kind === "rest")
      && mapping.passing !== parameter.passing) passing = false;
    if (mapping.kind === "default" && (parameter.kind !== "default" || !parameter.acceptsOmission || mapping.initializer !== parameter.initializer) ||
      mapping.kind === "omitted" && (!parameter.acceptsOmission || parameter.kind === "default" || parameter.kind === "rest" || mapping.type !== parameter.type) ||
      mapping.kind === "rest" && parameter.kind !== "rest") omission = false;
  }
  if (!total) emit("argument-total", node, "application dispositions are not total over the real API formals and receiver");
  if (!order) emit("argument-parameter-order", node, "argument and mapping parameters do not retain formal order");
  if (!passing) emit("argument-passing", node, "argument mapping does not retain the formal passing mode");
  if (!omission) emit("omission-valid", node, "omission does not match the selected capability, default initializer or rest formal");
};

const omissionMatches = (argument: TirArgument, formal: SignatureParameter): boolean => {
  if (argument.kind !== "omitted") return true;
  if (argument.value.kind === "absence") return formal.acceptsOmission && formal.kind !== "default" && formal.kind !== "rest";
  if (argument.value.kind === "empty-rest") return formal.kind === "rest";
  return formal.acceptsOmission && formal.kind === "default" && formal.initializer !== null && argument.value.instance.body === formal.initializer;
};

export const verifyArgumentTransport = <Stop extends object>(
  application: TirApplication, node: TirNode, signature: Signature, original: HirApplication | null,
  sourceNodes: ReadonlyMap<NodeId, HirNode>, types: TypeTable, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit,
): Stop | null => {
  const decision = application.callee.decision;
  let total = application.arguments.length === signature.parameters.length;
  let parameterOrder = true;
  let passing = true;
  let omissions = true;
  let authoredOrder = original === null || application.receiver === original.receiver;
  let emptySpreads = true;
  const retainedSpreads = new Set<number>();
  const maximumComponent = new Map<number, number>();
  const restArguments = new Set<number>();
  const sourcePositions = new Map<NodeId, number>();
  let spread = false;
  if (original !== null) for (let position = 0; position < original.arguments.length; position++) {
    const argument = original.arguments[position];
    if (argument !== undefined) {
      sourcePositions.set(argument.expression, position);
      spread ||= argument.kind === "spread";
    }
  }
  const mappings = new Map<number, ParameterMapping>();
  let previousArgument = -1;
  let previousComponent = -1;
  for (const [position, mapping] of decision.parameters.entries()) {
    if (!Object.is(mapping.parameter, position) || mappings.has(mapping.parameter)) parameterOrder = false;
    mappings.set(mapping.parameter, mapping);
  }
  if (mappings.size !== signature.parameters.length) total = false;
  for (let position = 0; position < Math.max(application.arguments.length, signature.parameters.length); position++) {
    const argument = application.arguments[position];
    const formal = signature.parameters[position];
    const mapping = mappings.get(position);
    if (argument === undefined || formal === undefined || mapping === undefined) { total = false; continue; }
    if (!Object.is(argument.parameter, position)) parameterOrder = false;
    if (!omissionMatches(argument, formal)) omissions = false;
    if ((mapping.kind === "argument" || mapping.kind === "reference-argument" || mapping.kind === "converted-argument" || mapping.kind === "rest")
      && mapping.passing !== formal.passing) passing = false;
    if (argument.kind === "provided") {
      if (mapping.kind !== "argument" && mapping.kind !== "reference-argument" && mapping.kind !== "converted-argument") total = false;
      else {
        const ordinal = mapping.component;
        if (!validOrdinal(mapping.argument) || ordinal !== null && !validOrdinal(ordinal) ||
          mapping.argument < previousArgument || mapping.argument === previousArgument &&
          (ordinal === null || ordinal <= previousComponent)) authoredOrder = false;
        previousArgument = mapping.argument;
        previousComponent = ordinal ?? -1;
        const captured = sourceNodes.get(argument.expression)?.tsonic;
        if (captured !== undefined && captured !== null && "core" in captured &&
          captured.core.argumentPassing.kind === "available" && captured.core.argumentPassing.value?.role === "argument" &&
          captured.core.argumentPassing.value.mode !== mapping.passing) passing = false;
      }
      if ((mapping.kind === "argument" || mapping.kind === "reference-argument" || mapping.kind === "converted-argument") && original !== null) {
        const source = original.arguments[mapping.argument];
        const ordinal = mapping.component;
        if (!Number.isSafeInteger(mapping.argument) || mapping.argument < 0 || Object.is(mapping.argument, -0) ||
          source === undefined || source.expression !== argument.expression) authoredOrder = false;
        else if (source.kind === "value" ? ordinal !== null : ordinal === null || !validOrdinal(ordinal)) authoredOrder = false;
        if (source?.kind === "spread" && ordinal !== null) {
          const previous = maximumComponent.get(mapping.argument);
          if (previous === undefined || ordinal > previous) maximumComponent.set(mapping.argument, ordinal);
          if (source.tuple.kind === "available" && source.tuple.value !== null && ordinal >= source.tuple.value.length) authoredOrder = false;
        }
      }
    } else if (argument.kind === "omitted") {
      if (argument.value.kind === "initializer") {
        if (mapping.kind !== "default" || mapping.initializer !== argument.value.instance.body) omissions = false;
      } else if (argument.value.kind === "absence") {
        if (mapping.kind !== "omitted") omissions = false;
      } else if (mapping.kind !== "rest" || mapping.arguments.length !== 0) omissions = false;
    } else {
      if (formal.kind !== "rest" || mapping.kind !== "rest") total = false;
      else if (original !== null) {
        let previous = -1;
        const actual: number[] = [];
        for (const part of argument.parts) {
          const sourcePosition = sourcePositions.get(part.expression);
          const source = sourcePosition === undefined ? undefined : original.arguments[sourcePosition];
          if (sourcePosition === undefined || sourcePosition < previous || source === undefined || source.kind !== part.kind) authoredOrder = false;
          else {
            actual.push(sourcePosition);
            if (restArguments.has(sourcePosition)) authoredOrder = false;
            restArguments.add(sourcePosition);
            previous = sourcePosition;
            if (part.kind === "spread" && source.kind === "spread") {
              retainedSpreads.add(sourcePosition);
              if (source.tuple.kind === "available" && source.tuple.value !== null && source.tuple.value.length === 0 &&
                (part.tuple === null || part.tuple.length !== 0)) emptySpreads = false;
              const maximum = maximumComponent.get(sourcePosition);
              if (part.tuple !== null && maximum !== undefined && maximum >= part.tuple.length) authoredOrder = false;
            }
          }
        }
        if (actual.length !== mapping.arguments.length || actual.some((value, index) => value !== mapping.arguments[index])) authoredOrder = false;
      }
    }
  }
  if (original !== null && signature.parameters.some(parameter => parameter?.kind === "rest")) {
    for (let position = 0; position < original.arguments.length; position++) {
      const source = original.arguments[position];
      if (source?.kind === "spread" && source.tuple.kind === "available" && source.tuple.value !== null &&
        source.tuple.value.length === 0 && !retainedSpreads.has(position)) emptySpreads = false;
    }
  }
  if (signature.receiver !== null && application.receiver === null) total = false;
  if (!total) emit("argument-total", node, "application dispositions are not total over the real API formals and receiver");
  if (!parameterOrder) emit("argument-parameter-order", node, "argument and mapping parameters do not retain formal order");
  if (!passing) emit("argument-passing", node, "argument mapping does not retain the formal passing mode");
  if (!omissions) emit("omission-valid", node, "omission does not match the selected capability, default initializer or rest formal");
  if (!authoredOrder) emit("authored-order-preserved", node, "argument transport does not retain the original authored argument sequence");
  if (!emptySpreads) emit("empty-spread-preserved", node, "authored empty spread is not retained in the whole spread tuple and rest source indices");
  return spread && original !== null && node.kind === "CallExpression"
    ? verifyFixedCallSpread(application, node, signature, original, types, admit, emit) : null;
};

function verifyFixedCallSpread<Stop extends object>(application: TirApplication, node: CallExpression<TypedPhase>,
  signature: Signature, original: HirApplication, types: TypeTable, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  if ("kind" in node.arguments) return null;
  const syntax = node.arguments.nodes;
  for (let position = 0; position < signature.parameters.length; position += 1) {
    const paid = admit({ kind: "row" });
    if (paid !== null) return paid;
    if (signature.parameters[position]?.kind === "rest") return null;
  }
  let effective = 0;
  let exact = syntax.length === original.arguments.length;
  for (let authored = 0; authored < original.arguments.length; authored += 1) {
    const paid = admit({ kind: "row" });
    if (paid !== null) return paid;
    const source = original.arguments[authored];
    const argument = syntax[authored];
    if (source === undefined || argument === undefined) { exact = false; break; }
    let arity = 1;
    let tuple: Extract<TypeTable["terms"][number], { readonly kind: "tuple" }> | null = null;
    if (source.kind === "spread") {
      if (source.tuple.kind !== "available" || source.tuple.value === null) return null;
      const type = argument.kind === "SpreadElement" ? typedValueOf(argument.expression)?.convertedType : undefined;
      const selected = type === undefined ? undefined : types.terms[type];
      if (argument.kind !== "SpreadElement" || !("role" in argument.tsonic) || argument.tsonic.role !== "finite-call-argument"
        || argument.expression.id !== source.expression
        || selected?.kind !== "tuple" || selected.elements.length !== source.tuple.value.length) { exact = false; break; }
      tuple = selected;
      arity = selected.elements.length;
    } else if (argument.kind === "SpreadElement" || argument.id !== source.expression) { exact = false; break; }
    for (let component = 0; component < arity; component += 1, effective += 1) {
      const paid = admit({ kind: "row" });
      if (paid !== null) return paid;
      const mapping = application.callee.decision.parameters[effective];
      const passed = application.arguments[effective];
      if (mapping?.kind !== "argument" && mapping?.kind !== "reference-argument" && mapping?.kind !== "converted-argument"
        || mapping.parameter !== effective || mapping.argument !== authored || mapping.component !== (tuple === null ? null : component)
        || passed?.kind !== "provided" || passed.expression !== source.expression) exact = false;
      if (tuple !== null) {
        const element = tuple.elements[component];
        const formal = signature.parameters[effective];
        if (element?.kind !== "required" || formal === undefined || mapping?.kind !== "argument" && mapping?.kind !== "converted-argument" || mapping.passing !== "by-value"
          || mapping.component === null) exact = false;
        else {
          const conversion = mapping.kind === "converted-argument" ? mapping.conversion : null;
          if (conversion === null) exact &&= element.type === formal.type;
          else {
            const paidConversion = admit({ kind: "row" });
            if (paidConversion !== null) return paidConversion;
            if (conversion.from !== element.type || conversion.to !== formal.type || conversion.from === conversion.to
              || conversion.kind !== "literal-fit" && conversion.kind !== "absence" && conversion.kind !== "union-injection") exact = false;
          }
        }
      }
    }
  }
  for (; exact && effective < application.arguments.length; effective += 1) {
    const paid = admit({ kind: "row" });
    if (paid !== null) return paid;
    if (application.arguments[effective]?.kind !== "omitted") exact = false;
  }
  if (!exact) emit("authored-order-preserved", node, "a finite spread must retain its actual operand and each selected fixed slot exactly once in authored order");
  return null;
}

const memberKey = (value: MemberKey): string => {
  if (value.kind === "text") return encodeKey([value.kind, value.value]);
  if (value.kind === "symbol") return encodeKey([value.kind, value.declaration]);
  return encodeKey([value.kind, value.value.numerator, value.value.denominator, value.value.negativeZero]);
};

const memberOriginKey = (origin: MemberOrigin): string => {
  if (origin.kind === "declared") return encodeKey([origin.kind, origin.declaration]);
  if (origin.kind === "class-prototype") return encodeKey([origin.kind, origin.owner]);
  if (origin.kind === "intrinsic") return encodeKey([origin.kind, origin.symbol]);
  if (origin.kind === "source-member") return encodeKey([origin.kind, origin.occurrence.body, origin.occurrence.node]);
  const reference = origin.owner;
  return encodeKey([origin.kind, reference.kind, reference.kind === "body" ? reference.value.body : reference.value.owner,
    reference.value.node, memberKey(origin.key)]);
};

export interface TirMemberInventory {
  readonly table: MemberInventory;
  readonly members: ReadonlyMap<string, { readonly member: MemberInventoryEntry; readonly origins: ReadonlySet<string> }>;
  readonly accessors: ReadonlyMap<string, { readonly getter: string | null; readonly setter: string | null }>;
  readonly repeated: boolean;
}

export const indexMembers = (table: MemberInventory, pay: (key: MemberKey) => boolean): TirMemberInventory | null => {
  const members = new Map<string, { member: MemberInventoryEntry; origins: ReadonlySet<string> }>();
  const accessors = new Map<string, { getter: string | null; setter: string | null }>();
  let repeated = false;
  for (const member of table.members) {
    if (member === undefined) { repeated = true; continue; }
    if (!pay(member.key)) return null;
    const key = memberKey(member.key);
    if (members.has(key)) repeated = true;
    const origins = new Set<string>();
    for (const origin of member.origins) if (origin !== undefined) {
      if (origin.kind === "mapped" && !pay(origin.key)) return null;
      origins.add(memberOriginKey(origin));
    }
    members.set(key, { member, origins });
  }
  for (const accessor of table.accessors) {
    if (accessor === undefined) { repeated = true; continue; }
    if (accessor.origin.kind === "mapped" && !pay(accessor.origin.key)) return null;
    const key = memberOriginKey(accessor.origin);
    if (accessors.has(key)) repeated = true;
    accessors.set(key, { getter: accessor.getter, setter: accessor.setter });
  }
  return { table, members, accessors, repeated };
};

const sameEndpoint = (left: HirCallableEndpoint | null, right: HirCallableEndpoint | null): boolean =>
  left === null ? right === null : right !== null && left.declaration === right.declaration && left.role === right.role &&
    left.signature === right.signature && left.body === right.body;

export const verifyMemberDecision = (
  decision: MemberDecision, node: TirNode, inventory: TirMemberInventory | null, emit: TirOccurrenceEmit, pay: (key: MemberKey) => boolean,
): readonly string[] | null => {
  if (!pay(decision.key)) return null;
  const member = inventory?.members.get(memberKey(decision.key));
  let origins = inventory !== null && !inventory.repeated && member !== undefined && decision.origins.length !== 0;
  const actualOrigins: string[] = [];
  const declared = new Set<string>();
  let sourceOnly = decision.origins.length !== 0;
  if (member !== undefined) for (const origin of decision.origins) {
    if (origin.kind === "mapped" && !pay(origin.key)) return null;
    const key = memberOriginKey(origin);
    if (!member.origins.has(key)) origins = false;
    actualOrigins.push(key);
    if (origin.kind === "declared") declared.add(origin.declaration);
    if (origin.kind !== "source-member") sourceOnly = false;
  }
  const selected = new Set(decision.selectedDeclarations);
  if (sourceOnly && selected.size !== 0) origins = false;
  if (decision.primary !== null && !selected.has(decision.primary)) origins = false;
  for (const declaration of decision.selectedDeclarations) {
    if (declared.size !== 0 && !declared.has(declaration)) origins = false;
  }
  if (!origins) emit("member-origin", node, "member selection does not retain a real member key and its actual declared origins");
  if ((decision.location.kind === "accessor") !== (decision.getter !== null || decision.setter !== null))
    emit("access-location", node, "member location is an accessor exactly when a getter or setter is selected");
  return actualOrigins;
};

export const verifyMemberSelection = (
  selection: MemberSelection, node: TirNode, inventory: TirMemberInventory | null, emit: TirOccurrenceEmit, pay: (key: MemberKey) => boolean,
): void => {
  const decision = selection.decision;
  const actualOrigins = verifyMemberDecision(decision, node, inventory, emit, pay);
  if (actualOrigins === null) return;
  let activation = true;
  const getter = selection.getter;
  const setter = selection.setter;
  if (getter !== null && !sameEndpoint(decision.getter, getter.decision.api) ||
    setter !== null && !sameEndpoint(decision.setter, setter.decision.api)) activation = false;
  if ((node.kind === "PropertyAccessExpression" || node.kind === "ElementAccessExpression") && node.tsonic.role === "assignment-target") {
    if (node.tsonic.access.kind === "write" && getter !== null) activation = false;
    if (decision.setter !== null && setter === null || node.tsonic.access.kind === "read-write" && decision.getter !== null && getter === null) activation = false;
  } else {
    if (setter !== null || decision.getter !== null && getter === null) activation = false;
  }
  const accessors: readonly { readonly endpoint: ResolvedCallee | null; readonly role: "getter" | "setter" }[] =
    [{ endpoint: getter, role: "getter" }, { endpoint: setter, role: "setter" }];
  if (inventory !== null) for (const { endpoint, role } of accessors) {
    if (endpoint === null) continue;
    if (!actualOrigins.some(origin => inventory.accessors.get(origin)?.[role] === endpoint.decision.api.declaration)) activation = false;
  }
  if (!activation) emit("accessor-activation", node, "selected accessor activation does not retain the actual member endpoint and access role");
};

export const verifyProtocolRecord = (
  protocol: TirProtocol, node: TirNode, source: HirProtocolFact | null, types: TypeTable, emit: TirOccurrenceEmit,
): void => {
  if (source !== null && (source.kind !== protocol.kind || "asynchronous" in source && source.asynchronous !== protocol.asynchronous)) {
    emit("protocol-total", node, "selected protocol does not retain its actual authored kind and asynchrony");
  }
  const thrown = types.terms[protocol.thrown];
  if (thrown?.kind !== "intrinsic" || thrown.intrinsic !== "unknown") {
    emit("protocol-thrown-unknown", node, "protocol thrown channel is not the canonical intrinsic unknown type");
  }
  for (const step of protocol.steps) {
    const operation = step.operation.decision;
    if (step.callee !== null) {
      const signature = types.signatures[step.callee.decision.completion.signature];
      if (signature === undefined || operation.result !== step.callee.decision.result ||
        (operation.operation.kind === "library" || operation.operation.kind === "core") &&
        operation.operation.declaration !== step.callee.decision.api.declaration) {
        emit("protocol-total", node, "protocol step operation and callee do not retain the same selected endpoint and result");
      }
    }
  }
};

export const verifyProtocolOperation = (operation: TypedOperation, node: TirNode, types: TypeTable, emit: TirOccurrenceEmit): void => {
  const identity = operation.decision.operation;
  if (identity.kind !== "protocol") return;
  const thrown = types.terms[identity.thrown];
  if (thrown?.kind !== "intrinsic" || thrown.intrinsic !== "unknown") {
    emit("protocol-thrown-unknown", node, "protocol thrown channel is not the canonical intrinsic unknown type");
  }
  for (const step of identity.steps) {
    if (step.operation.kind === "call" && step.result !== step.operation.application.result) {
      emit("protocol-total", node, "protocol step operation and callee do not retain the same selected endpoint and result");
    }
  }
};

export const verifyActivation = <Stop extends object>(
  callee: ResolvedCallee, node: TirNode, emit: TirOccurrenceEmit, admit: TirReadyReadAdmission<Stop>,
): { readonly kind: "complete"; readonly valid: boolean } | { readonly kind: "resource-stop"; readonly stop: Stop } => {
  const activation = callee.activation;
  if (activation === null) return { kind: "complete", valid: true };
  if (activation.body !== callee.decision.api.body) {
    emit("call-endpoints", node, "callee activation does not retain its actual API body");
    return { kind: "complete", valid: false };
  }
  const activationRead = admit({ kind: "row" });
  if (activationRead !== null) return { kind: "resource-stop", stop: activationRead };
  const bindings = activation.bindings;
  if (bindings.kind === "instantiated") {
    const selectedRead = admit({ kind: "row" });
    if (selectedRead !== null) return { kind: "resource-stop", stop: selectedRead };
    const selected = bindings.bindings;
    const selectedIdentity = admit({ kind: "bindings", bindings: selected });
    if (selectedIdentity !== null) return { kind: "resource-stop", stop: selectedIdentity };
    const selectedKey = bindingVectorKey(selected);
    const implementationRead = admit({ kind: "row" });
    if (implementationRead !== null) return { kind: "resource-stop", stop: implementationRead };
    const implementation = callee.decision.implementationBindings;
    const implementationIdentity = admit({ kind: "bindings", bindings: implementation });
    if (implementationIdentity !== null) return { kind: "resource-stop", stop: implementationIdentity };
    if (selectedKey !== bindingVectorKey(implementation)) {
      emit("call-endpoints", node, "callee activation does not retain its actual implementation bindings");
      return { kind: "complete", valid: false };
    }
  }
  return { kind: "complete", valid: true };
};
