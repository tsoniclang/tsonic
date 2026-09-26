import {
  sourcePrimitive,
} from "@tsonic/tsts";
import type {
  SourceSemanticsModule,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "../identity.js";

const primitiveDeclarations = [
  sourcePrimitive("bool", "bool", "boolean"),
  sourcePrimitive("char", "char", "string", false, 16),
  sourcePrimitive("int8", "int8", "number", true, 8),
  sourcePrimitive("uint8", "uint8", "number", false, 8),
  sourcePrimitive("int16", "int16", "number", true, 16),
  sourcePrimitive("uint16", "uint16", "number", false, 16),
  sourcePrimitive("int32", "int32", "number", true, 32),
  sourcePrimitive("uint32", "uint32", "number", false, 32),
  sourcePrimitive("int64", "int64", "bigint", true, 64),
  sourcePrimitive("uint64", "uint64", "bigint", false, 64),
  sourcePrimitive("int128", "int128", "bigint", true, 128),
  sourcePrimitive("uint128", "uint128", "bigint", false, 128),
  sourcePrimitive("nativeInt", "native-int", "number", true),
  sourcePrimitive("nativeUint", "native-uint", "number", false),
  sourcePrimitive("float16", "float16", "number", true, 16),
  sourcePrimitive("float32", "float32", "number", true, 32),
  sourcePrimitive("float64", "float64", "number", true, 64),
  sourcePrimitive("decimal", "decimal", "number", true, 128),
] satisfies SourceSemanticsModule["exports"];

const typeMarkerDeclarations = [
  { kind: "type-marker", exportName: "Pointer", marker: "pointer" },
  { kind: "type-marker", exportName: "RawPointer", marker: "raw-pointer" },
  { kind: "type-marker", exportName: "FunctionPointer", marker: "function-pointer" },
  { kind: "type-marker", exportName: "FixedArray", marker: "fixed-array" },
] satisfies SourceSemanticsModule["exports"];

const callMarkerDeclarations = [
  { kind: "call-marker", exportName: "writeonlyref", marker: "write-only-reference" },
  { kind: "call-marker", exportName: "readwriteref", marker: "read-write-reference" },
  { kind: "call-marker", exportName: "readonlyref", marker: "read-only-reference" },
  { kind: "call-marker", exportName: "sharedborrow", marker: "shared-borrow" },
  { kind: "call-marker", exportName: "mutableborrow", marker: "mutable-borrow" },
  { kind: "call-marker", exportName: "move", marker: "move" },
  { kind: "call-marker", exportName: "struct", marker: "struct" },
  { kind: "call-marker", exportName: "field", marker: "field" },
  { kind: "call-marker", exportName: "attribute", marker: "attribute" },
  { kind: "call-marker", exportName: "defaultvalue", marker: "default-value" },
  { kind: "call-marker", exportName: "addressof", marker: "address-of" },
  { kind: "call-marker", exportName: "allocateptr", marker: "allocate" },
  { kind: "call-marker", exportName: "loadptr", marker: "load" },
  { kind: "call-marker", exportName: "storeptr", marker: "store" },
  { kind: "call-marker", exportName: "equalptr", marker: "equal-pointer" },
  { kind: "call-marker", exportName: "hashptr", marker: "hash-pointer" },
  { kind: "call-marker", exportName: "bindptr", marker: "bind-pointer" },
  { kind: "call-marker", exportName: "projectptr", marker: "project-pointer" },
  { kind: "call-marker", exportName: "equalrawptr", marker: "equal-raw-pointer" },
  { kind: "call-marker", exportName: "hashrawptr", marker: "hash-raw-pointer" },
] satisfies SourceSemanticsModule["exports"];

export function tsonicCoreSourceSemanticsModules(): readonly SourceSemanticsModule[] {
  return [
    {
      moduleSpecifier: tsonicCoreTypesModule,
      packageName: "@tsonic/core",
      subpath: "types.js",
      capabilities: ["primitive", "type-marker"],
      exports: [...primitiveDeclarations, ...typeMarkerDeclarations],
    },
    {
      moduleSpecifier: tsonicCoreLangModule,
      packageName: "@tsonic/core",
      subpath: "lang.js",
      capabilities: ["call-marker"],
      exports: callMarkerDeclarations,
    },
  ];
}
