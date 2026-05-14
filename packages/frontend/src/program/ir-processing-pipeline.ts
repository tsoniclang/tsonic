import {
  assumeEmittableIrModules,
  type EmittableIrModule,
  type IrModule,
  type IrStatement,
} from "../ir/types.js";
import { validateIrSoundness } from "../ir/validation/soundness-gate.js";
import { runNumericProofPass } from "../ir/validation/numeric-proof-pass.js";
import { runCallResolutionRefreshPass } from "../ir/validation/call-resolution-refresh-pass.js";
import { runArrowReturnFinalizationPass } from "../ir/validation/arrow-return-finalization-pass.js";
import { runNumericCoercionPass } from "../ir/validation/numeric-coercion-pass.js";
import { runCharValidationPass } from "../ir/validation/char-validation-pass.js";
import { runYieldLoweringPass } from "../ir/validation/yield-lowering-pass.js";
import { runOverloadCollectionPass } from "../ir/validation/overload-collection-pass.js";
import { runOverloadFamilyConsistencyPass } from "../ir/validation/overload-family-consistency-pass.js";
import { runAttributeCollectionPass } from "../ir/validation/attribute-collection-pass.js";
import { runAnonymousTypeLoweringPass } from "../ir/validation/anonymous-type-lowering-pass.js";
import { runRestTypeSynthesisPass } from "../ir/validation/rest-type-synthesis-pass.js";
import { runVirtualMarkingPass } from "../ir/validation/virtual-marking-pass.js";
import { createProgramContext } from "../ir/program-context.js";
import type { TsonicProgram } from "./types.js";
import type { Diagnostic } from "../types/diagnostic.js";
import { error, ok, type Result } from "../types/result.js";

export type IrProcessingPipelineOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly backendCapabilities?: TsonicProgram["options"]["backendCapabilities"];
};

export type IrProcessingPipelineResult = {
  readonly modules: readonly EmittableIrModule[];
};

export const collectSynthesizedTypeNames = (
  modules: readonly IrModule[]
): ReadonlySet<string> => {
  const names = new Set<string>();

  const isTypeDecl = (
    stmt: IrStatement
  ): stmt is Extract<
    IrStatement,
    {
      kind:
        | "classDeclaration"
        | "interfaceDeclaration"
        | "typeAliasDeclaration"
        | "enumDeclaration";
    }
  > =>
    stmt.kind === "classDeclaration" ||
    stmt.kind === "interfaceDeclaration" ||
    stmt.kind === "typeAliasDeclaration" ||
    stmt.kind === "enumDeclaration";

  for (const module of modules) {
    for (const stmt of module.body) {
      if (!isTypeDecl(stmt)) continue;
      if (stmt.name.startsWith("__Anon_") || stmt.name.startsWith("__Rest_")) {
        names.add(stmt.name);
      }
    }
  }

  return names;
};

const knownReferenceTypesFor = (
  program: TsonicProgram,
  modules: readonly IrModule[]
): ReadonlySet<string> =>
  new Set([
    ...program.bindings.getEmitterTypeMap().keys(),
    ...collectSynthesizedTypeNames(modules),
  ]);

export const runIrProcessingPipeline = (
  modules: readonly IrModule[],
  program: TsonicProgram,
  options: IrProcessingPipelineOptions
): Result<IrProcessingPipelineResult, readonly Diagnostic[]> => {
  const restResult = runRestTypeSynthesisPass(modules);
  const loweredModules = runAnonymousTypeLoweringPass(
    restResult.modules
  ).modules;

  const overloadResult = runOverloadCollectionPass(loweredModules);
  if (!overloadResult.ok) {
    return error(overloadResult.diagnostics);
  }

  const overloadConsistencyResult = runOverloadFamilyConsistencyPass(
    overloadResult.modules
  );
  if (!overloadConsistencyResult.ok) {
    return error(overloadConsistencyResult.diagnostics);
  }

  const attributeResult = runAttributeCollectionPass(
    overloadConsistencyResult.modules
  );
  if (!attributeResult.ok) {
    return error(attributeResult.diagnostics);
  }

  const soundnessResult = validateIrSoundness(attributeResult.modules, {
    knownReferenceTypes: knownReferenceTypesFor(
      program,
      attributeResult.modules
    ),
    backendCapabilities: options.backendCapabilities,
  });
  if (!soundnessResult.ok) {
    return error(soundnessResult.diagnostics);
  }

  const numericResult = runNumericProofPass(attributeResult.modules);
  if (!numericResult.ok) {
    return error(numericResult.diagnostics);
  }

  const refreshContext = createProgramContext(program, {
    sourceRoot: options.sourceRoot,
    rootNamespace: options.rootNamespace,
  });
  const refreshedCallResolutionResult = runCallResolutionRefreshPass(
    numericResult.modules,
    refreshContext
  );
  const reloweredAfterRefreshResult = runAnonymousTypeLoweringPass(
    refreshedCallResolutionResult.modules
  );

  const arrowResult = runArrowReturnFinalizationPass(
    reloweredAfterRefreshResult.modules
  );

  const coercionResult = runNumericCoercionPass(arrowResult.modules);
  if (!coercionResult.ok) {
    return error(coercionResult.diagnostics);
  }

  const charResult = runCharValidationPass(coercionResult.modules);
  if (!charResult.ok) {
    return error(charResult.diagnostics);
  }

  const yieldResult = runYieldLoweringPass(charResult.modules);
  if (!yieldResult.ok) {
    return error(yieldResult.diagnostics);
  }

  const virtualResult = runVirtualMarkingPass(yieldResult.modules);

  const finalSoundnessResult = validateIrSoundness(virtualResult.modules, {
    knownReferenceTypes: knownReferenceTypesFor(program, virtualResult.modules),
    backendCapabilities: options.backendCapabilities,
  });
  if (!finalSoundnessResult.ok) {
    return error(finalSoundnessResult.diagnostics);
  }

  return ok({
    modules: assumeEmittableIrModules(virtualResult.modules),
  });
};
