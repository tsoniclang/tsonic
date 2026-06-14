import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  forEachTstsChild,
  getTstsContainingSourceFileName,
  hasTstsAbstractModifier,
  hasTstsAmbientModifier,
  hasTstsParameterPropertyModifier,
  hasTstsPublicModifier,
  isTstsDeclarationFileNode,
  TstsSyntax,
} from "@tsonic/tsts";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
  type Diagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import {
  capability,
  isCapabilityUnavailable,
  type FeatureKey,
} from "../capabilities/backend-capabilities.js";
import {
  resolveSurfaceCapabilities,
  surfaceIncludesJs,
} from "../surface/profiles.js";
import { getJsDiagnosticSurfaceMetadata } from "../surface/diagnostic-metadata.js";
import { isSupportedObjectLiteralMethodArgumentsReference } from "./object-literal-method-runtime.js";
import type { TstsFrontendSourceSemanticView } from "../source-frontend/index.js";
import { getProgramSourceFiles } from "../program/queries.js";
import {
  identifierText,
  isIdentifier,
  isIdentifierNamed,
  isStringLiteralLike,
  type SourceType,
} from "./tsts-helpers.js";

const createBackendCapabilityDiagnostic = (
  program: TsonicProgram,
  capabilityName: FeatureKey,
  baseDiagnostic: Diagnostic
): Diagnostic | undefined => {
  if (
    !isCapabilityUnavailable(
      program.options.backendCapabilities,
      capabilityName
    )
  ) {
    return undefined;
  }
  const backendCapability = capability(
    program.options.backendCapabilities,
    capabilityName
  );
  return {
    ...baseDiagnostic,
    code: backendCapability?.diagnosticCode ?? baseDiagnostic.code,
    message: backendCapability?.diagnosticMessage ?? baseDiagnostic.message,
    hint: backendCapability?.remediation ?? baseDiagnostic.hint,
  };
};

const JS_DIAGNOSTIC_SURFACE = getJsDiagnosticSurfaceMetadata();
const JS_BUILTIN_MEMBER_NAME_SET = new Set(
  JS_DIAGNOSTIC_SURFACE.builtinMemberNames
);
const JS_AMBIENT_GLOBAL_FUNCTION_SET = new Set(
  JS_DIAGNOSTIC_SURFACE.ambientGlobalFunctions
);
const JS_TYPED_ARRAY_SYMBOL_NAME_SET = new Set(
  JS_DIAGNOSTIC_SURFACE.typedArraySymbolNames
);

const isDynamicImportCall = (node: TstsNode): boolean =>
  TstsSyntax.AsCallExpression(node)?.Expression?.Kind ===
  TstsSyntax.KindImportKeyword;

const isUnsupportedGlobalThisIdentifier = (
  node: TstsNode,
  program: TsonicProgram
): boolean => {
  if (!isIdentifierNamed(node, "globalThis")) {
    return false;
  }

  const symbol = program.sourceSemantics.getSymbol(node);
  if (!symbol) {
    return true;
  }

  return !program.sourceSemantics
    .getSymbolDeclarations(symbol)
    .some((declaration) => isProgramSourceDeclaration(declaration, program));
};

const getStaticInOperatorKey = (node: TstsNode | undefined): string | undefined =>
  isStringLiteralLike(node) ? TstsSyntax.Node_Text(node) : undefined;

const typeHasStringIndex = (
  type: SourceType,
  sourceSemantics: TstsFrontendSourceSemanticView,
  seen: ReadonlySet<SourceType> = new Set<SourceType>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);

  const unionMembers = sourceSemantics.getNonNullishUnionMembers(type);
  if (unionMembers) {
    return unionMembers.every((member) =>
      typeHasStringIndex(member, sourceSemantics, new Set(nextSeen))
    );
  }

  const apparent = sourceSemantics.getApparentType(type);
  return (
    sourceSemantics.getStringIndexType(type) !== undefined ||
    sourceSemantics.getStringIndexType(apparent) !== undefined
  );
};

const typeHasDeclaredProperty = (
  type: SourceType,
  key: string,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean =>
  sourceSemantics.getPropertyOfType(type, key) !== undefined ||
  sourceSemantics.getPropertyOfType(
    sourceSemantics.getApparentType(type),
    key
  ) !== undefined;

const isClosedStructuralPropertyUnion = (
  type: SourceType,
  key: string,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const members = sourceSemantics.getNonNullishUnionMembers(type);
  if (!members || members.length < 2) {
    return false;
  }

  const hasKey = members.map((member) =>
    typeHasDeclaredProperty(member, key, sourceSemantics)
  );
  return hasKey.some(Boolean) && hasKey.some((present) => !present);
};

const isClosedInOperatorExpression = (
  node: TstsNode,
  program: TsonicProgram
): boolean => {
  const binary = TstsSyntax.AsBinaryExpression(node);
  const key = getStaticInOperatorKey(binary?.Left);
  if (!key || !binary?.Right) {
    return false;
  }

  const rightType = program.sourceSemantics.getExpressionType(binary.Right);
  return (
    typeHasStringIndex(rightType, program.sourceSemantics) ||
    isClosedStructuralPropertyUnion(rightType, key, program.sourceSemantics)
  );
};

const isClosedForInStatement = (
  node: TstsNode,
  program: TsonicProgram
): boolean => {
  const expression = TstsSyntax.AsForInOrOfStatement(node)?.Expression;
  return expression
    ? typeHasStringIndex(
        program.sourceSemantics.getExpressionType(expression),
        program.sourceSemantics
      )
    : false;
};

const normalizeFileName = (fileName: string): string =>
  fileName.replace(/\\/g, "/");

const isLengthElementAccess = (node: TstsNode): boolean => {
  const argument = TstsSyntax.AsElementAccessExpression(node)?.ArgumentExpression;
  return isStringLiteralLike(argument) && TstsSyntax.Node_Text(argument) === "length";
};

const getLengthAccessReceiver = (node: TstsNode): TstsNode | undefined => {
  if (node.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const access = TstsSyntax.AsPropertyAccessExpression(node);
    if (identifierText(access?.name) === "length") {
      return access?.Expression;
    }
  }

  if (
    node.Kind === TstsSyntax.KindElementAccessExpression &&
    isLengthElementAccess(node)
  ) {
    return TstsSyntax.AsElementAccessExpression(node)?.Expression;
  }

  return undefined;
};

const isFunctionLikeType = (
  type: SourceType,
  sourceSemantics: TstsFrontendSourceSemanticView,
  seen: ReadonlySet<SourceType> = new Set<SourceType>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);

  if (sourceSemantics.getCallSignatures(type).length > 0) {
    return true;
  }

  return (
    sourceSemantics
      .getUnionOrIntersectionMembers(type)
      ?.some((member) =>
        isFunctionLikeType(member, sourceSemantics, nextSeen)
      ) ?? false
  );
};

const isProgramSourceDeclaration = (
  declaration: TstsNode,
  program: TsonicProgram
): boolean => {
  const sourceNames = new Set(
    getProgramSourceFiles(program).map((currentSourceFile) =>
      normalizeFileName(currentSourceFile.FileName())
    )
  );
  const fileName = getTstsContainingSourceFileName(declaration);
  return fileName ? sourceNames.has(normalizeFileName(fileName)) : false;
};

const isSourceOwnedMemberAccess = (
  nameNode: TstsNode,
  program: TsonicProgram
): boolean => {
  const symbol = program.sourceSemantics.getSymbol(nameNode);
  return symbol
    ? program.sourceSemantics
        .getSymbolDeclarations(symbol)
        .some((declaration) => isProgramSourceDeclaration(declaration, program))
    : false;
};

const isAmbientIdentifier = (
  identifier: TstsNode,
  program: TsonicProgram
): boolean => {
  const symbol = program.sourceSemantics.getSymbol(identifier);
  if (
    !symbol ||
    program.sourceSemantics.getSymbolDeclarations(symbol).length === 0
  ) {
    return true;
  }

  return !program.sourceSemantics
    .getSymbolDeclarations(symbol)
    .some((declaration) => isProgramSourceDeclaration(declaration, program));
};

const isJsBuiltinReceiverType = (
  type: SourceType,
  sourceSemantics: TstsFrontendSourceSemanticView,
  seen: ReadonlySet<SourceType> = new Set<SourceType>()
): boolean => {
  if (seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  const apparent = sourceSemantics.getApparentType(type);

  const members = sourceSemantics.getUnionOrIntersectionMembers(apparent);
  if (members) {
    return members.every((member) =>
      isJsBuiltinReceiverType(member, sourceSemantics, nextSeen)
    );
  }

  if (
    sourceSemantics.isArrayType(apparent) ||
    sourceSemantics.isTupleType(apparent)
  ) {
    return true;
  }

  if (sourceSemantics.isStringLikeType(apparent)) {
    return true;
  }

  const symbolName = sourceSemantics.getTypeSymbolName(apparent);
  return symbolName ? JS_TYPED_ARRAY_SYMBOL_NAME_SET.has(symbolName) : false;
};

const getNonJsMemberAccess = (
  node: TstsNode,
  program: TsonicProgram
): { readonly name: string } | undefined => {
  let receiver: TstsNode | undefined;
  let nameNode: TstsNode | undefined;
  let memberName: string | undefined;

  if (node.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const access = TstsSyntax.AsPropertyAccessExpression(node);
    receiver = access?.Expression;
    nameNode = access?.name;
    memberName = identifierText(access?.name);
  } else if (node.Kind === TstsSyntax.KindElementAccessExpression) {
    const access = TstsSyntax.AsElementAccessExpression(node);
    if (!isStringLiteralLike(access?.ArgumentExpression)) return undefined;
    receiver = access?.Expression;
    nameNode = access?.ArgumentExpression;
    memberName = access?.ArgumentExpression
      ? TstsSyntax.Node_Text(access.ArgumentExpression)
      : undefined;
  }

  if (!receiver || !nameNode || !memberName) return undefined;
  if (!JS_BUILTIN_MEMBER_NAME_SET.has(memberName)) return undefined;
  if (isSourceOwnedMemberAccess(nameNode, program)) return undefined;
  if (
    !isJsBuiltinReceiverType(
      program.sourceSemantics.getExpressionType(receiver),
      program.sourceSemantics
    )
  ) {
    return undefined;
  }

  return { name: memberName };
};

const getNonJsElementAccess = (
  node: TstsNode,
  program: TsonicProgram
): { readonly name: string } | undefined => {
  if (node.Kind !== TstsSyntax.KindElementAccessExpression) {
    return undefined;
  }

  const access = TstsSyntax.AsElementAccessExpression(node);
  const argument = access?.ArgumentExpression;
  if (
    !access?.Expression ||
    !argument ||
    (argument.Kind !== TstsSyntax.KindNumericLiteral &&
      argument.Kind !== TstsSyntax.KindPrefixUnaryExpression)
  ) {
    return undefined;
  }

  if (
    !program.sourceSemantics.isStringLikeType(
      program.sourceSemantics.getExpressionType(access.Expression)
    )
  ) {
    return undefined;
  }

  return { name: "string index" };
};

const isIdentifierReference = (node: TstsNode): boolean => {
  const parent = node.Parent;
  if (!parent) return true;

  if (
    parent.Kind === TstsSyntax.KindPropertyAccessExpression &&
    TstsSyntax.AsPropertyAccessExpression(parent)?.name === node
  ) {
    return false;
  }

  if (
    (parent.Kind === TstsSyntax.KindPropertyAssignment ||
      parent.Kind === TstsSyntax.KindShorthandPropertyAssignment ||
      parent.Kind === TstsSyntax.KindMethodDeclaration ||
      parent.Kind === TstsSyntax.KindGetAccessor ||
      parent.Kind === TstsSyntax.KindSetAccessor) &&
    TstsSyntax.Node_Name(parent) === node
  ) {
    return false;
  }

  if (
    (parent.Kind === TstsSyntax.KindPropertySignature ||
      parent.Kind === TstsSyntax.KindPropertyDeclaration ||
      parent.Kind === TstsSyntax.KindMethodSignature) &&
    TstsSyntax.Node_Name(parent) === node
  ) {
    return false;
  }

  if (
    parent.Kind === TstsSyntax.KindImportSpecifier ||
    parent.Kind === TstsSyntax.KindExportSpecifier
  ) {
    return false;
  }

  if (
    parent.Kind === TstsSyntax.KindBindingElement &&
    TstsSyntax.AsBindingElement(parent)?.PropertyName === node
  ) {
    return false;
  }

  return true;
};

const getNonJsGlobalApiCall = (
  node: TstsNode,
  program: TsonicProgram
): string | undefined => {
  const expression = TstsSyntax.AsCallExpression(node)?.Expression;
  const calleeName = identifierText(expression);
  if (calleeName) {
    if (
      JS_AMBIENT_GLOBAL_FUNCTION_SET.has(calleeName) &&
      expression &&
      isAmbientIdentifier(expression, program)
    ) {
      return `${calleeName}(...)`;
    }
    return undefined;
  }

  if (expression?.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return undefined;
  }

  const access = TstsSyntax.AsPropertyAccessExpression(expression);
  const object = access?.Expression;
  const objectName = identifierText(object);
  const member = identifierText(access?.name);
  if (!object || !objectName || !member) {
    return undefined;
  }

  const allowedMembers = JS_DIAGNOSTIC_SURFACE.ambientGlobalCalls[objectName];
  if (!allowedMembers?.includes(member)) {
    return undefined;
  }

  return isAmbientIdentifier(object, program)
    ? `${objectName}.${member}(...)`
    : undefined;
};

const getNonJsGlobalConstructorCall = (
  node: TstsNode,
  program: TsonicProgram
): string | undefined => {
  const expression = TstsSyntax.AsNewExpression(node)?.Expression;
  const name = identifierText(expression);
  if (
    expression &&
    name &&
    JS_AMBIENT_GLOBAL_FUNCTION_SET.has(name) &&
    isAmbientIdentifier(expression, program)
  ) {
    return `new ${name}(...)`;
  }

  return undefined;
};

const isUnsupportedFunctionLengthAccess = (
  node: TstsNode,
  program: TsonicProgram
): boolean => {
  const receiver = getLengthAccessReceiver(node);
  if (!receiver) {
    return false;
  }

  if (
    !isFunctionLikeType(
      program.sourceSemantics.getExpressionType(receiver),
      program.sourceSemantics
    )
  ) {
    return false;
  }

  if (
    node.Kind === TstsSyntax.KindPropertyAccessExpression &&
    TstsSyntax.AsPropertyAccessExpression(node)?.QuestionDotToken !== undefined
  ) {
    return true;
  }

  return (
    !isIdentifier(receiver) && receiver.Kind !== TstsSyntax.KindThisKeyword
  );
};

const isAmbientOrDeclarationNode = (node: TstsNode): boolean => {
  if (isTstsDeclarationFileNode(node)) return true;

  let current: TstsNode | undefined = node;
  while (current) {
    if (hasTstsAmbientModifier(current)) return true;
    current = current.Parent;
  }

  return false;
};

const getUnsupportedRuntimeClassModifier = (
  node: TstsNode
): string | undefined => {
  if (isAmbientOrDeclarationNode(node)) return undefined;

  if (
    node.Kind !== TstsSyntax.KindClassDeclaration &&
    hasTstsAbstractModifier(node)
  ) {
    return "abstract";
  }

  return undefined;
};

const hasUnsupportedParameterPropertyModifier = (node: TstsNode): boolean =>
  !isAmbientOrDeclarationNode(node) && hasTstsParameterPropertyModifier(node);

const hasUnsupportedClassModifier = (node: TstsNode): boolean =>
  hasTstsPublicModifier(node) || hasTstsAbstractModifier(node);

const isClassOrClassElement = (node: TstsNode): boolean => {
  switch (node.Kind) {
    case TstsSyntax.KindClassDeclaration:
    case TstsSyntax.KindPropertyDeclaration:
    case TstsSyntax.KindMethodDeclaration:
    case TstsSyntax.KindConstructor:
    case TstsSyntax.KindGetAccessor:
    case TstsSyntax.KindSetAccessor:
      return true;
    default:
      return false;
  }
};

export const validateUnsupportedFeatures = (
  sourceFile: TstsSourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  let currentCollector = collector;
  const surfaceCapabilities =
    program.surfaceCapabilities ??
    resolveSurfaceCapabilities(program.options.surface, {
      projectRoot: program.options.projectRoot,
      authoritativePackageRoots: program.authoritativeTsonicPackageRoots,
    });
  const hasJsSurface = surfaceIncludesJs(surfaceCapabilities);

  const addUnsupported = (
    node: TstsNode,
    message: string,
    suggestion: string
  ): void => {
    currentCollector = addDiagnostic(
      currentCollector,
      createDiagnostic(
        "TSN2001",
        "error",
        message,
        getNodeLocation(sourceFile, node),
        suggestion
      )
    );
  };

  const visitor = (node: TstsNode | undefined): void => {
    if (!node) return;

    if (node.Kind === TstsSyntax.KindWithStatement) {
      addUnsupported(
        node,
        "'with' statement is not supported in deterministic native-safe mode.",
        "Use explicit lexical names."
      );
    }

    if (
      node.Kind === TstsSyntax.KindForInStatement &&
      !isClosedForInStatement(node, program)
    ) {
      addUnsupported(
        node,
        "'for...in' is only supported for statically proven string-key carriers.",
        "Use for...in only over Record<string, T> or another closed string-indexed dictionary carrier."
      );
    }

    if (node.Kind === TstsSyntax.KindBinaryExpression) {
      const binary = TstsSyntax.AsBinaryExpression(node);
      if (binary?.OperatorToken?.Kind === TstsSyntax.KindInKeyword) {
        if (!isClosedInOperatorExpression(node, program)) {
          addUnsupported(
            node,
            "The JavaScript 'in' operator is only supported for statically proven string-key carriers.",
            "Use a string-literal key with a string-indexed dictionary carrier, or a closed structural union where that key statically selects one or more arms."
          );
        }
      }
    }

    if (node.Kind === TstsSyntax.KindMetaProperty) {
      addUnsupported(
        node,
        "import.meta is not supported in emitted Tsonic code.",
        "Pass paths and environment data through explicit typed APIs."
      );
    }

    if (node.Kind === TstsSyntax.KindCallExpression && isDynamicImportCall(node)) {
      addUnsupported(
        node,
        "Dynamic import() is not supported in emitted Tsonic code.",
        "Use static ESM import declarations."
      );
    }

    if (isUnsupportedGlobalThisIdentifier(node, program)) {
      addUnsupported(
        node,
        "globalThis is not supported in emitted Tsonic code.",
        "Use explicit imports or typed parameters."
      );
    }

    if (node.Kind === TstsSyntax.KindDeleteExpression) {
      addUnsupported(
        node,
        "The JavaScript delete operator is not supported in emitted Tsonic code.",
        "Call a concrete API such as Dictionary.Remove explicitly."
      );
    }

    if (isClassOrClassElement(node) && hasUnsupportedClassModifier(node)) {
      const modifierName = getUnsupportedRuntimeClassModifier(node);
      if (modifierName) {
        addUnsupported(
          node,
          `TypeScript class modifier '${modifierName}' is not supported in emitted Tsonic code.`,
          "Use standard JavaScript class syntax. Omitted class-member accessibility is public; use ECMAScript #private fields for private runtime state."
        );
      }
    }

    if (
      node.Kind === TstsSyntax.KindParameter &&
      hasUnsupportedParameterPropertyModifier(node)
    ) {
      addUnsupported(
        node,
        "TypeScript constructor parameter properties are not supported in emitted Tsonic code.",
        "Declare a standard class field and assign it explicitly inside the constructor body."
      );
    }

    if (!hasJsSurface) {
      const memberAccess = getNonJsMemberAccess(node, program);
      if (memberAccess) {
        addUnsupported(
          node,
          `JavaScript surface member '${memberAccess.name}' is not available in the active surface.`,
          "Use a member declared by the receiver type, or compile with a surface that provides JavaScript APIs."
        );
      }

      const elementAccess = getNonJsElementAccess(node, program);
      if (elementAccess) {
        addUnsupported(
          node,
          `JavaScript surface member '${elementAccess.name}' is not available in the active surface.`,
          "Use an explicit domain/native API, or compile with a surface that provides JavaScript APIs."
        );
      }

      if (node.Kind === TstsSyntax.KindCallExpression) {
        const globalApi = getNonJsGlobalApiCall(node, program);
        if (globalApi) {
          addUnsupported(
            node,
            `JavaScript surface API '${globalApi}' is not available in the active surface.`,
            "Use an explicit domain/native API, or compile with a surface that provides JavaScript APIs."
          );
        }
      }

      if (node.Kind === TstsSyntax.KindNewExpression) {
        const globalApi = getNonJsGlobalConstructorCall(node, program);
        if (globalApi) {
          addUnsupported(
            node,
            `JavaScript surface API '${globalApi}' is not available in the active surface.`,
            "Use an explicit domain/native API, or compile with a surface that provides JavaScript APIs."
          );
        }
      }
    }

    if (
      isIdentifierNamed(node, "arguments") &&
      !isAmbientOrDeclarationNode(node) &&
      isIdentifierReference(node) &&
      !isSupportedObjectLiteralMethodArgumentsReference(node)
    ) {
      addUnsupported(
        node,
        "JavaScript 'arguments' is not supported in emitted Tsonic code.",
        "Use explicit parameters or rest parameters."
      );
    }

    if (isUnsupportedFunctionLengthAccess(node, program)) {
      const diagnostic = createBackendCapabilityDiagnostic(
        program,
        "dynamic-function-arity-introspection",
        createDiagnostic(
          "TSN5001",
          "error",
          "JavaScript function.length requires a statically proven function carrier.",
          getNodeLocation(sourceFile, node),
          "Use function.length only on identifiers or this-bound functions whose callable type is known at compile time."
        )
      );
      if (diagnostic) {
        currentCollector = addDiagnostic(currentCollector, diagnostic);
      }
    }

    forEachTstsChild(node, visitor);
  };

  visitor(sourceFile);
  return currentCollector;
};
