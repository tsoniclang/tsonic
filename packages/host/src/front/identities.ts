import type { DefinitionSegment, ModuleId } from "../ids/contract.js";
import type { ModuleDefinitionRow } from "./contract.js";
import { encodeDefId } from "../ids/index.js";
import type * as Hir from "../ir-hir/contract.js";
import { childrenOfSyntax } from "../ir-hir/index.js";

function nameText(name: Hir.SyntaxNode<Hir.SyntaxPhase>): string | null {
  switch (name.kind) {
    case "Identifier": case "PrivateIdentifier": case "StringLiteral": case "NumericLiteral": return name.text;
    case "ComputedPropertyName":
      throw new TypeError("front: the definition name of a computed member name is not implemented");
    default: return null;
  }
}

/**
 * The segment name a node takes by F-1's name sources with Codex's rulings (K-3236, K-3250, K-3268): the authored
 * name; the export name `default` for an anonymous default function or class declaration; `export=` or `default`
 * for an export assignment; the empty name for an unnamed member, an expression, and a parameter that holds a
 * pattern. Null when the node has no identity (a variable declaration or binding element that holds a pattern, and
 * every kind that is not a declaration).
 */
export function identityName(node: Hir.SyntaxNode<Hir.SyntaxPhase>): string | null {
  switch (node.kind) {
    case "SourceFile":
    case "FunctionExpression": case "ArrowFunction": case "ClassExpression":
    case "Constructor": case "ClassStaticBlockDeclaration": case "CallSignature": case "ConstructSignature": case "IndexSignature":
      return "";
    case "ExportAssignment": return node.isExportEquals ? "export=" : "default";
    case "Parameter": return node.name.kind === "Identifier" ? node.name.text : "";
    case "VariableDeclaration": case "BindingElement": {
      const name = node.name;
      return name !== null && name.kind === "Identifier" ? name.text : null;
    }
    case "FunctionDeclaration": case "ClassDeclaration": return node.name === null ? "default" : nameText(node.name);
    case "InterfaceDeclaration": case "TypeAliasDeclaration": case "EnumDeclaration": case "EnumMember": case "ModuleDeclaration":
    case "TypeParameter": case "PropertyDeclaration": case "MethodDeclaration": case "GetAccessor": case "SetAccessor":
    case "PropertySignature": case "MethodSignature": case "NamespaceExport":
      return nameText(node.name);
    default: return null;
  }
}

/**
 * The definition identities of one module, in the syntax tree's preorder: each declaration's owner is the nearest
 * enclosing declaration that has an identity, and its ordinal counts the declarations of that name in that owner
 * before it, whatever their kind.
 */
export function definitionRows(module: ModuleId, tree: Hir.SourceFile<Hir.SyntaxPhase>): readonly ModuleDefinitionRow[] {
  const rows: ModuleDefinitionRow[] = [];
  const counts = new Map<string, number>();
  const visit = (node: Hir.SyntaxNode<Hir.SyntaxPhase>, owner: readonly DefinitionSegment[] | null): void => {
    const name = identityName(node);
    let inner = owner;
    if (name !== null) {
      const segments = owner === null ? [] : [...owner, ((): DefinitionSegment => {
        const key = `${owner.length}:${owner.map(segment => `${segment.name}#${segment.ordinal}`).join("/")}:${name}`;
        const ordinal = counts.get(key) ?? 0;
        counts.set(key, ordinal + 1);
        return { name, ordinal };
      })()];
      rows.push({ node: node.id, kind: node.kind, segments, definition: encodeDefId({ module, segments }) });
      inner = segments;
    }
    childrenOfSyntax(node).forEach(child => { visit(child, inner); });
  };
  visit(tree, null);
  return rows;
}
