import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import {
  Node_Arguments,
  Node_Body,
  Node_Elements,
  Node_Members,
  Node_ModifierFlags,
  Node_ModifierNodes,
  Node_Parameters,
  Node_Properties,
  Node_Statements,
  Node_Text,
  Node_TypeArguments,
  Node_TypeParameters,
  SourceFile_FileName,
  SourceFile_Path,
  SourceFile_Text,
} from "../internal/ast/ast.js";
import { Node_End, Node_ForEachChild, Node_Name, Node_Pos } from "../internal/ast/spine.js";
import type { Kind } from "../internal/ast/generated/kinds.js";
import { KindString } from "../internal/ast/generated/kinds.js";
import * as casts from "../internal/ast/generated/casts.js";
import * as predicates from "../internal/ast/generated/predicates.js";
import type { ModifierFlags } from "../internal/ast/modifierflags.js";
import { GetSourceFileOfNode, HasModifier } from "../internal/ast/utilities.js";

export interface AstReader {
  readonly kind: (node: GoPtr<Node>) => Kind | undefined;
  readonly kindName: (node: GoPtr<Node>) => string;
  readonly text: (node: GoPtr<Node>) => string;
  readonly name: (node: GoPtr<Node>) => GoPtr<Node>;
  readonly body: (node: GoPtr<Node>) => GoPtr<Node>;
  readonly parent: (node: GoPtr<Node>) => GoPtr<Node>;
  readonly children: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly forEachChild: (node: GoPtr<Node>, callback: (child: GoPtr<Node>) => void) => void;
  readonly statements: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly members: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly parameters: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly typeParameters: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly typeArguments: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly arguments: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly elements: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly properties: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly modifiers: (node: GoPtr<Node>) => readonly GoPtr<Node>[];
  readonly modifierFlags: (node: GoPtr<Node>) => ModifierFlags;
  readonly hasModifier: (node: GoPtr<Node>, flags: ModifierFlags) => boolean;
  readonly pos: (node: GoPtr<Node>) => number;
  readonly end: (node: GoPtr<Node>) => number;
  readonly getSourceFile: (node: GoPtr<Node>) => GoPtr<SourceFile>;
  readonly getFileName: (sourceFile: GoPtr<SourceFile>) => string;
  readonly getPath: (sourceFile: GoPtr<SourceFile>) => string;
  readonly getSourceText: (sourceFile: GoPtr<SourceFile>) => string;
  readonly is: typeof predicates;
  readonly as: typeof casts;
}

export function createAstReader(): AstReader {
  return {
    kind: (node) => node?.Kind,
    kindName: (node) => node === undefined ? "Undefined" : KindString(node.Kind),
    text: (node) => node === undefined ? "" : Node_Text(node),
    name: (node) => node === undefined ? undefined : Node_Name(node),
    body: (node) => node === undefined ? undefined : Node_Body(node),
    parent: (node) => node?.Parent,
    children: collectChildren,
    forEachChild: (node, callback) => {
      if (node === undefined) {
        return;
      }
      Node_ForEachChild(node, (child) => {
        callback(child);
        return false as bool;
      });
    },
    statements: (node) => Node_Statements(node) ?? [],
    members: (node) => Node_Members(node) ?? [],
    parameters: (node) => Node_Parameters(node) ?? [],
    typeParameters: (node) => Node_TypeParameters(node) ?? [],
    typeArguments: (node) => Node_TypeArguments(node) ?? [],
    arguments: (node) => Node_Arguments(node) ?? [],
    elements: (node) => Node_Elements(node) ?? [],
    properties: (node) => Node_Properties(node) ?? [],
    modifiers: (node) => Node_ModifierNodes(node) ?? [],
    modifierFlags: (node) => node === undefined ? 0 : Node_ModifierFlags(node),
    hasModifier: (node, flags) => node !== undefined && HasModifier(node, flags) === true,
    pos: (node) => node === undefined ? -1 : Node_Pos(node),
    end: (node) => node === undefined ? -1 : Node_End(node),
    getSourceFile: (node) => GetSourceFileOfNode(node),
    getFileName: (sourceFile) => sourceFile === undefined ? "" : SourceFile_FileName(sourceFile),
    getPath: (sourceFile) => sourceFile === undefined ? "" : SourceFile_Path(sourceFile),
    getSourceText: (sourceFile) => sourceFile === undefined ? "" : SourceFile_Text(sourceFile),
    is: predicates,
    as: casts,
  };
}

function collectChildren(node: GoPtr<Node>): readonly GoPtr<Node>[] {
  if (node === undefined) {
    return [];
  }
  const children: GoPtr<Node>[] = [];
  Node_ForEachChild(node, (child) => {
    children.push(child);
    return false as bool;
  });
  return children;
}
