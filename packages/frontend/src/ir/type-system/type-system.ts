/**
 * TypeAuthority — Facade
 *
 * Re-exports the TypeAuthority interface, TypeSystemConfig, and createTypeSystem
 * factory from sub-modules:
 * - type-system-types-api: TypeAuthority, TypeSystemConfig
 * - type-system-factory: createTypeSystem
 * - type-system-state: MemberRef, CallQuery, ResolvedCall, Site, BUILTIN_NOMINALS, poisonedCall
 */

export type {
  MemberRef,
  CallQuery,
  ResolvedCall,
  Site,
} from "./type-system-state.js";
export { BUILTIN_NOMINALS, poisonedCall } from "./type-system-state.js";

export type {
  TypeAuthority,
  TypeSystemConfig,
} from "./type-system-types-api.js";

export { createTypeSystem } from "./type-system-factory.js";
