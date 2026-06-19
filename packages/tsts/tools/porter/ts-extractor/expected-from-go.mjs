// Expected-side descriptors derived DIRECTLY from the Go extractor's structured
// type model (TypeExprReport), NOT from rendering TS in isolation (which can't
// resolve same-package / split-relocated types and produced ~93% false mismatches).
//
// Each Go named type resolves to the TS module where its @tsgo-unit ACTUALLY
// lives (authoritative, split-aware), so identities match the actual file's
// imports: e.g. Go `ast.Node` -> wherever `Node`'s @tsgo-unit is (spine.ts),
// which is exactly what the actual file imports. This preserves strict
// import-identity (core.Node != ast.Node) while eliminating the isolation noise.

// All Go->TS mapping knowledge comes from the project `profile` (see profile.mjs);
// nothing tsts-specific is hardcoded here.

function isInternal(importPath, goModule) {
  return importPath === goModule || importPath.startsWith(goModule + "/");
}

// tsDecls: Map<typeName, Set<moduleId>> of every exported type declaration in TS
// (incl. generated, non-@tsgo-unit types), so a Go type that exists in TS but
// isn't unit-tracked still resolves to its real defining module.
export function buildExpectedIndex(config, snapshot, tsById, profile, tsDecls = new Map()) {
  const goModule = config.goModulePath;
  // (packageImportPath::TypeName) -> actual TS module path (where its @tsgo-unit lives)
  const pkgType = new Map();
  const typeUnits = new Map();
  const functionUnits = new Map();
  const valueSpecs = new Map();
  const receiverMethods = new Map();
  // (packageImportPath::TypeName) -> the type's own type-parameter details (so a
  // method on a generic type inherits the receiver's type params, as the TS port does).
  const typeParams = new Map();
  for (const file of snapshot.files) {
    for (const u of file.units ?? []) {
      if (u.kind !== "type") continue;
      const ts = tsById.get(u.id);
      if (ts) pkgType.set(`${file.importPath}::${u.name}`, ts.path);
      typeUnits.set(`${file.importPath}::${u.name}`, { unit: u, importPath: file.importPath, fileImports: file.imports });
      if (u.typeParameterDetails?.length) typeParams.set(`${file.importPath}::${u.name}`, u.typeParameterDetails);
    }
    for (const u of file.units ?? []) {
      if (u.kind === "func") functionUnits.set(`${file.importPath}::${u.name}`, { unit: u, importPath: file.importPath, fileImports: file.imports });
      if (u.kind === "method") {
        const receiver = baseTypeName(u.receiverType);
        if (receiver) {
          const key = `${file.importPath}::${receiver}`;
          if (!receiverMethods.has(key)) receiverMethods.set(key, []);
          receiverMethods.get(key).push({ unit: u, importPath: file.importPath, fileImports: file.imports });
        }
      }
      if (u.kind === "constGroup" || u.kind === "varGroup") {
        for (const spec of u.valueSpecs ?? []) {
          (spec.names ?? []).forEach((name, ordinal) => valueSpecs.set(`${file.importPath}::${name}`, {
            spec,
            ordinal,
            importPath: file.importPath,
            fileImports: file.imports,
          }));
        }
      }
    }
  }
  return {
    goModule,
    tsRoot: config.tsRoot,
    core: profile.modules.core,
    compat: profile.modules.compat,
    bridge: profile.bridge,
    primKeyword: profile.primitives.keyword,
    primCore: profile.primitives.core,
    primCompat: profile.primitives.compat,
    stdlibTypes: profile.stdlibTypes,
    externalFunctionReturns: profile.externalFunctionReturns ?? {},
    externalValueTypes: profile.externalValueTypes ?? {},
    externalNilableTypes: new Set(profile.externalNilableTypes ?? []),
    externalInterfaceMembers: profile.externalInterfaceMembers ?? {},
    facadeTemplate: profile.facadeTemplate,
    pkgType,
    typeUnits,
    functionUnits,
    valueSpecs,
    receiverMethods,
    typeParams,
    tsDecls,
  };
}

export function nilableTypeRefs(index) {
  const refs = new Set();
  for (const [key, found] of index.typeUnits) {
    const split = key.lastIndexOf("::");
    const importPath = key.slice(0, split);
    const name = key.slice(split + 2);
    if (!isNilableGoNamedType(found.unit, found.fileImports, index)) continue;
    const tsPath = index.pkgType.get(key) ?? resolveTsDecl(index, importPath, name);
    if (tsPath) refs.add(`${tsPath}::${name}`);
  }
  for (const fullName of index.externalNilableTypes) {
    const split = fullName.lastIndexOf(".");
    if (split <= 0) continue;
    const importPath = fullName.slice(0, split);
    const name = fullName.slice(split + 1);
    refs.add(`${index.facadeTemplate.replace("{importPath}", importPath)}::${name}`);
  }
  return refs;
}

function isNilableGoNamedType(unit, fileImports, index) {
  if (unit.typeKind === "interface") return true;
  return isNilableGoTypeExpression(unit.typeExpression, fileImports, index);
}

function isNilableGoTypeExpression(expr, fileImports, index) {
  if (!expr) return false;
  if (expr.kind === "map" || expr.kind === "slice" || expr.kind === "func" || expr.kind === "channel" || expr.kind === "interface") return true;
  if (expr.kind === "paren") return isNilableGoTypeExpression(expr.element, fileImports, index);
  if (expr.kind === "instantiation") return isNilableGoTypeExpression(expr.element, fileImports, index);
  if (expr.kind === "selector") {
    const importPath = resolveImportPath(expr.package, { fileImports });
    return index.externalNilableTypes.has(`${importPath}.${expr.name}`) || index.externalNilableTypes.has(`${expr.package}.${expr.name}`);
  }
  return false;
}

const ref = (id, args = []) => ({ t: "ref", id, args });

// The TS source directory for a Go import path (strip the module prefix, map
// under tsRoot): github.com/…/internal/ast -> packages/tsts/src/internal/ast.
function tsDirForPackage(index, importPath) {
  if (importPath === index.goModule) return index.tsRoot;
  if (!importPath.startsWith(index.goModule + "/")) return undefined;
  return `${index.tsRoot}/${importPath.slice(index.goModule.length + 1)}`;
}

// Resolve a Go type to a TS module by its actual declaration location, preferring
// a declaration under the package's TS directory (handles generated/aliased types).
function resolveTsDecl(index, importPath, name) {
  const mods = index.tsDecls.get(name);
  if (!mods) return undefined;
  const tsDir = tsDirForPackage(index, importPath);
  if (!tsDir) return undefined;
  const candidates = [...mods].filter((m) => m === tsDir || m.startsWith(`${tsDir}/`)).sort();
  return candidates[0];
}

// Resolve a bare named type used inside package `importPath`.
function resolveNamed(name, ctx) {
  if (ctx.typeParamIndex.has(name)) return { t: "tp", i: ctx.typeParamIndex.get(name) };
  const i = ctx.index;
  if (name in i.primKeyword) return { t: "kw", kw: i.primKeyword[name] };
  if (name in i.primCore) return ref(`${i.core}::${i.primCore[name]}`);
  if (name in i.primCompat) return ref(`${i.compat}::${i.primCompat[name]}`);
  const tsPath = i.pkgType.get(`${ctx.importPath}::${name}`);
  if (tsPath) return ref(`${tsPath}::${name}`);
  const decl = resolveTsDecl(i, ctx.importPath, name); // generated/untracked TS type
  if (decl) return ref(`${decl}::${name}`);
  return ref(`name::${name}`); // genuinely unresolved -> surfaced as unresolved-ref
}

// Resolve a qualified `pkg.Name`.
function resolveSelector(pkg, name, ctx) {
  const i = ctx.index;
  if (name in i.primCompat) return ref(`${i.compat}::${i.primCompat[name]}`);
  const compatName = i.stdlibTypes[`${pkg}.${name}`];
  if (compatName) return ref(`${i.compat}::${compatName}`);
  // Find the Go import whose package name (last path segment) matches `pkg`.
  const imp = (ctx.fileImports ?? []).find((x) => x.path === pkg || x.path.split("/").pop() === pkg);
  const importPath = imp?.path ?? pkg;
  if (isInternal(importPath, i.goModule)) {
    const tsPath = i.pkgType.get(`${importPath}::${name}`);
    if (tsPath) return ref(`${tsPath}::${name}`);
    const decl = resolveTsDecl(i, importPath, name);
    if (decl) return ref(`${decl}::${name}`);
    return ref(`name::${name}`);
  }
  // Stdlib / runtime package -> facade module (template, e.g. sync/atomic ->
  // go/sync/atomic.ts) matching the actual import.
  return ref(`${i.facadeTemplate.replace("{importPath}", importPath)}::${name}`);
}

// Map a Go TypeExprReport to a canonical descriptor.
export function goTypeToDescriptor(expr, ctx) {
  if (!expr) return { t: "kw", kw: "unknown" };
  switch (expr.kind) {
    case "ident":
      return resolveNamed(expr.name, ctx);
    case "selector":
      return resolveSelector(expr.package, expr.name, ctx);
    case "paren":
      return goTypeToDescriptor(expr.element, ctx);
    case "pointer":
      return ref(`${ctx.index.compat}::${ctx.index.bridge.pointer}`, [goTypeToDescriptor(expr.element, ctx)]);
    case "slice":
      return ref(`${ctx.index.compat}::${ctx.index.bridge.slice}`, [goTypeToDescriptor(expr.element, ctx)]);
    case "ellipsis":
      return ref(`${ctx.index.compat}::${ctx.index.bridge.slice}`, [goTypeToDescriptor(expr.element, ctx)]);
    case "array":
      return ref(`${ctx.index.compat}::${ctx.index.bridge.array}`, [
        goTypeToDescriptor(expr.element, ctx),
        { t: "lit", text: JSON.stringify(expr.length ?? "") },
      ]);
    case "map":
      return ref(`${ctx.index.compat}::${ctx.index.bridge.map}`, [
        goTypeToDescriptor(expr.key, ctx),
        goTypeToDescriptor(expr.value, ctx),
      ]);
    case "channel":
      return ref(`${ctx.index.compat}::${ctx.index.bridge.chan}`, [
        goTypeToDescriptor(expr.element, ctx),
        { t: "lit", text: JSON.stringify(expr.direction ?? "bidirectional") },
      ]);
    case "func":
      return goFuncType(expr, ctx);
    case "instantiation": {
      const base = goTypeToDescriptor(expr.element, ctx);
      const args = (expr.typeArgs ?? []).map((a) => goTypeToDescriptor(a, ctx));
      return base.t === "ref" ? ref(base.id, args) : base;
    }
    case "interface":
    case "struct": {
      // Empty inline struct/interface (e.g. `chan struct{}`) is rendered as the
      // empty-object marker. Non-empty inline objects are compared structurally:
      // Go `struct { flag TypeFlags; name string }` must match TS
      // `{ flag: TypeFlags; name: string }` without collapsing to a raw marker.
      const members = expr.members ?? [];
      if (members.length === 0) {
        return { t: "object", members: [{ name: "__tsgoEmpty", optional: true, type: { t: "kw", kw: "never" } }] };
      }
      return {
        t: "object",
        members: members
          .filter((m) => m.name && (m.kind === "field" || m.kind === "method"))
          .map((m) => ({
            name: m.name,
            type: m.kind === "method" ? goFuncType(m.typeExpr, ctx) : goTypeToDescriptor(m.typeExpr, ctx),
          })),
      };
    }
    case "unary":
    case "binary":
      return goTypeTextToDescriptor(expr.text ?? "", ctx);
    default:
      return { t: "raw", text: (expr.text ?? expr.kind ?? "").replace(/\s+/g, " ") };
  }
}

// Go params -> descriptor params (flattening Go's grouped names: one entry per name).
function goParams(list, ctx) {
  const out = [];
  for (const p of list ?? []) {
    const rest = !!p.variadic;
    const elem = rest && p.type?.kind === "ellipsis" ? p.type.element : p.type;
    const type = rest
      ? { t: "array", element: goTypeToDescriptor(elem, ctx) } // ...x: T[]
      : goTypeToDescriptor(p.type, ctx);
    const names = p.names && p.names.length > 0 ? p.names : [undefined];
    for (const _ of names) out.push({ type, rest });
  }
  return out;
}

function goResults(list, ctx) {
  const flat = [];
  for (const r of list ?? []) {
    const names = r.names && r.names.length > 0 ? r.names : [undefined];
    for (const _ of names) flat.push(goTypeToDescriptor(r.type, ctx));
  }
  if (flat.length === 0) return { t: "kw", kw: "void" };
  if (flat.length === 1) return flat[0];
  return { t: "tuple", elements: flat }; // Go multiple returns -> TS tuple
}

function goFuncType(expr, ctx) {
  return {
    t: "fn",
    params: goParams(expr.parameters, ctx).map((p) => ({ type: p.type, rest: p.rest })),
    ret: goResults(expr.results, ctx),
  };
}

function baseTypeName(expr) {
  if (!expr) return undefined;
  if (expr.kind === "pointer" || expr.kind === "paren") return baseTypeName(expr.element);
  if (expr.kind === "instantiation") return baseTypeName(expr.element);
  if (expr.kind === "ident") return expr.name;
  return undefined;
}

function receiverTypeParams(unit, index, importPath) {
  const name = baseTypeName(unit.receiverType);
  if (!name) return [];
  return index.typeParams.get(`${importPath}::${name}`) ?? [];
}

function typeParamIndexOf(details) {
  const m = new Map();
  (details ?? []).forEach((d, i) => m.set(d.name, i));
  return m;
}

function typeParamDescriptors(details, ctx) {
  return (details ?? []).map((d) => ({
    constraint: d.constraint ? goTypeToDescriptor(d.constraint, ctx) : null,
  }));
}

function resolveKnownTypeName(name, ctx) {
  const resolved = resolveNamed(name, ctx);
  if (resolved.t !== "ref") return resolved;
  return resolved.id.startsWith("name::") ? null : resolved;
}

function resolveKnownSelectorType(pkg, name, ctx) {
  const i = ctx.index;
  const imp = (ctx.fileImports ?? []).find((x) => x.path === pkg || x.path.split("/").pop() === pkg);
  const importPath = imp?.path ?? pkg;
  if (isInternal(importPath, i.goModule)) {
    const tsPath = i.pkgType.get(`${importPath}::${name}`);
    if (tsPath) return ref(`${tsPath}::${name}`);
    const decl = resolveTsDecl(i, importPath, name);
    if (decl) return ref(`${decl}::${name}`);
  }
  const compatName = i.stdlibTypes[`${pkg}.${name}`];
  return compatName ? ref(`${i.compat}::${compatName}`) : null;
}

function descriptorFromProfileType(entry) {
  if (!entry) return null;
  if (entry.descriptor) return entry.descriptor;
  if (entry.keyword) return { t: "kw", kw: entry.keyword };
  if (entry.module && entry.name) return ref(`${entry.module}::${entry.name}`);
  return null;
}

function resolveImportPath(pkg, ctx) {
  const imp = (ctx.fileImports ?? []).find((x) => x.path === pkg || x.path.split("/").pop() === pkg);
  return imp?.path ?? pkg;
}

function goFunctionReturn(unit, ctx, explicitTypeArgs = []) {
  const allTypeParamDetails = unit.typeParameterDetails ?? [];
  const typeParamIndex = typeParamIndexOf(allTypeParamDetails);
  const functionCtx = { ...ctx, typeParamIndex };
  const ret = goResults(unit.results, functionCtx);
  if (explicitTypeArgs.length === 0 || allTypeParamDetails.length === 0) return ret;
  const substitutions = new Map();
  explicitTypeArgs.forEach((arg, index) => substitutions.set(index, arg));
  return substituteTypeParams(ret, substitutions);
}

function substituteTypeParams(desc, substitutions) {
  if (!desc || typeof desc !== "object") return desc;
  if (desc.t === "tp") return substitutions.get(desc.i) ?? desc;
  if (desc.t === "ref") return ref(desc.id, desc.args.map((a) => substituteTypeParams(a, substitutions)));
  if (desc.t === "array") return { ...desc, element: substituteTypeParams(desc.element, substitutions) };
  if (desc.t === "tuple") return { ...desc, elements: desc.elements.map((e) => substituteTypeParams(e, substitutions)) };
  if (desc.t === "union" || desc.t === "intersect") return { ...desc, members: desc.members.map((m) => substituteTypeParams(m, substitutions)) };
  if (desc.t === "fn") {
    return {
      ...desc,
      params: desc.params.map((p) => ({ ...p, type: substituteTypeParams(p.type, substitutions) })),
      ret: substituteTypeParams(desc.ret, substitutions),
    };
  }
  if (desc.t === "object") {
    return {
      ...desc,
      members: desc.members.map((m) => (m.type ? { ...m, type: substituteTypeParams(m.type, substitutions) } : m)),
    };
  }
  return desc;
}

function resolveFunctionReturn(name, ctx, explicitTypeArgs = []) {
  const found = ctx.index.functionUnits.get(`${ctx.importPath}::${name}`);
  return found ? goFunctionReturn(found.unit, { ...ctx, importPath: found.importPath, fileImports: found.fileImports }, explicitTypeArgs) : null;
}

function resolveSelectorFunctionReturn(pkg, name, ctx, explicitTypeArgs = []) {
  const importPath = resolveImportPath(pkg, ctx);
  if (!isInternal(importPath, ctx.index.goModule)) return null;
  const found = ctx.index.functionUnits.get(`${importPath}::${name}`);
  return found ? goFunctionReturn(found.unit, { ...ctx, importPath: found.importPath, fileImports: found.fileImports }, explicitTypeArgs) : null;
}

function resolveExternalFunctionReturn(pkg, name, ctx) {
  const importPath = resolveImportPath(pkg, ctx);
  return descriptorFromProfileType(ctx.index.externalFunctionReturns[`${importPath}.${name}`] ?? ctx.index.externalFunctionReturns[`${pkg}.${name}`]);
}

function resolveValueType(name, ctx, seen = new Set()) {
  const key = `${ctx.importPath}::${name}`;
  if (seen.has(key)) return null;
  const found = ctx.index.valueSpecs.get(key);
  if (!found) return null;
  seen.add(key);
  return valueSpecType(found.spec, { ...ctx, importPath: found.importPath, fileImports: found.fileImports, seenValues: seen }, found.ordinal);
}

function resolveSelectorValueType(pkg, name, ctx, seen = new Set()) {
  const importPath = resolveImportPath(pkg, ctx);
  if (!isInternal(importPath, ctx.index.goModule)) {
    return descriptorFromProfileType(ctx.index.externalValueTypes[`${importPath}.${name}`] ?? ctx.index.externalValueTypes[`${pkg}.${name}`]);
  }
  const key = `${importPath}::${name}`;
  if (seen.has(key)) return null;
  const found = ctx.index.valueSpecs.get(key);
  if (!found) return null;
  seen.add(key);
  return valueSpecType(found.spec, { ...ctx, importPath: found.importPath, fileImports: found.fileImports, seenValues: seen }, found.ordinal);
}

function inferValueTypeFromText(text, ctx) {
  const source = (text ?? "").trim();
  if (!source) return null;

  if (/^len\s*\(/.test(source)) return resolveNamed("int", ctx);
  if (/^diagnostics\.[A-Za-z_]\w*\.Code\s*\(\s*\)$/.test(source)) return resolveNamed("int32", ctx);

  const immediateFunc = source.match(/^func\s*\(\s*\)\s+([\s\S]*?)\s*\{/);
  if (immediateFunc) return goTypeTextToDescriptor(immediateFunc[1], ctx);

  const onceValue = source.match(/^sync\.OnceValue\s*\(\s*func\s*\(\s*\)\s+([\s\S]*?)\s*\{/);
  if (onceValue) {
    return { t: "fn", params: [], ret: goTypeTextToDescriptor(onceValue[1], ctx) };
  }

  if (source === "true" || source === "false") return resolveNamed("bool", ctx);
  if (/^[A-Za-z_]\w*$/.test(source)) {
    const valueType = resolveValueType(source, ctx, ctx.seenValues ?? new Set());
    if (valueType) return valueType;
  }
  const selectorValue = source.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (selectorValue) {
    const valueType = resolveSelectorValueType(selectorValue[1], selectorValue[2], ctx, ctx.seenValues ?? new Set());
    if (valueType) return valueType;
  }
  if (/^[-+]?\d+(?:_\d+)*$/.test(source)) return resolveNamed("int", ctx);
  if (/^0[xX][0-9a-fA-F_]+$/.test(source)) return resolveNamed("int", ctx);
  if (/^(?:"(?:\\.|[^"\\])*"|`[^`]*`)$/.test(source)) return resolveNamed("string", ctx);
  if (/(^|[+\s])(?:"(?:\\.|[^"\\])*"|`[^`]*`)([+\s]|$)/.test(source)) return resolveNamed("string", ctx);

  for (const op of ["*", "+", "-", "/", "%", "<<", ">>", "&", "|", "^"]) {
    const split = splitTopLevelOperator(source, op);
    if (!split) continue;
    const left = inferValueTypeFromText(split[0], ctx);
    const right = inferValueTypeFromText(split[1], ctx);
    if (!left || !right) continue;
    if (left.t === "ref" && left.id === "packages/tsts/src/go/time.ts::Duration") return left;
    if (right.t === "ref" && right.id === "packages/tsts/src/go/time.ts::Duration") return right;
    return resolveNamed("int", ctx);
  }

  const explicitGenericCall = source.match(/^([A-Za-z_]\w*)\s*\[([\s\S]*?)\]\s*\(/);
  if (explicitGenericCall) {
    const args = splitTopLevelList(explicitGenericCall[2]).map((a) => goTypeTextToDescriptor(a, ctx));
    const ret = resolveFunctionReturn(explicitGenericCall[1], ctx, args);
    if (ret) return ret;
  }

  const explicitGenericSelectorCall = source.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\[([\s\S]*?)\]\s*\(/);
  if (explicitGenericSelectorCall) {
    const args = splitTopLevelList(explicitGenericSelectorCall[3]).map((a) => goTypeTextToDescriptor(a, ctx));
    const ret = resolveSelectorFunctionReturn(explicitGenericSelectorCall[1], explicitGenericSelectorCall[2], ctx, args);
    if (ret) return ret;
    const externalRet = resolveExternalFunctionReturn(explicitGenericSelectorCall[1], explicitGenericSelectorCall[2], ctx);
    if (externalRet) return externalRet;
  }

  const identConversion = source.match(/^([A-Za-z_]\w*)\s*\(/);
  if (identConversion) {
    const ret = resolveFunctionReturn(identConversion[1], ctx);
    if (ret) return ret;
    const ty = resolveKnownTypeName(identConversion[1], ctx);
    if (ty) return ty;
  }

  const selectorConversion = source.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/);
  if (selectorConversion) {
    const known = inferKnownSelectorCallReturn(selectorConversion[1], selectorConversion[2], source, ctx);
    if (known) return known;
    const ret = resolveSelectorFunctionReturn(selectorConversion[1], selectorConversion[2], ctx);
    if (ret) return ret;
    const externalRet = resolveExternalFunctionReturn(selectorConversion[1], selectorConversion[2], ctx);
    if (externalRet) return externalRet;
    return resolveKnownSelectorType(selectorConversion[1], selectorConversion[2], ctx);
  }

  const addressComposite = source.match(/^&\s*([A-Za-z_]\w*)\s*(?:\[.*?\])?\s*\{/);
  if (addressComposite) {
    const ty = resolveKnownTypeName(addressComposite[1], ctx);
    if (ty) return ref(`${ctx.index.compat}::${ctx.index.bridge.pointer}`, [ty]);
  }

  const composite = source.match(/^([A-Za-z_]\w*)\s*(?:\[.*?\])?\s*\{/);
  if (composite) return resolveKnownTypeName(composite[1], ctx);

  const newCall = source.match(/^new\s*\(\s*([A-Za-z_]\w*)\s*\)$/);
  if (newCall) {
    const ty = resolveKnownTypeName(newCall[1], ctx);
    if (ty) return ref(`${ctx.index.compat}::${ctx.index.bridge.pointer}`, [ty]);
  }

  return null;
}

function inferKnownSelectorCallReturn(pkg, name, source, ctx) {
  const argsSource = source.slice(source.indexOf("(") + 1, source.lastIndexOf(")"));
  const args = splitTopLevelList(argsSource);
  if (pkg === "slices" && name === "Concat" && args.length > 0) {
    const first = inferValueTypeFromText(args[0], ctx);
    if (first?.t === "ref" && terminalNameFromId(first.id) === "GoSlice") return first;
    if (isGoPtrOf(first, "GoSlice")) return first.args[0];
  }
  if (pkg === "slices" && name === "Collect" && args.length === 1) {
    const key = inferKeysElementType(args[0], ctx);
    if (key) return ref(`${ctx.index.compat}::${ctx.index.bridge.slice}`, [key]);
  }
  if (pkg === "collections" && name === "NewOrderedMapFromList" && args.length === 1) {
    const arg = goTypeTextToDescriptor(args[0].replace(/\{[\s\S]*$/, ""), ctx);
    const sliceElement = arg?.t === "ref" && terminalNameFromId(arg.id) === "GoSlice" ? arg.args[0] : undefined;
    if (sliceElement?.t === "ref" && terminalNameFromId(sliceElement.id) === "MapEntry" && sliceElement.args.length === 2) {
      return ref(`${ctx.index.compat}::${ctx.index.bridge.pointer}`, [
        ref(`${ctx.index.tsRoot}/internal/collections/ordered_map.ts::OrderedMap`, sliceElement.args),
      ]);
    }
  }
  if (pkg === "collections" && name === "NewSetFromItems" && args.length > 0) {
    const itemType = inferValueTypeFromText(args[0], ctx);
    if (itemType) {
      return ref(`${ctx.index.compat}::${ctx.index.bridge.pointer}`, [
        ref(`${ctx.index.tsRoot}/internal/collections/set.ts::Set`, [itemType]),
      ]);
    }
  }
  return null;
}

function terminalNameFromId(id) {
  return String(id).slice(String(id).lastIndexOf("::") + 2);
}

function isGoPtrOf(desc, terminal) {
  return desc?.t === "ref" && terminalNameFromId(desc.id) === "GoPtr" && desc.args[0]?.t === "ref" && terminalNameFromId(desc.args[0].id) === terminal;
}

function inferKeysElementType(source, ctx) {
  const keysCall = source.trim().match(/^([A-Za-z_]\w*)\.Keys\s*\(\s*\)$/);
  if (!keysCall) return null;
  const receiver = inferValueTypeFromText(keysCall[1], ctx);
  const target = receiver?.t === "ref" && terminalNameFromId(receiver.id) === "GoPtr" ? receiver.args[0] : receiver;
  if (target?.t !== "ref") return null;
  const terminal = terminalNameFromId(target.id);
  if ((terminal === "OrderedMap" || terminal === "Set" || terminal === "SyncMap" || terminal === "SyncSet") && target.args.length > 0) {
    return target.args[0];
  }
  return null;
}

function splitTopLevel(text, separator) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[" || ch === "(" || ch === "{") depth++;
    else if (ch === "]" || ch === ")" || ch === "}") depth--;
    else if (ch === separator && depth === 0) return [text.slice(0, i), text.slice(i + 1)];
  }
  return undefined;
}

function splitTopLevelOperator(text, operator) {
  let depth = 0;
  for (let i = 0; i <= text.length - operator.length; i++) {
    const ch = text[i];
    if (ch === "[" || ch === "(" || ch === "{") depth++;
    else if (ch === "]" || ch === ")" || ch === "}") depth--;
    if (depth === 0 && text.slice(i, i + operator.length) === operator) {
      if ((operator === "<" || operator === ">") && text[i + 1] === operator) continue;
      return [text.slice(0, i).trim(), text.slice(i + operator.length).trim()];
    }
  }
  return undefined;
}

function splitTopLevelList(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[" || ch === "(" || ch === "{") depth++;
    else if (ch === "]" || ch === ")" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function goTypeTextToDescriptor(text, ctx) {
  const source = text.trim();
  const union = splitTopLevel(source, "|");
  if (union && !union.some((part) => part.trim().startsWith("~"))) {
    return { t: "union", members: union.map((part) => goTypeTextToDescriptor(part, ctx)) };
  }
  if (union) return { t: "raw", text: source.replace(/\s+/g, " ") };
  if (source.startsWith("*")) {
    return ref(`${ctx.index.compat}::${ctx.index.bridge.pointer}`, [goTypeTextToDescriptor(source.slice(1), ctx)]);
  }
  if (source.startsWith("[]")) {
    return ref(`${ctx.index.compat}::${ctx.index.bridge.slice}`, [goTypeTextToDescriptor(source.slice(2), ctx)]);
  }
  if (source.startsWith("map[")) {
    const close = source.indexOf("]");
    if (close > 4) {
      return ref(`${ctx.index.compat}::${ctx.index.bridge.map}`, [
        goTypeTextToDescriptor(source.slice(4, close), ctx),
        goTypeTextToDescriptor(source.slice(close + 1), ctx),
      ]);
    }
  }
  const array = source.match(/^\[([^\]]+)\]([\s\S]+)$/);
  if (array) {
    return ref(`${ctx.index.compat}::${ctx.index.bridge.array}`, [
      goTypeTextToDescriptor(array[2], ctx),
      { t: "lit", text: JSON.stringify(array[1]) },
    ]);
  }
  const instantiation = source.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?)\[([\s\S]*)\]$/);
  if (instantiation && !source.startsWith("map[")) {
    const base = goTypeTextToDescriptor(instantiation[1], ctx);
    const args = splitTopLevelList(instantiation[2]).map((a) => goTypeTextToDescriptor(a, ctx));
    return base.t === "ref" ? ref(base.id, args) : base;
  }
  const selector = source.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/);
  if (selector) return resolveSelector(selector[1], selector[2], ctx);
  const ident = source.match(/^[A-Za-z_]\w*$/);
  if (ident) return resolveNamed(source, ctx);
  return { t: "raw", text: source.replace(/\s+/g, " ") };
}

function valueSpecType(spec, ctx, ordinal = 0) {
  if (spec.type) return goTypeToDescriptor(spec.type, ctx);
  const inferred = (spec.inferredValueTypes ?? [])[ordinal] ?? (spec.inferredValueTypes ?? []).find(Boolean);
  const inferredDescriptor = inferred ? goTypeToDescriptor(inferred, ctx) : null;
  if (inferredDescriptor && !descriptorHasTypeParam(inferredDescriptor)) return inferredDescriptor;
  const values = spec.values ?? [];
  const selected = values[ordinal] ?? (values.length === 1 ? values[0] : undefined);
  for (const value of selected ? [selected] : values) {
    const inferredFromValue = inferValueTypeFromText(value, ctx);
    if (inferredFromValue) return inferredFromValue;
  }
  return inferredDescriptor;
}

function descriptorHasTypeParam(desc) {
  if (!desc || typeof desc !== "object") return false;
  if (desc.t === "tp") return true;
  if (desc.t === "ref") return desc.args.some(descriptorHasTypeParam);
  if (desc.t === "array") return descriptorHasTypeParam(desc.element);
  if (desc.t === "tuple") return desc.elements.some(descriptorHasTypeParam);
  if (desc.t === "union" || desc.t === "intersect") return desc.members.some(descriptorHasTypeParam);
  if (desc.t === "fn") return desc.params.some((p) => descriptorHasTypeParam(p.type)) || descriptorHasTypeParam(desc.ret);
  if (desc.t === "object") return desc.members.some((m) => descriptorHasTypeParam(m.type));
  return false;
}

function receiverMethodMembers(unit, ctx) {
  const methods = ctx.index.receiverMethods.get(`${ctx.importPath}::${unit.name}`) ?? [];
  return methods.map(({ unit: method, importPath, fileImports }) => {
    const receiverParams = receiverTypeParams(method, ctx.index, importPath);
    const allTypeParamDetails = [...receiverParams, ...(method.typeParameterDetails ?? [])];
    const methodCtx = { ...ctx, importPath, fileImports, typeParamIndex: typeParamIndexOf(allTypeParamDetails) };
    return {
      name: method.name,
      optional: true,
      type: {
        t: "fn",
        params: goParams(method.parameters, methodCtx).map((p) => ({ type: p.type, rest: p.rest })),
        ret: goResults(method.results, methodCtx),
      },
    };
  });
}

function goEmbeddedMembers(unit, ctx) {
  const out = [];
  let ordinal = 0;
  const directNames = directMemberNames(unit);
  for (const member of unit.members ?? []) {
    if (member.kind !== "embeddedField" && member.kind !== "embeddedInterface") continue;
    out.push({ name: `__tsgoEmbedded${ordinal++}`, optional: true, type: goTypeToDescriptor(member.typeExpr, ctx) });
    const embedded = resolveGoTypeUnit(member.typeExpr, ctx);
    if (embedded?.unit) {
      const embeddedCtx = {
        ...ctx,
        importPath: embedded.importPath,
        fileImports: embedded.fileImports,
        typeParamIndex: typeParamIndexOf(embedded.unit.typeParameterDetails),
      };
      if (embedded.unit.typeKind === "interface") {
        out.push(...goExpandedInterfaceMembers(embedded.unit, embeddedCtx).filter((m) => !directNames.has(m.name)).map((m) => ({ ...m, optional: true })));
      }
      out.push(...receiverMethodMembers(embedded.unit, embeddedCtx).filter((m) => !directNames.has(m.name)).map((m) => ({ ...m, optional: true })));
    } else {
      out.push(...externalInterfaceMembers(member.typeExpr, ctx).filter((m) => !directNames.has(m.name)).map((m) => ({ ...m, optional: true })));
    }
  }
  return out;
}

function directMemberNames(unit) {
  const names = new Set();
  for (const member of unit.members ?? []) {
    if (member.kind === "embeddedField" || member.kind === "embeddedInterface") continue;
    if (member.name) names.add(member.name);
    for (const name of member.names ?? []) names.add(name);
  }
  for (const method of unit.methods ?? []) {
    if (method.name) names.add(method.name);
  }
  return names;
}

function externalInterfaceMembers(expr, ctx) {
  const key = externalTypeKey(expr, ctx);
  if (!key) return [];
  return (ctx.index.externalInterfaceMembers[key] ?? []).map((m) => ({ name: m.name, type: m.type }));
}

function externalTypeKey(expr, ctx) {
  if (!expr) return undefined;
  if (expr.kind === "pointer" || expr.kind === "paren" || expr.kind === "instantiation") return externalTypeKey(expr.element, ctx);
  if (expr.kind !== "selector") return undefined;
  const importPath = resolveImportPath(expr.package, ctx);
  return `${importPath}.${expr.name}`;
}

function resolveGoTypeUnit(expr, ctx) {
  if (!expr) return undefined;
  if (expr.kind === "pointer" || expr.kind === "paren" || expr.kind === "instantiation") return resolveGoTypeUnit(expr.element, ctx);
  if (expr.kind === "ident") return ctx.index.typeUnits.get(`${ctx.importPath}::${expr.name}`);
  if (expr.kind === "selector") {
    const importPath = resolveImportPath(expr.package, ctx);
    return ctx.index.typeUnits.get(`${importPath}::${expr.name}`);
  }
  return undefined;
}

function goInterfaceDeclaredMembers(unit, ctx) {
  let blank = 0;
  return (unit.members ?? [])
    .filter((m) => m.name && (m.kind === "field" || m.kind === "method"))
    .map((m) => ({
      name: m.name === "_" ? `__tsgoBlank${blank++}` : m.name,
      optional: m.name === "_" ? true : undefined,
      type: goTypeToDescriptor(m.typeExpr, ctx),
    }));
}

function goExpandedInterfaceMembers(unit, ctx, seen = new Set()) {
  const key = `${ctx.importPath}::${unit.name}`;
  if (seen.has(key)) return [];
  seen.add(key);
  const members = [...goInterfaceDeclaredMembers(unit, ctx), ...receiverMethodMembers(unit, ctx)];
  for (const member of unit.members ?? []) {
    if (member.kind !== "embeddedInterface") continue;
    const embedded = resolveGoTypeUnit(member.typeExpr, ctx);
    if (embedded?.unit?.typeKind !== "interface") continue;
    const embeddedCtx = {
      ...ctx,
      importPath: embedded.importPath,
      fileImports: embedded.fileImports,
      typeParamIndex: typeParamIndexOf(embedded.unit.typeParameterDetails),
    };
    members.push(...goExpandedInterfaceMembers(embedded.unit, embeddedCtx, seen).map((m) => ({ ...m, optional: true })));
  }
  return members;
}

// Build the expected descriptor for a Go unit (same shape as the actual side).
export function goUnitDescriptor(unit, index) {
  const importPath = unit.file?.importPath ?? unit.metadata?.importPath ?? "";
  const fileImports = unit.file?.imports ?? unit.imports ?? [];
  const baseCtx = { index, importPath, fileImports, typeParamIndex: new Map() };

  if (unit.kind === "func" || unit.kind === "method") {
    // A Go method on a generic type carries no method-level type params, but the
    // TS port puts the receiver type's params on the function. Prepend them.
    const receiverParams = unit.kind === "method" ? receiverTypeParams(unit, index, importPath) : [];
    const allTypeParamDetails = [...receiverParams, ...(unit.typeParameterDetails ?? [])];
    const tpIndex = typeParamIndexOf(allTypeParamDetails);
    const ctx = { ...baseCtx, typeParamIndex: tpIndex };
    const params = [];
    if (unit.kind === "method" && unit.receiverType) {
      params.push({ type: goTypeToDescriptor(unit.receiverType, ctx), rest: false });
    }
    params.push(...goParams(unit.parameters, ctx).map((p) => ({ type: p.type, rest: p.rest })));
    return {
      kind: "func",
      params,
      ret: goResults(unit.results, ctx),
      typeParams: typeParamDescriptors(allTypeParamDetails, ctx),
    };
  }

  if (unit.kind === "type") {
    const tpIndex = typeParamIndexOf(unit.typeParameterDetails);
    const ctx = { ...baseCtx, typeParamIndex: tpIndex };
    if (unit.typeKind === "struct" || unit.typeKind === "interface") {
      const members = [
        ...goInterfaceDeclaredMembers(unit, ctx),
        ...goEmbeddedMembers(unit, ctx),
        ...receiverMethodMembers(unit, ctx),
      ];
      if (unit.typeKind === "struct" && unit.typeExpression?.kind === "struct" && (unit.typeExpression.members ?? []).length === 0) {
        members.push({ name: "__tsgoEmpty", optional: true, type: { t: "kw", kw: "never" } });
      }
      return { kind: "interface", typeParams: typeParamDescriptors(unit.typeParameterDetails, ctx), members };
    }
    // alias / named type
    return {
      kind: "alias",
      typeParams: typeParamDescriptors(unit.typeParameterDetails, ctx),
      type: unit.typeExpression ? goTypeToDescriptor(unit.typeExpression, ctx) : { t: "kw", kw: "unknown" },
    };
  }

  if (unit.kind === "constGroup" || unit.kind === "varGroup") {
    const ctx = baseCtx;
    const decls = [];
    for (const spec of unit.valueSpecs ?? []) {
      (spec.names ?? []).forEach((name, ordinal) => decls.push({ name, type: valueSpecType(spec, ctx, ordinal) }));
    }
    return { kind: "value", decls };
  }

  return { kind: "other" };
}
