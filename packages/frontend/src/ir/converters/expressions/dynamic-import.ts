import * as ts from "typescript";
import type { IrObjectExpression, IrType } from "../../types.js";
import type { ProgramContext } from "../../program-context.js";
import { getClassNameFromPath, getNamespaceFromPath } from "../../../resolver.js";
import { getSourceSpan } from "./helpers.js";
import { resolveDynamicImportNamespace } from "../../../resolver/dynamic-import.js";

const hasModuleTypeCollision = (
  sourceFile: ts.SourceFile,
  className: string
): boolean =>
  sourceFile.statements.some(
    (statement) =>
      (ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === className
  );

const buildModuleContainerClrType = (
  ownerFilePath: string,
  ctx: ProgramContext
): string => {
  const ownerSourceFile = ctx.sourceFilesByPath.get(ownerFilePath);
  const namespace = getNamespaceFromPath(
    ownerFilePath,
    ctx.sourceRoot,
    ctx.rootNamespace
  );
  const className = getClassNameFromPath(ownerFilePath);
  const containerName =
    ownerSourceFile && hasModuleTypeCollision(ownerSourceFile, className)
      ? `${className}__Module`
      : className;
  return `${namespace}.${containerName}`;
};

export const getDynamicImportPromiseType = (
  node: ts.CallExpression,
  ctx: ProgramContext
): IrType | undefined => {
  const resolution = resolveDynamicImportNamespace(node, node.getSourceFile().fileName, {
    checker: ctx.checker,
    compilerOptions: ctx.tsCompilerOptions,
    sourceFilesByPath: ctx.sourceFilesByPath,
  });

  if (!resolution.ok) {
    return undefined;
  }

  const members = resolution.entries.map((entry) => {
    const declId = ctx.binding.resolveIdentifier(entry.declarationName);
    const memberType = declId
      ? ctx.typeSystem.typeOfDecl(declId)
      : { kind: "unknownType" as const };
    return {
      kind: "propertySignature" as const,
      name: entry.exportName,
      type: memberType,
      isOptional: false,
      isReadonly: true,
    };
  });

  return {
    kind: "referenceType",
    name: "Promise",
    typeArguments: [
      members.length === 0
        ? { kind: "referenceType", name: "object" }
        : {
            kind: "objectType",
            members,
          },
    ],
  };
};

export const convertDynamicImportNamespaceObject = (
  node: ts.CallExpression,
  ctx: ProgramContext
): IrObjectExpression | undefined => {
  const resolution = resolveDynamicImportNamespace(node, node.getSourceFile().fileName, {
    checker: ctx.checker,
    compilerOptions: ctx.tsCompilerOptions,
    sourceFilesByPath: ctx.sourceFilesByPath,
  });
  const sourceSpan = getSourceSpan(node);

  if (!resolution.ok) {
    return undefined;
  }

  if (resolution.entries.length === 0) {
    return {
      kind: "object",
      properties: [],
      inferredType: { kind: "referenceType", name: "object" },
      contextualType: { kind: "referenceType", name: "object" },
      sourceSpan,
    };
  }
  const properties: IrObjectExpression["properties"][number][] = [];
  const objectMembers: {
    kind: "propertySignature";
    name: string;
    type: IrType;
    isOptional: false;
    isReadonly: true;
  }[] = [];

  for (const entry of resolution.entries) {
    const declId = ctx.binding.resolveIdentifier(entry.declarationName);
    if (!declId) {
      return undefined;
    }

    const memberType = ctx.typeSystem.typeOfDecl(declId);
    const containerClrType = buildModuleContainerClrType(entry.ownerFilePath, ctx);

    objectMembers.push({
      kind: "propertySignature",
      name: entry.exportName,
      type: memberType,
      isOptional: false,
      isReadonly: true,
    });

    properties.push({
      kind: "property",
      key: entry.exportName,
      shorthand: false,
      value: {
        kind: "memberAccess",
        object: {
          kind: "identifier",
          name: entry.memberName,
          resolvedClrType: containerClrType,
          inferredType: { kind: "unknownType" },
          sourceSpan,
        },
        property: entry.memberName,
        isComputed: false,
        isOptional: false,
        inferredType: memberType,
        sourceSpan,
      },
    });
  }

  const namespaceType: IrType = {
    kind: "objectType",
    members: objectMembers,
  };

  return {
    kind: "object",
    properties,
    inferredType: namespaceType,
    contextualType: namespaceType,
    sourceSpan,
  };
};
