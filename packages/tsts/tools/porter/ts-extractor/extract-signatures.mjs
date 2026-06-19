// Actual-side driver: parse a ported .ts file with TSTS's own parser and produce,
// per @tsgo-unit id, the structured signature descriptor of the declaration that
// the annotation introduces. The owning declaration is found by source position
// (the @tsgo-unit JSDoc is leading trivia of the statement it annotates, so the
// annotation offset falls inside that statement's [pos, end) range).

import { readFileSync } from "node:fs";
import {
  loadParser, parseSource, buildImportMap, buildLocalTypeNames, declarationDescriptor,
} from "./ast-signatures.mjs";

const DEFAULT_ANNOTATION = { tag: "@tsgo-unit", idSeparator: "::", methodNameJoin: "_" };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const annotationRegExp = (tag) => new RegExp(`${escapeRe(tag)}\\s+({[^\\n\\r]+})`, "g");

// The position of a declaration's NAME — the stable anchor for associating a
// @tsgo-unit annotation with the declaration it introduces. A declaration's
// trivia-inclusive Node_Pos can fall INSIDE its leading JSDoc (tsgo attaches the
// doc as a JSDoc node), so it is unreliable; the name identifier is always in
// real code after the JSDoc.
function declAnchor(api, st) {
  if (st.name) return api.Node_Pos(st.name);
  if (st.Kind === api.Kinds.KindVariableStatement) {
    const decls = st.DeclarationList?.Declarations?.Nodes ?? [];
    if (decls[0]?.name) return api.Node_Pos(decls[0].name);
  }
  return api.Node_Pos(st);
}

function declName(st) {
  return st.name?.Text;
}

// The TS declaration name a unit's @tsgo-unit metadata maps to, so the annotation
// binds to the right declaration even when non-tracked helper functions are
// interleaved between the JSDoc and the real declaration.
function expectedTsName(meta, annotation) {
  const parts = String(meta.id ?? "").split(annotation.idSeparator);
  const qn = parts[parts.length - 1] ?? "";
  if (meta.kind === "method") return qn.replace(".", annotation.methodNameJoin); // Receiver.method -> Receiver_method
  return qn; // func / type use the Go name verbatim
}

// moduleId: repo-relative posix path of the file (used for module identity).
// annotation: { tag, idSeparator, methodNameJoin } from the project profile.
export function extractFileDescriptors(api, moduleId, text, annotation = DEFAULT_ANNOTATION) {
  const sf = parseSource(api, "/" + moduleId, text);
  const base = {
    api,
    text,
    imports: buildImportMap(api, sf),
    localTypes: buildLocalTypeNames(api, sf),
    moduleId,
  };
  // Each statement keyed by its name position, ascending.
  const statements = (sf.Statements?.Nodes ?? [])
    .map((st) => ({ st, anchor: declAnchor(api, st) }))
    .sort((a, b) => a.anchor - b.anchor);
  const out = [];
  const re = annotationRegExp(annotation.tag);
  let m;
  while ((m = re.exec(text)) !== null) {
    let meta;
    try {
      meta = JSON.parse(m[1]);
    } catch {
      continue; // malformed metadata is reported by the porter's own scan
    }
    const off = m.index;
    // Bind to the first declaration after the annotation whose name matches the
    // unit (skipping interleaved non-tracked helpers); fall back to the first
    // declaration after the annotation for value groups and reserved-word renames.
    const after = statements.filter((s) => s.anchor > off);
    const isValueGroup = meta.kind === "constGroup" || meta.kind === "varGroup";
    const want = expectedTsName(meta, annotation);
    const owner = isValueGroup
      ? after.find((s) => s.st.Kind === api.Kinds.KindVariableStatement) ?? after[0]
      : after.find((s) => declName(s.st) === want) ?? after[0];
    out.push({
      id: meta.id,
      metaKind: meta.kind,
      metadata: meta,
      moduleId,
      descriptor: owner ? declarationDescriptor(api, owner.st, base) : null,
    });
  }
  return out;
}

// Convenience: read + extract for a single repo-relative file path.
export function extractFile(api, repoRoot, relPath) {
  const text = readFileSync(`${repoRoot}/${relPath}`, "utf8");
  return extractFileDescriptors(api, relPath, text);
}

// CLI: node extract-signatures.mjs <repo-relative-file.ts> [...]  -> JSON to stdout.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("extract-signatures.mjs");
if (invokedDirectly) {
  const api = await loadParser();
  const files = process.argv.slice(2);
  const result = {};
  for (const f of files) {
    const rel = f.replace(/^\.?\//, "");
    for (const u of extractFileDescriptors(api, rel, readFileSync(f, "utf8"))) {
      result[u.id] = { metaKind: u.metaKind, descriptor: u.descriptor };
    }
  }
  console.log(JSON.stringify(result, null, 2));
}
