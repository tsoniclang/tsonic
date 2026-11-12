import type { ApplicationArgument, ApplicationConstraintData, Constraint, ConstraintRef, ConstraintSet, InferenceGroup, InferenceVariable, InferredPart, InferredSignaturePart, LiteralPart } from "./contract.js";
import type { CaptureValuesSchemas } from "./text-capture-values.js";
import type { CapturesSchemas } from "./text-captures.js";
import type { ContributionsSchemas } from "./text-contributions.js";
import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import type { BodyId, LocalRef, NodeRef, TyId } from "../ids/contract.js";
import type { BindingVector, LiteralValue, MemberKey, MemberOrigin, TypeParameterIdentity } from "../ir-types/contract.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface ReturnPartRecord {
  readonly kind: "return" | "yield" | "variable" | "field";

}

export interface YieldPartRecord {
  readonly kind: "return" | "yield" | "variable" | "field";

}

export interface VariablePartRecord {
  readonly kind: "return" | "yield" | "variable" | "field";

}

export interface FieldPartRecord {
  readonly kind: "return" | "yield" | "variable" | "field";

}

export interface ParameterInitializerPartRecord {
  readonly kind: "parameter-initializer";
  readonly index: number;
}

export interface SignatureVariableRecord {
  readonly kind: "signature";
  readonly id: number;
  readonly occurrence: NodeRef;
  readonly signature: InferredSignaturePart;
}

export interface LocalVariableRecord {
  readonly kind: "local";
  readonly id: number;
  readonly occurrence: NodeRef;
  readonly local: LocalRef | null;
}

export interface BinderVariableRecord {
  readonly kind: "binder";
  readonly id: number;
  readonly occurrence: NodeRef;
  readonly application: NodeRef;
  readonly candidate: number;
  readonly family: "class" | "method" | "captured";
  readonly parameter: TypeParameterIdentity;
}

export interface LiteralVariableRecord {
  readonly kind: "literal";
  readonly id: number;
  readonly occurrence: NodeRef;
  readonly value: LiteralValue;
}

export interface EqualityConstraintRecord {
  readonly kind: "eq";
  readonly occurrence: NodeRef;
  readonly left: TyId;
  readonly right: TyId;
}

export interface FlowConstraintRecord {
  readonly kind: "flow";
  readonly occurrence: NodeRef;
  readonly from: TyId;
  readonly to: TyId;
  readonly role: "initialization" | "assignment" | "argument" | "return" | "receiver" | "yield" | "member-write";
  readonly bindings: BindingVector;
}

export interface LiteralConstraintRecord {
  readonly kind: "literal";
  readonly occurrence: NodeRef;
  readonly value: LiteralValue;
  readonly destination: TyId;
}

export interface OperatorConstraintRecord {
  readonly kind: "op";
  readonly occurrence: NodeRef;
  readonly operator: "+" | "-" | "!" | "~" | "typeof" | "void" | "delete" | "*" | "/" | "%" | "**" | "&" | "|" | "^" | "<<" | ">>" | ">>>" | "<" | "<=" | ">" | ">=" | "==" | "!=" | "===" | "!==" | "in" | "instanceof";
  readonly operands: readonly (TyId)[];
  readonly result: TyId;
  readonly permissionScope: NodeRef | null;
}

export interface MemberConstraintRecord {
  readonly kind: "member";
  readonly occurrence: NodeRef;
  readonly receiver: TyId;
  readonly key: MemberKey;
  readonly access: "read" | "write" | "call";
  readonly result: TyId;
  readonly origins: readonly (MemberOrigin)[];
  readonly bindings: BindingVector;
}

export interface IndexConstraintRecord {
  readonly kind: "index";
  readonly occurrence: NodeRef;
  readonly receiver: TyId;
  readonly key: TyId;
  readonly access: "read" | "write" | "call";
  readonly result: TyId;
  readonly bindings: BindingVector;
}

export interface CallConstraintRecord {
  readonly kind: "call" | "construct";
  readonly occurrence: NodeRef;
  readonly application: ApplicationConstraintData;
}

export interface ConstructConstraintRecord {
  readonly kind: "call" | "construct";
  readonly occurrence: NodeRef;
  readonly application: ApplicationConstraintData;
}

export interface ValueArgumentRecord {
  readonly kind: "value" | "spread";
  readonly occurrence: NodeRef;
  readonly type: TyId;
  readonly tuple: readonly (TyId)[] | null;
  readonly closure: BodyId | null;
}

export interface SpreadArgumentRecord {
  readonly kind: "value" | "spread";
  readonly occurrence: NodeRef;
  readonly type: TyId;
  readonly tuple: readonly (TyId)[] | null;
  readonly closure: BodyId | null;
}

export interface LiteralConstructionConstraintRecord {
  readonly kind: "construct-literal";
  readonly occurrence: NodeRef;
  readonly construction: "object" | "array";
  readonly parts: readonly (LiteralPart)[];
  readonly destination: TyId | null;
  readonly result: TyId;
}

export interface ElementPartRecord {
  readonly kind: "element" | "spread";
  readonly occurrence: NodeRef;
  readonly type: TyId;
}

export interface PropertyPartRecord {
  readonly kind: "property";
  readonly occurrence: NodeRef;
  readonly key: MemberKey;
  readonly type: TyId;
}

export interface SpreadPartRecord {
  readonly kind: "element" | "spread";
  readonly occurrence: NodeRef;
  readonly type: TyId;
}

export interface ProtocolConstraintRecord {
  readonly kind: "protocol";
  readonly occurrence: NodeRef;
  readonly protocol: "iterate" | "await" | "yield" | "delegate" | "dispose" | "spread" | "argument-passing" | "pointer";
  readonly asynchronous: boolean;
  readonly subject: TyId | null;
  readonly operands: readonly (TyId)[];
  readonly result: TyId;
  readonly bindings: BindingVector;
}

export interface RefinementConstraintRecord {
  readonly kind: "refine";
  readonly occurrence: NodeRef;
  readonly source: TyId;
  readonly checked: TyId;
  readonly result: TyId;
}

export interface DischargeConstraintRecord {
  readonly kind: "discharge";
  readonly occurrence: NodeRef;
  readonly checkerDiagnostic: number;
  readonly obligations: readonly (ConstraintRef)[];
}

export interface DefaultConstraintRecord {
  readonly kind: "default";
  readonly occurrence: NodeRef;
  readonly variable: number;
  readonly rule: "signature-producers" | "local-producers" | "binder-declared-default" | "literal-native-default" | "refuse-unseeded";
  readonly type: TyId | null;
}

export interface ConstraintsSchemas {
  readonly constraintSetSchema: RecordSchema<ConstraintSet>;
  readonly inferenceGroupSchema: RecordSchema<InferenceGroup>;
  readonly inferredSignaturePartSchema: RecordSchema<InferredSignaturePart>;
  readonly inferredPartSchema: RecordSchema<InferredPart>;
  readonly returnPartSchema: RecordSchema<ReturnPartRecord>;
  readonly yieldPartSchema: RecordSchema<YieldPartRecord>;
  readonly variablePartSchema: RecordSchema<VariablePartRecord>;
  readonly fieldPartSchema: RecordSchema<FieldPartRecord>;
  readonly parameterInitializerPartSchema: RecordSchema<ParameterInitializerPartRecord>;
  readonly inferenceVariableSchema: RecordSchema<InferenceVariable>;
  readonly signatureVariableSchema: RecordSchema<SignatureVariableRecord>;
  readonly localVariableSchema: RecordSchema<LocalVariableRecord>;
  readonly binderVariableSchema: RecordSchema<BinderVariableRecord>;
  readonly literalVariableSchema: RecordSchema<LiteralVariableRecord>;
  readonly binderFamilySchema: Schema<"captured" | "class" | "method">;
  readonly flowRoleSchema: Schema<"argument" | "assignment" | "initialization" | "member-write" | "receiver" | "return" | "yield">;
  readonly accessRoleSchema: Schema<"call" | "read" | "write">;
  readonly protocolKindSchema: Schema<"argument-passing" | "await" | "delegate" | "dispose" | "iterate" | "pointer" | "spread" | "yield">;
  readonly ruleIdentitySchema: Schema<"candidate" | "construct-literal" | "core" | "domain-fit" | "embed" | "index" | "library" | "literal-fit" | "member" | "memory-equivalent" | "operator" | "protocol" | "refinement">;
  readonly constraintSchema: RecordSchema<Constraint>;
  readonly equalityConstraintSchema: RecordSchema<EqualityConstraintRecord>;
  readonly flowConstraintSchema: RecordSchema<FlowConstraintRecord>;
  readonly literalConstraintSchema: RecordSchema<LiteralConstraintRecord>;
  readonly operatorConstraintSchema: RecordSchema<OperatorConstraintRecord>;
  readonly memberConstraintSchema: RecordSchema<MemberConstraintRecord>;
  readonly indexConstraintSchema: RecordSchema<IndexConstraintRecord>;
  readonly callConstraintSchema: RecordSchema<CallConstraintRecord>;
  readonly constructConstraintSchema: RecordSchema<ConstructConstraintRecord>;
  readonly applicationConstraintDataSchema: RecordSchema<ApplicationConstraintData>;
  readonly applicationArgumentSchema: RecordSchema<ApplicationArgument>;
  readonly valueArgumentSchema: RecordSchema<ValueArgumentRecord>;
  readonly spreadArgumentSchema: RecordSchema<SpreadArgumentRecord>;
  readonly literalConstructionConstraintSchema: RecordSchema<LiteralConstructionConstraintRecord>;
  readonly constructionKindSchema: Schema<"array" | "object">;
  readonly literalPartSchema: RecordSchema<LiteralPart>;
  readonly elementPartSchema: RecordSchema<ElementPartRecord>;
  readonly propertyPartSchema: RecordSchema<PropertyPartRecord>;
  readonly spreadPartSchema: RecordSchema<SpreadPartRecord>;
  readonly protocolConstraintSchema: RecordSchema<ProtocolConstraintRecord>;
  readonly refinementConstraintSchema: RecordSchema<RefinementConstraintRecord>;
  readonly dischargeConstraintSchema: RecordSchema<DischargeConstraintRecord>;
  readonly defaultConstraintSchema: RecordSchema<DefaultConstraintRecord>;
  readonly defaultRuleSchema: Schema<"binder-declared-default" | "literal-native-default" | "local-producers" | "refuse-unseeded" | "signature-producers">;
  readonly operatorSchema: Schema<"!" | "!=" | "!==" | "%" | "&" | "*" | "**" | "+" | "-" | "/" | "<" | "<<" | "<=" | "==" | "===" | ">" | ">=" | ">>" | ">>>" | "^" | "delete" | "in" | "instanceof" | "typeof" | "void" | "|" | "~">;
}

export function createConstraintsSchemas(captureValues: CaptureValuesSchemas, captures: CapturesSchemas, contributions: ContributionsSchemas, data: DataSchemas, evidence: EvidenceSchemas): ConstraintsSchemas {
  const { hirCandidateListSchema } = captureValues;
  const { hirCoreCaptureSchema } = captures;
  const { constraintRefSchema } = contributions;
  const { bindingVectorSchema, bodySchema, booleanSchema, candSchema, defSchema, groupSchema, literalValueSchema, localRefSchema, memberKeySchema, memberOriginSchema, nodeRefSchema, numberSchema, tSchema, typeParameterIdentitySchema } = data;
  const { typeEvidenceSchema } = evidence;
  const constraintSetSchema = recordSchema<ConstraintSet>("ConstraintSet", "ConstraintSet", read => {
    const group = read("group", () => groupSchema, value => value.group);
    const body = read("body", () => bodySchema, value => value.body);
    const variables = read("variables", () => arraySchema(inferenceVariableSchema), value => value.variables);
    const candidates = read("candidates", () => arraySchema(hirCandidateListSchema), value => value.candidates);
    const evidence = read("evidence", () => arraySchema(typeEvidenceSchema), value => value.evidence);
    const constraints = read("constraints", () => arraySchema(constraintSchema), value => value.constraints);
    return { fields: [group, body, variables, candidates, evidence, constraints], value: () => ({ group: group.value(), body: body.value(), variables: variables.value(), candidates: candidates.value(), evidence: evidence.value(), constraints: constraints.value() }) };
  });

  const inferenceGroupSchema = recordSchema<InferenceGroup>("InferenceGroup", "InferenceGroup", read => {
    const id = read("id", () => groupSchema, value => value.id);
    const bodies = read("bodies", () => arraySchema(bodySchema), value => value.bodies);
    const signatures = read("signatures", () => arraySchema(inferredSignaturePartSchema), value => value.signatures);
    return { fields: [id, bodies, signatures], value: () => ({ id: id.value(), bodies: bodies.value(), signatures: signatures.value() }) };
  });

  const inferredSignaturePartSchema = recordSchema<InferredSignaturePart>("InferredSignaturePart", "InferredSignaturePart", read => {
    const definition = read("definition", () => defSchema, value => value.definition);
    const part = read("part", () => inferredPartSchema, value => value.part);
    return { fields: [definition, part], value: () => ({ definition: definition.value(), part: part.value() }) };
  });

  const inferredPartSchema: RecordSchema<InferredPart> = unionSchema<InferredPart>("InferredPart",
    () => [returnPartSchema, yieldPartSchema, variablePartSchema, fieldPartSchema, parameterInitializerPartSchema], value => {
    switch (value.kind) {
      case "return": return returnPartSchema.stage(value);
      case "yield": return yieldPartSchema.stage(value);
      case "variable": return variablePartSchema.stage(value);
      case "field": return fieldPartSchema.stage(value);
      case "parameter-initializer": return parameterInitializerPartSchema.stage(value);
    }
  });

  const returnPartSchema = recordSchema<ReturnPartRecord>("ReturnPart", "return", () => {
    return { fields: [], value: () => ({ kind: "return" }) };
  });

  const yieldPartSchema = recordSchema<YieldPartRecord>("YieldPart", "yield", () => {
    return { fields: [], value: () => ({ kind: "yield" }) };
  });

  const variablePartSchema = recordSchema<VariablePartRecord>("VariablePart", "variable", () => {
    return { fields: [], value: () => ({ kind: "variable" }) };
  });

  const fieldPartSchema = recordSchema<FieldPartRecord>("FieldPart", "field", () => {
    return { fields: [], value: () => ({ kind: "field" }) };
  });

  const parameterInitializerPartSchema = recordSchema<ParameterInitializerPartRecord>("ParameterInitializerPart", "parameter-initializer", read => {
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [index], value: () => ({ kind: "parameter-initializer", index: index.value() }) };
  });

  const inferenceVariableSchema: RecordSchema<InferenceVariable> = unionSchema<InferenceVariable>("InferenceVariable",
    () => [signatureVariableSchema, localVariableSchema, binderVariableSchema, literalVariableSchema], value => {
    switch (value.kind) {
      case "signature": return signatureVariableSchema.stage(value);
      case "local": return localVariableSchema.stage(value);
      case "binder": return binderVariableSchema.stage(value);
      case "literal": return literalVariableSchema.stage(value);
    }
  });

  const signatureVariableSchema = recordSchema<SignatureVariableRecord>("SignatureVariable", "signature", read => {
    const id = read("id", () => numberSchema, value => value.id);
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const signature = read("signature", () => inferredSignaturePartSchema, value => value.signature);
    return { fields: [id, occurrence, signature], value: () => ({ kind: "signature", id: id.value(), occurrence: occurrence.value(), signature: signature.value() }) };
  });

  const localVariableSchema = recordSchema<LocalVariableRecord>("LocalVariable", "local", read => {
    const id = read("id", () => numberSchema, value => value.id);
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const local = read("local", () => nullableSchema(localRefSchema), value => value.local);
    return { fields: [id, occurrence, local], value: () => ({ kind: "local", id: id.value(), occurrence: occurrence.value(), local: local.value() }) };
  });

  const binderVariableSchema = recordSchema<BinderVariableRecord>("BinderVariable", "binder", read => {
    const id = read("id", () => numberSchema, value => value.id);
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const application = read("application", () => nodeRefSchema, value => value.application);
    const candidate = read("candidate", () => numberSchema, value => value.candidate);
    const family = read("family", () => binderFamilySchema, value => value.family);
    const parameter = read("parameter", () => typeParameterIdentitySchema, value => value.parameter);
    return { fields: [id, occurrence, application, candidate, family, parameter], value: () => ({ kind: "binder", id: id.value(), occurrence: occurrence.value(), application: application.value(), candidate: candidate.value(), family: family.value(), parameter: parameter.value() }) };
  });

  const literalVariableSchema = recordSchema<LiteralVariableRecord>("LiteralVariable", "literal", read => {
    const id = read("id", () => numberSchema, value => value.id);
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const value = read("value", () => literalValueSchema, value => value.value);
    return { fields: [id, occurrence, value], value: () => ({ kind: "literal", id: id.value(), occurrence: occurrence.value(), value: value.value() }) };
  });

  const binderFamilySchema = enumSchema("BinderFamily", ["class","method","captured"]);

  const flowRoleSchema = enumSchema("FlowRole", ["initialization","assignment","argument","return","receiver","yield","member-write"]);

  const accessRoleSchema = enumSchema("AccessRole", ["read","write","call"]);

  const protocolKindSchema = enumSchema("ProtocolKind", ["iterate","await","yield","delegate","dispose","spread","argument-passing","pointer"]);

  const ruleIdentitySchema = enumSchema("RuleIdentity", ["embed","domain-fit","memory-equivalent","member","index","construct-literal","candidate","operator","literal-fit","protocol","refinement","library","core"]);

  const constraintSchema: RecordSchema<Constraint> = unionSchema<Constraint>("Constraint",
    () => [equalityConstraintSchema, flowConstraintSchema, literalConstraintSchema, operatorConstraintSchema, memberConstraintSchema, indexConstraintSchema, callConstraintSchema, constructConstraintSchema, literalConstructionConstraintSchema, protocolConstraintSchema, refinementConstraintSchema, dischargeConstraintSchema, defaultConstraintSchema], value => {
    switch (value.kind) {
      case "eq": return equalityConstraintSchema.stage(value);
      case "flow": return flowConstraintSchema.stage(value);
      case "literal": return literalConstraintSchema.stage(value);
      case "op": return operatorConstraintSchema.stage(value);
      case "member": return memberConstraintSchema.stage(value);
      case "index": return indexConstraintSchema.stage(value);
      case "call": return callConstraintSchema.stage(value);
      case "construct": return constructConstraintSchema.stage(value);
      case "construct-literal": return literalConstructionConstraintSchema.stage(value);
      case "protocol": return protocolConstraintSchema.stage(value);
      case "refine": return refinementConstraintSchema.stage(value);
      case "discharge": return dischargeConstraintSchema.stage(value);
      case "default": return defaultConstraintSchema.stage(value);
    }
  });

  const equalityConstraintSchema = recordSchema<EqualityConstraintRecord>("EqualityConstraint", "eq", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const left = read("left", () => tSchema, value => value.left);
    const right = read("right", () => tSchema, value => value.right);
    return { fields: [occurrence, left, right], value: () => ({ kind: "eq", occurrence: occurrence.value(), left: left.value(), right: right.value() }) };
  });

  const flowConstraintSchema = recordSchema<FlowConstraintRecord>("FlowConstraint", "flow", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const from = read("from", () => tSchema, value => value.from);
    const to = read("to", () => tSchema, value => value.to);
    const role = read("role", () => flowRoleSchema, value => value.role);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [occurrence, from, to, role, bindings], value: () => ({ kind: "flow", occurrence: occurrence.value(), from: from.value(), to: to.value(), role: role.value(), bindings: bindings.value() }) };
  });

  const literalConstraintSchema = recordSchema<LiteralConstraintRecord>("LiteralConstraint", "literal", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const value = read("value", () => literalValueSchema, value => value.value);
    const destination = read("destination", () => tSchema, value => value.destination);
    return { fields: [occurrence, value, destination], value: () => ({ kind: "literal", occurrence: occurrence.value(), value: value.value(), destination: destination.value() }) };
  });

  const operatorConstraintSchema = recordSchema<OperatorConstraintRecord>("OperatorConstraint", "op", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const operator = read("operator", () => operatorSchema, value => value.operator);
    const operands = read("operands", () => arraySchema(tSchema), value => value.operands);
    const result = read("result", () => tSchema, value => value.result);
    const permissionScope = read("permissionScope", () => nullableSchema(nodeRefSchema), value => value.permissionScope);
    return { fields: [occurrence, operator, operands, result, permissionScope], value: () => ({ kind: "op", occurrence: occurrence.value(), operator: operator.value(), operands: operands.value(), result: result.value(), permissionScope: permissionScope.value() }) };
  });

  const memberConstraintSchema = recordSchema<MemberConstraintRecord>("MemberConstraint", "member", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const receiver = read("receiver", () => tSchema, value => value.receiver);
    const key = read("key", () => memberKeySchema, value => value.key);
    const access = read("access", () => accessRoleSchema, value => value.access);
    const result = read("result", () => tSchema, value => value.result);
    const origins = read("origins", () => arraySchema(memberOriginSchema), value => value.origins);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [occurrence, receiver, key, access, result, origins, bindings], value: () => ({ kind: "member", occurrence: occurrence.value(), receiver: receiver.value(), key: key.value(), access: access.value(), result: result.value(), origins: origins.value(), bindings: bindings.value() }) };
  });

  const indexConstraintSchema = recordSchema<IndexConstraintRecord>("IndexConstraint", "index", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const receiver = read("receiver", () => tSchema, value => value.receiver);
    const key = read("key", () => tSchema, value => value.key);
    const access = read("access", () => accessRoleSchema, value => value.access);
    const result = read("result", () => tSchema, value => value.result);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [occurrence, receiver, key, access, result, bindings], value: () => ({ kind: "index", occurrence: occurrence.value(), receiver: receiver.value(), key: key.value(), access: access.value(), result: result.value(), bindings: bindings.value() }) };
  });

  const callConstraintSchema = recordSchema<CallConstraintRecord>("CallConstraint", "call", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const application = read("application", () => applicationConstraintDataSchema, value => value.application);
    return { fields: [occurrence, application], value: () => ({ kind: "call", occurrence: occurrence.value(), application: application.value() }) };
  });

  const constructConstraintSchema = recordSchema<ConstructConstraintRecord>("ConstructConstraint", "construct", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const application = read("application", () => applicationConstraintDataSchema, value => value.application);
    return { fields: [occurrence, application], value: () => ({ kind: "construct", occurrence: occurrence.value(), application: application.value() }) };
  });

  const applicationConstraintDataSchema = recordSchema<ApplicationConstraintData>("ApplicationConstraintData", "ApplicationConstraintData", read => {
    const captured = read("captured", () => hirCoreCaptureSchema, value => value.captured);
    const permissionScope = read("permissionScope", () => nullableSchema(nodeRefSchema), value => value.permissionScope);
    const callee = read("callee", () => tSchema, value => value.callee);
    const receiver = read("receiver", () => nullableSchema(tSchema), value => value.receiver);
    const typeArguments = read("typeArguments", () => arraySchema(tSchema), value => value.typeArguments);
    const argumentsField = read("arguments", () => arraySchema(applicationArgumentSchema), value => value.arguments);
    const candidates = read("candidates", () => candSchema, value => value.candidates);
    const result = read("result", () => tSchema, value => value.result);
    return { fields: [captured, permissionScope, callee, receiver, typeArguments, argumentsField, candidates, result], value: () => ({ captured: captured.value(), permissionScope: permissionScope.value(), callee: callee.value(), receiver: receiver.value(), typeArguments: typeArguments.value(), arguments: argumentsField.value(), candidates: candidates.value(), result: result.value() }) };
  });

  const applicationArgumentSchema: RecordSchema<ApplicationArgument> = unionSchema<ApplicationArgument>("ApplicationArgument",
    () => [valueArgumentSchema, spreadArgumentSchema], value => {
    switch (value.kind) {
      case "value": return valueArgumentSchema.stage(value);
      case "spread": return spreadArgumentSchema.stage(value);
    }
  });

  const valueArgumentSchema = recordSchema<ValueArgumentRecord>("ValueArgument", "value", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const type = read("type", () => tSchema, value => value.type);
    const tuple = read("tuple", () => nullableSchema(arraySchema(tSchema)), value => value.tuple);
    const closure = read("closure", () => nullableSchema(bodySchema), value => value.closure);
    return { fields: [occurrence, type, tuple, closure], value: () => ({ kind: "value", occurrence: occurrence.value(), type: type.value(), tuple: tuple.value(), closure: closure.value() }) };
  });

  const spreadArgumentSchema = recordSchema<SpreadArgumentRecord>("SpreadArgument", "spread", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const type = read("type", () => tSchema, value => value.type);
    const tuple = read("tuple", () => nullableSchema(arraySchema(tSchema)), value => value.tuple);
    const closure = read("closure", () => nullableSchema(bodySchema), value => value.closure);
    return { fields: [occurrence, type, tuple, closure], value: () => ({ kind: "spread", occurrence: occurrence.value(), type: type.value(), tuple: tuple.value(), closure: closure.value() }) };
  });

  const literalConstructionConstraintSchema = recordSchema<LiteralConstructionConstraintRecord>("LiteralConstructionConstraint", "construct-literal", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const construction = read("construction", () => constructionKindSchema, value => value.construction);
    const parts = read("parts", () => arraySchema(literalPartSchema), value => value.parts);
    const destination = read("destination", () => nullableSchema(tSchema), value => value.destination);
    const result = read("result", () => tSchema, value => value.result);
    return { fields: [occurrence, construction, parts, destination, result], value: () => ({ kind: "construct-literal", occurrence: occurrence.value(), construction: construction.value(), parts: parts.value(), destination: destination.value(), result: result.value() }) };
  });

  const constructionKindSchema = enumSchema("ConstructionKind", ["object","array"]);

  const literalPartSchema: RecordSchema<LiteralPart> = unionSchema<LiteralPart>("LiteralPart",
    () => [elementPartSchema, propertyPartSchema, spreadPartSchema], value => {
    switch (value.kind) {
      case "element": return elementPartSchema.stage(value);
      case "property": return propertyPartSchema.stage(value);
      case "spread": return spreadPartSchema.stage(value);
    }
  });

  const elementPartSchema = recordSchema<ElementPartRecord>("ElementPart", "element", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [occurrence, type], value: () => ({ kind: "element", occurrence: occurrence.value(), type: type.value() }) };
  });

  const propertyPartSchema = recordSchema<PropertyPartRecord>("PropertyPart", "property", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const key = read("key", () => memberKeySchema, value => value.key);
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [occurrence, key, type], value: () => ({ kind: "property", occurrence: occurrence.value(), key: key.value(), type: type.value() }) };
  });

  const spreadPartSchema = recordSchema<SpreadPartRecord>("SpreadPart", "spread", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const type = read("type", () => tSchema, value => value.type);
    return { fields: [occurrence, type], value: () => ({ kind: "spread", occurrence: occurrence.value(), type: type.value() }) };
  });

  const protocolConstraintSchema = recordSchema<ProtocolConstraintRecord>("ProtocolConstraint", "protocol", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const protocol = read("protocol", () => protocolKindSchema, value => value.protocol);
    const asynchronous = read("asynchronous", () => booleanSchema, value => value.asynchronous);
    const subject = read("subject", () => nullableSchema(tSchema), value => value.subject);
    const operands = read("operands", () => arraySchema(tSchema), value => value.operands);
    const result = read("result", () => tSchema, value => value.result);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    return { fields: [occurrence, protocol, asynchronous, subject, operands, result, bindings], value: () => ({ kind: "protocol", occurrence: occurrence.value(), protocol: protocol.value(), asynchronous: asynchronous.value(), subject: subject.value(), operands: operands.value(), result: result.value(), bindings: bindings.value() }) };
  });

  const refinementConstraintSchema = recordSchema<RefinementConstraintRecord>("RefinementConstraint", "refine", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const source = read("source", () => tSchema, value => value.source);
    const checked = read("checked", () => tSchema, value => value.checked);
    const result = read("result", () => tSchema, value => value.result);
    return { fields: [occurrence, source, checked, result], value: () => ({ kind: "refine", occurrence: occurrence.value(), source: source.value(), checked: checked.value(), result: result.value() }) };
  });

  const dischargeConstraintSchema = recordSchema<DischargeConstraintRecord>("DischargeConstraint", "discharge", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const checkerDiagnostic = read("checkerDiagnostic", () => numberSchema, value => value.checkerDiagnostic);
    const obligations = read("obligations", () => arraySchema(constraintRefSchema), value => value.obligations);
    return { fields: [occurrence, checkerDiagnostic, obligations], value: () => ({ kind: "discharge", occurrence: occurrence.value(), checkerDiagnostic: checkerDiagnostic.value(), obligations: obligations.value() }) };
  });

  const defaultConstraintSchema = recordSchema<DefaultConstraintRecord>("DefaultConstraint", "default", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const variable = read("variable", () => numberSchema, value => value.variable);
    const rule = read("rule", () => defaultRuleSchema, value => value.rule);
    const type = read("type", () => nullableSchema(tSchema), value => value.type);
    return { fields: [occurrence, variable, rule, type], value: () => ({ kind: "default", occurrence: occurrence.value(), variable: variable.value(), rule: rule.value(), type: type.value() }) };
  });

  const defaultRuleSchema = enumSchema("DefaultRule", ["signature-producers","local-producers","binder-declared-default","literal-native-default","refuse-unseeded"]);

  const operatorSchema = enumSchema("Operator", ["+","-","!","~","typeof","void","delete","*","/","%","**","&","|","^","<<",">>",">>>","<","<=",">",">=","==","!=","===","!==","in","instanceof"]);
  return { constraintSetSchema, inferenceGroupSchema, inferredSignaturePartSchema, inferredPartSchema, returnPartSchema, yieldPartSchema, variablePartSchema, fieldPartSchema, parameterInitializerPartSchema, inferenceVariableSchema, signatureVariableSchema, localVariableSchema, binderVariableSchema, literalVariableSchema, binderFamilySchema, flowRoleSchema, accessRoleSchema, protocolKindSchema, ruleIdentitySchema, constraintSchema, equalityConstraintSchema, flowConstraintSchema, literalConstraintSchema, operatorConstraintSchema, memberConstraintSchema, indexConstraintSchema, callConstraintSchema, constructConstraintSchema, applicationConstraintDataSchema, applicationArgumentSchema, valueArgumentSchema, spreadArgumentSchema, literalConstructionConstraintSchema, constructionKindSchema, literalPartSchema, elementPartSchema, propertyPartSchema, spreadPartSchema, protocolConstraintSchema, refinementConstraintSchema, dischargeConstraintSchema, defaultConstraintSchema, defaultRuleSchema, operatorSchema };
}
