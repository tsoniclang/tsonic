/**
 * Static container class emission
 *
 * Builds a CSharpClassDeclarationAst for the module's static container class.
 * The container holds static fields, methods, and a __TopLevel() entry point.
 */

import {
  IrModule,
  IrExpression,
  IrParameter,
  IrType,
  IrPattern,
  IrStatement,
  isExecutableStatement,
} from "@tsonic/frontend";
import {
  EmitterContext,
  type ValueSymbolInfo,
  indent,
  withStatic,
  withClassName,
} from "../../../types.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import {
  emitFunctionDeclaration,
  emitVariableDeclaration,
  emitTypeAliasDeclaration,
} from "../../../statements/declarations.js";
import { emitExport } from "../exports.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { statementUsesPointer } from "../../semantic/unsafe.js";
import { getCSharpName } from "../../../naming-policy.js";
import { identifierType } from "../backend-ast/builders.js";
import { moduleBodyEmitsNamespaceTypeNamed } from "../../semantic/module-type-collisions.js";
import { surfaceMemberMutatesReceiver } from "../../semantic/surface-member-semantics.js";
import { resolveArrayLikeReceiverType } from "../../semantic/type-resolution.js";
import type {
  CSharpClassDeclarationAst,
  CSharpMemberAst,
  CSharpStatementAst,
} from "../backend-ast/types.js";

export type StaticContainerResult = {
  readonly declaration: CSharpClassDeclarationAst;
  readonly context: EmitterContext;
};

const isIdentifierPattern = (
  parameter: IrParameter
): parameter is IrParameter & {
  readonly pattern: Extract<IrPattern, { kind: "identifierPattern" }>;
} => parameter.pattern.kind === "identifierPattern";

const expressionDirectlyMutatesArrayParameter = (
  value: unknown,
  parameterNames: ReadonlySet<string>,
  context: EmitterContext,
  visited: WeakSet<object> = new WeakSet<object>()
): Set<string> => {
  const mutated = new Set<string>();

  const visit = (candidate: unknown): void => {
    if (candidate == null || typeof candidate !== "object") {
      return;
    }

    if (visited.has(candidate)) {
      return;
    }
    visited.add(candidate);

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item);
      }
      return;
    }

    const node = candidate as { readonly kind?: unknown };
    if (node.kind === "functionExpression" || node.kind === "arrowFunction") {
      return;
    }

    if (node.kind === "call") {
      const call = candidate as Extract<IrExpression, { kind: "call" }>;
      const callee = call.callee;
      if (
        callee.kind === "memberAccess" &&
        !callee.isComputed &&
        typeof callee.property === "string" &&
        callee.object.kind === "identifier" &&
        parameterNames.has(callee.object.name) &&
        callee.memberBinding &&
        surfaceMemberMutatesReceiver(callee.memberBinding, context) &&
        resolveArrayLikeReceiverType(
          callee.object.inferredType,
          context
        ) !== undefined
      ) {
        mutated.add(callee.object.name);
      }
    }

    for (const [key, child] of Object.entries(
      candidate as Record<string, unknown>
    )) {
      if (
        key === "inferredType" ||
        key === "contextualType" ||
        key === "sourceSpan" ||
        key === "memberBinding" ||
        key === "parameterTypes" ||
        key === "sourceBackedSurfaceParameterTypes" ||
        key === "surfaceParameterTypes" ||
        key === "sourceBackedRestParameter" ||
        key === "surfaceRestParameter" ||
        key === "restParameter"
      ) {
        continue;
      }
      visit(child);
    }
  };

  visit(value);
  return mutated;
};

const inferArrayMutationRefParameters = (
  members: readonly IrStatement[],
  context: EmitterContext
): readonly IrStatement[] => {
  const mutableArrayParameters = new Map<string, Set<string>>();
  const functions = members.filter(
    (
      member
    ): member is Extract<IrStatement, { kind: "functionDeclaration" }> =>
      member.kind === "functionDeclaration"
  );

  for (const fn of functions) {
    const parameterNames = new Set(
      fn.parameters
        .filter(isIdentifierPattern)
        .filter(
          (parameter) =>
            parameter.type !== undefined &&
            resolveArrayLikeReceiverType(parameter.type, context) !== undefined
        )
        .map((parameter) => parameter.pattern.name)
    );
    if (parameterNames.size === 0) {
      continue;
    }

    const directlyMutated = expressionDirectlyMutatesArrayParameter(
      fn.body,
      parameterNames,
      context
    );
    if (directlyMutated.size > 0) {
      mutableArrayParameters.set(fn.name, directlyMutated);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of functions) {
      const parameterNames = new Set(
        fn.parameters
          .filter(isIdentifierPattern)
          .filter(
            (parameter) =>
              parameter.type !== undefined &&
              resolveArrayLikeReceiverType(parameter.type, context) !==
                undefined
          )
          .map((parameter) => parameter.pattern.name)
      );
      if (parameterNames.size === 0) {
        continue;
      }

      const inherited = mutableArrayParameters.get(fn.name) ?? new Set<string>();
      const visit = (
        candidate: unknown,
        visited: WeakSet<object> = new WeakSet<object>()
      ): void => {
        if (candidate == null || typeof candidate !== "object") {
          return;
        }
        if (visited.has(candidate)) {
          return;
        }
        visited.add(candidate);
        if (Array.isArray(candidate)) {
          for (const item of candidate) visit(item, visited);
          return;
        }

        const node = candidate as { readonly kind?: unknown };
        if (node.kind === "functionExpression" || node.kind === "arrowFunction") {
          return;
        }

        if (node.kind === "call") {
          const call = candidate as Extract<IrExpression, { kind: "call" }>;
          if (call.callee.kind === "identifier") {
            const calleeName = call.callee.name;
            const calleeMutatedParams = mutableArrayParameters.get(
              calleeName
            );
            if (calleeMutatedParams) {
              const callee = functions.find(
                (candidateFunction) => candidateFunction.name === calleeName
              );
              if (callee) {
                callee.parameters.forEach((parameter, index) => {
                  if (
                    !isIdentifierPattern(parameter) ||
                    !calleeMutatedParams.has(parameter.pattern.name)
                  ) {
                    return;
                  }

                  const arg = call.arguments[index];
                  if (
                    arg?.kind === "identifier" &&
                    parameterNames.has(arg.name) &&
                    !inherited.has(arg.name)
                  ) {
                    inherited.add(arg.name);
                    mutableArrayParameters.set(fn.name, inherited);
                    changed = true;
                  }
                });
              }
            }
          }
        }

        for (const [key, child] of Object.entries(
          candidate as Record<string, unknown>
        )) {
          if (
            key === "inferredType" ||
            key === "contextualType" ||
            key === "sourceSpan" ||
            key === "memberBinding" ||
            key === "parameterTypes" ||
            key === "sourceBackedSurfaceParameterTypes" ||
            key === "surfaceParameterTypes" ||
            key === "sourceBackedRestParameter" ||
            key === "surfaceRestParameter" ||
            key === "restParameter"
          ) {
            continue;
          }
          visit(child, visited);
        }
      };

      visit(fn.body);
    }
  }

  if (mutableArrayParameters.size === 0) {
    return members;
  }

  const rewriteInferredRefCalls = (
    candidate: unknown,
    visited: WeakMap<object, unknown> = new WeakMap<object, unknown>()
  ): unknown => {
    if (candidate == null || typeof candidate !== "object") {
      return candidate;
    }

    if (visited.has(candidate)) {
      return visited.get(candidate);
    }

    if (Array.isArray(candidate)) {
      const rewritten = candidate.map((item) =>
        rewriteInferredRefCalls(item, visited)
      );
      visited.set(candidate, rewritten);
      return rewritten;
    }

    const node = candidate as { readonly kind?: unknown };
    if (node.kind === "functionExpression" || node.kind === "arrowFunction") {
      return candidate;
    }

    const copy: Record<string, unknown> = {};
    visited.set(candidate, copy);
    for (const [key, child] of Object.entries(
      candidate as Record<string, unknown>
    )) {
      if (
        key === "inferredType" ||
        key === "contextualType" ||
        key === "sourceSpan" ||
        key === "memberBinding" ||
        key === "parameterTypes" ||
        key === "sourceBackedSurfaceParameterTypes" ||
        key === "surfaceParameterTypes" ||
        key === "sourceBackedRestParameter" ||
        key === "surfaceRestParameter" ||
        key === "restParameter"
      ) {
        copy[key] = child;
        continue;
      }
      copy[key] = rewriteInferredRefCalls(child, visited);
    }

    if (node.kind === "call") {
      const call = candidate as Extract<IrExpression, { kind: "call" }>;
      if (call.callee.kind === "identifier") {
        const calleeName = call.callee.name;
        const mutated = mutableArrayParameters.get(calleeName);
        const callee = functions.find(
          (candidateFunction) => candidateFunction.name === calleeName
        );
        if (mutated && callee) {
          const argumentPassing = [...(call.argumentPassing ?? [])];
          callee.parameters.forEach((parameter, index) => {
            if (
              isIdentifierPattern(parameter) &&
              mutated.has(parameter.pattern.name) &&
              (argumentPassing[index] === undefined ||
                argumentPassing[index] === "value")
            ) {
              argumentPassing[index] = "ref";
            }
          });
          if (argumentPassing.some((mode) => mode !== undefined)) {
            copy.argumentPassing = argumentPassing;
          }
        }
      }
    }

    return copy;
  };

  const rewrittenMembers = members.map((member) => {
    if (member.kind !== "functionDeclaration") {
      return member;
    }

    const mutated = mutableArrayParameters.get(member.name);
    if (!mutated || mutated.size === 0) {
      return member;
    }

    return {
      ...member,
      parameters: member.parameters.map((parameter) =>
        isIdentifierPattern(parameter) &&
        parameter.passing === "value" &&
        mutated.has(parameter.pattern.name)
          ? { ...parameter, passing: "ref" as const }
          : parameter
      ),
    };
  });

  return rewrittenMembers.map(
    (member) => rewriteInferredRefCalls(member) as IrStatement
  );
};

export const collectStaticContainerValueSymbols = (
  members: readonly IrStatement[],
  context: EmitterContext
): ReadonlyMap<string, ValueSymbolInfo> => {
  const valueSymbols = new Map<string, ValueSymbolInfo>();

  const toFunctionType = (
    member: Extract<IrStatement, { kind: "functionDeclaration" }>
  ): Extract<IrType, { kind: "functionType" }> => ({
    kind: "functionType",
    parameters: member.parameters,
    returnType: member.returnType ?? { kind: "voidType" },
  });

  const collectPatternIdentifiers = (pattern: IrPattern): readonly string[] => {
    switch (pattern.kind) {
      case "identifierPattern":
        return [pattern.name];
      case "arrayPattern": {
        const names: string[] = [];
        for (const element of pattern.elements) {
          if (!element) continue;
          names.push(...collectPatternIdentifiers(element.pattern));
        }
        return names;
      }
      case "objectPattern": {
        const names: string[] = [];
        for (const property of pattern.properties) {
          if (property.kind === "property") {
            names.push(...collectPatternIdentifiers(property.value));
          } else {
            names.push(...collectPatternIdentifiers(property.pattern));
          }
        }
        return names;
      }
      default:
        return [];
    }
  };

  for (const member of members) {
    if (member.kind === "functionDeclaration") {
      const publicName = member.overloadFamily?.publicName ?? member.name;
      valueSymbols.set(member.name, {
        kind: "function",
        csharpName: getCSharpName(publicName, "methods", context),
        type: toFunctionType(member),
      });
      continue;
    }
    if (member.kind === "variableDeclaration") {
      for (const decl of member.declarations) {
        const functionType =
          decl.initializer &&
          (decl.initializer.kind === "arrowFunction" ||
            decl.initializer.kind === "functionExpression") &&
          decl.initializer.inferredType?.kind === "functionType"
            ? decl.initializer.inferredType
            : decl.type?.kind === "functionType"
              ? decl.type
              : undefined;
        for (const name of collectPatternIdentifiers(decl.name)) {
          valueSymbols.set(name, {
            kind: "variable",
            csharpName: getCSharpName(name, "fields", context),
            type: functionType,
          });
        }
      }
    }
  }

  return valueSymbols;
};

/**
 * Check if there's a namespace-level class with the same name as the module
 */
export const hasMatchingClassName = (
  declarations: readonly IrStatement[],
  className: string
): boolean => {
  return moduleBodyEmitsNamespaceTypeNamed(declarations, className);
};

/**
 * Emit static container class as CSharpClassDeclarationAst.
 *
 * @param useModuleSuffix - If true, adds __Module suffix to avoid collision with namespace-level types
 */
export const emitStaticContainer = (
  module: IrModule,
  members: readonly IrStatement[],
  baseContext: EmitterContext,
  hasInheritance: boolean,
  useModuleSuffix: boolean = false
): StaticContainerResult => {
  const semanticMembers = inferArrayMutationRefParameters(members, baseContext);
  const escapedClassName = escapeCSharpIdentifier(module.className);
  const containerName = useModuleSuffix
    ? `${escapedClassName}__Module`
    : escapedClassName;

  const valueSymbols = collectStaticContainerValueSymbols(
    semanticMembers,
    baseContext
  );
  const classContext = withClassName(
    {
      ...withStatic(indent(baseContext), true),
      valueSymbols,
    },
    containerName
  );
  const bodyContext = indent(classContext);
  const needsUnsafe = semanticMembers.some((m) => statementUsesPointer(m));

  // Separate declarations from executable statements
  const isEntryPointWithTopLevelCode =
    baseContext.options.isEntryPoint &&
    semanticMembers.some(isExecutableStatement);

  const staticMemberKinds = [
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "typeAliasDeclaration",
    "enumDeclaration",
    "variableDeclaration",
  ];

  const declarations = isEntryPointWithTopLevelCode
    ? semanticMembers.filter((m) => staticMemberKinds.includes(m.kind))
    : semanticMembers.filter((m) => !isExecutableStatement(m));

  const mainBodyStmts = isEntryPointWithTopLevelCode
    ? semanticMembers.filter((m) => !staticMemberKinds.includes(m.kind))
    : semanticMembers.filter(isExecutableStatement);

  const astMembers: CSharpMemberAst[] = [];
  let bodyCurrentContext = bodyContext;

  // Emit declarations as static members
  for (const stmt of declarations) {
    switch (stmt.kind) {
      case "functionDeclaration": {
        const [funcMembers, funcCtx] = emitFunctionDeclaration(
          stmt,
          bodyCurrentContext
        );
        astMembers.push(...funcMembers);
        bodyCurrentContext = funcCtx;
        break;
      }

      case "variableDeclaration": {
        const [varMembers, varCtx] = emitVariableDeclaration(
          stmt,
          bodyCurrentContext
        );
        astMembers.push(...varMembers);
        bodyCurrentContext = varCtx;
        break;
      }

      case "typeAliasDeclaration": {
        const [, aliasCtx] = emitTypeAliasDeclaration(stmt, bodyCurrentContext);
        bodyCurrentContext = aliasCtx;
        break;
      }

      default:
        // Other declaration types in static container are rare but possible
        break;
    }
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    bodyCurrentContext = emitExport(exp, bodyCurrentContext);
  }

  // Wrap executable statements in __TopLevel method
  if (mainBodyStmts.length > 0 && baseContext.options.isEntryPoint) {
    const mainBodyContext = withStatic(indent(bodyCurrentContext), false);
    let mainCurrentContext = mainBodyContext;
    const topLevelStatements: CSharpStatementAst[] = [];

    for (const stmt of mainBodyStmts) {
      const [stmts, newContext] = emitStatementAst(stmt, mainCurrentContext);
      topLevelStatements.push(...stmts);
      mainCurrentContext = newContext;
    }

    astMembers.push({
      kind: "methodDeclaration",
      attributes: [],
      modifiers: ["public", "static"],
      returnType: { kind: "predefinedType", keyword: "void" },
      name: "__TopLevel",
      parameters: [],
      body: { kind: "blockStatement", statements: topLevelStatements },
    });
    bodyCurrentContext = mainCurrentContext;
  } else if (mainBodyStmts.length > 0) {
    // Not an entry point - run top-level statements in a static constructor.
    const mainBodyContext = withStatic(indent(bodyCurrentContext), false);
    let mainCurrentContext = mainBodyContext;
    const ctorStatements: CSharpStatementAst[] = [];

    for (const stmt of mainBodyStmts) {
      const [stmts, newContext] = emitStatementAst(stmt, mainCurrentContext);
      ctorStatements.push(...stmts);
      mainCurrentContext = newContext;
    }
    astMembers.push({
      kind: "constructorDeclaration",
      attributes: [],
      modifiers: ["static"],
      name: containerName,
      parameters: [],
      body: { kind: "blockStatement", statements: ctorStatements },
    });
    bodyCurrentContext = mainCurrentContext;
  }

  const modifiers = ["public", "static", ...(needsUnsafe ? ["unsafe"] : [])];

  const declaration: CSharpClassDeclarationAst = {
    kind: "classDeclaration",
    attributes: [
      {
        type: identifierType(
          "global::Tsonic.Internal.ModuleContainerAttribute"
        ),
      },
    ],
    modifiers,
    name: containerName,
    interfaces: [],
    members: astMembers,
  };

  return {
    declaration,
    context: { ...bodyCurrentContext, hasInheritance },
  };
};
