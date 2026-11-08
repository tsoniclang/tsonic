import type { AstReader, Node } from "@tsonic/tsts";
import { Node_Initializer } from "./ast.js";
import { sourceClassFieldHasStorage } from "./class-members.js";
import { isTypeSyntaxNode } from "./syntax.js";

export type SourceCallableRole = "signature" | "body" | "execution" | "deferred";

export interface SourceCallableRoles {
  readonly signature: boolean;
  readonly body: boolean;
  readonly execution: boolean;
  readonly deferred: boolean;
}

const callableKinds: ReadonlySet<string> = new Set([
  "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction", "KindMethodDeclaration",
  "KindConstructor", "KindGetAccessor", "KindSetAccessor",
]);
const signatureKinds: ReadonlySet<string> = new Set([
  "KindMethodSignature", "KindCallSignature", "KindConstructSignature", "KindFunctionType", "KindConstructorType",
]);

const noRoles: SourceCallableRoles = Object.freeze({ signature: false, body: false, execution: false, deferred: false });
const signatureRoles: SourceCallableRoles = Object.freeze({ signature: true, body: false, execution: false, deferred: false });
const callableRoles: SourceCallableRoles = Object.freeze({ signature: true, body: true, execution: true, deferred: true });
const executionRoles: SourceCallableRoles = Object.freeze({ signature: false, body: false, execution: true, deferred: false });
const initializerRoles: SourceCallableRoles = Object.freeze({ signature: false, body: false, execution: true, deferred: true });

export function sourceCallableRoles(ast: AstReader, node: Node): SourceCallableRoles {
  const kind = ast.kindName(node);
  if (callableKinds.has(kind)) return ast.body(node) === undefined ? signatureRoles : callableRoles;
  if (signatureKinds.has(kind)) return signatureRoles;
  if (kind === "KindClassStaticBlockDeclaration" || kind === "KindSourceFile") return executionRoles;
  if (kind === "KindPropertyDeclaration" && sourceClassFieldHasStorage(ast, node) && Node_Initializer(ast, node) !== undefined) {
    return ast.hasModifierKind(node, "static") ? executionRoles : initializerRoles;
  }
  return noRoles;
}

export type SourceEnclosingQuery = (node: Node | undefined, role: SourceCallableRole,
  visit?: (node: Node) => boolean) => Node | undefined;

export function createSourceEnclosingQuery(ast: AstReader): SourceEnclosingQuery {
  const retained = new WeakMap<Node, Map<SourceCallableRole, Node | undefined>>();
  return (node, role, visit) => {
    if (role !== "signature" && role !== "body" && role !== "execution" && role !== "deferred") {
      throw new Error("Source enclosing queries require an exact callable role.");
    }
    if (node === undefined) return undefined;
    const visited = new Set<Node>();
    const pending: Node[] = [];
    let selected: Node | undefined;
    for (let child = node;;) {
      if (visited.has(child)) throw new Error("Source enclosing roles require an acyclic original parent chain.");
      visited.add(child);
      if (visit !== undefined && !visit(child)) return undefined;
      const existing = retained.get(child);
      if (existing?.has(role)) { selected = existing.get(role); break; }
      pending.push(child);
      const owner = ast.parent(child);
      if (owner === undefined) break;
      const kind = ast.kindName(owner);
      if (role !== "signature" && (isTypeSyntaxNode(ast, child) || isTypeSyntaxNode(ast, owner) ||
        ast.is.IsInterfaceDeclaration(owner) || ast.is.IsTypeAliasDeclaration(owner))) break;
      const roles = sourceCallableRoles(ast, owner);
      const definition = ast.name(owner) === child || ast.modifiers(owner).includes(child);
      if (!definition && roles.signature) {
        if (role === "signature" || (ast.body(owner) === child || ast.parameters(owner).includes(child)) && roles[role]) {
          selected = owner;
          break;
        }
      } else if ((kind === "KindPropertyDeclaration" && Node_Initializer(ast, owner) === child && roles.execution) ||
        kind === "KindClassStaticBlockDeclaration") {
        if (role === "body") break;
        if (roles[role]) { selected = owner; break; }
      } else if (kind === "KindSourceFile") {
        selected = roles[role] ? owner : undefined;
        break;
      }
      child = owner;
    }
    for (const child of pending) {
      let roles = retained.get(child);
      if (roles === undefined) { roles = new Map(); retained.set(child, roles); }
      roles.set(role, selected);
    }
    return selected;
  };
}

export function sourceEnclosing(ast: AstReader, node: Node | undefined, role: SourceCallableRole): Node | undefined {
  return createSourceEnclosingQuery(ast)(node, role);
}
