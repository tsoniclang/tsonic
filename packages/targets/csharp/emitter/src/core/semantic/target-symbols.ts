import type {
  MemberSymbolId,
  TargetMemberRenderInfo,
  TargetTypeRenderInfo,
  TypeSymbolId,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";

export const getTargetTypeRenderInfo = (
  context: EmitterContext,
  symbolId: TypeSymbolId | undefined
): TargetTypeRenderInfo | undefined =>
  symbolId ? context.options.targetRenderTable?.types.get(symbolId) : undefined;

export const getTargetMemberRenderInfo = (
  context: EmitterContext,
  symbolId: MemberSymbolId | undefined
): TargetMemberRenderInfo | undefined =>
  symbolId
    ? context.options.targetRenderTable?.members.get(symbolId)
    : undefined;

const CORE_TARGET_TYPE_NAMES: ReadonlyMap<string, string> = new Map([
  ["core:Error", "global::System.Exception"],
  ["core:Object", "global::System.Object"],
]);

export const resolveCoreTargetTypeName = (
  name: string | undefined
): string | undefined => (name ? CORE_TARGET_TYPE_NAMES.get(name) : undefined);
