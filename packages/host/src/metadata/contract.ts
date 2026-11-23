import type { Diagnostic, ErrorValue, UnitRef, UnitResult } from "../diag/contract.js";
import type { Origin, SourceNodeRef, TyId } from "../ids/contract.js";
import type { ConstValue, ConstantReference, MemberStorageSelection, SelectedNativeFacts, TypeTerm } from "../ir-types/contract.js";
import type { MetadataKey, MetadataRecord } from "../ir-facts/contract.js";
import type { Step } from "../step/contract.js";

export interface MetadataLimits {
  readonly maximumWork: number;
  readonly maximumGeometryBits: number;
}

interface LayoutSite {
  readonly key: MetadataKey;
  readonly occurrence: SourceNodeRef;
  readonly origin: Origin;
}

interface LayoutMeasures<Value> {
  readonly byteSize: Value;
  readonly byteAlignment: Value;
  readonly stride: Value;
}

export interface ReadyDataLayout extends LayoutSite {
  readonly kind: "data-layout";
  readonly fingerprint: string;
  readonly byteOrder: "little" | "big";
  readonly addressWidth: 32 | 64;
}

interface LayoutSource extends LayoutSite {
  readonly source: TyId;
  readonly abi: MetadataKey;
  readonly measures: LayoutMeasures<ConstantReference>;
}

interface FieldSelection {
  readonly owner: TyId;
  readonly value: TyId;
  readonly selector: SourceNodeRef;
  readonly selection: SourceNodeRef;
  readonly member: MemberStorageSelection;
}

export type AuthoredLayoutDeclaration =
  | (LayoutSource & { readonly kind: "value"; readonly fields: readonly MetadataKey[] })
  | (LayoutSource & { readonly kind: "array"; readonly element: MetadataKey; readonly length: ConstantReference;
      readonly runtimeBase: "number" | "bigint" })
  | (LayoutSite & FieldSelection & { readonly kind: "field"; readonly child: MetadataKey;
      readonly byteOffset: ConstantReference; readonly byteAlignment: ConstantReference });

export type LayoutDeclaration = ReadyDataLayout | AuthoredLayoutDeclaration;

export interface ReadyLayoutField extends LayoutSite, FieldSelection {
  readonly kind: "field";
  readonly child: ReadyMemoryLayout;
  readonly byteOffset: bigint;
  readonly byteAlignment: bigint;
}

interface ReadyLayoutSource extends LayoutSite, LayoutMeasures<bigint> {
  readonly source: TyId;
  readonly abi: ReadyDataLayout;
}

export type ReadyMemoryLayout =
  | (ReadyLayoutSource & { readonly kind: "value"; readonly fields: readonly ReadyLayoutField[] })
  | (ReadyLayoutSource & { readonly kind: "array"; readonly element: ReadyMemoryLayout;
      readonly length: bigint; readonly runtimeBase: "number" | "bigint" });

export type ReadyLayout = ReadyDataLayout | ReadyMemoryLayout | ReadyLayoutField;

export type LayoutRequest =
  | { readonly kind: "constant"; readonly reference: ConstantReference }
  | { readonly kind: "descriptor"; readonly key: MetadataKey };

export type LayoutAnswer = (
  | { readonly kind: "constant"; readonly value: ConstValue }
  | { readonly kind: "descriptor"; readonly value: ReadyLayout }
  | { readonly kind: "not-constant"; readonly origin: Origin }
  | { readonly kind: "grounded-error"; readonly unit: UnitRef }
) & { readonly request: LayoutRequest };

type LayoutRefusal = Extract<UnitResult<never>, { readonly kind: "refused" }>;

export interface LayoutDeps {
  readonly admit: (work: number, records: number) => LayoutRefusal | null;
  readonly nativeFacts: SelectedNativeFacts;
  readonly limit: (origin: Origin, axis: "work" | "geometry-bits", maximum: number) => LayoutRefusal;
  readonly matchesKey: (requested: MetadataKey, delivered: MetadataKey) =>
    { readonly kind: "complete"; readonly matches: boolean } | LayoutRefusal;
  readonly typeOf: (type: TyId) => TypeTerm | null;
  readonly limits: MetadataLimits;
}

export interface LayoutPause {
  readonly declaration: AuthoredLayoutDeclaration;
  readonly requests: readonly [LayoutRequest, ...LayoutRequest[]];
  readonly work: number;
}

export type LayoutStep = Step<UnitResult<ReadyLayout | ErrorValue>, LayoutRequest, LayoutPause, Diagnostic>;
export type LayoutOf = (deps: LayoutDeps, declaration: LayoutDeclaration) => LayoutStep;
export type ResumeLayout = (deps: LayoutDeps, paused: LayoutPause, answers: readonly LayoutAnswer[]) => LayoutStep;
export type MaterializeMetadata = (deps: LayoutDeps, layout: ReadyLayout) =>
  { readonly kind: "complete"; readonly value: MetadataRecord } | LayoutRefusal;
