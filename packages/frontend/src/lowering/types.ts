import type {
  ExtensionExportBinding,
  ExtensionFacts,
  ExtensionModuleGraph,
  ExtensionModuleImport,
  ExtensionSourceModule,
  ExtensionTypeChecker,
  TstsNode,
  TstsSignature,
  TstsSourceFile,
  TstsSymbol,
  TstsType,
} from "@tsonic/tsts";
import type { BackendCapabilityManifest } from "../capabilities/backend-capabilities.js";
import type { TstsSourceProgram } from "../source-frontend/index.js";
import type { Diagnostic } from "../types/diagnostic.js";

export type BackendTargetId = string;

export type LoweringFeature =
  | "module"
  | "declaration"
  | "type"
  | "statement"
  | "expression"
  | "call"
  | "member-access"
  | "index-access"
  | "narrowing"
  | "synthetic-declaration"
  | "capability";

export type LoweringInput = {
  readonly sourceProgram: TstsSourceProgram;
  readonly moduleGraph: ExtensionModuleGraph;
  readonly facts: ExtensionFacts;
  readonly capabilities?: BackendCapabilityManifest;
};

export type LoweringModuleIdentity = {
  readonly filePath: string;
  readonly namespace: string;
  readonly className: string;
};

export type LoweringPlanBase<TKind extends string> = {
  readonly kind: TKind;
  readonly sourceFile: TstsSourceFile;
  readonly sourceNode: TstsNode;
  readonly sourceKind: number;
  readonly sourceKindName: string;
  readonly sourceText: string;
  readonly name?: string;
};

export type LoweringTypePlan = LoweringPlanBase<"type"> & {
  readonly sourceType: TstsType;
  readonly sourceSymbol?: TstsSymbol;
};

export type LoweringParameterPlan = {
  readonly name: string;
  readonly typeText?: string;
  readonly initializerText?: string;
  readonly optional: boolean;
};

export type LoweringDeclarationPlan = LoweringPlanBase<"declaration"> & {
  readonly declarationKind:
    | "class"
    | "enum"
    | "function"
    | "interface"
    | "type-alias"
    | "variable"
    | "unknown";
  readonly symbol?: TstsSymbol;
  readonly declaredType?: TstsType;
  readonly parameters: readonly LoweringParameterPlan[];
  readonly returnTypeText?: string;
  readonly bodyText?: string;
  readonly initializerText?: string;
  readonly exported: boolean;
  readonly async: boolean;
};

export type LoweringStatementPlan = LoweringPlanBase<"statement">;

export type LoweringExpressionPlan = LoweringPlanBase<"expression"> & {
  readonly useSiteType?: TstsType;
  readonly contextualType?: TstsType;
  readonly symbol?: TstsSymbol;
};

export type LoweringCallPlan = LoweringPlanBase<"call"> & {
  readonly signature?: TstsSignature;
  readonly returnType?: TstsType;
};

export type LoweringMemberAccessPlan = LoweringPlanBase<"member-access"> & {
  readonly receiverType?: TstsType;
  readonly memberSymbol?: TstsSymbol;
  readonly memberType?: TstsType;
};

export type LoweringIndexAccessPlan = LoweringPlanBase<"index-access"> & {
  readonly receiverType?: TstsType;
  readonly indexType?: TstsType;
  readonly resultType?: TstsType;
};

export type LoweringNarrowingPlan = LoweringPlanBase<"narrowing"> & {
  readonly useSiteType?: TstsType;
};

export type LoweringSyntheticDeclarationPlan =
  LoweringPlanBase<"synthetic-declaration"> & {
    readonly stableId: string;
    readonly sourceFeature: LoweringFeature;
  };

export type LoweringModulePlan<Target extends BackendTargetId = BackendTargetId> =
  {
    readonly kind: "lowering-module";
    readonly backendTargetId?: Target;
    readonly identity: LoweringModuleIdentity;
    readonly sourceFile: TstsSourceFile;
    readonly sourceModule: ExtensionSourceModule;
    readonly imports: readonly ExtensionModuleImport[];
    readonly exports: readonly ExtensionExportBinding[];
    readonly declarations: readonly LoweringDeclarationPlan[];
    readonly topLevelStatements: readonly LoweringStatementPlan[];
    readonly types: readonly LoweringTypePlan[];
    readonly statements: readonly LoweringStatementPlan[];
    readonly expressions: readonly LoweringExpressionPlan[];
    readonly calls: readonly LoweringCallPlan[];
    readonly members: readonly LoweringMemberAccessPlan[];
    readonly indexes: readonly LoweringIndexAccessPlan[];
    readonly narrowings: readonly LoweringNarrowingPlan[];
    readonly syntheticDeclarations: readonly LoweringSyntheticDeclarationPlan[];
  };

export type LoweringPipelineOptions<
  Target extends BackendTargetId = BackendTargetId,
> = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
  readonly backendCapabilities?: BackendCapabilityManifest;
  readonly backendTargetId?: Target;
};

export type LoweringPipelineResult<
  Target extends BackendTargetId = BackendTargetId,
> = {
  readonly input: LoweringInput;
  readonly modules: readonly LoweringModulePlan<Target>[];
};

export type LoweringBuildContext = {
  readonly input: LoweringInput;
  readonly checkerForSourceFile: (
    sourceFile: TstsSourceFile
  ) => ExtensionTypeChecker;
  readonly diagnostics: readonly Diagnostic[];
};
