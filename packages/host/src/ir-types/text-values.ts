import type { BodyId, DefId, GroupId, ItemNodeRef, LocalId, LocalRef, NodeId, NodeRef, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import { decodeBodyId, decodeDefId, decodeGroupId, encodeBodyId, encodeDefId, encodeGroupId, localId, nodeId, sigId, tyId } from "../ids/index.js";
import type { ConstructionDefinition, ExactRational, FixedExtent, IndexSignature, Intrinsic, LiteralTypeValue, Member, MemberKey, MemberOrigin, NativePrimitive, PassingMode, Signature, SignatureParameter, TupleElement, TypeParameter, TypeParameterIdentity } from "./contract.js";
import type { RecordReader, TextReader } from "./text-readers.js";
import { arrayReader, bigintReader, booleanReader, enumReader, lazyReader, nullableReader, numberReader, recordReader, stringReader, unionReader } from "./text-readers.js";

interface SignatureComposition { readonly kind: "union" | "intersection"; readonly signatures: readonly SigId[] }

export interface TypeTextValues {
  readonly "number": TextReader<number>;
  readonly "bigint": TextReader<bigint>;
  readonly "string": TextReader<string>;
  readonly "boolean": TextReader<boolean>;
  readonly "type-id": TextReader<TyId>;
  readonly "signature-id": TextReader<SigId>;
  readonly "own-signature-id": TextReader<SigId>;
  readonly "node-id": TextReader<NodeId>;
  readonly "local-id": TextReader<LocalId>;
  readonly "definition-id": TextReader<DefId>;
  readonly "body-id": TextReader<BodyId>;
  readonly "group-id": TextReader<GroupId>;
  readonly "native": TextReader<NativePrimitive>;
  readonly "intrinsic": TextReader<Intrinsic>;
  readonly "member-kind": TextReader<"property" | "method" | "accessor">;
  readonly "signature-kind": TextReader<"call" | "construct">;
  readonly "parameter-kind": TextReader<"required" | "optional" | "default" | "rest">;
  readonly "tuple-kind": TextReader<"required" | "optional" | "rest">;
  readonly "passing": TextReader<PassingMode>;
  readonly "runtime-base": TextReader<"number" | "bigint">;
  readonly "facet": TextReader<"instance" | "value">;
  readonly "sum-origin": TextReader<"authored" | "inferred">;
  readonly "rational": RecordReader<ExactRational>;
  readonly "extent": RecordReader<FixedExtent>;
  readonly "node": RecordReader<NodeRef>;
  readonly "item-node": RecordReader<ItemNodeRef>;
  readonly "local": RecordReader<LocalRef>;
  readonly "parameter-identity": RecordReader<TypeParameterIdentity>;
  readonly "type-parameter": RecordReader<TypeParameter>;
  readonly "signature-parameter": RecordReader<SignatureParameter>;
  readonly "tuple-element": RecordReader<TupleElement>;
  readonly "construction": RecordReader<ConstructionDefinition>;
  readonly "member": RecordReader<Member>;
  readonly "index-signature": RecordReader<IndexSignature>;
  readonly "signature": RecordReader<Signature>;
  readonly "source": RecordReader<SourceNodeRef>;
  readonly "member-key": RecordReader<MemberKey>;
  readonly "origin": RecordReader<MemberOrigin>;
  readonly "composition": RecordReader<SignatureComposition>;
  readonly "literal": RecordReader<LiteralTypeValue>;
}

export function createTypeTextValues(): TypeTextValues {
  const reader_number: TextReader<number> = numberReader("number", value => value);
  const reader_bigint: TextReader<bigint> = bigintReader();
  const reader_string: TextReader<string> = stringReader("string", value => value);
  const reader_boolean: TextReader<boolean> = booleanReader();
  const reader_type_id: TextReader<TyId> = numberReader("type-id", tyId);
  const reader_signature_id: TextReader<SigId> = numberReader("signature-id", sigId);
  const reader_own_signature_id: TextReader<SigId> = numberReader("own-signature-id", sigId);
  const reader_node_id: TextReader<NodeId> = numberReader("node-id", nodeId);
  const reader_local_id: TextReader<LocalId> = numberReader("local-id", localId);
  const reader_definition_id: TextReader<DefId> = stringReader("definition-id", value => {
    const decoded = decodeDefId(value);
    return decoded.kind === "decoded" ? encodeDefId(decoded.value) : undefined;
  });
  const reader_body_id: TextReader<BodyId> = stringReader("body-id", value => {
    const decoded = decodeBodyId(value);
    return decoded.kind === "decoded" ? encodeBodyId(decoded.value) : undefined;
  });
  const reader_group_id: TextReader<GroupId> = stringReader("group-id", value => {
    const decoded = decodeGroupId(value);
    return decoded.kind === "decoded" ? encodeGroupId([decoded.value]) : undefined;
  });
  const reader_native: TextReader<NativePrimitive> = enumReader<NativePrimitive>("native", ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"]);
  const reader_intrinsic: TextReader<Intrinsic> = enumReader<Intrinsic>("intrinsic", ["any", "unknown", "object", "void", "never", "absence", "bigint", "symbol"]);
  const reader_member_kind: TextReader<"property" | "method" | "accessor"> = enumReader("member-kind", ["property", "method", "accessor"]);
  const reader_signature_kind: TextReader<"call" | "construct"> = enumReader("signature-kind", ["call", "construct"]);
  const reader_parameter_kind: TextReader<"required" | "optional" | "default" | "rest"> = enumReader("parameter-kind", ["required", "optional", "default", "rest"]);
  const reader_tuple_kind: TextReader<"required" | "optional" | "rest"> = enumReader("tuple-kind", ["required", "optional", "rest"]);
  const reader_passing: TextReader<PassingMode> = enumReader<PassingMode>("passing", ["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"]);
  const reader_runtime_base: TextReader<"number" | "bigint"> = enumReader("runtime-base", ["number", "bigint"]);
  const reader_facet: TextReader<"instance" | "value"> = enumReader("facet", ["instance", "value"]);
  const reader_sum_origin: TextReader<"authored" | "inferred"> = enumReader("sum-origin", ["authored", "inferred"]);
  const reader_rational = recordReader<ExactRational>("ExactRational", read => {
      const field_numerator = read("numerator", lazyReader(() => reader_bigint));
      const field_denominator = read("denominator", lazyReader(() => reader_bigint));
      const field_negativeZero = read("negativeZero", lazyReader(() => reader_boolean));
      return { fields: [field_numerator, field_denominator, field_negativeZero], value: () => ({ numerator: field_numerator.value(), denominator: field_denominator.value(), negativeZero: field_negativeZero.value() }) };
    });
  const reader_extent = recordReader<FixedExtent>("FixedExtent", read => {
      const field_length = read("length", lazyReader(() => reader_bigint));
      const field_runtimeBase = read("runtimeBase", lazyReader(() => reader_runtime_base));
      return { fields: [field_length, field_runtimeBase], value: () => ({ length: field_length.value(), runtimeBase: field_runtimeBase.value() }) };
    });
  const reader_node = recordReader<NodeRef>("NodeRef", read => {
      const field_body = read("body", lazyReader(() => reader_body_id));
      const field_node = read("node", lazyReader(() => reader_node_id));
      return { fields: [field_body, field_node], value: () => ({ body: field_body.value(), node: field_node.value() }) };
    });
  const reader_item_node = recordReader<ItemNodeRef>("ItemNodeRef", read => {
      const field_owner = read("owner", lazyReader(() => reader_definition_id));
      const field_node = read("node", lazyReader(() => reader_node_id));
      return { fields: [field_owner, field_node], value: () => ({ owner: field_owner.value(), node: field_node.value() }) };
    });
  const reader_local = recordReader<LocalRef>("LocalRef", read => {
      const field_body = read("body", lazyReader(() => reader_body_id));
      const field_local = read("local", lazyReader(() => reader_local_id));
      return { fields: [field_body, field_local], value: () => ({ body: field_body.value(), local: field_local.value() }) };
    });
  const reader_parameter_identity = recordReader<TypeParameterIdentity>("TypeParameterIdentity", read => {
      const field_owner = read("owner", lazyReader(() => reader_definition_id));
      const field_index = read("index", lazyReader(() => reader_number));
      return { fields: [field_owner, field_index], value: () => ({ owner: field_owner.value(), index: field_index.value() }) };
    });
  const reader_type_parameter = recordReader<TypeParameter>("TypeParameter", read => {
      const field_identity = read("identity", lazyReader(() => reader_parameter_identity));
      const field_declaration = read("declaration", lazyReader(() => reader_definition_id));
      const field_constraint = read("constraint", nullableReader(() => reader_type_id));
      const field_default = read("default", nullableReader(() => reader_type_id));
      return { fields: [field_identity, field_declaration, field_constraint, field_default], value: () => ({ identity: field_identity.value(), declaration: field_declaration.value(), constraint: field_constraint.value(), default: field_default.value() }) };
    });
  const reader_signature_parameter = recordReader<SignatureParameter>("SignatureParameter", read => {
      const field_declaration = read("declaration", lazyReader(() => reader_definition_id));
      const field_kind = read("kind", lazyReader(() => reader_parameter_kind));
      const field_type = read("type", lazyReader(() => reader_type_id));
      const field_passing = read("passing", lazyReader(() => reader_passing));
      const field_initializer = read("initializer", nullableReader(() => reader_body_id));
      return { fields: [field_declaration, field_kind, field_type, field_passing, field_initializer], value: () => ({ declaration: field_declaration.value(), kind: field_kind.value(), type: field_type.value(), passing: field_passing.value(), initializer: field_initializer.value() }) };
    });
  const reader_tuple_element = recordReader<TupleElement>("TupleElement", read => {
      const field_kind = read("kind", lazyReader(() => reader_tuple_kind));
      const field_type = read("type", lazyReader(() => reader_type_id));
      const field_declaration = read("declaration", nullableReader(() => reader_definition_id));
      return { fields: [field_kind, field_type, field_declaration], value: () => ({ kind: field_kind.value(), type: field_type.value(), declaration: field_declaration.value() }) };
    });
  const reader_construction = recordReader<ConstructionDefinition>("ConstructionDefinition", read => {
      const field_occurrence = read("occurrence", lazyReader(() => reader_node));
      const field_captures = read("captures", arrayReader(() => reader_local));
      return { fields: [field_occurrence, field_captures], value: () => ({ occurrence: field_occurrence.value(), captures: field_captures.value() }) };
    });
  const reader_member = recordReader<Member>("Member", read => {
      const field_key = read("key", lazyReader(() => reader_member_key));
      const field_origins = read("origins", arrayReader(() => reader_origin));
      const field_readOrigins = read("readOrigins", arrayReader(() => reader_origin));
      const field_writeOrigins = read("writeOrigins", arrayReader(() => reader_origin));
      const field_kind = read("kind", lazyReader(() => reader_member_kind));
      const field_read = read("read", nullableReader(() => reader_type_id));
      const field_write = read("write", nullableReader(() => reader_type_id));
      const field_optional = read("optional", lazyReader(() => reader_boolean));
      const field_readonly = read("readonly", lazyReader(() => reader_boolean));
      return { fields: [field_key, field_origins, field_readOrigins, field_writeOrigins, field_kind, field_read, field_write, field_optional, field_readonly], value: () => ({ key: field_key.value(), origins: field_origins.value(), readOrigins: field_readOrigins.value(), writeOrigins: field_writeOrigins.value(), kind: field_kind.value(), read: field_read.value(), write: field_write.value(), optional: field_optional.value(), readonly: field_readonly.value() }) };
    });
  const reader_index_signature = recordReader<IndexSignature>("IndexSignature", read => {
      const field_declaration = read("declaration", lazyReader(() => reader_definition_id));
      const field_key = read("key", lazyReader(() => reader_type_id));
      const field_read = read("read", lazyReader(() => reader_type_id));
      const field_write = read("write", nullableReader(() => reader_type_id));
      const field_readonly = read("readonly", lazyReader(() => reader_boolean));
      return { fields: [field_declaration, field_key, field_read, field_write, field_readonly], value: () => ({ declaration: field_declaration.value(), key: field_key.value(), read: field_read.value(), write: field_write.value(), readonly: field_readonly.value() }) };
    });
  const reader_signature = recordReader<Signature>("Signature", read => {
      const field_id = read("id", lazyReader(() => reader_own_signature_id));
      const field_declaration = read("declaration", nullableReader(() => reader_definition_id));
      const field_owner = read("owner", nullableReader(() => reader_source));
      const field_composition = read("composition", nullableReader(() => reader_composition));
      const field_kind = read("kind", lazyReader(() => reader_signature_kind));
      const field_typeParameters = read("typeParameters", arrayReader(() => reader_type_parameter));
      const field_receiver = read("receiver", nullableReader(() => reader_type_id));
      const field_parameters = read("parameters", arrayReader(() => reader_signature_parameter));
      const field_result = read("result", lazyReader(() => reader_type_id));
      return { fields: [field_id, field_declaration, field_owner, field_composition, field_kind, field_typeParameters, field_receiver, field_parameters, field_result], value: () => ({ id: field_id.value(), declaration: field_declaration.value(), owner: field_owner.value(), composition: field_composition.value(), kind: field_kind.value(), typeParameters: field_typeParameters.value(), receiver: field_receiver.value(), parameters: field_parameters.value(), result: field_result.value() }) };
    });
  const reader_source: RecordReader<SourceNodeRef> = unionReader(["body","item"], label => {
    switch (label) {
    case "body": return recordReader<SourceNodeRef>("body", read => {
      const field_value = read("value", lazyReader(() => reader_node));
      return { fields: [field_value], value: () => ({ kind: "body", value: field_value.value() }) };
    });
    case "item": return recordReader<SourceNodeRef>("item", read => {
      const field_value = read("value", lazyReader(() => reader_item_node));
      return { fields: [field_value], value: () => ({ kind: "item", value: field_value.value() }) };
    });
    default: return null;
    }
  });
  const reader_member_key: RecordReader<MemberKey> = unionReader(["text","number","symbol"], label => {
    switch (label) {
    case "text": return recordReader<MemberKey>("text", read => {
      const field_value = read("value", lazyReader(() => reader_string));
      return { fields: [field_value], value: () => ({ kind: "text", value: field_value.value() }) };
    });
    case "number": return recordReader<MemberKey>("number", read => {
      const field_value = read("value", lazyReader(() => reader_rational));
      return { fields: [field_value], value: () => ({ kind: "number", value: field_value.value() }) };
    });
    case "symbol": return recordReader<MemberKey>("symbol", read => {
      const field_declaration = read("declaration", lazyReader(() => reader_definition_id));
      return { fields: [field_declaration], value: () => ({ kind: "symbol", declaration: field_declaration.value() }) };
    });
    default: return null;
    }
  });
  const reader_origin: RecordReader<MemberOrigin> = unionReader(["declared","class-prototype","mapped"], label => {
    switch (label) {
    case "declared": return recordReader<MemberOrigin>("declared", read => {
      const field_declaration = read("declaration", lazyReader(() => reader_definition_id));
      return { fields: [field_declaration], value: () => ({ kind: "declared", declaration: field_declaration.value() }) };
    });
    case "class-prototype": return recordReader<MemberOrigin>("class-prototype", read => {
      const field_owner = read("owner", lazyReader(() => reader_definition_id));
      return { fields: [field_owner], value: () => ({ kind: "class-prototype", owner: field_owner.value() }) };
    });
    case "mapped": return recordReader<MemberOrigin>("mapped", read => {
      const field_owner = read("owner", lazyReader(() => reader_source));
      const field_key = read("key", lazyReader(() => reader_member_key));
      return { fields: [field_owner, field_key], value: () => ({ kind: "mapped", owner: field_owner.value(), key: field_key.value() }) };
    });
    default: return null;
    }
  });
  const reader_composition: RecordReader<SignatureComposition> = unionReader(["union","intersection"], label => {
    switch (label) {
    case "union": return recordReader<SignatureComposition>("union", read => {
      const field_signatures = read("signatures", arrayReader(() => reader_signature_id));
      return { fields: [field_signatures], value: () => ({ kind: "union", signatures: field_signatures.value() }) };
    });
    case "intersection": return recordReader<SignatureComposition>("intersection", read => {
      const field_signatures = read("signatures", arrayReader(() => reader_signature_id));
      return { fields: [field_signatures], value: () => ({ kind: "intersection", signatures: field_signatures.value() }) };
    });
    default: return null;
    }
  });
  const reader_literal: RecordReader<LiteralTypeValue> = unionReader(["literal value"], label => {
    switch (label) {
    case "number": return recordReader<LiteralTypeValue>("number", read => {
      const field_value = read("value", lazyReader(() => reader_rational));
      return { fields: [field_value], value: () => ({ kind: "number", value: field_value.value() }) };
    });
    case "bigint": return recordReader<LiteralTypeValue>("bigint", read => {
      const field_value = read("value", lazyReader(() => reader_bigint));
      return { fields: [field_value], value: () => ({ kind: "bigint", value: field_value.value() }) };
    });
    case "string": return recordReader<LiteralTypeValue>("string", read => {
      const field_value = read("value", lazyReader(() => reader_string));
      return { fields: [field_value], value: () => ({ kind: "string", value: field_value.value() }) };
    });
    case "boolean": return recordReader<LiteralTypeValue>("boolean", read => {
      const field_value = read("value", lazyReader(() => reader_boolean));
      return { fields: [field_value], value: () => ({ kind: "boolean", value: field_value.value() }) };
    });
    case "absence": return recordReader<LiteralTypeValue>("absence", () => {
      return { fields: [], value: () => ({ kind: "absence" }) };
    });
    case "unique-symbol": return recordReader<LiteralTypeValue>("unique-symbol", read => {
      const field_declaration = read("declaration", lazyReader(() => reader_definition_id));
      return { fields: [field_declaration], value: () => ({ kind: "unique-symbol", declaration: field_declaration.value() }) };
    });
    default: return null;
    }
  });
  return { "number": reader_number, "bigint": reader_bigint, "string": reader_string, "boolean": reader_boolean, "type-id": reader_type_id, "signature-id": reader_signature_id, "own-signature-id": reader_own_signature_id, "node-id": reader_node_id, "local-id": reader_local_id, "definition-id": reader_definition_id, "body-id": reader_body_id, "group-id": reader_group_id, "native": reader_native, "intrinsic": reader_intrinsic, "member-kind": reader_member_kind, "signature-kind": reader_signature_kind, "parameter-kind": reader_parameter_kind, "tuple-kind": reader_tuple_kind, "passing": reader_passing, "runtime-base": reader_runtime_base, "facet": reader_facet, "sum-origin": reader_sum_origin, "rational": reader_rational, "extent": reader_extent, "node": reader_node, "item-node": reader_item_node, "local": reader_local, "parameter-identity": reader_parameter_identity, "type-parameter": reader_type_parameter, "signature-parameter": reader_signature_parameter, "tuple-element": reader_tuple_element, "construction": reader_construction, "member": reader_member, "index-signature": reader_index_signature, "signature": reader_signature, "source": reader_source, "member-key": reader_member_key, "origin": reader_origin, "composition": reader_composition, "literal": reader_literal };
}
