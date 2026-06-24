import {
  sourcePrimitive,
} from "@tsonic/tsts";
import type {
  SourceSemanticsModule,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "./identity.js";

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

const markerDeclarations = [
  { kind: "call-marker", exportName: "out", marker: "out" },
  { kind: "call-marker", exportName: "ref", marker: "ref" },
  { kind: "call-marker", exportName: "inref", marker: "inref" },
  { kind: "call-marker", exportName: "borrow", marker: "borrow" },
  { kind: "call-marker", exportName: "borrowMut", marker: "borrowMut" },
  { kind: "call-marker", exportName: "move", marker: "move" },
  { kind: "call-marker", exportName: "struct", marker: "struct" },
  { kind: "call-marker", exportName: "field", marker: "field" },
  { kind: "call-marker", exportName: "attribute", marker: "attribute" },
  { kind: "call-marker", exportName: "defaultof", marker: "defaultof" },
  { kind: "type-marker", exportName: "ptr", marker: "ptr" },
  { kind: "type-marker", exportName: "fnptr", marker: "fnptr" },
] satisfies SourceSemanticsModule["exports"];

export function tsonicCoreSourceSemanticsModules(): readonly SourceSemanticsModule[] {
  return [
    {
      moduleSpecifier: tsonicCoreTypesModule,
      packageName: "@tsonic/core",
      subpath: "types.js",
      capabilities: ["primitive"],
      exports: primitiveDeclarations,
    },
    {
      moduleSpecifier: tsonicCoreLangModule,
      packageName: "@tsonic/core",
      subpath: "lang.js",
      capabilities: ["call-marker", "type-marker"],
      exports: markerDeclarations,
    },
  ];
}
