import fs from "node:fs";
import * as ts from "typescript";
import type { IrNewExpression, IrType } from "../../../types.js";
import type { ProgramContext } from "../../../program-context.js";
import { substituteTypeParameters } from "./call-site-analysis.js";
import {
  expandAuthoritativeSourceBackedSurfaceType,
  selectDeterministicSourceBackedParameterType,
} from "./invocation-finalization.js";
import {
  buildResolvedRestParameter,
  expandParameterTypesForArguments,
} from "../../../type-system/type-system-call-resolution.js";
import { addUndefinedToType } from "../../../type-system/type-system-state-helpers.js";
import { resolveImport } from "../../../../resolver/import-resolution.js";

export type SourceBackedConstructorParameterTypes = {
  readonly parameterTypes: readonly (IrType | undefined)[];
  readonly surfaceParameterTypes: readonly (IrType | undefined)[];
  readonly restParameter:
    | {
        readonly index: number;
        readonly arrayType: IrType | undefined;
        readonly elementType: IrType | undefined;
      }
    | undefined;
};

const getSourceFileForPath = (
  sourceFilePath: string,
  ctx: ProgramContext
): ts.SourceFile | undefined => {
  const normalizedSourceFilePath = sourceFilePath.replace(/\\/g, "/");
  const realSourceFilePath = (() => {
    try {
      return fs.realpathSync(sourceFilePath).replace(/\\/g, "/");
    } catch {
      return undefined;
    }
  })();

  const fromProgram =
    ctx.sourceFilesByPath.get(normalizedSourceFilePath) ??
    (realSourceFilePath
      ? ctx.sourceFilesByPath.get(realSourceFilePath)
      : undefined);
  if (fromProgram) {
    return fromProgram;
  }

  if (!fs.existsSync(sourceFilePath)) {
    return undefined;
  }

  return ts.createSourceFile(
    sourceFilePath,
    fs.readFileSync(sourceFilePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
};

const resolveReferencedClassDeclaration = (
  expression: ts.Expression,
  ctx: ProgramContext
): ts.ClassDeclaration | undefined => {
  const symbol = ctx.checker.getSymbolAtLocation(expression);
  if (!symbol) {
    return undefined;
  }

  const declaration = symbol.declarations?.find((candidate) =>
    ts.isClassDeclaration(candidate)
  );
  return declaration && ts.isClassDeclaration(declaration)
    ? declaration
    : undefined;
};

const getDeclarationTypeNode = (
  declaration: ts.Declaration
): ts.TypeNode | undefined => {
  if (ts.isVariableDeclaration(declaration)) {
    return declaration.type;
  }
  if (
    ts.isPropertySignature(declaration) ||
    ts.isPropertyDeclaration(declaration)
  ) {
    return declaration.type;
  }
  return undefined;
};

const readEntityNameText = (name: ts.Node): string => {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isQualifiedName(name)) {
    return `${readEntityNameText(name.left)}.${name.right.text}`;
  }
  if (ts.isPropertyAccessExpression(name)) {
    return `${readEntityNameText(name.expression)}.${name.name.text}`;
  }
  return ts.isStringLiteral(name) ? name.text : name.getText();
};

const extractImportTypeTarget = (
  declaration: ts.Declaration
): { readonly specifier: string; readonly exportName: string } | undefined => {
  const typeNode = getDeclarationTypeNode(declaration);
  if (!typeNode) {
    return undefined;
  }

  if (ts.isImportTypeNode(typeNode) && typeNode.isTypeOf) {
    const literal =
      ts.isLiteralTypeNode(typeNode.argument) &&
      ts.isStringLiteral(typeNode.argument.literal)
        ? typeNode.argument.literal
        : undefined;
    if (!literal) {
      return undefined;
    }

    const exportName = typeNode.qualifier
      ? readEntityNameText(typeNode.qualifier).trim()
      : undefined;
    if (!exportName) {
      return undefined;
    }

    return {
      specifier: literal.text,
      exportName,
    };
  }

  if (!ts.isTypeQueryNode(typeNode)) {
    return undefined;
  }

  const exprName = typeNode.exprName;
  const rootIdentifier = ts.isIdentifier(exprName)
    ? exprName
    : ts.isQualifiedName(exprName)
      ? exprName.left
      : undefined;
  if (!rootIdentifier || !ts.isIdentifier(rootIdentifier)) {
    return undefined;
  }

  const sourceFile = declaration.getSourceFile();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }

    const namedBindings = statement.importClause.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    for (const element of namedBindings.elements) {
      if (element.name.text !== rootIdentifier.text) {
        continue;
      }

      return {
        specifier: statement.moduleSpecifier.text,
        exportName: element.propertyName?.text ?? element.name.text,
      };
    }
  }

  return undefined;
};

const collectTopLevelClassDeclarations = (
  sourceFile: ts.SourceFile
): ReadonlyMap<string, ts.ClassDeclaration> => {
  const classes = new Map<string, ts.ClassDeclaration>();
  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text) {
      classes.set(statement.name.text, statement);
    }
  }
  return classes;
};

const resolveSourceBackedConstructedClassDeclaration = (opts: {
  readonly sourceNode: ts.Node;
  readonly constructorExpression?: ts.Expression;
  readonly callee: IrNewExpression["callee"];
  readonly ctx: ProgramContext;
}): ts.ClassDeclaration | undefined => {
  const { sourceNode, constructorExpression, callee, ctx } = opts;
  if (constructorExpression) {
    const referencedClass = resolveReferencedClassDeclaration(
      constructorExpression,
      ctx
    );
    if (referencedClass && !referencedClass.getSourceFile().isDeclarationFile) {
      return referencedClass;
    }
  }

  const ambientSymbol =
    callee.kind === "identifier"
      ? ctx.checker
          .getSymbolsInScope(sourceNode, ts.SymbolFlags.Value)
          .find((symbol) => symbol.name === callee.name)
      : undefined;
  if (ambientSymbol) {
    for (const declaration of ambientSymbol.getDeclarations() ?? []) {
      const target = extractImportTypeTarget(declaration);
      if (!target) {
        continue;
      }

      const resolved = resolveImport(
        target.specifier,
        declaration.getSourceFile().fileName,
        ctx.sourceRoot,
        {
          clrResolver: ctx.clrResolver,
          bindings: ctx.bindings,
          projectRoot: ctx.projectRoot,
          surface: ctx.surface,
          authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
          declarationModuleAliases: ctx.declarationModuleAliases,
        }
      );
      if (!resolved.ok || !resolved.value.resolvedPath) {
        continue;
      }

      const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
      if (!sourceFile || sourceFile.isDeclarationFile) {
        continue;
      }

      const ambientTargetClass = collectTopLevelClassDeclarations(sourceFile).get(
        target.exportName.split(".").pop() ?? target.exportName
      );
      if (ambientTargetClass) {
        return ambientTargetClass;
      }
    }
  }

  if (
    callee.kind !== "identifier" ||
    !callee.resolvedAssembly ||
    !callee.resolvedClrType
  ) {
    return undefined;
  }

  const binding = ctx.bindings.getExactBindingByKind(callee.name, "global");
  if (
    !binding ||
    binding.assembly !== callee.resolvedAssembly ||
    binding.type !== callee.resolvedClrType ||
    !binding.sourceImport
  ) {
    return undefined;
  }

  const resolved = resolveImport(
    binding.sourceImport,
    sourceNode.getSourceFile().fileName,
    ctx.sourceRoot,
    {
      clrResolver: ctx.clrResolver,
      bindings: ctx.bindings,
      projectRoot: ctx.projectRoot,
      surface: ctx.surface,
      authoritativeTsonicPackageRoots: ctx.authoritativeTsonicPackageRoots,
      declarationModuleAliases: ctx.declarationModuleAliases,
    }
  );
  if (!resolved.ok || !resolved.value.resolvedPath) {
    return undefined;
  }

  const sourceFile = getSourceFileForPath(resolved.value.resolvedPath, ctx);
  if (!sourceFile || sourceFile.isDeclarationFile) {
    return undefined;
  }

  return collectTopLevelClassDeclarations(sourceFile).get(callee.name);
};

export const buildSourceBackedConstructorParameterTypes = (opts: {
  readonly sourceNode: ts.Node;
  readonly constructorExpression?: ts.Expression;
  readonly callee: IrNewExpression["callee"];
  readonly constructedType: IrType | undefined;
  readonly argumentCount: number;
  readonly actualArgTypes: readonly (IrType | undefined)[];
  readonly ctx: ProgramContext;
}): SourceBackedConstructorParameterTypes | undefined => {
  const {
    sourceNode,
    constructorExpression,
    callee,
    constructedType,
    argumentCount,
    actualArgTypes,
    ctx,
  } = opts;
  const ownerClass = resolveSourceBackedConstructedClassDeclaration({
    sourceNode,
    constructorExpression,
    callee,
    ctx,
  });
  if (!ownerClass) {
    return undefined;
  }

  const declaration = ownerClass.members.find((member) =>
    ts.isConstructorDeclaration(member)
  );
  if (!declaration || !ts.isConstructorDeclaration(declaration)) {
    return {
      parameterTypes: [],
      surfaceParameterTypes: [],
      restParameter: undefined,
    };
  }

  const ownerTypeParameterNames =
    ownerClass.typeParameters?.map((parameter) => parameter.name.text) ?? [];
  const ownerSubstitution =
    constructedType?.kind === "referenceType" &&
    constructedType.typeArguments?.length === ownerTypeParameterNames.length &&
    ownerTypeParameterNames.length > 0
      ? new Map(
          ownerTypeParameterNames.flatMap((name, index) => {
            const typeArgument = constructedType.typeArguments?.[index];
            return name && typeArgument ? [[name, typeArgument] as const] : [];
          })
        )
      : undefined;

  const declaredParameterTypes = declaration.parameters.map((parameter) => {
    const declaredType = parameter.type
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(parameter.type))
      : ({ kind: "unknownType" } as const);
    const specializedType =
      ownerSubstitution && ownerSubstitution.size > 0
        ? substituteTypeParameters(declaredType, ownerSubstitution) ?? declaredType
        : declaredType;
    return parameter.questionToken
      ? addUndefinedToType(specializedType)
      : specializedType;
  });

  const expandedDeclaredParameterTypes = expandParameterTypesForArguments(
    declaration.parameters.map((parameter) => ({
      isRest: !!parameter.dotDotDotToken,
    })),
    declaredParameterTypes,
    argumentCount
  );
  const surfaceParameterTypes = expandedDeclaredParameterTypes;
  const selectionParameterTypes = surfaceParameterTypes.map(
    (parameterType) =>
      expandAuthoritativeSourceBackedSurfaceType(parameterType, ctx) ??
      parameterType
  );

  return {
    parameterTypes: selectionParameterTypes.map((parameterType, index) =>
      selectDeterministicSourceBackedParameterType(
        parameterType,
        actualArgTypes[index],
        ctx
      )
    ),
    surfaceParameterTypes,
    restParameter: buildResolvedRestParameter(
      declaration.parameters.map((parameter) => ({
        isRest: !!parameter.dotDotDotToken,
      })),
      surfaceParameterTypes
    ),
  };
};
