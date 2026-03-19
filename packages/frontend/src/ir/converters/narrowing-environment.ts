/**
 * Flow narrowing environment application helpers.
 *
 * Contains withAppliedNarrowings, withAssignedAccessPathType,
 * and supporting helpers for managing narrowing environments.
 */

import type { ProgramContext } from "../program-context.js";
import type { IrType } from "../types.js";
import {
  getAccessPathKey,
  type AccessPathTarget,
} from "./access-paths.js";
import { type TypeNarrowing } from "./narrowing-resolvers.js";

export const withAppliedNarrowings = (
  ctx: ProgramContext,
  narrowings: readonly TypeNarrowing[]
): ProgramContext => {
  if (narrowings.length === 0) return ctx;

  let nextTypeEnv: Map<number, IrType> | undefined;
  let nextAccessEnv: Map<string, IrType> | undefined;
  for (const n of narrowings) {
    if (n.kind === "decl") {
      if (!nextTypeEnv)
        nextTypeEnv = new Map<number, IrType>(ctx.typeEnv ?? []);
      nextTypeEnv.set(n.declId, n.targetType);
      continue;
    }

    if (!nextAccessEnv) {
      nextAccessEnv = new Map<string, IrType>(ctx.accessEnv ?? []);
    }
    nextAccessEnv.set(n.key, n.targetType);
  }

  return {
    ...ctx,
    ...(nextTypeEnv ? { typeEnv: nextTypeEnv } : {}),
    ...(nextAccessEnv ? { accessEnv: nextAccessEnv } : {}),
  };
};

const isDescendantAccessPath = (
  target: AccessPathTarget,
  candidateKey: string
): boolean => {
  const candidate = JSON.parse(candidateKey) as
    | {
        readonly kind: "decl";
        readonly declId: number;
        readonly segments: readonly string[];
      }
    | {
        readonly kind: "this";
        readonly segments: readonly string[];
      };

  if (candidate.kind !== target.kind) {
    return false;
  }

  if (
    target.kind === "decl" &&
    candidate.kind === "decl" &&
    candidate.declId !== target.declId.id
  ) {
    return false;
  }

  if (candidate.segments.length < target.segments.length) {
    return false;
  }

  return target.segments.every(
    (segment, index) => candidate.segments[index] === segment
  );
};

const withoutAssignedTargetFlow = (
  ctx: ProgramContext,
  target: AccessPathTarget
): ProgramContext => {
  const nextTypeEnv = new Map(ctx.typeEnv ?? []);
  const nextAccessEnv = new Map(ctx.accessEnv ?? []);

  if (target.kind === "decl" && target.segments.length === 0) {
    nextTypeEnv.delete(target.declId.id);
  }

  for (const key of nextAccessEnv.keys()) {
    if (isDescendantAccessPath(target, key)) {
      nextAccessEnv.delete(key);
    }
  }

  return {
    ...ctx,
    typeEnv: nextTypeEnv,
    accessEnv: nextAccessEnv,
  };
};

export const withAssignedAccessPathType = (
  ctx: ProgramContext,
  target: AccessPathTarget,
  assignedType: IrType | undefined
): ProgramContext => {
  const cleared = withoutAssignedTargetFlow(ctx, target);
  if (!assignedType) {
    return cleared;
  }

  if (target.kind === "decl" && target.segments.length === 0) {
    const nextTypeEnv = new Map(cleared.typeEnv ?? []);
    nextTypeEnv.set(target.declId.id, assignedType);
    return {
      ...cleared,
      typeEnv: nextTypeEnv,
    };
  }

  const nextAccessEnv = new Map(cleared.accessEnv ?? []);
  nextAccessEnv.set(getAccessPathKey(target), assignedType);
  return {
    ...cleared,
    accessEnv: nextAccessEnv,
  };
};
