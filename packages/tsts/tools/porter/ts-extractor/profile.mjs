// Project profile: ALL Go->TS mapping knowledge the checker needs, so the engine
// stays generic and a different Go->TS port project runs by editing config only.
// `config.signatureCheck` deep-overrides these defaults; absent => tsts behavior.
//
// (The one code-level extension point that is NOT config is the parser AST shape:
// the actual side reads the TSTS Go-port AST. A project using a different TS
// parser supplies a parser adapter. Everything else below is config.)

export const TSTS_PROFILE = {
  annotation: { tag: "@tsgo-unit", idSeparator: "::", methodNameJoin: "_" },
  parser: {
    distRoot: "packages/tsts/dist/src/internal",
    freshnessSrcDirs: [
      "packages/tsts/src/internal/parser",
      "packages/tsts/src/internal/ast",
      "packages/tsts/src/internal/scanner",
      "packages/tsts/src/internal/core",
    ],
  },
  modules: {
    core: "packages/tsts/src/go/scalars.ts",
    compat: "packages/tsts/src/go/compat.ts",
  },
  // Go composite kinds -> bridge generic name (resolved in `modules.compat`).
  bridge: { pointer: "GoPtr", ref: "GoRef", slice: "GoSlice", array: "GoArray", map: "GoMap", chan: "GoChan" },
  primitives: {
    keyword: { string: "string", any: "unknown" },
    core: {
      bool: "bool", byte: "byte", int: "int", int8: "sbyte", int16: "short",
      int32: "int", int64: "long", uint: "uint", uint8: "byte", uint16: "ushort",
      uint32: "uint", uint64: "ulong", uintptr: "nuint", float32: "float", float64: "double",
    },
    compat: { rune: "GoRune", error: "GoError", complex64: "GoComplex64", complex128: "GoComplex128" },
  },
  // Qualified Go stdlib types that map to compat helpers (pkg.Name -> compat name).
  stdlibTypes: {
    "iter.Seq": "GoSeq", "iter.Seq2": "GoSeq2",
    "cmp.Ordered": "GoOrdered", "constraints.Ordered": "GoOrdered",
    "unsafe.Pointer": "GoUnsafePointer",
  },
  // Stdlib/runtime package -> facade module path. {importPath} is the full Go
  // import path (e.g. sync/atomic -> packages/tsts/src/go/sync/atomic.ts).
  facadeTemplate: "packages/tsts/src/go/{importPath}.ts",
  // One canonical module per GLOBALLY-UNIQUE type name that is declared in more
  // than one TS module (a generated copy + a hand-ported copy, or a brand +
  // full interface). Both declarations are the same logical (same Go-origin)
  // type; the checker collapses every reference to the canonical module. Narrow
  // and named — NOT broad module-path equivalence. Only add names that are
  // unique across the tree.
  canonicalTypes: {
    "SymbolFlags": "packages/tsts/src/internal/ast/generated/flags.ts",
    "NodeFlags": "packages/tsts/src/internal/ast/generated/flags.ts",
    "NodeVisitor": "packages/tsts/src/internal/ast/spine.ts",
    "ExtendedConfigCache": "packages/tsts/src/internal/execute/tsc/extendedconfigcache.ts",
  },
  // TSTS represents TS-Go AST nodes as a Node envelope plus generated data
  // interfaces. A Go `*SourceFile` in signature position corresponds to the TS
  // node-envelope alias `SourceFileNode`, not the data interface `SourceFile`.
  nodeFormAliases: {
    unionModule: "packages/tsts/src/internal/ast/generated/unions.ts",
    sourceModulePrefixes: [
      "packages/tsts/src/internal/ast/ast.ts",
    ],
    dataModule: "packages/tsts/src/internal/ast/generated/data.ts",
    dataTypeNames: ["ConditionalTypeNode", "MappedTypeNode"],
  },
  // Ambient TypeScript/host globals that are intentional signature surface.
  // Everything else under global::/name::/unresolved:: remains a hard
  // unresolved-ref mismatch.
  allowedGlobals: ["Date", "ReadonlyMap", "Uint8Array"],
  // External Go interface aliases whose zero value is nil and therefore may be
  // represented as GoPtr<Alias> in the TypeScript port.
  externalNilableTypes: ["io/fs.FileInfo", "io/fs.DirEntry", "io.Writer"],
  externalInterfaceMembers: {
    "io/fs.FileInfo": [
      { name: "Name", type: { t: "fn", params: [], ret: { t: "kw", kw: "string" } } },
      { name: "Size", type: { t: "fn", params: [], ret: { t: "ref", id: "packages/tsts/src/go/scalars.ts::int", args: [] } } },
      { name: "Mode", type: { t: "fn", params: [], ret: { t: "ref", id: "packages/tsts/src/go/io/fs.ts::FileMode", args: [] } } },
      { name: "ModTime", type: { t: "fn", params: [], ret: { t: "ref", id: "global::Date", args: [] } } },
      { name: "IsDir", type: { t: "fn", params: [], ret: { t: "ref", id: "packages/tsts/src/go/scalars.ts::bool", args: [] } } },
      { name: "Sys", type: { t: "fn", params: [], ret: { t: "kw", kw: "unknown" } } }
    ]
  },
  // Exact return/value types for authored Go facades. These are explicit
  // facade contracts, not name guesses; internal TS-Go symbols still resolve
  // from the Go snapshot.
  externalFunctionReturns: {
    "regexp.MustCompile": { module: "packages/tsts/src/go/regexp.ts", name: "Regexp" },
    "strings.NewReplacer": { module: "packages/tsts/src/go/strings.ts", name: "Replacer" },
    "reflect.TypeFor": { module: "packages/tsts/src/go/reflect.ts", name: "Type" },
  },
  externalValueTypes: {
    "fs.ErrInvalid": { module: "packages/tsts/src/go/compat.ts", name: "GoError" },
    "fs.ErrPermission": { module: "packages/tsts/src/go/compat.ts", name: "GoError" },
    "fs.ErrExist": { module: "packages/tsts/src/go/compat.ts", name: "GoError" },
    "fs.ErrNotExist": { module: "packages/tsts/src/go/compat.ts", name: "GoError" },
    "fs.ErrClosed": { module: "packages/tsts/src/go/compat.ts", name: "GoError" },
    "fs.SkipAll": { module: "packages/tsts/src/go/compat.ts", name: "GoError" },
    "fs.SkipDir": { module: "packages/tsts/src/go/compat.ts", name: "GoError" },
    "jsontext.BeginArray": { module: "packages/tsts/src/go/github.com/go-json-experiment/json/jsontext.ts", name: "Kind" },
    "jsontext.BeginObject": { module: "packages/tsts/src/go/github.com/go-json-experiment/json/jsontext.ts", name: "Kind" },
    "jsontext.EndArray": { module: "packages/tsts/src/go/github.com/go-json-experiment/json/jsontext.ts", name: "Kind" },
    "jsontext.EndObject": { module: "packages/tsts/src/go/github.com/go-json-experiment/json/jsontext.ts", name: "Kind" },
    "jsontext.Null": { module: "packages/tsts/src/go/github.com/go-json-experiment/json/jsontext.ts", name: "Kind" },
    "math.MaxInt": { module: "packages/tsts/src/go/scalars.ts", name: "int" },
    "time.Millisecond": { module: "packages/tsts/src/go/time.ts", name: "Duration" },
  },
};

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base, override) {
  if (!isPlainObject(override)) return override ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isPlainObject(v) && isPlainObject(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function loadProfile(config) {
  return deepMerge(TSTS_PROFILE, config?.signatureCheck ?? {});
}
