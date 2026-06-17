import type {
  ExtensionReceiverSemanticsFact,
  FieldSemanticsFact,
  HeritageWrapperSemanticsFact,
  IntrinsicSemanticsFact,
  MarkerApiSemanticsFact,
  SourceTypeSemanticsFact,
} from "./source-facts.js";

export const isSourceTypeKind = (
  fact: SourceTypeSemanticsFact | undefined,
  kind: SourceTypeSemanticsFact["kind"]
): boolean => fact?.kind === kind;

export const isFieldSemanticsFact = (
  fact: FieldSemanticsFact | undefined
): boolean => fact?.kind === "field";

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
