import type {
  AstReader,
  Node,
  Signature,
  Type,
  TypeSignatureParameterInfo,
} from "@tsonic/tsts";
import type {
  SourceProgramNavigation,
} from "../source-navigation/index.js";
import { typescriptNoLibUtilityDeclarations } from "../typescript-no-lib-utilities.js";
import type {
  SourceCallableTypeEvidence,
  SourceCallableParameterEvidence,
  SourceFinalTypeQueries,
  SourceFileSemantics,
  SourceSelectedDeclarationQueries,
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
  const typeArgument = typeArguments[0];
  if (typeArgument === undefined) {
    return { kind: "unresolved" };
  }
  const semantics = context.semanticsFor(authoredTypeNode);
  const inputType = semantics.types.authoredType(typeArgument);
  if (inputType === undefined) {
    return { kind: "unresolved" };
  }
  const callableQueries = Object.freeze({
    ...semantics.types,
    signatureDeclaration: semantics.declarations.signatureDeclaration,
  });
  switch (name) {
    case "Parameters":
      return selectParameterListTransformation(
        semantics.types.callSignatures(inputType),
        selectedType,
        callableQueries,
        context.ast,
      );
    case "ConstructorParameters":
      return selectParameterListTransformation(
        semantics.types.constructSignatures(inputType),
        selectedType,
        callableQueries,
        context.ast,
      );
    case "ReturnType":
      return selectResultTransformation(
        semantics.types.callSignatures(inputType),
        selectedType,
        callableQueries,
        context.ast,
      );
    case "InstanceType":
      return selectResultTransformation(
        semantics.types.constructSignatures(inputType),
        selectedType,
        callableQueries,
        context.ast,
      );
    case "ThisParameterType":
      return selectThisParameterTransformation(
        semantics.types.callSignatures(inputType),
        selectedType,
        semantics.types,
        context.ast,
      );
    case "OmitThisParameter":
      return selectCallableTransformation(
        semantics.types.callSignatures(inputType),
        selectedType,
        callableQueries,
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
  types: SourceFinalTypeQueries,
  ast: AstReader,
): SourceStandardTypeTransformation {
  const signature = lastDefined(signatures);
  if (signature === undefined) {
    return { kind: "unresolved" };
  }
  const parameters = types.signatureParameterInfos(signature).map(
    (parameter) => sourceCallableParameterEvidence(parameter, ast),
  );
  const selectedElements = types.isTuple(selectedType)
    ? types.tupleElementInfos(selectedType)
    : undefined;
  const tupleMatches = selectedElements !== undefined &&
    parameters.length === selectedElements.length &&
    parameters.every((parameter, index) => {
      const selectedElement = selectedElements[index];
      return selectedElement !== undefined &&
        types.isIdentical(parameter.type, selectedElement.type) &&
        parameterKindToTupleKind(parameter.parameterKind) ===
          selectedElement.elementKind;
    });
  const restSequenceMatches = parameters.length === 1 &&
    parameters[0]?.parameterKind === "rest" &&
    types.isIdentical(parameters[0].type, selectedType);
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
  types: SourceFinalTypeQueries &
    Pick<SourceSelectedDeclarationQueries, "signatureDeclaration">,
  ast: AstReader,
): SourceStandardTypeTransformation {
  const signature = lastDefined(signatures);
  if (signature === undefined) {
    return { kind: "unresolved" };
  }
  const result = signatureResultEvidence(signature, types, ast);
  return result !== undefined &&
      types.isIdentical(result.selectedType, selectedType)
    ? { kind: "component", component: result }
    : { kind: "unresolved" };
}

function selectThisParameterTransformation(
  signatures: readonly (Signature | undefined)[],
  selectedType: Type,
  types: SourceFinalTypeQueries,
  ast: AstReader,
): SourceStandardTypeTransformation {
  const signature = lastDefined(signatures);
  const parameter = signature === undefined
    ? undefined
    : types.signatureThisParameterInfo(signature);
  if (
    parameter === undefined ||
    !types.isIdentical(parameter.type, selectedType)
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
  types: SourceFinalTypeQueries &
    Pick<SourceSelectedDeclarationQueries, "signatureDeclaration">,
  ast: AstReader,
): SourceStandardTypeTransformation {
  const input = lastDefined(inputSignatures);
  const output = selectSourceCallableTypeEvidence(
    selectedType,
    types,
    ast,
  );
  if (input === undefined || output === undefined) {
    return { kind: "unresolved" };
  }
  const inputParameters = types.signatureParameterInfos(input).map(
    (parameter) => sourceCallableParameterEvidence(parameter, ast),
  );
  const inputResult = signatureResultEvidence(input, types, ast);
  if (
    inputResult === undefined ||
    inputParameters.length !== output.parameters.length ||
    !types.isIdentical(
      inputResult.selectedType,
      output.result.selectedType,
    ) ||
    inputParameters.some((parameter, index) =>
      parameter.parameterKind !== output.parameters[index]?.parameterKind ||
      parameter.omissionKind !== output.parameters[index]?.omissionKind ||
      !types.isIdentical(
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
  types: Pick<
    SourceFinalTypeQueries,
    | "callSignatures"
    | "signatureParameterInfos"
    | "returnType"
    | "signatureThisParameterInfo"
  > & Pick<SourceSelectedDeclarationQueries, "signatureDeclaration">,
  ast: AstReader,
): SourceCallableTypeEvidence | undefined {
  const signature = singleDefined(types.callSignatures(type));
  if (signature === undefined) {
    return undefined;
  }
  const result = signatureResultEvidence(signature, types, ast);
  return result === undefined
    ? undefined
    : Object.freeze({
        parameters: Object.freeze(
          types.signatureParameterInfos(signature).map(
            (parameter) => sourceCallableParameterEvidence(parameter, ast),
          ),
        ),
        result,
      });
}

function sourceCallableParameterEvidence(
  parameter: TypeSignatureParameterInfo,
  ast: AstReader,
): SourceCallableParameterEvidence {
  const omissionKind = parameter.parameterKind === "rest"
    ? "rest"
    : parameter.parameterKind !== "optional"
      ? "required"
      : parameter.declaration !== undefined &&
          ast.is.IsParameterDeclaration(parameter.declaration) &&
          ast.as.AsParameterDeclaration(parameter.declaration)?.Initializer !== undefined
        ? "initializer"
        : "undefined";
  return Object.freeze({ ...parameter, omissionKind });
}

function signatureResultEvidence(
  signature: Signature,
  types: Pick<SourceFinalTypeQueries, "returnType"> &
    Pick<SourceSelectedDeclarationQueries, "signatureDeclaration">,
  ast: AstReader,
): SourceTypeComponentEvidence | undefined {
  const selectedType = types.returnType(signature);
  if (selectedType === undefined) {
    return undefined;
  }
  const declaration = types.signatureDeclaration(signature);
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
