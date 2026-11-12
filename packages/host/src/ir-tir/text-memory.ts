import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  SourceNodeRef
} from "../ids/contract.js";
import type {
  CapturedFact, HirAddressIntegerCapture, HirCapturedType, HirIntegerOperandCapture, HirPointerOperationCapture, HirPointerTypeCapture
} from "../ir-hir/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { referenceWork, scalarWork, nullableWork, sequenceWork } from "./text-layouts.js";

export interface MemoryTextReads {
  readonly work_HirCapturedType: TirRecordCodec<HirCapturedType>;
  readonly work_SourceNodeRef: TirRecordCodec<SourceNodeRef>;
}

export interface MemoryTextModel {
  readonly work_HirPointerTypeCapture_raw_address: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "raw-address" }>;
  readonly work_HirPointerTypeCapture_typed_location: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "typed-location" }>;
  readonly work_HirPointerTypeCapture_native_pointer: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "native-pointer" }>;
  readonly work_HirPointerTypeCapture_function_pointer: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "function-pointer" }>;
  readonly work_HirIntegerOperandCapture: TirRecordCodec<HirIntegerOperandCapture>;
  readonly work_HirAddressIntegerCapture_width_32: TirRecordCodec<HirAddressIntegerCapture & { readonly width: 32 }>;
  readonly work_HirAddressIntegerCapture_width_64: TirRecordCodec<HirAddressIntegerCapture & { readonly width: 64 }>;
  readonly work_HirPointerOperationCapture_family_typed_location: TirRecordCodec<HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" }>;
  readonly work_HirPointerOperationCapture_operation_view: TirRecordCodec<HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "view" }>;
  readonly work_HirPointerOperationCapture_operation_load: TirRecordCodec<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "load" }>;
  readonly work_HirPointerOperationCapture_operation_store: TirRecordCodec<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "store" }>;
  readonly work_HirPointerOperationCapture_operation_offset: TirRecordCodec<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "offset" }>;
  readonly work_HirPointerOperationCapture_operation_bind_raw_pointer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "bind-raw-pointer" }>;
  readonly work_HirPointerOperationCapture_operation_equal_raw_pointer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "equal-raw-pointer" }>;
  readonly work_HirPointerOperationCapture_operation_hash_raw_pointer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "hash-raw-pointer" }>;
  readonly work_HirPointerOperationCapture_operation_to_raw: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "to-raw" }>;
  readonly work_HirPointerOperationCapture_operation_reinterpret: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "reinterpret" }>;
  readonly work_HirPointerOperationCapture_operation_byte_offset: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "byte-offset" }>;
  readonly work_HirPointerOperationCapture_operation_raw_to_address_integer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer" }>;
  readonly work_HirPointerOperationCapture_operation_address_integer_to_raw: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw" }>;
  readonly work_HirPointerOperationCapture_operation_keep_alive: TirRecordCodec<HirPointerOperationCapture & { readonly family: "keep-alive"; readonly operation: "keep-alive" }>;
  readonly work_HirPointerTypeCapture: TirRecordCodec<HirPointerTypeCapture>;
  readonly work_HirAddressIntegerCapture: TirRecordCodec<HirAddressIntegerCapture>;
  readonly work_HirPointerOperationCapture: TirRecordCodec<HirPointerOperationCapture>;
  readonly work_C__HirPointerTypeCapture__available: TirRecordCodec<CapturedFact<HirPointerTypeCapture | null> & { readonly kind: "available" }>;
  readonly work_C__HirPointerTypeCapture__unavailable: TirRecordCodec<CapturedFact<HirPointerTypeCapture | null> & { readonly kind: "unavailable" }>;
  readonly work_C__HirPointerTypeCapture_: TirRecordCodec<CapturedFact<HirPointerTypeCapture | null>>;
  readonly work_C__HirPointerOperationCapture__available: TirRecordCodec<CapturedFact<HirPointerOperationCapture | null> & { readonly kind: "available" }>;
  readonly work_C__HirPointerOperationCapture__unavailable: TirRecordCodec<CapturedFact<HirPointerOperationCapture | null> & { readonly kind: "unavailable" }>;
  readonly work_C__HirPointerOperationCapture_: TirRecordCodec<CapturedFact<HirPointerOperationCapture | null>>;
}

export const createMemoryText = (kernel: TirTextKernel, read: MemoryTextReads): MemoryTextModel => {
  const { defineRecord, booleanReader, definitionReader, stringReader } = kernel;
  const work_HirPointerTypeCapture_raw_address: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "raw-address" }> = defineRecord<HirPointerTypeCapture & { readonly kind: "raw-address" }>("HirPointerTypeCapture#raw-address", "HirPointerTypeCapture", { field: "kind", value: "raw-address" }, "raw-address", null, null, fields => fields
    .finish(() => ({ kind: "raw-address" })));
  const work_HirPointerTypeCapture_typed_location: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "typed-location" }> = defineRecord<HirPointerTypeCapture & { readonly kind: "typed-location" }>("HirPointerTypeCapture#typed-location", "HirPointerTypeCapture", { field: "kind", value: "typed-location" }, "typed-location", null, null, fields => fields
    .field("pointee", "HirCapturedType", value => read.work_HirCapturedType.write(value.pointee), lazyReader(() => read.work_HirCapturedType.reader))
    .field("mutability", "Mutability", value => scalarWork("Mutability", value.mutability), literalReader<(HirPointerTypeCapture & { readonly kind: "typed-location" })["mutability"]>("Mutability", ["readonly","readwrite","unspecified"]))
    .finish((field_pointee, field_mutability) => ({ kind: "typed-location", pointee: field_pointee, mutability: field_mutability })));
  const work_HirPointerTypeCapture_native_pointer: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "native-pointer" }> = defineRecord<HirPointerTypeCapture & { readonly kind: "native-pointer" }>("HirPointerTypeCapture#native-pointer", "HirPointerTypeCapture", { field: "kind", value: "native-pointer" }, "native-pointer", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .finish((field_declaration) => ({ kind: "native-pointer", declaration: field_declaration })));
  const work_HirPointerTypeCapture_function_pointer: TirRecordCodec<HirPointerTypeCapture & { readonly kind: "function-pointer" }> = defineRecord<HirPointerTypeCapture & { readonly kind: "function-pointer" }>("HirPointerTypeCapture#function-pointer", "HirPointerTypeCapture", { field: "kind", value: "function-pointer" }, "function-pointer", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("parameters", "[HirCapturedType]", value => sequenceWork("[HirCapturedType]", value.parameters, actual => read.work_HirCapturedType.write(actual)), sequenceReader("[HirCapturedType]", lazyReader(() => read.work_HirCapturedType.reader)))
    .field("result", "HirCapturedType", value => read.work_HirCapturedType.write(value.result), lazyReader(() => read.work_HirCapturedType.reader))
    .field("abi", "[string]", value => sequenceWork("[string]", value.abi, actual => scalarWork("string", actual)), sequenceReader("[string]", stringReader))
    .finish((field_declaration, field_parameters, field_result, field_abi) => ({ kind: "function-pointer", declaration: field_declaration, parameters: field_parameters, result: field_result, abi: field_abi })));
  const work_HirIntegerOperandCapture: TirRecordCodec<HirIntegerOperandCapture> = defineRecord<HirIntegerOperandCapture>("HirIntegerOperandCapture", "HirIntegerOperandCapture", null, "HirIntegerOperandCapture", null, null, fields => fields
    .field("runtimeBase", "RuntimeBase", value => scalarWork("RuntimeBase", value.runtimeBase), literalReader<(HirIntegerOperandCapture)["runtimeBase"]>("RuntimeBase", ["number","bigint"]))
    .field("signedness", "Signedness", value => scalarWork("Signedness", value.signedness), literalReader<(HirIntegerOperandCapture)["signedness"]>("Signedness", ["signed","unsigned"]))
    .field("width", "IntegerWidth", value => scalarWork("IntegerWidth", value.width), literalReader<(HirIntegerOperandCapture)["width"]>("IntegerWidth", [8,16,32,64,128]))
    .finish((field_runtimeBase, field_signedness, field_width) => ({ runtimeBase: field_runtimeBase, signedness: field_signedness, width: field_width })));
  const work_HirAddressIntegerCapture_width_32: TirRecordCodec<HirAddressIntegerCapture & { readonly width: 32 }> = defineRecord<HirAddressIntegerCapture & { readonly width: 32 }>("HirAddressIntegerCapture@width=32", "HirAddressIntegerCapture", { field: "width", value: "32" }, "HirAddressIntegerCapture", null, null, fields => fields
    .field("width", "32", value => scalarWork("32", value.width), literalReader<(HirAddressIntegerCapture & { readonly width: 32 })["width"]>("32", [32]))
    .field("runtimeBase", "'number", value => scalarWork("'number", value.runtimeBase), literalReader<(HirAddressIntegerCapture & { readonly width: 32 })["runtimeBase"]>("'number", ["number"]))
    .field("signedness", "'unsigned", value => scalarWork("'unsigned", value.signedness), literalReader<(HirAddressIntegerCapture & { readonly width: 32 })["signedness"]>("'unsigned", ["unsigned"]))
    .finish((field_width, field_runtimeBase, field_signedness) => ({ width: field_width, runtimeBase: field_runtimeBase, signedness: field_signedness })));
  const work_HirAddressIntegerCapture_width_64: TirRecordCodec<HirAddressIntegerCapture & { readonly width: 64 }> = defineRecord<HirAddressIntegerCapture & { readonly width: 64 }>("HirAddressIntegerCapture@width=64", "HirAddressIntegerCapture", { field: "width", value: "64" }, "HirAddressIntegerCapture", null, null, fields => fields
    .field("width", "64", value => scalarWork("64", value.width), literalReader<(HirAddressIntegerCapture & { readonly width: 64 })["width"]>("64", [64]))
    .field("runtimeBase", "'bigint", value => scalarWork("'bigint", value.runtimeBase), literalReader<(HirAddressIntegerCapture & { readonly width: 64 })["runtimeBase"]>("'bigint", ["bigint"]))
    .field("signedness", "'unsigned", value => scalarWork("'unsigned", value.signedness), literalReader<(HirAddressIntegerCapture & { readonly width: 64 })["signedness"]>("'unsigned", ["unsigned"]))
    .finish((field_width, field_runtimeBase, field_signedness) => ({ width: field_width, runtimeBase: field_runtimeBase, signedness: field_signedness })));
  const work_HirPointerOperationCapture_family_typed_location: TirRecordCodec<HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" }> = defineRecord<HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" }>("HirPointerOperationCapture@family=typed-location", "HirPointerOperationCapture", { field: "family", value: "typed-location" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'typed-location", value => scalarWork("'typed-location", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" })["family"]>("'typed-location", ["typed-location"]))
    .field("operation", "LocationOperation", value => scalarWork("LocationOperation", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" })["operation"]>("LocationOperation", ["address-of","allocate","load","store","equal-pointer","hash-pointer","bind-pointer","project-pointer"]))
    .field("exportName", "string", value => scalarWork("string", value.exportName), stringReader)
    .field("arguments", "[SourceNodeRef]", value => sequenceWork("[SourceNodeRef]", value.arguments, actual => read.work_SourceNodeRef.write(actual)), sequenceReader("[SourceNodeRef]", lazyReader(() => read.work_SourceNodeRef.reader)))
    .field("typeArguments", "[SourceNodeRef]", value => sequenceWork("[SourceNodeRef]", value.typeArguments, actual => read.work_SourceNodeRef.write(actual)), sequenceReader("[SourceNodeRef]", lazyReader(() => read.work_SourceNodeRef.reader)))
    .field("selection", "CaptureSelection", value => scalarWork("CaptureSelection", value.selection), literalReader<(HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" })["selection"]>("CaptureSelection", ["applicable","conditional-candidates","untyped","unvisited"]))
    .field("pointee", "CapturePointee", value => scalarWork("CapturePointee", value.pointee), literalReader<(HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer" })["pointee"]>("CapturePointee", ["available","unvisited","not-applicable","missing"]))
    .finish((field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee) => ({
      family: field_family, operation: field_operation, exportName: field_exportName, arguments: field_arguments,
      typeArguments: field_typeArguments, selection: field_selection, pointee: field_pointee,
    })));
  const work_HirPointerOperationCapture_operation_view: TirRecordCodec<HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "view" }> = defineRecord<HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "view" }>("HirPointerOperationCapture@operation=view", "HirPointerOperationCapture", { field: "operation", value: "view" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'typed-location", value => scalarWork("'typed-location", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "view" })["family"]>("'typed-location", ["typed-location"]))
    .field("operation", "'view", value => scalarWork("'view", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "typed-location"; readonly operation: "view" })["operation"]>("'view", ["view"]))
    .field("pointer", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.pointer), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("read", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.read), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("write", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.write), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("optional", "boolean", value => scalarWork("boolean", value.optional), booleanReader)
    .finish((field_family, field_operation, field_pointer, field_read, field_write, field_optional) => ({
      family: field_family, operation: field_operation, pointer: field_pointer, read: field_read, write: field_write,
      optional: field_optional,
    })));
  const work_HirPointerOperationCapture_operation_load: TirRecordCodec<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "load" }> = defineRecord<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "load" }>("HirPointerOperationCapture@operation=load", "HirPointerOperationCapture", { field: "operation", value: "load" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'native-pointer", value => scalarWork("'native-pointer", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "load" })["family"]>("'native-pointer", ["native-pointer"]))
    .field("operation", "'load", value => scalarWork("'load", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "load" })["operation"]>("'load", ["load"]))
    .field("pointer", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.pointer), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_pointer) => ({ family: field_family, operation: field_operation, pointer: field_pointer })));
  const work_HirPointerOperationCapture_operation_store: TirRecordCodec<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "store" }> = defineRecord<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "store" }>("HirPointerOperationCapture@operation=store", "HirPointerOperationCapture", { field: "operation", value: "store" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'native-pointer", value => scalarWork("'native-pointer", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "store" })["family"]>("'native-pointer", ["native-pointer"]))
    .field("operation", "'store", value => scalarWork("'store", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "store" })["operation"]>("'store", ["store"]))
    .field("pointer", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.pointer), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("value", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.value), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_pointer, field_value) => ({ family: field_family, operation: field_operation, pointer: field_pointer, value: field_value })));
  const work_HirPointerOperationCapture_operation_offset: TirRecordCodec<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "offset" }> = defineRecord<HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "offset" }>("HirPointerOperationCapture@operation=offset", "HirPointerOperationCapture", { field: "operation", value: "offset" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'native-pointer", value => scalarWork("'native-pointer", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "offset" })["family"]>("'native-pointer", ["native-pointer"]))
    .field("operation", "'offset", value => scalarWork("'offset", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "native-pointer"; readonly operation: "offset" })["operation"]>("'offset", ["offset"]))
    .field("pointer", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.pointer), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("offset", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.offset), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_pointer, field_offset) => ({ family: field_family, operation: field_operation, pointer: field_pointer, offset: field_offset })));
  const work_HirPointerOperationCapture_operation_bind_raw_pointer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "bind-raw-pointer" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "bind-raw-pointer" }>("HirPointerOperationCapture@operation=bind-raw-pointer", "HirPointerOperationCapture", { field: "operation", value: "bind-raw-pointer" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-address", value => scalarWork("'raw-address", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "bind-raw-pointer" })["family"]>("'raw-address", ["raw-address"]))
    .field("operation", "'bind-raw-pointer", value => scalarWork("'bind-raw-pointer", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "bind-raw-pointer" })["operation"]>("'bind-raw-pointer", ["bind-raw-pointer"]))
    .field("identity", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.identity), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_identity) => ({ family: field_family, operation: field_operation, identity: field_identity })));
  const work_HirPointerOperationCapture_operation_equal_raw_pointer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "equal-raw-pointer" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "equal-raw-pointer" }>("HirPointerOperationCapture@operation=equal-raw-pointer", "HirPointerOperationCapture", { field: "operation", value: "equal-raw-pointer" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-address", value => scalarWork("'raw-address", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "equal-raw-pointer" })["family"]>("'raw-address", ["raw-address"]))
    .field("operation", "'equal-raw-pointer", value => scalarWork("'equal-raw-pointer", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "equal-raw-pointer" })["operation"]>("'equal-raw-pointer", ["equal-raw-pointer"]))
    .field("left", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.left), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("right", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.right), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_left, field_right) => ({ family: field_family, operation: field_operation, left: field_left, right: field_right })));
  const work_HirPointerOperationCapture_operation_hash_raw_pointer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "hash-raw-pointer" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "hash-raw-pointer" }>("HirPointerOperationCapture@operation=hash-raw-pointer", "HirPointerOperationCapture", { field: "operation", value: "hash-raw-pointer" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-address", value => scalarWork("'raw-address", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "hash-raw-pointer" })["family"]>("'raw-address", ["raw-address"]))
    .field("operation", "'hash-raw-pointer", value => scalarWork("'hash-raw-pointer", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-address"; readonly operation: "hash-raw-pointer" })["operation"]>("'hash-raw-pointer", ["hash-raw-pointer"]))
    .field("pointer", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.pointer), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_pointer) => ({ family: field_family, operation: field_operation, pointer: field_pointer })));
  const work_HirPointerOperationCapture_operation_to_raw: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "to-raw" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "to-raw" }>("HirPointerOperationCapture@operation=to-raw", "HirPointerOperationCapture", { field: "operation", value: "to-raw" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-memory", value => scalarWork("'raw-memory", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "to-raw" })["family"]>("'raw-memory", ["raw-memory"]))
    .field("operation", "'to-raw", value => scalarWork("'to-raw", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "to-raw" })["operation"]>("'to-raw", ["to-raw"]))
    .field("pointer", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.pointer), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("layout", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.layout), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_pointer, field_layout) => ({ family: field_family, operation: field_operation, pointer: field_pointer, layout: field_layout })));
  const work_HirPointerOperationCapture_operation_reinterpret: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "reinterpret" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "reinterpret" }>("HirPointerOperationCapture@operation=reinterpret", "HirPointerOperationCapture", { field: "operation", value: "reinterpret" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-memory", value => scalarWork("'raw-memory", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "reinterpret" })["family"]>("'raw-memory", ["raw-memory"]))
    .field("operation", "'reinterpret", value => scalarWork("'reinterpret", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "reinterpret" })["operation"]>("'reinterpret", ["reinterpret"]))
    .field("raw", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.raw), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("layout", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.layout), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_raw, field_layout) => ({ family: field_family, operation: field_operation, raw: field_raw, layout: field_layout })));
  const work_HirPointerOperationCapture_operation_byte_offset: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "byte-offset" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "byte-offset" }>("HirPointerOperationCapture@operation=byte-offset", "HirPointerOperationCapture", { field: "operation", value: "byte-offset" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-memory", value => scalarWork("'raw-memory", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "byte-offset" })["family"]>("'raw-memory", ["raw-memory"]))
    .field("operation", "'byte-offset", value => scalarWork("'byte-offset", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "byte-offset" })["operation"]>("'byte-offset", ["byte-offset"]))
    .field("raw", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.raw), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("offset", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.offset), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("integer", "HirIntegerOperandCapture", value => work_HirIntegerOperandCapture.write(value.integer), lazyReader(() => work_HirIntegerOperandCapture.reader))
    .field("dataLayout", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.dataLayout), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_raw, field_offset, field_integer, field_dataLayout) => ({
      family: field_family, operation: field_operation, raw: field_raw, offset: field_offset, integer: field_integer,
      dataLayout: field_dataLayout,
    })));
  const work_HirPointerOperationCapture_operation_raw_to_address_integer: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer" }>("HirPointerOperationCapture@operation=raw-to-address-integer", "HirPointerOperationCapture", { field: "operation", value: "raw-to-address-integer" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-memory", value => scalarWork("'raw-memory", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer" })["family"]>("'raw-memory", ["raw-memory"]))
    .field("operation", "'raw-to-address-integer", value => scalarWork("'raw-to-address-integer", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "raw-to-address-integer" })["operation"]>("'raw-to-address-integer", ["raw-to-address-integer"]))
    .field("raw", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.raw), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("integer", "HirAddressIntegerCapture", value => work_HirAddressIntegerCapture.write(value.integer), lazyReader(() => work_HirAddressIntegerCapture.reader))
    .field("dataLayout", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.dataLayout), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_raw, field_integer, field_dataLayout) => ({ family: field_family, operation: field_operation, raw: field_raw, integer: field_integer, dataLayout: field_dataLayout })));
  const work_HirPointerOperationCapture_operation_address_integer_to_raw: TirRecordCodec<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw" }> = defineRecord<HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw" }>("HirPointerOperationCapture@operation=address-integer-to-raw", "HirPointerOperationCapture", { field: "operation", value: "address-integer-to-raw" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'raw-memory", value => scalarWork("'raw-memory", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw" })["family"]>("'raw-memory", ["raw-memory"]))
    .field("operation", "'address-integer-to-raw", value => scalarWork("'address-integer-to-raw", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "raw-memory"; readonly operation: "address-integer-to-raw" })["operation"]>("'address-integer-to-raw", ["address-integer-to-raw"]))
    .field("address", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.address), lazyReader(() => read.work_SourceNodeRef.reader))
    .field("integer", "HirAddressIntegerCapture", value => work_HirAddressIntegerCapture.write(value.integer), lazyReader(() => work_HirAddressIntegerCapture.reader))
    .field("dataLayout", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.dataLayout), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_address, field_integer, field_dataLayout) => ({ family: field_family, operation: field_operation, address: field_address, integer: field_integer, dataLayout: field_dataLayout })));
  const work_HirPointerOperationCapture_operation_keep_alive: TirRecordCodec<HirPointerOperationCapture & { readonly family: "keep-alive"; readonly operation: "keep-alive" }> = defineRecord<HirPointerOperationCapture & { readonly family: "keep-alive"; readonly operation: "keep-alive" }>("HirPointerOperationCapture@operation=keep-alive", "HirPointerOperationCapture", { field: "operation", value: "keep-alive" }, "HirPointerOperationCapture", null, null, fields => fields
    .field("family", "'keep-alive", value => scalarWork("'keep-alive", value.family), literalReader<(HirPointerOperationCapture & { readonly family: "keep-alive"; readonly operation: "keep-alive" })["family"]>("'keep-alive", ["keep-alive"]))
    .field("operation", "'keep-alive", value => scalarWork("'keep-alive", value.operation), literalReader<(HirPointerOperationCapture & { readonly family: "keep-alive"; readonly operation: "keep-alive" })["operation"]>("'keep-alive", ["keep-alive"]))
    .field("value", "SourceNodeRef", value => read.work_SourceNodeRef.write(value.value), lazyReader(() => read.work_SourceNodeRef.reader))
    .finish((field_family, field_operation, field_value) => ({ family: field_family, operation: field_operation, value: field_value })));
  const work_HirPointerTypeCapture: TirRecordCodec<HirPointerTypeCapture> = unionRecord<HirPointerTypeCapture>("HirPointerTypeCapture", (value: HirPointerTypeCapture): TirTypedRecordWork => {
    switch (value.kind) {
      case "raw-address": return work_HirPointerTypeCapture_raw_address.write(value);
      case "typed-location": return work_HirPointerTypeCapture_typed_location.write(value);
      case "native-pointer": return work_HirPointerTypeCapture_native_pointer.write(value);
      case "function-pointer": return work_HirPointerTypeCapture_function_pointer.write(value);
    }
  }, () => [work_HirPointerTypeCapture_raw_address.reader, work_HirPointerTypeCapture_typed_location.reader, work_HirPointerTypeCapture_native_pointer.reader, work_HirPointerTypeCapture_function_pointer.reader]);
  const work_HirAddressIntegerCapture: TirRecordCodec<HirAddressIntegerCapture> = unionRecord<HirAddressIntegerCapture>("HirAddressIntegerCapture", (value: HirAddressIntegerCapture): TirTypedRecordWork => {
    switch (value.width) {
      case 32: return work_HirAddressIntegerCapture_width_32.write(value);
      case 64: return work_HirAddressIntegerCapture_width_64.write(value);
    }
  }, () => [work_HirAddressIntegerCapture_width_32.reader, work_HirAddressIntegerCapture_width_64.reader]);
  const work_HirPointerOperationCapture: TirRecordCodec<HirPointerOperationCapture> = unionRecord<HirPointerOperationCapture>("HirPointerOperationCapture", (value: HirPointerOperationCapture): TirTypedRecordWork => {
    switch (value.family) {
      case "typed-location": switch (value.operation) {
        case "view": return work_HirPointerOperationCapture_operation_view.write(value);
        case "address-of": case "allocate": case "load": case "store": case "equal-pointer": case "hash-pointer": case "bind-pointer": case "project-pointer": return work_HirPointerOperationCapture_family_typed_location.write(value);
      }
      case "native-pointer": switch (value.operation) {
        case "load": return work_HirPointerOperationCapture_operation_load.write(value);
        case "store": return work_HirPointerOperationCapture_operation_store.write(value);
        case "offset": return work_HirPointerOperationCapture_operation_offset.write(value);
      }
      case "raw-address": switch (value.operation) {
        case "bind-raw-pointer": return work_HirPointerOperationCapture_operation_bind_raw_pointer.write(value);
        case "equal-raw-pointer": return work_HirPointerOperationCapture_operation_equal_raw_pointer.write(value);
        case "hash-raw-pointer": return work_HirPointerOperationCapture_operation_hash_raw_pointer.write(value);
      }
      case "raw-memory": switch (value.operation) {
        case "to-raw": return work_HirPointerOperationCapture_operation_to_raw.write(value);
        case "reinterpret": return work_HirPointerOperationCapture_operation_reinterpret.write(value);
        case "byte-offset": return work_HirPointerOperationCapture_operation_byte_offset.write(value);
        case "raw-to-address-integer": return work_HirPointerOperationCapture_operation_raw_to_address_integer.write(value);
        case "address-integer-to-raw": return work_HirPointerOperationCapture_operation_address_integer_to_raw.write(value);
      }
      case "keep-alive": return work_HirPointerOperationCapture_operation_keep_alive.write(value);
    }
  }, () => [work_HirPointerOperationCapture_operation_view.reader, work_HirPointerOperationCapture_family_typed_location.reader, work_HirPointerOperationCapture_operation_load.reader, work_HirPointerOperationCapture_operation_store.reader, work_HirPointerOperationCapture_operation_offset.reader, work_HirPointerOperationCapture_operation_bind_raw_pointer.reader, work_HirPointerOperationCapture_operation_equal_raw_pointer.reader, work_HirPointerOperationCapture_operation_hash_raw_pointer.reader, work_HirPointerOperationCapture_operation_to_raw.reader, work_HirPointerOperationCapture_operation_reinterpret.reader, work_HirPointerOperationCapture_operation_byte_offset.reader, work_HirPointerOperationCapture_operation_raw_to_address_integer.reader, work_HirPointerOperationCapture_operation_address_integer_to_raw.reader, work_HirPointerOperationCapture_operation_keep_alive.reader]);
  const work_C__HirPointerTypeCapture__available: TirRecordCodec<CapturedFact<HirPointerTypeCapture | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirPointerTypeCapture | null> & { readonly kind: "available" }>("C<?HirPointerTypeCapture>#available", "C<?HirPointerTypeCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?HirPointerTypeCapture", value => nullableWork(value.value, actual => work_HirPointerTypeCapture.write(actual)), nullableReader(lazyReader(() => work_HirPointerTypeCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirPointerTypeCapture__unavailable: TirRecordCodec<CapturedFact<HirPointerTypeCapture | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirPointerTypeCapture | null> & { readonly kind: "unavailable" }>("C<?HirPointerTypeCapture>#unavailable", "C<?HirPointerTypeCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirPointerTypeCapture | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirPointerTypeCapture_: TirRecordCodec<CapturedFact<HirPointerTypeCapture | null>> = unionRecord<CapturedFact<HirPointerTypeCapture | null>>("C<?HirPointerTypeCapture>", (value: CapturedFact<HirPointerTypeCapture | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirPointerTypeCapture__available.write(value);
      case "unavailable": return work_C__HirPointerTypeCapture__unavailable.write(value);
    }
  }, () => [work_C__HirPointerTypeCapture__available.reader, work_C__HirPointerTypeCapture__unavailable.reader]);
  const work_C__HirPointerOperationCapture__available: TirRecordCodec<CapturedFact<HirPointerOperationCapture | null> & { readonly kind: "available" }> = defineRecord<CapturedFact<HirPointerOperationCapture | null> & { readonly kind: "available" }>("C<?HirPointerOperationCapture>#available", "C<?HirPointerOperationCapture>", { field: "kind", value: "available" }, "available", null, null, fields => fields
    .field("value", "?HirPointerOperationCapture", value => nullableWork(value.value, actual => work_HirPointerOperationCapture.write(actual)), nullableReader(lazyReader(() => work_HirPointerOperationCapture.reader)))
    .finish((field_value) => ({ kind: "available", value: field_value })));
  const work_C__HirPointerOperationCapture__unavailable: TirRecordCodec<CapturedFact<HirPointerOperationCapture | null> & { readonly kind: "unavailable" }> = defineRecord<CapturedFact<HirPointerOperationCapture | null> & { readonly kind: "unavailable" }>("C<?HirPointerOperationCapture>#unavailable", "C<?HirPointerOperationCapture>", { field: "kind", value: "unavailable" }, "unavailable", null, null, fields => fields
    .field("reason", "CaptureUnavailable", value => scalarWork("CaptureUnavailable", value.reason), literalReader<(CapturedFact<HirPointerOperationCapture | null> & { readonly kind: "unavailable" })["reason"]>("CaptureUnavailable", ["checker-error","parameter-dependent","not-provided"]))
    .finish((field_reason) => ({ kind: "unavailable", reason: field_reason })));
  const work_C__HirPointerOperationCapture_: TirRecordCodec<CapturedFact<HirPointerOperationCapture | null>> = unionRecord<CapturedFact<HirPointerOperationCapture | null>>("C<?HirPointerOperationCapture>", (value: CapturedFact<HirPointerOperationCapture | null>): TirTypedRecordWork => {
    switch (value.kind) {
      case "available": return work_C__HirPointerOperationCapture__available.write(value);
      case "unavailable": return work_C__HirPointerOperationCapture__unavailable.write(value);
    }
  }, () => [work_C__HirPointerOperationCapture__available.reader, work_C__HirPointerOperationCapture__unavailable.reader]);
  return { work_HirPointerTypeCapture_raw_address, work_HirPointerTypeCapture_typed_location, work_HirPointerTypeCapture_native_pointer, work_HirPointerTypeCapture_function_pointer, work_HirIntegerOperandCapture, work_HirAddressIntegerCapture_width_32, work_HirAddressIntegerCapture_width_64, work_HirPointerOperationCapture_family_typed_location, work_HirPointerOperationCapture_operation_view, work_HirPointerOperationCapture_operation_load, work_HirPointerOperationCapture_operation_store, work_HirPointerOperationCapture_operation_offset, work_HirPointerOperationCapture_operation_bind_raw_pointer, work_HirPointerOperationCapture_operation_equal_raw_pointer, work_HirPointerOperationCapture_operation_hash_raw_pointer, work_HirPointerOperationCapture_operation_to_raw, work_HirPointerOperationCapture_operation_reinterpret, work_HirPointerOperationCapture_operation_byte_offset, work_HirPointerOperationCapture_operation_raw_to_address_integer, work_HirPointerOperationCapture_operation_address_integer_to_raw, work_HirPointerOperationCapture_operation_keep_alive, work_HirPointerTypeCapture, work_HirAddressIntegerCapture, work_HirPointerOperationCapture, work_C__HirPointerTypeCapture__available, work_C__HirPointerTypeCapture__unavailable, work_C__HirPointerTypeCapture_, work_C__HirPointerOperationCapture__available, work_C__HirPointerOperationCapture__unavailable, work_C__HirPointerOperationCapture_ };
};
