import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup3 } from "./text-read-model.js";
export function createReadGroup3(readers: () => HirTextReaders): HirReadGroup3 {
  const record_90 = recordReader<Hir.HirFieldMarkerCapture>("HirFieldMarkerCapture", read => {
      const field_name = read("name", readers().scalar_string);
      const field_typeNode = read("typeNode", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_readonly = read("readonly", readers().scalar_boolean);
      return { fields: [field_name, field_typeNode, field_type, field_readonly], value: () => ({ name: field_name.value(), typeNode: field_typeNode.value(), type: field_type.value(), readonly: field_readonly.value() }) };
    });
  const record_91 = recordReader<{ readonly typeNode: Ids.SourceNodeRef; readonly type: Hir.CapturedFact<Ids.TyId>; }>("Record", read => {
      const field_typeNode = read("typeNode", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      return { fields: [field_typeNode, field_type], value: () => ({ typeNode: field_typeNode.value(), type: field_type.value() }) };
    });
  const record_92 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirPointerTypeCapture | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirPointerTypeCapture | null>(() => [readers().scalar_null, readers().record_93, readers().record_94, readers().record_96, readers().record_97]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_93 = recordReader<{ readonly kind: "raw-address"; }>("raw-address", () => {

      return { fields: [], value: () => ({ kind: "raw-address" }) };
    });
  const record_94 = recordReader<{ readonly kind: "typed-location"; readonly pointee: Hir.HirCapturedType; readonly mutability: "readonly" | "readwrite" | "unspecified"; }>("typed-location", read => {
      const field_pointee = read("pointee", readers().record_95);
      const field_mutability = read("mutability", readers().literal_36);
      return { fields: [field_pointee, field_mutability], value: () => ({ kind: "typed-location", pointee: field_pointee.value(), mutability: field_mutability.value() }) };
    });
  const record_95 = recordReader<Hir.HirCapturedType>("HirCapturedType", read => {
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      const field_component = read("component", readers().record_43);
      return { fields: [field_type, field_component], value: () => ({ type: field_type.value(), component: field_component.value() }) };
    });
  const record_96 = recordReader<{ readonly kind: "native-pointer"; readonly declaration: Ids.DefId; }>("native-pointer", read => {
      const field_declaration = read("declaration", readers().identity_def);
      return { fields: [field_declaration], value: () => ({ kind: "native-pointer", declaration: field_declaration.value() }) };
    });
  const record_97 = recordReader<{ readonly kind: "function-pointer"; readonly declaration: Ids.DefId; readonly parameters: readonly Hir.HirCapturedType[]; readonly result: Hir.HirCapturedType; readonly abi: readonly string[]; }>("function-pointer", read => {
      const field_declaration = read("declaration", readers().identity_def);
      const field_parameters = read("parameters", sequenceReader(readers().record_95));
      const field_result = read("result", readers().record_95);
      const field_abi = read("abi", sequenceReader(readers().scalar_string));
      return { fields: [field_declaration, field_parameters, field_result, field_abi], value: () => ({ kind: "function-pointer", declaration: field_declaration.value(), parameters: field_parameters.value(), result: field_result.value(), abi: field_abi.value() }) };
    });
  const record_98 = recordReader<{ readonly kind: "available"; readonly value: Hir.HirPointerOperationCapture | null; }>("available", read => {
      const field_value = read("value", unionReader<Hir.HirPointerOperationCapture | null>(() => [readers().scalar_null, unionReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>(() => [readers().record_99, readers().record_100, readers().record_101, readers().record_102, readers().record_103, readers().record_104, readers().record_105, readers().record_106]), readers().record_107, readers().record_108, readers().record_109, readers().record_110, readers().record_111, readers().record_112, readers().record_113, readers().record_114, readers().record_115, readers().record_116, readers().record_118, readers().record_121, readers().record_122]));
      return { fields: [field_value], value: () => ({ kind: "available", value: field_value.value() }) };
    });
  const record_99 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_38);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_100 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_41);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_101 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_42);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_102 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_43);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_103 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_44);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_104 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_45);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_105 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_46);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_106 = recordReader<{ readonly family: "typed-location"; readonly operation: "address-of" | "allocate" | "bind-pointer" | "equal-pointer" | "hash-pointer" | "load" | "project-pointer" | "store"; readonly exportName: string; readonly arguments: readonly Ids.SourceNodeRef[]; readonly typeArguments: readonly Ids.SourceNodeRef[]; readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited"; readonly pointee: "available" | "missing" | "not-applicable" | "unvisited" }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_47);
      const field_exportName = read("exportName", readers().scalar_string);
      const field_arguments = read("arguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_typeArguments = read("typeArguments", sequenceReader(unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7])));
      const field_selection = read("selection", readers().literal_39);
      const field_pointee = read("pointee", readers().literal_40);
      return { fields: [field_family, field_operation, field_exportName, field_arguments, field_typeArguments, field_selection, field_pointee], value: () => ({ family: field_family.value(), operation: field_operation.value(), exportName: field_exportName.value(), arguments: field_arguments.value(), typeArguments: field_typeArguments.value(), selection: field_selection.value(), pointee: field_pointee.value() }) };
    });
  const record_107 = recordReader<{ readonly family: "typed-location"; readonly operation: "view"; readonly pointer: Ids.SourceNodeRef; readonly read: Ids.SourceNodeRef; readonly write: Ids.SourceNodeRef; readonly optional: boolean; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_37);
      const field_operation = read("operation", readers().literal_48);
      const field_pointer = read("pointer", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_read = read("read", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_write = read("write", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_optional = read("optional", readers().scalar_boolean);
      return { fields: [field_family, field_operation, field_pointer, field_read, field_write, field_optional], value: () => ({ family: field_family.value(), operation: field_operation.value(), pointer: field_pointer.value(), read: field_read.value(), write: field_write.value(), optional: field_optional.value() }) };
    });
  const record_108 = recordReader<{ readonly family: "native-pointer"; readonly operation: "load"; readonly pointer: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_49);
      const field_operation = read("operation", readers().literal_50);
      const field_pointer = read("pointer", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_pointer], value: () => ({ family: field_family.value(), operation: field_operation.value(), pointer: field_pointer.value() }) };
    });
  const record_109 = recordReader<{ readonly family: "native-pointer"; readonly operation: "store"; readonly pointer: Ids.SourceNodeRef; readonly value: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_49);
      const field_operation = read("operation", readers().literal_51);
      const field_pointer = read("pointer", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_value = read("value", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_pointer, field_value], value: () => ({ family: field_family.value(), operation: field_operation.value(), pointer: field_pointer.value(), value: field_value.value() }) };
    });
  const record_110 = recordReader<{ readonly family: "native-pointer"; readonly operation: "offset"; readonly pointer: Ids.SourceNodeRef; readonly offset: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_49);
      const field_operation = read("operation", readers().literal_52);
      const field_pointer = read("pointer", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_offset = read("offset", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_pointer, field_offset], value: () => ({ family: field_family.value(), operation: field_operation.value(), pointer: field_pointer.value(), offset: field_offset.value() }) };
    });
  const record_111 = recordReader<{ readonly family: "raw-address"; readonly operation: "bind-raw-pointer"; readonly identity: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_53);
      const field_operation = read("operation", readers().literal_54);
      const field_identity = read("identity", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_identity], value: () => ({ family: field_family.value(), operation: field_operation.value(), identity: field_identity.value() }) };
    });
  const record_112 = recordReader<{ readonly family: "raw-address"; readonly operation: "equal-raw-pointer"; readonly left: Ids.SourceNodeRef; readonly right: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_53);
      const field_operation = read("operation", readers().literal_55);
      const field_left = read("left", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_right = read("right", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_left, field_right], value: () => ({ family: field_family.value(), operation: field_operation.value(), left: field_left.value(), right: field_right.value() }) };
    });
  const record_113 = recordReader<{ readonly family: "raw-address"; readonly operation: "hash-raw-pointer"; readonly pointer: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_53);
      const field_operation = read("operation", readers().literal_56);
      const field_pointer = read("pointer", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_pointer], value: () => ({ family: field_family.value(), operation: field_operation.value(), pointer: field_pointer.value() }) };
    });
  const record_114 = recordReader<{ readonly family: "raw-memory"; readonly operation: "to-raw"; readonly pointer: Ids.SourceNodeRef; readonly layout: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_57);
      const field_operation = read("operation", readers().literal_58);
      const field_pointer = read("pointer", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_layout = read("layout", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_pointer, field_layout], value: () => ({ family: field_family.value(), operation: field_operation.value(), pointer: field_pointer.value(), layout: field_layout.value() }) };
    });
  const record_115 = recordReader<{ readonly family: "raw-memory"; readonly operation: "reinterpret"; readonly raw: Ids.SourceNodeRef; readonly layout: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_57);
      const field_operation = read("operation", readers().literal_59);
      const field_raw = read("raw", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_layout = read("layout", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_raw, field_layout], value: () => ({ family: field_family.value(), operation: field_operation.value(), raw: field_raw.value(), layout: field_layout.value() }) };
    });
  const record_116 = recordReader<{ readonly family: "raw-memory"; readonly operation: "byte-offset"; readonly raw: Ids.SourceNodeRef; readonly offset: Ids.SourceNodeRef; readonly integer: Hir.HirIntegerOperandCapture; readonly dataLayout: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_57);
      const field_operation = read("operation", readers().literal_60);
      const field_raw = read("raw", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_offset = read("offset", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_integer = read("integer", readers().record_117);
      const field_dataLayout = read("dataLayout", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_raw, field_offset, field_integer, field_dataLayout], value: () => ({ family: field_family.value(), operation: field_operation.value(), raw: field_raw.value(), offset: field_offset.value(), integer: field_integer.value(), dataLayout: field_dataLayout.value() }) };
    });
  const record_117 = recordReader<Hir.HirIntegerOperandCapture>("HirIntegerOperandCapture", read => {
      const field_runtimeBase = read("runtimeBase", readers().literal_61);
      const field_signedness = read("signedness", readers().literal_62);
      const field_width = read("width", readers().literal_63);
      return { fields: [field_runtimeBase, field_signedness, field_width], value: () => ({ runtimeBase: field_runtimeBase.value(), signedness: field_signedness.value(), width: field_width.value() }) };
    });
  const record_118 = recordReader<{ readonly family: "raw-memory"; readonly operation: "raw-to-address-integer"; readonly raw: Ids.SourceNodeRef; readonly integer: Hir.HirAddressIntegerCapture; readonly dataLayout: Ids.SourceNodeRef; }>("HirPointerOperationCapture", read => {
      const field_family = read("family", readers().literal_57);
      const field_operation = read("operation", readers().literal_64);
      const field_raw = read("raw", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_integer = read("integer", unionReader<Hir.HirAddressIntegerCapture>(() => [readers().record_119, readers().record_120]));
      const field_dataLayout = read("dataLayout", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      return { fields: [field_family, field_operation, field_raw, field_integer, field_dataLayout], value: () => ({ family: field_family.value(), operation: field_operation.value(), raw: field_raw.value(), integer: field_integer.value(), dataLayout: field_dataLayout.value() }) };
    });
  const record_119 = recordReader<{ readonly width: 32; readonly runtimeBase: "number"; readonly signedness: "unsigned"; }>("HirAddressIntegerCapture", read => {
      const field_width = read("width", readers().literal_65);
      const field_runtimeBase = read("runtimeBase", readers().literal_66);
      const field_signedness = read("signedness", readers().literal_67);
      return { fields: [field_width, field_runtimeBase, field_signedness], value: () => ({ width: field_width.value(), runtimeBase: field_runtimeBase.value(), signedness: field_signedness.value() }) };
    });
  return { record_90, record_91, record_92, record_93, record_94, record_95, record_96, record_97, record_98, record_99, record_100, record_101, record_102, record_103, record_104, record_105, record_106, record_107, record_108, record_109, record_110, record_111, record_112, record_113, record_114, record_115, record_116, record_117, record_118, record_119 };
}
