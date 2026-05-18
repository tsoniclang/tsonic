/**
 * Member Type Resolution — Facade
 *
 * Re-exports member lookup and resolution logic from sub-modules:
 * - inference-member-lookup: resolveMemberTypeNoDiag, typeOfMember
 * - inference-member-id: parseIndexerKeyTypeName, getIndexerInfo, typeOfMemberId
 */

export { typeOfMember } from "./inference-member-lookup.js";
export {
  parseIndexerKeyTypeName,
  getIndexerInfo,
  typeOfMemberId,
} from "./inference-member-id.js";
