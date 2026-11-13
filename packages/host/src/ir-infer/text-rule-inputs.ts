import type { CandidateArgument, CandidateEndpoint, CandidateInput, ClosureCaptureEvidence, ClosureInput, CoreInput, DomainFitInput, EmbedInput, IndexInput, LibraryInput, LiteralConstructionInput, LiteralConstructionPart, LiteralFitInput, MemberInput, MemoryEquivalentInput, OperatorInput, ProtocolInput, RefinementInput, RuleContext } from "./contract.js";
import type { CaptureValuesSchemas } from "./text-capture-values.js";
import type { CapturesSchemas } from "./text-captures.js";
import type { ConstraintsSchemas } from "./text-constraints.js";
import { arraySchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import type { NodeRef } from "../ids/contract.js";
import type { MemberKey, TypeEvidence } from "../ir-types/contract.js";
import type { RecordSchema } from "./text-data.js";

export interface ConstructionElementRecord {
  readonly kind: "element" | "spread";
  readonly occurrence: NodeRef;
  readonly value: TypeEvidence;
}

export interface ConstructionPropertyRecord {
  readonly kind: "property";
  readonly occurrence: NodeRef;
  readonly key: MemberKey;
  readonly value: TypeEvidence;
}

export interface ConstructionSpreadRecord {
  readonly kind: "element" | "spread";
  readonly occurrence: NodeRef;
  readonly value: TypeEvidence;
}

export interface CallInputRecord {
  readonly kind: "call" | "construct" | "accessor-get" | "accessor-set";
  readonly context: RuleContext;
  readonly callee: TypeEvidence;
  readonly receiver: TypeEvidence | null;
  readonly typeArguments: readonly (TypeEvidence)[];
  readonly arguments: readonly (CandidateArgument)[];
  readonly candidates: readonly (CandidateEndpoint)[];
}

export interface ConstructInputRecord {
  readonly kind: "call" | "construct" | "accessor-get" | "accessor-set";
  readonly context: RuleContext;
  readonly callee: TypeEvidence;
  readonly receiver: TypeEvidence | null;
  readonly typeArguments: readonly (TypeEvidence)[];
  readonly arguments: readonly (CandidateArgument)[];
  readonly candidates: readonly (CandidateEndpoint)[];
}

export interface GetterInputRecord {
  readonly kind: "call" | "construct" | "accessor-get" | "accessor-set";
  readonly context: RuleContext;
  readonly callee: TypeEvidence;
  readonly receiver: TypeEvidence | null;
  readonly typeArguments: readonly (TypeEvidence)[];
  readonly arguments: readonly (CandidateArgument)[];
  readonly candidates: readonly (CandidateEndpoint)[];
}

export interface SetterInputRecord {
  readonly kind: "call" | "construct" | "accessor-get" | "accessor-set";
  readonly context: RuleContext;
  readonly callee: TypeEvidence;
  readonly receiver: TypeEvidence | null;
  readonly typeArguments: readonly (TypeEvidence)[];
  readonly arguments: readonly (CandidateArgument)[];
  readonly candidates: readonly (CandidateEndpoint)[];
}

export interface CandidateValueRecord {
  readonly kind: "value" | "spread";
  readonly occurrence: NodeRef;
  readonly value: TypeEvidence;
  readonly tuple: readonly (TypeEvidence)[] | null;
}

export interface CandidateSpreadRecord {
  readonly kind: "value" | "spread";
  readonly occurrence: NodeRef;
  readonly value: TypeEvidence;
  readonly tuple: readonly (TypeEvidence)[] | null;
}

export interface IterateInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface AwaitInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface YieldInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface DelegateInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface DisposeInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface SpreadInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface PassingInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface PointerInputRecord {
  readonly kind: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly context: RuleContext;
  readonly asynchronous: boolean;
  readonly subject: TypeEvidence | null;
  readonly operands: readonly (TypeEvidence)[];
  readonly completion: TypeEvidence | null;
  readonly yielded: TypeEvidence | null;
  readonly sent: TypeEvidence | null;
  readonly thrown: TypeEvidence;
}

export interface RuleInputsSchemas {
  readonly ruleContextSchema: RecordSchema<RuleContext>;
  readonly embedInputSchema: RecordSchema<EmbedInput>;
  readonly domainFitInputSchema: RecordSchema<DomainFitInput>;
  readonly memoryEquivalentInputSchema: RecordSchema<MemoryEquivalentInput>;
  readonly memberInputSchema: RecordSchema<MemberInput>;
  readonly indexInputSchema: RecordSchema<IndexInput>;
  readonly literalConstructionInputSchema: RecordSchema<LiteralConstructionInput>;
  readonly literalConstructionPartSchema: RecordSchema<LiteralConstructionPart>;
  readonly constructionElementSchema: RecordSchema<ConstructionElementRecord>;
  readonly constructionPropertySchema: RecordSchema<ConstructionPropertyRecord>;
  readonly constructionSpreadSchema: RecordSchema<ConstructionSpreadRecord>;
  readonly candidateInputSchema: RecordSchema<CandidateInput>;
  readonly callInputSchema: RecordSchema<CallInputRecord>;
  readonly constructInputSchema: RecordSchema<ConstructInputRecord>;
  readonly getterInputSchema: RecordSchema<GetterInputRecord>;
  readonly setterInputSchema: RecordSchema<SetterInputRecord>;
  readonly candidateArgumentSchema: RecordSchema<CandidateArgument>;
  readonly candidateValueSchema: RecordSchema<CandidateValueRecord>;
  readonly candidateSpreadSchema: RecordSchema<CandidateSpreadRecord>;
  readonly candidateEndpointSchema: RecordSchema<CandidateEndpoint>;
  readonly operatorInputSchema: RecordSchema<OperatorInput>;
  readonly literalFitInputSchema: RecordSchema<LiteralFitInput>;
  readonly protocolInputSchema: RecordSchema<ProtocolInput>;
  readonly iterateInputSchema: RecordSchema<IterateInputRecord>;
  readonly awaitInputSchema: RecordSchema<AwaitInputRecord>;
  readonly yieldInputSchema: RecordSchema<YieldInputRecord>;
  readonly delegateInputSchema: RecordSchema<DelegateInputRecord>;
  readonly disposeInputSchema: RecordSchema<DisposeInputRecord>;
  readonly spreadInputSchema: RecordSchema<SpreadInputRecord>;
  readonly passingInputSchema: RecordSchema<PassingInputRecord>;
  readonly pointerInputSchema: RecordSchema<PointerInputRecord>;
  readonly refinementInputSchema: RecordSchema<RefinementInput>;
  readonly libraryInputSchema: RecordSchema<LibraryInput>;
  readonly coreInputSchema: RecordSchema<CoreInput>;
  readonly closureInputSchema: RecordSchema<ClosureInput>;
  readonly closureCaptureEvidenceSchema: RecordSchema<ClosureCaptureEvidence>;
}

export function createRuleInputsSchemas(captureValues: CaptureValuesSchemas, captures: CapturesSchemas, constraints: ConstraintsSchemas, data: DataSchemas, evidence: EvidenceSchemas): RuleInputsSchemas {
  const { diagnosticSchema, hirCallableEndpointSchema } = captureValues;
  const { hirCoreCaptureSchema } = captures;
  const { accessRoleSchema, constructionKindSchema, flowRoleSchema, operatorSchema } = constraints;
  const { bindingVectorSchema, booleanSchema, defSchema, literalValueSchema, localRefSchema, memberKeySchema, memberOriginSchema, nodeRefSchema, numberSchema, originSchema } = data;
  const { typeEvidenceSchema } = evidence;
  const ruleContextSchema = recordSchema<RuleContext>("RuleContext", "RuleContext", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const origin = read("origin", () => originSchema, value => value.origin);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [occurrence, origin, bindings], value: () => ({ occurrence: occurrence.value(), origin: origin.value(), bindings: bindings.value() }) };
  });

  const embedInputSchema = recordSchema<EmbedInput>("EmbedInput", "EmbedInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const from = read("from", () => typeEvidenceSchema, value => value.from);
    const to = read("to", () => typeEvidenceSchema, value => value.to);
    const role = read("role", () => flowRoleSchema, value => value.role);
    return { fields: [context, from, to, role], value: () => ({ context: context.value(), from: from.value(), to: to.value(), role: role.value() }) };
  });

  const domainFitInputSchema = recordSchema<DomainFitInput>("DomainFitInput", "DomainFitInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    const domain = read("domain", () => typeEvidenceSchema, value => value.domain);
    return { fields: [context, value, domain], value: () => ({ context: context.value(), value: value.value(), domain: domain.value() }) };
  });

  const memoryEquivalentInputSchema = recordSchema<MemoryEquivalentInput>("MemoryEquivalentInput", "MemoryEquivalentInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const left = read("left", () => typeEvidenceSchema, value => value.left);
    const right = read("right", () => typeEvidenceSchema, value => value.right);
    return { fields: [context, left, right], value: () => ({ context: context.value(), left: left.value(), right: right.value() }) };
  });

  const memberInputSchema = recordSchema<MemberInput>("MemberInput", "MemberInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const receiver = read("receiver", () => typeEvidenceSchema, value => value.receiver);
    const key = read("key", () => memberKeySchema, value => value.key);
    const access = read("access", () => accessRoleSchema, value => value.access);
    const origins = read("origins", () => arraySchema(memberOriginSchema), value => value.origins);
    return { fields: [context, receiver, key, access, origins], value: () => ({ context: context.value(), receiver: receiver.value(), key: key.value(), access: access.value(), origins: origins.value() }) };
  });

  const indexInputSchema = recordSchema<IndexInput>("IndexInput", "IndexInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const receiver = read("receiver", () => typeEvidenceSchema, value => value.receiver);
    const key = read("key", () => typeEvidenceSchema, value => value.key);
    const access = read("access", () => accessRoleSchema, value => value.access);
    return { fields: [context, receiver, key, access], value: () => ({ context: context.value(), receiver: receiver.value(), key: key.value(), access: access.value() }) };
  });

  const literalConstructionInputSchema = recordSchema<LiteralConstructionInput>("LiteralConstructionInput", "LiteralConstructionInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const construction = read("construction", () => constructionKindSchema, value => value.construction);
    const parts = read("parts", () => arraySchema(literalConstructionPartSchema), value => value.parts);
    const destination = read("destination", () => nullableSchema(typeEvidenceSchema), value => value.destination);
    return { fields: [context, construction, parts, destination], value: () => ({ context: context.value(), construction: construction.value(), parts: parts.value(), destination: destination.value() }) };
  });

  const literalConstructionPartSchema: RecordSchema<LiteralConstructionPart> = unionSchema<LiteralConstructionPart>("LiteralConstructionPart",
    () => [constructionElementSchema, constructionPropertySchema, constructionSpreadSchema], value => {
    switch (value.kind) {
      case "element": return constructionElementSchema.stage(value);
      case "property": return constructionPropertySchema.stage(value);
      case "spread": return constructionSpreadSchema.stage(value);
    }
  });

  const constructionElementSchema = recordSchema<ConstructionElementRecord>("ConstructionElement", "element", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    return { fields: [occurrence, value], value: () => ({ kind: "element", occurrence: occurrence.value(), value: value.value() }) };
  });

  const constructionPropertySchema = recordSchema<ConstructionPropertyRecord>("ConstructionProperty", "property", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const key = read("key", () => memberKeySchema, value => value.key);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    return { fields: [occurrence, key, value], value: () => ({ kind: "property", occurrence: occurrence.value(), key: key.value(), value: value.value() }) };
  });

  const constructionSpreadSchema = recordSchema<ConstructionSpreadRecord>("ConstructionSpread", "spread", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    return { fields: [occurrence, value], value: () => ({ kind: "spread", occurrence: occurrence.value(), value: value.value() }) };
  });

  const candidateInputSchema: RecordSchema<CandidateInput> = unionSchema<CandidateInput>("CandidateInput",
    () => [callInputSchema, constructInputSchema, getterInputSchema, setterInputSchema], value => {
    switch (value.kind) {
      case "call": return callInputSchema.stage(value);
      case "construct": return constructInputSchema.stage(value);
      case "accessor-get": return getterInputSchema.stage(value);
      case "accessor-set": return setterInputSchema.stage(value);
    }
  });

  const callInputSchema = recordSchema<CallInputRecord>("CallInput", "call", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const callee = read("callee", () => typeEvidenceSchema, value => value.callee);
    const receiver = read("receiver", () => nullableSchema(typeEvidenceSchema), value => value.receiver);
    const typeArguments = read("typeArguments", () => arraySchema(typeEvidenceSchema), value => value.typeArguments);
    const argumentsField = read("arguments", () => arraySchema(candidateArgumentSchema), value => value.arguments);
    const candidates = read("candidates", () => arraySchema(candidateEndpointSchema), value => value.candidates);
    return { fields: [context, callee, receiver, typeArguments, argumentsField, candidates], value: () => ({ kind: "call", context: context.value(), callee: callee.value(), receiver: receiver.value(), typeArguments: typeArguments.value(), arguments: argumentsField.value(), candidates: candidates.value() }) };
  });

  const constructInputSchema = recordSchema<ConstructInputRecord>("ConstructInput", "construct", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const callee = read("callee", () => typeEvidenceSchema, value => value.callee);
    const receiver = read("receiver", () => nullableSchema(typeEvidenceSchema), value => value.receiver);
    const typeArguments = read("typeArguments", () => arraySchema(typeEvidenceSchema), value => value.typeArguments);
    const argumentsField = read("arguments", () => arraySchema(candidateArgumentSchema), value => value.arguments);
    const candidates = read("candidates", () => arraySchema(candidateEndpointSchema), value => value.candidates);
    return { fields: [context, callee, receiver, typeArguments, argumentsField, candidates], value: () => ({ kind: "construct", context: context.value(), callee: callee.value(), receiver: receiver.value(), typeArguments: typeArguments.value(), arguments: argumentsField.value(), candidates: candidates.value() }) };
  });

  const getterInputSchema = recordSchema<GetterInputRecord>("GetterInput", "accessor-get", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const callee = read("callee", () => typeEvidenceSchema, value => value.callee);
    const receiver = read("receiver", () => nullableSchema(typeEvidenceSchema), value => value.receiver);
    const typeArguments = read("typeArguments", () => arraySchema(typeEvidenceSchema), value => value.typeArguments);
    const argumentsField = read("arguments", () => arraySchema(candidateArgumentSchema), value => value.arguments);
    const candidates = read("candidates", () => arraySchema(candidateEndpointSchema), value => value.candidates);
    return { fields: [context, callee, receiver, typeArguments, argumentsField, candidates], value: () => ({ kind: "accessor-get", context: context.value(), callee: callee.value(), receiver: receiver.value(), typeArguments: typeArguments.value(), arguments: argumentsField.value(), candidates: candidates.value() }) };
  });

  const setterInputSchema = recordSchema<SetterInputRecord>("SetterInput", "accessor-set", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const callee = read("callee", () => typeEvidenceSchema, value => value.callee);
    const receiver = read("receiver", () => nullableSchema(typeEvidenceSchema), value => value.receiver);
    const typeArguments = read("typeArguments", () => arraySchema(typeEvidenceSchema), value => value.typeArguments);
    const argumentsField = read("arguments", () => arraySchema(candidateArgumentSchema), value => value.arguments);
    const candidates = read("candidates", () => arraySchema(candidateEndpointSchema), value => value.candidates);
    return { fields: [context, callee, receiver, typeArguments, argumentsField, candidates], value: () => ({ kind: "accessor-set", context: context.value(), callee: callee.value(), receiver: receiver.value(), typeArguments: typeArguments.value(), arguments: argumentsField.value(), candidates: candidates.value() }) };
  });

  const candidateArgumentSchema: RecordSchema<CandidateArgument> = unionSchema<CandidateArgument>("CandidateArgument",
    () => [candidateValueSchema, candidateSpreadSchema], value => {
    switch (value.kind) {
      case "value": return candidateValueSchema.stage(value);
      case "spread": return candidateSpreadSchema.stage(value);
    }
  });

  const candidateValueSchema = recordSchema<CandidateValueRecord>("CandidateValue", "value", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    const tuple = read("tuple", () => nullableSchema(arraySchema(typeEvidenceSchema)), value => value.tuple);
    return { fields: [occurrence, value, tuple], value: () => ({ kind: "value", occurrence: occurrence.value(), value: value.value(), tuple: tuple.value() }) };
  });

  const candidateSpreadSchema = recordSchema<CandidateSpreadRecord>("CandidateSpread", "spread", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const value = read("value", () => typeEvidenceSchema, value => value.value);
    const tuple = read("tuple", () => nullableSchema(arraySchema(typeEvidenceSchema)), value => value.tuple);
    return { fields: [occurrence, value, tuple], value: () => ({ kind: "spread", occurrence: occurrence.value(), value: value.value(), tuple: tuple.value() }) };
  });

  const candidateEndpointSchema = recordSchema<CandidateEndpoint>("CandidateEndpoint", "CandidateEndpoint", read => {
    const ordinal = read("ordinal", () => numberSchema, value => value.ordinal);
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const advertised = read("advertised", () => hirCallableEndpointSchema, value => value.advertised);
    const api = read("api", () => hirCallableEndpointSchema, value => value.api);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    const conditionalFailure = read("conditionalFailure", () => nullableSchema(diagnosticSchema), value => value.conditionalFailure);
    return { fields: [ordinal, declaration, advertised, api, bindings, conditionalFailure], value: () => ({ ordinal: ordinal.value(), declaration: declaration.value(), advertised: advertised.value(), api: api.value(), bindings: bindings.value(), conditionalFailure: conditionalFailure.value() }) };
  });

  const operatorInputSchema = recordSchema<OperatorInput>("OperatorInput", "OperatorInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const operator = read("operator", () => operatorSchema, value => value.operator);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const permissionScope = read("permissionScope", () => nullableSchema(nodeRefSchema), value => value.permissionScope);
    return { fields: [context, operator, operands, permissionScope], value: () => ({ context: context.value(), operator: operator.value(), operands: operands.value(), permissionScope: permissionScope.value() }) };
  });

  const literalFitInputSchema = recordSchema<LiteralFitInput>("LiteralFitInput", "LiteralFitInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const literal = read("literal", () => literalValueSchema, value => value.literal);
    const destination = read("destination", () => typeEvidenceSchema, value => value.destination);
    return { fields: [context, literal, destination], value: () => ({ context: context.value(), literal: literal.value(), destination: destination.value() }) };
  });

  const protocolInputSchema: RecordSchema<ProtocolInput> = unionSchema<ProtocolInput>("ProtocolInput",
    () => [iterateInputSchema, awaitInputSchema, yieldInputSchema, delegateInputSchema, disposeInputSchema, spreadInputSchema, passingInputSchema, pointerInputSchema], value => {
    switch (value.kind) {
      case "iterate": return iterateInputSchema.stage(value);
      case "await": return awaitInputSchema.stage(value);
      case "yield": return yieldInputSchema.stage(value);
      case "delegate": return delegateInputSchema.stage(value);
      case "dispose": return disposeInputSchema.stage(value);
      case "spread": return spreadInputSchema.stage(value);
      case "argument-passing": return passingInputSchema.stage(value);
      case "pointer": return pointerInputSchema.stage(value);
    }
  });

  const iterateInputSchema = recordSchema<IterateInputRecord>("IterateInput", "iterate", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "iterate", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const awaitInputSchema = recordSchema<AwaitInputRecord>("AwaitInput", "await", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "await", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const yieldInputSchema = recordSchema<YieldInputRecord>("YieldInput", "yield", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "yield", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const delegateInputSchema = recordSchema<DelegateInputRecord>("DelegateInput", "delegate", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "delegate", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const disposeInputSchema = recordSchema<DisposeInputRecord>("DisposeInput", "dispose", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "dispose", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const spreadInputSchema = recordSchema<SpreadInputRecord>("SpreadInput", "spread", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "spread", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const passingInputSchema = recordSchema<PassingInputRecord>("PassingInput", "argument-passing", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "argument-passing", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const pointerInputSchema = recordSchema<PointerInputRecord>("PointerInput", "pointer", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(typeEvidenceSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const completion = read("completion", () => nullableSchema(typeEvidenceSchema), value => value.completion);
    const yielded = read("yielded", () => nullableSchema(typeEvidenceSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(typeEvidenceSchema), value => value.sent);
    const thrown = read("thrown", () => typeEvidenceSchema, value => value.thrown);
    return { fields: [context, asynchronous, subject, operands, completion, yielded, sent, thrown], value: () => ({ kind: "pointer", context: context.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const refinementInputSchema = recordSchema<RefinementInput>("RefinementInput", "RefinementInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const source = read("source", () => typeEvidenceSchema, value => value.source);
    const checked = read("checked", () => typeEvidenceSchema, value => value.checked);
    return { fields: [context, source, checked], value: () => ({ context: context.value(), source: source.value(), checked: checked.value() }) };
  });

  const libraryInputSchema = recordSchema<LibraryInput>("LibraryInput", "LibraryInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const receiver = read("receiver", () => nullableSchema(typeEvidenceSchema), value => value.receiver);
    const argumentsField = read("arguments", () => arraySchema(typeEvidenceSchema), value => value.arguments);
    const result = read("result", () => typeEvidenceSchema, value => value.result);
    return { fields: [context, declaration, receiver, argumentsField, result], value: () => ({ context: context.value(), declaration: declaration.value(), receiver: receiver.value(), arguments: argumentsField.value(), result: result.value() }) };
  });

  const coreInputSchema = recordSchema<CoreInput>("CoreInput", "CoreInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const captured = read("captured", () => hirCoreCaptureSchema, value => value.captured);
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const operands = read("operands", () => arraySchema(typeEvidenceSchema), value => value.operands);
    const result = read("result", () => typeEvidenceSchema, value => value.result);
    const permissionScope = read("permissionScope", () => nullableSchema(nodeRefSchema), value => value.permissionScope);
    return { fields: [context, captured, declaration, operands, result, permissionScope], value: () => ({ context: context.value(), captured: captured.value(), declaration: declaration.value(), operands: operands.value(), result: result.value(), permissionScope: permissionScope.value() }) };
  });
  const closureCaptureEvidenceSchema = recordSchema<ClosureCaptureEvidence>("ClosureCaptureEvidence", "ClosureCaptureEvidence", read => {
    const local = read("local", () => localRefSchema, value => value.local);
    const value = read("value", () => typeEvidenceSchema, record => record.value);
    const reassignable = read("reassignable", () => booleanSchema, record => record.reassignable);
    return { fields: [local, value, reassignable], value: () => ({ local: local.value(), value: value.value(), reassignable: reassignable.value() }) };
  });
  const closureInputSchema = recordSchema<ClosureInput>("ClosureInput", "ClosureInput", read => {
    const context = read("context", () => ruleContextSchema, value => value.context);
    const callable = read("callable", () => typeEvidenceSchema, value => value.callable);
    const captures = read("captures", () => arraySchema(closureCaptureEvidenceSchema), value => value.captures);
    return { fields: [context, callable, captures], value: () => ({ context: context.value(), callable: callable.value(), captures: captures.value() }) };
  });
  return { closureCaptureEvidenceSchema, closureInputSchema, ruleContextSchema, embedInputSchema, domainFitInputSchema, memoryEquivalentInputSchema, memberInputSchema, indexInputSchema, literalConstructionInputSchema, literalConstructionPartSchema, constructionElementSchema, constructionPropertySchema, constructionSpreadSchema, candidateInputSchema, callInputSchema, constructInputSchema, getterInputSchema, setterInputSchema, candidateArgumentSchema, candidateValueSchema, candidateSpreadSchema, candidateEndpointSchema, operatorInputSchema, literalFitInputSchema, protocolInputSchema, iterateInputSchema, awaitInputSchema, yieldInputSchema, delegateInputSchema, disposeInputSchema, spreadInputSchema, passingInputSchema, pointerInputSchema, refinementInputSchema, libraryInputSchema, coreInputSchema };
}
