import type { NodeId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { HirApplication, HirCallableEndpoint, HirCandidate, HirNode, HirProtocolFact } from "../ir-hir/contract.js";
import type { ApplicationDecision, InferenceDeclaration, MemberDecision, ParameterMapping, RuleOutcome } from "../ir-infer/contract.js";
import type { Member, MemberKey, MemberOrigin, MemberTable, Signature, SignatureParameter, TypeTable } from "../ir-types/contract.js";
import type { MemberSelection, ResolvedCallee, TirApplication, TirArgument, TirNode, TirProtocol, TypedOperation } from "./contract.js";
import type { TirOccurrenceEmit } from "./verify-occurrences.js";

export interface TirDeclarationInventory {
  readonly declaration: InferenceDeclaration;
  readonly endpoints: ReadonlySet<string>;
}

export interface TirCallDeclarations {
  readonly advertised: TirDeclarationInventory | null;
  readonly api: TirDeclarationInventory | null;
  readonly candidates: readonly HirCandidate[] | null;
}

export const endpointKey = (endpoint: HirCallableEndpoint): string => encodeKey([endpoint.declaration, endpoint.role, endpoint.body]);

export const declarationEndpoints = (declaration: InferenceDeclaration): ReadonlySet<string> => {
  const endpoints = new Set<string>();
  for (const endpoint of declaration.endpoints) if (endpoint !== undefined) endpoints.add(endpointKey(endpoint));
  return endpoints;
};

export const applicationOf = (node: TirNode): RuleOutcome<TirApplication> | null => {
  if (node.kind === "CallExpression" || node.kind === "NewExpression" || node.kind === "TaggedTemplateExpression" || node.kind === "Decorator") {
    return node.tsonic.application;
  }
  return null;
};

const validOrdinal = (value: number): boolean => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

export const verifyCallEndpoints = (
  decision: ApplicationDecision, node: TirNode, types: TypeTable, declarations: TirCallDeclarations, emit: TirOccurrenceEmit,
): Signature | undefined => {
  const candidate = declarations.candidates?.[decision.candidate];
  const advertisedSignature = types.signatures[decision.advertised.signature];
  const apiSignature = types.signatures[decision.api.signature];
  let valid = declarations.advertised !== null && declarations.api !== null &&
    declarations.advertised.endpoints.has(endpointKey(decision.advertised)) &&
    declarations.api.endpoints.has(endpointKey(decision.api)) &&
    advertisedSignature !== undefined && apiSignature !== undefined;
  if (declarations.candidates !== null) {
    valid = valid && Number.isSafeInteger(decision.candidate) && decision.candidate >= 0 && !Object.is(decision.candidate, -0) &&
      candidate !== undefined && candidate.ordinal === decision.candidate && candidate.declaration === decision.advertised.declaration;
  }
  if (advertisedSignature?.declaration !== null && advertisedSignature?.declaration !== decision.advertised.declaration) valid = false;
  if (apiSignature?.declaration !== null && apiSignature?.declaration !== decision.api.declaration) valid = false;
  if (!valid) emit("call-endpoints", node, "selected callable endpoints do not belong to their actual declarations and candidate");
  if (decision.completion.signature !== decision.api.signature) {
    emit("completion-endpoint", node, "selected completion does not retain its actual API signature");
  }
  if (apiSignature !== undefined) verifyDecisionFormals(decision, node, apiSignature, emit);
  return apiSignature;
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
    if (mapping.kind === "argument" && (!validOrdinal(mapping.argument) || mapping.component !== null && !validOrdinal(mapping.component))) order = false;
    if (mapping.kind === "rest") {
      let previous = -1;
      for (const argument of mapping.arguments) {
        if (!validOrdinal(argument) || argument <= previous) order = false;
        previous = argument;
      }
    }
    if ((mapping.kind === "argument" || mapping.kind === "rest") && mapping.passing !== parameter.passing) passing = false;
    if (mapping.kind === "default" && (parameter.kind !== "default" || mapping.initializer !== parameter.initializer) ||
      mapping.kind === "omitted" && (parameter.kind !== "optional" || mapping.type !== parameter.type) ||
      mapping.kind === "rest" && parameter.kind !== "rest") omission = false;
  }
  if (!total) emit("argument-total", node, "application dispositions are not total over the real API formals and receiver");
  if (!order) emit("argument-parameter-order", node, "argument and mapping parameters do not retain formal order");
  if (!passing) emit("argument-passing", node, "argument mapping does not retain the formal passing mode");
  if (!omission) emit("omission-valid", node, "omission does not match the actual optional, default or rest formal");
};

const omissionMatches = (argument: TirArgument, formal: SignatureParameter): boolean => {
  if (argument.kind !== "omitted") return true;
  if (argument.value.kind === "absence") return formal.kind === "optional";
  if (argument.value.kind === "empty-rest") return formal.kind === "rest";
  return formal.kind === "default" && formal.initializer !== null && argument.value.instance.body === formal.initializer;
};

export const verifyArgumentTransport = (
  application: TirApplication, node: TirNode, signature: Signature, original: HirApplication | null,
  sourceNodes: ReadonlyMap<NodeId, HirNode>, emit: TirOccurrenceEmit,
): void => {
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
  if (original !== null) for (let position = 0; position < original.arguments.length; position++) {
    const argument = original.arguments[position];
    if (argument !== undefined) sourcePositions.set(argument.expression, position);
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
    if ((mapping.kind === "argument" || mapping.kind === "rest") && mapping.passing !== formal.passing) passing = false;
    if (argument.kind === "provided") {
      if (mapping.kind !== "argument") total = false;
      else {
        if (!validOrdinal(mapping.argument) || mapping.component !== null && !validOrdinal(mapping.component) ||
          mapping.argument < previousArgument || mapping.argument === previousArgument &&
          (mapping.component === null || mapping.component <= previousComponent)) authoredOrder = false;
        previousArgument = mapping.argument;
        previousComponent = mapping.component === null ? -1 : mapping.component;
        const captured = sourceNodes.get(argument.expression)?.tsonic;
        if (captured !== undefined && captured !== null && "core" in captured &&
          captured.core.argumentPassing.kind === "available" && captured.core.argumentPassing.value?.role === "argument" &&
          captured.core.argumentPassing.value.mode !== mapping.passing) passing = false;
      }
      if (mapping.kind === "argument" && original !== null) {
        const source = original.arguments[mapping.argument];
        if (!Number.isSafeInteger(mapping.argument) || mapping.argument < 0 || Object.is(mapping.argument, -0) ||
          source === undefined || source.expression !== argument.expression) authoredOrder = false;
        else if (source.kind === "value" ? mapping.component !== null : mapping.component === null ||
          !Number.isSafeInteger(mapping.component) || mapping.component < 0 || Object.is(mapping.component, -0)) authoredOrder = false;
        if (source?.kind === "spread" && mapping.component !== null) {
          const previous = maximumComponent.get(mapping.argument);
          if (previous === undefined || mapping.component > previous) maximumComponent.set(mapping.argument, mapping.component);
          if (source.tuple.kind === "available" && source.tuple.value !== null && mapping.component >= source.tuple.value.length) authoredOrder = false;
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
  if (!omissions) emit("omission-valid", node, "omission does not match the actual optional, default or rest formal");
  if (!authoredOrder) emit("authored-order-preserved", node, "argument transport does not retain the original authored argument sequence");
  if (!emptySpreads) emit("empty-spread-preserved", node, "authored empty spread is not retained in the whole spread tuple and rest source indices");
};

const memberKey = (value: MemberKey): string => {
  if (value.kind === "text") return encodeKey([value.kind, value.value]);
  if (value.kind === "symbol") return encodeKey([value.kind, value.declaration]);
  return encodeKey([value.kind, value.value.numerator, value.value.denominator, value.value.negativeZero]);
};

const memberOriginKey = (origin: MemberOrigin): string => {
  if (origin.kind === "declared") return encodeKey([origin.kind, origin.declaration]);
  if (origin.kind === "class-prototype") return encodeKey([origin.kind, origin.owner]);
  const reference = origin.owner;
  return encodeKey([origin.kind, reference.kind, reference.kind === "body" ? reference.value.body : reference.value.owner,
    reference.value.node, memberKey(origin.key)]);
};

export interface TirMemberInventory {
  readonly table: MemberTable;
  readonly members: ReadonlyMap<string, { readonly member: Member; readonly origins: ReadonlySet<string> }>;
  readonly accessors: ReadonlyMap<string, { readonly getter: string | null; readonly setter: string | null }>;
  readonly repeated: boolean;
}

export const indexMembers = (table: MemberTable): TirMemberInventory => {
  const members = new Map<string, { member: Member; origins: ReadonlySet<string> }>();
  const accessors = new Map<string, { getter: string | null; setter: string | null }>();
  let repeated = false;
  for (const member of table.members) {
    if (member === undefined) { repeated = true; continue; }
    const key = memberKey(member.key);
    if (members.has(key)) repeated = true;
    const origins = new Set<string>();
    for (const origin of member.origins) if (origin !== undefined) origins.add(memberOriginKey(origin));
    members.set(key, { member, origins });
  }
  for (const accessor of table.accessors) {
    if (accessor === undefined) { repeated = true; continue; }
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
  decision: MemberDecision, node: TirNode, inventory: TirMemberInventory | null, emit: TirOccurrenceEmit,
): readonly string[] => {
  const member = inventory?.members.get(memberKey(decision.key));
  let origins = inventory !== null && !inventory.repeated && member !== undefined && decision.origins.length !== 0;
  const actualOrigins: string[] = [];
  const declared = new Set<string>();
  if (member !== undefined) for (const origin of decision.origins) {
    const key = memberOriginKey(origin);
    if (!member.origins.has(key)) origins = false;
    actualOrigins.push(key);
    if (origin.kind === "declared") declared.add(origin.declaration);
  }
  const selected = new Set(decision.selectedDeclarations);
  if (decision.primary !== null && !selected.has(decision.primary)) origins = false;
  for (const declaration of decision.selectedDeclarations) {
    if (declared.size !== 0 && !declared.has(declaration)) origins = false;
  }
  if (!origins) emit("member-origin", node, "member selection does not retain a real member key and its actual declared origins");
  return actualOrigins;
};

export const verifyMemberSelection = (
  selection: MemberSelection, node: TirNode, inventory: TirMemberInventory | null, emit: TirOccurrenceEmit,
): void => {
  const decision = selection.decision;
  const actualOrigins = verifyMemberDecision(decision, node, inventory, emit);
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
      const signature = types.signatures[step.callee.decision.api.signature];
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

export const verifyActivation = (
  callee: ResolvedCallee, node: TirNode, emit: TirOccurrenceEmit,
): void => {
  if (callee.activation !== null && callee.activation.body !== callee.decision.api.body ||
    callee.activation === null && callee.captures.length !== 0) {
    emit("call-endpoints", node, "callee activation and captures do not retain their actual API body");
  }
};
