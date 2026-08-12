import {
  defineExtensionFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionFactSubject,
} from "@tsonic/tsts";
import {
  tsonicCoreSourceExtensionId,
} from "./identity.js";

export type TsonicUnsafeContextFact =
  | {
      readonly kind: "expression";
      readonly expression: ExtensionFactSubject;
    }
  | {
      readonly kind: "remaining-block";
    };

export type TsonicSafetyContract = "requires-unsafe" | "safe";
export type TsonicSafetyMemberKind = "method" | "property";
export type TsonicSafetyApplicationPlacement =
  | "declaration"
  | "constructor"
  | "getter"
  | "setter";

export interface TsonicSafetyBuilderStateFact {
  readonly kind: "builder-state";
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
  readonly applicationMemberKind?: TsonicSafetyMemberKind;
  readonly applicationPlacement: TsonicSafetyApplicationPlacement;
}

export interface TsonicSafetyApplicationFact {
  readonly kind: "application";
  readonly contract: TsonicSafetyContract;
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
  readonly applicationMemberKind?: TsonicSafetyMemberKind;
  readonly applicationPlacement: TsonicSafetyApplicationPlacement;
}

export type TsonicSafetyBuilderFact =
  | TsonicSafetyBuilderStateFact
  | TsonicSafetyApplicationFact;

export const tsonicUnsafeContextFactKey = defineExtensionFactKey<TsonicUnsafeContextFact>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "unsafeContext",
  snapshot: (value) => Object.freeze({ ...value }),
  equals: (left, right) => left.kind === right.kind &&
    (left.kind !== "expression" || right.kind !== "expression" ||
      left.expression === right.expression),
});

export const tsonicSafetyBuilderFactKey = defineExtensionFactKey<TsonicSafetyBuilderFact>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "safetyBuilderApplication",
  snapshot: (value) => Object.freeze({ ...value }),
  equals: (left, right) => left.kind === right.kind &&
    left.applicationTarget === right.applicationTarget &&
    left.selectedMember === right.selectedMember &&
    left.applicationMemberKind === right.applicationMemberKind &&
    left.applicationPlacement === right.applicationPlacement &&
    (left.kind !== "application" || right.kind !== "application" ||
      left.contract === right.contract),
});
