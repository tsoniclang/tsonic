// The generator of packages/host/src/front/syntax-capture.ts: the conversion of the checker's syntax tree to HIR's
// syntax phase, one case per HIR syntax kind, written from the HIR contract itself (kinds, fields, field types), HIR's
// own child order (ir-hir/children.ts) and the SDK's cast functions. The written file is ordinary reviewed source; the
// Front case "the syntax capture is current" regenerates it in memory and requires the committed file to be equal.
// Run `node scripts/host/generate-front-syntax.mjs --write` after a change to any of the three inputs.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseSources } from "../../test/architecture/host/import-graph.mjs";

export const frontSyntaxPath = "packages/host/src/front/syntax-capture.ts";

/** The text of syntax-capture.ts for the repository at `root`, and the inputs it could not use (both lists empty when complete). */
export async function generateFrontSyntax(root) {
const hirText = readFileSync(resolve(root, "packages/host/src/ir-hir/contract.ts"), "utf8");
const { iterateNullableSyntaxSlots } = await import(pathToFileURL(resolve(root, "packages/host/dist/ir-hir/children.js")).href);
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
  if (nonNull === undefined) return [];
  if (shape.isUnion(nonNull)) return shape.getUnionOrIntersectionTypes(nonNull).flatMap(kindsOfType);
  const structured = shape.getStructuredInventory(nonNull, () => null);
  if (structured.kind !== "complete") throw new TypeError("A generation target requires its actual owning property inventory.");
  const inventory = structured.value.properties;
  for (;;) {
    const row = inventory.next();
    if (row.kind !== "complete") throw new TypeError("An admitted generation field requires its actual effective property.");
    if (row.value === null) return [];
    if (row.value.name === "kind") return literalValues(row.value.type);
  }
};
const unionNode = ast.typeNode(decls.get("SyntaxNode"));
const members = ast.children(unionNode).filter(Boolean);
const header = new Set(["id", "origin", "parent", "flags", "loc", "kind", "tsonic"]);

const inheritedProperties = declaration => {
  const base = ast.heritageElements(declaration, "extends").flatMap(heritage => {
    const name = ast.as.AsExpressionWithTypeArguments(heritage)?.Expression;
    const parent = name === undefined ? undefined : decls.get(ast.text(name));
    return parent === undefined ? [] : inheritedProperties(parent);
  });
  return [...base, ...ast.members(declaration).filter(ast.is.IsPropertySignatureDeclaration)];
};
const childOrder = (kind, fields) => {
  const list = Object.assign([null], { nodes: [null] });
  const seed = Object.fromEntries(fields.map(field => [field, list]));
  return [...new Set(Array.from(iterateNullableSyntaxSlots({ ...seed, kind }), slot => slot.fields[0]))];
};
const unordered = [];

const prefix = typeText => typeText.replace(/("[^"]*")|\b([A-Z]\w*)\b/g, (match, quoted, name) => quoted !== undefined ? quoted
  : name === "P" ? "Hir.SyntaxPhase" : `Hir.${name}`);
const guards = new Map();
const guardOf = (typeNode, label) => {
  const kinds = [...new Set(kindsOfType(shape.getTypeFromTypeNode(typeNode)?.type))].sort();
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
const phaseField = {
  "ParameterDeclaration.initializer": "ParameterInitializer",
  "CallExpression.arguments": "CallArguments",
};
const scalarByKind = {
  "PrefixUnaryExpression.operator": "prefixOperator(context, node)",
  "PostfixUnaryExpression.operator": "postfixOperator(context, node)",
  "TypeOperatorNode.operator": "typeOperator(context, node)",
  "HeritageClause.token": "heritageToken(context, view.Token)",
  "ImportAttributes.token": "attributesToken(context, view.Token)",
  "MetaProperty.keywordToken": "metaKeyword(context, view.KeywordToken)",
  "ModuleDeclaration.keyword": "moduleKeyword(context, node)",
  "ImportClause.phaseModifier": "phaseModifier(context, node, view.PhaseModifier)",
  "SourceFile.languageVariant": "languageVariant(view.LanguageVariant)",
  "SourceFile.scriptKind": "scriptKind(view.ScriptKind)",
  "SourceFile.commentDirectives": "commentDirectives(context, view.CommentDirectives)",
  "SourceFile.pragmas": "context.pragmas",
  "SourceFile.checkJsDirective": "context.checkJsDirective",
  "SyntaxList.children": "view.Children.map(child => one(context, child, id, isSyntax))",
  "NumericLiteral.text": "numericSyntaxText(context, node, header.origin)",
  "BigIntLiteral.text": "numericSyntaxText(context, node, header.origin)",
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
  const kinds = [...new Set(kindsOfType(shape.getTypeFromTypeNode(member)?.type))].sort();
  const props = inheritedProperties(declaration);
  const fields = props.filter(p => !header.has(ast.text(ast.name(p))));
  if (fields.length === 0) {
    cases.push({ labels: kinds, body: kinds.length === 1
      ? [`      return { kind: "${kinds[0]}", ...headerOf(context, node, context.next(node), parent), tsonic: null };`]
      : null, kinds });
    continue;
  }
  const castName = { ForInStatement: "ForInOrOfStatement", ForOfStatement: "ForInOrOfStatement", CaseClause: "CaseOrDefaultClause", DefaultClause: "CaseOrDefaultClause" }[name] ?? name;
  if (!casts.has(castName) && name !== "SourceFile") missingCasts.push(name);
  const byName = new Map(fields.map(p => [ast.text(ast.name(p)), p]));
  const order = childOrder(kinds[0], [...byName.keys()]);
  const ordered = [...order.filter(f => byName.has(f)), ...[...byName.keys()].filter(f => !order.includes(f))];
  const lines = [name === "SourceFile" ? "      const view = context.file;" : `      const view = context.ast.as.As${castName}(node);`, `      if (view === undefined) return defect("the checker gave no ${name} view of a ${kinds[0]} node");`,
    `      const id = context.next(node);`, `      const header = headerOf(context, node, id, parent);`];
  const assigned = [];
  for (const field of ordered) {
    const property = byName.get(field);
    const syntaxSlot = phaseField[`${name}.${field}`];
    const typeNode = syntaxSlot === undefined ? ast.typeNode(property)
      : ast.typeNode(ast.members(decls.get("SyntaxPhase")).find(member => ast.text(ast.name(member)) === syntaxSlot));
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
    } else if (kindsOfType(shape.getTypeFromTypeNode(typeNode)?.type).length > 0) {
      expression = `${nullable ? "oneOrNull" : "one"}(context, view.${sdk}, id, ${guardOf(typeNode, `${name}.${field}`)})`;
    } else if (scalarSource[field] !== undefined) expression = scalarSource[field]();
    else throw new Error(`no source for scalar ${name}.${field}: ${typeText}`);
    if (/(^one|^oneOrNull|^list|^listOrNull|^modifierList)\(/u.test(expression) && !order.includes(field)) unordered.push(`${name}.${field}`);
    lines.push(`      const ${field}_ = ${expression};`);
    assigned.push(`${field}: ${field}_`);
  }
  if (name === "LiteralTypeNode") lines.push(
    "      const numeric = authoredNumericType(context, node);",
    "      if (numeric !== null) context.numericLiterals.set(node, numeric);",
  );
  for (const kind of kinds) cases.push({ labels: [kind], body: [...lines, `      return { kind: "${kind}", ...header, ${assigned.join(", ")}, tsonic: null };`], kinds: [kind] });
}

const helpers = [
  "",
  "type Guard<T extends Hir.SyntaxNode<Hir.SyntaxPhase>> = (node: Hir.SyntaxNode<Hir.SyntaxPhase>) => node is T;",
  "",
  "interface SyntaxBuildContext extends SyntaxCaptureContext {",
  "  readonly next: (node: SyntaxNodeOf) => NodeId;",
  "  readonly completed: readonly (Hir.SyntaxNode<Hir.SyntaxPhase> | undefined)[];",
  "  previousChild: number;",
  "}",
  "",
  "interface CapturedSyntax {",
  "  readonly tree: Hir.SyntaxNode<Hir.SyntaxPhase>;",
  "  readonly syntaxOf: (id: NodeId) => Hir.SyntaxNode<Hir.SyntaxPhase> | undefined;",
  "}",
  "",
  "export function captureNode(context: SyntaxCaptureContext, root: SyntaxNodeOf, parent: NodeId | null): CapturedSyntax {",
  "  const { nodes, ids, parents } = context.numbering;",
  "  if (nodes[0] !== root) return defect(\"syntax assembly requires the actual numbered root\");",
  "  const completed: (Hir.SyntaxNode<Hir.SyntaxPhase> | undefined)[] = new Array(nodes.length);",
  "  const next = (node: SyntaxNodeOf): NodeId => {",
  "    const id = ids.get(node);",
  "    return id !== undefined && nodes[id] === node ? id : defect(\"a syntax node has no admitted identity\");",
  "  };",
  "  for (let index = nodes.length - 1; index >= 0; index -= 1) {",
  "    const node = nodes[index];",
  "    if (node === undefined) return defect(\"the admitted syntax inventory has a hole\");",
  "    const id = next(node);",
  "    const owner = node === root ? parent : parents.get(node);",
  "    if (owner === undefined) return defect(\"a syntax node has no admitted parent\");",
  "    completed[id] = buildNode({ ...context, next, completed, previousChild: id }, node, owner);",
  "  }",
  "  const tree = completed[next(root)] ?? defect(\"syntax assembly did not complete its numbered root\");",
  "  return { tree, syntaxOf: id => completed[id] };",
  "}",
  "",
  "function one<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxBuildContext, child: SyntaxNodeOf | undefined, parent: NodeId, guard: Guard<T>): T {",
  "  if (child === undefined) return defect(\"the checker's tree lacks a child that HIR's schema requires\");",
  "  const node = context.completed[context.next(child)] ?? defect(\"a syntax child is not completed before its containing node\");",
  "  if (node.parent !== parent || node.id <= context.previousChild) return defect(\"syntax children disagree with the admitted parent or preorder\");",
  "  context.previousChild = node.id;",
  "  return guard(node) ? node : defect(\`a \${node.kind} node stands where HIR's schema does not admit it\`);",
  "}",
  "",
  "function oneOrNull<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxBuildContext, child: SyntaxNodeOf | undefined, parent: NodeId, guard: Guard<T>): T | null {",
  "  return child === undefined ? null : one(context, child, parent, guard);",
  "}",
  "",
  "function list<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxBuildContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<T>): Hir.NodeList<T> {",
  "  if (nodes === undefined) return defect(\"the checker's tree lacks a list that HIR's schema requires\");",
  "  return { loc: rangeOf(context, nodes.Loc), nodes: nodes.Nodes.map(child => one(context, child, parent, guard)) };",
  "}",
  "",
  "function listOrNull<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxBuildContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<T>): Hir.NodeList<T> | null {",
  "  return nodes === undefined ? null : list(context, nodes, parent, guard);",
  "}",
  "",
  "function modifierList(context: SyntaxBuildContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<Hir.ModifierLike<Hir.SyntaxPhase>>): Hir.ModifierList<Hir.SyntaxPhase> | null {",
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
out.push(`import { authoredNumericType, attributesToken, commentDirectives, defect, headerOf, heritageToken, jsDocText, languageVariant, metaKeyword, moduleKeyword, numericSyntaxText, phaseModifier, postfixOperator, prefixOperator, rangeOf, scriptKind, tokenFlags, typeOperator } from "./syntax-support.js";`);
out.push(...helpers);
out.push(``);
for (const guard of guards.values()) {
  const typeNodes = guard.type === "Hir.TypeNode<Hir.SyntaxPhase>";
  const name = typeNodes ? "typeNodeKinds" : `${guard.name}Kinds`;
  out.push(`${typeNodes ? "export " : ""}const ${name}: readonly string[] = [${guard.kinds.map(k => `"${k}"`).join(", ")}];`);
  out.push(`${typeNodes ? "export " : ""}function ${guard.name}(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is ${guard.type} { return ${name}.includes(node.kind); }`);
}
out.push(`/** The kinds of HIR's expression syntax. */`);
out.push(`export const expressionKinds: readonly string[] = [${[...new Set(kindsOfType(shape.getTypeFromTypeNode(ast.typeNode(decls.get("Expression")))?.type))].sort().map(kind => `"${kind}"`).join(", ")}];`);
out.push(`function isSyntax(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.SyntaxNode<Hir.SyntaxPhase> { return isSyntaxKinds.includes(node.kind); }`);
out.push(`const isSyntaxKinds: readonly string[] = [${[...new Set(cases.flatMap(entry => entry.kinds))].sort().map(kind => `"${kind}"`).join(", ")}];`);
out.push(``);
out.push(`/** One node of the checker's tree, converted with everything below it; its identity is the next preorder position. */`);
out.push(`function buildNode(context: SyntaxBuildContext, node: SyntaxNodeOf, parent: NodeId | null): Hir.SyntaxNode<Hir.SyntaxPhase> {`);
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
  const generated = await generateFrontSyntax(root);
  if (generated.unordered.length > 0 || generated.missingCasts.length > 0)
    throw new Error(`kinds with fields and no child order: ${generated.unordered.join(" ")}; missing casts: ${generated.missingCasts.join(" ")}`);
  if (process.argv.includes("--write")) writeFileSync(resolve(root, frontSyntaxPath), generated.text);
  else process.stdout.write(readFileSync(resolve(root, frontSyntaxPath), "utf8") === generated.text ? "current\n" : "stale\n");
}
