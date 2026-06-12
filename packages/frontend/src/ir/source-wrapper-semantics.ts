import * as ts from "typescript";
import {
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  isExtensionReceiverFact,
  isFieldStorageFact,
  parameterPassingFactKey,
  parameterPassingModeFromFact,
} from "../source-frontend/index.js";
import type {
  IrParameterPassingMode,
  SourceSemanticFactKey,
} from "../source-frontend/index.js";

export type SourceFactReader = <T>(
  node: ts.Node,
  key: SourceSemanticFactKey<T>
) => T | undefined;

export type SourceParameterTypeUnwrap = {
  readonly typeNode: ts.TypeNode | undefined;
  readonly passing: IrParameterPassingMode;
  readonly isExtensionReceiver: boolean;
};

export type SourceWrapperTypeReference =
  | {
      readonly kind: "extension-receiver";
      readonly innerType: ts.TypeNode;
    }
  | {
      readonly kind: "field-storage";
      readonly innerType: ts.TypeNode;
    }
  | {
      readonly kind: "parameter-passing";
      readonly innerType: ts.TypeNode;
      readonly passing: Exclude<IrParameterPassingMode, "value">;
      readonly referenceName: "ref" | "out" | "inref";
    };

export const sourceParameterPassingReferenceName = (
  passing: IrParameterPassingMode
): "ref" | "out" | "inref" | undefined => {
  switch (passing) {
    case "value":
      return undefined;
    case "in":
      return "inref";
    case "ref":
      return "ref";
    case "out":
      return "out";
  }
};

export const classifySourceWrapperTypeReference = (
  node: ts.TypeReferenceNode,
  readFact: SourceFactReader
): SourceWrapperTypeReference | undefined => {
  if (!node.typeArguments || node.typeArguments.length !== 1) {
    return undefined;
  }
  const innerType = node.typeArguments[0];
  if (!innerType) {
    return undefined;
  }

  if (isExtensionReceiverFact(readFact(node, extensionReceiverSemanticsFactKey))) {
    return { kind: "extension-receiver", innerType };
  }

  if (isFieldStorageFact(readFact(node, fieldSemanticsFactKey))) {
    return { kind: "field-storage", innerType };
  }

  const passing = parameterPassingModeFromFact(
    readFact(node, parameterPassingFactKey)
  );
  const referenceName = sourceParameterPassingReferenceName(passing ?? "value");
  if (!referenceName || passing === undefined || passing === "value") {
    return undefined;
  }

  return {
    kind: "parameter-passing",
    innerType,
    passing,
    referenceName,
  };
};

export const unwrapSourceParameterType = (
  typeNode: ts.TypeNode | undefined,
  readFact: SourceFactReader
): SourceParameterTypeUnwrap => {
  let current = typeNode;
  let passing: IrParameterPassingMode = "value";
  let isExtensionReceiver = false;

  while (current) {
    if (ts.isParenthesizedTypeNode(current)) {
      current = current.type;
      continue;
    }

    if (!ts.isTypeReferenceNode(current)) {
      break;
    }

    const wrapper = classifySourceWrapperTypeReference(current, readFact);
    if (!wrapper) {
      break;
    }

    if (wrapper.kind === "extension-receiver") {
      isExtensionReceiver = true;
      current = wrapper.innerType;
      continue;
    }

    if (wrapper.kind === "parameter-passing") {
      passing = wrapper.passing;
      current = wrapper.innerType;
      continue;
    }

    break;
  }

  return { typeNode: current, passing, isExtensionReceiver };
};
