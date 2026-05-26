/**
 * Switch statement emitter - returns CSharpStatementAst nodes.
 */

import type { IrExpression, IrStatement, IrType } from "@tsonic/frontend";
import { EmitterContext, NarrowedBinding } from "../../../types.js";
import { emitExpressionAst } from "../../../expression-emitter.js";
import { stringLiteral } from "../../../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../../../core/format/backend-ast/types.js";
import {
  matchesTypeofTag,
  resolveTypeAlias,
} from "../../../core/semantic/type-resolution.js";
import { emitStatementAst } from "../../../statement-emitter.js";
import { tryResolveDiscriminantEqualityGuard } from "./guard-detectors-discriminant.js";
import {
  buildExprBinding,
  buildSubsetUnionType,
  buildUnionNarrowAst,
} from "./branch-context.js";
import { getMemberAccessNarrowKey } from "../../../core/semantic/narrowing-keys.js";
import { resolveEffectiveExpressionType } from "../../../core/semantic/narrowed-expression-types.js";
import {
  currentNarrowedType,
  resolveRuntimeUnionFrame,
} from "../../../core/semantic/narrowing-builders.js";
import { unwrapTransparentExpression } from "../../../core/semantic/transparent-expressions.js";
import { tryExtractTypeofUnaryTarget } from "../../../core/semantic/typeof-comparison.js";
import type {
  CSharpStatementAst,
  CSharpSwitchLabelAst,
  CSharpSwitchSectionAst,
} from "../../../core/format/backend-ast/types.js";

const exhaustiveSwitchFailureExpression = (): CSharpExpressionAst => ({
  kind: "objectCreationExpression",
  type: {
    kind: "qualifiedIdentifierType",
    name: {
      aliasQualifier: "global",
      segments: ["System", "InvalidOperationException"],
    },
  },
  arguments: [stringLiteral("Unreachable exhaustive switch case.")],
});

const literalKey = (value: string | number | boolean): string =>
  `${typeof value}:${String(value)}`;

const collectFiniteLiteralUnionKeys = (
  type: IrType | undefined,
  context: EmitterContext
): ReadonlySet<string> | undefined => {
  if (!type) {
    return undefined;
  }

  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "literalType") {
    return new Set([literalKey(resolved.value)]);
  }

  if (resolved.kind !== "unionType") {
    return undefined;
  }

  const keys = new Set<string>();
  for (const member of resolved.types) {
    const resolvedMember = resolveTypeAlias(member, context);
    if (resolvedMember.kind !== "literalType") {
      return undefined;
    }
    keys.add(literalKey(resolvedMember.value));
  }

  return keys.size > 0 ? keys : undefined;
};

const getLiteralCaseKey = (
  test: Extract<
    IrStatement,
    { kind: "switchStatement" }
  >["cases"][number]["test"]
): string | undefined => {
  if (!test || test.kind !== "literal") {
    return undefined;
  }
  if (
    typeof test.value !== "string" &&
    typeof test.value !== "number" &&
    typeof test.value !== "boolean"
  ) {
    return undefined;
  }
  return literalKey(test.value);
};

const isExhaustiveLiteralSwitch = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): boolean => {
  if (stmt.cases.some((switchCase) => switchCase.test === undefined)) {
    return false;
  }

  const expectedKeys = collectFiniteLiteralUnionKeys(
    stmt.expression.inferredType,
    context
  );
  if (!expectedKeys) {
    return false;
  }

  const handledKeys = new Set<string>();
  for (const switchCase of stmt.cases) {
    const key = getLiteralCaseKey(switchCase.test);
    if (!key) {
      return false;
    }
    handledKeys.add(key);
  }

  for (const key of expectedKeys) {
    if (!handledKeys.has(key)) {
      return false;
    }
  }

  return true;
};

type SwitchCaseNarrowing = {
  readonly receiverExpr: Extract<
    IrExpression,
    { kind: "identifier" | "memberAccess" }
  >;
  readonly receiverKey: string;
  readonly memberNs: readonly number[];
  readonly runtimeUnionArity: number;
  readonly candidateMemberNs: readonly number[];
  readonly candidateMembers: readonly IrType[];
  readonly sourceType: IrType | undefined;
};

const getTypeofSwitchCaseNarrowing = (
  switchExpression: IrExpression,
  switchCase: Extract<
    IrStatement,
    { kind: "switchStatement" }
  >["cases"][number],
  context: EmitterContext
): SwitchCaseNarrowing | undefined => {
  const typeofTarget = tryExtractTypeofUnaryTarget(switchExpression);
  if (
    !typeofTarget ||
    !switchCase.test ||
    switchCase.test.kind !== "literal" ||
    typeof switchCase.test.value !== "string"
  ) {
    return undefined;
  }

  const receiverExpr = unwrapTransparentExpression(typeofTarget);
  if (
    receiverExpr.kind !== "identifier" &&
    receiverExpr.kind !== "memberAccess"
  ) {
    return undefined;
  }

  const receiverKey =
    receiverExpr.kind === "identifier"
      ? receiverExpr.name
      : getMemberAccessNarrowKey(receiverExpr);
  if (!receiverKey) {
    return undefined;
  }

  const sourceType =
    resolveEffectiveExpressionType(receiverExpr, context) ??
    receiverExpr.inferredType;
  const currentType = currentNarrowedType(receiverKey, sourceType, context);
  if (!currentType) {
    return undefined;
  }

  const frame = resolveRuntimeUnionFrame(receiverKey, currentType, context);
  if (!frame || frame.members.length < 2) {
    return undefined;
  }

  const tag = switchCase.test.value;
  const memberNs = frame.members.flatMap((member, index) =>
    matchesTypeofTag(member, tag, context)
      ? [frame.candidateMemberNs[index] ?? index + 1]
      : []
  );
  if (memberNs.length === 0) {
    return undefined;
  }

  return {
    receiverExpr,
    receiverKey,
    memberNs,
    runtimeUnionArity: frame.runtimeUnionArity,
    candidateMemberNs: frame.candidateMemberNs,
    candidateMembers: frame.members,
    sourceType,
  };
};

const getSwitchCaseNarrowing = (
  switchExpression: IrExpression,
  switchCase: Extract<
    IrStatement,
    { kind: "switchStatement" }
  >["cases"][number],
  context: EmitterContext
): SwitchCaseNarrowing | undefined => {
  if (!switchCase.test) {
    return undefined;
  }

  const guard = tryResolveDiscriminantEqualityGuard(
    {
      kind: "binary",
      operator: "===",
      left: switchExpression,
      right: switchCase.test,
      inferredType: { kind: "primitiveType", name: "boolean" },
    },
    context
  );
  if (!guard) {
    return undefined;
  }

  const receiverKey =
    guard.receiverExpr.kind === "identifier"
      ? guard.receiverExpr.name
      : getMemberAccessNarrowKey(guard.receiverExpr);
  if (!receiverKey) {
    return undefined;
  }

  return {
    receiverExpr: guard.receiverExpr,
    receiverKey,
    memberNs: [guard.memberN],
    runtimeUnionArity: guard.runtimeUnionArity,
    candidateMemberNs: guard.candidateMemberNs,
    candidateMembers: guard.candidateMembers,
    sourceType:
      resolveEffectiveExpressionType(guard.receiverExpr, context) ??
      guard.receiverExpr.inferredType,
  };
};

const withSwitchSectionNarrowing = (
  context: EmitterContext,
  narrowings: readonly SwitchCaseNarrowing[]
): EmitterContext => {
  if (narrowings.length === 0) {
    return context;
  }

  const [first] = narrowings;
  if (
    !first ||
    narrowings.some((narrowing) => narrowing.receiverKey !== first.receiverKey)
  ) {
    return context;
  }

  const selectedMemberNs = [
    ...new Set(narrowings.flatMap((narrowing) => narrowing.memberNs)),
  ];
  const [receiverAst, receiverContext] = emitExpressionAst(
    first.receiverExpr,
    context
  );
  const narrowedBindings = new Map(receiverContext.narrowedBindings ?? []);

  if (selectedMemberNs.length === 1) {
    const selectedMemberN = selectedMemberNs[0];
    const selectedIndex = first.candidateMemberNs.findIndex(
      (candidateMemberN) => candidateMemberN === selectedMemberN
    );
    const selectedMember =
      selectedIndex >= 0 ? first.candidateMembers[selectedIndex] : undefined;
    if (selectedMemberN !== undefined && selectedMember) {
      narrowedBindings.set(
        first.receiverKey,
        buildExprBinding(
          buildUnionNarrowAst(receiverAst, selectedMemberN),
          selectedMember,
          first.sourceType,
          undefined,
          undefined,
          receiverAst
        )
      );
      return { ...receiverContext, narrowedBindings };
    }
  }

  const selectedMembers = selectedMemberNs.flatMap((selectedMemberN) => {
    const selectedIndex = first.candidateMemberNs.findIndex(
      (candidateMemberN) => candidateMemberN === selectedMemberN
    );
    const selectedMember =
      selectedIndex >= 0 ? first.candidateMembers[selectedIndex] : undefined;
    return selectedMember ? [selectedMember] : [];
  });
  if (selectedMembers.length === selectedMemberNs.length) {
    const runtimeSubsetBinding: NarrowedBinding = {
      kind: "runtimeSubset",
      runtimeMemberNs: selectedMemberNs,
      runtimeUnionArity: first.runtimeUnionArity,
      storageExprAst: receiverAst,
      sourceMembers: [...first.candidateMembers],
      sourceCandidateMemberNs: [...first.candidateMemberNs],
      type: buildSubsetUnionType(selectedMembers),
      sourceType: first.sourceType,
    };
    narrowedBindings.set(first.receiverKey, runtimeSubsetBinding);
    return { ...receiverContext, narrowedBindings };
  }

  return receiverContext;
};

/**
 * Emit a switch statement as AST
 */
export const emitSwitchStatementAst = (
  stmt: Extract<IrStatement, { kind: "switchStatement" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  const [exprAst, exprContext] = emitExpressionAst(stmt.expression, context);

  let currentContext = exprContext;
  const sections: CSharpSwitchSectionAst[] = [];
  let pendingLabels: CSharpSwitchLabelAst[] = [];
  let pendingNarrowings: SwitchCaseNarrowing[] = [];

  for (const switchCase of stmt.cases) {
    // Build label for this case
    const label: CSharpSwitchLabelAst = switchCase.test
      ? (() => {
          const [testAst, testContext] = emitExpressionAst(
            switchCase.test,
            currentContext
          );
          currentContext = testContext;
          return { kind: "caseSwitchLabel" as const, value: testAst };
        })()
      : { kind: "defaultSwitchLabel" as const };

    pendingLabels = [...pendingLabels, label];
    const caseNarrowing =
      getSwitchCaseNarrowing(stmt.expression, switchCase, currentContext) ??
      getTypeofSwitchCaseNarrowing(stmt.expression, switchCase, currentContext);
    if (caseNarrowing) {
      pendingNarrowings = [...pendingNarrowings, caseNarrowing];
    }

    // Empty bodies represent intentional fall-through labels (TypeScript semantics).
    if (switchCase.statements.length === 0) {
      continue;
    }

    // Emit body statements
    const bodyStatements: CSharpStatementAst[] = [];
    const preSectionContext = currentContext;
    let sectionContext = withSwitchSectionNarrowing(
      currentContext,
      pendingNarrowings
    );
    for (const s of switchCase.statements) {
      const [stmts, newContext] = emitStatementAst(s, sectionContext);
      bodyStatements.push(...stmts);
      sectionContext = newContext;
    }
    currentContext = {
      ...sectionContext,
      narrowedBindings: preSectionContext.narrowedBindings,
    };

    // Emit break only when case has non-empty body that doesn't terminate.
    const lastStmt = switchCase.statements[switchCase.statements.length - 1];
    const terminates =
      lastStmt?.kind === "breakStatement" ||
      lastStmt?.kind === "returnStatement" ||
      lastStmt?.kind === "throwStatement";
    if (!terminates) {
      bodyStatements.push({ kind: "breakStatement" });
    }

    sections.push({ labels: pendingLabels, statements: bodyStatements });
    pendingLabels = [];
    pendingNarrowings = [];
  }

  // Flush any trailing fall-through labels (edge case: empty default at end)
  if (pendingLabels.length > 0) {
    sections.push({
      labels: pendingLabels,
      statements: [{ kind: "breakStatement" }],
    });
  }

  if (isExhaustiveLiteralSwitch(stmt, currentContext)) {
    sections.push({
      labels: [{ kind: "defaultSwitchLabel" }],
      statements: [
        {
          kind: "throwStatement",
          expression: exhaustiveSwitchFailureExpression(),
        },
      ],
    });
  }

  const switchStmt: CSharpStatementAst = {
    kind: "switchStatement",
    expression: exprAst,
    sections,
  };

  return [[switchStmt], currentContext];
};
