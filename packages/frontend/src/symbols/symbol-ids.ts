type Brand<TName extends string> = string & {
  readonly __tsonicSymbolBrand: TName;
};

export type TypeSymbolId = Brand<"TypeSymbolId">;
export type MemberSymbolId = Brand<"MemberSymbolId">;
export type ModuleSymbolId = Brand<"ModuleSymbolId">;

export type SymbolId = TypeSymbolId | MemberSymbolId | ModuleSymbolId;

const normalizeSegment = (value: string): string =>
  value.trim().replace(/\s+/g, " ").replace(/[\\]/g, "/");

const encodeSegment = (value: string): string =>
  encodeURIComponent(normalizeSegment(value));

export const createTypeSymbolId = (
  ownerIdentity: string,
  stableName: string
): TypeSymbolId =>
  `type:${encodeSegment(ownerIdentity)}:${encodeSegment(stableName)}` as TypeSymbolId;

export const createMemberSymbolId = (
  ownerIdentity: string,
  ownerStableName: string,
  memberStableName: string
): MemberSymbolId =>
  `member:${encodeSegment(ownerIdentity)}:${encodeSegment(ownerStableName)}:${encodeSegment(memberStableName)}` as MemberSymbolId;

export const createModuleSymbolId = (
  ownerIdentity: string,
  moduleStableName: string
): ModuleSymbolId =>
  `module:${encodeSegment(ownerIdentity)}:${encodeSegment(moduleStableName)}` as ModuleSymbolId;

export const typeSymbolIdFromStableId = (stableId: string): TypeSymbolId =>
  `type-stable:${encodeSegment(stableId)}` as TypeSymbolId;

export const memberSymbolIdFromStableId = (stableId: string): MemberSymbolId =>
  `member-stable:${encodeSegment(stableId)}` as MemberSymbolId;

export const moduleSymbolIdFromStableId = (stableId: string): ModuleSymbolId =>
  `module-stable:${encodeSegment(stableId)}` as ModuleSymbolId;
