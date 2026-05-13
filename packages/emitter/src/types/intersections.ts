/**
 * Intersection type emission
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { emitTypeAst } from "./emitter.js";

const isTransparentIntersectionViewMarker = (type: IrType): boolean =>
  type.kind === "referenceType" && type.name === "__Union$views";

const collectRuntimeIntersectionMembers = (
  type: Extract<IrType, { kind: "intersectionType" }>
): readonly IrType[] => {
  const members: IrType[] = [];

  for (const member of type.types) {
    if (isTransparentIntersectionViewMarker(member)) {
      continue;
    }

    if (member.kind === "intersectionType") {
      members.push(...collectRuntimeIntersectionMembers(member));
      continue;
    }

    members.push(member);
  }

  return members;
};

/**
 * Emit compiler-internal transparent intersections through their runtime carrier.
 */
export const emitIntersectionType = (
  type: Extract<IrType, { kind: "intersectionType" }>,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const runtimeMembers = collectRuntimeIntersectionMembers(type);
  if (runtimeMembers.length === 1) {
    const runtimeMember = runtimeMembers[0];
    if (runtimeMember) {
      return emitTypeAst(runtimeMember, context);
    }
  }

  throw new Error(
    `ICE: Non-transparent intersection type reached emitter after soundness validation (${runtimeMembers.length} runtime members)`
  );
};
