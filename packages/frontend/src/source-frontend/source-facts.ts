import { defineSourceSemanticFactKey } from "./semantic-view.js";

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

export const numericPrimitiveFactKey =
  defineSourceSemanticFactKey<NumericPrimitiveFact>(
    "tsonic:source:numeric-primitive",
    "Source-level primitive type identity such as int, long, decimal, char, or bool."
  );

export const sourceTypeSemanticsFactKey =
  defineSourceSemanticFactKey<SourceTypeSemanticsFact>(
    "tsonic:source:type-semantics",
    "Source-level type semantics such as struct."
  );

export const fieldSemanticsFactKey =
  defineSourceSemanticFactKey<FieldSemanticsFact>(
    "tsonic:source:field-semantics",
    "Source-level field marker semantics."
  );

export const parameterPassingFactKey =
  defineSourceSemanticFactKey<ParameterPassingFact>(
    "tsonic:source:parameter-passing",
    "Source-level parameter passing semantics such as out/ref/inref."
  );

export const extensionReceiverSemanticsFactKey =
  defineSourceSemanticFactKey<ExtensionReceiverSemanticsFact>(
    "tsonic:source:extension-receiver",
    "Source-level extension receiver marker semantics such as thisarg."
  );

export const heritageWrapperSemanticsFactKey =
  defineSourceSemanticFactKey<HeritageWrapperSemanticsFact>(
    "tsonic:source:heritage-wrapper",
    "Source-level heritage wrapper semantics such as Interface<T> erasure."
  );

export const markerApiSemanticsFactKey =
  defineSourceSemanticFactKey<MarkerApiSemanticsFact>(
    "tsonic:source:marker-api",
    "Source-level compiler marker API provenance such as attributes or overloads."
  );

export const intrinsicSemanticsFactKey =
  defineSourceSemanticFactKey<IntrinsicSemanticsFact>(
    "tsonic:source:intrinsic-semantics",
    "Source-level intrinsic semantics."
  );
