import type {
  CompilerExtension,
  ExtensionImportBinding,
} from "@tsonic/tsts";
import {
  getTstsTypeReferenceName,
  visitTstsSubtree,
} from "@tsonic/tsts";
import type { NumericPrimitiveFact } from "../source-frontend/source-facts.js";
import { tsonicNumericPrimitiveFactKey } from "./fact-keys.js";

const coreTypesModules = new Set([
  "@tsonic/core/types.js",
  "@tsonic/core/types",
]);

const numericPrimitiveBySourceName = new Map<string, NumericPrimitiveFact>([
  [
    "bool",
    {
      sourceName: "bool",
      kind: "bool",
      runtimeBase: "boolean",
    },
  ],
  [
    "char",
    {
      sourceName: "char",
      kind: "char",
      runtimeBase: "string",
      width: 16,
    },
  ],
  [
    "sbyte",
    {
      sourceName: "sbyte",
      kind: "int8",
      runtimeBase: "number",
      signed: true,
      width: 8,
    },
  ],
  [
    "byte",
    {
      sourceName: "byte",
      kind: "uint8",
      runtimeBase: "number",
      signed: false,
      width: 8,
    },
  ],
  [
    "short",
    {
      sourceName: "short",
      kind: "int16",
      runtimeBase: "number",
      signed: true,
      width: 16,
    },
  ],
  [
    "ushort",
    {
      sourceName: "ushort",
      kind: "uint16",
      runtimeBase: "number",
      signed: false,
      width: 16,
    },
  ],
  [
    "int",
    {
      sourceName: "int",
      kind: "int32",
      runtimeBase: "number",
      signed: true,
      width: 32,
    },
  ],
  [
    "uint",
    {
      sourceName: "uint",
      kind: "uint32",
      runtimeBase: "number",
      signed: false,
      width: 32,
    },
  ],
  [
    "long",
    {
      sourceName: "long",
      kind: "int64",
      runtimeBase: "bigint",
      signed: true,
      width: 64,
    },
  ],
  [
    "ulong",
    {
      sourceName: "ulong",
      kind: "uint64",
      runtimeBase: "bigint",
      signed: false,
      width: 64,
    },
  ],
  [
    "nint",
    {
      sourceName: "nint",
      kind: "native-int",
      runtimeBase: "number",
      signed: true,
    },
  ],
  [
    "nuint",
    {
      sourceName: "nuint",
      kind: "native-uint",
      runtimeBase: "number",
      signed: false,
    },
  ],
  [
    "float",
    {
      sourceName: "float",
      kind: "float32",
      runtimeBase: "number",
      signed: true,
      width: 32,
    },
  ],
  [
    "double",
    {
      sourceName: "double",
      kind: "float64",
      runtimeBase: "number",
      signed: true,
      width: 64,
    },
  ],
  [
    "decimal",
    {
      sourceName: "decimal",
      kind: "decimal",
      runtimeBase: "decimal",
      signed: true,
      width: 128,
    },
  ],
]);

const isCoreTypesBinding = (binding: ExtensionImportBinding): boolean =>
  numericPrimitiveBySourceName.has(binding.importedName);

export const getNumericPrimitiveSourceNames = (): readonly string[] => [
  ...numericPrimitiveBySourceName.keys(),
];

export const createTsonicNumericPrimitiveExtension = (): CompilerExtension => ({
  id: "tsonic.numeric-primitives",
  afterParseSourceFile: (context): void => {
    const primitiveByLocalName = new Map<string, NumericPrimitiveFact>();
    for (const module of context.imports.modules) {
      if (!coreTypesModules.has(module.specifier)) continue;
      for (const binding of module.bindings) {
        if (!isCoreTypesBinding(binding)) continue;
        const primitive = numericPrimitiveBySourceName.get(binding.importedName);
        if (!primitive) continue;
        primitiveByLocalName.set(binding.localName, primitive);
      }
    }

    if (primitiveByLocalName.size === 0) return;

    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node) return;
      const typeName = getTstsTypeReferenceName(node);
      if (!typeName) return;
      const primitive = primitiveByLocalName.get(typeName);
      if (!primitive) return;
      context.facts.set(tsonicNumericPrimitiveFactKey, node, primitive);
    });
  },
});
