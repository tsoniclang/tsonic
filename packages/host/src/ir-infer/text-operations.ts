import type { ApplicationDecision, CaptureRow, ClosureDecision, ConstructionPartDecision, DeferredDecision, EmbeddingDecision, OperationDecision, OperationExecution, OperationIdentity, ProtocolStepDecision, ProtocolStepOperation, RuleOutcome } from "./contract.js";
import type { ConstraintsSchemas } from "./text-constraints.js";
import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { DecisionValuesSchemas } from "./text-decision-values.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import type { InvocationsSchemas } from "./text-invocations.js";
import type { DefId, TyId } from "../ids/contract.js";
import type { BindingVector } from "../ir-types/contract.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface NativeOperatorRecord {
  readonly kind: "native-operator";
  readonly operator: "+" | "-" | "!" | "~" | "typeof" | "void" | "delete" | "*" | "/" | "%" | "**" | "&" | "|" | "^" | "<<" | ">>" | ">>>" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "===" | "!==" | "in" | "instanceof";
  readonly carrier: "bool" | "char" | "int8" | "uint8" | "int16" | "uint16" | "int32" | "uint32" | "int64" | "uint64" | "int128" | "uint128" | "native-int" | "native-uint" | "float16" | "float32" | "float64" | "decimal";
}

export interface BigintOperatorRecord {
  readonly kind: "bigint-operator";
  readonly operator: "+" | "-" | "!" | "~" | "typeof" | "void" | "delete" | "*" | "/" | "%" | "**" | "&" | "|" | "^" | "<<" | ">>" | ">>>" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "===" | "!==" | "in" | "instanceof";
}

export interface StringOperatorRecord {
  readonly kind: "string-operator";
  readonly operator: "+" | "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=";
}

export interface BooleanOperatorRecord {
  readonly kind: "boolean-operator";
  readonly operator: "!" | "&&" | "||" | "==" | "!=" | "===" | "!==";
}

export interface AbsenceTestRecord {
  readonly kind: "absence-test";
  readonly negated: boolean;
}

export interface ObjectConstructionRecord {
  readonly kind: "object-construction" | "array-construction";
  readonly parts: readonly (ConstructionPartDecision)[];
}

export interface ArrayConstructionRecord {
  readonly kind: "object-construction" | "array-construction";
  readonly parts: readonly (ConstructionPartDecision)[];
}

export interface ProtocolOperationRecord {
  readonly kind: "protocol";
  readonly protocol: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly asynchronous: boolean;
  readonly steps: readonly (ProtocolStepDecision)[];
  readonly value: TyId;
  readonly completion: TyId;
  readonly yielded: TyId | null;
  readonly sent: TyId | null;
  readonly thrown: TyId;
}

export interface ConversionOperationRecord {
  readonly kind: "conversion";
  readonly from: TyId;
  readonly to: TyId;
  readonly embedding: EmbeddingDecision;
}

export interface LibraryOperationRecord {
  readonly kind: "library" | "core";
  readonly declaration: DefId;
  readonly bindings: BindingVector;
}

export interface CoreOperationRecord {
  readonly kind: "library" | "core";
  readonly declaration: DefId;
  readonly bindings: BindingVector;
}

export interface PointerAddressRecord {
  readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" | "type-query" | "discard";

}

export interface PointerReadRecord {
  readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" | "type-query" | "discard";

}

export interface PointerWriteRecord {
  readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" | "type-query" | "discard";

}

export interface PointerOffsetRecord {
  readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" | "type-query" | "discard";

}

export interface TypeQueryRecord {
  readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" | "type-query" | "discard";

}

export interface DiscardRecord {
  readonly kind: "pointer-address" | "pointer-read" | "pointer-write" | "pointer-offset" | "type-query" | "discard";

}

export interface ProtocolCallRecord {
  readonly kind: "call";
  readonly application: ApplicationDecision;
}

export interface ProtocolCoreRecord {
  readonly kind: "core";
  readonly declaration: DefId;
  readonly bindings: BindingVector;
}

export interface ProtocolCompletionRecord {
  readonly kind: "completion";

}

export interface DecidedOperationRecord {
  readonly kind: "decided";
  readonly decision: OperationDecision;
}

export interface DeferredOperationRecord {
  readonly kind: "deferred";
  readonly deferred: DeferredDecision;
}

export interface PureExecutionRecord {
  readonly kind: "pure";

}

export interface InvocationExecutionRecord {
  readonly kind: "invocation";
  readonly writesStorage: boolean;
  readonly failure: "none" | "unwind" | "abort";
}

export interface OperationsSchemas {
  readonly closureDecisionSchema: RecordSchema<ClosureDecision>;
  readonly captureRowSchema: RecordSchema<CaptureRow>;
  readonly operationExecutionSchema: RecordSchema<OperationExecution>;
  readonly pureExecutionSchema: RecordSchema<PureExecutionRecord>;
  readonly invocationExecutionSchema: RecordSchema<InvocationExecutionRecord>;
  readonly constructionPartDecisionSchema: RecordSchema<ConstructionPartDecision>;
  readonly operationDecisionSchema: RecordSchema<OperationDecision>;
  readonly operationIdentitySchema: RecordSchema<OperationIdentity>;
  readonly nativeOperatorSchema: RecordSchema<NativeOperatorRecord>;
  readonly bigintOperatorSchema: RecordSchema<BigintOperatorRecord>;
  readonly stringOperatorSchema: RecordSchema<StringOperatorRecord>;
  readonly stringOperatorTokenSchema: Schema<"!=" | "!==" | "+" | "<" | "<=" | "==" | "===" | ">" | ">=">;
  readonly booleanOperatorSchema: RecordSchema<BooleanOperatorRecord>;
  readonly booleanOperatorTokenSchema: Schema<"!" | "!=" | "!==" | "&&" | "==" | "===" | "||">;
  readonly absenceTestSchema: RecordSchema<AbsenceTestRecord>;
  readonly objectConstructionSchema: RecordSchema<ObjectConstructionRecord>;
  readonly arrayConstructionSchema: RecordSchema<ArrayConstructionRecord>;
  readonly protocolOperationSchema: RecordSchema<ProtocolOperationRecord>;
  readonly conversionOperationSchema: RecordSchema<ConversionOperationRecord>;
  readonly libraryOperationSchema: RecordSchema<LibraryOperationRecord>;
  readonly coreOperationSchema: RecordSchema<CoreOperationRecord>;
  readonly pointerAddressSchema: RecordSchema<PointerAddressRecord>;
  readonly pointerReadSchema: RecordSchema<PointerReadRecord>;
  readonly pointerWriteSchema: RecordSchema<PointerWriteRecord>;
  readonly pointerOffsetSchema: RecordSchema<PointerOffsetRecord>;
  readonly typeQuerySchema: RecordSchema<TypeQueryRecord>;
  readonly discardSchema: RecordSchema<DiscardRecord>;
  readonly protocolStepDecisionSchema: RecordSchema<ProtocolStepDecision>;
  readonly protocolStepRoleSchema: Schema<"acquire" | "await" | "completion" | "dispose" | "done" | "fail" | "finish" | "next" | "value">;
  readonly protocolStepOperationSchema: RecordSchema<ProtocolStepOperation>;
  readonly protocolCallSchema: RecordSchema<ProtocolCallRecord>;
  readonly protocolCoreSchema: RecordSchema<ProtocolCoreRecord>;
  readonly protocolCompletionSchema: RecordSchema<ProtocolCompletionRecord>;
  readonly operationOutcomeSchema: RecordSchema<RuleOutcome<OperationDecision>>;
  readonly decidedOperationSchema: RecordSchema<DecidedOperationRecord>;
  readonly deferredOperationSchema: RecordSchema<DeferredOperationRecord>;
  readonly nativePrimitiveSchema: Schema<"bool" | "char" | "decimal" | "float16" | "float32" | "float64" | "int128" | "int16" | "int32" | "int64" | "int8" | "native-int" | "native-uint" | "uint128" | "uint16" | "uint32" | "uint64" | "uint8">;
}

export function createOperationsSchemas(constraints: ConstraintsSchemas, data: DataSchemas, decisionValues: DecisionValuesSchemas, evidence: EvidenceSchemas, invocations: InvocationsSchemas): OperationsSchemas {
  const { logicalCaptureSchema, operatorSchema, protocolKindSchema } = constraints;
  const { bindingVectorSchema, booleanSchema, defSchema, localRefSchema, nodeRefSchema, numberSchema, tSchema } = data;
  const { applicationDecisionSchema, embeddingDecisionSchema, failureKindSchema, memberDecisionSchema } = decisionValues;
  const { typeComponentSchema } = evidence;
  const { deferredDecisionSchema } = invocations;
  const constructionPartDecisionSchema = recordSchema<ConstructionPartDecision>("ConstructionPartDecision", "ConstructionPartDecision", read => {
    const part = read("part", () => numberSchema, value => value.part);
    const source = read("source", () => nodeRefSchema, value => value.source);
    const destination = read("destination", () => typeComponentSchema, value => value.destination);
    const member = read("member", () => nullableSchema(memberDecisionSchema), value => value.member);
    const embedding = read("embedding", () => embeddingDecisionSchema, value => value.embedding);
    return { fields: [part, source, destination, member, embedding], value: () => ({ part: part.value(), source: source.value(), destination: destination.value(), member: member.value(), embedding: embedding.value() }) };
  });

  const operationDecisionSchema = recordSchema<OperationDecision>("OperationDecision", "selected", read => {
    const operation = read("operation", () => operationIdentitySchema, value => value.operation);
    const operands = read("operands", () => arraySchema(tSchema), value => value.operands);
    const result = read("result", () => tSchema, value => value.result);
    const execution = read("execution", () => operationExecutionSchema, value => value.execution);
    return { fields: [operation, operands, result, execution], value: () => ({ kind: "selected", operation: operation.value(), operands: operands.value(), result: result.value(), execution: execution.value() }) };
  });

  const captureRowSchema = recordSchema<CaptureRow>("CaptureRow", "CaptureRow", read => {
    const local = read("local", () => localRefSchema, value => value.local);
    const capture = read("capture", () => logicalCaptureSchema, value => value.capture);
    return { fields: [local, capture], value: () => ({ local: local.value(), capture: capture.value() }) };
  });

  const closureDecisionSchema = recordSchema<ClosureDecision>("ClosureDecision", "ClosureDecision", read => {
    const carrier = read("carrier", () => tSchema, value => value.carrier);
    const captures = read("captures", () => arraySchema(captureRowSchema), value => value.captures);
    const execution = read("execution", () => operationExecutionSchema, value => value.execution);
    return { fields: [carrier, captures, execution], value: () => ({ carrier: carrier.value(), captures: captures.value(), execution: execution.value() }) };
  });

  const operationExecutionSchema: RecordSchema<OperationExecution> = unionSchema<OperationExecution>("OperationExecution",
    () => [pureExecutionSchema, invocationExecutionSchema], value => {
    switch (value.kind) {
      case "pure": return pureExecutionSchema.stage(value);
      case "invocation": return invocationExecutionSchema.stage(value);
    }
  });

  const pureExecutionSchema = recordSchema<PureExecutionRecord>("PureExecution", "pure", () => {
    return { fields: [], value: () => ({ kind: "pure" }) };
  });

  const invocationExecutionSchema = recordSchema<InvocationExecutionRecord>("InvocationExecution", "invocation", read => {
    const writesStorage = read("writesStorage", () => booleanSchema, value => value.writesStorage);
    const failure = read("failure", () => failureKindSchema, value => value.failure);
    return { fields: [writesStorage, failure], value: () => ({ kind: "invocation", writesStorage: writesStorage.value(), failure: failure.value() }) };
  });

  const operationIdentitySchema: RecordSchema<OperationIdentity> = unionSchema<OperationIdentity>("OperationIdentity",
    () => [nativeOperatorSchema, bigintOperatorSchema, stringOperatorSchema, booleanOperatorSchema, absenceTestSchema, objectConstructionSchema, arrayConstructionSchema, protocolOperationSchema, conversionOperationSchema, libraryOperationSchema, coreOperationSchema, pointerAddressSchema, pointerReadSchema, pointerWriteSchema, pointerOffsetSchema, typeQuerySchema, discardSchema], value => {
    switch (value.kind) {
      case "native-operator": return nativeOperatorSchema.stage(value);
      case "bigint-operator": return bigintOperatorSchema.stage(value);
      case "string-operator": return stringOperatorSchema.stage(value);
      case "boolean-operator": return booleanOperatorSchema.stage(value);
      case "absence-test": return absenceTestSchema.stage(value);
      case "object-construction": return objectConstructionSchema.stage(value);
      case "array-construction": return arrayConstructionSchema.stage(value);
      case "protocol": return protocolOperationSchema.stage(value);
      case "conversion": return conversionOperationSchema.stage(value);
      case "library": return libraryOperationSchema.stage(value);
      case "core": return coreOperationSchema.stage(value);
      case "pointer-address": return pointerAddressSchema.stage(value);
      case "pointer-read": return pointerReadSchema.stage(value);
      case "pointer-write": return pointerWriteSchema.stage(value);
      case "pointer-offset": return pointerOffsetSchema.stage(value);
      case "type-query": return typeQuerySchema.stage(value);
      case "discard": return discardSchema.stage(value);
    }
  });

  const nativeOperatorSchema = recordSchema<NativeOperatorRecord>("NativeOperator", "native-operator", read => {
    const operator = read("operator", () => operatorSchema, value => value.operator);
    const carrier = read("carrier", () => nativePrimitiveSchema, value => value.carrier);
    return { fields: [operator, carrier], value: () => ({ kind: "native-operator", operator: operator.value(), carrier: carrier.value() }) };
  });

  const bigintOperatorSchema = recordSchema<BigintOperatorRecord>("BigintOperator", "bigint-operator", read => {
    const operator = read("operator", () => operatorSchema, value => value.operator);
    return { fields: [operator], value: () => ({ kind: "bigint-operator", operator: operator.value() }) };
  });

  const stringOperatorSchema = recordSchema<StringOperatorRecord>("StringOperator", "string-operator", read => {
    const operator = read("operator", () => stringOperatorTokenSchema, value => value.operator);
    return { fields: [operator], value: () => ({ kind: "string-operator", operator: operator.value() }) };
  });

  const stringOperatorTokenSchema = enumSchema("StringOperatorToken", ["+","==","!=","===","!==","<","<=",">",">="]);

  const booleanOperatorSchema = recordSchema<BooleanOperatorRecord>("BooleanOperator", "boolean-operator", read => {
    const operator = read("operator", () => booleanOperatorTokenSchema, value => value.operator);
    return { fields: [operator], value: () => ({ kind: "boolean-operator", operator: operator.value() }) };
  });

  const booleanOperatorTokenSchema = enumSchema("BooleanOperatorToken", ["!","&&","||","==","!=","===","!=="]);

  const absenceTestSchema = recordSchema<AbsenceTestRecord>("AbsenceTest", "absence-test", read => {
    const negated = read("negated", () => booleanSchema, value => value.negated);
    return { fields: [negated], value: () => ({ kind: "absence-test", negated: negated.value() }) };
  });

  const objectConstructionSchema = recordSchema<ObjectConstructionRecord>("ObjectConstruction", "object-construction", read => {
    const parts = read("parts", () => arraySchema(constructionPartDecisionSchema), value => value.parts);
    return { fields: [parts], value: () => ({ kind: "object-construction", parts: parts.value() }) };
  });

  const arrayConstructionSchema = recordSchema<ArrayConstructionRecord>("ArrayConstruction", "array-construction", read => {
    const parts = read("parts", () => arraySchema(constructionPartDecisionSchema), value => value.parts);
    return { fields: [parts], value: () => ({ kind: "array-construction", parts: parts.value() }) };
  });

  const protocolOperationSchema = recordSchema<ProtocolOperationRecord>("ProtocolOperation", "protocol", read => {
    const protocol = read("protocol", () => protocolKindSchema, value => value.protocol);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const steps = read("steps", () => arraySchema(protocolStepDecisionSchema), value => value.steps);
    const value = read("value", () => tSchema, value => value.value);
    const completion = read("completion", () => tSchema, value => value.completion);
    const yielded = read("yielded", () => nullableSchema(tSchema), value => value.yielded);
    const sent = read("sent", () => nullableSchema(tSchema), value => value.sent);
    const thrown = read("thrown", () => tSchema, value => value.thrown);
    return { fields: [protocol, asynchronous, steps, value, completion, yielded, sent, thrown], value: () => ({ kind: "protocol", protocol: protocol.value(), asynchronous: asynchronous.value(), steps: steps.value(), value: value.value(), completion: completion.value(), yielded: yielded.value(), sent: sent.value(), thrown: thrown.value() }) };
  });

  const conversionOperationSchema = recordSchema<ConversionOperationRecord>("ConversionOperation", "conversion", read => {
    const from = read("from", () => tSchema, value => value.from);
    const to = read("to", () => tSchema, value => value.to);
    const embedding = read("embedding", () => embeddingDecisionSchema, value => value.embedding);
    return { fields: [from, to, embedding], value: () => ({ kind: "conversion", from: from.value(), to: to.value(), embedding: embedding.value() }) };
  });

  const libraryOperationSchema = recordSchema<LibraryOperationRecord>("LibraryOperation", "library", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [declaration, bindings], value: () => ({ kind: "library", declaration: declaration.value(), bindings: bindings.value() }) };
  });

  const coreOperationSchema = recordSchema<CoreOperationRecord>("CoreOperation", "core", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [declaration, bindings], value: () => ({ kind: "core", declaration: declaration.value(), bindings: bindings.value() }) };
  });

  const pointerAddressSchema = recordSchema<PointerAddressRecord>("PointerAddress", "pointer-address", () => {
    return { fields: [], value: () => ({ kind: "pointer-address" }) };
  });

  const pointerReadSchema = recordSchema<PointerReadRecord>("PointerRead", "pointer-read", () => {
    return { fields: [], value: () => ({ kind: "pointer-read" }) };
  });

  const pointerWriteSchema = recordSchema<PointerWriteRecord>("PointerWrite", "pointer-write", () => {
    return { fields: [], value: () => ({ kind: "pointer-write" }) };
  });

  const pointerOffsetSchema = recordSchema<PointerOffsetRecord>("PointerOffset", "pointer-offset", () => {
    return { fields: [], value: () => ({ kind: "pointer-offset" }) };
  });

  const typeQuerySchema = recordSchema<TypeQueryRecord>("TypeQuery", "type-query", () => {
    return { fields: [], value: () => ({ kind: "type-query" }) };
  });

  const discardSchema = recordSchema<DiscardRecord>("Discard", "discard", () => {
    return { fields: [], value: () => ({ kind: "discard" }) };
  });

  const protocolStepDecisionSchema = recordSchema<ProtocolStepDecision>("ProtocolStepDecision", "ProtocolStepDecision", read => {
    const role = read("role", () => protocolStepRoleSchema, value => value.role);
    const operation = read("operation", () => protocolStepOperationSchema, value => value.operation);
    const operands = read("operands", () => arraySchema(tSchema), value => value.operands);
    const result = read("result", () => tSchema, value => value.result);
    return { fields: [role, operation, operands, result], value: () => ({ role: role.value(), operation: operation.value(), operands: operands.value(), result: result.value() }) };
  });

  const protocolStepRoleSchema = enumSchema("ProtocolStepRole", ["acquire","next","done","value","finish","fail","await","dispose","completion"]);

  const protocolStepOperationSchema: RecordSchema<ProtocolStepOperation> = unionSchema<ProtocolStepOperation>("ProtocolStepOperation",
    () => [protocolCallSchema, protocolCoreSchema, protocolCompletionSchema], value => {
    switch (value.kind) {
      case "call": return protocolCallSchema.stage(value);
      case "core": return protocolCoreSchema.stage(value);
      case "completion": return protocolCompletionSchema.stage(value);
    }
  });

  const protocolCallSchema = recordSchema<ProtocolCallRecord>("ProtocolCall", "call", read => {
    const application = read("application", () => applicationDecisionSchema, value => value.application);
    return { fields: [application], value: () => ({ kind: "call", application: application.value() }) };
  });

  const protocolCoreSchema = recordSchema<ProtocolCoreRecord>("ProtocolCore", "core", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [declaration, bindings], value: () => ({ kind: "core", declaration: declaration.value(), bindings: bindings.value() }) };
  });

  const protocolCompletionSchema = recordSchema<ProtocolCompletionRecord>("ProtocolCompletion", "completion", () => {
    return { fields: [], value: () => ({ kind: "completion" }) };
  });

  const operationOutcomeSchema: RecordSchema<RuleOutcome<OperationDecision>> = unionSchema<RuleOutcome<OperationDecision>>("OperationOutcome",
    () => [decidedOperationSchema, deferredOperationSchema], value => {
    switch (value.kind) {
      case "decided": return decidedOperationSchema.stage(value);
      case "deferred": return deferredOperationSchema.stage(value);
    }
  });

  const decidedOperationSchema = recordSchema<DecidedOperationRecord>("DecidedOperation", "decided", read => {
    const decision = read("decision", () => operationDecisionSchema, value => value.decision);
    return { fields: [decision], value: () => ({ kind: "decided", decision: decision.value() }) };
  });

  const deferredOperationSchema = recordSchema<DeferredOperationRecord>("DeferredOperation", "deferred", read => {
    const deferred = read("deferred", () => deferredDecisionSchema, value => value.deferred);
    return { fields: [deferred], value: () => ({ kind: "deferred", deferred: deferred.value() }) };
  });

  const nativePrimitiveSchema = enumSchema("NativePrimitive", ["bool","char","int8","uint8","int16","uint16","int32","uint32","int64","uint64","int128","uint128","native-int","native-uint","float16","float32","float64","decimal"]);
  return { closureDecisionSchema, captureRowSchema, operationExecutionSchema, pureExecutionSchema, invocationExecutionSchema, constructionPartDecisionSchema, operationDecisionSchema, operationIdentitySchema, nativeOperatorSchema, bigintOperatorSchema, stringOperatorSchema, stringOperatorTokenSchema, booleanOperatorSchema, booleanOperatorTokenSchema, absenceTestSchema, objectConstructionSchema, arrayConstructionSchema, protocolOperationSchema, conversionOperationSchema, libraryOperationSchema, coreOperationSchema, pointerAddressSchema, pointerReadSchema, pointerWriteSchema, pointerOffsetSchema, typeQuerySchema, discardSchema, protocolStepDecisionSchema, protocolStepRoleSchema, protocolStepOperationSchema, protocolCallSchema, protocolCoreSchema, protocolCompletionSchema, operationOutcomeSchema, decidedOperationSchema, deferredOperationSchema, nativePrimitiveSchema };
}
