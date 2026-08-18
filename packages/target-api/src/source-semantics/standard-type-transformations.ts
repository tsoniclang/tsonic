import type {
  AstReader,
  Node,
  Signature,
  Type,
  TypeCheckerQueries,
  TypeSignatureParameterInfo,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type {
  SourceProgramNavigation,
} from "../source-navigation/index.js";
import { typescriptNoLibUtilityDeclarations } from "../typescript-no-lib-utilities.js";
import type {
  SourceCallableTypeEvidence,
  SourceFileSemantics,
  SourceStandardTypeTransformation,
  SourceTypeComponentEvidence,
} from "./types.js";

interface StandardTypeTransformationContext {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  semanticsFor(node: Node): SourceFileSemantics;
}

export function selectStandardSourceTypeTransformation(
  context: StandardTypeTransformationContext,
  authoredTypeNode: Node,
  selectedType: Type,
): SourceStandardTypeTransformation | undefined {
  if (!context.ast.is.IsTypeReferenceNode(authoredTypeNode)) {
    return undefined;
  }
  const reference = context.ast.as.AsTypeReferenceNode(authoredTypeNode);
  const declaration = context.navigation.sourceReferenceFor(
    reference?.TypeName,
  )?.declaration;
  if (
    declaration === undefined ||
    !context.ast.is.IsTypeAliasDeclaration(declaration) ||
    !isCanonicalTypescriptUtilityDeclaration(context, declaration)
  ) {
    return undefined;
  }
  const name = context.ast.text(context.ast.name(declaration));
  const typeArguments = context.ast.typeArguments(authoredTypeNode).filter(
    (node): node is Node => node !== undefined,
  );
  if (
    (name === "Partial" || name === "Required" || name === "Readonly") &&
    typeArguments.length === 1
  ) {
    return { kind: "structural" };
  }
  if (
    (name === "Pick" || name === "Record" || name === "Omit") &&
    typeArguments.length === 2
  ) {
    return { kind: "structural" };
  }
  if (typeArguments.length !== 1) {
    return { kind: "unresolved" };
  }
  const semantics = context.semanticsFor(authoredTypeNode);
  const inputType = semantics.getTypeFromTypeNode(typeArguments[0]);
  if (inputType === undefined) {
    return { kind: "unresolved" };
  }
  switch (name) {
    case "Parameters":
      return selectParameterListTransformation(
        semantics.getCallSignatures(inputType),
        selectedType,
        semantics,
      );
    case "ConstructorParameters":
      return selectParameterListTransformation(
        semantics.getConstructSignatures(inputType),
        selectedType,
        semantics,
      );
    case "ReturnType":
      return selectResultTransformation(
        semantics.getCallSignatures(inputType),
        selectedType,
        semantics,
        context.ast,
      );
    case "InstanceType":
      return selectResultTransformation(
        semantics.getConstructSignatures(inputType),
        selectedType,
        semantics,
        context.ast,
      );
    case "ThisParameterType":
      return selectThisParameterTransformation(
        semantics.getCallSignatures(inputType),
        selectedType,
        semantics,
        context.ast,
      );
    case "OmitThisParameter":
      return selectCallableTransformation(
        semantics.getCallSignatures(inputType),
        selectedType,
        semantics,
        context.ast,
      );
    default:
      return undefined;
  }
}

function isCanonicalTypescriptUtilityDeclaration(
  context: StandardTypeTransformationContext,
  declaration: Node,
): boolean {
  const sourceFile = context.ast.getSourceFile(declaration);
  if (sourceFile === undefined) {
    return false;
  }
  return context.ast.getFileName(sourceFile).split("\\").join("/")
      .endsWith("/typescript-utilities.d.ts") &&
    context.ast.getSourceText(sourceFile) === typescriptNoLibUtilityDeclarations;
}

function selectParameterListTransformation(
  signatures: readonly (Signature | undefined)[],
  selectedType: Type,
  semantics: SourceFileSemantics,
): SourceStandardTypeTransformation {
  const signature = lastDefined(signatures);
  if (signature === undefined) {
    return { kind: "unresolved" };
  }
  const parameters = semantics.getSignatureParameterInfos(signature);
  const selectedElements = semantics.isTuple(selectedType)
    ? semantics.getTupleElementInfos(selectedType)
    : undefined;
  const tupleMatches = selectedElements !== undefined &&
    parameters.length === selectedElements.length &&
    parameters.every((parameter, index) =>
      semantics.isTypeIdenticalTo(
        parameter.type,
        selectedElements[index]?.type,
      ) && parameterKindToTupleKind(parameter.parameterKind) ===
        selectedElements[index]?.elementKind
    );
  const restSequenceMatches = parameters.length === 1 &&
    parameters[0]?.parameterKind === "rest" &&
    semantics.isTypeIdenticalTo(parameters[0].type, selectedType);
  if (!tupleMatches && !restSequenceMatches) {
    return { kind: "unresolved" };
  }
  return {
    kind: "parameter-list",
    parameters: Object.freeze(parameters.slice()),
  };
}

function selectResultTransformation(
  signatures: readonly (Signature | undefined)[],
  selectedType: Type,
  semantics: SourceFileSemantics,
  ast: AstReader,
): SourceStandardTypeTransformation {
  const signature = lastDefined(signatures);
  if (signature === undefined) {
    return { kind: "unresolved" };
  }
  const result = signatureResultEvidence(signature, semantics, ast);
  return result !== undefined &&
      semantics.isTypeIdenticalTo(result.selectedType, selectedType)
    ? { kind: "component", component: result }
    : { kind: "unresolved" };
}

function selectThisParameterTransformation(
  signatures: readonly (Signature | undefined)[],
  selectedType: Type,
  semantics: SourceFileSemantics,
  ast: AstReader,
): SourceStandardTypeTransformation {
  const signature = lastDefined(signatures);
  const parameter = signature === undefined
    ? undefined
    : semantics.getSignatureThisParameterInfo(signature);
  if (
    parameter === undefined ||
    !semantics.isTypeIdenticalTo(parameter.type, selectedType)
  ) {
    return { kind: "unresolved" };
  }
  return {
    kind: "component",
    component: Object.freeze({
      selectedType: parameter.type,
      ...(parameter.declaration === undefined
        ? {}
        : {
            declaration: parameter.declaration,
            ...typeNodeProperty(ast, parameter.declaration),
          }),
    }),
  };
}

function selectCallableTransformation(
  inputSignatures: readonly (Signature | undefined)[],
  selectedType: Type,
  semantics: SourceFileSemantics,
  ast: AstReader,
): SourceStandardTypeTransformation {
  const input = lastDefined(inputSignatures);
  const output = selectSourceCallableTypeEvidence(
    selectedType,
    semantics,
    ast,
  );
  if (input === undefined || output === undefined) {
    return { kind: "unresolved" };
  }
  const inputParameters = semantics.getSignatureParameterInfos(input);
  const inputResult = signatureResultEvidence(input, semantics, ast);
  if (
    inputResult === undefined ||
    inputParameters.length !== output.parameters.length ||
    !semantics.isTypeIdenticalTo(
      inputResult.selectedType,
      output.result.selectedType,
    ) ||
    inputParameters.some((parameter, index) =>
      parameter.parameterKind !== output.parameters[index]?.parameterKind ||
      !semantics.isTypeIdenticalTo(
        parameter.type,
        output.parameters[index]?.type,
      )
    )
  ) {
    return { kind: "unresolved" };
  }
  return {
    kind: "callable",
    callable: Object.freeze({
      parameters: Object.freeze(inputParameters.slice()),
      result: inputResult,
    }),
  };
}

export function selectSourceCallableTypeEvidence(
  type: Type,
  semantics: TypeShapeQueries & Pick<
    TypeCheckerQueries,
    "getSignatureDeclaration"
  >,
  ast: AstReader,
): SourceCallableTypeEvidence | undefined {
  const signature = singleDefined(semantics.getCallSignatures(type));
  if (signature === undefined) {
    return undefined;
  }
  const result = signatureResultEvidence(signature, semantics, ast);
  return result === undefined
    ? undefined
    : Object.freeze({
        parameters: Object.freeze(
          semantics.getSignatureParameterInfos(signature).slice(),
        ),
        result,
      });
}

function signatureResultEvidence(
  signature: Signature,
  semantics: TypeShapeQueries & Pick<
    TypeCheckerQueries,
    "getSignatureDeclaration"
  >,
  ast: AstReader,
): SourceTypeComponentEvidence | undefined {
  const selectedType = semantics.getReturnTypeOfSignature(signature);
  if (selectedType === undefined) {
    return undefined;
  }
  const declaration = semantics.getSignatureDeclaration(signature);
  return Object.freeze({
    selectedType,
    ...(declaration === undefined
      ? {}
      : {
          declaration,
          ...typeNodeProperty(ast, declaration),
        }),
  });
}

function typeNodeProperty(
  ast: AstReader,
  declaration: Node,
): { readonly authoredTypeNode?: Node } {
  const authoredTypeNode = ast.typeNode(declaration);
  return authoredTypeNode === undefined ? {} : { authoredTypeNode };
}

function parameterKindToTupleKind(
  kind: TypeSignatureParameterInfo["parameterKind"],
): "required" | "optional" | "rest" {
  return kind;
}

function singleDefined<T>(
  values: readonly (T | undefined)[],
): T | undefined {
  return values.length === 1 ? values[0] : undefined;
}

function lastDefined<T>(
  values: readonly (T | undefined)[],
): T | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}
