import type {
  AstReader,
  Node,
  Symbol,
  Type,
} from "@tsonic/tsts";
import type {
  SourceFileSemantics,
} from "./types.js";

export interface SourceObjectLiteralAccessorOccurrence {
  readonly element: Node;
  readonly elementKind: "get" | "set";
  readonly sourceElementSymbol: Symbol;
  readonly sourceElementType: Type;
  readonly sourceSelectedType: Type;
}

export interface SourceObjectLiteralAccessorMember {
  readonly sourceName: string;
  readonly sourceSelectedSymbol: Symbol;
  readonly sourceSelectedDeclarations: readonly Node[];
  readonly getter?: SourceObjectLiteralAccessorOccurrence;
  readonly setter?: SourceObjectLiteralAccessorOccurrence;
}

export type SourceObjectLiteralAccessorSelection =
  | { readonly kind: "none" }
  | {
      readonly kind: "resolved";
      readonly members: readonly SourceObjectLiteralAccessorMember[];
    }
  | {
      readonly kind: "rejected";
      readonly element: Node;
      readonly reason: string;
    };

export function selectSourceObjectLiteralAccessors(
  ast: AstReader,
  semantics: SourceFileSemantics,
  objectLiteral: Node,
): SourceObjectLiteralAccessorSelection {
  if (!ast.is.IsObjectLiteralExpression(objectLiteral)) {
    return {
      kind: "rejected",
      element: objectLiteral,
      reason: "Source accessor selection requires an exact object-literal expression.",
    };
  }
  const members: MutableAccessorMember[] = [];
  const bySelectedSymbol = new Map<Symbol, MutableAccessorMember>();
  for (const element of ast.properties(objectLiteral)) {
    if (element === undefined) {
      return {
        kind: "rejected",
        element: objectLiteral,
        reason: "Object literal contains an undefined member slot.",
      };
    }
    const expectedKind = ast.is.IsGetAccessorDeclaration(element)
      ? "get"
      : ast.is.IsSetAccessorDeclaration(element)
        ? "set"
        : undefined;
    if (expectedKind === undefined) {
      continue;
    }
    const selected = semantics.getResolvedObjectLiteralElementInfo(element);
    if (selected === undefined || selected.objectLiteral !== objectLiteral ||
      selected.element !== element || selected.elementKind !== expectedKind ||
      selected.sourceElementSymbol === undefined ||
      selected.sourceSelectedSymbol === undefined) {
      return {
        kind: "rejected",
        element,
        reason: "Object-literal accessor has no exact checker-selected element identity.",
      };
    }
    const sourceName = semantics.getSymbolName(selected.sourceElementSymbol);
    const selectedName = semantics.getSymbolName(selected.sourceSelectedSymbol);
    if (sourceName.length === 0 || selectedName !== sourceName) {
      return {
        kind: "rejected",
        element,
        reason: "Object-literal accessor source and selected member identities disagree.",
      };
    }
    let member = bySelectedSymbol.get(selected.sourceSelectedSymbol);
    if (member === undefined) {
      member = {
        sourceName,
        sourceSelectedSymbol: selected.sourceSelectedSymbol,
        sourceSelectedDeclarations: selected.sourceSelectedDeclarations,
      };
      bySelectedSymbol.set(selected.sourceSelectedSymbol, member);
      members.push(member);
    } else if (member.sourceName !== sourceName ||
      !sameNodes(
        member.sourceSelectedDeclarations,
        selected.sourceSelectedDeclarations,
      )) {
      return {
        kind: "rejected",
        element,
        reason: "Object-literal accessor pair has contradictory selected source evidence.",
      };
    }
    const occurrence: SourceObjectLiteralAccessorOccurrence = Object.freeze({
      element,
      elementKind: expectedKind,
      sourceElementSymbol: selected.sourceElementSymbol,
      sourceElementType: selected.sourceElementType,
      sourceSelectedType: selected.sourceSelectedType,
    });
    if (expectedKind === "get") {
      if (member.getter !== undefined) {
        return {
          kind: "rejected",
          element,
          reason: "Object literal has more than one getter for one selected source member.",
        };
      }
      member.getter = occurrence;
    } else {
      if (member.setter !== undefined) {
        return {
          kind: "rejected",
          element,
          reason: "Object literal has more than one setter for one selected source member.",
        };
      }
      member.setter = occurrence;
    }
  }
  if (members.length === 0) {
    return Object.freeze({ kind: "none" });
  }
  return Object.freeze({
    kind: "resolved",
    members: Object.freeze(members.map(freezeAccessorMember)),
  });
}

interface MutableAccessorMember {
  readonly sourceName: string;
  readonly sourceSelectedSymbol: Symbol;
  readonly sourceSelectedDeclarations: readonly Node[];
  getter?: SourceObjectLiteralAccessorOccurrence;
  setter?: SourceObjectLiteralAccessorOccurrence;
}

function freezeAccessorMember(
  member: MutableAccessorMember,
): SourceObjectLiteralAccessorMember {
  return Object.freeze({
    sourceName: member.sourceName,
    sourceSelectedSymbol: member.sourceSelectedSymbol,
    sourceSelectedDeclarations: Object.freeze([
      ...member.sourceSelectedDeclarations,
    ]),
    ...(member.getter === undefined ? {} : { getter: member.getter }),
    ...(member.setter === undefined ? {} : { setter: member.setter }),
  });
}

function sameNodes(left: readonly Node[], right: readonly Node[]): boolean {
  return left.length === right.length &&
    left.every((node, index) => node === right[index]);
}
