// The generator of packages/host/src/front/syntax-capture.ts: the conversion of the checker's syntax tree to HIR's
// syntax phase, one case per HIR syntax kind, written from the HIR contract itself (kinds, fields, field types), HIR's
// own child order (ir-hir/children.ts) and the SDK's cast functions. The written file is ordinary reviewed source; the
// Front case "the syntax capture is current" regenerates it in memory and requires the committed file to be equal.
// Run `node scripts/host/generate-front-syntax.mjs --write` after a change to any of the three inputs.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSources } from "../../test/architecture/host/import-graph.mjs";

export const frontSyntaxPath = "packages/host/src/front/syntax-capture.ts";

/** The text of syntax-capture.ts for the repository at `root`, and the inputs it could not use (both lists empty when complete). */
export function generateFrontSyntax(root) {
const hirText = readFileSync(resolve(root, "packages/host/src/ir-hir/contract.ts"), "utf8");
const childrenText = readFileSync(resolve(root, "packages/host/src/ir-hir/children.ts"), "utf8");
const castsText = readFileSync(resolve(root, "packages/tsts/dist/src/internal/ast/generated/casts.d.ts"), "utf8");
const casts = new Set([...castsText.matchAll(/export declare function As(\w+)\(/g)].map(m => m[1]));
const parsed = parseSources(new Map([["hir.ts", hirText]]));
const { ast } = parsed;
const file = parsed.getSourceFiles().find(f => ast.getFileName(f) === "/host-gate/hir.ts");
const source = ast.getSourceText(file);
const text = node => { const r = ast.authoredRange(node); return source.slice(r.start, r.end); };
const shape = parsed.getSourceFileQueries(file).typeShape;
const decls = new Map();
for (const s of ast.statements(file)) if (ast.is.IsInterfaceDeclaration(s) || ast.is.IsTypeAliasDeclaration(s)) decls.set(ast.text(ast.name(s)), s);

// The kind literals a type can have, read from its `kind` property through the checker.
const literalValues = type => {
  if (type === undefined) return [];
  if (shape.isUnion(type)) return shape.getUnionOrIntersectionTypes(type).flatMap(literalValues);
  const value = shape.getStringLiteralTypeValue(type);
  return value === undefined ? [] : [value];
};
const kindsOfType = type => {
  if (type === undefined) return [];
  const nonNull = shape.getNonNullableType(type);
  if (shape.isUnion(nonNull)) return shape.getUnionOrIntersectionTypes(nonNull).flatMap(kindsOfType);
  const kind = shape.getPropertyInfos(nonNull).find(property => property.name === "kind");
  return kind === undefined ? [] : literalValues(kind.type);
};
const unionNode = ast.typeNode(decls.get("SyntaxNode"));
const members = ast.children(unionNode).filter(Boolean);
const header = new Set(["id", "origin", "parent", "flags", "loc", "kind", "tsonic"]);

// HIR child order per kind, from children.ts.
const childOrder = new Map();
let pendingLabels = [];
for (const block of childrenText.split(/\n(?=\s+case ")/)) {
  const labels = [...pendingLabels, ...[...block.matchAll(/case "(\w+)":/g)].map(m => m[1])];
  const fields = [...block.matchAll(/\["(\w+)", node\.(\w+)\]/g)].map(m => m[1]);
  if (fields.length === 0 && !/return /u.test(block)) { pendingLabels = labels; continue; }
  pendingLabels = [];
  for (const label of labels) if (!childOrder.has(label)) childOrder.set(label, fields);
}
const unordered = [];

const prefix = typeText => typeText.replace(/("[^"]*")|\b([A-Z]\w*)\b/g, (match, quoted, name) => quoted !== undefined ? quoted
  : name === "P" ? "Hir.SyntaxPhase" : `Hir.${name}`);
const guards = new Map();
const guardOf = (typeNode, label) => {
  const kinds = [...new Set(kindsOfType(shape.getTypeFromTypeNode(typeNode)))].sort();
  if (kinds.length === 0) throw new Error(`no kinds for ${label}: ${text(typeNode)}`);
  const key = kinds.join(",");
  if (!guards.has(key)) guards.set(key, { name: `isGroup${guards.size}`, kinds, type: prefix(text(typeNode).replace(/\s*\|\s*null$/u, "")) });
  return guards.get(key).name;
};

const sdkName = field => ["modifiers", "name"].includes(field) ? field : field[0].toUpperCase() + field.slice(1);
const scalarSource = {
  text: () => "view.Text",
  multiLine: () => "view.MultiLine",
  isExportEquals: () => "view.IsExportEquals",
  isTypeOnly: () => "view.IsTypeOnly",
  isTypeOf: () => "view.IsTypeOf",
  isArrayType: () => "view.IsArrayType",
  isBracketed: () => "view.IsBracketed",
  isNameFirst: () => "view.IsNameFirst",
  containsOnlyTriviaWhiteSpaces: () => "view.ContainsOnlyTriviaWhiteSpaces",
  tokenFlags: () => "tokenFlags(view.TokenFlags)",
  templateFlags: () => "tokenFlags(view.TemplateFlags)",
  rawText: () => "view.RawText",
};
const scalarByKind = {
  "PrefixUnaryExpression.operator": "prefixOperator(context, node)",
  "PostfixUnaryExpression.operator": "postfixOperator(context, node)",
  "TypeOperatorNode.operator": "typeOperator(context, node)",
  "HeritageClause.token": "heritageToken(context, node)",
  "ImportAttributes.token": "attributesToken(context, node)",
  "MetaProperty.keywordToken": "metaKeyword(context, node)",
  "ModuleDeclaration.keyword": "moduleKeyword(context, node)",
  "ImportClause.phaseModifier": "phaseModifier(context, node, view.PhaseModifier)",
  "SourceFile.languageVariant": "languageVariant(view.LanguageVariant)",
  "SourceFile.scriptKind": "scriptKind(view.ScriptKind)",
  "SourceFile.commentDirectives": "commentDirectives(context, view.CommentDirectives)",
  "SourceFile.pragmas": "pragmas(view.Pragmas)",
  "SourceFile.checkJsDirective": "checkJsDirective(view.CheckJsDirective)",
  "SyntaxList.children": "view.Children.map(child => one(context, child, id, isSyntax))",
  "JSDocText.text": "jsDocText(view.text)",
  "JSDocLink.text": "jsDocText(view.text)",
  "JSDocLinkPlain.text": "jsDocText(view.text)",
  "JSDocLinkCode.text": "jsDocText(view.text)",
  "JSDocTypeLiteral.jsDocPropertyTags": `view.JSDocPropertyTags === undefined ? null : view.JSDocPropertyTags.map(child => one(context, child, id, ${guardOf(ast.typeNode(decls.get("JSDocTag")), "JSDocTag")}))`,
};

const cases = [];
const missingCasts = [];
const expanded = members.flatMap(member => {
  const declaration = decls.get(text(member).replace(/<.*$/su, ""));
  return ast.is.IsTypeAliasDeclaration(declaration) ? ast.children(ast.typeNode(declaration)).filter(Boolean) : [member];
});
for (const member of expanded) {
  const name = text(member).replace(/<.*$/su, "");
  const declaration = decls.get(name);
  const kinds = [...new Set(kindsOfType(shape.getTypeFromTypeNode(member)))].sort();
  const props = ast.members(declaration).filter(m => ast.is.IsPropertySignatureDeclaration(m));
  const fields = props.filter(p => !header.has(ast.text(ast.name(p))));
  if (fields.length === 0) {
    cases.push({ labels: kinds, body: kinds.length === 1
      ? [`      return { kind: "${kinds[0]}", ...headerOf(context, node, context.next(node), parent), tsonic: null };`]
      : null, kinds });
    continue;
  }
  const castName = { ForInStatement: "ForInOrOfStatement", ForOfStatement: "ForInOrOfStatement", CaseClause: "CaseOrDefaultClause", DefaultClause: "CaseOrDefaultClause" }[name] ?? name;
  if (!casts.has(castName) && name !== "SourceFile") missingCasts.push(name);
  const order = childOrder.get(kinds[0]) ?? [];
  if (!childOrder.has(kinds[0])) unordered.push(kinds[0]);
  const byName = new Map(fields.map(p => [ast.text(ast.name(p)), p]));
  const ordered = [...order.filter(f => byName.has(f)), ...[...byName.keys()].filter(f => !order.includes(f))];
  const lines = [name === "SourceFile" ? "      const view = context.file;" : `      const view = context.ast.as.As${castName}(node);`, `      if (view === undefined) return defect("the checker gave no ${name} view of a ${kinds[0]} node");`,
    `      const id = context.next(node);`, `      const header = headerOf(context, node, id, parent);`];
  const assigned = [];
  for (const field of ordered) {
    const property = byName.get(field);
    const typeNode = ast.typeNode(property);
    const typeText = text(typeNode);
    const nullable = /\|\s*null$/u.test(typeText);
    const sdk = sdkName(field);
    let expression;
    if (typeText === "null") expression = "null";
    else if (scalarByKind[`${name}.${field}`] !== undefined) expression = scalarByKind[`${name}.${field}`];
    else if (/^ModifierList</u.test(typeText)) expression = `modifierList(context, view.${sdk}, id, ${guardOf(ast.typeNode(decls.get("ModifierLike")), "ModifierLike")})`;
    else if (/^NodeList</u.test(typeText)) {
      const reference = ast.is.IsUnionTypeNode(typeNode) ? ast.children(typeNode).find(child => child !== undefined && ast.is.IsTypeReferenceNode(child)) : typeNode;
      const element = ast.typeArguments(reference)[0];
      expression = `${nullable ? "listOrNull" : "list"}(context, view.${sdk}, id, ${guardOf(element, `${name}.${field}`)})`;
    } else if (kindsOfType(shape.getTypeFromTypeNode(typeNode)).length > 0) {
      expression = `${nullable ? "oneOrNull" : "one"}(context, view.${sdk}, id, ${guardOf(typeNode, `${name}.${field}`)})`;
    } else if (scalarSource[field] !== undefined) expression = scalarSource[field]();
    else throw new Error(`no source for scalar ${name}.${field}: ${typeText}`);
    if (/(^one|^oneOrNull|^list|^listOrNull|^modifierList)\(/u.test(expression) && !order.includes(field)) throw new Error(`node field ${name}.${field} has no place in HIR's child order`);
    lines.push(`      const ${field}_ = ${expression};`);
    assigned.push(`${field}: ${field}_`);
  }
  for (const kind of kinds) cases.push({ labels: [kind], body: [...lines, `      return { kind: "${kind}", ...header, ${assigned.join(", ")}, tsonic: null };`], kinds: [kind] });
}

const helpers = [
  "",
  "type Guard<T extends Hir.SyntaxNode<Hir.SyntaxPhase>> = (node: Hir.SyntaxNode<Hir.SyntaxPhase>) => node is T;",
  "",
  "function one<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, child: SyntaxNodeOf | undefined, parent: NodeId, guard: Guard<T>): T {",
  "  if (child === undefined) return defect(\"the checker's tree lacks a child that HIR's schema requires\");",
  "  const node = captureNode(context, child, parent);",
  "  return guard(node) ? node : defect(\`a \${node.kind} node stands where HIR's schema does not admit it\`);",
  "}",
  "",
  "function oneOrNull<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, child: SyntaxNodeOf | undefined, parent: NodeId, guard: Guard<T>): T | null {",
  "  return child === undefined ? null : one(context, child, parent, guard);",
  "}",
  "",
  "function list<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<T>): Hir.NodeList<T> {",
  "  if (nodes === undefined) return defect(\"the checker's tree lacks a list that HIR's schema requires\");",
  "  return { loc: rangeOf(context, nodes.Loc), nodes: nodes.Nodes.map(child => one(context, child, parent, guard)) };",
  "}",
  "",
  "function listOrNull<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<T>): Hir.NodeList<T> | null {",
  "  return nodes === undefined ? null : list(context, nodes, parent, guard);",
  "}",
  "",
  "function modifierList(context: SyntaxCaptureContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<Hir.ModifierLike<Hir.SyntaxPhase>>): Hir.ModifierList<Hir.SyntaxPhase> | null {",
  "  return nodes === undefined ? null : list(context, nodes, parent, guard);",
  "}",
  "",
];
const out = [];
out.push(`// The checker's syntax tree as HIR's syntax phase: one case per HIR syntax kind, with the fields HIR declares, in`);
out.push(`// HIR's own child order (ir-hir/children.ts), so that node identities are the module's preorder positions.`);
out.push(`// Written with the help of a one-off script from the HIR contract; edited and reviewed as ordinary source.`);
out.push(`import type * as Hir from "../ir-hir/contract.js";`);
out.push(`import type { NodeId } from "../ids/contract.js";`);
out.push(`import type { SdkNodeList, SyntaxCaptureContext, SyntaxNodeOf } from "./syntax-support.js";`);
out.push(`import { attributesToken, checkJsDirective, commentDirectives, defect, headerOf, heritageToken, jsDocText, languageVariant, metaKeyword, moduleKeyword, phaseModifier, postfixOperator, pragmas, prefixOperator, rangeOf, scriptKind, tokenFlags, typeOperator } from "./syntax-support.js";`);
out.push(...helpers);
out.push(``);
for (const guard of guards.values()) {
  out.push(`const ${guard.name}Kinds: readonly string[] = [${guard.kinds.map(k => `"${k}"`).join(", ")}];`);
  out.push(`function ${guard.name}(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is ${guard.type} { return ${guard.name}Kinds.includes(node.kind); }`);
}
out.push(`/** The kinds of HIR's expression syntax. */`);
out.push(`export const expressionKinds: readonly string[] = [${[...new Set(kindsOfType(shape.getTypeFromTypeNode(ast.typeNode(decls.get("Expression")))))].sort().map(kind => `"${kind}"`).join(", ")}];`);
out.push(`function isSyntax(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.SyntaxNode<Hir.SyntaxPhase> { return isSyntaxKinds.includes(node.kind); }`);
out.push(`const isSyntaxKinds: readonly string[] = [${[...new Set(cases.flatMap(entry => entry.kinds))].sort().map(kind => `"${kind}"`).join(", ")}];`);
out.push(``);
out.push(`/** One node of the checker's tree, converted with everything below it; its identity is the next preorder position. */`);
out.push(`export function captureNode(context: SyntaxCaptureContext, node: SyntaxNodeOf, parent: NodeId | null): Hir.SyntaxNode<Hir.SyntaxPhase> {`);
out.push(`  switch (context.ast.kindName(node)) {`);
for (const entry of cases) {
  if (entry.body === null) {
    for (const kind of entry.labels) {
      out.push(`    case "Kind${kind}":`);
      out.push(`      return { kind: "${kind}", ...headerOf(context, node, context.next(node), parent), tsonic: null };`);
    }
    continue;
  }
  for (const kind of entry.labels) out.push(`    case "Kind${kind}":`);
  out.push(`    {`);
  out.push(...entry.body);
  out.push(`    }`);
}
out.push(`    default:`);
out.push(`      return defect(\`the checker's syntax kind \${context.ast.kindName(node)} has no HIR syntax kind\`);`);
out.push(`  }`);
out.push(`}`);
return { text: `${out.join("\n")}\n`, unordered, missingCasts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const generated = generateFrontSyntax(root);
  if (generated.unordered.length > 0 || generated.missingCasts.length > 0)
    throw new Error(`kinds with fields and no child order: ${generated.unordered.join(" ")}; missing casts: ${generated.missingCasts.join(" ")}`);
  if (process.argv.includes("--write")) writeFileSync(resolve(root, frontSyntaxPath), generated.text);
  else process.stdout.write(readFileSync(resolve(root, frontSyntaxPath), "utf8") === generated.text ? "current\n" : "stale\n");
}
