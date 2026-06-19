export { CommandLine } from "./internal/execute/tsc.js";
export type { CommandLineResult, CommandLineTesting, ExitStatus, System } from "./internal/execute/tsc/compile.js";
export { NewCachedFSCompilerHost, NewCompilerHost } from "./internal/compiler/host.js";
export type { CompilerHost } from "./internal/compiler/host.js";
export {
  NewProgram,
  Program_BindSourceFiles,
  Program_GetProgramDiagnostics,
  Program_GetSemanticDiagnostics,
  Program_GetSourceFiles,
  Program_GetSyntacticDiagnostics,
} from "./internal/compiler/program.js";
export type { Program, ProgramLike, ProgramOptions } from "./internal/compiler/program.js";
export { Background } from "./go/context.js";
export { ExtensionConsumerQueries, ExtensionDecisionQuestion, ExtensionDiagnosticStore, ExtensionFactResolver, ExtensionFactStore, ExtensionHost, ExtensionHostDiagnosticCode, ExtensionLifecycleEvent, ProviderRegistry, TstsProviderContractVersion, acceptDecision, argumentPassingFactKey, associatedTypeFactKey, attachExtensionHost, canonicalIdentityFactKey, contextualTargetTypeFactKey, constGenericFactKey, createExtensionConsumerQueries, createSourceSemanticsExtension, defineExtensionFactKey, deferDecision, finalizeExtensionSemantics, flowStateFactKey, functionPointerFactKey, getExtensionHost, hasExtensionHost, instantiatedTargetTypeFactKey, pointerFactKey, providerVirtualDeclarationFactKey, rejectDecision, runtimeCarrierFactKey, selectedTargetSignatureFactKey, sourcePrimitive, sourcePrimitiveFactKey, targetBindingFactKey, targetOperationFactKey } from "./extensions/index.js";
export type { ArgumentPassingFact, ArgumentPassingMode, AssignabilityRequest, AssociatedTypeFact, AttributeFact, BeforeSemanticsFinalizedLifecycleRequest, CompilerExtension, CompilerExtensionKind, CompilerExtensionIdentity, ConstGenericFact, ContextualTargetTypeFact, ContextualTypeRequest, ContextualTypeResult, ExtendedProgram, ExtensionCanonicalIdentity, ExtensionCanonicalIdentityKind, ExtensionCapabilitySpec, ExtensionCompositionSpec, ExtensionDecision, ExtensionDecisionContext, ExtensionDecisionHook, ExtensionDecisionMap, ExtensionDecisionQuestionName, ExtensionDecisionRequest, ExtensionDecisionResponse, ExtensionDecisionResult, ExtensionDecisionRunOptions, ExtensionDependencySpec, ExtensionDiagnostic, ExtensionDiagnosticCategory, ExtensionDiagnosticRange, ExtensionEvidence, ExtensionFactEntry, ExtensionFactKey, ExtensionFactKeyOptions, ExtensionFactResolution, ExtensionFactResolverCallback, ExtensionFactResolverContext, ExtensionFactSubject, ExtensionFactWriteResult, ExtensionHostOptions, ExtensionImportKind, ExtensionInitializeContext, ExtensionLifecycleContext, ExtensionLifecycleHook, FieldFact, FlowStateFact, FunctionPointerFact, InferTypeArgumentsRequest, InferTypeArgumentsResult, InstantiatedTargetTypeFact, ParameterModeRequest, ParameterModeResult, PointerFact, ProviderDeclarationKind, ProviderDeclarationModel, ProviderExportDeclaration, ProviderIdentity, ProviderMemberDeclaration, ProviderModuleContext, ProviderModuleResolution, ProviderModuleResolveResult, ProviderOwnership, ProviderParameterDeclaration, ProviderResolvedModule, ProviderSignatureDeclaration, ProviderSymbolIdentity, ProviderTypeExpression, ProviderTypeParameterDeclaration, ProviderVirtualDeclarationFact, ResolveCallRequest, ResolveCallResult, ResolveConversionRequest, ResolveConversionResult, ResolveElementAccessRequest, ResolveOperationResult, ResolveOperatorRequest, ResolvePropertyAccessRequest, RuntimeCarrierFact, RuntimeCarrierRequest, RuntimeCarrierResult, SatisfiesConstraintRequest, SelectedTargetSignatureFact, SourceCallMarkerDeclaration, SourceSemanticsExportDeclaration, SourceSemanticsExtensionOptions, SourceSemanticsModule, SourceSemanticsModuleIdentity, SourceFileBoundLifecycleRequest, SourcePointerMutability, SourcePrimitiveDeclaration, SourcePrimitiveFact, SourcePrimitiveKind, SourceTypeMarkerDeclaration, StructFact, TargetBindingFact, TargetBindingProvider, TargetConstraint, TargetIdentity, TargetMember, TargetOperationFact, TargetParameter, TargetSemanticProvider, TargetTypeParameter, TargetTypeRef, ValidateFlowUseRequest, ValidateFlowUseResult } from "./extensions/index.js";
export { ParseBuildCommandLine, ParseCommandLine } from "./internal/tsoptions/commandlineparser.js";
export type { ParsedBuildCommandLine } from "./internal/tsoptions/parsedbuildcommandline.js";
export type { ParsedCommandLine } from "./internal/tsoptions/parsedcommandline.js";
export { barebonesLibContent, formatDiagnostics, transpile, transpileDeclaration, transpileModule } from "./services/transpile.js";
export type { TranspileCompilerOptions, TranspileCompilerOptionValue, TranspileOptions, TranspileOutput } from "./services/transpile.js";
export { createTypeCheckerQueries } from "./services/type-checker.js";
export type { TypeCheckerQueries, TypeCheckerQueryOptions } from "./services/type-checker.js";
export type { Node, SourceFile } from "./internal/ast/ast.js";
export type { Symbol } from "./internal/ast/symbol.js";
export type { ContextFlags, Signature, Type } from "./internal/checker/types.js";
