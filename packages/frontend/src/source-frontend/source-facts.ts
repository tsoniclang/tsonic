import { defineExtensionFactKey } from "@tsonic/tsts";
import type {
  ExtensionFactKeyLike,
  ExtensionFacts,
  TstsNode,
} from "@tsonic/tsts";

export type SourceSemanticFactKey<T> = ExtensionFactKeyLike<T>;

export type SourceSemanticFacts = Pick<
  ExtensionFacts,
  "get" | "has" | "snapshotFor"
>;

export type NumericPrimitiveKind =
  | "bool"
  | "char"
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "native-int"
  | "native-uint"
  | "float32"
  | "float64"
  | "decimal";

export type NumericPrimitiveRuntimeBase =
  | "boolean"
  | "string"
  | "number"
  | "bigint"
  | "decimal";

export type NumericPrimitiveFact = {
  readonly sourceName: string;
  readonly kind: NumericPrimitiveKind;
  readonly runtimeBase: NumericPrimitiveRuntimeBase;
  readonly signed?: boolean;
  readonly width?: number;
};

export type SourceTypeSemanticsFact = {
  readonly kind: "struct" | "class" | "interface";
};

export type FieldSemanticsFact = {
  readonly kind: "field";
};

export type ParameterPassingMode =
  | "by-value"
  | "byref-readonly"
  | "byref-readwrite"
  | "byref-writeonly-must-init";

export type ParameterPassingFact = {
  readonly mode: ParameterPassingMode;
};

export type ExtensionReceiverSemanticsFact = {
  readonly kind: "extension-receiver";
};

export type HeritageWrapperSemanticsFact = {
  readonly kind: "interface-erasure";
};

export type MarkerApiSemanticsFact = {
  readonly kind: "attributes" | "attribute-targets" | "overloads";
};

export type ExpressionSemanticsFact = {
  readonly kind: "undefined-value";
};

export type SourceRuntimeOperationOwner =
  | "Arguments"
  | "Array"
  | "Console"
  | "DataView"
  | "Date"
  | "Error"
  | "Float32Array"
  | "Float64Array"
  | "Function"
  | "Global"
  | "Int16Array"
  | "Int32Array"
  | "Int8Array"
  | "JSON"
  | "Math"
  | "Map"
  | "Object"
  | "Promise"
  | "RangeError"
  | "RegExp"
  | "Set"
  | "String"
  | "Uint16Array"
  | "Uint32Array"
  | "Uint8Array"
  | "Uint8ClampedArray";

export type SourceRuntimeTypeOwner =
  | SourceRuntimeOperationOwner
  | "AsyncGenerator"
  | "Generator"
  | "Iterable"
  | "IterableIterator"
  | "Iterator"
  | "IteratorObject"
  | "ReadonlyArray";

export type SourceRuntimeOperationDispatch =
  | "constructor"
  | "index"
  | "property"
  | "receiver-call"
  | "static-call";

export type SourceRuntimeOperationFact = {
  readonly owner: SourceRuntimeOperationOwner;
  readonly member: string;
  readonly dispatch: SourceRuntimeOperationDispatch;
};

export type WellKnownComputedNameFact = {
  readonly kind:
    | "symbol-iterator"
    | "symbol-async-iterator"
    | "symbol-to-string-tag";
};

export type GenericFunctionAliasFact = {
  readonly resolvedName: string;
  readonly targetDeclaration?: TstsNode;
};

export type GenericFunctionUseSiteFact = {
  readonly typeArguments: readonly SourceBindingProjectedType[];
};

export type SourceOverloadFamilyFact = {
  readonly implementations: readonly TstsNode[];
};

export type SourceOverloadCallImplementationFact = {
  readonly implementation: TstsNode;
};

export type IntrinsicSemanticsFact = {
  readonly kind:
    | "asinterface"
    | "defaultof"
    | "istype"
    | "nameof"
    | "sizeof"
    | "stackalloc"
    | "trycast";
};

export type SourceBindingDeclarationKind =
  | "class"
  | "enum"
  | "function"
  | "interface"
  | "parameter"
  | "type-alias"
  | "variable";

export type SourceBindingIdentityFact = {
  readonly sourceFileName: string;
  readonly name: string;
  readonly declarationKind: SourceBindingDeclarationKind;
  readonly topLevelStaticValue: boolean;
  readonly declaration: TstsNode;
};

export type SourceRuntimeVisibilityFact = {
  readonly visibility: "opaque";
};

export type SourceDictionaryTypeFact = {
  readonly kind: "record";
};

export type SourceIntrinsicTypeName =
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

export type SourceProjectedDeclarationKind =
  | "class"
  | "enum"
  | "interface"
  | "type-alias"
  | "type-parameter";

export type SourceBindingProjectedType =
  | {
      readonly kind: "intrinsic";
      readonly name: SourceIntrinsicTypeName;
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "source-primitive";
      readonly fact: NumericPrimitiveFact;
      readonly sourceNode?: TstsNode;
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
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "named";
      readonly name: string;
      readonly typeArguments: readonly SourceBindingProjectedType[];
      readonly typeParameters?: readonly string[];
      readonly declaration?: TstsNode;
      readonly declarationKind?: SourceProjectedDeclarationKind;
      readonly aliasTarget?: SourceBindingProjectedType;
      readonly runtimeTypeOwner?: SourceRuntimeTypeOwner;
      readonly runtimeVisibility?: "opaque";
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "record";
      readonly keyType: SourceBindingProjectedType;
      readonly valueType: SourceBindingProjectedType;
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "function";
      readonly parameters: readonly SourceParameterTypeProjection[];
      readonly returnType?: SourceBindingProjectedType;
      readonly typeParameters: readonly string[];
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "array";
      readonly elementType: SourceBindingProjectedType;
      readonly readonly: boolean;
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "tuple";
      readonly elements: readonly SourceBindingProjectedType[];
      readonly readonly: boolean;
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "object";
      readonly members: readonly SourceBindingProjectedObjectMember[];
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "union";
      readonly types: readonly SourceBindingProjectedType[];
      readonly sourceNode?: TstsNode;
    }
  | {
      readonly kind: "intersection";
      readonly types: readonly SourceBindingProjectedType[];
      readonly sourceNode?: TstsNode;
    };

export type SourceBindingProjectedObjectMember = {
  readonly name: string;
  readonly type?: SourceBindingProjectedType;
  readonly optional: boolean;
};

export type SourceBindingTypeProjectionFact = {
  readonly type: SourceBindingProjectedType;
};

export type SourceTypeProjectionFact = {
  readonly type: SourceBindingProjectedType;
};

export type SourceExpressionTypeProjectionFact = {
  readonly type: SourceBindingProjectedType;
  readonly valueType?: SourceBindingProjectedType;
  readonly contextualType?: SourceBindingProjectedType;
};

export type SourceCallArgumentTypesFact = {
  readonly argumentTypes: readonly (SourceBindingProjectedType | undefined)[];
  readonly typeArguments?: readonly SourceBindingProjectedType[];
  readonly targetType?: SourceBindingProjectedType;
  readonly returnType?: SourceBindingProjectedType;
};

export type SourceInitializerReferencesDeclarationFact = {
  readonly referencesDeclaration: true;
};

export type SourceParameterTypeProjection = {
  readonly name: string;
  readonly type?: SourceBindingProjectedType;
  readonly optional: boolean;
  readonly rest: boolean;
};

export type SourceDeclarationTypeProjectionFact = {
  readonly declaredType?: SourceBindingProjectedType;
  readonly returnType?: SourceBindingProjectedType;
  readonly baseConstructorParameters?: readonly SourceParameterTypeProjection[];
};

export type SourceAttributeTargetKind =
  | "type"
  | "constructor"
  | "method"
  | "property";

export type SourceAttributeTargetSpecifier =
  | "assembly"
  | "module"
  | "type"
  | "method"
  | "property"
  | "field"
  | "event"
  | "param"
  | "return";

export type SourceAttributeDescriptorFact = {
  readonly attributeType: TstsNode;
  readonly arguments: readonly TstsNode[];
};

export type SourceAttributeApplicationFact = SourceAttributeDescriptorFact & {
  readonly targetKind: SourceAttributeTargetKind;
  readonly targetSpecifier?: SourceAttributeTargetSpecifier;
};

export type SourceAttributeApplicationsFact = {
  readonly applications: readonly SourceAttributeApplicationFact[];
};

const defineSourceFactKey = <T>(
  id: string,
  description: string
): SourceSemanticFactKey<T> =>
  defineExtensionFactKey<object, T>(id, description);

export const numericPrimitiveFactKey =
  defineSourceFactKey<NumericPrimitiveFact>(
    "tsonic:source:numeric-primitive",
    "Source-level primitive type identity such as int, long, decimal, char, or bool."
  );

export const sourceTypeSemanticsFactKey =
  defineSourceFactKey<SourceTypeSemanticsFact>(
    "tsonic:source:type-semantics",
    "Source-level type semantics such as struct."
  );

export const fieldSemanticsFactKey = defineSourceFactKey<FieldSemanticsFact>(
  "tsonic:source:field-semantics",
  "Source-level field marker semantics."
);

export const parameterPassingFactKey =
  defineSourceFactKey<ParameterPassingFact>(
    "tsonic:source:parameter-passing",
    "Source-level parameter passing semantics such as out/ref/inref."
  );

export const extensionReceiverSemanticsFactKey =
  defineSourceFactKey<ExtensionReceiverSemanticsFact>(
    "tsonic:source:extension-receiver",
    "Source-level extension receiver marker semantics such as thisarg."
  );

export const heritageWrapperSemanticsFactKey =
  defineSourceFactKey<HeritageWrapperSemanticsFact>(
    "tsonic:source:heritage-wrapper",
    "Source-level heritage wrapper semantics such as Interface<T> erasure."
  );

export const markerApiSemanticsFactKey =
  defineSourceFactKey<MarkerApiSemanticsFact>(
    "tsonic:source:marker-api",
    "Source-level compiler marker API provenance such as attributes or overloads."
  );

export const expressionSemanticsFactKey =
  defineSourceFactKey<ExpressionSemanticsFact>(
    "tsonic:source:expression-semantics",
    "Source-level expression semantics proven by the TSTS source extension."
  );

export const sourceRuntimeOperationFactKey =
  defineSourceFactKey<SourceRuntimeOperationFact>(
    "tsonic:source:runtime-operation",
    "Source-level runtime operation proven by the TSTS source extension."
  );

export const wellKnownComputedNameFactKey =
  defineSourceFactKey<WellKnownComputedNameFact>(
    "tsonic:source:well-known-computed-name",
    "Source-level well-known computed declaration names such as Symbol.iterator."
  );

export const genericFunctionAliasFactKey =
  defineSourceFactKey<GenericFunctionAliasFact>(
    "tsonic:source:generic-function-alias",
    "Source-level compile-time generic function alias target."
  );

export const genericFunctionUseSiteFactKey =
  defineSourceFactKey<GenericFunctionUseSiteFact>(
    "tsonic:source:generic-function-use-site",
    "Source-level generic function use-site type arguments selected by the TSTS checker."
  );

export const sourceOverloadFamilyFactKey =
  defineSourceFactKey<SourceOverloadFamilyFact>(
    "tsonic:source:overload-family",
    "Source-level overload family implementations proven from overload marker builders."
  );

export const sourceOverloadCallImplementationFactKey =
  defineSourceFactKey<SourceOverloadCallImplementationFact>(
    "tsonic:source:overload-call-implementation",
    "Source-level overload call implementation selected by the TSTS checker."
  );

export const intrinsicSemanticsFactKey =
  defineSourceFactKey<IntrinsicSemanticsFact>(
    "tsonic:source:intrinsic-semantics",
    "Source-level intrinsic semantics."
  );

export const sourceBindingIdentityFactKey =
  defineSourceFactKey<SourceBindingIdentityFact>(
    "tsonic:source:binding-identity",
    "Source-level binding declaration identity resolved by TSTS."
  );

export const sourceRuntimeVisibilityFactKey =
  defineSourceFactKey<SourceRuntimeVisibilityFact>(
    "tsonic:source:runtime-visibility",
    "Source-level runtime visibility such as opaque generated/internal identities."
  );

export const sourceDictionaryTypeFactKey =
  defineSourceFactKey<SourceDictionaryTypeFact>(
    "tsonic:source:dictionary-type",
    "Source-level dictionary type identity such as Record<K, V>."
  );

export const sourceBindingTypeProjectionFactKey =
  defineSourceFactKey<SourceBindingTypeProjectionFact>(
    "tsonic:source:binding-type-projection",
    "Source-level type projected by TSTS for destructured binding elements."
  );

export const sourceTypeProjectionFactKey =
  defineSourceFactKey<SourceTypeProjectionFact>(
    "tsonic:source:type-projection",
    "Source-level type projection selected by TSTS."
  );

export const sourceExpressionTypeProjectionFactKey =
  defineSourceFactKey<SourceExpressionTypeProjectionFact>(
    "tsonic:source:expression-type-projection",
    "Source-level expression type projected by TSTS."
  );

export const sourceCallArgumentTypesFactKey =
  defineSourceFactKey<SourceCallArgumentTypesFact>(
    "tsonic:source:call-argument-types",
    "Source-level call argument and target types selected by the TSTS checker."
  );

export const sourceInitializerReferencesDeclarationFactKey =
  defineSourceFactKey<SourceInitializerReferencesDeclarationFact>(
    "tsonic:source:initializer-references-declaration",
    "Source-level self-referential initializer fact proven by TSTS binding."
  );

export const sourceDeclarationTypeProjectionFactKey =
  defineSourceFactKey<SourceDeclarationTypeProjectionFact>(
    "tsonic:source:declaration-type-projection",
    "Source-level declaration type, return type, and base-constructor parameter projections selected by TSTS."
  );

export const sourceAttributeDescriptorFactKey =
  defineSourceFactKey<SourceAttributeDescriptorFact>(
    "tsonic:source:attribute-descriptor",
    "Source-level compile-time attribute descriptor created by attributes.attr."
  );

export const sourceAttributeApplicationsFactKey =
  defineSourceFactKey<SourceAttributeApplicationsFact>(
    "tsonic:source:attribute-applications",
    "Source-level attribute applications attached to target declarations."
  );

export const visitSourceSemanticFactKeys = (
  visit: <T>(factKey: SourceSemanticFactKey<T>) => void
): void => {
  visit(numericPrimitiveFactKey);
  visit(sourceTypeSemanticsFactKey);
  visit(fieldSemanticsFactKey);
  visit(parameterPassingFactKey);
  visit(extensionReceiverSemanticsFactKey);
  visit(heritageWrapperSemanticsFactKey);
  visit(markerApiSemanticsFactKey);
  visit(expressionSemanticsFactKey);
  visit(sourceRuntimeOperationFactKey);
  visit(wellKnownComputedNameFactKey);
  visit(genericFunctionAliasFactKey);
  visit(genericFunctionUseSiteFactKey);
  visit(sourceOverloadFamilyFactKey);
  visit(sourceOverloadCallImplementationFactKey);
  visit(intrinsicSemanticsFactKey);
  visit(sourceBindingIdentityFactKey);
  visit(sourceRuntimeVisibilityFactKey);
  visit(sourceDictionaryTypeFactKey);
  visit(sourceBindingTypeProjectionFactKey);
  visit(sourceTypeProjectionFactKey);
  visit(sourceExpressionTypeProjectionFactKey);
  visit(sourceCallArgumentTypesFactKey);
  visit(sourceInitializerReferencesDeclarationFactKey);
  visit(sourceDeclarationTypeProjectionFactKey);
  visit(sourceAttributeDescriptorFactKey);
  visit(sourceAttributeApplicationsFactKey);
};
