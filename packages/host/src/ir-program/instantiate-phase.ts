import type {
  ApplicationDecision, CandidateArgument, CandidateEndpoint, ClosureCaptureEvidence, ConstructionPartDecision, DeferredDecision, DeferredInvocation, EmbeddingDecision,
  EmbeddingProof, MemberDecision, OperationIdentity, ParameterMapping, ProtocolStepDecision,
  LiteralConstructionPart, RefinementDecision, RuleContext, RuleOutcome,
} from "../ir-infer/contract.js";
import type {
  ConversionDecision, MemberSelection, ResolvedCallee, TirApplication, TirArgument, TirProtocol, TirProtocolStep, TirRestPart, TypedOperation, TypedOperationOf, TypedValue,
} from "../ir-tir/contract.js";
import type {
  CapturedFact, HirCapturedType, HirCoreCapture, HirFieldBindingCapture, HirFieldMarkerCapture, HirMarkersCapture, HirPointerTypeCapture, HirRecordBindingCapture, PreparedSyntaxSlot, SyntaxCopyResult,
} from "../ir-hir/contract.js";
import type { BodyInstance, TypeEvidence } from "../ir-types/contract.js";
import type { TyId } from "../ids/contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { PreparedReferenceProjection, ProjectionInventory } from "./program-values.js";
import type { InstantiationStop } from "./work.js";
import {
  deferComponentProjection, deferProjection, inventoryFields, inventoryRecord, inventorySignature, inventoryType,
  prepareBindingsProjection, prepareEndpoint, prepareEvidenceProjection, prepareInstance, prepareProjectionRows,
} from "./program-values.js";
import { chargeInstantiationWork, reserveInstantiationRecord } from "./work.js";

export type PreparedPhase<Value> = PreparedReferenceProjection<Value>;
export type PhaseProject<Value> = PreparedSyntaxSlot<Value, TypeReferenceRewrite>;

export function withPlan<Before, After>(source: PreparedPhase<Before>,
  next: (ready: PhaseProject<Before>) => PreparedPhase<After>,
): PreparedPhase<After> {
  return source.kind === "refused" ? source : next(source.value);
}

export function paidPhase<Value>(scan: ProjectionInventory, fields: number, next: () => PreparedPhase<Value>): PreparedPhase<Value> {
  const stop = inventoryRecord(scan, fields);
  return stop === null ? next() : { kind: "refused", stop };
}

export function holdPhase<Value>(value: Value): PreparedPhase<Value> {
  return { kind: "copied", value: () => value };
}

export function borrowPhase<Value>(scan: ProjectionInventory, fields: number, value: Value): PreparedPhase<Value> {
  const stop = inventoryFields(scan, fields);
  return stop === null ? holdPhase(value) : { kind: "refused", stop };
}

export function typePhase(scan: ProjectionInventory, type: TyId): PreparedPhase<TyId> {
  const stop = inventoryType(scan, type);
  return stop === null ? { kind: "copied", value: image => image.type(type) } : { kind: "refused", stop };
}

export function optionalTypePhase(scan: ProjectionInventory, type: TyId | null): PreparedPhase<TyId | null> {
  return type === null ? holdPhase(null) : typePhase(scan, type);
}

export function typesPhase(scan: ProjectionInventory, types: readonly TyId[]): PhaseProject<readonly TyId[]> {
  return prepareProjectionRows(scan, types, read => {
    const stop = chargeInstantiationWork(scan.meter);
    if (stop !== null) return { kind: "refused", stop };
    const type = read();
    scan.types.add(type);
    return { kind: "copied", value: image => image.type(type) };
  });
}

function prepareEmbeddingProof(scan: ProjectionInventory, value: EmbeddingProof, at: string): PreparedPhase<EmbeddingProof> {
  return paidPhase(scan, 2, () => {
    const steps = prepareProjectionRows(scan, value.steps, (read, index) => paidPhase(scan, 4, () => {
      const step = read();
      const prefix = at + ".steps[" + index + "]";
      const from = deferComponentProjection(scan, () => step.from, prefix + ".from", scan.componentCycle);
      const to = deferComponentProjection(scan, () => step.to, prefix + ".to", scan.componentCycle);
      const { rule, premises } = step;
      return { kind: "copied", value: image => ({ from: from(image), to: to(image), rule, premises }) };
    }));
    const conclusion = value.conclusion;
    return { kind: "copied", value: image => ({ steps: steps(image), conclusion }) };
  });
}

export function prepareEmbedding(scan: ProjectionInventory, value: EmbeddingDecision, at: string): PreparedPhase<EmbeddingDecision> {
  switch (value.kind) {
    case "identity": case "refused": return borrowPhase(scan, 1, value);
    case "conversion": return paidPhase(scan, 4, () =>
      withPlan(prepareEmbeddingProof(scan, value.proof, at + ".proof"), proof => {
        const { conversion, check } = value;
        return { kind: "copied", value: image => ({ kind: "conversion", conversion, check, proof: proof(image) }) };
      }));
  }
}

function prepareMember(scan: ProjectionInventory, value: MemberDecision): PreparedReferenceProjection<MemberDecision> {
  const header = inventoryRecord(scan, 10);
  if (header !== null) return { kind: "refused", stop: header };
  const rawGetter = value.getter;
  const getter = rawGetter === null ? () => null : deferProjection(scan, () => prepareEndpoint(scan, () => rawGetter));
  const rawSetter = value.setter;
  const setter = rawSetter === null ? () => null : deferProjection(scan, () => prepareEndpoint(scan, () => rawSetter));
  const read = value.read;
  const readStop = inventoryType(scan, read);
  if (readStop !== null) return { kind: "refused", stop: readStop };
  const write = value.write;
  const writeStop = inventoryType(scan, write);
  if (writeStop !== null) return { kind: "refused", stop: writeStop };
  const bindings = prepareBindingsProjection(scan, value.bindings);
  if (bindings.kind === "refused") return bindings;
  const { key, origins, selectedDeclarations, primary, location } = value;
  return { kind: "copied", value: rewrite => ({
    key, origins, selectedDeclarations, primary, location, bindings: bindings.value(rewrite),
    read: read === null ? null : rewrite.type(read), write: write === null ? null : rewrite.type(write),
    getter: getter(rewrite), setter: setter(rewrite),
  }) };
}

export function prepareApplication(scan: ProjectionInventory, value: ApplicationDecision): PreparedReferenceProjection<ApplicationDecision> {
  const header = inventoryRecord(scan, 9);
  if (header !== null) return { kind: "refused", stop: header };
  const parameters = prepareProjectionRows<ParameterMapping, ParameterMapping>(scan, value.parameters, read => {
    const slot = chargeInstantiationWork(scan.meter);
    if (slot !== null) return { kind: "refused", stop: slot };
    const parameter = read();
    switch (parameter.kind) {
      case "argument":
      case "default":
      case "rest": return { kind: "copied", value: () => parameter };
      case "omitted": {
        const rowStop = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3);
        if (rowStop !== null) return { kind: "refused", stop: rowStop };
        const type = parameter.type;
        const stop = inventoryType(scan, type);
        if (stop !== null) return { kind: "refused", stop };
        const index = parameter.parameter;
        return { kind: "copied", value: rewrite => ({ kind: "omitted", parameter: index, type: rewrite.type(type) }) };
      }
    }
  });
  const advertised = prepareEndpoint(scan, () => value.advertised);
  if (advertised.kind === "refused") return advertised;
  const api = prepareEndpoint(scan, () => value.api);
  if (api.kind === "refused") return api;
  const bindings = prepareBindingsProjection(scan, value.bindings);
  if (bindings.kind === "refused") return bindings;
  const implementation = prepareBindingsProjection(scan, value.implementationBindings);
  if (implementation.kind === "refused") return implementation;
  const completionHeader = inventoryRecord(scan, 4);
  if (completionHeader !== null) return { kind: "refused", stop: completionHeader };
  const entry = value.completion;
  const signature = entry.signature;
  const signatureStop = inventorySignature(scan, signature);
  if (signatureStop !== null) return { kind: "refused", stop: signatureStop };
  const completion = entry.completion;
  const completionStop = inventoryType(scan, completion);
  if (completionStop !== null) return { kind: "refused", stop: completionStop };
  const yielded = entry.yielded;
  const yieldedStop = inventoryType(scan, yielded);
  if (yieldedStop !== null) return { kind: "refused", stop: yieldedStop };
  const sent = entry.sent;
  const sentStop = inventoryType(scan, sent);
  if (sentStop !== null) return { kind: "refused", stop: sentStop };
  const result = value.result;
  const resultStop = inventoryType(scan, result);
  if (resultStop !== null) return { kind: "refused", stop: resultStop };
  const { candidate, activation } = value;
  return { kind: "copied", value: rewrite => ({
    candidate, activation, advertised: advertised.value(rewrite), api: api.value(rewrite),
    bindings: bindings.value(rewrite), implementationBindings: implementation.value(rewrite), parameters: parameters(rewrite),
    completion: { signature: rewrite.signature(signature), completion: rewrite.type(completion),
      yielded: yielded === null ? null : rewrite.type(yielded), sent: sent === null ? null : rewrite.type(sent) },
    result: rewrite.type(result),
  }) };
}

function prepareProtocolStep(scan: ProjectionInventory, read: () => ProtocolStepDecision): PreparedPhase<ProtocolStepDecision> {
  return paidPhase<ProtocolStepDecision>(scan, 4, () => {
    const value = read();
    const operands = typesPhase(scan, value.operands);
    return withPlan(typePhase(scan, value.result), result => {
      const operation = value.operation;
      const { role } = value;
      switch (operation.kind) {
        case "call": return paidPhase<ProtocolStepDecision>(scan, 2, () =>
          withPlan(prepareApplication(scan, operation.application), application => ({
            kind: "copied", value: image => ({ role, operands: operands(image), result: result(image),
              operation: { kind: "call", application: application(image) } }),
          })));
        case "core": return paidPhase<ProtocolStepDecision>(scan, 3, () =>
          withPlan(prepareBindingsProjection(scan, operation.bindings), bindings => {
            const declaration = operation.declaration;
            return { kind: "copied", value: image => ({ role, operands: operands(image), result: result(image),
              operation: { kind: "core", declaration, bindings: bindings(image) } }) };
          }));
        case "completion": {
          const stop = inventoryRecord(scan, 1);
          return stop === null ? { kind: "copied", value: image => ({ role, operands: operands(image), result: result(image), operation }) }
            : { kind: "refused", stop };
        }
      }
    });
  });
}

type ConversionIdentity = OperationIdentity & { readonly kind: "conversion" };
type BackedIdentity = OperationIdentity & { readonly kind: "library" | "core" };

function prepareConversionIdentity(scan: ProjectionInventory, value: ConversionIdentity, at: string): PreparedPhase<ConversionIdentity> {
  return paidPhase(scan, 4, () => withPlan(typePhase(scan, value.from), from =>
    withPlan(typePhase(scan, value.to), to =>
      withPlan(prepareEmbedding(scan, value.embedding, at + ".embedding"), embedding => ({
        kind: "copied", value: image => ({ kind: "conversion", from: from(image), to: to(image), embedding: embedding(image) }),
      })))));
}

function prepareBackedIdentity(scan: ProjectionInventory, value: BackedIdentity): PreparedPhase<BackedIdentity> {
  return paidPhase(scan, 3, () => withPlan(prepareBindingsProjection(scan, value.bindings), bindings => {
    const { kind, declaration } = value;
    return { kind: "copied", value: image => ({ kind, declaration, bindings: bindings(image) }) };
  }));
}

function prepareOperationIdentity(scan: ProjectionInventory, value: OperationIdentity, at: string): PreparedPhase<OperationIdentity> {
  switch (value.kind) {
    case "native-operator": case "bigint-operator": case "string-operator": case "boolean-operator":
    case "absence-test": case "pointer-address": case "pointer-read": case "pointer-write": case "pointer-offset":
    case "type-query": case "discard": return borrowPhase(scan, 1, value);
    case "object-construction": case "array-construction": return paidPhase(scan, 2, () => {
      const kind = value.kind;
      const parts = prepareProjectionRows(scan, value.parts, (read, index) =>
        prepareConstructionPart(scan, read, at + ".parts[" + index + "]"));
      return { kind: "copied", value: image => ({ kind, parts: parts(image) }) };
    });
    case "protocol": return paidPhase(scan, 9, () => {
      const steps = prepareProjectionRows(scan, value.steps, read => prepareProtocolStep(scan, read));
      return withPlan(typePhase(scan, value.value), result =>
        withPlan(typePhase(scan, value.completion), completion =>
          withPlan(optionalTypePhase(scan, value.yielded), yielded =>
            withPlan(optionalTypePhase(scan, value.sent), sent =>
              withPlan(typePhase(scan, value.thrown), thrown => {
                const { protocol, asynchronous } = value;
                return { kind: "copied", value: image => ({ kind: "protocol", protocol, asynchronous,
                  value: result(image), completion: completion(image), yielded: yielded(image), sent: sent(image),
                  thrown: thrown(image), steps: steps(image),
                }) };
              })))));
    });
    case "conversion": return prepareConversionIdentity(scan, value, at);
    case "library": case "core": return prepareBackedIdentity(scan, value);
  }
}

export function prepareConstructionPart(scan: ProjectionInventory, read: () => ConstructionPartDecision, at: string):
  PreparedPhase<ConstructionPartDecision> {
  return paidPhase(scan, 5, () => {
    const value = read();
    const destination = deferComponentProjection(scan, () => value.destination, at + ".destination", scan.componentCycle);
    const member = value.member;
    return withPlan(member === null ? holdPhase(null) : prepareMember(scan, member), selected =>
      withPlan(prepareEmbedding(scan, value.embedding, at + ".embedding"), embedding => {
        const { part, source } = value;
        return { kind: "copied", value: image => ({ part, source, destination: destination(image), member: selected(image), embedding: embedding(image) }) };
      }));
  });
}

function prepareOperationAs<Identity extends OperationIdentity>(
  scan: ProjectionInventory, value: TypedOperationOf<Identity>,
  prepare: (identity: Identity) => PreparedPhase<Identity>,
): PreparedPhase<TypedOperationOf<Identity>> {
  return paidPhase(scan, 2, () => paidPhase(scan, 5, () => {
    const decision = value.decision;
    const operands = typesPhase(scan, decision.operands);
    const operation = deferProjection(scan, () => prepare(decision.operation));
    return withPlan(typePhase(scan, decision.result), result => {
      const { execution } = decision;
      const permissionScope = value.permissionScope;
      return { kind: "copied", value: image => ({ permissionScope, decision: {
        kind: "selected", operation: operation(image), operands: operands(image), result: result(image), execution,
      } }) };
    });
  }));
}

export function prepareTypedOperation(scan: ProjectionInventory, value: TypedOperation, at: string): PreparedPhase<TypedOperation> {
  return prepareOperationAs(scan, value, identity => prepareOperationIdentity(scan, identity, at + ".decision.operation"));
}

export function prepareRefinement(scan: ProjectionInventory, value: RefinementDecision, at: string): PreparedPhase<RefinementDecision> {
  switch (value.kind) {
    case "identity": return paidPhase(scan, 2, () =>
      withPlan(typePhase(scan, value.type), type => ({ kind: "copied", value: image => ({ kind: "identity", type: type(image) }) })));
    case "narrowed": return paidPhase(scan, 5, () =>
      withPlan(typePhase(scan, value.source), source => withPlan(typePhase(scan, value.result), result =>
        withPlan(prepareEmbeddingProof(scan, value.proof, at + ".proof"), proof => {
          const failure = value.failure;
          return { kind: "copied", value: image => ({ kind: "narrowed", source: source(image), result: result(image), proof: proof(image), failure }) };
        }))));
  }
}

export function withOptionalPlan<Source, Value>(source: Source | null, prepare: (source: Source) => PreparedPhase<Value>):
  PreparedPhase<Value | null> {
  return source === null ? holdPhase(null) : prepare(source);
}

function prepareCandidateEndpoint(scan: ProjectionInventory, read: () => CandidateEndpoint): PreparedPhase<CandidateEndpoint> {
  return paidPhase(scan, 8, () => {
    const candidate = read();
    return withPlan(prepareEndpoint(scan, () => candidate.advertised), advertised => {
      const advertisedSignature = candidate.advertisedSignature;
      const early = inventorySignature(scan, advertisedSignature);
      if (early !== null) return { kind: "refused", stop: early };
      return withPlan(prepareEndpoint(scan, () => candidate.api), api => {
        const apiSignature = candidate.apiSignature;
        const late = inventorySignature(scan, apiSignature);
        if (late !== null) return { kind: "refused", stop: late };
        return withPlan(prepareBindingsProjection(scan, candidate.bindings), bindings => {
          const { ordinal, declaration, conditionalFailure } = candidate;
          return { kind: "copied", value: image => ({ ordinal, declaration, conditionalFailure,
            advertised: advertised(image), advertisedSignature: image.signature(advertisedSignature),
            api: api(image), apiSignature: image.signature(apiSignature), bindings: bindings(image),
          }) };
        });
      });
    });
  });
}

function prepareInvocation(scan: ProjectionInventory, value: DeferredInvocation, at: string): PreparedPhase<DeferredInvocation> {
  const stop = inventoryRecord(scan, 2) ?? inventoryRecord(scan, 3);
  if (stop !== null) return { kind: "refused", stop };
  const { bindings, occurrence, origin } = value.input.context;
  return withPlan(prepareBindingsProjection(scan, bindings), ready => {
    const context: PhaseProject<RuleContext> = image => ({ occurrence, origin, bindings: ready(image) });
    return prepareInvocationInput(scan, value, context, at);
  });
}

function prepareInvocationInput(scan: ProjectionInventory, invocation: DeferredInvocation,
  context: PhaseProject<RuleContext>, at: string): PreparedPhase<DeferredInvocation> {
  const evidence = (read: () => TypeEvidence): PreparedPhase<TypeEvidence> => prepareEvidenceProjection(scan, read);
  const optional = (value: TypeEvidence | null): PreparedPhase<TypeEvidence | null> =>
    withOptionalPlan(value, ready => evidence(() => ready));
  const rows = (values: readonly TypeEvidence[]): PhaseProject<readonly TypeEvidence[]> =>
    prepareProjectionRows(scan, values, evidence);
  switch (invocation.rule) {
    case "embed": return paidPhase(scan, 4, () => {
      const input = invocation.input;
      return withPlan(evidence(() => input.from), from => withPlan(evidence(() => input.to), to => {
        const { role } = input;
        return { kind: "copied", value: image => ({ rule: "embed", input: { context: context(image), from: from(image), to: to(image), role } }) };
      }));
    });
    case "domain-fit": return paidPhase(scan, 3, () => {
      const input = invocation.input;
      return withPlan(evidence(() => input.value), value => withPlan(evidence(() => input.domain), domain => ({
        kind: "copied", value: image => ({ rule: "domain-fit", input: { context: context(image), value: value(image), domain: domain(image) } }),
      })));
    });
    case "memory-equivalent": return paidPhase(scan, 3, () => {
      const input = invocation.input;
      return withPlan(evidence(() => input.left), left => withPlan(evidence(() => input.right), right => ({
        kind: "copied", value: image => ({ rule: "memory-equivalent", input: { context: context(image), left: left(image), right: right(image) } }),
      })));
    });
    case "member": return paidPhase(scan, 5, () => {
      const input = invocation.input;
      return withPlan(evidence(() => input.receiver), receiver => {
        const { key, access, origins } = input;
        return { kind: "copied", value: image => ({ rule: "member", input: { context: context(image), receiver: receiver(image), key, access, origins } }) };
      });
    });
    case "index": return paidPhase(scan, 4, () => {
      const input = invocation.input;
      return withPlan(evidence(() => input.receiver), receiver => withPlan(evidence(() => input.key), key => {
        const { access } = input;
        return { kind: "copied", value: image => ({ rule: "index", input: { context: context(image), receiver: receiver(image), key: key(image), access } }) };
      }));
    });
    case "construct-literal": return paidPhase(scan, 5, () => {
      const input = invocation.input;
      const parts = prepareProjectionRows<LiteralConstructionPart, LiteralConstructionPart>(scan, input.parts,
        read => paidPhase(scan, 0, () => {
          const part = read();
          const remaining = inventoryFields(scan, part.kind === "property" ? 4 : 3);
          if (remaining !== null) return { kind: "refused", stop: remaining };
          return withPlan(evidence(() => part.value), (value): PreparedPhase<LiteralConstructionPart> => {
            const { kind, occurrence } = part;
            if (kind === "property") {
              const { key } = part;
              return { kind: "copied", value: image => ({ kind, occurrence, key, value: value(image) }) };
            }
            return { kind: "copied", value: image => ({ kind, occurrence, value: value(image) }) };
          });
        }));
      return withPlan(optional(input.destination), destination => withPlan(evidence(() => input.result), result => {
        const { construction } = input;
        return { kind: "copied", value: image => ({ rule: "construct-literal", input: {
          context: context(image), construction, parts: parts(image), destination: destination(image), result: result(image),
        } }) };
      }));
    });
    case "candidate": return paidPhase(scan, 7, () => {
      const input = invocation.input;
      const typeArguments = rows(input.typeArguments);
      const args = prepareProjectionRows<CandidateArgument, CandidateArgument>(scan, input.arguments, read => paidPhase(scan, 4, () => {
        const argument = read();
        const elements = argument.tuple;
        const tuple = elements === null ? () => null : rows(elements);
        return withPlan(evidence(() => argument.value), value => {
          const { occurrence, kind } = argument;
          return { kind: "copied", value: image => ({ occurrence, kind, tuple: tuple(image), value: value(image) }) };
        });
      }));
      const candidates = prepareProjectionRows(scan, input.candidates, read => prepareCandidateEndpoint(scan, read));
      return withPlan(evidence(() => input.callee), callee => withPlan(optional(input.receiver), receiver => {
        const { kind } = input;
        return { kind: "copied", value: image => ({ rule: "candidate", input: { context: context(image),
          kind, callee: callee(image), receiver: receiver(image), typeArguments: typeArguments(image), arguments: args(image), candidates: candidates(image),
        } }) };
      }));
    });
    case "operator": return paidPhase(scan, 4, () => {
      const { operands, operator, permissionScope } = invocation.input;
      const ready = rows(operands);
      return { kind: "copied", value: image => ({ rule: "operator", input: { context: context(image), operator, operands: ready(image), permissionScope } }) };
    });
    case "literal-fit": return paidPhase(scan, 3, () => {
      const input = invocation.input;
      return withPlan(evidence(() => input.destination), destination => {
        const { literal } = input;
        return { kind: "copied", value: image => ({ rule: "literal-fit", input: { context: context(image), literal, destination: destination(image) } }) };
      });
    });
    case "protocol": return paidPhase(scan, 9, () => {
      const input = invocation.input;
      const operands = rows(input.operands);
      return withPlan(optional(input.subject), subject => withPlan(optional(input.completion), completion =>
        withPlan(optional(input.yielded), yielded => withPlan(optional(input.sent), sent =>
          withPlan(evidence(() => input.thrown), thrown => {
            const { kind, asynchronous } = input;
            return { kind: "copied", value: image => ({ rule: "protocol", input: {
              context: context(image), kind, asynchronous, subject: subject(image), operands: operands(image),
              completion: completion(image), yielded: yielded(image), sent: sent(image), thrown: thrown(image),
            } }) };
          })))));
    });
    case "refinement": return paidPhase(scan, 3, () => {
      const input = invocation.input;
      return withPlan(evidence(() => input.source), source => withPlan(evidence(() => input.checked), checked => ({
        kind: "copied", value: image => ({ rule: "refinement", input: { context: context(image), source: source(image), checked: checked(image) } }),
      })));
    });
    case "library": return paidPhase(scan, 5, () => {
      const input = invocation.input;
      const args = rows(input.arguments);
      return withPlan(optional(input.receiver), receiver => withPlan(evidence(() => input.result), result => {
        const { declaration } = input;
        return { kind: "copied", value: image => ({ rule: "library", input: { context: context(image), declaration,
          receiver: receiver(image), arguments: args(image), result: result(image),
        } }) };
      }));
    });
    case "core": return paidPhase(scan, 6, () => {
      const input = invocation.input;
      const operands = rows(input.operands);
      return withPlan(prepareCoreProjection(scan, input.captured, at + ".input.captured", scan.componentCycle), captured =>
        withPlan(evidence(() => input.result), result => {
          const { declaration, permissionScope } = input;
          return { kind: "copied", value: image => ({ rule: "core", input: { context: context(image),
            captured: captured(image), declaration, operands: operands(image), result: result(image), permissionScope,
          } }) };
        }));
    });
    case "closure": return paidPhase(scan, 3, () => {
      const input = invocation.input;
      const captures = prepareProjectionRows<ClosureCaptureEvidence, ClosureCaptureEvidence>(scan, input.captures,
        read => paidPhase(scan, 4, () => {
          const capture = read();
          return withPlan(evidence(() => capture.value), value => {
            const { local, reassignable, incoming } = capture;
            return { kind: "copied", value: image => ({ local, reassignable, incoming, value: value(image) }) };
          });
        }));
      return withPlan(evidence(() => input.callable), callable => ({
        kind: "copied", value: image => ({ rule: "closure", input: { context: context(image), captures: captures(image), callable: callable(image) } }),
      }));
    });
  }
}

export function prepareDeferred(scan: ProjectionInventory, value: DeferredDecision, at: string): PreparedPhase<DeferredDecision> {
  return paidPhase(scan, 2, () => {
    const invocation = deferProjection(scan, () => prepareInvocation(scan, value.invocation, at + ".invocation"));
    return withPlan(typePhase(scan, value.result), result =>
      ({ kind: "copied", value: image => ({ invocation: invocation(image), result: result(image) }) }));
  });
}

export function prepareOutcome<Decision>(scan: ProjectionInventory, read: () => RuleOutcome<Decision>,
  prepare: (value: Decision) => PreparedPhase<Decision>, at: string): PreparedPhase<RuleOutcome<Decision>> {
  return paidPhase<RuleOutcome<Decision>>(scan, 2, () => {
    const value = read();
    switch (value.kind) {
      case "decided": return withPlan(prepare(value.decision), decision =>
        ({ kind: "copied", value: image => ({ kind: "decided", decision: decision(image) }) }));
      case "deferred": return withPlan(prepareDeferred(scan, value.deferred, at + ".deferred"), deferred =>
        ({ kind: "copied", value: image => ({ kind: "deferred", deferred: deferred(image) }) }));
    }
  });
}

export function prepareCallee(scan: ProjectionInventory, value: ResolvedCallee): PreparedReferenceProjection<ResolvedCallee> {
  const header = inventoryRecord(scan, 2);
  if (header !== null) return { kind: "refused", stop: header };
  const decision = prepareApplication(scan, value.decision);
  if (decision.kind === "refused") return decision;
  const rawActivation = value.activation;
  const activation: PreparedReferenceProjection<BodyInstance | null> = rawActivation === null
    ? { kind: "copied", value: () => null } : prepareInstance(scan, rawActivation, null);
  if (activation.kind === "refused") return activation;
  return { kind: "copied", value: rewrite => ({ decision: decision.value(rewrite), activation: activation.value(rewrite) }) };
}

export function prepareSelection(scan: ProjectionInventory, value: MemberSelection): PreparedReferenceProjection<MemberSelection> {
  const header = inventoryRecord(scan, 3);
  if (header !== null) return { kind: "refused", stop: header };
  const decision = prepareMember(scan, value.decision);
  if (decision.kind === "refused") return decision;
  const rawGetter = value.getter;
  const getter: PreparedReferenceProjection<ResolvedCallee | null> = rawGetter === null
    ? { kind: "copied", value: () => null } : prepareCallee(scan, rawGetter);
  if (getter.kind === "refused") return getter;
  const rawSetter = value.setter;
  const setter: PreparedReferenceProjection<ResolvedCallee | null> = rawSetter === null
    ? { kind: "copied", value: () => null } : prepareCallee(scan, rawSetter);
  if (setter.kind === "refused") return setter;
  return { kind: "copied", value: rewrite => ({
    decision: decision.value(rewrite), getter: getter.value(rewrite), setter: setter.value(rewrite),
  }) };
}

function prepareRestPart(scan: ProjectionInventory, read: () => TirRestPart): PreparedPhase<TirRestPart> {
  const row = chargeInstantiationWork(scan.meter);
  if (row !== null) return { kind: "refused", stop: row };
  const part = read();
  if (part.kind === "value") return holdPhase(part);
  const record = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3);
  if (record !== null) return { kind: "refused", stop: record };
  const { expression, tuple } = part;
  const elements = tuple === null ? () => null : typesPhase(scan, tuple);
  return { kind: "copied", value: image => ({ kind: "spread", expression, tuple: elements(image) }) };
}

function prepareTirArgument(scan: ProjectionInventory, read: () => TirArgument): PreparedPhase<TirArgument> {
  const row = chargeInstantiationWork(scan.meter);
  if (row !== null) return { kind: "refused", stop: row };
  const argument = read();
  switch (argument.kind) {
    case "provided": return holdPhase(argument);
    case "rest": {
      const record = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3);
      if (record !== null) return { kind: "refused", stop: record };
      const parameter = argument.parameter;
      const parts = prepareProjectionRows(scan, argument.parts, read => prepareRestPart(scan, read));
      return { kind: "copied", value: image => ({ kind: "rest", parameter, parts: parts(image) }) };
    }
    case "omitted": {
      const value = argument.value;
      if (value.kind !== "initializer") return borrowPhase(scan, 1, argument);
      const record = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3);
      if (record !== null) return { kind: "refused", stop: record };
      return paidPhase(scan, 2, () => withPlan(prepareInstance(scan, value.instance, null), instance => {
        const parameter = argument.parameter;
        return { kind: "copied", value: image => ({ kind: "omitted", parameter, value: { kind: "initializer", instance: instance(image) } }) };
      }));
    }
  }
}

export function prepareTirApplication(scan: ProjectionInventory, value: TirApplication): PreparedPhase<TirApplication> {
  return paidPhase(scan, 3, () => {
    const args = prepareProjectionRows(scan, value.arguments, read => prepareTirArgument(scan, read));
    return withPlan(prepareCallee(scan, value.callee), callee => {
      const receiver = value.receiver;
      return { kind: "copied", value: image => ({ receiver, callee: callee(image), arguments: args(image) }) };
    });
  });
}

export function prepareProtocol(scan: ProjectionInventory, value: TirProtocol, at: string): PreparedPhase<TirProtocol> {
  return paidPhase(scan, 7, () => {
    const steps = prepareProjectionRows<TirProtocolStep, TirProtocolStep>(scan, value.steps, (read, index) => paidPhase(scan, 3, () => {
      const step = read();
      return withPlan(prepareTypedOperation(scan, step.operation, at + ".steps[" + index + "].operation"), operation =>
        withPlan(withOptionalPlan(step.callee, callee => prepareCallee(scan, callee)), callee => {
          const role = step.role;
          return { kind: "copied", value: image => ({ role, operation: operation(image), callee: callee(image) }) };
        }));
    }));
    return withPlan(typePhase(scan, value.value), result => withPlan(typePhase(scan, value.completion), completion =>
      withPlan(optionalTypePhase(scan, value.sent), sent => withPlan(typePhase(scan, value.thrown), thrown => {
        const { kind, asynchronous } = value;
        return { kind: "copied", value: image => ({ kind, asynchronous, steps: steps(image), value: result(image),
          completion: completion(image), sent: sent(image), thrown: thrown(image) }) };
      }))));
  });
}

function prepareConversion(scan: ProjectionInventory, value: ConversionDecision, at: string): PreparedPhase<ConversionDecision> {
  switch (value.kind) {
    case "identity": return borrowPhase(scan, 1, value);
    case "convert": return paidPhase(scan, 3, () =>
      withPlan(prepareOperationAs(scan, value.operation, identity => prepareConversionIdentity(scan, identity, at + ".operation.decision.operation")),
        operation => {
          const { role } = value;
          return { kind: "copied", value: image => ({ kind: "convert", role, operation: operation(image) }) };
        }));
    case "backed-convert": return paidPhase(scan, 4, () =>
      withPlan(prepareEmbedding(scan, value.embedding, at + ".embedding"), embedding =>
        withPlan(prepareOperationAs(scan, value.operation, identity => prepareBackedIdentity(scan, identity)), operation => {
          const { role } = value;
          return { kind: "copied", value: image => ({ kind: "backed-convert", role, embedding: embedding(image), operation: operation(image) }) };
        })));
    case "deferred": return paidPhase(scan, 2, () =>
      withPlan(prepareDeferred(scan, value.deferred, at + ".deferred"), deferred =>
        ({ kind: "copied", value: image => ({ kind: "deferred", deferred: deferred(image) }) })));
  }
}

export function prepareValue(scan: ProjectionInventory, value: TypedValue, at: string): PreparedPhase<TypedValue> {
  return paidPhase(scan, 6, () => withPlan(typePhase(scan, value.type), type =>
    withPlan(typePhase(scan, value.convertedType), convertedType =>
      withPlan(prepareConversion(scan, value.conversion, at + ".conversion"), conversion =>
        withPlan(withOptionalPlan(value.narrowing, refinement => prepareRefinement(scan, refinement, at + ".narrowing")), narrowing => {
          const { demand, evidenceIndex } = value;
          return { kind: "copied", value: image => ({ type: type(image), convertedType: convertedType(image),
            conversion: conversion(image), narrowing: narrowing(image), demand, evidenceIndex,
          }) };
        })))));
}


type CorePlan<Value> = (rewrite: TypeReferenceRewrite) => Value;
type Prepared<Value> = SyntaxCopyResult<CorePlan<Value>, InstantiationStop>;

const missingCoreProjection: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A core capture projection uses its actual completed paid preparations." };

function hold<Value>(value: Value): Prepared<Value> {
  return { kind: "copied", value: () => value };
}

export function prepareCoreProjection(scan: ProjectionInventory, core: HirCoreCapture, at: string,
  failCycle: (path: string) => never,
): Prepared<HirCoreCapture> {
  function precharge<Value>(fields: number, action: () => Prepared<Value>): Prepared<Value> {
    const stop = inventoryRecord(scan, fields);
    return stop === null ? action() : { kind: "refused", stop };
  }

  function deferred<Value>(action: () => Prepared<Value>): CorePlan<Value> {
    let complete: CorePlan<Value> | undefined;
    scan.pending.push(() => {
      const prepared = action();
      if (prepared.kind === "refused") return prepared.stop;
      complete = prepared.value;
      return null;
    });
    return rewrite => requirePresent(complete, missingCoreProjection)(rewrite);
  }

  function rows<Value>(source: readonly Value[], fields: number,
    prepare: (value: Value, position: number) => Prepared<Value>,
  ): CorePlan<readonly Value[]> {
    const plans: CorePlan<Value>[] = [];
    const size = source.length;
    let position = 0;
    const next = (): InstantiationStop | null => {
      if (position === size) return null;
      const stop = inventoryRecord(scan, fields);
      if (stop !== null) return stop;
      const index = position;
      position += 1;
      const value = requirePresent(source[index], missingCoreProjection);
      scan.pending.push(next);
      const plan = prepare(value, index);
      if (plan.kind === "refused") return plan.stop;
      plans.push(plan.value);
      return null;
    };
    scan.pending.push(next);
    return rewrite => plans.map(plan => plan(rewrite));
  }

  function captured<Value>(value: CapturedFact<Value>,
    prepare: (value: Value) => Prepared<Value>,
  ): Prepared<CapturedFact<Value>> {
    if (value.kind === "unavailable") {
      const stop = inventoryFields(scan, 2);
      return stop === null ? hold(value) : { kind: "refused", stop };
    }
    return precharge(2, () => {
      const retained = prepare(value.value);
      return retained.kind === "refused" ? retained : { kind: "copied", value: rewrite => ({
        kind: "available", value: retained.value(rewrite),
      }) };
    });
  }

  function type(value: TyId): Prepared<TyId> {
    const stop = inventoryType(scan, value);
    return stop === null ? { kind: "copied", value: rewrite => rewrite.type(value) } : { kind: "refused", stop };
  }

  function fieldMarker(field: HirFieldMarkerCapture): Prepared<HirFieldMarkerCapture> {
    const ready = captured(field.type, type);
    if (ready.kind === "refused") return ready;
    const { name, typeNode, readonly } = field;
    return { kind: "copied", value: rewrite => ({ name, typeNode, type: ready.value(rewrite), readonly }) };
  }

  function markers(value: HirMarkersCapture): Prepared<HirMarkersCapture> {
    return precharge(5, () => {
      const { struct, field, defaultValue, jsString, application } = value;
      const structPlan = struct === null ? () => null : deferred(() => precharge(2, () => {
        const fields = captured(struct.fields, fields => ({
          kind: "copied", value: rows(fields, 4, fieldMarker),
        }));
        if (fields.kind === "refused") return fields;
        const valueType = struct.valueType;
        return { kind: "copied", value: rewrite => ({ valueType, fields: fields.value(rewrite) }) };
      }));
      const fieldPlan = field === null ? () => null : deferred(() => precharge(4, () => fieldMarker(field)));
      const defaultPlan = defaultValue === null ? () => null : deferred(() => precharge(2, () => {
        const retained = captured(defaultValue.type, type);
        if (retained.kind === "refused") return retained;
        const typeNode = defaultValue.typeNode;
        return { kind: "copied", value: rewrite => ({ typeNode, type: retained.value(rewrite) }) };
      }));
      return { kind: "copied", value: rewrite => ({
        struct: structPlan(rewrite), field: fieldPlan(rewrite), defaultValue: defaultPlan(rewrite), jsString, application,
      }) };
    });
  }

  function capturedType(value: HirCapturedType, path: string): Prepared<HirCapturedType> {
    const retainedType = captured(value.type, type);
    if (retainedType.kind === "refused") return retainedType;
    const component = deferComponentProjection(scan, () => value.component, path + ".component", failCycle);
    return { kind: "copied", value: rewrite => ({ type: retainedType.value(rewrite), component: component(rewrite) }) };
  }

  function pointer(value: HirPointerTypeCapture | null): Prepared<HirPointerTypeCapture | null> {
    if (value === null) return hold(null);
    switch (value.kind) {
      case "raw-address":
      case "native-pointer": {
        const stop = inventoryFields(scan, 1);
        return stop === null ? hold(value) : { kind: "refused", stop };
      }
      case "typed-location": return precharge(3, () => precharge(2, () => {
        const pointee = capturedType(value.pointee, at + ".pointerType.value.pointee");
        if (pointee.kind === "refused") return pointee;
        const mutability = value.mutability;
        return { kind: "copied", value: rewrite => ({ kind: "typed-location", pointee: pointee.value(rewrite), mutability }) };
      }));
      case "function-pointer": return precharge(5, () => {
        const parameters = rows(value.parameters, 2, (parameter, position) =>
          capturedType(parameter, at + ".pointerType.value.parameters[" + position + "]"));
        return precharge(2, () => {
          const result = capturedType(value.result, at + ".pointerType.value.result");
          if (result.kind === "refused") return result;
          const { declaration, abi } = value;
          return { kind: "copied", value: rewrite => ({
            kind: "function-pointer", declaration, parameters: parameters(rewrite), result: result.value(rewrite), abi,
          }) };
        });
      });
    }
  }

  function fieldBinding(value: HirFieldBindingCapture | null): Prepared<HirFieldBindingCapture | null> {
    if (value === null) return hold(null);
    return precharge(7, () => {
      const bindings = captured(value.bindings, input => {
        const result = prepareBindingsProjection(scan, input);
        return result.kind === "refused" ? result : { kind: "copied", value: result.value };
      });
      if (bindings.kind === "refused") return bindings;
      const owner = captured(value.owner, type);
      if (owner.kind === "refused") return owner;
      const pointee = captured(value.pointee, type);
      if (pointee.kind === "refused") return pointee;
      const { occurrence, fieldExpression, field, pointerExpression } = value;
      return { kind: "copied", value: rewrite => ({
        occurrence, bindings: bindings.value(rewrite), owner: owner.value(rewrite), pointee: pointee.value(rewrite),
        fieldExpression, field, pointerExpression,
      }) };
    });
  }

  function recordBinding(value: HirRecordBindingCapture | null): Prepared<HirRecordBindingCapture | null> {
    if (value === null) return hold(null);
    return precharge(6, () => {
      const bindings = captured(value.bindings, input => {
        const result = prepareBindingsProjection(scan, input);
        return result.kind === "refused" ? result : { kind: "copied", value: result.value };
      });
      if (bindings.kind === "refused") return bindings;
      const source = captured(value.source, type);
      if (source.kind === "refused") return source;
      const { occurrence, layoutExpression, layout, fields } = value;
      return { kind: "copied", value: rewrite => ({
        occurrence, bindings: bindings.value(rewrite), source: source.value(rewrite), layoutExpression, layout, fields,
      }) };
    });
  }

  return precharge<HirCoreCapture>(10, () => {
    const markerPlan = captured(core.markers, markers);
    if (markerPlan.kind === "refused") return markerPlan;
    const pointerPlan = captured(core.pointerType, pointer);
    if (pointerPlan.kind === "refused") return pointerPlan;
    const fieldPlan = captured(core.fieldBinding, fieldBinding);
    if (fieldPlan.kind === "refused") return fieldPlan;
    const recordPlan = captured(core.recordBinding, recordBinding);
    if (recordPlan.kind === "refused") return recordPlan;
    const { provider, pointerOperation, attribute, safety, argumentPassing, flowState } = core;
    return { kind: "copied", value: rewrite => ({
      provider, markers: markerPlan.value(rewrite), pointerType: pointerPlan.value(rewrite), pointerOperation,
      fieldBinding: fieldPlan.value(rewrite), recordBinding: recordPlan.value(rewrite), attribute, safety, argumentPassing, flowState,
    }) };
  });
}
