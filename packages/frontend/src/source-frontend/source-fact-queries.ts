import type {
  ExtensionReceiverSemanticsFact,
  FieldSemanticsFact,
  HeritageWrapperSemanticsFact,
  IntrinsicSemanticsFact,
  MarkerApiSemanticsFact,
  ParameterPassingFact,
  SourceTypeSemanticsFact,
} from "./source-facts.js";

export type IrParameterPassingMode = "value" | "ref" | "out" | "in";

export type IrCallSitePassingModifier = "ref" | "out" | "in";

export const parameterPassingModeFromFact = (
  fact: ParameterPassingFact | undefined
): IrParameterPassingMode | undefined => {
  if (!fact) return undefined;
  switch (fact.mode) {
    case "by-value":
      return "value";
    case "byref-readonly":
      return "in";
    case "byref-readwrite":
      return "ref";
    case "byref-writeonly-must-init":
      return "out";
  }
};

export const callSitePassingModifierFromFact = (
  fact: ParameterPassingFact | undefined
): IrCallSitePassingModifier | undefined => {
  const mode = parameterPassingModeFromFact(fact);
  return mode === "ref" || mode === "out" || mode === "in" ? mode : undefined;
};

export const isSourceTypeKind = (
  fact: SourceTypeSemanticsFact | undefined,
  kind: SourceTypeSemanticsFact["kind"]
): boolean => fact?.kind === kind;

export const isFieldStorageFact = (
  fact: FieldSemanticsFact | undefined
): boolean => fact?.storage === "field";

export const isExtensionReceiverFact = (
  fact: ExtensionReceiverSemanticsFact | undefined
): boolean => fact?.kind === "extension-receiver";

export const isHeritageInterfaceErasure = (
  fact: HeritageWrapperSemanticsFact | undefined
): boolean => fact?.kind === "interface-erasure";

export const markerApiKindFromFact = (
  fact: MarkerApiSemanticsFact | undefined
): MarkerApiSemanticsFact["kind"] | undefined => fact?.kind;

export const isMarkerApiKind = (
  fact: MarkerApiSemanticsFact | undefined,
  kind: MarkerApiSemanticsFact["kind"]
): boolean => fact?.kind === kind;

export const isIntrinsicKind = (
  fact: IntrinsicSemanticsFact | undefined,
  kind: IntrinsicSemanticsFact["kind"]
): boolean => fact?.kind === kind;
