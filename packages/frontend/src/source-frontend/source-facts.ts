import { defineExtensionFactKey } from "@tsonic/tsts";
import type { SourceSemanticFactKey } from "./semantic-view.js";

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
  readonly storage: "field";
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
  | "Array"
  | "Console"
  | "DataView"
  | "Error"
  | "Float32Array"
  | "Float64Array"
  | "Function"
  | "Global"
  | "Int16Array"
  | "Int32Array"
  | "Int8Array"
  | "JSON"
  | "Map"
  | "Object"
  | "Promise"
  | "RegExp"
  | "String"
  | "Uint16Array"
  | "Uint32Array"
  | "Uint8Array"
  | "Uint8ClampedArray";

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
  | "type-alias"
  | "variable";

export type SourceBindingIdentityFact = {
  readonly sourceFileName: string;
  readonly name: string;
  readonly declarationKind: SourceBindingDeclarationKind;
  readonly topLevelStaticValue: boolean;
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
  visit(intrinsicSemanticsFactKey);
  visit(sourceBindingIdentityFactKey);
};
