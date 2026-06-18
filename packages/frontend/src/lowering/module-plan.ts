import type { TstsSourceFile } from "@tsonic/tsts";
import { resolveSourceFileIdentity } from "../program/source-file-identity.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import type {
  BackendTargetId,
  LoweringBuildContext,
  LoweringModulePlan,
  LoweringPipelineOptions,
} from "./types.js";
import { buildLoweringPlansForSourceFile } from "./plan-builders.js";
import { sourceFileStatements } from "./tsts-node-classification.js";

export type CreateLoweringModulePlanResult<
  Target extends BackendTargetId = BackendTargetId,
> =
  | { readonly ok: true; readonly plan: LoweringModulePlan<Target> }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

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
      declarations,
      topLevelStatements,
      statements: plans.statements,
      expressions: plans.expressions,
    },
  };
};
