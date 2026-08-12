import {
  defineExtensionFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionFactSubject,
  Node,
  Type,
} from "@tsonic/tsts";
import {
  tsonicCoreSourceExtensionId,
} from "./identity.js";

export type TsonicUnsafeContextFact =
  | {
      readonly kind: "expression";
      readonly expression: Node;
    }
  | {
      readonly kind: "remaining-block";
    };

interface TsonicNativePointerOperationBase {
  readonly pointerExpression: Node;
  readonly pointerType: Type;
  readonly pointeeType: Type;
  readonly explicitPointeeTypeNode?: Node;
  readonly resultType: Type;
}

export type TsonicNativePointerOperationFact =
  | TsonicNativePointerOperationBase & {
      readonly operation: "load";
    }
  | TsonicNativePointerOperationBase & {
      readonly operation: "store";
      readonly valueExpression: Node;
      readonly valueType: Type;
    }
  | TsonicNativePointerOperationBase & {
      readonly operation: "offset";
      readonly offsetExpression: Node;
      readonly offsetType: Type;
    };

export type TsonicSafetyContract = "requires-unsafe" | "safe";
export type TsonicSafetyMemberKind = "indexer" | "method" | "property";
export type TsonicSafetyApplicationPlacement =
  | "declaration"
  | "constructor"
  | "getter"
  | "setter";

export interface TsonicSafetyBuilderStateFact {
  readonly kind: "builder-state";
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
  readonly selectedMemberDeclaration?: Node;
  readonly selectedMemberDeclarations?: readonly Node[];
  readonly applicationMemberKind?: TsonicSafetyMemberKind;
  readonly applicationPlacement: TsonicSafetyApplicationPlacement;
}

export interface TsonicSafetyApplicationFact {
  readonly kind: "application";
  readonly contract: TsonicSafetyContract;
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
  readonly selectedMemberDeclaration?: Node;
  readonly selectedMemberDeclarations?: readonly Node[];
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

export const tsonicNativePointerOperationFactKey =
  defineExtensionFactKey<TsonicNativePointerOperationFact>({
    extensionId: tsonicCoreSourceExtensionId,
    name: "nativePointerOperation",
    snapshot: (value) => Object.freeze({ ...value }),
    equals: nativePointerOperationFactsEqual,
  });

function nativePointerOperationFactsEqual(
  left: TsonicNativePointerOperationFact,
  right: TsonicNativePointerOperationFact,
): boolean {
  if (
    left.operation !== right.operation ||
    left.pointerExpression !== right.pointerExpression ||
    left.pointerType !== right.pointerType ||
    left.pointeeType !== right.pointeeType ||
    left.explicitPointeeTypeNode !== right.explicitPointeeTypeNode ||
    left.resultType !== right.resultType
  ) {
    return false;
  }
  if (left.operation === "store" && right.operation === "store") {
    return left.valueExpression === right.valueExpression &&
      left.valueType === right.valueType;
  }
  if (left.operation === "offset" && right.operation === "offset") {
    return left.offsetExpression === right.offsetExpression &&
      left.offsetType === right.offsetType;
  }
  return left.operation === "load" && right.operation === "load";
}

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
