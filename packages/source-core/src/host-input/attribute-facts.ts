import { defineExtensionFactKey } from "@tsonic/tsts";
import type { Node, Symbol } from "@tsonic/tsts";
import { tsonicCoreSourceExtensionId } from "../identity.js";

export type TsonicAttributeApplicationMemberKind = "property" | "method";
export type TsonicAttributeApplicationPlacement = "declaration" | "constructor";

export interface TsonicAttributeBuilderStateFact {
  readonly kind: "builder-state";
  readonly applicationTarget: Node;
  readonly selectedMember?: Node | Symbol;
  readonly selectedMemberDeclaration?: Node;
  readonly selectedMemberDeclarations?: readonly Node[];
  readonly applicationMemberKind?: TsonicAttributeApplicationMemberKind;
  readonly applicationPlacement?: TsonicAttributeApplicationPlacement;
  readonly applicationParameterName?: string;
  readonly applicationTargetSpecifier?: string;
}

export interface TsonicAttributeApplicationFact {
  readonly kind: "application";
  readonly invocation: Node;
  readonly applicationTarget: Node;
  readonly selectedMember?: Node | Symbol;
  readonly selectedMemberDeclaration?: Node;
  readonly selectedMemberDeclarations?: readonly Node[];
  readonly applicationMemberKind?: TsonicAttributeApplicationMemberKind;
  readonly applicationPlacement?: TsonicAttributeApplicationPlacement;
  readonly applicationParameterName?: string;
  readonly applicationTargetSpecifier?: string;
}

export type TsonicAttributeBuilderFact =
  | TsonicAttributeBuilderStateFact
  | TsonicAttributeApplicationFact;

export const tsonicAttributeBuilderFactKey = defineExtensionFactKey<TsonicAttributeBuilderFact>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "attributeBuilderApplication",
  snapshot: snapshotTsonicAttributeBuilderFact,
  equals: tsonicAttributeBuilderFactEquals,
});

function snapshotTsonicAttributeBuilderFact(
  value: TsonicAttributeBuilderFact,
): TsonicAttributeBuilderFact {
  return Object.freeze({ ...value, ...(value.selectedMemberDeclarations === undefined ? {}
    : { selectedMemberDeclarations: Object.freeze([...value.selectedMemberDeclarations]) }) });
}

function tsonicAttributeBuilderFactEquals(
  left: TsonicAttributeBuilderFact,
  right: TsonicAttributeBuilderFact,
): boolean {
  return left.kind === right.kind &&
    left.applicationTarget === right.applicationTarget &&
    left.selectedMember === right.selectedMember &&
    left.selectedMemberDeclaration === right.selectedMemberDeclaration &&
    (left.selectedMemberDeclarations === right.selectedMemberDeclarations ||
      left.selectedMemberDeclarations !== undefined && right.selectedMemberDeclarations !== undefined &&
      left.selectedMemberDeclarations.length === right.selectedMemberDeclarations.length &&
      left.selectedMemberDeclarations.every((node, index) => node === right.selectedMemberDeclarations?.[index])) &&
    left.applicationMemberKind === right.applicationMemberKind &&
    left.applicationPlacement === right.applicationPlacement &&
    left.applicationParameterName === right.applicationParameterName &&
    left.applicationTargetSpecifier === right.applicationTargetSpecifier &&
    (left.kind !== "application" || right.kind !== "application" || (
      left.invocation === right.invocation
    ));
}
