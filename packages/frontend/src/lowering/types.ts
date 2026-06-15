import type {
  ExtensionExportBinding,
  ExtensionFacts,
  ExtensionModuleGraph,
  ExtensionModuleImport,
  ExtensionSourceModule,
  TstsNode,
  TstsSourceFile,
} from "@tsonic/tsts";
import type { BackendCapabilityManifest } from "../capabilities/backend-capabilities.js";
import type {
  FieldSemanticsFact,
  IntrinsicSemanticsFact,
  NumericPrimitiveFact,
  ParameterPassingMode,
  SourceAttributeTargetSpecifier,
  SourceTypeSemanticsFact,
  SourceRuntimeOperationFact,
} from "../source-frontend/source-facts.js";
import type { TstsSourceProgram } from "../source-frontend/index.js";
import type { Diagnostic } from "../types/diagnostic.js";

export type BackendTargetId = string;

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
  readonly computedName?:
    | "symbol-iterator"
    | "symbol-async-iterator"
    | "symbol-to-string-tag";
};

export type LoweringIntrinsicTypeName =
  | "any"
  | "unknown"
  | "object"
  | "undefined"
  | "null"
  | "void"
  | "never"
  | "string"
  | "number"
  | "boolean"
  | "bigint"
  | "symbol"
  | "this";

export type LoweringSourceQualifiedNamePlan = {
  readonly namespace?: string;
  readonly container?: string;
  readonly name: string;
};

export type LoweringExternalBindingReferencePlan = {
  readonly bindingFile: string;
  readonly sourceName: string;
};

export type LoweringRuntimeVisibility = "opaque";

export type LoweringTypeDeclarationBinding = {
  readonly sourceFile: TstsSourceFile;
  readonly sourceNode: TstsNode;
};

export type LoweringTypeMemberPlan =
  | {
      readonly kind: "property";
      readonly name: string;
      readonly optional: boolean;
      readonly type?: LoweringTypeRefPlan;
    }
  | {
      readonly kind: "method";
      readonly name: string;
      readonly optional: boolean;
      readonly parameters: readonly LoweringParameterPlan[];
      readonly returnType?: LoweringTypeRefPlan;
      readonly typeParameters: readonly string[];
    }
  | {
      readonly kind: "index-signature";
      readonly keyType?: LoweringTypeRefPlan;
      readonly valueType?: LoweringTypeRefPlan;
    };

export type LoweringTypeRefPlan =
  | {
      readonly kind: "intrinsic";
      readonly name: LoweringIntrinsicTypeName;
      readonly sourceText?: string;
    }
  | {
      readonly kind: "source-primitive";
      readonly fact: NumericPrimitiveFact;
      readonly sourceText?: string;
    }
  | {
      readonly kind: "named";
      readonly name: string;
      readonly typeArguments: readonly LoweringTypeRefPlan[];
      readonly aliasTarget?: LoweringTypeRefPlan;
      readonly sourceQualifiedName?: LoweringSourceQualifiedNamePlan;
      readonly externalBinding?: LoweringExternalBindingReferencePlan;
      readonly runtimeVisibility?: LoweringRuntimeVisibility;
      readonly declaration?: LoweringTypeDeclarationBinding;
      readonly declarationKind?:
        | "class"
        | "enum"
        | "interface"
        | "type-alias"
        | "type-parameter";
      readonly sourceText?: string;
    }
  | {
      readonly kind: "array";
      readonly elementType: LoweringTypeRefPlan;
      readonly readonly: boolean;
      readonly storage?: "native-array";
      readonly sourceText?: string;
    }
  | {
      readonly kind: "record";
      readonly keyType: LoweringTypeRefPlan;
      readonly valueType: LoweringTypeRefPlan;
      readonly sourceText?: string;
    }
  | {
      readonly kind: "tuple";
      readonly elements: readonly LoweringTypeRefPlan[];
      readonly readonly: boolean;
      readonly sourceText?: string;
    }
  | {
      readonly kind: "union";
      readonly types: readonly LoweringTypeRefPlan[];
      readonly sourceText?: string;
    }
  | {
      readonly kind: "intersection";
      readonly types: readonly LoweringTypeRefPlan[];
      readonly sourceText?: string;
    }
  | {
      readonly kind: "function";
      readonly parameters: readonly LoweringParameterPlan[];
      readonly returnType?: LoweringTypeRefPlan;
      readonly typeParameters: readonly string[];
      readonly sourceText?: string;
    }
  | {
      readonly kind: "object";
      readonly members: readonly LoweringTypeMemberPlan[];
      readonly sourceText?: string;
    }
  | {
      readonly kind: "predicate";
      readonly assertedType?: LoweringTypeRefPlan;
      readonly sourceText?: string;
    }
  | {
      readonly kind: "literal";
      readonly literalKind:
        | "string"
        | "number"
        | "bigint"
        | "boolean"
        | "null"
        | "undefined";
      readonly valueText: string;
      readonly sourceText?: string;
    }
  | {
      readonly kind: "unsupported";
      readonly sourceKindName: string;
      readonly sourceText: string;
    };

export type LoweringParameterPlan = {
  readonly name: string;
  readonly sourceKindName: string;
  readonly sourceText: string;
  readonly nameSourceText?: string;
  readonly type?: LoweringTypeRefPlan;
  readonly initializer?: LoweringExpressionPlan;
  readonly optional: boolean;
  readonly rest: boolean;
  readonly extensionReceiver?: boolean;
};

export type LoweringVariablePlan = {
  readonly sourceNode: TstsNode;
  readonly name: string;
  readonly type?: LoweringTypeRefPlan;
  readonly storageType?: LoweringTypeRefPlan;
  readonly initializer?: LoweringExpressionPlan;
  readonly bindingElements: readonly LoweringBindingElementPlan[];
  readonly compileTimeOnly?: boolean;
  readonly initializerReferencesDeclaration?: boolean;
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
  readonly type?: LoweringTypeRefPlan;
  readonly accessPath: readonly LoweringBindingAccessPlan[];
  readonly initializer?: LoweringExpressionPlan;
};

export type LoweringEnumMemberPlan = {
  readonly name: string;
  readonly sourceKindName: string;
  readonly sourceText: string;
  readonly nameSourceText?: string;
  readonly initializer?: LoweringExpressionPlan;
};

export type LoweringAttributePlan = {
  readonly targetSpecifier: SourceAttributeTargetSpecifier | undefined;
  readonly attributeType: LoweringExpressionPlan;
  readonly arguments: readonly LoweringExpressionPlan[];
};

export type LoweringDeclarationPlan = LoweringPlanBase<"declaration"> & {
  readonly declarationKind:
    | "class"
    | "enum"
    | "function"
    | "call-signature"
    | "construct-signature"
    | "interface"
    | "method"
    | "get-accessor"
    | "set-accessor"
    | "constructor"
    | "index-signature"
    | "property"
    | "type-alias"
    | "variable"
    | "unknown";
  readonly declaredTypePlan?: LoweringTypeRefPlan;
  readonly typeAliasTarget?: LoweringTypeRefPlan;
  readonly heritageTypes: readonly LoweringTypeRefPlan[];
  readonly sourceTypeKind?: SourceTypeSemanticsFact["kind"];
  readonly storageSemantics?: FieldSemanticsFact["storage"];
  readonly attributes: readonly LoweringAttributePlan[];
  readonly constructorAttributes: readonly LoweringAttributePlan[];
  readonly baseConstructorParameters: readonly LoweringParameterPlan[];
  readonly parameters: readonly LoweringParameterPlan[];
  readonly typeParameters: readonly string[];
  readonly returnType?: LoweringTypeRefPlan;
  readonly body?: LoweringStatementPlan;
  readonly initializer?: LoweringExpressionPlan;
  readonly members: readonly LoweringDeclarationPlan[];
  readonly enumMembers: readonly LoweringEnumMemberPlan[];
  readonly compileTimeOnly?: boolean;
  readonly exported: boolean;
  readonly async: boolean;
  readonly static: boolean;
  readonly override: boolean;
  readonly accessibility: "public" | "protected" | "private";
  readonly accessibilityExplicit: boolean;
};

export type LoweringBinaryOperator =
  | "equal"
  | "strict-equal"
  | "not-equal"
  | "strict-not-equal"
  | "logical-and"
  | "logical-or"
  | "nullish-coalesce"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "remainder"
  | "bitwise-and"
  | "bitwise-or"
  | "bitwise-xor"
  | "left-shift"
  | "signed-right-shift"
  | "unsigned-right-shift"
  | "less-than"
  | "less-than-or-equal"
  | "greater-than"
  | "greater-than-or-equal"
  | "assign"
  | "add-assign"
  | "subtract-assign"
  | "multiply-assign"
  | "divide-assign"
  | "remainder-assign"
  | "bitwise-and-assign"
  | "bitwise-or-assign"
  | "bitwise-xor-assign"
  | "left-shift-assign"
  | "signed-right-shift-assign"
  | "unsigned-right-shift-assign"
  | "instanceof";

export type LoweringUnaryOperator =
  | "plus"
  | "minus"
  | "logical-not"
  | "bitwise-not"
  | "increment"
  | "decrement";

export type LoweringExpressionSemantic =
  | "undefined-value"
  | "compile-time-marker-call";

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
  readonly type?: LoweringTypeRefPlan;
  readonly contextualTypePlan?: LoweringTypeRefPlan;
  readonly storageTypePlan?: LoweringTypeRefPlan;
  readonly intrinsicKind?: IntrinsicSemanticsFact["kind"];
  readonly passingMode?: ParameterPassingMode;
  readonly literalKind?:
    | "string"
    | "number"
    | "bigint"
    | "boolean"
    | "null"
    | "undefined";
  readonly literalText?: string;
  readonly returnType?: LoweringTypeRefPlan;
  readonly binaryOperator?: LoweringBinaryOperator;
  readonly unaryOperator?: LoweringUnaryOperator;
  readonly semantic?: LoweringExpressionSemantic;
  readonly sourceOperation?: SourceRuntimeOperationFact;
  readonly resolvedAliasName?: string;
  readonly sourceQualifiedName?: LoweringSourceQualifiedNamePlan;
  readonly externalBinding?: LoweringExternalBindingReferencePlan;
  readonly optionalAccess?: boolean;
  readonly yieldDelegates?: boolean;
  readonly expression?: LoweringExpressionPlan;
  readonly receiverTypePlan?: LoweringTypeRefPlan;
  readonly callTargetTypePlan?: LoweringTypeRefPlan;
  readonly left?: LoweringExpressionPlan;
  readonly right?: LoweringExpressionPlan;
  readonly condition?: LoweringExpressionPlan;
  readonly whenTrue?: LoweringExpressionPlan;
  readonly whenFalse?: LoweringExpressionPlan;
  readonly arguments: readonly LoweringExpressionPlan[];
  readonly argumentUseSiteTypes?: readonly (LoweringTypeRefPlan | undefined)[];
  readonly typeArguments: readonly LoweringTypeRefPlan[];
  readonly elements: readonly LoweringExpressionPlan[];
  readonly properties: readonly LoweringObjectPropertyPlan[];
  readonly templateParts: readonly LoweringTemplatePartPlan[];
  readonly parameters: readonly LoweringParameterPlan[];
  readonly body?: LoweringStatementPlan;
  readonly async?: boolean;
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
  readonly compileTimeOnly?: boolean;
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

export type LoweringModulePlan<
  Target extends BackendTargetId = BackendTargetId,
> = {
  readonly kind: "lowering-module";
  readonly backendTargetId?: Target;
  readonly identity: LoweringModuleIdentity;
  readonly sourceFile: TstsSourceFile;
  readonly sourceModule: ExtensionSourceModule;
  readonly imports: readonly ExtensionModuleImport[];
  readonly exports: readonly ExtensionExportBinding[];
  readonly declarations: readonly LoweringDeclarationPlan[];
  readonly topLevelStatements: readonly LoweringStatementPlan[];
  readonly statements: readonly LoweringStatementPlan[];
  readonly expressions: readonly LoweringExpressionPlan[];
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
  readonly options: LoweringPipelineOptions;
  readonly diagnostics: readonly Diagnostic[];
};
