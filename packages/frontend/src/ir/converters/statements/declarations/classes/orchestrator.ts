/**
 * Class declaration conversion orchestrator
 */

import {
  getTstsHeritageClauseDetails,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsTypeArguments,
  getTstsTypeParameterNodes,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import { IrClassDeclaration, IrClassMember } from "../../../../types.js";
import {
  hasExportModifier,
  convertTypeParameters,
  hasDeclareModifier,
  hasAbstractModifier,
  definedTstsNodes,
} from "../../helpers.js";
import { convertAccessorProperty, convertProperty } from "./properties.js";
import { convertMethod } from "./methods.js";
import { convertConstructor } from "./constructors.js";
import { getClassMemberName } from "./member-names.js";
import type { ProgramContext } from "../../../../program-context.js";
import { resolveHeritageReferenceType } from "../../../heritage-reference-type.js";
import {
  heritageWrapperSemanticsFactKey,
  isHeritageInterfaceErasure,
  isSourceTypeKind,
  sourceTypeSemanticsFactKey,
} from "../../../../../source-frontend/index.js";

/**
 * Convert a single class member
 */
const convertClassMember = (
  node: TstsNode,
  ctx: ProgramContext,
  superClass: TstsNode | undefined
): IrClassMember | null => {
  if (TstsSyntax.IsPropertyDeclaration(node)) {
    return convertProperty(node, ctx, superClass);
  }

  if (TstsSyntax.IsConstructorDeclaration(node)) {
    return convertConstructor(node, ctx);
  }

  return null;
};

/**
 * Filter members to only include those declared directly on this class.
 * DETERMINISTIC: Uses AST structure only, all members in node.members are own members.
 */
const filterOwnMembers = (
  node: TstsNode
): readonly TstsNode[] => {
  // All members directly on node.members ARE own members by definition
  // The AST doesn't include inherited members in the class's members array
  //
  // NOTE: `declare` members are type-only in TypeScript and must not emit.
  return definedTstsNodes(getTstsMemberNodes(node)).filter(
    (m) => !hasDeclareModifier(m)
  );
};

/**
 * Deduplicate members by name, keeping first occurrence
 */
const deduplicateMembers = (
  members: readonly IrClassMember[]
): readonly IrClassMember[] => {
  const seenNames = new Set<string>();
  return members.filter((member) => {
    if (member.kind === "constructorDeclaration") {
      return true; // Always include constructor
    }
    if (member.kind === "methodDeclaration") {
      return true; // Never deduplicate methods; overload sets are allowed.
    }
    const name = member.kind === "propertyDeclaration" ? member.name : null;
    if (!name) return true;
    if (seenNames.has(name)) {
      return false; // Skip duplicate
    }
    seenNames.add(name);
    return true;
  });
};

const isStructMarker = (
  typeRef: TstsNode,
  ctx: ProgramContext
): boolean =>
  isSourceTypeKind(
    ctx.sourceSemantics.getFact(typeRef, sourceTypeSemanticsFactKey),
    "struct"
  );

/**
 * Unwrap `Interface<T>` in heritage clauses.
 *
 * TypeScript nominal interface brands add internal `__tsonic_iface_*` members that
 * make `implements IFoo` noisy for user-authored classes. We provide
 * `Interface<IFoo>` (from @tsonic/core/lang) to strip those members at the TS layer.
 *
 * For IR + target emission, we want the underlying native target interface `IFoo`.
 */
const unwrapInterfaceHeritageType = (
  typeRef: TstsNode,
  ctx: ProgramContext
): TstsNode => {
  if (
    isHeritageInterfaceErasure(
      ctx.sourceSemantics.getFact(typeRef, heritageWrapperSemanticsFactKey)
    ) &&
    definedTstsNodes(getTstsTypeArguments(typeRef)).length === 1
  ) {
    const only = definedTstsNodes(getTstsTypeArguments(typeRef))[0];
    if (only) return only;
  }

  return typeRef;
};

/**
 * Convert class declaration to IR
 */
export const convertClassDeclaration = (
  node: TstsNode,
  ctx: ProgramContext
): IrClassDeclaration | null => {
  const name = getTstsNodeNameText(node);
  if (!name) return null;

  const heritageClauses = getTstsHeritageClauseDetails(node);
  const superClass = definedTstsNodes(
    heritageClauses.find((h) => h.kind === "extends")?.types
  )[0];

  // Detect source-proven struct marker in implements clause.
  let isStruct =
    isSourceTypeKind(
      ctx.sourceSemantics.getFact(node, sourceTypeSemanticsFactKey),
      "struct"
    );
  const implementsClause = heritageClauses.find(
    (h) => h.kind === "implements"
  );
  const implementsTypes =
    implementsClause?.types
      .filter((t): t is TstsNode => t !== undefined)
      .filter((t) => {
        if (isStructMarker(t, ctx)) {
          isStruct = true;
          return false; // Remove marker from implements
        }
        return true;
      })
      .map((t) =>
        ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(unwrapInterfaceHeritageType(t, ctx))
        )
      ) ?? [];

  // Filter to only include members declared directly on this class (not inherited)
  const ownMembers = filterOwnMembers(node);
  const accessorPairs = new Map<
    string,
    { getter?: TstsNode; setter?: TstsNode }
  >();
  for (const member of ownMembers) {
    if (
      TstsSyntax.IsGetAccessorDeclaration(member) ||
      TstsSyntax.IsSetAccessorDeclaration(member)
    ) {
      const memberName = getClassMemberName(TstsSyntax.Node_Name(member));
      const entry = accessorPairs.get(memberName) ?? {};
      if (TstsSyntax.IsGetAccessorDeclaration(member)) {
        entry.getter = member;
      } else {
        entry.setter = member;
      }
      accessorPairs.set(memberName, entry);
    }
  }

  const convertedMembers: IrClassMember[] = [];
  const seenAccessors = new Set<string>();
  for (const member of ownMembers) {
    if (
      TstsSyntax.IsGetAccessorDeclaration(member) ||
      TstsSyntax.IsSetAccessorDeclaration(member)
    ) {
      const memberName = getClassMemberName(TstsSyntax.Node_Name(member));
      if (seenAccessors.has(memberName)) continue;
      seenAccessors.add(memberName);
      const pair = accessorPairs.get(memberName);
      convertedMembers.push(
        convertAccessorProperty(
          memberName,
          pair?.getter,
          pair?.setter,
          ctx,
          superClass
        )
      );
      continue;
    }

    if (TstsSyntax.IsMethodDeclaration(member)) {
      convertedMembers.push(convertMethod(member, ctx, superClass));
      continue;
    }

    if (TstsSyntax.IsConstructorDeclaration(member)) {
      convertedMembers.push(convertConstructor(member, ctx));
      continue;
    }

    const converted = convertClassMember(member, ctx, superClass);
    if (converted) {
      convertedMembers.push(converted);
    }
  }

  const deduplicatedMembers = deduplicateMembers(convertedMembers);

  // Filter out __brand property if this is a struct
  const finalMembers = isStruct
    ? deduplicatedMembers.filter(
        (m) => m.kind !== "propertyDeclaration" || m.name !== "__brand"
      )
    : deduplicatedMembers;

  return {
    kind: "classDeclaration",
    name,
    typeParameters: convertTypeParameters(
      definedTstsNodes(getTstsTypeParameterNodes(node)),
      ctx
    ),
    superClass: superClass
      ? resolveHeritageReferenceType(superClass, ctx)
      : undefined,
    implements: implementsTypes,
    members: finalMembers,
    isExported: hasExportModifier(node),
    isAbstract: hasAbstractModifier(node) || undefined,
    isStruct,
  };
};
