import { IrType } from "@tsonic/frontend";
import {
  resolveTypeAlias,
  stripNullish,
  getAllPropertySignatures,
  resolveLocalTypeInfo,
} from "../core/semantic/type-resolution.js";
import type { EmitterContext } from "../types.js";
import type { LocalTypeInfo } from "../emitter-types/core.js";
import { hasNullishBranch } from "./exact-comparison.js";
import type { StructuralPropertyInfo } from "./structural-adaptation-types.js";

const stripUndefinedFromSurfaceType = (type: IrType): IrType => {
  if (type.kind !== "unionType") {
    return type;
  }

  const remaining = type.types.filter(
    (member) =>
      !(member.kind === "primitiveType" && member.name === "undefined")
  );

  if (remaining.length === 1 && remaining[0]) {
    return remaining[0];
  }

  return remaining.length === type.types.length
    ? type
    : {
        kind: "unionType",
        types: remaining,
      };
};

const collectLocalStructuralProperties = (
  info: LocalTypeInfo
): readonly StructuralPropertyInfo[] | undefined => {
  switch (info.kind) {
    case "interface": {
      if (info.members.some((member) => member.kind === "methodSignature")) {
        return undefined;
      }
      const props: StructuralPropertyInfo[] = [];
      for (const member of info.members) {
        if (member.kind !== "propertySignature") continue;
        props.push({
          name: member.name,
          type: member.type,
          isOptional: member.isOptional,
        });
      }
      return props;
    }

    case "class": {
      if (
        info.members.some(
          (member) => member.kind === "methodDeclaration" && !member.isStatic
        )
      ) {
        return undefined;
      }
      const props: StructuralPropertyInfo[] = [];
      for (const member of info.members) {
        if (member.kind !== "propertyDeclaration") continue;
        if (member.isStatic) continue;
        if (!member.type) return undefined;
        const isOptional = hasNullishBranch(member.type);
        props.push({
          name: member.name,
          type: isOptional
            ? stripUndefinedFromSurfaceType(member.type)
            : member.type,
          isOptional,
        });
      }
      return props;
    }

    case "typeAlias": {
      const aliasType = info.type;
      if (aliasType.kind !== "objectType") return undefined;
      if (
        aliasType.members.some((member) => member.kind === "methodSignature")
      ) {
        return undefined;
      }
      return aliasType.members
        .filter(
          (
            member
          ): member is Extract<typeof member, { kind: "propertySignature" }> =>
            member.kind === "propertySignature"
        )
        .map((member) => ({
          name: member.name,
          type: member.type,
          isOptional: member.isOptional,
        }));
    }

    default:
      return undefined;
  }
};

const splitEmitterTypeArguments = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of text) {
    if (char === "[") {
      depth++;
      current += char;
      continue;
    }
    if (char === "]") {
      depth--;
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const parseEmitterClrTypeString = (clrType: string): IrType => {
  if (clrType === "System.Void" || clrType === "void") {
    return { kind: "voidType" };
  }

  const primitiveMap: Record<string, IrType> = {
    "System.String": { kind: "primitiveType", name: "string" },
    string: { kind: "primitiveType", name: "string" },
    "System.Int32": { kind: "primitiveType", name: "int" },
    int: { kind: "primitiveType", name: "int" },
    "System.Double": { kind: "primitiveType", name: "number" },
    double: { kind: "primitiveType", name: "number" },
    "System.Boolean": { kind: "primitiveType", name: "boolean" },
    bool: { kind: "primitiveType", name: "boolean" },
    "System.Char": { kind: "primitiveType", name: "char" },
    char: { kind: "primitiveType", name: "char" },
    "System.Int64": { kind: "referenceType", name: "long" },
    long: { kind: "referenceType", name: "long" },
    "System.Object": { kind: "referenceType", name: "object" },
    object: { kind: "referenceType", name: "object" },
  };

  const primitive = primitiveMap[clrType];
  if (primitive) return primitive;

  if (clrType.endsWith("[]")) {
    return {
      kind: "arrayType",
      elementType: parseEmitterClrTypeString(clrType.slice(0, -2)),
    };
  }

  if (clrType.endsWith("*")) {
    return parseEmitterClrTypeString(clrType.slice(0, -1));
  }

  if (clrType.startsWith("System.Nullable`1")) {
    const innerMatch = clrType.match(/System\.Nullable`1\[\[([^\]]+)\]\]/);
    if (innerMatch?.[1]) {
      return {
        kind: "unionType",
        types: [
          parseEmitterClrTypeString(innerMatch[1]),
          { kind: "primitiveType", name: "undefined" },
        ],
      };
    }
  }

  if (/^T\d*$/.test(clrType) || /^T[A-Z][a-zA-Z]*$/.test(clrType)) {
    return { kind: "typeParameterType", name: clrType };
  }

  const underscoreInstantiationMatch = clrType.match(
    /^(.+?)_(\d+)\[\[(.+)\]\]$/
  );
  if (
    underscoreInstantiationMatch?.[1] &&
    underscoreInstantiationMatch[2] &&
    underscoreInstantiationMatch[3]
  ) {
    const baseName = underscoreInstantiationMatch[1];
    const arity = Number.parseInt(underscoreInstantiationMatch[2], 10);
    const args = splitEmitterTypeArguments(underscoreInstantiationMatch[3]);
    return {
      kind: "referenceType",
      name: `${baseName}_${arity}`,
      typeArguments:
        args.length === arity
          ? args.map((arg) => parseEmitterClrTypeString(arg.trim()))
          : undefined,
      resolvedClrType: clrType,
    };
  }

  const genericMatch = clrType.match(/^(.+)`(\d+)(?:\[\[(.+)\]\])?$/);
  if (genericMatch?.[1] && genericMatch[2]) {
    const baseName = genericMatch[1];
    const arity = Number.parseInt(genericMatch[2], 10);
    const typeArguments = genericMatch[3]
      ? splitEmitterTypeArguments(genericMatch[3]).map((arg) =>
          parseEmitterClrTypeString(arg.trim())
        )
      : Array.from({ length: arity }, (_, index) => ({
          kind: "typeParameterType" as const,
          name: index === 0 ? "T" : `T${index + 1}`,
        }));

    return {
      kind: "referenceType",
      name: baseName,
      typeArguments,
      resolvedClrType: clrType,
    };
  }

  return {
    kind: "referenceType",
    name: clrType,
    resolvedClrType: clrType,
  };
};

const addUndefinedToBindingType = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (candidate) =>
        candidate.kind === "primitiveType" && candidate.name === "undefined"
    )
  ) {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

export const parseBindingPropertyType = (
  normalizedSignature: string | undefined
): IrType => {
  if (!normalizedSignature) {
    return { kind: "unknownType" };
  }

  const indexerMatch = normalizedSignature.match(/\|\[[^\]]*\]:([^|]+)\|/);
  if (indexerMatch?.[1]) {
    return parseEmitterClrTypeString(indexerMatch[1]);
  }

  const propertyMatch = normalizedSignature.match(/\|:([^|]+)\|/);
  if (propertyMatch?.[1]) {
    return parseEmitterClrTypeString(propertyMatch[1]);
  }

  const fieldParts = normalizedSignature.split("|");
  if (fieldParts.length >= 2 && fieldParts[1]) {
    return parseEmitterClrTypeString(fieldParts[1]);
  }

  return { kind: "unknownType" };
};

const isStaticBindingMember = (
  member: { readonly signature?: string }
): boolean => member.signature?.includes("|static=true") === true;

const collectBindingStructuralProperties = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly StructuralPropertyInfo[] | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) {
    return undefined;
  }

  const candidates = new Set<string>();
  const add = (value: string | undefined): void => {
    if (value && value.length > 0) {
      candidates.add(value);
      if (value.includes(".")) {
        candidates.add(value.split(".").pop() ?? value);
      }
    }
  };

  add(type.name);
  add(type.resolvedClrType);
  add(type.typeId?.tsName);
  add(type.typeId?.clrName);

  for (const candidate of candidates) {
    const binding = registry.get(candidate);
    if (!binding) continue;
    const instanceMembers = binding.members.filter(
      (member) => !isStaticBindingMember(member)
    );
    if (instanceMembers.some((member) => member.kind === "method")) {
      return undefined;
    }

    const props = instanceMembers
      .filter(
        (
          member
        ): member is (typeof binding.members)[number] & {
          kind: "property";
        } => member.kind === "property"
      )
      .map((member) => ({
        name: member.alias,
        type:
          member.semanticType !== undefined
            ? member.semanticOptional === true
              ? addUndefinedToBindingType(member.semanticType)
              : member.semanticType
            : parseBindingPropertyType(member.signature),
        isOptional: member.semanticOptional === true,
      }));

    if (props.length > 0) {
      return props;
    }
  }

  return undefined;
};

export const collectStructuralProperties = (
  type: IrType | undefined,
  context: EmitterContext
): readonly StructuralPropertyInfo[] | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    if (resolved.members.some((member) => member.kind === "methodSignature")) {
      return undefined;
    }
    return resolved.members
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
      }));
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  const inheritedInterfaceProps = getAllPropertySignatures(resolved, context);
  if (inheritedInterfaceProps && inheritedInterfaceProps.length > 0) {
    return inheritedInterfaceProps.map((member) => ({
      name: member.name,
      type: member.type,
      isOptional: member.isOptional,
    }));
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (localInfo) {
    return collectLocalStructuralProperties(localInfo);
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    if (
      resolved.structuralMembers.some(
        (member) => member.kind === "methodSignature"
      )
    ) {
      return undefined;
    }
    return resolved.structuralMembers
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
      }));
  }

  return collectBindingStructuralProperties(resolved, context);
};
