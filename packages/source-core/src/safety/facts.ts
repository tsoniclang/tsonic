import {
  defineExtensionFactKey,
} from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import type {
  TargetSourceSafetyApplicationPlacement,
  TargetSourceSafetyBuilderFact,
  TargetSourceSafetyContract,
  TargetSourceSafetyMemberKind,
  TargetSourceUnsafeContextFact,
} from "@tsonic/target-api/provider";
import {
  tsonicCoreSourceExtensionId,
} from "../identity.js";

// The safety fact types are owned by target-api (target/source-extensions.ts); these are aliases, not copies (R4).
export type TsonicUnsafeContextFact = TargetSourceUnsafeContextFact;
export type TsonicSafetyContract = TargetSourceSafetyContract;
export type TsonicSafetyMemberKind = TargetSourceSafetyMemberKind;
export type TsonicSafetyApplicationPlacement = TargetSourceSafetyApplicationPlacement;
export type TsonicSafetyBuilderFact = TargetSourceSafetyBuilderFact;
export type TsonicSafetyBuilderStateFact = Extract<TargetSourceSafetyBuilderFact, { readonly kind: "builder-state" }>;
export type TsonicSafetyApplicationFact = Extract<TargetSourceSafetyBuilderFact, { readonly kind: "application" }>;

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
  snapshot: snapshotSafetyBuilderFact,
  equals: (left, right) => left.kind === right.kind &&
    left.applicationTarget === right.applicationTarget &&
    left.selectedMember === right.selectedMember &&
    left.selectedMemberDeclaration === right.selectedMemberDeclaration &&
    sourceNodesEqual(
      left.selectedMemberDeclarations,
      right.selectedMemberDeclarations,
    ) &&
    left.applicationMemberKind === right.applicationMemberKind &&
    left.applicationPlacement === right.applicationPlacement &&
    (left.kind !== "application" || right.kind !== "application" ||
      left.contract === right.contract),
});

function snapshotSafetyBuilderFact(
  value: TsonicSafetyBuilderFact,
): TsonicSafetyBuilderFact {
  return Object.freeze({
    ...value,
    ...(value.selectedMemberDeclarations === undefined
      ? {}
      : {
          selectedMemberDeclarations: Object.freeze([
            ...value.selectedMemberDeclarations,
          ]),
        }),
  });
}

function sourceNodesEqual(
  left: readonly Node[] | undefined,
  right: readonly Node[] | undefined,
): boolean {
  if (left === right) {
    return true;
  }
  if (left === undefined || right === undefined || left.length !== right.length) {
    return false;
  }
  return left.every((node, index) => node === right[index]);
}
