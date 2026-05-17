import {
  getAwaitedIrType,
  isAwaitableIrType,
  type IrType,
} from "@tsonic/frontend";
import { emitTypeAst } from "../type-emitter.js";
import type { EmitterContext } from "../types.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "../core/format/backend-ast/types.js";
import {
  identifierExpression,
  nullLiteral,
} from "../core/format/backend-ast/builders.js";
import {
  sameTypeAstSurface,
  stripNullableTypeAst,
} from "../core/format/backend-ast/utils.js";
import { allocateLocalName } from "../core/format/local-names.js";
import {
  isRuntimeNullishType,
  resolveTypeAlias,
  splitRuntimeNullishUnionMembers,
  stripNullish,
} from "../core/semantic/type-resolution.js";
import { matchesExpectedEmissionType } from "../core/semantic/expected-type-matching.js";
import {
  buildTaskRunInvocation,
  buildTaskTypeAst,
  isTaskTypeAst,
} from "./calls/call-promise-task-types.js";

type AwaitedValueAdapter = (
  ast: CSharpExpressionAst,
  actualType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined,
  visited?: ReadonlySet<string>
) => [CSharpExpressionAst, EmitterContext] | undefined;

const isVoidType = (type: IrType): boolean =>
  stripNullish(type).kind === "voidType";

const typeAcceptsRuntimeAbsence = (
  type: IrType,
  context: EmitterContext
): boolean => {
  const resolvedType = resolveTypeAlias(type, context);
  if (resolvedType.kind === "voidType") {
    return false;
  }
  if (isRuntimeNullishType(resolvedType)) {
    return true;
  }
  return splitRuntimeNullishUnionMembers(resolvedType)?.hasRuntimeNullish ?? false;
};

const getSingleAwaitableRuntimeType = (
  type: IrType,
  context: EmitterContext
):
  | {
      readonly awaitableType: IrType;
      readonly hasRuntimeNullish: boolean;
    }
  | undefined => {
  const resolvedType = resolveTypeAlias(type, context);
  const nullish = splitRuntimeNullishUnionMembers(resolvedType);
  const nonNullishMembers = nullish
    ? nullish.nonNullishMembers
    : [stripNullish(resolvedType)];
  if (nonNullishMembers.length !== 1) {
    return undefined;
  }

  const [candidate] = nonNullishMembers;
  if (!candidate) {
    return undefined;
  }

  const awaitableType = resolveTypeAlias(stripNullish(candidate), context);
  if (!isAwaitableIrType(awaitableType)) {
    return undefined;
  }

  return {
    awaitableType,
    hasRuntimeNullish: nullish?.hasRuntimeNullish ?? false,
  };
};

const buildNullSourceReturnStatement = (
  expectedAwaitedTypeAst: CSharpTypeAst | undefined
): CSharpStatementAst =>
  expectedAwaitedTypeAst
    ? {
        kind: "returnStatement",
        expression: {
          kind: "defaultExpression",
          type: expectedAwaitedTypeAst,
        },
      }
    : {
        kind: "returnStatement",
      };

export const tryAdaptAwaitableValueAst = (opts: {
  readonly ast: CSharpExpressionAst;
  readonly actualType: IrType;
  readonly expectedType: IrType;
  readonly context: EmitterContext;
  readonly expectedTypeAst?: CSharpTypeAst;
  readonly visited?: ReadonlySet<string>;
  readonly adaptAwaitedValueAst?: AwaitedValueAdapter;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const {
    ast,
    actualType,
    expectedType,
    expectedTypeAst,
    context,
    visited,
    adaptAwaitedValueAst,
  } = opts;
  let currentContext = context;

  const expectedAwaitableSource = getSingleAwaitableRuntimeType(
    expectedType,
    currentContext
  );
  const actualAwaitableSource = getSingleAwaitableRuntimeType(
    actualType,
    currentContext
  );
  if (!expectedAwaitableSource || !actualAwaitableSource) {
    return undefined;
  }

  let emittedExpectedType = expectedTypeAst;
  if (!emittedExpectedType) {
    [emittedExpectedType, currentContext] = emitTypeAst(
      expectedType,
      currentContext
    );
  }
  if (!isTaskTypeAst(stripNullableTypeAst(emittedExpectedType))) {
    return undefined;
  }
  const emittedActualType = (() => {
    try {
      return emitTypeAst(actualType, currentContext)[0];
    } catch {
      return undefined;
    }
  })();
  if (
    emittedActualType &&
    sameTypeAstSurface(
      stripNullableTypeAst(emittedActualType),
      stripNullableTypeAst(emittedExpectedType)
    )
  ) {
    return undefined;
  }

  const actualAwaitedType = getAwaitedIrType(
    actualAwaitableSource.awaitableType
  ) ?? { kind: "voidType" as const };
  const expectedAwaitedType = getAwaitedIrType(
    expectedAwaitableSource.awaitableType
  ) ?? { kind: "voidType" as const };
  const actualAwaitedIsVoid = isVoidType(actualAwaitedType);
  const expectedAwaitedIsVoid = isVoidType(expectedAwaitedType);

  let expectedAwaitedTypeAst: CSharpTypeAst | undefined;
  if (!expectedAwaitedIsVoid) {
    [expectedAwaitedTypeAst, currentContext] = emitTypeAst(
      expectedAwaitedType,
      currentContext
    );
  }

  const statements: CSharpStatementAst[] = [];
  let awaitedSourceAst = ast;
  if (actualAwaitableSource.hasRuntimeNullish) {
    const sourceTemp = allocateLocalName("__tsonic_await_task", currentContext);
    currentContext = sourceTemp.context;
    awaitedSourceAst = identifierExpression(sourceTemp.emittedName);
    statements.push(
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [
          {
            name: sourceTemp.emittedName,
            initializer: ast,
          },
        ],
      },
      {
        kind: "ifStatement",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: awaitedSourceAst,
          right: nullLiteral(),
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [buildNullSourceReturnStatement(expectedAwaitedTypeAst)],
        },
      }
    );
  }

  if (expectedAwaitedIsVoid) {
    statements.push({
      kind: "expressionStatement",
      expression: {
        kind: "awaitExpression",
        expression: awaitedSourceAst,
      },
    });
  } else if (actualAwaitedIsVoid) {
    if (!typeAcceptsRuntimeAbsence(expectedAwaitedType, currentContext)) {
      return undefined;
    }
    if (!expectedAwaitedTypeAst) {
      return undefined;
    }
    statements.push(
      {
        kind: "expressionStatement",
        expression: {
          kind: "awaitExpression",
          expression: awaitedSourceAst,
        },
      },
      {
        kind: "returnStatement",
        expression: {
          kind: "defaultExpression",
          type: expectedAwaitedTypeAst,
        },
      }
    );
  } else {
    const valueTemp = allocateLocalName("__tsonic_await_value", currentContext);
    currentContext = valueTemp.context;
    const valueAst = identifierExpression(valueTemp.emittedName);
    statements.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "varType" },
      declarators: [
        {
          name: valueTemp.emittedName,
          initializer: {
            kind: "awaitExpression",
            expression: awaitedSourceAst,
          },
        },
      ],
    });

    const adaptedAwaitedValue =
      adaptAwaitedValueAst?.(
        valueAst,
        actualAwaitedType,
        currentContext,
        expectedAwaitedType,
        visited
      ) ??
      (matchesExpectedEmissionType(
        actualAwaitedType,
        expectedAwaitedType,
        currentContext
      )
        ? ([valueAst, currentContext] satisfies [
            CSharpExpressionAst,
            EmitterContext,
          ])
        : undefined);
    if (!adaptedAwaitedValue) {
      return undefined;
    }
    currentContext = adaptedAwaitedValue[1];
    statements.push({
      kind: "returnStatement",
      expression: adaptedAwaitedValue[0],
    });
  }

  return [
    buildTaskRunInvocation(
      buildTaskTypeAst(expectedAwaitedTypeAst),
      {
        kind: "blockStatement",
        statements,
      },
      true
    ),
    currentContext,
  ];
};
