import type { CaptureValuesSchemas } from "./text-capture-values.js";
import { arraySchema, enumSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import type { DefId, SourceNodeRef } from "../ids/contract.js";
import type { HirAddressIntegerCapture, HirCapturedType, HirIntegerOperandCapture, HirPointerOperationCapture, HirPointerTypeCapture } from "../ir-hir/contract.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface RawPointerTypeRecord {
  readonly kind: "raw-address";

}

export interface TypedPointerTypeRecord {
  readonly kind: "typed-location";
  readonly pointee: HirCapturedType;
  readonly mutability: "readonly" | "readwrite" | "unspecified";
}

export interface NativePointerTypeRecord {
  readonly kind: "native-pointer";
  readonly declaration: DefId;
}

export interface FunctionPointerTypeRecord {
  readonly kind: "function-pointer";
  readonly declaration: DefId;
  readonly parameters: readonly (HirCapturedType)[];
  readonly result: HirCapturedType;
  readonly abi: readonly (string)[];
}

export interface TypedOperationRecord {
  readonly family: "typed-location";
  readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
  readonly exportName: string;
  readonly arguments: readonly (SourceNodeRef)[];
  readonly typeArguments: readonly (SourceNodeRef)[];
  readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited";
  readonly pointee: "available" | "unvisited" | "not-applicable" | "missing";
}

export interface TypedViewRecord {
  readonly family: "typed-location";
  readonly operation: "view";
  readonly pointer: SourceNodeRef;
  readonly read: SourceNodeRef;
  readonly write: SourceNodeRef;
  readonly optional: boolean;
}

export interface NativeLoadRecord {
  readonly family: "native-pointer";
  readonly operation: "load";
  readonly pointer: SourceNodeRef;
}

export interface NativeStoreRecord {
  readonly family: "native-pointer";
  readonly operation: "store";
  readonly pointer: SourceNodeRef;
  readonly value: SourceNodeRef;
}

export interface NativeOffsetRecord {
  readonly family: "native-pointer";
  readonly operation: "offset";
  readonly pointer: SourceNodeRef;
  readonly offset: SourceNodeRef;
}

export interface RawBindRecord {
  readonly family: "raw-address";
  readonly operation: "bind-raw-pointer";
  readonly identity: SourceNodeRef;
}

export interface RawEqualRecord {
  readonly family: "raw-address";
  readonly operation: "equal-raw-pointer";
  readonly left: SourceNodeRef;
  readonly right: SourceNodeRef;
}

export interface RawHashRecord {
  readonly family: "raw-address";
  readonly operation: "hash-raw-pointer";
  readonly pointer: SourceNodeRef;
}

export interface ToRawRecord {
  readonly family: "raw-memory";
  readonly operation: "to-raw";
  readonly pointer: SourceNodeRef;
  readonly layout: SourceNodeRef;
}

export interface ReinterpretRecord {
  readonly family: "raw-memory";
  readonly operation: "reinterpret";
  readonly raw: SourceNodeRef;
  readonly layout: SourceNodeRef;
}

export interface ByteOffsetRecord {
  readonly family: "raw-memory";
  readonly operation: "byte-offset";
  readonly raw: SourceNodeRef;
  readonly offset: SourceNodeRef;
  readonly integer: HirIntegerOperandCapture;
  readonly dataLayout: SourceNodeRef;
}

export interface RawToIntegerRecord {
  readonly family: "raw-memory";
  readonly operation: "raw-to-address-integer";
  readonly raw: SourceNodeRef;
  readonly integer: HirAddressIntegerCapture;
  readonly dataLayout: SourceNodeRef;
}

export interface IntegerToRawRecord {
  readonly family: "raw-memory";
  readonly operation: "address-integer-to-raw";
  readonly address: SourceNodeRef;
  readonly integer: HirAddressIntegerCapture;
  readonly dataLayout: SourceNodeRef;
}

export interface KeepAliveRecord {
  readonly family: "keep-alive";
  readonly operation: "keep-alive";
  readonly value: SourceNodeRef;
}

export interface Address32Record {
  readonly width: 32;
  readonly runtimeBase: "number";
  readonly signedness: "unsigned";
}

export interface Address64Record {
  readonly width: 64;
  readonly runtimeBase: "bigint";
  readonly signedness: "unsigned";
}

export interface PointersSchemas {
  readonly hirCapturedTypeSchema: RecordSchema<HirCapturedType>;
  readonly hirPointerTypeCaptureSchema: RecordSchema<HirPointerTypeCapture>;
  readonly rawPointerTypeSchema: RecordSchema<RawPointerTypeRecord>;
  readonly typedPointerTypeSchema: RecordSchema<TypedPointerTypeRecord>;
  readonly nativePointerTypeSchema: RecordSchema<NativePointerTypeRecord>;
  readonly functionPointerTypeSchema: RecordSchema<FunctionPointerTypeRecord>;
  readonly hirPointerOperationCaptureSchema: RecordSchema<HirPointerOperationCapture>;
  readonly typedOperationSchema: RecordSchema<TypedOperationRecord>;
  readonly typedFamilySchema: Schema<"typed-location">;
  readonly typedOperationNameSchema: Schema<"address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store">;
  readonly pointerSelectionSchema: Schema<"applicable" | "conditional-candidates" | "untyped" | "unvisited">;
  readonly pointerPointeeSchema: Schema<"available" | "missing" | "not-applicable" | "unvisited">;
  readonly typedViewSchema: RecordSchema<TypedViewRecord>;
  readonly viewNameSchema: Schema<"view">;
  readonly nativeFamilySchema: Schema<"native-pointer">;
  readonly nativeLoadSchema: RecordSchema<NativeLoadRecord>;
  readonly loadNameSchema: Schema<"load">;
  readonly nativeStoreSchema: RecordSchema<NativeStoreRecord>;
  readonly storeNameSchema: Schema<"store">;
  readonly nativeOffsetSchema: RecordSchema<NativeOffsetRecord>;
  readonly offsetNameSchema: Schema<"offset">;
  readonly rawFamilySchema: Schema<"raw-address">;
  readonly rawBindSchema: RecordSchema<RawBindRecord>;
  readonly rawBindNameSchema: Schema<"bind-raw-pointer">;
  readonly rawEqualSchema: RecordSchema<RawEqualRecord>;
  readonly rawEqualNameSchema: Schema<"equal-raw-pointer">;
  readonly rawHashSchema: RecordSchema<RawHashRecord>;
  readonly rawHashNameSchema: Schema<"hash-raw-pointer">;
  readonly rawMemoryFamilySchema: Schema<"raw-memory">;
  readonly toRawSchema: RecordSchema<ToRawRecord>;
  readonly toRawNameSchema: Schema<"to-raw">;
  readonly reinterpretSchema: RecordSchema<ReinterpretRecord>;
  readonly reinterpretNameSchema: Schema<"reinterpret">;
  readonly byteOffsetSchema: RecordSchema<ByteOffsetRecord>;
  readonly byteOffsetNameSchema: Schema<"byte-offset">;
  readonly rawToIntegerSchema: RecordSchema<RawToIntegerRecord>;
  readonly rawToIntegerNameSchema: Schema<"raw-to-address-integer">;
  readonly integerToRawSchema: RecordSchema<IntegerToRawRecord>;
  readonly integerToRawNameSchema: Schema<"address-integer-to-raw">;
  readonly keepAliveSchema: RecordSchema<KeepAliveRecord>;
  readonly keepAliveFamilySchema: Schema<"keep-alive">;
  readonly hirIntegerOperandCaptureSchema: RecordSchema<HirIntegerOperandCapture>;
  readonly runtimeBaseSchema: Schema<"bigint" | "number">;
  readonly signednessSchema: Schema<"signed" | "unsigned">;
  readonly integerWidthSchema: Schema<8 | 16 | 32 | 64 | 128>;
  readonly hirAddressIntegerCaptureSchema: RecordSchema<HirAddressIntegerCapture>;
  readonly address32Schema: RecordSchema<Address32Record>;
  readonly address64Schema: RecordSchema<Address64Record>;
  readonly width32Schema: Schema<32>;
  readonly width64Schema: Schema<64>;
  readonly numberBaseSchema: Schema<"number">;
  readonly bigintBaseSchema: Schema<"bigint">;
  readonly unsignedSchema: Schema<"unsigned">;
}

export function createPointersSchemas(captureValues: CaptureValuesSchemas, data: DataSchemas, evidence: EvidenceSchemas): PointersSchemas {
  const { capturedTypeSchema } = captureValues;
  const { booleanSchema, defSchema, sourceNodeRefSchema, stringSchema } = data;
  const { pointerMutabilitySchema, typeComponentSchema } = evidence;
  const hirCapturedTypeSchema = recordSchema<HirCapturedType>("HirCapturedType", "HirCapturedType", read => {
    const type = read("type", () => capturedTypeSchema, value => value.type);
    const component = read("component", () => typeComponentSchema, value => value.component);
    return { fields: [type, component], value: () => ({ type: type.value(), component: component.value() }) };
  });

  const hirPointerTypeCaptureSchema: RecordSchema<HirPointerTypeCapture> = unionSchema<HirPointerTypeCapture>("HirPointerTypeCapture",
    () => [rawPointerTypeSchema, typedPointerTypeSchema, nativePointerTypeSchema, functionPointerTypeSchema], value => {
    switch (value.kind) {
      case "raw-address": return rawPointerTypeSchema.stage(value);
      case "typed-location": return typedPointerTypeSchema.stage(value);
      case "native-pointer": return nativePointerTypeSchema.stage(value);
      case "function-pointer": return functionPointerTypeSchema.stage(value);
    }
  });

  const rawPointerTypeSchema = recordSchema<RawPointerTypeRecord>("RawPointerType", "raw-address", () => {
    return { fields: [], value: () => ({ kind: "raw-address" }) };
  });

  const typedPointerTypeSchema = recordSchema<TypedPointerTypeRecord>("TypedPointerType", "typed-location", read => {
    const pointee = read("pointee", () => hirCapturedTypeSchema, value => value.pointee);
    const mutability = read("mutability", () => pointerMutabilitySchema, value => value.mutability);
    return { fields: [pointee, mutability], value: () => ({ kind: "typed-location", pointee: pointee.value(), mutability: mutability.value() }) };
  });

  const nativePointerTypeSchema = recordSchema<NativePointerTypeRecord>("NativePointerType", "native-pointer", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    return { fields: [declaration], value: () => ({ kind: "native-pointer", declaration: declaration.value() }) };
  });

  const functionPointerTypeSchema = recordSchema<FunctionPointerTypeRecord>("FunctionPointerType", "function-pointer", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const parameters = read("parameters", () => arraySchema(hirCapturedTypeSchema), value => value.parameters);
    const result = read("result", () => hirCapturedTypeSchema, value => value.result);
    const abi = read("abi", () => arraySchema(stringSchema), value => value.abi);
    return { fields: [declaration, parameters, result, abi], value: () => ({ kind: "function-pointer", declaration: declaration.value(), parameters: parameters.value(), result: result.value(), abi: abi.value() }) };
  });

  const hirPointerOperationCaptureSchema: RecordSchema<HirPointerOperationCapture> = unionSchema<HirPointerOperationCapture>("HirPointerOperationCapture",
    () => [typedOperationSchema, typedViewSchema, nativeLoadSchema, nativeStoreSchema, nativeOffsetSchema, rawBindSchema, rawEqualSchema, rawHashSchema, toRawSchema, reinterpretSchema, byteOffsetSchema, rawToIntegerSchema, integerToRawSchema, keepAliveSchema], value => {
    switch (value.family) {
      case "typed-location":
        switch (value.operation) {
          case "address-of": case "allocate": case "load": case "store": case "equal-pointer": case "hash-pointer": case "bind-pointer": case "project-pointer": return typedOperationSchema.stage(value);
          case "view": return typedViewSchema.stage(value);
        }
      case "native-pointer":
        switch (value.operation) {
          case "load": return nativeLoadSchema.stage(value);
          case "store": return nativeStoreSchema.stage(value);
          case "offset": return nativeOffsetSchema.stage(value);
        }
      case "raw-address":
        switch (value.operation) {
          case "bind-raw-pointer": return rawBindSchema.stage(value);
          case "equal-raw-pointer": return rawEqualSchema.stage(value);
          case "hash-raw-pointer": return rawHashSchema.stage(value);
        }
      case "raw-memory":
        switch (value.operation) {
          case "to-raw": return toRawSchema.stage(value);
          case "reinterpret": return reinterpretSchema.stage(value);
          case "byte-offset": return byteOffsetSchema.stage(value);
          case "raw-to-address-integer": return rawToIntegerSchema.stage(value);
          case "address-integer-to-raw": return integerToRawSchema.stage(value);
        }
      case "keep-alive": return keepAliveSchema.stage(value);
    }
  });

  const typedOperationSchema = recordSchema<TypedOperationRecord>("TypedOperation", "HirPointerOperationCapture", read => {
    const family = read("family", () => typedFamilySchema, value => value.family);
    const operation = read("operation", () => typedOperationNameSchema, value => value.operation);
    const exportName = read("exportName", () => stringSchema, value => value.exportName);
    const argumentsField = read("arguments", () => arraySchema(sourceNodeRefSchema), value => value.arguments);
    const typeArguments = read("typeArguments", () => arraySchema(sourceNodeRefSchema), value => value.typeArguments);
    const selection = read("selection", () => pointerSelectionSchema, value => value.selection);
    const pointee = read("pointee", () => pointerPointeeSchema, value => value.pointee);
    return { fields: [family, operation, exportName, argumentsField, typeArguments, selection, pointee], value: () => ({ family: family.value(), operation: operation.value(), exportName: exportName.value(), arguments: argumentsField.value(), typeArguments: typeArguments.value(), selection: selection.value(), pointee: pointee.value() }) };
  });

  const typedFamilySchema = enumSchema("TypedFamily", ["typed-location"]);

  const typedOperationNameSchema = enumSchema("TypedOperationName", ["address-of","allocate","load","store","equal-pointer","hash-pointer","bind-pointer","project-pointer"]);

  const pointerSelectionSchema = enumSchema("PointerSelection", ["applicable","conditional-candidates","untyped","unvisited"]);

  const pointerPointeeSchema = enumSchema("PointerPointee", ["available","unvisited","not-applicable","missing"]);

  const typedViewSchema = recordSchema<TypedViewRecord>("TypedView", "HirPointerOperationCapture", read => {
    const family = read("family", () => typedFamilySchema, value => value.family);
    const operation = read("operation", () => viewNameSchema, value => value.operation);
    const pointer = read("pointer", () => sourceNodeRefSchema, value => value.pointer);
    const readField = read("read", () => sourceNodeRefSchema, value => value.read);
    const write = read("write", () => sourceNodeRefSchema, value => value.write);
    const optional = read("optional", () => booleanSchema, value => value.optional);
    return { fields: [family, operation, pointer, readField, write, optional], value: () => ({ family: family.value(), operation: operation.value(), pointer: pointer.value(), read: readField.value(), write: write.value(), optional: optional.value() }) };
  });

  const viewNameSchema = enumSchema("ViewName", ["view"]);

  const nativeFamilySchema = enumSchema("NativeFamily", ["native-pointer"]);

  const nativeLoadSchema = recordSchema<NativeLoadRecord>("NativeLoad", "HirPointerOperationCapture", read => {
    const family = read("family", () => nativeFamilySchema, value => value.family);
    const operation = read("operation", () => loadNameSchema, value => value.operation);
    const pointer = read("pointer", () => sourceNodeRefSchema, value => value.pointer);
    return { fields: [family, operation, pointer], value: () => ({ family: family.value(), operation: operation.value(), pointer: pointer.value() }) };
  });

  const loadNameSchema = enumSchema("LoadName", ["load"]);

  const nativeStoreSchema = recordSchema<NativeStoreRecord>("NativeStore", "HirPointerOperationCapture", read => {
    const family = read("family", () => nativeFamilySchema, value => value.family);
    const operation = read("operation", () => storeNameSchema, value => value.operation);
    const pointer = read("pointer", () => sourceNodeRefSchema, value => value.pointer);
    const value = read("value", () => sourceNodeRefSchema, value => value.value);
    return { fields: [family, operation, pointer, value], value: () => ({ family: family.value(), operation: operation.value(), pointer: pointer.value(), value: value.value() }) };
  });

  const storeNameSchema = enumSchema("StoreName", ["store"]);

  const nativeOffsetSchema = recordSchema<NativeOffsetRecord>("NativeOffset", "HirPointerOperationCapture", read => {
    const family = read("family", () => nativeFamilySchema, value => value.family);
    const operation = read("operation", () => offsetNameSchema, value => value.operation);
    const pointer = read("pointer", () => sourceNodeRefSchema, value => value.pointer);
    const offset = read("offset", () => sourceNodeRefSchema, value => value.offset);
    return { fields: [family, operation, pointer, offset], value: () => ({ family: family.value(), operation: operation.value(), pointer: pointer.value(), offset: offset.value() }) };
  });

  const offsetNameSchema = enumSchema("OffsetName", ["offset"]);

  const rawFamilySchema = enumSchema("RawFamily", ["raw-address"]);

  const rawBindSchema = recordSchema<RawBindRecord>("RawBind", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawFamilySchema, value => value.family);
    const operation = read("operation", () => rawBindNameSchema, value => value.operation);
    const identity = read("identity", () => sourceNodeRefSchema, value => value.identity);
    return { fields: [family, operation, identity], value: () => ({ family: family.value(), operation: operation.value(), identity: identity.value() }) };
  });

  const rawBindNameSchema = enumSchema("RawBindName", ["bind-raw-pointer"]);

  const rawEqualSchema = recordSchema<RawEqualRecord>("RawEqual", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawFamilySchema, value => value.family);
    const operation = read("operation", () => rawEqualNameSchema, value => value.operation);
    const left = read("left", () => sourceNodeRefSchema, value => value.left);
    const right = read("right", () => sourceNodeRefSchema, value => value.right);
    return { fields: [family, operation, left, right], value: () => ({ family: family.value(), operation: operation.value(), left: left.value(), right: right.value() }) };
  });

  const rawEqualNameSchema = enumSchema("RawEqualName", ["equal-raw-pointer"]);

  const rawHashSchema = recordSchema<RawHashRecord>("RawHash", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawFamilySchema, value => value.family);
    const operation = read("operation", () => rawHashNameSchema, value => value.operation);
    const pointer = read("pointer", () => sourceNodeRefSchema, value => value.pointer);
    return { fields: [family, operation, pointer], value: () => ({ family: family.value(), operation: operation.value(), pointer: pointer.value() }) };
  });

  const rawHashNameSchema = enumSchema("RawHashName", ["hash-raw-pointer"]);

  const rawMemoryFamilySchema = enumSchema("RawMemoryFamily", ["raw-memory"]);

  const toRawSchema = recordSchema<ToRawRecord>("ToRaw", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawMemoryFamilySchema, value => value.family);
    const operation = read("operation", () => toRawNameSchema, value => value.operation);
    const pointer = read("pointer", () => sourceNodeRefSchema, value => value.pointer);
    const layout = read("layout", () => sourceNodeRefSchema, value => value.layout);
    return { fields: [family, operation, pointer, layout], value: () => ({ family: family.value(), operation: operation.value(), pointer: pointer.value(), layout: layout.value() }) };
  });

  const toRawNameSchema = enumSchema("ToRawName", ["to-raw"]);

  const reinterpretSchema = recordSchema<ReinterpretRecord>("Reinterpret", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawMemoryFamilySchema, value => value.family);
    const operation = read("operation", () => reinterpretNameSchema, value => value.operation);
    const raw = read("raw", () => sourceNodeRefSchema, value => value.raw);
    const layout = read("layout", () => sourceNodeRefSchema, value => value.layout);
    return { fields: [family, operation, raw, layout], value: () => ({ family: family.value(), operation: operation.value(), raw: raw.value(), layout: layout.value() }) };
  });

  const reinterpretNameSchema = enumSchema("ReinterpretName", ["reinterpret"]);

  const byteOffsetSchema = recordSchema<ByteOffsetRecord>("ByteOffset", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawMemoryFamilySchema, value => value.family);
    const operation = read("operation", () => byteOffsetNameSchema, value => value.operation);
    const raw = read("raw", () => sourceNodeRefSchema, value => value.raw);
    const offset = read("offset", () => sourceNodeRefSchema, value => value.offset);
    const integer = read("integer", () => hirIntegerOperandCaptureSchema, value => value.integer);
    const dataLayout = read("dataLayout", () => sourceNodeRefSchema, value => value.dataLayout);
    return { fields: [family, operation, raw, offset, integer, dataLayout], value: () => ({ family: family.value(), operation: operation.value(), raw: raw.value(), offset: offset.value(), integer: integer.value(), dataLayout: dataLayout.value() }) };
  });

  const byteOffsetNameSchema = enumSchema("ByteOffsetName", ["byte-offset"]);

  const rawToIntegerSchema = recordSchema<RawToIntegerRecord>("RawToInteger", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawMemoryFamilySchema, value => value.family);
    const operation = read("operation", () => rawToIntegerNameSchema, value => value.operation);
    const raw = read("raw", () => sourceNodeRefSchema, value => value.raw);
    const integer = read("integer", () => hirAddressIntegerCaptureSchema, value => value.integer);
    const dataLayout = read("dataLayout", () => sourceNodeRefSchema, value => value.dataLayout);
    return { fields: [family, operation, raw, integer, dataLayout], value: () => ({ family: family.value(), operation: operation.value(), raw: raw.value(), integer: integer.value(), dataLayout: dataLayout.value() }) };
  });

  const rawToIntegerNameSchema = enumSchema("RawToIntegerName", ["raw-to-address-integer"]);

  const integerToRawSchema = recordSchema<IntegerToRawRecord>("IntegerToRaw", "HirPointerOperationCapture", read => {
    const family = read("family", () => rawMemoryFamilySchema, value => value.family);
    const operation = read("operation", () => integerToRawNameSchema, value => value.operation);
    const address = read("address", () => sourceNodeRefSchema, value => value.address);
    const integer = read("integer", () => hirAddressIntegerCaptureSchema, value => value.integer);
    const dataLayout = read("dataLayout", () => sourceNodeRefSchema, value => value.dataLayout);
    return { fields: [family, operation, address, integer, dataLayout], value: () => ({ family: family.value(), operation: operation.value(), address: address.value(), integer: integer.value(), dataLayout: dataLayout.value() }) };
  });

  const integerToRawNameSchema = enumSchema("IntegerToRawName", ["address-integer-to-raw"]);

  const keepAliveSchema = recordSchema<KeepAliveRecord>("KeepAlive", "HirPointerOperationCapture", read => {
    const family = read("family", () => keepAliveFamilySchema, value => value.family);
    const operation = read("operation", () => keepAliveFamilySchema, value => value.operation);
    const value = read("value", () => sourceNodeRefSchema, value => value.value);
    return { fields: [family, operation, value], value: () => ({ family: family.value(), operation: operation.value(), value: value.value() }) };
  });

  const keepAliveFamilySchema = enumSchema("KeepAliveFamily", ["keep-alive"]);

  const hirIntegerOperandCaptureSchema = recordSchema<HirIntegerOperandCapture>("HirIntegerOperandCapture", "HirIntegerOperandCapture", read => {
    const runtimeBase = read("runtimeBase", () => runtimeBaseSchema, value => value.runtimeBase);
    const signedness = read("signedness", () => signednessSchema, value => value.signedness);
    const width = read("width", () => integerWidthSchema, value => value.width);
    return { fields: [runtimeBase, signedness, width], value: () => ({ runtimeBase: runtimeBase.value(), signedness: signedness.value(), width: width.value() }) };
  });

  const runtimeBaseSchema = enumSchema("RuntimeBase", ["number","bigint"]);

  const signednessSchema = enumSchema("Signedness", ["signed","unsigned"]);

  const integerWidthSchema = enumSchema("IntegerWidth", [8,16,32,64,128]);

  const hirAddressIntegerCaptureSchema: RecordSchema<HirAddressIntegerCapture> = unionSchema<HirAddressIntegerCapture>("HirAddressIntegerCapture",
    () => [address32Schema, address64Schema], value => {
    switch (value.width) {
      case 32: return address32Schema.stage(value);
      case 64: return address64Schema.stage(value);
    }
  });

  const address32Schema = recordSchema<Address32Record>("Address32", "HirAddressIntegerCapture", read => {
    const width = read("width", () => width32Schema, value => value.width);
    const runtimeBase = read("runtimeBase", () => numberBaseSchema, value => value.runtimeBase);
    const signedness = read("signedness", () => unsignedSchema, value => value.signedness);
    return { fields: [width, runtimeBase, signedness], value: () => ({ width: width.value(), runtimeBase: runtimeBase.value(), signedness: signedness.value() }) };
  });

  const address64Schema = recordSchema<Address64Record>("Address64", "HirAddressIntegerCapture", read => {
    const width = read("width", () => width64Schema, value => value.width);
    const runtimeBase = read("runtimeBase", () => bigintBaseSchema, value => value.runtimeBase);
    const signedness = read("signedness", () => unsignedSchema, value => value.signedness);
    return { fields: [width, runtimeBase, signedness], value: () => ({ width: width.value(), runtimeBase: runtimeBase.value(), signedness: signedness.value() }) };
  });

  const width32Schema = enumSchema("Width32", [32]);

  const width64Schema = enumSchema("Width64", [64]);

  const numberBaseSchema = enumSchema("NumberBase", ["number"]);

  const bigintBaseSchema = enumSchema("BigintBase", ["bigint"]);

  const unsignedSchema = enumSchema("Unsigned", ["unsigned"]);
  return { hirCapturedTypeSchema, hirPointerTypeCaptureSchema, rawPointerTypeSchema, typedPointerTypeSchema, nativePointerTypeSchema, functionPointerTypeSchema, hirPointerOperationCaptureSchema, typedOperationSchema, typedFamilySchema, typedOperationNameSchema, pointerSelectionSchema, pointerPointeeSchema, typedViewSchema, viewNameSchema, nativeFamilySchema, nativeLoadSchema, loadNameSchema, nativeStoreSchema, storeNameSchema, nativeOffsetSchema, offsetNameSchema, rawFamilySchema, rawBindSchema, rawBindNameSchema, rawEqualSchema, rawEqualNameSchema, rawHashSchema, rawHashNameSchema, rawMemoryFamilySchema, toRawSchema, toRawNameSchema, reinterpretSchema, reinterpretNameSchema, byteOffsetSchema, byteOffsetNameSchema, rawToIntegerSchema, rawToIntegerNameSchema, integerToRawSchema, integerToRawNameSchema, keepAliveSchema, keepAliveFamilySchema, hirIntegerOperandCaptureSchema, runtimeBaseSchema, signednessSchema, integerWidthSchema, hirAddressIntegerCaptureSchema, address32Schema, address64Schema, width32Schema, width64Schema, numberBaseSchema, bigintBaseSchema, unsignedSchema };
}
