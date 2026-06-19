// Shared TS-side signature machinery for the porter signature checker.
//
// Parses TypeScript with TSTS's OWN compiled parser (self-hosting), and turns a
// declaration's types into a CANONICAL STRUCTURED DESCRIPTOR — never raw text —
// so that equivalent spellings collapse:
//   - Array<T> ≡ T[]
//   - a method `m(p: P): R` ≡ a function-valued property `m: (p: P) => R`
//   - terminal type refs resolve THROUGH IMPORTS to (module, exportedName)
//     identity, so `compat.GoPtr` ≡ a bare imported `GoPtr` but `core.Node`
//     ≠ `ast.Node`.
//
// Both the actual (.ts file) side and the expected (Go-rendered) side run through
// these same functions, so the comparison is apples-to-apples.

import { existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// .../packages/tsts/tools/porter/ts-extractor -> .../packages/tsts
const pkgRoot = join(here, "../../..");
const distInternal = join(pkgRoot, "dist/src/internal");
const srcInternal = join(pkgRoot, "src/internal");
const parserEntry = join(distInternal, "parser/parser/statements-declarations.js");

// --- dist presence + freshness ------------------------------------------------

function newestMtimeMs(dir, exts) {
  // Recursive newest mtime of files with the given extensions under dir.
  let newest = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop();
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        stack.push(p);
      } else if (exts.some((x) => e.name.endsWith(x))) {
        const m = statSync(p).mtimeMs;
        if (m > newest) newest = m;
      }
    }
  }
  return newest;
}

// Asserts dist is present and not stale relative to src. Throws a clear,
// actionable error otherwise. mtime is used as a bootstrap freshness guard
// (deterministic enough for "did sources change after the build artifact").
// `distRoot`/`srcDirs` are absolute; default to the in-repo tsts layout.
export function assertDistFresh(distRoot = distInternal, srcDirs) {
  const entry = join(distRoot, "parser/parser/statements-declarations.js");
  if (!existsSync(entry)) {
    throw new Error(
      `TS parser dist not built (missing ${entry}).\n` +
        `Build the parser package first (e.g. npm run build).`,
    );
  }
  const distMtime = statSync(entry).mtimeMs;
  const watched = srcDirs ?? ["parser", "ast", "scanner", "core"].map((d) => join(srcInternal, d));
  let newestSrc = 0;
  for (const w of watched) {
    const m = newestMtimeMs(w, [".ts"]);
    if (m > newestSrc) newestSrc = m;
  }
  if (newestSrc > distMtime) {
    throw new Error(
      `TS parser dist is stale: parser/ast/scanner/core sources changed after the build artifact.\n` +
        `Rebuild dist before running the signature checker (npm run build).`,
    );
  }
}

// --- parser loading (dynamic, after the freshness gate) -----------------------

let cachedApi;

// opts (optional): { distRoot, freshnessSrcDirs } absolute paths from the project
// profile; defaults to the in-repo tsts dist layout.
export async function loadParser(opts = {}) {
  if (cachedApi) return cachedApi;
  const distRoot = opts.distRoot ?? distInternal;
  assertDistFresh(distRoot, opts.freshnessSrcDirs);
  const Kinds = await import(join(distRoot, "ast/generated/kinds.js"));
  const Casts = await import(join(distRoot, "ast/generated/casts.js"));
  const { ParseSourceFile } = await import(join(distRoot, "parser/parser/statements-declarations.js"));
  const { ScriptKindTS } = await import(join(distRoot, "core/scriptkind.js"));
  const { Node_Pos, Node_End } = await import(join(distRoot, "ast/spine.js"));

  // numeric Kind -> "KindXxx" name, and the reverse for the kinds we branch on.
  const kindName = new Map();
  for (const [k, v] of Object.entries(Kinds)) {
    if (k.startsWith("Kind") && typeof v === "number") kindName.set(v, k);
  }
  cachedApi = { Kinds, Casts, ParseSourceFile, ScriptKindTS, Node_Pos, Node_End, kindName };
  return cachedApi;
}

export function parseSource(api, fileName, sourceText) {
  // ParseSourceFile requires a normalized absolute path.
  const abs = fileName.startsWith("/") ? fileName : `/${fileName}`;
  return api.ParseSourceFile({ FileName: abs, Path: abs }, sourceText, api.ScriptKindTS);
}

// --- helpers ------------------------------------------------------------------

const sliceText = (api, text, node) => (node ? text.slice(api.Node_Pos(node), api.Node_End(node)).trim() : "");
const identText = (n) => (n ? n.Text : undefined);
const isExported = (api, node) =>
  (node.modifiers?.Nodes ?? node.modifiers ?? []).some?.((m) => m.Kind === api.Kinds.KindExportKeyword) ?? false;

// Derive a keyword type's TS spelling from its Kind name: KindStringKeyword -> "string".
function keywordOf(api, kind) {
  const name = api.kindName.get(kind);
  if (!name || !name.endsWith("Keyword")) return undefined;
  return name.slice("Kind".length, name.length - "Keyword".length).toLowerCase();
}

// --- import map ---------------------------------------------------------------

// Returns { named: Map<local,{module,imported}>, namespaces: Map<alias,{module}> }.
export function buildImportMap(api, sourceFile) {
  const named = new Map();
  const namespaces = new Map();
  for (const st of sourceFile.Statements?.Nodes ?? []) {
    if (st.Kind !== api.Kinds.KindImportDeclaration) continue;
    const imp = api.Casts.AsImportDeclaration(st);
    const module = imp.ModuleSpecifier?.Text;
    const clause = imp.ImportClause;
    if (!module || !clause) continue;
    if (clause.name) named.set(clause.name.Text, { module, imported: "default" });
    const nb = clause.NamedBindings;
    if (!nb) continue;
    if (nb.Kind === api.Kinds.KindNamespaceImport) {
      const alias = api.Casts.AsNamespaceImport(nb)?.name?.Text;
      if (alias) namespaces.set(alias, { module });
    } else if (nb.Kind === api.Kinds.KindNamedImports) {
      for (const el of nb.Elements?.Nodes ?? []) {
        const spec = api.Casts.AsImportSpecifier(el);
        const local = spec.name?.Text;
        const imported = spec.PropertyName?.Text ?? local;
        if (local) named.set(local, { module, imported });
      }
    }
  }
  return { named, namespaces };
}

// Type-producing declarations defined in this file (for local:: identity).
export function buildLocalTypeNames(api, sourceFile) {
  const names = new Set();
  for (const st of sourceFile.Statements?.Nodes ?? []) {
    const k = st.Kind;
    if (k === api.Kinds.KindInterfaceDeclaration || k === api.Kinds.KindTypeAliasDeclaration ||
        k === api.Kinds.KindClassDeclaration || k === api.Kinds.KindEnumDeclaration) {
      const decl = api.Casts.AsNode ? st : st;
      const nm = decl.name?.Text;
      if (nm) names.add(nm);
    }
  }
  return names;
}

// --- canonicalization ---------------------------------------------------------

// ctx: { api, text, imports:{named,namespaces}, localTypes:Set, typeParamIndex:Map<name,int> }
export function canonicalizeType(node, ctx) {
  const { api, text } = ctx;
  if (!node) return { t: "kw", kw: "any" }; // missing annotation handled by caller; default
  const K = api.Kinds;
  switch (node.Kind) {
    case K.KindParenthesizedType:
      return canonicalizeType(node.Type, ctx);
    case K.KindArrayType:
      return { t: "array", element: canonicalizeType(node.ElementType, ctx) };
    case K.KindTupleType:
      return { t: "tuple", elements: (node.Elements?.Nodes ?? []).map((e) => canonicalizeType(e, ctx)) };
    case K.KindUnionType:
      return { t: "union", members: (node.Types?.Nodes ?? []).map((e) => canonicalizeType(e, ctx)) };
    case K.KindIntersectionType:
      return { t: "intersect", members: (node.Types?.Nodes ?? []).map((e) => canonicalizeType(e, ctx)) };
    case K.KindFunctionType:
      return canonicalizeFn(node, ctx);
    case K.KindTypeReference:
      return canonicalizeRef(node, ctx);
    case K.KindTypeLiteral:
      return canonicalizeObjectType(node.Members?.Nodes ?? [], ctx);
    case K.KindLiteralType:
      if (typeof node.Literal?.Text === "string") return { t: "lit", text: JSON.stringify(node.Literal.Text) };
      return { t: "lit", text: sliceText(api, text, node) };
    default: {
      const kw = keywordOf(api, node.Kind);
      if (kw) return { t: "kw", kw };
      // Unhandled (mapped/conditional/indexed/typeof/etc.): compare by normalized text.
      return { t: "raw", text: sliceText(api, text, node).replace(/\s+/g, " ") };
    }
  }
}

function canonicalizeFn(node, ctx) {
  const params = (node.Parameters?.Nodes ?? []).map((p) => {
    const pd = ctx.api.Casts.AsParameterDeclaration(p);
    return {
      type: pd.Type ? canonicalizeType(pd.Type, ctx) : { t: "kw", kw: "any" },
      rest: !!pd.DotDotDotToken,
      optional: !!pd.QuestionToken,
    };
  });
  return { t: "fn", params, ret: node.Type ? canonicalizeType(node.Type, ctx) : { t: "kw", kw: "void" } };
}

function canonicalizeObjectType(members, ctx) {
  return {
    t: "object",
    members: members.map((m) => memberDescriptor(ctx.api, m, ctx)).filter(Boolean),
  };
}

function entityName(api, tn) {
  // Returns { qualifier?, name } for an EntityName (Identifier or QualifiedName).
  if (!tn) return { name: undefined };
  if (tn.Kind === api.Kinds.KindIdentifier) return { name: tn.Text };
  if (tn.Kind === api.Kinds.KindQualifiedName) {
    const q = api.Casts.AsQualifiedName(tn);
    const left = q.Left;
    const qualifier = left?.Kind === api.Kinds.KindIdentifier ? left.Text : undefined;
    return { qualifier, name: q.Right?.Text };
  }
  return { name: undefined };
}

function canonicalizeRef(node, ctx) {
  const { api } = ctx;
  const { qualifier, name } = entityName(api, node.TypeName);
  const args = (node.TypeArguments?.Nodes ?? []).map((a) => canonicalizeType(a, ctx));
  // Array<T> (the global, unimported, unqualified Array) ≡ T[].
  if (!qualifier && name === "Array" && args.length === 1 &&
      !ctx.imports.named.has("Array") && !ctx.localTypes.has("Array")) {
    return { t: "array", element: args[0] };
  }
  // Positional type-parameter identity (so <T> vs <U> renames don't mismatch).
  if (!qualifier && ctx.typeParamIndex.has(name)) {
    return { t: "tp", i: ctx.typeParamIndex.get(name) };
  }
  return { t: "ref", id: resolveIdentity(ctx, qualifier, name), args };
}

// Resolve an import specifier to a canonical module id. Relative specifiers are
// resolved against the current module and normalized to a repo-relative .ts path,
// so a type's identity is its DEFINING module regardless of how it's referenced
// (a `local::` definition and an `import { X } from "./self.js"` collapse to the
// same id). Bare/package specifiers are kept verbatim.
function resolveModuleId(spec, fromModuleId) {
  if (!spec.startsWith(".")) return spec.replace(/\.js$/, ".ts");
  const fromDir = posixDirname(fromModuleId);
  const joined = posixNormalize(`${fromDir}/${spec}`);
  return joined.replace(/\.js$/, ".ts");
}

function posixDirname(p) {
  const i = p.lastIndexOf("/");
  return i < 0 ? "." : p.slice(0, i);
}

function posixNormalize(p) {
  const parts = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function resolveIdentity(ctx, qualifier, name) {
  const { imports, localTypes, moduleId } = ctx;
  if (qualifier) {
    const ns = imports.namespaces.get(qualifier);
    if (ns) return `${resolveModuleId(ns.module, moduleId)}::${name}`;
    // qualifier is not a known namespace import — unresolved, keep both parts.
    return `unresolved::${qualifier}.${name}`;
  }
  const n = imports.named.get(name);
  if (n) return `${resolveModuleId(n.module, moduleId)}::${n.imported}`;
  if (localTypes.has(name)) return `${moduleId}::${name}`;
  // Ambient/global (builtins, lib types) — compared by name but marked unresolved
  // so it is never silently treated as equal to a same-named imported type.
  return `global::${name}`;
}

// --- canonical key (stable equality string) -----------------------------------

export function canonicalKey(d) {
  switch (d.t) {
    case "ref":
      return d.args.length ? `R:${d.id}<${d.args.map(canonicalKey).join(",")}>` : `R:${d.id}`;
    case "array":
      return `A:[${canonicalKey(d.element)}]`;
    case "tuple":
      return `T:[${d.elements.map(canonicalKey).join(",")}]`;
    case "union":
      return `U:{${flattenCompositeMembers(d, "union").map(canonicalKey).sort().join("|")}}`;
    case "intersect":
      return `I:{${flattenCompositeMembers(d, "intersect").map(canonicalKey).sort().join("&")}}`;
    case "fn":
      return `F:(${d.params
        .map((p) => `${p.rest ? "..." : ""}${p.optional ? "?" : ""}${canonicalKey(p.type)}`)
        .join(",")})=>${canonicalKey(d.ret)}`;
    case "object":
      return `O:{${d.members
        .map((m) => `${m.name}${m.optional ? "?" : ""}:${m.unsupported ? `unsupported(${m.unsupported})` : canonicalKey(m.type)}`)
        .sort()
        .join(";")}}`;
    case "kw":
      return `K:${d.kw}`;
    case "tp":
      return `P:${d.i}`;
    case "lit":
      return `L:${d.text}`;
    case "raw":
      return `X:${d.text}`;
    case "conv":
      return `C:${d.token}`;
    default:
      return `?:${JSON.stringify(d)}`;
  }
}

function canonicalKeyWithResolver(d, canon) {
  switch (d.t) {
    case "ref": {
      const id = canon(d.id);
      return d.args.length ? `R:${id}<${d.args.map((a) => canonicalKeyWithResolver(a, canon)).join(",")}>` : `R:${id}`;
    }
    case "array":
      return `A:[${canonicalKeyWithResolver(d.element, canon)}]`;
    case "tuple":
      return `T:[${d.elements.map((e) => canonicalKeyWithResolver(e, canon)).join(",")}]`;
    case "union":
      return `U:{${flattenCompositeMembers(d, "union").map((m) => canonicalKeyWithResolver(m, canon)).sort().join("|")}}`;
    case "intersect":
      return `I:{${flattenCompositeMembers(d, "intersect").map((m) => canonicalKeyWithResolver(m, canon)).sort().join("&")}}`;
    case "fn":
      return `F:(${d.params
        .map((p) => `${p.rest ? "..." : ""}${p.optional ? "?" : ""}${canonicalKeyWithResolver(p.type, canon)}`)
        .join(",")})=>${canonicalKeyWithResolver(d.ret, canon)}`;
    case "object":
      return `O:{${d.members
        .map((m) => `${m.name}${m.optional ? "?" : ""}:${m.unsupported ? `unsupported(${m.unsupported})` : canonicalKeyWithResolver(m.type, canon)}`)
        .sort()
        .join(";")}}`;
    default:
      return canonicalKey(d);
  }
}

// An id is "soft" when its module could not be resolved on one side (an ambient
// global, or a Go type with no tracked @tsgo-unit). Soft ids compare by terminal
// name; two HARD ids must match in full (so core.Node != ast.Node still holds).
function isSoftId(id) {
  return id.startsWith("global::") || id.startsWith("name::") || id.startsWith("unresolved::");
}
const terminalName = (id) => id.split("::").pop();

// Structural type equality with the soft-id rule. `canon` resolves a ref id to
// its canonical definition (following TS re-exports), so a type imported via a
// re-export module matches the same type at its definition module. Soft ids
// compare by terminal name; two HARD ids must match in full (core.Node != ast.Node).
export function typesEqual(a, b, canon = (x) => x) {
  if (!a || !b) return a === b;
  if (a.t !== b.t) return false;
  switch (a.t) {
    case "ref": {
      if (a.args.length !== b.args.length) return false;
      if (!a.args.every((x, i) => typesEqual(x, b.args[i], canon))) return false;
      const ia = canon(a.id), ib = canon(b.id);
      return isSoftId(ia) || isSoftId(ib) ? terminalName(ia) === terminalName(ib) : ia === ib;
    }
    case "array":
      return typesEqual(a.element, b.element, canon);
    case "tuple":
      return a.elements.length === b.elements.length && a.elements.every((x, i) => typesEqual(x, b.elements[i], canon));
    case "union":
    case "intersect": {
      const aMembers = flattenCompositeMembers(a, a.t);
      const bMembers = flattenCompositeMembers(b, b.t);
      if (aMembers.length !== bMembers.length) return false;
      const ak = aMembers.map((m) => canonicalKeyWithResolver(m, canon)).sort();
      const bk = bMembers.map((m) => canonicalKeyWithResolver(m, canon)).sort();
      return ak.every((k, i) => k === bk[i]);
    }
    case "fn":
      return a.params.length === b.params.length
        && a.params.every((p, i) => !!p.rest === !!b.params[i].rest && typesEqual(p.type, b.params[i].type, canon))
        && typesEqual(a.ret, b.ret, canon);
    case "object": {
      if (a.members.length !== b.members.length) return false;
      const am = new Map(a.members.map((m) => [m.name, m]));
      for (const bm of b.members) {
        const m = am.get(bm.name);
        if (!m || !!m.optional !== !!bm.optional || !!m.unsupported !== !!bm.unsupported) return false;
        if (m.unsupported || bm.unsupported) {
          if (m.unsupported !== bm.unsupported) return false;
        } else if (!typesEqual(m.type, bm.type, canon)) {
          return false;
        }
      }
      return true;
    }
    case "kw":
      return a.kw === b.kw;
    case "tp":
      return a.i === b.i;
    case "conv":
      return a.token === b.token;
    case "lit":
    case "raw":
      return a.text === b.text;
    default:
      return canonicalKey(a) === canonicalKey(b);
  }
}

function flattenCompositeMembers(d, kind) {
  const out = [];
  for (const member of d.members) {
    if (member.t === kind) out.push(...flattenCompositeMembers(member, kind));
    else out.push(member);
  }
  return out;
}

// Whether a descriptor references any unresolved (global::/name::/unresolved::) id.
export function hasUnresolved(d) {
  switch (d.t) {
    case "ref":
      return isSoftId(d.id) || d.args.some(hasUnresolved);
    case "array":
      return hasUnresolved(d.element);
    case "tuple":
    case "union":
    case "intersect":
      return (d.members ?? d.elements).some(hasUnresolved);
    case "fn":
      return d.params.some((p) => hasUnresolved(p.type)) || hasUnresolved(d.ret);
    case "object":
      return d.members.some((m) => m.type && hasUnresolved(m.type));
    default:
      return false;
  }
}

// --- declaration descriptors --------------------------------------------------

function typeParamIndexOf(api, typeParameters) {
  const idx = new Map();
  const nodes = typeParameters?.Nodes ?? [];
  for (let i = 0; i < nodes.length; i++) {
    const tp = api.Casts.AsTypeParameterDeclaration(nodes[i]);
    const nm = tp.name?.Text;
    if (nm) idx.set(nm, i);
  }
  return idx;
}

function typeParamDescriptors(api, typeParameters, ctx) {
  return (typeParameters?.Nodes ?? []).map((n) => {
    const tp = api.Casts.AsTypeParameterDeclaration(n);
    return { constraint: tp.Constraint ? canonicalizeType(tp.Constraint, ctx) : null };
  });
}

// Function-like (FunctionDeclaration / MethodSignature) -> {params, ret, typeParams}.
function functionDescriptor(api, fnLike, baseCtx) {
  const typeParamIndex = typeParamIndexOf(api, fnLike.TypeParameters);
  const ctx = { ...baseCtx, typeParamIndex };
  const params = (fnLike.Parameters?.Nodes ?? []).map((p) => {
    const pd = api.Casts.AsParameterDeclaration(p);
    return {
      type: pd.Type ? canonicalizeType(pd.Type, ctx) : { t: "kw", kw: "any" },
      rest: !!pd.DotDotDotToken,
      optional: !!pd.QuestionToken,
      missingType: !pd.Type,
    };
  });
  return {
    params,
    ret: fnLike.Type ? canonicalizeType(fnLike.Type, ctx) : { t: "kw", kw: "void" },
    typeParams: typeParamDescriptors(api, fnLike.TypeParameters, ctx),
  };
}

// Builds a descriptor for a single top-level declaration node.
// baseCtx: { api, text, imports, localTypes }
export function declarationDescriptor(api, node, baseCtx) {
  const K = api.Kinds;
  if (node.Kind === K.KindFunctionDeclaration) {
    const f = api.Casts.AsFunctionDeclaration(node);
    return { kind: "func", name: f.name?.Text, ...functionDescriptor(api, f, baseCtx) };
  }
  if (node.Kind === K.KindInterfaceDeclaration) {
    const i = api.Casts.AsInterfaceDeclaration(node);
    const typeParamIndex = typeParamIndexOf(api, i.TypeParameters);
    const ctx = { ...baseCtx, typeParamIndex };
    const members = (i.Members?.Nodes ?? []).map((m) => memberDescriptor(api, m, ctx)).filter(Boolean);
    return {
      kind: "interface",
      name: i.name?.Text,
      typeParams: typeParamDescriptors(api, i.TypeParameters, ctx),
      members,
    };
  }
  if (node.Kind === K.KindTypeAliasDeclaration) {
    const a = api.Casts.AsTypeAliasDeclaration(node);
    const typeParamIndex = typeParamIndexOf(api, a.TypeParameters);
    const ctx = { ...baseCtx, typeParamIndex };
    return {
      kind: "alias",
      name: a.name?.Text,
      typeParams: typeParamDescriptors(api, a.TypeParameters, ctx),
      type: a.Type ? canonicalizeType(a.Type, ctx) : { t: "kw", kw: "any" },
    };
  }
  if (node.Kind === K.KindVariableStatement) {
    const v = api.Casts.AsVariableStatement(node);
    const ctx = { ...baseCtx, typeParamIndex: new Map() };
    const decls = (v.DeclarationList?.Declarations?.Nodes ?? []).map((d) => {
      const vd = api.Casts.AsVariableDeclaration(d);
      return {
        name: vd.name?.Text,
        missing: !vd.Type, // unannotated ported value decl -> hard mismatch
        type: vd.Type ? canonicalizeType(vd.Type, ctx) : null,
      };
    });
    return { kind: "value", decls };
  }
  return { kind: "other", nodeKind: api.kindName.get(node.Kind) };
}

// Interface member -> { name, type } where a method becomes an {t:'fn'} type so
// `m(p): R` ≡ a property `m: (p) => R`.
function memberDescriptor(api, m, ctx) {
  if (m.Kind === api.Kinds.KindMethodSignature) {
    const sig = api.Casts.AsMethodSignatureDeclaration(m);
    const fn = functionDescriptor(api, sig, ctx);
    return { name: sig.name?.Text, type: { t: "fn", params: fn.params, ret: fn.ret } };
  }
  if (m.Kind === api.Kinds.KindPropertySignature) {
    const sig = api.Casts.AsPropertySignatureDeclaration(m);
    if (sliceText(api, ctx.text, sig.name) === "[JsonFieldNames]") {
      return null;
    }
    return {
      name: sig.name?.Text,
      type: sig.Type ? canonicalizeType(sig.Type, ctx) : { t: "kw", kw: "any" },
      optional: !!sig.PostfixToken || undefined,
    };
  }
  // Call / index / construct signatures and other member shapes are not modeled;
  // surface them (keyed by kind) rather than silently dropping them.
  const kindName = ctx.api.kindName.get(m.Kind) ?? `kind${m.Kind}`;
  return { name: `<${kindName}>`, unsupported: kindName };
}

// Extract re-export edges from a parsed file:
//   export { A, b as c } from "./mod.js"  -> named: localName -> "<mod>::<srcName>"
//   export * from "./mod.js"              -> star: ["<mod>"]
// Module specifiers are resolved to repo-relative .ts module ids.
export function extractReexports(api, sourceFile, moduleId) {
  const named = new Map();
  const star = [];
  for (const st of sourceFile.Statements?.Nodes ?? []) {
    if (st.Kind !== api.Kinds.KindExportDeclaration) continue;
    const ed = api.Casts.AsExportDeclaration(st);
    const spec = ed.ModuleSpecifier?.Text;
    if (!spec) continue; // local re-export (no module) — not a cross-module edge
    const srcModule = resolveModuleId(spec, moduleId);
    const clause = ed.ExportClause;
    if (!clause) {
      star.push(srcModule);
    } else if (clause.Kind === api.Kinds.KindNamedExports) {
      for (const el of clause.Elements?.Nodes ?? []) {
        const sp = api.Casts.AsExportSpecifier(el);
        const local = sp.name?.Text;
        const srcName = sp.PropertyName?.Text ?? local;
        if (local) named.set(local, `${srcModule}::${srcName}`);
      }
    }
  }
  return { named, star };
}

// Exported type-producing declaration names in a parsed file (interface / type
// alias / class / enum). Used to resolve types that exist in TS (e.g. generated
// AST types) but are not @tsgo-unit-tracked, to their real defining module.
export function extractTypeDecls(api, sourceFile) {
  const K = api.Kinds;
  const names = [];
  for (const st of sourceFile.Statements?.Nodes ?? []) {
    if (
      st.Kind === K.KindInterfaceDeclaration || st.Kind === K.KindTypeAliasDeclaration ||
      st.Kind === K.KindClassDeclaration || st.Kind === K.KindEnumDeclaration
    ) {
      if (st.name?.Text) names.push(st.name.Text);
    }
  }
  return names;
}

export { sliceText, identText, isExported, keywordOf, resolveModuleId, isSoftId, terminalName };
