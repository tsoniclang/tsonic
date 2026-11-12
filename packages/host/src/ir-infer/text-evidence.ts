import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { DefId, NodeRef, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { BindingVector, CategoryEvidence, ComponentSelector, ConstructionDefinition, LiteralValue, MemberOrigin, NumericEvidence, PointerEvidence, SumArmRole, SumEvidence, SumFamily, TypeComponent, TypeEvidence } from "../ir-types/contract.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface KnownCategoryRecord {
  readonly kind: "known";
  readonly category: "number" | "bigint" | "boolean" | "string" | "symbol" | "absence" | "object" | "callable";
}

export interface ParameterCategoryRecord {
  readonly kind: "parameter";
  readonly declaration: DefId;
}

export interface ChoiceCategoryRecord {
  readonly kind: "choice";
  readonly alternatives: readonly (CategoryEvidence)[];
}

export interface DynamicCategoryRecord {
  readonly kind: "dynamic";

}

export interface NumericLiteralEvidenceRecord {
  readonly kind: "literal" | "declared" | "operation" | "application";
  readonly producer: NodeRef;
  readonly category: CategoryEvidence;
  readonly authored: LiteralValue | null;
}

export interface NumericDeclaredEvidenceRecord {
  readonly kind: "literal" | "declared" | "operation" | "application";
  readonly producer: NodeRef;
  readonly category: CategoryEvidence;
  readonly authored: LiteralValue | null;
}

export interface NumericOperationEvidenceRecord {
  readonly kind: "literal" | "declared" | "operation" | "application";
  readonly producer: NodeRef;
  readonly category: CategoryEvidence;
  readonly authored: LiteralValue | null;
}

export interface NumericApplicationEvidenceRecord {
  readonly kind: "literal" | "declared" | "operation" | "application";
  readonly producer: NodeRef;
  readonly category: CategoryEvidence;
  readonly authored: LiteralValue | null;
}

export interface AuthoredSumRecord {
  readonly kind: "authored" | "inferred";
  readonly component: SourceNodeRef;
  readonly bindings: BindingVector;
  readonly arms: readonly (SumArmRole)[];
}

export interface InferredSumRecord {
  readonly kind: "authored" | "inferred";
  readonly component: SourceNodeRef;
  readonly bindings: BindingVector;
  readonly arms: readonly (SumArmRole)[];
}

export interface RawPointerEvidenceRecord {
  readonly kind: "raw-address";

}

export interface TypedPointerEvidenceRecord {
  readonly kind: "typed-location";
  readonly pointee: TyId;
  readonly mutability: "readonly" | "readwrite" | "unspecified";
}

export interface NativePointerEvidenceRecord {
  readonly kind: "native-pointer";
  readonly declaration: DefId;
}

export interface FunctionPointerEvidenceRecord {
  readonly kind: "function-pointer";
  readonly declaration: DefId;
  readonly parameters: readonly (TyId)[];
  readonly result: TyId;
  readonly abi: readonly (string)[];
}

export interface ClassValueRecord {
  readonly kind: "class-value" | "optional-value" | "array-element" | "intersection-result" | "projection-source" | "awaited";

}

export interface ConstructionArgumentRecord {
  readonly kind: "construction-argument";
  readonly definition: ConstructionDefinition;
  readonly index: number;
}

export interface OptionalValueRecord {
  readonly kind: "class-value" | "optional-value" | "array-element" | "intersection-result" | "projection-source" | "awaited";

}

export interface ArrayElementRecord {
  readonly kind: "class-value" | "optional-value" | "array-element" | "intersection-result" | "projection-source" | "awaited";

}

export interface TupleElementRecord {
  readonly kind: "tuple-element" | "union-member" | "argument-place" | "parameter-place" | "intersection-member";
  readonly index: number;
}

export interface UnionMemberRecord {
  readonly kind: "tuple-element" | "union-member" | "argument-place" | "parameter-place" | "intersection-member";
  readonly index: number;
}

export interface ArgumentPlaceRecord {
  readonly kind: "tuple-element" | "union-member" | "argument-place" | "parameter-place" | "intersection-member";
  readonly index: number;
}

export interface ParameterPlaceRecord {
  readonly kind: "tuple-element" | "union-member" | "argument-place" | "parameter-place" | "intersection-member";
  readonly index: number;
}

export interface IntersectionMemberRecord {
  readonly kind: "tuple-element" | "union-member" | "argument-place" | "parameter-place" | "intersection-member";
  readonly index: number;
}

export interface IntersectionResultRecord {
  readonly kind: "class-value" | "optional-value" | "array-element" | "intersection-result" | "projection-source" | "awaited";

}

export interface ArgumentTailRecord {
  readonly kind: "argument-tail" | "parameter-tail";
  readonly start: number;
}

export interface ParameterTailRecord {
  readonly kind: "argument-tail" | "parameter-tail";
  readonly start: number;
}

export interface MemberSelectorRecord {
  readonly kind: "member";
  readonly origin: MemberOrigin;
}

export interface IndexKeyRecord {
  readonly kind: "index-key" | "index-value";
  readonly declaration: DefId;
}

export interface IndexValueRecord {
  readonly kind: "index-key" | "index-value";
  readonly declaration: DefId;
}

export interface ProjectionSourceRecord {
  readonly kind: "class-value" | "optional-value" | "array-element" | "intersection-result" | "projection-source" | "awaited";

}

export interface ParameterSelectorRecord {
  readonly kind: "parameter";
  readonly signature: SigId;
  readonly index: number;
}

export interface ReceiverSelectorRecord {
  readonly kind: "receiver" | "result";
  readonly signature: SigId;
}

export interface SignatureTailRecord {
  readonly kind: "signature-tail";
  readonly signature: SigId;
  readonly start: number;
  readonly readonly: boolean;
}

export interface TupleSliceRecord {
  readonly kind: "tuple-slice";
  readonly start: number;
  readonly endCount: number;
  readonly readonly: boolean;
}

export interface ResultSelectorRecord {
  readonly kind: "receiver" | "result";
  readonly signature: SigId;
}

export interface TypeArgumentRecord {
  readonly kind: "type-argument";
  readonly declaration: DefId;
  readonly index: number;
}

export interface SumArmRecord {
  readonly kind: "sum-arm";
  readonly family: SumFamily;
  readonly index: number;
}

export interface AwaitedRecord {
  readonly kind: "class-value" | "optional-value" | "array-element" | "intersection-result" | "projection-source" | "awaited";

}

export interface EvidenceSchemas {
  readonly typeEvidenceSchema: RecordSchema<TypeEvidence>;
  readonly categoryEvidenceSchema: RecordSchema<CategoryEvidence>;
  readonly knownCategorySchema: RecordSchema<KnownCategoryRecord>;
  readonly parameterCategorySchema: RecordSchema<ParameterCategoryRecord>;
  readonly choiceCategorySchema: RecordSchema<ChoiceCategoryRecord>;
  readonly dynamicCategorySchema: RecordSchema<DynamicCategoryRecord>;
  readonly sourceCategorySchema: Schema<"absence" | "bigint" | "boolean" | "callable" | "number" | "object" | "string" | "symbol">;
  readonly numericEvidenceSchema: RecordSchema<NumericEvidence>;
  readonly numericLiteralEvidenceSchema: RecordSchema<NumericLiteralEvidenceRecord>;
  readonly numericDeclaredEvidenceSchema: RecordSchema<NumericDeclaredEvidenceRecord>;
  readonly numericOperationEvidenceSchema: RecordSchema<NumericOperationEvidenceRecord>;
  readonly numericApplicationEvidenceSchema: RecordSchema<NumericApplicationEvidenceRecord>;
  readonly sumEvidenceSchema: RecordSchema<SumEvidence>;
  readonly authoredSumSchema: RecordSchema<AuthoredSumRecord>;
  readonly inferredSumSchema: RecordSchema<InferredSumRecord>;
  readonly sumArmRoleSchema: RecordSchema<SumArmRole>;
  readonly pointerEvidenceSchema: RecordSchema<PointerEvidence>;
  readonly rawPointerEvidenceSchema: RecordSchema<RawPointerEvidenceRecord>;
  readonly typedPointerEvidenceSchema: RecordSchema<TypedPointerEvidenceRecord>;
  readonly nativePointerEvidenceSchema: RecordSchema<NativePointerEvidenceRecord>;
  readonly functionPointerEvidenceSchema: RecordSchema<FunctionPointerEvidenceRecord>;
  readonly pointerMutabilitySchema: Schema<"readonly" | "readwrite" | "unspecified">;
  readonly typeComponentSchema: RecordSchema<TypeComponent>;
  readonly componentSelectorSchema: RecordSchema<ComponentSelector>;
  readonly classValueSchema: RecordSchema<ClassValueRecord>;
  readonly constructionArgumentSchema: RecordSchema<ConstructionArgumentRecord>;
  readonly optionalValueSchema: RecordSchema<OptionalValueRecord>;
  readonly arrayElementSchema: RecordSchema<ArrayElementRecord>;
  readonly tupleElementSchema: RecordSchema<TupleElementRecord>;
  readonly unionMemberSchema: RecordSchema<UnionMemberRecord>;
  readonly argumentPlaceSchema: RecordSchema<ArgumentPlaceRecord>;
  readonly parameterPlaceSchema: RecordSchema<ParameterPlaceRecord>;
  readonly intersectionMemberSchema: RecordSchema<IntersectionMemberRecord>;
  readonly intersectionResultSchema: RecordSchema<IntersectionResultRecord>;
  readonly argumentTailSchema: RecordSchema<ArgumentTailRecord>;
  readonly parameterTailSchema: RecordSchema<ParameterTailRecord>;
  readonly memberSelectorSchema: RecordSchema<MemberSelectorRecord>;
  readonly indexKeySchema: RecordSchema<IndexKeyRecord>;
  readonly indexValueSchema: RecordSchema<IndexValueRecord>;
  readonly projectionSourceSchema: RecordSchema<ProjectionSourceRecord>;
  readonly parameterSelectorSchema: RecordSchema<ParameterSelectorRecord>;
  readonly receiverSelectorSchema: RecordSchema<ReceiverSelectorRecord>;
  readonly signatureTailSchema: RecordSchema<SignatureTailRecord>;
  readonly tupleSliceSchema: RecordSchema<TupleSliceRecord>;
  readonly resultSelectorSchema: RecordSchema<ResultSelectorRecord>;
  readonly typeArgumentSchema: RecordSchema<TypeArgumentRecord>;
  readonly sumArmSchema: RecordSchema<SumArmRecord>;
  readonly awaitedSchema: RecordSchema<AwaitedRecord>;
  readonly constructionDefinitionSchema: RecordSchema<ConstructionDefinition>;
  readonly sumFamilySchema: RecordSchema<SumFamily>;
  readonly sumOriginSchema: Schema<"authored" | "inferred">;
}

export function createEvidenceSchemas(data: DataSchemas): EvidenceSchemas {
  const { bindingVectorSchema, booleanSchema, defSchema, literalValueSchema, localRefSchema, memberOriginSchema, nodeRefSchema, numberSchema, sigSchema, sourceNodeRefSchema, stringSchema, tSchema, typeParameterIdentitySchema } = data;
  const typeEvidenceSchema = recordSchema<TypeEvidence>("TypeEvidence", "TypeEvidence", read => {
    const type = read("type", () => tSchema, value => value.type);
    const component = read("component", () => sourceNodeRefSchema, value => value.component);
    const category = read("category", () => categoryEvidenceSchema, value => value.category);
    const numeric = read("numeric", () => nullableSchema(numericEvidenceSchema), value => value.numeric);
    const sum = read("sum", () => nullableSchema(sumEvidenceSchema), value => value.sum);
    const nominal = read("nominal", () => nullableSchema(defSchema), value => value.nominal);
    const pointer = read("pointer", () => nullableSchema(pointerEvidenceSchema), value => value.pointer);
    return { fields: [type, component, category, numeric, sum, nominal, pointer], value: () => ({ type: type.value(), component: component.value(), category: category.value(), numeric: numeric.value(), sum: sum.value(), nominal: nominal.value(), pointer: pointer.value() }) };
  });

  const categoryEvidenceSchema: RecordSchema<CategoryEvidence> = unionSchema<CategoryEvidence>("CategoryEvidence",
    () => [knownCategorySchema, parameterCategorySchema, choiceCategorySchema, dynamicCategorySchema], value => {
    switch (value.kind) {
      case "known": return knownCategorySchema.stage(value);
      case "parameter": return parameterCategorySchema.stage(value);
      case "choice": return choiceCategorySchema.stage(value);
      case "dynamic": return dynamicCategorySchema.stage(value);
    }
  });

  const knownCategorySchema = recordSchema<KnownCategoryRecord>("KnownCategory", "known", read => {
    const category = read("category", () => sourceCategorySchema, value => value.category);
    return { fields: [category], value: () => ({ kind: "known", category: category.value() }) };
  });

  const parameterCategorySchema = recordSchema<ParameterCategoryRecord>("ParameterCategory", "parameter", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "parameter", declaration: declaration.value() }) };
  });

  const choiceCategorySchema = recordSchema<ChoiceCategoryRecord>("ChoiceCategory", "choice", read => {
    const alternatives = read("alternatives", () => arraySchema(categoryEvidenceSchema), value => value.alternatives);
    return { fields: [alternatives], value: () => ({ kind: "choice", alternatives: alternatives.value() }) };
  });

  const dynamicCategorySchema = recordSchema<DynamicCategoryRecord>("DynamicCategory", "dynamic", () => {
    return { fields: [], value: () => ({ kind: "dynamic" }) };
  });

  const sourceCategorySchema = enumSchema("SourceCategory", ["number","bigint","boolean","string","symbol","absence","object","callable"]);

  const numericEvidenceSchema: RecordSchema<NumericEvidence> = unionSchema<NumericEvidence>("NumericEvidence",
    () => [numericLiteralEvidenceSchema, numericDeclaredEvidenceSchema, numericOperationEvidenceSchema, numericApplicationEvidenceSchema], value => {
    switch (value.kind) {
      case "literal": return numericLiteralEvidenceSchema.stage(value);
      case "declared": return numericDeclaredEvidenceSchema.stage(value);
      case "operation": return numericOperationEvidenceSchema.stage(value);
      case "application": return numericApplicationEvidenceSchema.stage(value);
    }
  });

  const numericLiteralEvidenceSchema = recordSchema<NumericLiteralEvidenceRecord>("NumericLiteralEvidence", "literal", read => {
    const producer = read("producer", () => nodeRefSchema, value => value.producer);
    const category = read("category", () => categoryEvidenceSchema, value => value.category);
    const authored = read("authored", () => nullableSchema(literalValueSchema), value => value.authored);
    return { fields: [producer, category, authored], value: () => ({ kind: "literal", producer: producer.value(), category: category.value(), authored: authored.value() }) };
  });

  const numericDeclaredEvidenceSchema = recordSchema<NumericDeclaredEvidenceRecord>("NumericDeclaredEvidence", "declared", read => {
    const producer = read("producer", () => nodeRefSchema, value => value.producer);
    const category = read("category", () => categoryEvidenceSchema, value => value.category);
    const authored = read("authored", () => nullableSchema(literalValueSchema), value => value.authored);
    return { fields: [producer, category, authored], value: () => ({ kind: "declared", producer: producer.value(), category: category.value(), authored: authored.value() }) };
  });

  const numericOperationEvidenceSchema = recordSchema<NumericOperationEvidenceRecord>("NumericOperationEvidence", "operation", read => {
    const producer = read("producer", () => nodeRefSchema, value => value.producer);
    const category = read("category", () => categoryEvidenceSchema, value => value.category);
    const authored = read("authored", () => nullableSchema(literalValueSchema), value => value.authored);
    return { fields: [producer, category, authored], value: () => ({ kind: "operation", producer: producer.value(), category: category.value(), authored: authored.value() }) };
  });

  const numericApplicationEvidenceSchema = recordSchema<NumericApplicationEvidenceRecord>("NumericApplicationEvidence", "application", read => {
    const producer = read("producer", () => nodeRefSchema, value => value.producer);
    const category = read("category", () => categoryEvidenceSchema, value => value.category);
    const authored = read("authored", () => nullableSchema(literalValueSchema), value => value.authored);
    return { fields: [producer, category, authored], value: () => ({ kind: "application", producer: producer.value(), category: category.value(), authored: authored.value() }) };
  });

  const sumEvidenceSchema: RecordSchema<SumEvidence> = unionSchema<SumEvidence>("SumEvidence",
    () => [authoredSumSchema, inferredSumSchema], value => {
    switch (value.kind) {
      case "authored": return authoredSumSchema.stage(value);
      case "inferred": return inferredSumSchema.stage(value);
    }
  });

  const authoredSumSchema = recordSchema<AuthoredSumRecord>("AuthoredSum", "authored", read => {
    const component = read("component", () => sourceNodeRefSchema, value => value.component);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    const arms = read("arms", () => arraySchema(sumArmRoleSchema), value => value.arms);
    return { fields: [component, bindings, arms], value: () => ({ kind: "authored", component: component.value(), bindings: bindings.value(), arms: arms.value() }) };
  });

  const inferredSumSchema = recordSchema<InferredSumRecord>("InferredSum", "inferred", read => {
    const component = read("component", () => sourceNodeRefSchema, value => value.component);
    const bindings = read("bindings", () => bindingVectorSchema, value => value.bindings);
    const arms = read("arms", () => arraySchema(sumArmRoleSchema), value => value.arms);
    return { fields: [component, bindings, arms], value: () => ({ kind: "inferred", component: component.value(), bindings: bindings.value(), arms: arms.value() }) };
  });

  const sumArmRoleSchema = recordSchema<SumArmRole>("SumArmRole", "SumArmRole", read => {
    const authoredIndex = read("authoredIndex", () => numberSchema, value => value.authoredIndex);
    const component = read("component", () => sourceNodeRefSchema, value => value.component);
    const member = read("member", () => tSchema, value => value.member);
    return { fields: [authoredIndex, component, member], value: () => ({ authoredIndex: authoredIndex.value(), component: component.value(), member: member.value() }) };
  });

  const pointerEvidenceSchema: RecordSchema<PointerEvidence> = unionSchema<PointerEvidence>("PointerEvidence",
    () => [rawPointerEvidenceSchema, typedPointerEvidenceSchema, nativePointerEvidenceSchema, functionPointerEvidenceSchema], value => {
    switch (value.kind) {
      case "raw-address": return rawPointerEvidenceSchema.stage(value);
      case "typed-location": return typedPointerEvidenceSchema.stage(value);
      case "native-pointer": return nativePointerEvidenceSchema.stage(value);
      case "function-pointer": return functionPointerEvidenceSchema.stage(value);
    }
  });

  const rawPointerEvidenceSchema = recordSchema<RawPointerEvidenceRecord>("RawPointerEvidence", "raw-address", () => {
    return { fields: [], value: () => ({ kind: "raw-address" }) };
  });

  const typedPointerEvidenceSchema = recordSchema<TypedPointerEvidenceRecord>("TypedPointerEvidence", "typed-location", read => {
    const pointee = read("pointee", () => tSchema, value => value.pointee);
    const mutability = read("mutability", () => pointerMutabilitySchema, value => value.mutability);
    return { fields: [pointee, mutability], value: () => ({ kind: "typed-location", pointee: pointee.value(), mutability: mutability.value() }) };
  });

  const nativePointerEvidenceSchema = recordSchema<NativePointerEvidenceRecord>("NativePointerEvidence", "native-pointer", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "native-pointer", declaration: declaration.value() }) };
  });

  const functionPointerEvidenceSchema = recordSchema<FunctionPointerEvidenceRecord>("FunctionPointerEvidence", "function-pointer", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const parameters = read("parameters", () => arraySchema(tSchema), value => value.parameters);
    const result = read("result", () => tSchema, value => value.result);
    const abi = read("abi", () => arraySchema(stringSchema), value => value.abi);
    return { fields: [declaration, parameters, result, abi], value: () => ({ kind: "function-pointer", declaration: declaration.value(), parameters: parameters.value(), result: result.value(), abi: abi.value() }) };
  });

  const pointerMutabilitySchema = enumSchema("PointerMutability", ["readonly","readwrite","unspecified"]);

  const typeComponentSchema = recordSchema<TypeComponent>("TypeComponent", "TypeComponent", read => {
    const root = read("root", () => sourceNodeRefSchema, value => value.root);
    const path = read("path", () => arraySchema(componentSelectorSchema), value => value.path);
    return { fields: [root, path], value: () => ({ root: root.value(), path: path.value() }) };
  });

  const componentSelectorSchema: RecordSchema<ComponentSelector> = unionSchema<ComponentSelector>("ComponentSelector",
    () => [classValueSchema, constructionArgumentSchema, optionalValueSchema, arrayElementSchema, tupleElementSchema, unionMemberSchema, argumentPlaceSchema, parameterPlaceSchema, intersectionMemberSchema, intersectionResultSchema, argumentTailSchema, parameterTailSchema, memberSelectorSchema, indexKeySchema, indexValueSchema, projectionSourceSchema, parameterSelectorSchema, receiverSelectorSchema, signatureTailSchema, tupleSliceSchema, resultSelectorSchema, typeArgumentSchema, sumArmSchema, awaitedSchema], value => {
    switch (value.kind) {
      case "class-value": return classValueSchema.stage(value);
      case "construction-argument": return constructionArgumentSchema.stage(value);
      case "optional-value": return optionalValueSchema.stage(value);
      case "array-element": return arrayElementSchema.stage(value);
      case "tuple-element": return tupleElementSchema.stage(value);
      case "union-member": return unionMemberSchema.stage(value);
      case "argument-place": return argumentPlaceSchema.stage(value);
      case "parameter-place": return parameterPlaceSchema.stage(value);
      case "intersection-member": return intersectionMemberSchema.stage(value);
      case "intersection-result": return intersectionResultSchema.stage(value);
      case "argument-tail": return argumentTailSchema.stage(value);
      case "parameter-tail": return parameterTailSchema.stage(value);
      case "member": return memberSelectorSchema.stage(value);
      case "index-key": return indexKeySchema.stage(value);
      case "index-value": return indexValueSchema.stage(value);
      case "projection-source": return projectionSourceSchema.stage(value);
      case "parameter": return parameterSelectorSchema.stage(value);
      case "receiver": return receiverSelectorSchema.stage(value);
      case "signature-tail": return signatureTailSchema.stage(value);
      case "tuple-slice": return tupleSliceSchema.stage(value);
      case "result": return resultSelectorSchema.stage(value);
      case "type-argument": return typeArgumentSchema.stage(value);
      case "sum-arm": return sumArmSchema.stage(value);
      case "awaited": return awaitedSchema.stage(value);
    }
  });

  const classValueSchema = recordSchema<ClassValueRecord>("ClassValue", "class-value", () => {
    return { fields: [], value: () => ({ kind: "class-value" }) };
  });

  const constructionArgumentSchema = recordSchema<ConstructionArgumentRecord>("ConstructionArgument", "construction-argument", read => {
    const definition = read("definition", () => constructionDefinitionSchema, value => value.definition);
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [definition, index], value: () => ({ kind: "construction-argument", definition: definition.value(), index: index.value() }) };
  });

  const optionalValueSchema = recordSchema<OptionalValueRecord>("OptionalValue", "optional-value", () => {
    return { fields: [], value: () => ({ kind: "optional-value" }) };
  });

  const arrayElementSchema = recordSchema<ArrayElementRecord>("ArrayElement", "array-element", () => {
    return { fields: [], value: () => ({ kind: "array-element" }) };
  });

  const tupleElementSchema = recordSchema<TupleElementRecord>("TupleElement", "tuple-element", read => {
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [index], value: () => ({ kind: "tuple-element", index: index.value() }) };
  });

  const unionMemberSchema = recordSchema<UnionMemberRecord>("UnionMember", "union-member", read => {
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [index], value: () => ({ kind: "union-member", index: index.value() }) };
  });

  const argumentPlaceSchema = recordSchema<ArgumentPlaceRecord>("ArgumentPlace", "argument-place", read => {
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [index], value: () => ({ kind: "argument-place", index: index.value() }) };
  });

  const parameterPlaceSchema = recordSchema<ParameterPlaceRecord>("ParameterPlace", "parameter-place", read => {
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [index], value: () => ({ kind: "parameter-place", index: index.value() }) };
  });

  const intersectionMemberSchema = recordSchema<IntersectionMemberRecord>("IntersectionMember", "intersection-member", read => {
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [index], value: () => ({ kind: "intersection-member", index: index.value() }) };
  });

  const intersectionResultSchema = recordSchema<IntersectionResultRecord>("IntersectionResult", "intersection-result", () => {
    return { fields: [], value: () => ({ kind: "intersection-result" }) };
  });

  const argumentTailSchema = recordSchema<ArgumentTailRecord>("ArgumentTail", "argument-tail", read => {
    const start = read("start", () => numberSchema, value => value.start);
    return { fields: [start], value: () => ({ kind: "argument-tail", start: start.value() }) };
  });

  const parameterTailSchema = recordSchema<ParameterTailRecord>("ParameterTail", "parameter-tail", read => {
    const start = read("start", () => numberSchema, value => value.start);
    return { fields: [start], value: () => ({ kind: "parameter-tail", start: start.value() }) };
  });

  const memberSelectorSchema = recordSchema<MemberSelectorRecord>("MemberSelector", "member", read => {
    const origin = read("origin", () => memberOriginSchema, value => value.origin);
    return { fields: [origin], value: () => ({ kind: "member", origin: origin.value() }) };
  });

  const indexKeySchema = recordSchema<IndexKeyRecord>("IndexKey", "index-key", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "index-key", declaration: declaration.value() }) };
  });

  const indexValueSchema = recordSchema<IndexValueRecord>("IndexValue", "index-value", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "index-value", declaration: declaration.value() }) };
  });

  const projectionSourceSchema = recordSchema<ProjectionSourceRecord>("ProjectionSource", "projection-source", () => {
    return { fields: [], value: () => ({ kind: "projection-source" }) };
  });

  const parameterSelectorSchema = recordSchema<ParameterSelectorRecord>("ParameterSelector", "parameter", read => {
    const signature = read("signature", () => sigSchema, value => value.signature);
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [signature, index], value: () => ({ kind: "parameter", signature: signature.value(), index: index.value() }) };
  });

  const receiverSelectorSchema = recordSchema<ReceiverSelectorRecord>("ReceiverSelector", "receiver", read => {
    const signature = read("signature", () => sigSchema, value => value.signature);
    return { fields: [signature], value: () => ({ kind: "receiver", signature: signature.value() }) };
  });

  const signatureTailSchema = recordSchema<SignatureTailRecord>("SignatureTail", "signature-tail", read => {
    const signature = read("signature", () => sigSchema, value => value.signature);
    const start = read("start", () => numberSchema, value => value.start);
    const readonly = read("readonly", () => booleanSchema, value => value.readonly);
    return { fields: [signature, start, readonly], value: () => ({ kind: "signature-tail", signature: signature.value(), start: start.value(), readonly: readonly.value() }) };
  });

  const tupleSliceSchema = recordSchema<TupleSliceRecord>("TupleSlice", "tuple-slice", read => {
    const start = read("start", () => numberSchema, value => value.start);
    const endCount = read("endCount", () => numberSchema, value => value.endCount);
    const readonly = read("readonly", () => booleanSchema, value => value.readonly);
    return { fields: [start, endCount, readonly], value: () => ({ kind: "tuple-slice", start: start.value(), endCount: endCount.value(), readonly: readonly.value() }) };
  });

  const resultSelectorSchema = recordSchema<ResultSelectorRecord>("ResultSelector", "result", read => {
    const signature = read("signature", () => sigSchema, value => value.signature);
    return { fields: [signature], value: () => ({ kind: "result", signature: signature.value() }) };
  });

  const typeArgumentSchema = recordSchema<TypeArgumentRecord>("TypeArgument", "type-argument", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [declaration, index], value: () => ({ kind: "type-argument", declaration: declaration.value(), index: index.value() }) };
  });

  const sumArmSchema = recordSchema<SumArmRecord>("SumArm", "sum-arm", read => {
    const family = read("family", () => sumFamilySchema, value => value.family);
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [family, index], value: () => ({ kind: "sum-arm", family: family.value(), index: index.value() }) };
  });

  const awaitedSchema = recordSchema<AwaitedRecord>("Awaited", "awaited", () => {
    return { fields: [], value: () => ({ kind: "awaited" }) };
  });

  const constructionDefinitionSchema = recordSchema<ConstructionDefinition>("ConstructionDefinition", "ConstructionDefinition", read => {
    const occurrence = read("occurrence", () => nodeRefSchema, value => value.occurrence);
    const captures = read("captures", () => arraySchema(localRefSchema), value => value.captures);
    return { fields: [occurrence, captures], value: () => ({ occurrence: occurrence.value(), captures: captures.value() }) };
  });

  const sumFamilySchema = recordSchema<SumFamily>("SumFamily", "SumFamily", read => {
    const origin = read("origin", () => sumOriginSchema, value => value.origin);
    const component = read("component", () => typeComponentSchema, value => value.component);
    const parameters = read("parameters", () => arraySchema(typeParameterIdentitySchema), value => value.parameters);
    const roles = read("roles", () => arraySchema(sumArmRoleSchema), value => value.roles);
    return { fields: [origin, component, parameters, roles], value: () => ({ origin: origin.value(), component: component.value(), parameters: parameters.value(), roles: roles.value() }) };
  });

  const sumOriginSchema = enumSchema("SumOrigin", ["authored","inferred"]);
  return { typeEvidenceSchema, categoryEvidenceSchema, knownCategorySchema, parameterCategorySchema, choiceCategorySchema, dynamicCategorySchema, sourceCategorySchema, numericEvidenceSchema, numericLiteralEvidenceSchema, numericDeclaredEvidenceSchema, numericOperationEvidenceSchema, numericApplicationEvidenceSchema, sumEvidenceSchema, authoredSumSchema, inferredSumSchema, sumArmRoleSchema, pointerEvidenceSchema, rawPointerEvidenceSchema, typedPointerEvidenceSchema, nativePointerEvidenceSchema, functionPointerEvidenceSchema, pointerMutabilitySchema, typeComponentSchema, componentSelectorSchema, classValueSchema, constructionArgumentSchema, optionalValueSchema, arrayElementSchema, tupleElementSchema, unionMemberSchema, argumentPlaceSchema, parameterPlaceSchema, intersectionMemberSchema, intersectionResultSchema, argumentTailSchema, parameterTailSchema, memberSelectorSchema, indexKeySchema, indexValueSchema, projectionSourceSchema, parameterSelectorSchema, receiverSelectorSchema, signatureTailSchema, tupleSliceSchema, resultSelectorSchema, typeArgumentSchema, sumArmSchema, awaitedSchema, constructionDefinitionSchema, sumFamilySchema, sumOriginSchema };
}
