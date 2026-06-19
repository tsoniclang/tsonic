// TSTS AST generator.
//
// Reads the checked-in AST schema (packages/tsts/schema/tsgo/*) and emits the
// generated AST infrastructure under packages/tsts/src/internal/ast/generated/.
// This is the TypeScript analogue of TS-Go's ast_generated.go / kind_generated.go
// / kind_stringer_generated.go, produced deterministically from the same schema.
//
// Output files carry file-level @tsgo-generated metadata and are checked the same
// way as the Go-compat facades: missing / stale / orphan / untracked / invalid.
// Safe-write contract: create missing, no-op identical, fail on different unless
// --force.
//
// Emitters are intentionally incremental. The NodeData-independent surfaces
// (kinds, flags) land first; node/data/adapters/factory/visitor follow under the
// same pipeline.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { hashText, resolveRepo, writeTextSafely } from "./porter.mjs";
import { AstSchema } from "./ast-schema-model.mjs";

const GENERATOR = "porter:ast";
const GENERATED_KIND = "ast-generated";

// ---------------------------------------------------------------------------
// Config / schema loading
// ---------------------------------------------------------------------------

export function astConfig(config) {
  const tsRoot = (config.tsRoot ?? "packages/tsts/src").replace(/\/$/, "");
  return {
    tsRoot,
    schemaDir: config.astSchemaDir ?? "packages/tsts/schema/tsgo",
    generatedDir: config.astGeneratedDir ?? "internal/ast/generated",
    schemaInputs: config.astSchemaInputs ?? [
      "packages/tsts/schema/tsgo/ast.json",
      "packages/tsts/schema/tsgo/ast.schema.json",
      "packages/tsts/schema/tsgo/nodeflags.go",
      "packages/tsts/schema/tsgo/symbolflags.go",
    ],
  };
}

export function loadAstSchema(config) {
  const ac = astConfig(config);
  const astJsonPath = resolveRepo(path.join(ac.schemaDir, "ast.json"));
  const nodeFlagsPath = resolveRepo(path.join(ac.schemaDir, "nodeflags.go"));
  const symbolFlagsPath = resolveRepo(path.join(ac.schemaDir, "symbolflags.go"));
  return {
    ast: JSON.parse(readFileSync(astJsonPath, "utf8")),
    nodeFlagsSource: readFileSync(nodeFlagsPath, "utf8"),
    symbolFlagsSource: readFileSync(symbolFlagsPath, "utf8"),
  };
}

// ---------------------------------------------------------------------------
// Go const-block evaluation (for flag bit values)
//
// Go integer-constant precedence differs from JavaScript: `<<`/`>>`/`&`/`&^`
// bind tighter than `+`/`-`/`|`/`^`. We therefore evaluate each flag to its
// concrete uint32 value with Go precedence instead of re-emitting an expression
// that JavaScript would parse differently.
// ---------------------------------------------------------------------------

function tokenizeGoExpr(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t") {
      i += 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[0-9xXa-fA-F_]/.test(input[j])) j += 1;
      tokens.push({ type: "number", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j += 1;
      tokens.push({ type: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (two === "<<" || two === ">>" || two === "&^") {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }
    if ("|&^+-*/()~".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    throw new Error(`unexpected character in Go const expression: ${JSON.stringify(ch)} in ${JSON.stringify(input)}`);
  }
  return tokens;
}

function parseGoIntLiteral(text) {
  const normalized = text.replaceAll("_", "");
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`invalid integer literal: ${text}`);
  return value;
}

// Precedence-climbing evaluator. Higher number binds tighter.
const GO_BINARY_PRECEDENCE = {
  "|": 1,
  "^": 1,
  "+": 2,
  "-": 2,
  "*": 3,
  "/": 3,
  "<<": 4,
  ">>": 4,
  "&": 4,
  "&^": 4,
};

function evalGoExpr(tokens, lookup) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const parsePrimary = () => {
    const token = next();
    if (!token) throw new Error("unexpected end of Go const expression");
    if (token.type === "number") return parseGoIntLiteral(token.value);
    if (token.type === "ident") {
      if (!(token.value in lookup)) throw new Error(`unknown identifier in const expression: ${token.value}`);
      return lookup[token.value];
    }
    if (token.value === "(") {
      const inner = parseExpr(0);
      const close = next();
      if (!close || close.value !== ")") throw new Error("missing closing paren in const expression");
      return inner;
    }
    if (token.value === "-") return -parseUnary();
    if (token.value === "+") return parseUnary();
    if (token.value === "^" || token.value === "~") return ~parseUnary();
    throw new Error(`unexpected token in const expression: ${token.value}`);
  };

  function parseUnary() {
    const token = peek();
    if (token && token.type === "op" && (token.value === "-" || token.value === "+" || token.value === "^" || token.value === "~")) {
      next();
      const operand = parseUnary();
      if (token.value === "-") return -operand;
      if (token.value === "+") return operand;
      return ~operand;
    }
    return parsePrimary();
  }

  function parseExpr(minPrecedence) {
    let left = parseUnary();
    while (true) {
      const token = peek();
      if (!token || token.type !== "op") break;
      const precedence = GO_BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;
      next();
      const right = parseExpr(precedence + 1);
      left = applyGoBinary(token.value, left, right);
    }
    return left;
  }

  const result = parseExpr(0);
  if (pos !== tokens.length) throw new Error("trailing tokens in Go const expression");
  return result;
}

function applyGoBinary(op, left, right) {
  switch (op) {
    case "|":
      return left | right;
    case "^":
      return left ^ right;
    case "&":
      return left & right;
    case "&^":
      return left & ~right;
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return Math.trunc(left / right);
    case "<<":
      return left << right;
    case ">>":
      return left >> right;
    default:
      throw new Error(`unsupported operator: ${op}`);
  }
}

// Parse a `type Name uintNN` + single `const ( ... )` block, returning the
// ordered list of { name, value, comment } with each value evaluated to uint32.
export function parseGoFlagFile(source, typeName) {
  const typeMatch = new RegExp(`type\\s+${typeName}\\s+(u?int\\d+)`).exec(source);
  if (!typeMatch) throw new Error(`could not find 'type ${typeName} ...' declaration`);
  const constStart = source.indexOf("const (", typeMatch.index);
  if (constStart < 0) throw new Error(`could not find const block for ${typeName}`);
  const bodyStart = source.indexOf("\n", constStart) + 1;
  const constEnd = source.indexOf("\n)", bodyStart);
  if (constEnd < 0) throw new Error(`unterminated const block for ${typeName}`);
  const body = source.slice(bodyStart, constEnd);

  const lookup = {};
  const entries = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line === "") {
      entries.push({ kind: "blank" });
      continue;
    }
    if (line.startsWith("//")) {
      entries.push({ kind: "comment", text: line.slice(2).trim() });
      continue;
    }
    // Name [Type] = expr [// comment]
    const commentSplit = splitTrailingComment(line);
    const decl = commentSplit.code.trim();
    const eq = decl.indexOf("=");
    if (eq < 0) throw new Error(`unparseable const line for ${typeName}: ${line}`);
    const lhs = decl.slice(0, eq).trim().split(/\s+/);
    const name = lhs[0];
    const exprText = decl.slice(eq + 1).trim();
    const value = evalGoExpr(tokenizeGoExpr(exprText), lookup) >>> 0;
    lookup[name] = value;
    entries.push({ kind: "const", name, value, comment: commentSplit.comment });
  }
  return entries;
}

function splitTrailingComment(line) {
  // Flag files have no string literals, so the first `//` outside none begins a comment.
  const idx = line.indexOf("//");
  if (idx < 0) return { code: line, comment: "" };
  return { code: line.slice(0, idx), comment: line.slice(idx + 2).trim() };
}

// ---------------------------------------------------------------------------
// Emitters
// ---------------------------------------------------------------------------

export function emitKinds(schema) {
  const elements = schema.ast.kinds?.elements ?? [];
  const markers = schema.ast.kinds?.markers ?? [];
  const lines = [];
  lines.push(`import type { short } from "../../../go/scalars.js";`);
  lines.push("");
  lines.push("// SyntaxKind constants. Go: type Kind int16 (iota-sequential).");
  lines.push("export type Kind = short;");
  lines.push("");

  const names = [];
  let index = 0;
  for (const element of elements) {
    if (typeof element === "string") {
      lines.push(`export const Kind${element}: Kind = ${index};`);
      names.push(element);
      index += 1;
      continue;
    }
    if (element && typeof element === "object") {
      if (element.name) {
        const suffix = element.comment ? ` // ${element.comment}` : "";
        lines.push(`export const Kind${element.name}: Kind = ${index};${suffix}`);
        names.push(element.name);
        index += 1;
        continue;
      }
      if (element.comment) {
        lines.push(`// ${element.comment}`);
        continue;
      }
    }
    throw new Error(`unsupported kind element: ${JSON.stringify(element)}`);
  }

  if (markers.length > 0) {
    lines.push("");
    lines.push("// Range markers (aliases of existing kinds).");
    for (const marker of markers) {
      lines.push(`export const Kind${marker.name}: Kind = Kind${marker.value};`);
    }
  }

  const aliases = Object.keys(schema.ast.kinds?.aliases ?? {}).sort();
  if (aliases.length > 0) {
    lines.push("");
    lines.push("// Kind aliases. Go: type X = Kind.");
    for (const alias of aliases) {
      lines.push(`export type ${alias} = Kind;`);
    }
  }

  // Faithful analogue of the Go stringer: returns the constant name, or
  // `Kind(n)` for out-of-range values.
  lines.push("");
  lines.push("const kindNames: readonly string[] = [");
  for (const name of names) {
    lines.push(`  "Kind${name}",`);
  }
  lines.push("];");
  lines.push("");
  lines.push("export function KindString(kind: Kind): string {");
  lines.push("  const value = kind as number;");
  lines.push("  if (value >= 0 && value < kindNames.length) return kindNames[value]!;");
  lines.push("  return `Kind(${value})`;");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function emitFlags(schema) {
  const nodeFlags = parseGoFlagFile(schema.nodeFlagsSource, "NodeFlags");
  const symbolFlags = parseGoFlagFile(schema.symbolFlagsSource, "SymbolFlags");
  const lines = [];
  lines.push(`import type { uint } from "../../../go/scalars.js";`);
  lines.push("");
  emitFlagGroup(lines, "NodeFlags", "Go: type NodeFlags uint32", nodeFlags);
  lines.push("");
  emitFlagGroup(lines, "SymbolFlags", "Go: type SymbolFlags uint32", symbolFlags);
  lines.push("");
  return lines.join("\n");
}

function emitFlagGroup(lines, typeName, banner, entries) {
  lines.push(`// ${banner}`);
  lines.push(`export type ${typeName} = uint;`);
  for (const entry of entries) {
    if (entry.kind === "blank") {
      lines.push("");
      continue;
    }
    if (entry.kind === "comment") {
      lines.push(`// ${entry.text}`);
      continue;
    }
    const suffix = entry.comment ? ` // ${entry.comment}` : "";
    lines.push(`export const ${entry.name}: ${typeName} = ${entry.value};${suffix}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// AST node/data/factory/etc emitters (free-fn/adapter model).
//
// These port generate-go-ast.ts's emission rules but produce Codex's Go-faithful
// free-function + interface-adapter TypeScript instead of Go. The output mirrors
// ast_generated.go structurally: bases, aliases, concrete data interfaces +
// `Concrete_as_nodeData` adapters, factories, predicates, casts, visitor tables.
// ───────────────────────────────────────────────────────────────────────────

const HAND_WRITTEN_BASES = new Set(["NodeBase"]);

// The 20 nodeData methods, in declaration order, with their default targets in
// spine.ts. Methods overridden by hand-written base structs resolve (via Go
// embedding promotion) to that base's free-fn; the rest fall to NodeDefault_*.
// Generated per-concrete overrides exist for Clone/ForEachChild/VisitEachChild/
// computeSubtreeFacts (+ subtreeFactsWorker via CompositeBase). Hand-written
// visitor exceptions route through ast.ts.
const NODE_DATA_METHODS = [
  "AsNode",
  "ForEachChild",
  "IterChildren",
  "VisitEachChild",
  "Clone",
  "Name",
  "Modifiers",
  "setModifiers",
  "FlowNodeData",
  "DeclarationData",
  "ExportableData",
  "LocalsContainerData",
  "FunctionLikeData",
  "ClassLikeData",
  "BodyData",
  "LiteralLikeData",
  "TemplateLiteralLikeData",
  "SubtreeFacts",
  "computeSubtreeFacts",
  "subtreeFactsWorker",
  "propagateSubtreeFacts",
];

// Hand-written base data-view method providers (ast.go), keyed by method ->
// ordered list of bases that provide an override. The generator resolves the
// MOST-DERIVED provider for each concrete by walking its base chain.
const BASE_METHOD_PROVIDERS = {
  DeclarationData: ["NamedMemberBase", "DeclarationBase"],
  ExportableData: ["ExportableBase"],
  Modifiers: ["NamedMemberBase", "ModifiersBase"],
  setModifiers: ["NamedMemberBase", "ModifiersBase"],
  Name: ["NamedMemberBase", "ClassLikeBase"],
  LocalsContainerData: ["FunctionLikeWithBodyBase", "FunctionLikeBase", "LocalsContainerBase"],
  FunctionLikeData: ["FunctionLikeWithBodyBase", "FunctionLikeBase"],
  BodyData: ["FunctionLikeWithBodyBase", "BodyBase"],
  FlowNodeData: ["FlowNodeBase"],
  LiteralLikeData: ["TemplateLiteralLikeNodeBase", "LiteralLikeNodeBase"],
  TemplateLiteralLikeData: ["TemplateLiteralLikeNodeBase"],
  ClassLikeData: ["ClassLikeBase"],
  subtreeFactsWorker: ["CompositeBase"],
  // computeSubtreeFacts: ClassLikeBase provides a base override; otherwise the
  // generated per-node Concrete_computeSubtreeFacts wins. Handled specially.
};

// Hand-written CONCRETE-type setModifiers overrides (ast.go), ported in ast.ts.
// Go: func (node *BinaryExpression) setModifiers(modifiers *ModifierList) { node.modifiers = modifiers }
const AST_MANUAL_SET_MODIFIERS = new Set(["BinaryExpression"]);

const AST_MANUAL_COMPUTE_SUBTREE_FACTS = new Set([
  "AccessorDeclarationBase",
  "ArrowFunction",
  "AsExpression",
  "AwaitExpression",
  "BigIntLiteral",
  "BinaryExpression",
  "BindingElement",
  "BindingPattern",
  "CallExpression",
  "CatchClause",
  "ClassStaticBlockDeclaration",
  "ConstructorDeclaration",
  "Decorator",
  "EnumDeclaration",
  "EnumMember",
  "ExportAssignment",
  "ExportDeclaration",
  "ExportSpecifier",
  "ExpressionWithTypeArguments",
  "ForInOrOfStatement",
  "FunctionDeclaration",
  "FunctionExpression",
  "HeritageClause",
  "Identifier",
  "ImportClause",
  "ImportEqualsDeclaration",
  "ImportSpecifier",
  "JsxAttribute",
  "JsxAttributes",
  "JsxClosingElement",
  "JsxClosingFragment",
  "JsxElement",
  "JsxExpression",
  "JsxFragment",
  "JsxNamespacedName",
  "JsxOpeningElement",
  "JsxOpeningFragment",
  "JsxSelfClosingElement",
  "JsxSpreadAttribute",
  "JsxText",
  "KeywordExpression",
  "MetaProperty",
  "MethodDeclaration",
  "ModuleDeclaration",
  "NewExpression",
  "NoSubstitutionTemplateLiteral",
  "NonNullExpression",
  "ParameterDeclaration",
  "PrivateIdentifier",
  "PropertyAccessExpression",
  "PropertyAssignment",
  "PropertyDeclaration",
  "ReturnStatement",
  "SatisfiesExpression",
  "ShorthandPropertyAssignment",
  "SourceFile",
  "SpreadAssignment",
  "SpreadElement",
  "TaggedTemplateExpression",
  "TemplateHead",
  "TemplateMiddle",
  "TemplateTail",
  "Token",
  "TypeAssertion",
  "TypeSyntaxBase",
  "VariableDeclaration",
  "VariableDeclarationList",
  "VariableStatement",
  "YieldExpression",
]);

const AST_MANUAL_PROPAGATE_SUBTREE_FACTS = new Set([
  "AccessorDeclarationBase",
  "ArrayLiteralExpression",
  "ArrowFunction",
  "AsExpression",
  "BindingPattern",
  "CallExpression",
  "CatchClause",
  "ClassDeclaration",
  "ClassExpression",
  "ConstructorDeclaration",
  "ElementAccessExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "MethodDeclaration",
  "ModuleDeclaration",
  "NewExpression",
  "ObjectLiteralExpression",
  "ParameterDeclaration",
  "PropertyAccessExpression",
  "PropertyDeclaration",
  "SatisfiesExpression",
  "TypeAssertion",
  "TypeSyntaxBase",
  "VariableDeclarationList",
]);

// Methods that have a GENERATED per-concrete override in this wave.
function generatedOverrideMethodsFor(schema, nodeName) {
  const out = new Set();
  out.add("Clone"); // every concrete gets a Clone in ast_generated.go
  if (schema.schemaMembers(nodeName).some((m) => m.name === "name")) {
    out.add("Name");
  }
  const childMembers = schema.schemaMembers(nodeName).filter((m) => m.isChild());
  if (childMembers.length > 0) {
    out.add("ForEachChild");
    out.add("VisitEachChild");
  }
  if (schema.definitions[nodeName].generateSubtreeFacts) {
    out.add("computeSubtreeFacts");
  }
  return out;
}

// Resolve which free-fn an adapter slot calls for `method` on `nodeName`.
// Returns { fn, arg } where `arg` is "receiver" or "receiver, self" etc.
function resolveAdapterTarget(schema, nodeName, method) {
  const chain = schema.baseChainOf(nodeName); // most-derived first
  const generated = generatedOverrideMethodsFor(schema, nodeName);

  // Hand-written concrete setModifiers overrides (ast.go), living in ast.ts.
  // Go: func (node *BinaryExpression) setModifiers(modifiers *ModifierList) { node.modifiers = modifiers }
  if (method === "setModifiers" && AST_MANUAL_SET_MODIFIERS.has(nodeName)) {
    return { fn: `AstManual.${nodeName}_setModifiers`, takesModifiers: true };
  }

  // computeSubtreeFacts: ClassLikeBase override beats generated only when the
  // node embeds ClassLikeBase and has no own generateSubtreeFacts.
  if (method === "computeSubtreeFacts") {
    if (generated.has("computeSubtreeFacts")) {
      return { fn: `${nodeName}_computeSubtreeFacts`, takesSelf: false };
    }
    // Go promotes embedded-base methods onto the concrete; resolve the most-derived
    // hand-written provider by walking the base chain (e.g. AccessorDeclarationBase
    // provides computeSubtreeFacts for Get/SetAccessorDeclaration).
    const manualComputeProvider = [nodeName, ...chain].find((name) => AST_MANUAL_COMPUTE_SUBTREE_FACTS.has(name));
    if (manualComputeProvider !== undefined) {
      return { fn: `AstManual.${manualComputeProvider}_computeSubtreeFacts`, takesSelf: false };
    }
    if (chain.includes("ClassLikeBase")) {
      return { fn: "ClassLikeBase_computeSubtreeFacts", takesSelf: false };
    }
    if (chain.includes("TypeSyntaxBase")) {
      return { fn: "AstManual.TypeSyntaxBase_computeSubtreeFacts", takesSelf: false };
    }
    return { fn: "NodeDefault_computeSubtreeFacts", takesSelf: false };
  }

  if (method === "propagateSubtreeFacts") {
    const manualPropagateProvider = [nodeName, ...chain].find((name) => AST_MANUAL_PROPAGATE_SUBTREE_FACTS.has(name));
    if (manualPropagateProvider !== undefined) {
      return { fn: `AstManual.${manualPropagateProvider}_propagateSubtreeFacts`, takesSelf: false };
    }
    if (chain.includes("TypeSyntaxBase")) {
      return { fn: "AstManual.TypeSyntaxBase_propagateSubtreeFacts", takesSelf: false };
    }
  }

  if (method === "Clone") {
    return { fn: `${nodeName}_Clone`, takesSelf: false, takesFactory: true };
  }
  if (method === "Name" && generated.has("Name")) {
    return { fn: `${nodeName}_Name`, takesSelf: false };
  }
  if (method === "ForEachChild") {
    if (schema.definitions[nodeName].handWrittenVisitor) {
      return { fn: `AstManual.forEachChild_${nodeName}`, takesVisitor: true };
    }
    if (generated.has("ForEachChild")) return { fn: `${nodeName}_ForEachChild`, takesVisitor: true };
    return { fn: "NodeDefault_ForEachChild", takesVisitor: true };
  }
  if (method === "VisitEachChild") {
    if (schema.definitions[nodeName].handWrittenVisitor) {
      return { fn: `AstManual.visitEachChild_${nodeName}`, takesNodeVisitor: true, takesConcreteNodeVisitor: true };
    }
    if (generated.has("VisitEachChild")) return { fn: `${nodeName}_VisitEachChild`, takesNodeVisitor: true };
    return { fn: "NodeDefault_VisitEachChild", takesNodeVisitor: true };
  }

  // Hand-written base data-view overrides (most-derived provider in the chain).
  const providers = BASE_METHOD_PROVIDERS[method];
  if (providers) {
    for (const p of providers) {
      if (chain.includes(p)) {
        if (method === "subtreeFactsWorker") return { fn: `${p}_subtreeFactsWorker`, takesSelf: true };
        if (method === "setModifiers") return { fn: `${p}_setModifiers`, takesModifiers: true };
        return { fn: `${p}_${method}`, takesSelf: false };
      }
    }
  }

  // Default from spine.
  if (method === "subtreeFactsWorker") return { fn: "NodeDefault_subtreeFactsWorker", takesSelf: true };
  if (method === "setModifiers") return { fn: "NodeDefault_setModifiers", takesModifiers: true };
  if (method === "ForEachChild") return { fn: "NodeDefault_ForEachChild", takesVisitor: true };
  return { fn: `NodeDefault_${method}`, takesSelf: false };
}

// ── unions.ts ──────────────────────────────────────────────────────────────

function emitUnions(schema) {
  const lines = [];
  lines.push(`import type { Node, NodeList } from "../spine.js";`);
  lines.push("");

  // Block 1: <NodeName>Node = Node, then instantiation aliases.
  lines.push("// Node type aliases");
  for (const node of schema.nodeNames()) {
    lines.push(`export type ${node}Node = Node;`);
  }
  for (const node of schema.nodeNames()) {
    for (const alias of schema.instantiationAliasesOf(node)) {
      lines.push(`export type ${alias.name} = Node;`);
    }
  }
  lines.push("");

  // Block 2: list aliases.
  lines.push("// NodeList aliases");
  for (const [name, element] of Object.entries(schema.listAliases)) {
    lines.push(`export type ${name} = NodeList; // NodeList[*${element}]`);
  }
  lines.push("");

  // Block 3: node union aliases.
  lines.push("// Node union aliases");
  for (const name of Object.keys(schema.aliases)) {
    lines.push(`export type ${name} = Node;`);
  }
  lines.push("");
  return lines.join("\n");
}

// ── node.ts (schema base data interfaces) ────────────────────────────────────

function emitNode(schema) {
  const lines = [];
  lines.push(`import type { bool, int } from "../../../go/scalars.js";`);
  lines.push(`import type { GoPtr, GoSlice } from "../../../go/compat.js";`);
  lines.push(`import { Uint32 } from "../../../go/sync/atomic.js";`);
  lines.push(`import type { ModifierList, Node, NodeBase, NodeList } from "../spine.js";`);
  lines.push(`import type { ModifierFlags } from "../modifierflags.js";`);
  lines.push(`import type { TokenFlags } from "../tokenflags.js";`);
  lines.push(`import type {`);
  // forward node-union / list references used by base fields
  const unionRefs = collectBaseFieldRefs(schema);
  for (const ref of unionRefs) lines.push(`  ${ref},`);
  lines.push(`} from "./unions.js";`);
  lines.push("");
  lines.push(`// Symbol/SymbolTable/FlowNode are owned by sibling ast-package files (deferred);`);
  lines.push(`// they appear only on goOnly base fields, which are excluded from this TS layer.`);
  lines.push("");

  for (const baseName of schema.baseNames()) {
    if (HAND_WRITTEN_BASES.has(baseName)) continue;
    const brand = schema.baseBrand(baseName);
    // NodeBase is hand-written (spine.ts) but remains in the extends chain so the
    // generated bases root to Node via spine's NodeBase -> NodeDefault -> Node.
    const exts = schema.extendsKeysOf(baseName);
    const extendsClause = exts.length > 0 ? ` extends ${exts.join(", ")}` : "";
    const fieldLines = [];
    if (brand) {
      fieldLines.push(`  readonly ${brand}?: never;`);
    }
    // CompositeBase.facts is goOnly in the schema, but the hand-written
    // CompositeBase_subtreeFactsWorker (spine.ts) reads/writes it. It is a real
    // runtime field (atomic.Uint32), so emit it faithfully.
    if (baseName === "CompositeBase") {
      fieldLines.push(`  facts: Uint32;`);
    }
    for (const field of schema.baseFields(baseName)) {
      if (field.noTS) continue;
      fieldLines.push(`  ${field.name}: ${baseFieldTsType(schema, field)};`);
    }
    const body = fieldLines.length > 0 ? `\n${fieldLines.join("\n")}\n` : "";
    lines.push(`export interface ${baseName}${extendsClause} {${body}}`);
    lines.push("");
  }
  return lines.join("\n");
}

// CompositeBase.facts is goOnly in the schema, but the hand-written
// CompositeBase_subtreeFactsWorker in spine.ts reads/writes `facts`. Provide it
// as a runtime field typed atomic.Uint32 (faithful to the Go struct).
function baseFieldTsType(schema, field) {
  return schema.formatTsReference(field.rawType, field.listKind);
}

// CompositeBase needs a (non-goOnly-in-TS) facts cell because spine reads it.
function collectBaseFieldRefs(schema) {
  const refs = new Set();
  for (const baseName of schema.baseNames()) {
    if (HAND_WRITTEN_BASES.has(baseName)) continue;
    for (const field of schema.baseFields(baseName)) {
      if (field.noTS) continue;
      addRefsFromTsType(field.tsReference(), refs);
    }
  }
  return [...refs].sort();
}

// Extracts the union/list alias identifiers referenced by a TS reference string
// (e.g. "GoPtr<EntityName>" -> EntityName) so node.ts can import them.
function addRefsFromTsType(tsRef, out) {
  const ids = tsRef.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const skip = new Set(["GoPtr", "GoSlice", "Node", "NodeList", "ModifierList", "bool", "int", "string", "unknown", "Kind", "ModifierFlags", "NodeFlags", "TokenFlags", "Uint32"]);
  for (const id of ids) {
    if (!skip.has(id)) out.add(id);
  }
}

// ── data.ts (concrete interfaces + adapters + generated override free-fns) ───

function emitData(schema) {
  const lines = [];
  lines.push(`import type { bool, int } from "../../../go/scalars.js";`);
  lines.push(`import type { GoPtr, GoSlice } from "../../../go/compat.js";`);
  lines.push(`import type { ModifierFlags } from "../modifierflags.js";`);
  lines.push(`import type { NodeFlags } from "./flags.js";`);
  lines.push(`import type { Kind } from "./kinds.js";`);
  lines.push(`import type { TokenFlags } from "../tokenflags.js";`);
  lines.push(`import {`);
  lines.push(`  AsSyntaxList,`);
  lines.push(`} from "./casts.js";`);
  lines.push(`import {`);
  lines.push(`  KindSyntaxList,`);
  lines.push(`} from "./kinds.js";`);
  lines.push(`import {`);
  lines.push(`  cloneNode,`);
  lines.push(`  goReceiverKey,`);
  lines.push(`  invert,`);
  lines.push(`  NodeFactory_NewModifierList,`);
  lines.push(`  NodeFactory_NewNodeList,`);
  lines.push(`  visit,`);
  lines.push(`  visitModifiers,`);
  lines.push(`  visitNodeList,`);
  lines.push(`  visitNodes,`);
  for (const m of NODE_DATA_METHODS) {
    lines.push(`  NodeDefault_${m},`);
  }
  // base data-view free-fns referenced by adapters
  for (const fn of baseFreeFnsUsed()) lines.push(`  ${fn},`);
  lines.push(`} from "../spine.js";`);
  lines.push(`import type { ModifierList, Node, NodeBase, NodeFactoryCoercible, NodeIter, NodeList, NodeVisitor, Visitor, nodeData } from "../spine.js";`);
  lines.push(`import type { NodeVisitor as ConcreteNodeVisitor } from "../visitor.js";`);
  lines.push(`import type { SubtreeFacts } from "../subtreefacts.js";`);
  lines.push(`import {`);
  lines.push(`  propagateBindingElementSubtreeFacts,`);
  lines.push(`  propagateEraseableSyntaxListSubtreeFacts,`);
  lines.push(`  propagateEraseableSyntaxSubtreeFacts,`);
  lines.push(`  propagateModifierListSubtreeFacts,`);
  lines.push(`  propagateNodeListSubtreeFacts,`);
  lines.push(`  propagateObjectBindingElementSubtreeFacts,`);
  lines.push(`  propagateSubtreeFacts,`);
  lines.push(`} from "../subtreefacts.js";`);
  lines.push(`import * as Kinds from "./kinds.js";`);
  lines.push(`import * as Factory from "./factory.js";`);
  lines.push(`import * as AstManual from "../ast.js";`);
  // base interfaces and node-unions referenced by concrete fields / extends
  const baseImports = new Set();
  for (const baseName of schema.baseNames()) {
    if (!HAND_WRITTEN_BASES.has(baseName)) baseImports.add(baseName);
  }
  lines.push(`import type {`);
  for (const b of [...baseImports].sort()) lines.push(`  ${b},`);
  lines.push(`} from "./node.js";`);
  const unionImportsSet = new Set(collectConcreteFieldRefs(schema));
  for (const helperType of ["BlockOrExpression", "ParameterList", "Statement", "StatementList"]) {
    unionImportsSet.add(helperType);
  }
  const unionImports = [...unionImportsSet].sort();
  lines.push(`import type {`);
  for (const u of unionImports) lines.push(`  ${u},`);
  lines.push(`} from "./unions.js";`);
  lines.push("");
  emitGeneratedVisitHelpers(lines);

  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) {
      lines.push(`// ${node}: struct + factory hand-written in ../ast.ts (handWritten).`);
      lines.push("");
      continue;
    }
    emitConcreteInterface(schema, node, lines);
    emitOverrideFreeFns(schema, node, lines);
    emitAdapter(schema, node, lines);
  }
  return lines.join("\n");
}

function baseFreeFnsUsed() {
  const out = new Set();
  for (const [method, providers] of Object.entries(BASE_METHOD_PROVIDERS)) {
    for (const p of providers) {
      out.add(`${p}_${method === "subtreeFactsWorker" ? "subtreeFactsWorker" : method}`);
    }
  }
  out.add("ClassLikeBase_computeSubtreeFacts");
  return [...out].sort();
}

function collectConcreteFieldRefs(schema) {
  const refs = new Set();
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    // The interface itself only emits own concrete fields, but generated
    // Clone/VisitEachChild functions use schemaMembers, including inherited
    // factory fields. Import every union/list alias those functions reference.
    for (const m of schema.schemaMembers(node)) {
      if (m.noTS) continue;
      if (m.isKindParam()) continue;
      addRefsFromTsType(m.tsReference(), refs);
    }
  }
  return [...refs].sort();
}

function emitGeneratedVisitHelpers(lines) {
  lines.push(`type GeneratedNodeVisitorHooks = {`);
  lines.push(`  VisitNode?: (node: GoPtr<Node>, v: GoPtr<NodeVisitor>) => GoPtr<Node>;`);
  lines.push(`  VisitNodes?: (nodes: GoPtr<NodeList>, v: GoPtr<NodeVisitor>) => GoPtr<NodeList>;`);
  lines.push(`  VisitModifiers?: (nodes: GoPtr<ModifierList>, v: GoPtr<NodeVisitor>) => GoPtr<ModifierList>;`);
  lines.push(`  VisitEmbeddedStatement?: (node: GoPtr<Statement>, v: GoPtr<NodeVisitor>) => GoPtr<Statement>;`);
  lines.push(`  VisitIterationBody?: (node: GoPtr<Statement>, v: GoPtr<NodeVisitor>) => GoPtr<Statement>;`);
  lines.push(`  VisitParameters?: (nodes: GoPtr<ParameterList>, v: GoPtr<NodeVisitor>) => GoPtr<ParameterList>;`);
  lines.push(`  VisitFunctionBody?: (node: GoPtr<BlockOrExpression>, v: GoPtr<NodeVisitor>) => GoPtr<BlockOrExpression>;`);
  lines.push(`  VisitTopLevelStatements?: (nodes: GoPtr<StatementList>, v: GoPtr<NodeVisitor>) => GoPtr<StatementList>;`);
  lines.push(`};`);
  lines.push("");
  lines.push(`type GeneratedNodeVisitor = NodeVisitor & {`);
  lines.push(`  Visit?: (node: GoPtr<Node>) => GoPtr<Node>;`);
  lines.push(`  Factory: GoPtr<Factory.NodeFactory>;`);
  lines.push(`  Hooks?: GeneratedNodeVisitorHooks;`);
  lines.push(`};`);
  lines.push("");
  lines.push(`function generatedVisitor(v: GoPtr<NodeVisitor>): GoPtr<GeneratedNodeVisitor> {`);
  lines.push(`  return v as GoPtr<GeneratedNodeVisitor>;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitorFactory(v: GoPtr<NodeVisitor>): GoPtr<Factory.NodeFactory> {`);
  lines.push(`  return generatedVisitor(v)!.Factory;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitorHooks(v: GoPtr<NodeVisitor>): GeneratedNodeVisitorHooks {`);
  lines.push(`  return generatedVisitor(v)!.Hooks ?? {};`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitNodeBase(v: GoPtr<NodeVisitor>, node: GoPtr<Node>): GoPtr<Node> {`);
  lines.push(`  const receiver = generatedVisitor(v);`);
  lines.push(`  if (node === undefined || receiver!.Visit === undefined) {`);
  lines.push(`    return node;`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  let visited = receiver!.Visit(node);`);
  lines.push(`  if (visited !== undefined && visited.Kind === KindSyntaxList) {`);
  lines.push(`    const nodes = AsSyntaxList(visited)!.Children;`);
  lines.push(`    if (nodes.length !== 1) {`);
  lines.push(`      throw new globalThis.Error("Expected only a single node to be written to output");`);
  lines.push(`    }`);
  lines.push(`    visited = nodes[0];`);
  lines.push(`    if (visited !== undefined && visited.Kind === KindSyntaxList) {`);
  lines.push(`      throw new globalThis.Error("The result of visiting and lifting a Node may not be SyntaxList");`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`  return visited;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitNode(v: GoPtr<NodeVisitor>, node: GoPtr<Node>): GoPtr<Node> {`);
  lines.push(`  const hook = generatedVisitorHooks(v).VisitNode;`);
  lines.push(`  if (hook !== undefined) {`);
  lines.push(`    return hook(node, v);`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitNodeBase(v, node);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitSlice(v: GoPtr<NodeVisitor>, nodes: GoSlice<GoPtr<Node>>): [GoSlice<GoPtr<Node>>, bool] {`);
  lines.push(`  const receiver = generatedVisitor(v);`);
  lines.push(`  if (nodes === undefined || receiver!.Visit === undefined) {`);
  lines.push(`    return [nodes, false as bool];`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  for (let i = 0; i < nodes.length; i++) {`);
  lines.push(`    let node = nodes[i];`);
  lines.push(`    if (receiver!.Visit === undefined) {`);
  lines.push(`      break;`);
  lines.push(`    }`);
  lines.push("");
  lines.push(`    let visited = receiver!.Visit(node);`);
  lines.push(`    if (visited === undefined || visited !== node) {`);
  lines.push(`      let updated = nodes.slice(0, i);`);
  lines.push("");
  lines.push(`      for (;;) {`);
  lines.push(`        if (visited === undefined) {`);
  lines.push(`          // do nothing`);
  lines.push(`        } else if (visited.Kind === KindSyntaxList) {`);
  lines.push(`          updated = [...updated, ...AsSyntaxList(visited)!.Children];`);
  lines.push(`        } else {`);
  lines.push(`          updated = [...updated, visited];`);
  lines.push(`        }`);
  lines.push("");
  lines.push(`        i++;`);
  lines.push(`        if (i >= nodes.length) {`);
  lines.push(`          break;`);
  lines.push(`        }`);
  lines.push("");
  lines.push(`        if (receiver!.Visit !== undefined) {`);
  lines.push(`          node = nodes[i];`);
  lines.push(`          visited = receiver!.Visit(node);`);
  lines.push(`        } else {`);
  lines.push(`          updated = [...updated, ...nodes.slice(i)];`);
  lines.push(`          break;`);
  lines.push(`        }`);
  lines.push(`      }`);
  lines.push("");
  lines.push(`      return [updated, true as bool];`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  return [nodes, false as bool];`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitRawNodes(v: GoPtr<NodeVisitor>, nodes: GoSlice<GoPtr<Node>>): GoSlice<GoPtr<Node>> {`);
  lines.push(`  if (nodes === undefined) {`);
  lines.push(`    return nodes;`);
  lines.push(`  }`);
  lines.push(`  for (let i = 0; i < nodes.length; i++) {`);
  lines.push(`    const node = nodes[i];`);
  lines.push(`    const visited = generatedVisitNode(v, node);`);
  lines.push(`    if (visited !== node) {`);
  lines.push(`      const updated = nodes.slice(0, i);`);
  lines.push(`      updated.push(visited);`);
  lines.push(`      for (let j = i + 1; j < nodes.length; j++) {`);
  lines.push(`        updated.push(generatedVisitNode(v, nodes[j]));`);
  lines.push(`      }`);
  lines.push(`      return updated;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`  return nodes;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitNodesBase(v: GoPtr<NodeVisitor>, nodes: GoPtr<NodeList>): GoPtr<NodeList> {`);
  lines.push(`  const receiver = generatedVisitor(v);`);
  lines.push(`  if (nodes === undefined || receiver!.Visit === undefined) {`);
  lines.push(`    return nodes;`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  const [result, changed] = generatedVisitSlice(v, nodes.Nodes);`);
  lines.push(`  if (changed) {`);
  lines.push(`    const list = NodeFactory_NewNodeList(receiver!.Factory, result);`);
  lines.push(`    list!.Loc = nodes.Loc;`);
  lines.push(`    return list;`);
  lines.push(`  }`);
  lines.push(`  return nodes;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitNodes(v: GoPtr<NodeVisitor>, nodes: GoPtr<NodeList>): GoPtr<NodeList> {`);
  lines.push(`  const hook = generatedVisitorHooks(v).VisitNodes;`);
  lines.push(`  if (hook !== undefined) {`);
  lines.push(`    return hook(nodes, v);`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitNodesBase(v, nodes);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitModifiersBase(v: GoPtr<NodeVisitor>, nodes: GoPtr<ModifierList>): GoPtr<ModifierList> {`);
  lines.push(`  const receiver = generatedVisitor(v);`);
  lines.push(`  if (nodes === undefined || receiver!.Visit === undefined) {`);
  lines.push(`    return nodes;`);
  lines.push(`  }`);
  lines.push("");
  lines.push(`  const [result, changed] = generatedVisitSlice(v, nodes.Nodes);`);
  lines.push(`  if (changed) {`);
  lines.push(`    const list = NodeFactory_NewModifierList(receiver!.Factory, result);`);
  lines.push(`    list!.Loc = nodes.Loc;`);
  lines.push(`    return list;`);
  lines.push(`  }`);
  lines.push(`  return nodes;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitModifiers(v: GoPtr<NodeVisitor>, nodes: GoPtr<ModifierList>): GoPtr<ModifierList> {`);
  lines.push(`  const hook = generatedVisitorHooks(v).VisitModifiers;`);
  lines.push(`  if (hook !== undefined) {`);
  lines.push(`    return hook(nodes, v);`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitModifiersBase(v, nodes);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedLiftToBlock(v: GoPtr<NodeVisitor>, node: GoPtr<Statement>): GoPtr<Statement> {`);
  lines.push(`  const receiver = generatedVisitor(v);`);
  lines.push(`  let nodes: GoSlice<GoPtr<Node>> = [];`);
  lines.push(`  if (node !== undefined) {`);
  lines.push(`    if (node.Kind === KindSyntaxList) {`);
  lines.push(`      nodes = AsSyntaxList(node)!.Children;`);
  lines.push(`    } else {`);
  lines.push(`      nodes = [node];`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(`  if (nodes.length === 1) {`);
  lines.push(`    node = nodes[0];`);
  lines.push(`  } else {`);
  lines.push(`    node = Factory.NewBlock(receiver!.Factory, NodeFactory_NewNodeList(receiver!.Factory, nodes), true as bool);`);
  lines.push(`  }`);
  lines.push(`  if (node!.Kind === KindSyntaxList) {`);
  lines.push(`    throw new globalThis.Error("The result of visiting and lifting a Node may not be SyntaxList");`);
  lines.push(`  }`);
  lines.push(`  return node;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitEmbeddedStatementBase(v: GoPtr<NodeVisitor>, node: GoPtr<Statement>): GoPtr<Statement> {`);
  lines.push(`  const receiver = generatedVisitor(v);`);
  lines.push(`  if (node === undefined || receiver!.Visit === undefined) {`);
  lines.push(`    return node;`);
  lines.push(`  }`);
  lines.push(`  const visited = receiver!.Visit(node);`);
  lines.push(`  if (visited === undefined) {`);
  lines.push(`    return undefined;`);
  lines.push(`  }`);
  lines.push(`  return generatedLiftToBlock(v, visited);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitEmbeddedStatement(v: GoPtr<NodeVisitor>, node: GoPtr<Statement>): GoPtr<Statement> {`);
  lines.push(`  const hooks = generatedVisitorHooks(v);`);
  lines.push(`  if (hooks.VisitEmbeddedStatement !== undefined) {`);
  lines.push(`    return hooks.VisitEmbeddedStatement(node, v);`);
  lines.push(`  }`);
  lines.push(`  if (hooks.VisitNode !== undefined) {`);
  lines.push(`    return generatedLiftToBlock(v, hooks.VisitNode(node, v));`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitEmbeddedStatementBase(v, node);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitIterationBody(v: GoPtr<NodeVisitor>, node: GoPtr<Statement>): GoPtr<Statement> {`);
  lines.push(`  const hook = generatedVisitorHooks(v).VisitIterationBody;`);
  lines.push(`  if (hook !== undefined) {`);
  lines.push(`    return hook(node, v);`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitEmbeddedStatement(v, node);`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitParameters(v: GoPtr<NodeVisitor>, nodes: GoPtr<ParameterList>): GoPtr<ParameterList> {`);
  lines.push(`  const hook = generatedVisitorHooks(v).VisitParameters;`);
  lines.push(`  if (hook !== undefined) {`);
  lines.push(`    return hook(nodes, v);`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitNodes(v, nodes) as GoPtr<ParameterList>;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitFunctionBody(v: GoPtr<NodeVisitor>, node: GoPtr<BlockOrExpression>): GoPtr<BlockOrExpression> {`);
  lines.push(`  const hook = generatedVisitorHooks(v).VisitFunctionBody;`);
  lines.push(`  if (hook !== undefined) {`);
  lines.push(`    return hook(node, v);`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitNode(v, node) as GoPtr<BlockOrExpression>;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`function generatedVisitTopLevelStatements(v: GoPtr<NodeVisitor>, nodes: GoPtr<StatementList>): GoPtr<StatementList> {`);
  lines.push(`  const hook = generatedVisitorHooks(v).VisitTopLevelStatements;`);
  lines.push(`  if (hook !== undefined) {`);
  lines.push(`    return hook(nodes, v);`);
  lines.push(`  }`);
  lines.push(`  return generatedVisitNodes(v, nodes) as GoPtr<StatementList>;`);
  lines.push(`}`);
  lines.push("");
}

function emitConcreteInterface(schema, node, lines) {
  const exts = schema.extendsKeysOf(node);
  const extendsClause = exts.length > 0 ? ` extends ${exts.join(", ")}` : "";
  const fieldLines = [];
  for (const m of schema.members(node)) {
    if (m.noTS) continue;
    if (m.isKindParam()) continue;
    if (m.inherited) continue;
    // Go has no optional field marker — pointer fields are nilable (GoPtr) and
    // scalar fields are zero-valued. Mirror that; do not add a TS `?`.
    fieldLines.push(`  ${m.name}: ${m.tsReference()};`);
  }
  const body = fieldLines.length > 0 ? `\n${fieldLines.join("\n")}\n` : "";
  lines.push(`export interface ${node}${extendsClause} {${body}}`);
  lines.push("");
}

function emitOverrideFreeFns(schema, node, lines) {
  const generated = generatedOverrideMethodsFor(schema, node);
  // Clone (always)
  emitCloneFreeFn(schema, node, lines);
  // Name (named declarations/expressions)
  if (generated.has("Name")) emitNameFreeFn(node, lines);
  // ForEachChild (child-bearing)
  if (generated.has("ForEachChild")) emitForEachChildFreeFn(schema, node, lines);
  // VisitEachChild (child-bearing)
  if (generated.has("VisitEachChild") && !schema.definitions[node].handWrittenVisitor) {
    emitVisitEachChildFreeFn(schema, node, lines);
  }
  // computeSubtreeFacts (generateSubtreeFacts)
  if (generated.has("computeSubtreeFacts")) emitComputeSubtreeFactsFreeFn(schema, node, lines);
}

function cloneArgList(schema, node) {
  const members = schema.schemaMembers(node);
  return members.map((m) => {
    if (m.isKindParam()) return "receiver!.Kind";
    // Go Clone passes node.Modifiers() for the inherited ModifierLike member,
    // since `modifiers` is private on the base. Resolve to the promoted
    // Modifiers provider for this node.
    if (m.inherited && m.listKind === "ModifierList") {
      const target = resolveAdapterTarget(schema, node, "Modifiers");
      return `${target.fn}(receiver)`;
    }
    return `receiver!.${m.name}`;
  });
}

function emitCloneFreeFn(schema, node, lines) {
  const args = cloneArgList(schema, node).join(", ");
  lines.push(`export function ${node}_Clone(receiver: GoPtr<${node}>, f: NodeFactoryCoercible): GoPtr<Node> {`);
  const aliases = schema.kindAliasesOf(node);
  if (aliases.length === 0) {
    lines.push(`  return cloneNode(Factory.New${node}(f.AsNodeFactory()!, ${args}), receiver, f.AsNodeFactory()!.hooks);`);
  } else {
    lines.push(`  switch (NodeDefault_AsNode(receiver)!.Kind) {`);
    lines.push(`    case Kinds.Kind${schema.syntaxKindName(node)}:`);
    lines.push(`      return cloneNode(Factory.New${node}(f.AsNodeFactory()!, ${args}), receiver, f.AsNodeFactory()!.hooks);`);
    for (const alias of aliases) {
      lines.push(`    case Kinds.Kind${alias}:`);
      lines.push(`      return cloneNode(Factory.New${alias}(f.AsNodeFactory()!, ${args}), receiver, f.AsNodeFactory()!.hooks);`);
    }
    lines.push(`    default:`);
    lines.push(`      throw new globalThis.Error("unexpected kind in ${node}_Clone: " + NodeDefault_AsNode(receiver)!.Kind);`);
    lines.push(`  }`);
  }
  lines.push(`}`);
  lines.push("");
}

function emitNameFreeFn(node, lines) {
  lines.push(`export function ${node}_Name(receiver: GoPtr<${node}>): GoPtr<Node> {`);
  lines.push(`  return receiver!.name;`);
  lines.push(`}`);
  lines.push("");
}

function emitForEachChildFreeFn(schema, node, lines) {
  lines.push(`export function ${node}_ForEachChild(receiver: GoPtr<${node}>, v: Visitor): bool {`);
  const childMembers = schema.schemaMembers(node).filter((m) => m.isChild());
  const parts = childMembers.map((m) => {
    const access = `receiver!.${m.name}`;
    if (m.listKind === "raw") return `visitNodes(v, ${access})`;
    if (m.listKind === "ModifierList") return `visitModifiers(v, ${access})`;
    if (m.listKind === "NodeList") return `visitNodeList(v, ${access})`;
    return `visit(v, ${access})`;
  });
  lines.push(`  return ${parts.join(" || ")};`);
  lines.push(`}`);
  lines.push("");
}

function visitEachChildArgList(schema, node) {
  const members = schema.schemaMembers(node).filter((m) => !m.isKindParam());
  return members.map((m) => visitEachChildArg(schema, node, m));
}

function visitEachChildArg(schema, node, m) {
  const access = `receiver!.${m.name}`;
  const cast = (expr) => `${expr} as ${m.tsReference()}`;
  if (!m.isChild()) {
    if (!Array.isArray(m.rawType) && m.rawType === "NodeFlags") return "receiver!.Flags";
    return access;
  }
  if (m.listKind === "raw") return cast(`generatedVisitRawNodes(v, ${access})`);
  if (m.listKind === "ModifierList") return cast(`generatedVisitModifiers(v, ${access})`);
  if (m.listKind === "NodeList") {
    if (m.visit === "parameters") return cast(`generatedVisitParameters(v, ${access})`);
    if (m.visit === "topLevelStatements") return cast(`generatedVisitTopLevelStatements(v, ${access})`);
    return cast(`generatedVisitNodes(v, ${access})`);
  }
  if (m.visit === "embeddedStatement") return cast(`generatedVisitEmbeddedStatement(v, ${access})`);
  if (m.visit === "iterationBody") return cast(`generatedVisitIterationBody(v, ${access})`);
  if (m.visit === "functionBody") return cast(`generatedVisitFunctionBody(v, ${access})`);
  return cast(`generatedVisitNode(v, ${access})`);
}

function emitVisitEachChildFreeFn(schema, node, lines) {
  const args = visitEachChildArgList(schema, node).join(", ");
  lines.push(`export function ${node}_VisitEachChild(receiver: GoPtr<${node}>, v: GoPtr<NodeVisitor>): GoPtr<Node> {`);
  lines.push(`  return Factory.NodeFactory_Update${node}(generatedVisitorFactory(v), receiver, ${args});`);
  lines.push(`}`);
  lines.push("");
}

function subtreeFactsTerm(m) {
  const access = `receiver!.${m.name}`;
  if (m.listKind === "ModifierList") return `propagateModifierListSubtreeFacts(${access})`;
  if (m.listKind === "raw" || m.listKind === "NodeList") return `propagateNodeListSubtreeFacts(${access}, propagateSubtreeFacts)`;
  return `propagateSubtreeFacts(${access})`;
}

function emitComputeSubtreeFactsFreeFn(schema, node, lines) {
  lines.push(`export function ${node}_computeSubtreeFacts(receiver: GoPtr<${node}>): SubtreeFacts {`);
  const childMembers = schema.schemaMembers(node).filter((m) => m.isChild());
  if (childMembers.length === 0) {
    lines.push(`  return 0;`);
  } else {
    const terms = childMembers.map(subtreeFactsTerm);
    lines.push(`  return (${terms.join(" | ")}) >>> 0;`);
  }
  lines.push(`}`);
  lines.push("");
}

function emitAdapter(schema, node, lines) {
  lines.push(`const ${node}_nodeDataPrototype: nodeData & ThisType<GoPtr<${node}>> = {`);
  lines.push(`  get [goReceiverKey](): GoPtr<${node}> { return this; },`);
  for (const method of NODE_DATA_METHODS) {
    const t = resolveAdapterTarget(schema, node, method);
    const slot = adapterSlot(node, method, t);
    lines.push(`  ${slot}`);
  }
  lines.push(`};`);
  lines.push("");
  lines.push(`export function ${node}_as_nodeData(receiver: GoPtr<${node}>): nodeData {`);
  lines.push(`  return globalThis.Object.setPrototypeOf(receiver!, ${node}_nodeDataPrototype) as nodeData;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export function create${node}Data(): ${node} & nodeData {`);
  lines.push(`  return globalThis.Object.create(${node}_nodeDataPrototype) as ${node} & nodeData;`);
  lines.push(`}`);
  lines.push("");
}

function adapterSlot(node, method, t) {
  const receiver = `this`;
  if (method === "Clone") {
    return `Clone(f: NodeFactoryCoercible): GoPtr<Node> { return ${t.fn}(${receiver}, f); },`;
  }
  if (method === "ForEachChild") {
    return `ForEachChild(v: Visitor): bool { return ${t.fn}(${receiver}, v); },`;
  }
  if (method === "VisitEachChild") {
    if (t.takesConcreteNodeVisitor) {
      return `VisitEachChild(v: GoPtr<NodeVisitor>): GoPtr<Node> { return ${t.fn}(${receiver}, v as GoPtr<ConcreteNodeVisitor>); },`;
    }
    return `VisitEachChild(v: GoPtr<NodeVisitor>): GoPtr<Node> { return ${t.fn}(${receiver}, v); },`;
  }
  if (method === "IterChildren") {
    return `IterChildren(): NodeIter { return NodeDefault_IterChildren(${receiver}); },`;
  }
  if (method === "setModifiers") {
    return `setModifiers(modifiers: GoPtr<ModifierList>): void { ${t.fn}(${receiver}, modifiers); },`;
  }
  if (method === "subtreeFactsWorker") {
    return `subtreeFactsWorker(self: nodeData): SubtreeFacts { return ${t.fn}(${receiver}, self); },`;
  }
  if (method === "AsNode") {
    return `AsNode(): GoPtr<Node> { return ${t.fn}(${receiver}); },`;
  }
  return `${method}() { return ${t.fn}(${receiver}); },`;
}

// ── factory.ts (NodeFactory struct + New/Clone factories) ────────────────────

function emitFactory(schema) {
  const lines = [];
  lines.push(`import type { bool, int } from "../../../go/scalars.js";`);
  lines.push(`import type { GoPtr, GoSlice } from "../../../go/compat.js";`);
  lines.push(`import type { Arena } from "../../core/arena.js";`);
  lines.push(`import { NodeDefault_AsNode, NodeFactory_newNode, updateNode } from "../spine.js";`);
  lines.push(`import type { ModifierList, Node, NodeFactoryHooks, NodeList, nodeData } from "../spine.js";`);
  lines.push(`import type { ModifierFlags } from "../modifierflags.js";`);
  lines.push(`import type { NodeFlags } from "./flags.js";`);
  lines.push(`import type { TokenFlags } from "../tokenflags.js";`);
  lines.push(`import {`);
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    lines.push(`  create${node}Data,`);
  }
  lines.push(`} from "./data.js";`);
  lines.push(`import type {`);
  const dataImports = new Set();
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    dataImports.add(node);
  }
  for (const d of [...dataImports].sort()) lines.push(`  ${d},`);
  lines.push(`} from "./data.js";`);
  lines.push(`import {`);
  for (const k of factoryKindConstants(schema)) lines.push(`  ${k},`);
  lines.push(`} from "./kinds.js";`);
  lines.push(`import type { Kind } from "./kinds.js";`);
  const bitmasks = factoryBitmaskConstants(schema);
  const nodeFlagMasks = bitmasks.filter((b) => b.startsWith("NodeFlags"));
  const tokenFlagMasks = bitmasks.filter((b) => b.startsWith("TokenFlags"));
  if (nodeFlagMasks.length > 0) {
    lines.push(`import {`);
    for (const b of nodeFlagMasks) lines.push(`  ${b},`);
    lines.push(`} from "./flags.js";`);
  }
  if (tokenFlagMasks.length > 0) {
    lines.push(`import {`);
    for (const b of tokenFlagMasks) lines.push(`  ${b},`);
    lines.push(`} from "../tokenflags.js";`);
  }
  lines.push(`import type {`);
  const unionRefs = collectFactoryParamRefs(schema);
  for (const u of unionRefs) lines.push(`  ${u},`);
  lines.push(`} from "./unions.js";`);
  lines.push("");

  // NodeFactory struct (hooks + 46 arenas + counters).
  emitNodeFactoryStruct(schema, lines);

  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    emitNewFactories(schema, node, lines);
  }
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    const childMembers = schema.schemaMembers(node).filter((m) => m.isChild());
    if (childMembers.length === 0) continue;
    emitUpdateFactory(schema, node, lines);
  }
  return lines.join("\n");
}

function emitNodeFactoryStruct(schema, lines) {
  const arenaFields = [];
  for (const node of schema.nodeNames()) {
    if (!schema.definitions[node].arena) continue;
    arenaFields.push({ field: `${schema.uncapitalize(node)}Arena`, type: node });
  }
  arenaFields.push({ field: "modifierListArena", type: "ModifierList" });
  arenaFields.push({ field: "nodeListArena", type: "NodeList" });
  arenaFields.sort((a, b) => a.field.localeCompare(b.field));

  lines.push(`export interface NodeFactory {`);
  lines.push(`  hooks: NodeFactoryHooks;`);
  lines.push(`  AsNodeFactory(): GoPtr<NodeFactory>;`);
  for (const { field, type } of arenaFields) {
    lines.push(`  ${field}?: Arena<${type}>;`);
  }
  lines.push(`  nodeCount: int;`);
  lines.push(`  textCount: int;`);
  lines.push(`}`);
  lines.push("");
}

function factoryKindConstants(schema) {
  const out = new Set();
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    const members = schema.schemaMembers(node);
    const kindMember = members.find((m) => m.isKindParam());
    if (!kindMember) out.add(`Kind${schema.syntaxKindName(node)}`);
    for (const alias of schema.kindAliasesOf(node)) out.add(`Kind${alias}`);
  }
  return [...out].sort();
}

// Bitmask constants referenced by New* factories (data.X = (p & MASK) >>> 0
// and node.Flags |= (p & MASK)). These are value imports from flags/tokenflags.
function factoryBitmaskConstants(schema) {
  const out = new Set();
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    for (const m of schema.schemaMembers(node)) {
      if (m.bitmask) out.add(m.bitmask);
    }
  }
  return [...out].sort();
}

function collectFactoryParamRefs(schema) {
  const refs = new Set();
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    for (const m of schema.schemaMembers(node)) {
      if (m.isKindParam()) continue;
      addRefsFromTsType(m.tsReference(), refs);
    }
  }
  return [...refs].sort();
}

function hasTextContent(schema, node) {
  return schema.schemaMembers(node).some((m) => {
    if (Array.isArray(m.rawType)) return false;
    if (m.listKind === "raw") return m.rawType === "string";
    return m.rawType === "string";
  });
}

function emitNewFactories(schema, node, lines) {
  const members = schema.schemaMembers(node);
  const kindMember = members.find((m) => m.isKindParam());
  const nodeFlagsMembers = members.filter((m) => !Array.isArray(m.rawType) && m.rawType === "NodeFlags");
  emitNewFactory(schema, `New${node}`, schema.syntaxKindName(node), node, members, kindMember, nodeFlagsMembers, lines);
  for (const alias of schema.kindAliasesOf(node)) {
    emitNewFactory(schema, `New${alias}`, alias, node, members, kindMember, nodeFlagsMembers, lines);
  }
}

function emitNewFactory(schema, funcName, kindName, node, members, kindMember, nodeFlagsMembers, lines) {
  const params = members.map((m) => `${m.goParamName()}: ${m.tsReference()}`);
  const paramList = ["receiver: GoPtr<NodeFactory>", ...params].join(", ");
  lines.push(`export function ${funcName}(${paramList}): GoPtr<Node> {`);
  lines.push(`  const data = create${node}Data();`);
  for (const m of members) {
    if (m.isKindParam()) continue;
    if (!Array.isArray(m.rawType) && m.rawType === "NodeFlags") continue;
    const rawValue = m.goParamName();
    const value = m.bitmask
      ? `(${rawValue} & ${m.bitmask}) >>> 0`
      : !Array.isArray(m.rawType) && m.rawType === "string"
        ? `${rawValue} ?? ""`
        : rawValue;
    lines.push(`  data.${m.name} = ${value};`);
  }
  if (schema.baseChainOf(node).includes("TemplateLiteralLikeNodeBase") && !members.some((m) => m.name === "RawText")) {
    lines.push(`  data.RawText = "";`);
  }
  if (hasTextContent(schema, node)) {
    lines.push(`  receiver!.textCount = (receiver!.textCount + 1) as int;`);
  }
  const kindArg = kindMember ? kindMember.goParamName() : `Kind${kindName}`;
  if (nodeFlagsMembers.length > 0) {
    lines.push(`  const node = NodeFactory_newNode(receiver, ${kindArg}, data);`);
    for (const m of nodeFlagsMembers) {
      const p = m.goParamName();
      if (m.bitmask) lines.push(`  node!.Flags = (node!.Flags | (${p} & ${m.bitmask})) >>> 0;`);
      else lines.push(`  node!.Flags = ${p};`);
    }
    lines.push(`  return node;`);
  } else {
    lines.push(`  return NodeFactory_newNode(receiver, ${kindArg}, data);`);
  }
  lines.push(`}`);
  lines.push("");
}

function emitUpdateFactory(schema, node, lines) {
  const members = schema.schemaMembers(node);
  const updateMembers = members.filter((m) => !m.isKindParam());
  const params = updateMembers.map((m) => `${m.goParamName()}: ${m.tsReference()}`);
  const paramList = ["receiver: GoPtr<NodeFactory>", `node: GoPtr<${node}>`, ...params].join(", ");
  lines.push(`export function NodeFactory_Update${node}(${paramList}): GoPtr<Node> {`);
  const comparisons = updateMembers.map((m) => `${m.goParamName()} !== ${updateCompareAccess(m)}`);
  lines.push(`  if (${comparisons.join(" || ")}) {`);
  const newArgs = members.map((m) => (m.isKindParam() ? "node!.Kind" : m.goParamName())).join(", ");
  const aliases = schema.kindAliasesOf(node);
  if (aliases.length === 0) {
    lines.push(`    return updateNode(New${node}(receiver, ${newArgs}), NodeDefault_AsNode(node), receiver!.hooks);`);
  } else {
    lines.push(`    switch (NodeDefault_AsNode(node)!.Kind) {`);
    lines.push(`      case Kind${schema.syntaxKindName(node)}:`);
    lines.push(`        return updateNode(New${node}(receiver, ${newArgs}), NodeDefault_AsNode(node), receiver!.hooks);`);
    for (const alias of aliases) {
      lines.push(`      case Kind${alias}:`);
      lines.push(`        return updateNode(New${alias}(receiver, ${newArgs}), NodeDefault_AsNode(node), receiver!.hooks);`);
    }
    lines.push(`      default:`);
    lines.push(`        throw new globalThis.Error("unexpected kind in NodeFactory_Update${node}: " + NodeDefault_AsNode(node)!.Kind);`);
    lines.push(`    }`);
  }
  lines.push(`  }`);
  lines.push(`  return NodeDefault_AsNode(node);`);
  lines.push(`}`);
  lines.push("");
}

function updateCompareAccess(m) {
  if (!Array.isArray(m.rawType) && m.rawType === "NodeFlags") return "node!.Flags";
  return `node!.${m.name}`;
}

// ── predicates.ts (IsXxx) ────────────────────────────────────────────────────

function emitPredicates(schema) {
  const lines = [];
  lines.push(`import type { bool } from "../../../go/scalars.js";`);
  lines.push(`import type { GoPtr, GoSlice } from "../../../go/compat.js";`);
  lines.push(`import type { Node } from "../spine.js";`);
  lines.push(`import type { Kind } from "./kinds.js";`);
  lines.push(`import {`);
  for (const k of predicateKindConstants(schema)) lines.push(`  ${k},`);
  lines.push(`} from "./kinds.js";`);
  lines.push("");

  for (const node of schema.nodeNames()) {
    emitIsFunction(schema, node, lines);
  }
  emitKindAliasGuards(schema, lines);
  return lines.join("\n");
}

function predicateKindConstants(schema) {
  const out = new Set();
  for (const node of schema.nodeNames()) {
    const kt = schema.kindTypesOf(node);
    if (kt.isTypeParameter || schema.isMultiKind(node)) {
      for (const k of kt.kindNames) out.add(`Kind${k}`);
    } else {
      out.add(`Kind${schema.syntaxKindName(node)}`);
      for (const alias of schema.kindAliasesOf(node)) out.add(`Kind${alias}`);
    }
  }
  // kind alias guards
  for (const name of schema.kindAliasNames()) {
    const guard = goKindGuardNameJs(name);
    if (guard === "IsJSDocKind") continue;
    if (schema.kindAliasIsRange(name)) {
      const [first, last] = schema.kindAliasRange(name);
      out.add(`Kind${first}`);
      out.add(`Kind${last}`);
    } else {
      for (const m of schema.expandKindAliasMembers(name)) out.add(`Kind${m}`);
    }
  }
  return [...out].sort();
}

function emitIsFunction(schema, node, lines) {
  const kt = schema.kindTypesOf(node);
  if (kt.isTypeParameter) {
    lines.push(`export function Is${node}(node: GoPtr<Node>): bool {`);
    lines.push(`  switch (node!.Kind) {`);
    lines.push(`    ${kt.kindNames.map((k) => `case Kind${k}:`).join("\n    ")}`);
    lines.push(`      return true as bool;`);
    lines.push(`  }`);
    lines.push(`  return false as bool;`);
    lines.push(`}`);
    lines.push("");
    return;
  }
  if (schema.isMultiKind(node)) {
    for (const k of kt.kindNames) {
      lines.push(`export function Is${k}(node: GoPtr<Node>): bool {`);
      lines.push(`  return (node!.Kind === Kind${k}) as bool;`);
      lines.push(`}`);
      lines.push("");
    }
    return;
  }
  lines.push(`export function Is${node}(node: GoPtr<Node>): bool {`);
  lines.push(`  return (node!.Kind === Kind${schema.syntaxKindName(node)}) as bool;`);
  lines.push(`}`);
  lines.push("");
  for (const alias of schema.kindAliasesOf(node)) {
    lines.push(`export function Is${alias}(node: GoPtr<Node>): bool {`);
    lines.push(`  return (node!.Kind === Kind${alias}) as bool;`);
    lines.push(`}`);
    lines.push("");
  }
}

function kindGuardNameJs(aliasName) {
  return `is${aliasName.replace("Syntax", "")}`;
}

function goKindGuardNameJs(aliasName) {
  const n = kindGuardNameJs(aliasName);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function emitKindAliasGuards(schema, lines) {
  for (const name of schema.kindAliasNames()) {
    const funcName = goKindGuardNameJs(name);
    if (funcName === "IsJSDocKind") continue;
    if (schema.kindAliasIsRange(name)) {
      const [first, last] = schema.kindAliasRange(name);
      lines.push(`export function ${funcName}(kind: Kind): bool {`);
      lines.push(`  return (kind >= Kind${first} && kind <= Kind${last}) as bool;`);
      lines.push(`}`);
      lines.push("");
    } else {
      const expanded = schema.expandKindAliasMembers(name);
      lines.push(`export function ${funcName}(kind: Kind): bool {`);
      lines.push(`  switch (kind) {`);
      lines.push(`    ${expanded.map((m) => `case Kind${m}:`).join("\n    ")}`);
      lines.push(`      return true as bool;`);
      lines.push(`  }`);
      lines.push(`  return false as bool;`);
      lines.push(`}`);
      lines.push("");
    }
  }
}

// ── casts.ts (AsXxx) ─────────────────────────────────────────────────────────

function emitCasts(schema) {
  const lines = [];
  lines.push(`import type { GoPtr } from "../../../go/compat.js";`);
  lines.push(`import { goReceiverKey } from "../spine.js";`);
  lines.push(`import type { Node } from "../spine.js";`);
  lines.push(`import type {`);
  const dataImports = [];
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    dataImports.push(node);
  }
  for (const d of dataImports.sort()) lines.push(`  ${d},`);
  lines.push(`} from "./data.js";`);
  lines.push("");
  lines.push(`// Recovers the concrete receiver behind a Node's nodeData interface value`);
  lines.push(`// (Go: n.data.(*Concrete)). Panics (throws) on kind mismatch, matching Go's`);
  lines.push(`// single-return type assertion.`);
  lines.push("");
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) {
      lines.push(`// As${node}: ${node} struct is hand-written in ../ast.ts.`);
      lines.push("");
      continue;
    }
    lines.push(`export function As${node}(n: GoPtr<Node>): GoPtr<${node}> {`);
    lines.push(`  return n!.data[goReceiverKey] as GoPtr<${node}>;`);
    lines.push(`}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ── visitor.ts (ForEachChild registry) ──────────────────────────────────────

function emitVisitor(schema) {
  const lines = [];
  lines.push(`// forEachChild/VisitEachChild traversal surface — re-exports the generated`);
  lines.push(`// per-kind concrete overrides (defined in data.ts) for every child-bearing`);
  lines.push(`// concrete kind. Runtime dispatch goes through nodeData; this module gives`);
  lines.push(`// traversal functions a stable named surface.`);
  lines.push("");
  const entries = [];
  for (const node of schema.nodeNames()) {
    if (schema.definitions[node].handWritten) continue;
    if (schema.definitions[node].handWrittenVisitor) continue;
    const childMembers = schema.schemaMembers(node).filter((m) => m.isChild());
    if (childMembers.length === 0) continue;
    entries.push(node);
  }
  lines.push(`export {`);
  for (const node of entries) {
    lines.push(`  ${node}_ForEachChild,`);
    lines.push(`  ${node}_VisitEachChild,`);
  }
  lines.push(`} from "./data.js";`);
  lines.push("");
  return lines.join("\n");
}

// ── generated AST skips manifest ─────────────────────────────────────────────

export function buildGeneratedAstSkips(config) {
  const schema = loadSchemaModel(config);
  const handWritten = [];
  const handWrittenVisitor = [];
  for (const node of schema.nodeNames()) {
    const def = schema.definitions[node];
    if (def.handWritten) handWritten.push(node);
    if (def.handWrittenVisitor) handWrittenVisitor.push(node);
  }
  const visitEachChildDeferred = [];
  return { handWritten, handWrittenVisitor, visitEachChildDeferred };
}

function loadSchemaModel(config) {
  const schema = loadAstSchema(config);
  return new AstSchema(schema.ast);
}

function emitIndex() {
  const lines = [];
  lines.push(`export * from "./kinds.js";`);
  lines.push(`export * from "./flags.js";`);
  lines.push(`export * from "./unions.js";`);
  lines.push(`export * from "./node.js";`);
  lines.push(`export * from "./data.js";`);
  lines.push(`export * from "./factory.js";`);
  lines.push(`export * from "./predicates.js";`);
  lines.push(`export * from "./casts.js";`);
  // visitor.ts re-exports the Concrete_ForEachChild surface already exported by
  // data.ts; it is not re-barreled here to avoid duplicate re-exports.
  lines.push("");
  return lines.join("\n");
}

const EMITTERS = [
  { file: "kinds.ts", emit: emitKinds, model: false },
  { file: "flags.ts", emit: emitFlags, model: false },
  { file: "unions.ts", emit: emitUnions, model: true },
  { file: "node.ts", emit: emitNode, model: true },
  { file: "data.ts", emit: emitData, model: true },
  { file: "factory.ts", emit: emitFactory, model: true },
  { file: "predicates.ts", emit: emitPredicates, model: true },
  { file: "casts.ts", emit: emitCasts, model: true },
  { file: "visitor.ts", emit: emitVisitor, model: true },
  { file: "index.ts", emit: emitIndex, model: false },
];

// ---------------------------------------------------------------------------
// File assembly + metadata
// ---------------------------------------------------------------------------

// Deterministic digest of each declared schema input, so porter:ast --check can
// fail with a useful diagnostic when a specific input changes.
function schemaInputDigests(ac) {
  return ac.schemaInputs.map((relativePath) => ({
    path: relativePath,
    contentHash: hashText(readFileSync(resolveRepo(relativePath), "utf8")),
  }));
}

function generatedHeader(relativePath, body, sourceRevision, schemaInputs) {
  const metadata = {
    schemaVersion: 1,
    kind: GENERATED_KIND,
    generator: GENERATOR,
    sourceRevision,
    schemaInputs,
    path: relativePath,
    contentHash: hashText(body),
  };
  return `// Code generated by TSTS AST generator. DO NOT EDIT.\n// @tsgo-generated ${JSON.stringify(metadata)}\n\n`;
}

// Returns Map<tsRootRelativePath, fullFileText>.
export function buildAstGeneratedFiles(config, sourceRevision) {
  const ac = astConfig(config);
  const schema = loadAstSchema(config);
  const model = new AstSchema(schema.ast);
  const schemaInputs = schemaInputDigests(ac);
  const files = new Map();
  for (const emitter of EMITTERS) {
    const relativePath = `${ac.generatedDir}/${emitter.file}`;
    const body = emitter.model ? emitter.emit(model) : emitter.emit(schema);
    const header = generatedHeader(relativePath, body, sourceRevision, schemaInputs);
    files.set(relativePath, header + body);
  }
  return files;
}

function generatedDirAbsolute(config) {
  const ac = astConfig(config);
  return resolveRepo(path.join(ac.tsRoot, ac.generatedDir));
}

function walkTsFiles(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function parseAstMetadata(text) {
  const match = /^\/\/ @tsgo-generated\s+({[^\n\r]+})/m.exec(text);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

// Returns { missing, stale, orphan, untracked, invalid } — same shape as facades.
export function buildAstGeneratedArtifactStatus(config, sourceRevision) {
  const ac = astConfig(config);
  const expected = buildAstGeneratedFiles(config, sourceRevision);
  const expectedPaths = new Set(expected.keys());
  const root = generatedDirAbsolute(config);
  const actualFiles = walkTsFiles(root).map((file) => `${ac.generatedDir}/${path.relative(root, file).split(path.sep).join("/")}`);
  const actualPaths = new Set(actualFiles);

  const missing = [];
  const stale = [];
  const orphan = [];
  const untracked = [];
  const invalid = [];

  for (const relativePath of [...expectedPaths].sort()) {
    if (!actualPaths.has(relativePath)) {
      missing.push({ path: relativePath, reason: "Expected generated AST artifact is missing." });
    }
  }

  for (const relativePath of actualFiles) {
    const absolute = resolveRepo(path.join(ac.tsRoot, relativePath));
    const text = readFileSync(absolute, "utf8");
    const metadata = parseAstMetadata(text);
    if (!metadata) {
      untracked.push({ path: relativePath, reason: "Generated AST directory file is missing @tsgo-generated metadata." });
      continue;
    }
    if (metadata.kind !== GENERATED_KIND || metadata.generator !== GENERATOR) {
      invalid.push({ path: relativePath, reason: "Generated AST file metadata kind/generator is not ast-generated/porter:ast." });
      continue;
    }
    if (!expectedPaths.has(relativePath)) {
      orphan.push({ path: relativePath, reason: "Generated AST file is no longer produced from the current schema." });
      continue;
    }
    if (text !== expected.get(relativePath)) {
      stale.push({ path: relativePath, reason: "Generated AST file differs from the current deterministic generator output." });
    }
  }

  return { missing, stale, orphan, untracked, invalid };
}

export function collectAstArtifactFailures(status) {
  const failures = [];
  if (status.missing.length > 0) failures.push(`${status.missing.length} missing AST generated artifacts`);
  if (status.stale.length > 0) failures.push(`${status.stale.length} stale AST generated artifacts`);
  if (status.orphan.length > 0) failures.push(`${status.orphan.length} orphan AST generated artifacts`);
  if (status.untracked.length > 0) failures.push(`${status.untracked.length} untracked AST generated artifacts`);
  if (status.invalid.length > 0) failures.push(`${status.invalid.length} invalid AST generated artifacts`);
  return failures;
}

export function writeAstGenerated(config, sourceRevision, options = {}) {
  const ac = astConfig(config);
  const expected = buildAstGeneratedFiles(config, sourceRevision);
  const results = [];
  for (const [relativePath, text] of expected) {
    const absolute = resolveRepo(path.join(ac.tsRoot, relativePath));
    const outcome = writeTextSafely(absolute, text, { force: options.force === true, label: "AST generated artifact" });
    results.push({ path: relativePath, outcome });
  }
  return results;
}

export function emptyAstGeneratedArtifactStatus() {
  return { missing: [], stale: [], orphan: [], untracked: [], invalid: [] };
}
