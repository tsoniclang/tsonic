import type { TstsSourceFile } from "@tsonic/tsts";
import { resolveSourceFileIdentity } from "../program/source-file-identity.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import type {
  BackendTargetId,
  LoweringInput,
  LoweringModulePlan,
  LoweringPipelineOptions,
} from "./types.js";

export type CreateLoweringModulePlanResult<
  Target extends BackendTargetId = BackendTargetId,
> =
  | { readonly ok: true; readonly plan: LoweringModulePlan<Target> }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

export const createLoweringModulePlan = <
  Target extends BackendTargetId = BackendTargetId,
>(
  sourceFile: TstsSourceFile,
  input: LoweringInput,
  options: LoweringPipelineOptions<Target>
): CreateLoweringModulePlanResult<Target> => {
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
      declarations: [],
      types: [],
      statements: [],
      expressions: [],
      calls: [],
      members: [],
      indexes: [],
      narrowings: [],
      syntheticDeclarations: [],
    },
  };
};
