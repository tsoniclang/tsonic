/**
 * Dynamic import() expression emission.
 * Emits import() as Task.Run(() => RuntimeHelpers.RunClassConstructor(...)).
 */

import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import type { ModuleIdentity } from "../../emitter-types/core.js";
import { resolveImportPath } from "../../core/semantic/index.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import { buildTaskRunInvocation } from "./call-promise.js";

const getDynamicImportSpecifier = (
  expr: Extract<IrExpression, { kind: "call" }>
): string | undefined => {
  const [arg] = expr.arguments;
  if (!arg || arg.kind === "spread") return undefined;
  return arg.kind === "literal" && typeof arg.value === "string"
    ? arg.value
    : undefined;
};

const resolveDynamicImportTargetModule = (
  specifier: string,
  context: EmitterContext
): ModuleIdentity | undefined => {
  const currentFilePath = context.options.currentModuleFilePath;
  const moduleMap = context.options.moduleMap;
  if (!currentFilePath || !moduleMap) {
    return undefined;
  }

  const targetPath = resolveImportPath(currentFilePath, specifier);
  const direct = moduleMap.get(targetPath);
  if (direct) {
    return direct;
  }

  const normalizedTarget = targetPath.replace(/\\/g, "/");
  for (const [key, identity] of moduleMap.entries()) {
    const normalizedKey = key.replace(/\\/g, "/");
    if (
      normalizedKey === normalizedTarget ||
      normalizedKey.endsWith(`/${normalizedTarget}`) ||
      normalizedTarget.endsWith(`/${normalizedKey}`)
    ) {
      return identity;
    }
  }

  return undefined;
};

const buildDynamicImportContainerType = (
  targetModule: NonNullable<ReturnType<typeof resolveDynamicImportTargetModule>>
): CSharpTypeAst => {
  const containerName = targetModule.hasTypeCollision
    ? `${targetModule.className}__Module`
    : targetModule.className;

  return identifierType(`global::${targetModule.namespace}.${containerName}`);
};

const buildRunClassConstructorExpression = (
  containerType: CSharpTypeAst
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: {
      ...identifierExpression(
        "global::System.Runtime.CompilerServices.RuntimeHelpers"
      ),
    },
    memberName: "RunClassConstructor",
  },
  arguments: [
    {
      kind: "memberAccessExpression",
      expression: {
        kind: "typeofExpression",
        type: containerType,
      },
      memberName: "TypeHandle",
    },
  ],
});

export const emitDynamicImportCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | null => {
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "import") {
    return null;
  }

  const specifier = getDynamicImportSpecifier(expr);
  if (!specifier) return null;

  const completedTaskExpr: CSharpExpressionAst = {
    kind: "memberAccessExpression",
    expression: identifierExpression("global::System.Threading.Tasks.Task"),
    memberName: "CompletedTask",
  };

  const targetModule = resolveDynamicImportTargetModule(specifier, context);

  if (!expr.dynamicImportNamespace) {
    if (!targetModule || !targetModule.hasRuntimeContainer) {
      return [completedTaskExpr, context];
    }

    const containerType = buildDynamicImportContainerType(targetModule);
    const runClassConstructor =
      buildRunClassConstructorExpression(containerType);

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: identifierExpression(
            "global::System.Threading.Tasks.Task"
          ),
          memberName: "Run",
        },
        arguments: [
          {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [],
            body: runClassConstructor,
          },
        ],
      },
      context,
    ];
  }

  if (!targetModule) {
    throw new Error(
      `ICE: Closed-world dynamic import '${specifier}' was validated as a namespace import but no module identity was available during emission.`
    );
  }

  let currentContext = context;
  const [outputTaskType, outputTaskContext] = emitTypeAst(
    expr.inferredType ?? {
      kind: "referenceType",
      name: "Promise",
      typeArguments: [{ kind: "referenceType", name: "object" }],
    },
    currentContext
  );
  currentContext = outputTaskContext;

  const [namespaceAst, namespaceContext] =
    expr.dynamicImportNamespace.properties.length === 0
      ? [
          {
            kind: "objectCreationExpression" as const,
            type: { kind: "predefinedType" as const, keyword: "object" },
            arguments: [],
          } satisfies CSharpExpressionAst,
          currentContext,
        ]
      : emitExpressionAst(
          expr.dynamicImportNamespace,
          currentContext,
          expr.dynamicImportNamespace.inferredType
        );
  currentContext = namespaceContext;

  const setupStatements: CSharpStatementAst[] = [];
  if (targetModule.hasRuntimeContainer) {
    const containerType = buildDynamicImportContainerType(targetModule);
    setupStatements.push({
      kind: "expressionStatement",
      expression: buildRunClassConstructorExpression(containerType),
    });
  }

  return [
    buildTaskRunInvocation(
      outputTaskType,
      {
        kind: "blockStatement",
        statements: [
          ...setupStatements,
          {
            kind: "returnStatement",
            expression: namespaceAst,
          },
        ],
      },
      false
    ),
    currentContext,
  ];
};
