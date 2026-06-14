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
import type { IntrinsicSemanticsFact } from "../source-frontend/source-facts.js";
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
  readonly nameSourceKindName?: string;
  readonly nameSourceText?: string;
  readonly nameIsComputed: boolean;
};

export type LoweringTypePlan = LoweringPlanBase<"type"> & {
  readonly sourceType: TstsType;
  readonly sourceSymbol?: TstsSymbol;
};

export type LoweringParameterPlan = {
  readonly name: string;
  readonly typeText?: string;
  readonly initializer?: LoweringExpressionPlan;
  readonly optional: boolean;
  readonly rest: boolean;
};

export type LoweringVariablePlan = {
  readonly name: string;
  readonly typeText?: string;
  readonly initializer?: LoweringExpressionPlan;
  readonly bindingElements: readonly LoweringBindingElementPlan[];
};

export type LoweringBindingAccessPlan =
  | {
      readonly kind: "element";
      readonly index: number;
    }
  | {
      readonly kind: "property";
      readonly name: string;
    };

export type LoweringBindingElementPlan = {
  readonly name: string;
  readonly accessPath: readonly LoweringBindingAccessPlan[];
  readonly initializer?: LoweringExpressionPlan;
};

export type LoweringEnumMemberPlan = {
  readonly name: string;
  readonly initializer?: LoweringExpressionPlan;
};

export type LoweringDeclarationPlan = LoweringPlanBase<"declaration"> & {
  readonly declarationKind:
    | "class"
    | "enum"
    | "function"
    | "interface"
    | "method"
    | "constructor"
    | "property"
    | "type-alias"
    | "variable"
    | "unknown";
  readonly symbol?: TstsSymbol;
  readonly declaredType?: TstsType;
  readonly declaredTypeText?: string;
  readonly parameters: readonly LoweringParameterPlan[];
  readonly typeParameters: readonly string[];
  readonly returnTypeText?: string;
  readonly body?: LoweringStatementPlan;
  readonly initializer?: LoweringExpressionPlan;
  readonly members: readonly LoweringDeclarationPlan[];
  readonly enumMembers: readonly LoweringEnumMemberPlan[];
  readonly exported: boolean;
  readonly async: boolean;
  readonly static: boolean;
};

export type LoweringExpressionPlan = LoweringPlanBase<"expression"> & {
  readonly expressionKind:
    | "identifier"
    | "literal"
    | "this"
    | "super"
    | "binary"
    | "prefix-unary"
    | "postfix-unary"
    | "typeof"
    | "void"
    | "property-access"
    | "element-access"
    | "call"
    | "new"
    | "arrow-function"
    | "function-expression"
    | "array-literal"
    | "object-literal"
    | "conditional"
    | "template"
    | "parenthesized"
    | "await"
    | "yield"
    | "spread"
    | "erased-wrapper"
    | "unsupported";
  readonly typeText?: string;
  readonly contextualTypeText?: string;
  readonly intrinsicKind?: IntrinsicSemanticsFact["kind"];
  readonly literalKind?: "string" | "number" | "bigint" | "boolean" | "null" | "undefined";
  readonly literalText?: string;
  readonly returnTypeText?: string;
  readonly operatorText?: string;
  readonly expression?: LoweringExpressionPlan;
  readonly left?: LoweringExpressionPlan;
  readonly right?: LoweringExpressionPlan;
  readonly condition?: LoweringExpressionPlan;
  readonly whenTrue?: LoweringExpressionPlan;
  readonly whenFalse?: LoweringExpressionPlan;
  readonly arguments: readonly LoweringExpressionPlan[];
  readonly typeArguments: readonly string[];
  readonly elements: readonly LoweringExpressionPlan[];
  readonly properties: readonly LoweringObjectPropertyPlan[];
  readonly templateParts: readonly LoweringTemplatePartPlan[];
  readonly parameters: readonly LoweringParameterPlan[];
  readonly body?: LoweringStatementPlan;
  readonly async?: boolean;
  readonly useSiteType?: TstsType;
  readonly contextualType?: TstsType;
  readonly symbol?: TstsSymbol;
};

export type LoweringObjectPropertyPlan = {
  readonly name?: string;
  readonly sourceKindName: string;
  readonly sourceText: string;
  readonly computed: boolean;
  readonly expression: LoweringExpressionPlan;
};

export type LoweringTemplatePartPlan = {
  readonly text: string;
  readonly expression?: LoweringExpressionPlan;
};

export type LoweringStatementPlan = LoweringPlanBase<"statement"> & {
  readonly statementKind:
    | "block"
    | "return"
    | "expression"
    | "variable"
    | "if"
    | "while"
    | "for"
    | "for-of"
    | "for-in"
    | "break"
    | "continue"
    | "switch"
    | "try"
    | "throw"
    | "empty"
    | "declaration"
    | "unsupported";
  readonly expression?: LoweringExpressionPlan;
  readonly condition?: LoweringExpressionPlan;
  readonly incrementor?: LoweringExpressionPlan;
  readonly iterable?: LoweringExpressionPlan;
  readonly thenStatement?: LoweringStatementPlan;
  readonly elseStatement?: LoweringStatementPlan;
  readonly body?: LoweringStatementPlan;
  readonly tryBlock?: LoweringStatementPlan;
  readonly catchVariable?: LoweringVariablePlan;
  readonly catchBlock?: LoweringStatementPlan;
  readonly finallyBlock?: LoweringStatementPlan;
  readonly cases: readonly LoweringSwitchCasePlan[];
  readonly statements: readonly LoweringStatementPlan[];
  readonly declarations: readonly LoweringVariablePlan[];
};

export type LoweringSwitchCasePlan = {
  readonly expression?: LoweringExpressionPlan;
  readonly statements: readonly LoweringStatementPlan[];
  readonly isDefault: boolean;
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
