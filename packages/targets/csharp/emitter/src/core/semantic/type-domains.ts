import type { IrType } from "@tsonic/frontend";

declare const semanticTypeBrand: unique symbol;
declare const storageCarrierBrand: unique symbol;

export type SemanticType = IrType & {
  readonly [semanticTypeBrand]: "semantic";
};

export type StorageCarrier = IrType & {
  readonly [storageCarrierBrand]: "storage";
};

export const semanticType = (type: IrType): SemanticType =>
  type as SemanticType;

export const storageCarrier = (type: IrType): StorageCarrier =>
  type as StorageCarrier;

export const semanticTypeOrUndefined = (
  type: IrType | undefined
): SemanticType | undefined => (type ? semanticType(type) : undefined);

export const storageCarrierOrUndefined = (
  type: IrType | undefined
): StorageCarrier | undefined => (type ? storageCarrier(type) : undefined);

export const semanticTypeMap = (
  entries: Iterable<readonly [string, IrType]>
): ReadonlyMap<string, SemanticType> =>
  new Map(
    Array.from(entries, ([name, type]) => [name, semanticType(type)] as const)
  );

export const storageCarrierMap = (
  entries: Iterable<readonly [string, IrType]>
): ReadonlyMap<string, StorageCarrier> =>
  new Map(
    Array.from(entries, ([name, type]) => [name, storageCarrier(type)] as const)
  );
