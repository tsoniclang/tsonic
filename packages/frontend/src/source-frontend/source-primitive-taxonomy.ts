import type { NumericPrimitiveFact } from "./source-facts.js";

const sourcePrimitiveEntries: readonly (readonly [
  string,
  NumericPrimitiveFact,
])[] = [
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
] as const;

const sourcePrimitiveFactsByName: ReadonlyMap<string, NumericPrimitiveFact> =
  new Map(sourcePrimitiveEntries);

export const getSourcePrimitiveFact = (
  sourceName: string
): NumericPrimitiveFact | undefined => sourcePrimitiveFactsByName.get(sourceName);

export const getSourcePrimitiveNames = (): readonly string[] =>
  sourcePrimitiveEntries.map(([sourceName]) => sourceName);
