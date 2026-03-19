/**
 * Yield Lowering Helpers
 *
 * Shared types, utilities, and yield-detection functions used by
 * yield-expression-lowering and yield-statement-lowering sub-modules.
 */

import {
  Diagnostic,
  createDiagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrStatement,
  IrExpression,
  IrYieldStatement,
  IrGeneratorReturnStatement,
  IrYieldExpression,
  IrPattern,
  IrType,
} from "../types.js";

/**
 * Context for tracking state during yield lowering
 */
export type LoweringContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
  /** True if we're inside a generator function */
  readonly inGenerator: boolean;
  yieldTempCounter: number;
};

/**
 * Result of lowering an expression that contains yield sub-expressions.
 */
export type LoweredExpressionWithYields = {
  readonly prelude: readonly IrStatement[];
  readonly expression: IrExpression;
};

/**
 * Create a source location for a module
 */
export const moduleLocation = (ctx: LoweringContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

/**
 * Check if an expression contains a yield expression anywhere in its tree.
 */
export const containsYield = (expr: IrExpression): boolean => {
  switch (expr.kind) {
    case "yield":
      return true;

    case "binary":
    case "logical":
      return containsYield(expr.left) || containsYield(expr.right);

    case "unary":
    case "update":
    case "await":
    case "spread":
      return containsYield(expr.expression);

    case "conditional":
      return (
        containsYield(expr.condition) ||
        containsYield(expr.whenTrue) ||
        containsYield(expr.whenFalse)
      );

    case "assignment":
      return (
        (expr.left.kind !== "identifierPattern" &&
          expr.left.kind !== "arrayPattern" &&
          expr.left.kind !== "objectPattern" &&
          containsYield(expr.left)) ||
        containsYield(expr.right)
      );

    case "memberAccess":
      return (
        containsYield(expr.object) ||
        (typeof expr.property !== "string" && containsYield(expr.property))
      );

    case "call":
    case "new":
      return (
        containsYield(expr.callee) ||
        expr.arguments.some((a) => containsYield(a)) ||
        (expr.kind === "call" &&
          expr.dynamicImportNamespace !== undefined &&
          containsYield(expr.dynamicImportNamespace))
      );

    case "array":
      return expr.elements.some((e) => e !== undefined && containsYield(e));

    case "object":
      return expr.properties.some((p) => {
        if (p.kind === "property") {
          return (
            (typeof p.key !== "string" && containsYield(p.key)) ||
            containsYield(p.value)
          );
        }
        return containsYield(p.expression);
      });

    case "templateLiteral":
      return expr.expressions.some((e) => containsYield(e));

    case "arrowFunction":
    case "functionExpression":
      // Don't recurse into nested functions - they have their own generator context
      return false;

    default:
      return false;
  }
};

/**
 * Count the number of yield expressions in an expression tree.
 */
export const countYields = (expr: IrExpression): number => {
  switch (expr.kind) {
    case "yield":
      return 1 + (expr.expression ? countYields(expr.expression) : 0);

    case "binary":
    case "logical":
      return countYields(expr.left) + countYields(expr.right);

    case "unary":
    case "update":
    case "await":
    case "spread":
      return countYields(expr.expression);

    case "conditional":
      return (
        countYields(expr.condition) +
        countYields(expr.whenTrue) +
        countYields(expr.whenFalse)
      );

    case "assignment":
      return (
        (expr.left.kind !== "identifierPattern" &&
        expr.left.kind !== "arrayPattern" &&
        expr.left.kind !== "objectPattern"
          ? countYields(expr.left)
          : 0) + countYields(expr.right)
      );

    case "memberAccess":
      return (
        countYields(expr.object) +
        (typeof expr.property !== "string" ? countYields(expr.property) : 0)
      );

    case "call":
    case "new":
      return (
        countYields(expr.callee) +
        expr.arguments.reduce((sum, a) => sum + countYields(a), 0) +
        (expr.kind === "call" && expr.dynamicImportNamespace
          ? countYields(expr.dynamicImportNamespace)
          : 0)
      );

    case "array":
      return expr.elements.reduce(
        (sum, e) => sum + (e !== undefined ? countYields(e) : 0),
        0
      );

    case "object":
      return expr.properties.reduce((sum, p) => {
        if (p.kind === "property") {
          return (
            sum +
            (typeof p.key !== "string" ? countYields(p.key) : 0) +
            countYields(p.value)
          );
        }
        return sum + countYields(p.expression);
      }, 0);

    case "templateLiteral":
      return expr.expressions.reduce((sum, e) => sum + countYields(e), 0);

    case "arrowFunction":
    case "functionExpression":
      return 0;

    default:
      return 0;
  }
};

/**
 * Create an IrYieldStatement from a yield expression.
 */
export const createYieldStatement = (
  yieldExpr: IrYieldExpression,
  receiveTarget: IrPattern | undefined,
  receivedType: IrType | undefined
): IrYieldStatement => ({
  kind: "yieldStatement",
  output: yieldExpr.expression,
  delegate: yieldExpr.delegate,
  receiveTarget,
  receivedType,
});

export const toReceivePattern = (
  target: IrExpression | IrPattern
): IrPattern | undefined => {
  if (
    target.kind === "identifierPattern" ||
    target.kind === "arrayPattern" ||
    target.kind === "objectPattern"
  ) {
    return target;
  }

  if (target.kind === "identifier") {
    return { kind: "identifierPattern", name: target.name };
  }

  return undefined;
};

/**
 * Create an IrGeneratorReturnStatement from a return statement's expression.
 * This captures the return value for generators with TReturn.
 */
export const createGeneratorReturnStatement = (
  expression: IrExpression | undefined
): IrGeneratorReturnStatement => ({
  kind: "generatorReturnStatement",
  expression,
});

/**
 * Emit diagnostic for unsupported yield position.
 */
export const emitUnsupportedYieldDiagnostic = (
  ctx: LoweringContext,
  position: string,
  location?: SourceLocation
): void => {
  ctx.diagnostics.push(
    createDiagnostic(
      "TSN6101",
      "error",
      `Yield expression in ${position} is not supported`,
      location ?? moduleLocation(ctx),
      "Extract yield to a separate statement: `const result = yield expr; use(result);`"
    )
  );
};

export const allocateYieldTempName = (ctx: LoweringContext): string => {
  ctx.yieldTempCounter += 1;
  return `__tsonic_yield_${ctx.yieldTempCounter}`;
};

export const createTempVariableDeclaration = (
  name: string,
  initializer: IrExpression,
  inferredType?: IrType
): IrStatement => ({
  kind: "variableDeclaration",
  declarationKind: "const",
  isExported: false,
  declarations: [
    {
      kind: "variableDeclarator",
      name: { kind: "identifierPattern", name },
      type: inferredType,
      initializer,
    },
  ],
});

/**
 * Type guard to check if a result is a single statement (has 'kind' property).
 */
export const isSingleStatement = (
  result: IrStatement | readonly IrStatement[]
): result is IrStatement => {
  return "kind" in result && typeof result.kind === "string";
};

/**
 * Flatten a statement result to a single statement (wrap in block if needed).
 */
export const flattenStatement = (
  result: IrStatement | readonly IrStatement[]
): IrStatement => {
  if (isSingleStatement(result)) {
    return result;
  }
  // result is now readonly IrStatement[]
  if (result.length === 1 && result[0] !== undefined) {
    return result[0];
  }
  return {
    kind: "blockStatement",
    statements: [...result],
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const collectResidualYieldExpressions = (
  value: unknown,
  collected: IrYieldExpression[]
): void => {
  if (Array.isArray(value)) {
    for (const element of value) {
      collectResidualYieldExpressions(element, collected);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value.kind === "yield") {
    collected.push(value as unknown as IrYieldExpression);
    return;
  }

  for (const nested of Object.values(value)) {
    collectResidualYieldExpressions(nested, collected);
  }
};

const locationKey = (location: SourceLocation): string =>
  `${location.file}:${location.line}:${location.column}:${location.length}`;

export const addResidualYieldDiagnostics = (
  ctx: LoweringContext,
  value: unknown
): void => {
  const residualYields: IrYieldExpression[] = [];
  collectResidualYieldExpressions(value, residualYields);
  if (residualYields.length === 0) {
    return;
  }

  const existingTsn6101Locations = new Set<string>(
    ctx.diagnostics
      .filter((d) => d.code === "TSN6101")
      .map((d) => locationKey(d.location ?? moduleLocation(ctx)))
  );

  for (const residualYield of residualYields) {
    const location = residualYield.sourceSpan ?? moduleLocation(ctx);
    const key = locationKey(location);
    if (existingTsn6101Locations.has(key)) {
      continue;
    }
    emitUnsupportedYieldDiagnostic(
      ctx,
      "an unsupported expression form after yield lowering",
      location
    );
    existingTsn6101Locations.add(key);
  }
};
