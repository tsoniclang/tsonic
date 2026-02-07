/**
 * Class declaration conversion orchestrator
 */

import * as ts from "typescript";
import { IrClassDeclaration, IrClassMember } from "../../../../types.js";
import {
  hasExportModifier,
  convertTypeParameters,
  hasStaticModifier,
  hasDeclareModifier,
} from "../../helpers.js";
import { convertAccessorProperty, convertProperty } from "./properties.js";
import { convertMethod, convertMethodOverloadGroup } from "./methods.js";
import {
  convertConstructor,
  extractParameterProperties,
} from "./constructors.js";
import type { ProgramContext } from "../../../../program-context.js";

/**
 * Convert a single class member
 */
const convertClassMember = (
  node: ts.ClassElement,
  ctx: ProgramContext,
  superClass: ts.ExpressionWithTypeArguments | undefined,
  constructorParams?: ts.NodeArray<ts.ParameterDeclaration>
): IrClassMember | null => {
  if (ts.isPropertyDeclaration(node)) {
    return convertProperty(node, ctx, superClass);
  }

  if (ts.isConstructorDeclaration(node)) {
    return convertConstructor(node, ctx, constructorParams);
  }

  return null;
};

/**
 * Filter members to only include those declared directly on this class.
 * DETERMINISTIC: Uses AST structure only, all members in node.members are own members.
 */
const filterOwnMembers = (
  node: ts.ClassDeclaration
): readonly ts.ClassElement[] => {
  // All members directly on node.members ARE own members by definition
  // The AST doesn't include inherited members in the class's members array
  //
  // NOTE: `declare` members are type-only in TypeScript and must not emit.
  return node.members.filter((m) => !hasDeclareModifier(m));
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
    const name =
      member.kind === "propertyDeclaration" ? member.name : null;
    if (!name) return true;
    if (seenNames.has(name)) {
      return false; // Skip duplicate
    }
    seenNames.add(name);
    return true;
  });
};

/**
 * Check if a type reference is the struct marker.
 * DETERMINISTIC: Uses only the AST expression text, not TypeScript type resolution.
 */
const isStructMarker = (typeRef: ts.ExpressionWithTypeArguments): boolean => {
  // Check the expression directly - it should be an identifier named "struct" or "Struct"
  if (ts.isIdentifier(typeRef.expression)) {
    const name = typeRef.expression.text;
    return name === "struct" || name === "Struct";
  }
  return false;
};

/**
 * Convert class declaration to IR
 */
export const convertClassDeclaration = (
  node: ts.ClassDeclaration,
  ctx: ProgramContext
): IrClassDeclaration | null => {
  if (!node.name) return null;

  const superClass = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ExtendsKeyword
  )?.types[0];

  // Detect struct marker in implements clause
  let isStruct = false;
  const implementsClause = node.heritageClauses?.find(
    (h) => h.token === ts.SyntaxKind.ImplementsKeyword
  );
  const implementsTypes =
    implementsClause?.types
      .filter((t) => {
        if (isStructMarker(t)) {
          isStruct = true;
          return false; // Remove marker from implements
        }
        return true;
      })
      .map((t) =>
        ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(t))
      ) ?? [];

  // Extract parameter properties from constructor
  const constructor = node.members.find(ts.isConstructorDeclaration);
  const parameterProperties = extractParameterProperties(constructor, ctx);

  // Filter to only include members declared directly on this class (not inherited)
  const ownMembers = filterOwnMembers(node);

  // Pre-group overload method declarations by (static, name) so we can emit one C# method per signature.
  const methodGroups = new Map<string, ts.MethodDeclaration[]>();
  for (const member of ownMembers) {
    if (!ts.isMethodDeclaration(member)) continue;
    if (!ts.isIdentifier(member.name)) continue; // computed names: don't group
    const key = `${hasStaticModifier(member) ? "static" : "instance"}:${member.name.text}`;
    const list = methodGroups.get(key);
    if (list) list.push(member);
    else methodGroups.set(key, [member]);
  }

  const accessorPairs = new Map<
    string,
    { getter?: ts.GetAccessorDeclaration; setter?: ts.SetAccessorDeclaration }
  >();
  for (const member of ownMembers) {
    if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      const name = ts.isIdentifier(member.name) ? member.name.text : "[computed]";
      const entry = accessorPairs.get(name) ?? {};
      if (ts.isGetAccessorDeclaration(member)) {
        entry.getter = member;
      } else {
        entry.setter = member;
      }
      accessorPairs.set(name, entry);
    }
  }

  const convertedMembers: IrClassMember[] = [];
  const seenAccessors = new Set<string>();
  const seenMethodGroups = new Set<string>();
  for (const member of ownMembers) {
    if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      const name = ts.isIdentifier(member.name) ? member.name.text : "[computed]";
      if (seenAccessors.has(name)) continue;
      seenAccessors.add(name);
      const pair = accessorPairs.get(name);
      convertedMembers.push(
        convertAccessorProperty(
          name,
          pair?.getter,
          pair?.setter,
          ctx,
          superClass
        )
      );
      continue;
    }

    if (ts.isMethodDeclaration(member)) {
      if (ts.isIdentifier(member.name)) {
        const key = `${hasStaticModifier(member) ? "static" : "instance"}:${member.name.text}`;
        if (seenMethodGroups.has(key)) continue;
        seenMethodGroups.add(key);
        const group = methodGroups.get(key);
        if (!group) {
          throw new Error(`ICE: missing method group for key '${key}'`);
        }
        convertedMembers.push(...convertMethodOverloadGroup(group, ctx, superClass));
        continue;
      }

      // Computed method names: no overload grouping.
      convertedMembers.push(convertMethod(member, ctx, superClass));
      continue;
    }

    const converted = convertClassMember(
      member,
      ctx,
      superClass,
      constructor?.parameters
    );
    if (converted) {
      convertedMembers.push(converted);
    }
  }

  // Deduplicate members by name (keep first occurrence)
  // Parameter properties should take precedence over regular properties with same name
  const allMembers = [...parameterProperties, ...convertedMembers];
  const deduplicatedMembers = deduplicateMembers(allMembers);

  // Filter out __brand property if this is a struct
  const finalMembers = isStruct
    ? deduplicatedMembers.filter(
        (m) => m.kind !== "propertyDeclaration" || m.name !== "__brand"
      )
    : deduplicatedMembers;

  return {
    kind: "classDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, ctx),
    superClass: superClass
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(superClass))
      : undefined,
    implements: implementsTypes,
    members: finalMembers,
    isExported: hasExportModifier(node),
    isStruct,
  };
};
