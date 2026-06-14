import type { TstsSourceFile } from "@tsonic/tsts";
import { resolveSourceFileIdentity } from "../program/source-file-identity.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import type {
  BackendTargetId,
  LoweringBuildContext,
  LoweringDeclarationPlan,
  LoweringExpressionAliasPlan,
  LoweringModulePlan,
  LoweringPipelineOptions,
  LoweringVariablePlan,
} from "./types.js";
import { buildLoweringPlansForSourceFile } from "./plan-builders.js";
import { sourceFileStatements } from "./tsts-node-classification.js";

export type CreateLoweringModulePlanResult<
  Target extends BackendTargetId = BackendTargetId,
> =
  | { readonly ok: true; readonly plan: LoweringModulePlan<Target> }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

const variableInitializerIdentifier = (
  declaration: LoweringDeclarationPlan
): string | undefined =>
  declaration.declarationKind === "variable" &&
  declaration.initializer?.expressionKind === "identifier"
    ? declaration.initializer.literalText ?? declaration.initializer.name
    : undefined;

const variablePlanInitializerIdentifier = (
  declaration: LoweringVariablePlan
): string | undefined =>
  declaration.initializer?.expressionKind === "identifier"
    ? declaration.initializer.literalText ?? declaration.initializer.name
    : undefined;

const buildExpressionAliases = (
  declarations: readonly LoweringDeclarationPlan[],
  topLevelStatements: readonly LoweringModulePlan["topLevelStatements"][number][]
): readonly LoweringExpressionAliasPlan[] => {
  const topLevelVariables = topLevelStatements.flatMap(
    (statement) => statement.declarations
  );
  const genericFunctions = new Set(
    declarations
      .filter(
        (declaration) =>
          declaration.declarationKind === "function" &&
          declaration.name !== undefined &&
          declaration.typeParameters.length > 0
      )
      .map((declaration) => declaration.name)
  );
  const aliases = new Map<string, string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (declaration.declarationKind !== "variable" || !declaration.name) {
        continue;
      }
      if (aliases.has(declaration.name)) continue;
      const target = variableInitializerIdentifier(declaration);
      if (!target) continue;
      const resolvedTarget = aliases.get(target) ?? target;
      if (!genericFunctions.has(resolvedTarget)) continue;
      aliases.set(declaration.name, resolvedTarget);
      changed = true;
    }
    for (const declaration of topLevelVariables) {
      if (aliases.has(declaration.name)) continue;
      const target = variablePlanInitializerIdentifier(declaration);
      if (!target) continue;
      const resolvedTarget = aliases.get(target) ?? target;
      if (!genericFunctions.has(resolvedTarget)) continue;
      aliases.set(declaration.name, resolvedTarget);
      changed = true;
    }
  }
  return [...aliases].map(([aliasName, targetName]) => ({
    aliasName,
    targetName,
  }));
};

export const createLoweringModulePlan = <
  Target extends BackendTargetId = BackendTargetId,
>(
  sourceFile: TstsSourceFile,
  context: LoweringBuildContext,
  options: LoweringPipelineOptions<Target>
): CreateLoweringModulePlanResult<Target> => {
  const { input } = context;
  const sourceModule = input.moduleGraph.getSourceFileModule(sourceFile);
  if (!sourceModule) {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "TSN6001",
        "error",
        "TSTS module graph did not expose a source module for lowering.",
        { file: "<unknown>", line: 1, column: 1, length: 1 }
      ),
    };
  }

  const identity = resolveSourceFileIdentity(
    sourceModule.fileName,
    options.sourceRoot,
    options.rootNamespace
  );
  const plans = buildLoweringPlansForSourceFile(sourceFile, context);
  const topLevelNodes = new Set(sourceFileStatements(sourceFile));
  const declarations = plans.declarations.filter((declaration) =>
    topLevelNodes.has(declaration.sourceNode)
  );
  const topLevelStatements = plans.statements.filter((statement) =>
    topLevelNodes.has(statement.sourceNode)
  );

  return {
    ok: true,
    plan: {
      kind: "lowering-module",
      backendTargetId: options.backendTargetId,
      identity,
      sourceFile,
      sourceModule,
      imports: input.moduleGraph.getImports(sourceFile),
      exports: input.moduleGraph.getExports(sourceFile),
      expressionAliases: buildExpressionAliases(declarations, topLevelStatements),
      declarations,
      topLevelStatements,
      types: plans.types,
      statements: plans.statements,
      expressions: plans.expressions,
      calls: plans.calls,
      members: plans.members,
      indexes: plans.indexes,
      narrowings: plans.narrowings,
      syntheticDeclarations: plans.syntheticDeclarations,
    },
  };
};
