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

export function sourceEnclosing(ast: AstReader, node: Node | undefined, role: SourceCallableRole): Node | undefined {
  if (node === undefined) return undefined;
  if (role !== "signature" && role !== "body" && role !== "execution" && role !== "deferred") {
    throw new Error("Source enclosing queries require an exact callable role.");
  }
  const visited = new Set<Node>([node]);
  let child = node;
  for (let owner = ast.parent(node); owner !== undefined; owner = ast.parent(owner)) {
    if (visited.has(owner)) throw new Error("Source enclosing roles require an acyclic original parent chain.");
    visited.add(owner);
    const kind = ast.kindName(owner);
    if (role !== "signature" && (isTypeSyntaxNode(ast, child) || isTypeSyntaxNode(ast, owner) ||
      ast.is.IsInterfaceDeclaration(owner) || ast.is.IsTypeAliasDeclaration(owner))) return undefined;
    const roles = sourceCallableRoles(ast, owner);
    const definition = ast.name(owner) === child || ast.modifiers(owner).includes(child);
    if (!definition && roles.signature) {
      if (role === "signature") return owner;
      if ((ast.body(owner) === child || ast.parameters(owner).includes(child)) && roles[role]) return owner;
    } else if ((kind === "KindPropertyDeclaration" && Node_Initializer(ast, owner) === child && roles.execution) ||
      kind === "KindClassStaticBlockDeclaration") {
      if (role === "body") return undefined;
      if (roles[role]) return owner;
    } else if (kind === "KindSourceFile") {
      return roles[role] ? owner : undefined;
    }
    child = owner;
  }
  return undefined;
}
