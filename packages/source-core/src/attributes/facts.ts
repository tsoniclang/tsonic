import {
  defineExtensionFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionFactSubject,
} from "@tsonic/tsts";
import {
  tsonicCoreSourceExtensionId,
} from "../identity.js";

export type TsonicAttributeApplicationMemberKind = "property" | "method";
export type TsonicAttributeApplicationPlacement = "declaration" | "constructor" | "module";

export interface TsonicAttributeBuilderStateFact {
  readonly kind: "builder-state";
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
  readonly applicationMemberKind?: TsonicAttributeApplicationMemberKind;
  readonly applicationPlacement?: TsonicAttributeApplicationPlacement;
  readonly applicationParameterName?: string;
  readonly applicationTargetSpecifier?: string;
}

export interface TsonicAttributeApplicationFact {
  readonly kind: "application";
  readonly invocation: ExtensionFactSubject;
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
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
  return Object.freeze({ ...value });
}

function tsonicAttributeBuilderFactEquals(
  left: TsonicAttributeBuilderFact,
  right: TsonicAttributeBuilderFact,
): boolean {
  return left.kind === right.kind &&
    left.applicationTarget === right.applicationTarget &&
    left.selectedMember === right.selectedMember &&
    left.applicationMemberKind === right.applicationMemberKind &&
    left.applicationPlacement === right.applicationPlacement &&
    left.applicationParameterName === right.applicationParameterName &&
    left.applicationTargetSpecifier === right.applicationTargetSpecifier &&
    (left.kind !== "application" || right.kind !== "application" || (
      left.invocation === right.invocation
    ));
}
