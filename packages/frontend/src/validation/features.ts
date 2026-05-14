import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
  type Diagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import { capability } from "../capabilities/backend-capabilities.js";
import {
  resolveSurfaceCapabilities,
  surfaceIncludesJs,
} from "../surface/profiles.js";
import { getJsDiagnosticSurfaceMetadata } from "../surface/diagnostic-metadata.js";
import { isSupportedObjectLiteralMethodArgumentsReference } from "../object-literal-method-runtime.js";

const createBackendCapabilityDiagnostic = (
  program: TsonicProgram,
  capabilityName: string,
  fallback: Diagnostic
): Diagnostic => {
  const backendCapability = capability(
    program.options.backendCapabilities,
    capabilityName
  );
  return {
    ...fallback,
    code: backendCapability?.diagnosticCode ?? fallback.code,
    message: backendCapability?.diagnosticMessage ?? fallback.message,
    hint: backendCapability?.remediation ?? fallback.hint,
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

const isDynamicImportCall = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

const isGlobalThisIdentifier = (node: ts.Node): node is ts.Identifier =>
  ts.isIdentifier(node) && node.text === "globalThis";

const getStaticInOperatorKey = (node: ts.Expression): string | undefined => {
  if (ts.isStringLiteralLike(node)) {
    return node.text;
  }

  return undefined;
};

const typeHasStringIndex = (
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.Type> = new Set<ts.Type>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);

  if (type.isUnion()) {
    return type.types
      .filter(
        (member) =>
          (member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) === 0
      )
      .every((member) =>
        typeHasStringIndex(member, checker, new Set(nextSeen))
      );
  }

  const apparent = checker.getApparentType(type);
  return (
    checker.getIndexInfoOfType(type, ts.IndexKind.String) !== undefined ||
    checker.getIndexInfoOfType(apparent, ts.IndexKind.String) !== undefined
  );
};

const isClosedInOperatorExpression = (
  node: ts.BinaryExpression,
  checker: ts.TypeChecker
): boolean => {
  const key = getStaticInOperatorKey(node.left);
  if (!key) {
    return false;
  }

  return typeHasStringIndex(checker.getTypeAtLocation(node.right), checker);
};

const normalizeFileName = (fileName: string): string =>
  fileName.replace(/\\/g, "/");

const isLengthElementAccess = (
  node: ts.ElementAccessExpression | ts.ElementAccessChain
): boolean =>
  ts.isStringLiteralLike(node.argumentExpression) &&
  node.argumentExpression.text === "length";

const getLengthAccessReceiver = (node: ts.Node): ts.Expression | undefined => {
  if (
    (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) &&
    node.name.text === "length"
  ) {
    return node.expression;
  }

  if (
    (ts.isElementAccessExpression(node) || ts.isElementAccessChain(node)) &&
    isLengthElementAccess(node)
  ) {
    return node.expression;
  }

  return undefined;
};

const isFunctionLikeType = (
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.Type> = new Set<ts.Type>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);

  if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) {
    return true;
  }

  return type.isUnionOrIntersection()
    ? type.types.some((member) => isFunctionLikeType(member, checker, nextSeen))
    : false;
};

const isProgramSourceDeclaration = (
  declaration: ts.Declaration,
  program: TsonicProgram
): boolean => {
  const sourceNames = new Set(
    program.sourceFiles.map((currentSourceFile) =>
      normalizeFileName(currentSourceFile.fileName)
    )
  );
  return sourceNames.has(
    normalizeFileName(declaration.getSourceFile().fileName)
  );
};

const isSourceOwnedMemberAccess = (
  nameNode: ts.Node,
  program: TsonicProgram
): boolean => {
  const symbol = program.checker.getSymbolAtLocation(nameNode);
  return (
    symbol?.declarations?.some((declaration) =>
      isProgramSourceDeclaration(declaration, program)
    ) ?? false
  );
};

const isAmbientIdentifier = (
  identifier: ts.Identifier,
  program: TsonicProgram
): boolean => {
  const symbol = program.checker.getSymbolAtLocation(identifier);
  if (!symbol || !symbol.declarations || symbol.declarations.length === 0) {
    return true;
  }

  return !symbol.declarations.some((declaration) =>
    isProgramSourceDeclaration(declaration, program)
  );
};

const isStringLikeType = (type: ts.Type): boolean =>
  (type.flags &
    (ts.TypeFlags.String |
      ts.TypeFlags.StringLiteral |
      ts.TypeFlags.StringLike)) !==
  0;

const isJsBuiltinReceiverType = (
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: ReadonlySet<ts.Type> = new Set<ts.Type>()
): boolean => {
  if (seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  const apparent = checker.getApparentType(type);

  if (apparent.isUnionOrIntersection()) {
    return apparent.types.every((member) =>
      isJsBuiltinReceiverType(member, checker, nextSeen)
    );
  }

  if (checker.isArrayType(apparent) || checker.isTupleType(apparent)) {
    return true;
  }

  if (isStringLikeType(apparent)) {
    return true;
  }

  const symbolName = apparent.getSymbol()?.getName();
  return symbolName ? JS_TYPED_ARRAY_SYMBOL_NAME_SET.has(symbolName) : false;
};

const getNonJsMemberAccess = (
  node: ts.Node,
  checker: ts.TypeChecker,
  program: TsonicProgram
): { readonly name: string; readonly receiverText: string } | undefined => {
  let receiver: ts.Expression | undefined;
  let nameNode: ts.Node | undefined;
  let memberName: string | undefined;

  if (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) {
    receiver = node.expression;
    nameNode = node.name;
    memberName = node.name.text;
  } else if (
    ts.isElementAccessExpression(node) ||
    ts.isElementAccessChain(node)
  ) {
    if (!ts.isStringLiteralLike(node.argumentExpression)) return undefined;
    receiver = node.expression;
    nameNode = node.argumentExpression;
    memberName = node.argumentExpression.text;
  }

  if (!receiver || !nameNode || !memberName) return undefined;
  if (!JS_BUILTIN_MEMBER_NAME_SET.has(memberName)) return undefined;
  if (isSourceOwnedMemberAccess(nameNode, program)) return undefined;
  if (!isJsBuiltinReceiverType(checker.getTypeAtLocation(receiver), checker)) {
    return undefined;
  }

  return { name: memberName, receiverText: receiver.getText() };
};

const getNonJsElementAccess = (
  node: ts.Node,
  checker: ts.TypeChecker
): { readonly name: string; readonly receiverText: string } | undefined => {
  if (!(ts.isElementAccessExpression(node) || ts.isElementAccessChain(node))) {
    return undefined;
  }

  const argument = node.argumentExpression;
  if (
    !argument ||
    (!ts.isNumericLiteral(argument) && !ts.isPrefixUnaryExpression(argument))
  ) {
    return undefined;
  }

  if (!isStringLikeType(checker.getTypeAtLocation(node.expression))) {
    return undefined;
  }

  return { name: "string index", receiverText: node.expression.getText() };
};

const isIdentifierReference = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (!parent) return true;

  if (
    (ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAccessChain(parent)) &&
    parent.name === node
  ) {
    return false;
  }

  if (
    (ts.isPropertyAssignment(parent) ||
      ts.isShorthandPropertyAssignment(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent)) &&
    parent.name === node
  ) {
    return false;
  }

  if (
    (ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodSignature(parent)) &&
    parent.name === node
  ) {
    return false;
  }

  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) {
    return false;
  }

  if (ts.isBindingElement(parent) && parent.propertyName === node) {
    return false;
  }

  return true;
};

const getNonJsGlobalApiCall = (
  node: ts.CallExpression,
  program: TsonicProgram
): string | undefined => {
  if (ts.isIdentifier(node.expression)) {
    if (
      JS_AMBIENT_GLOBAL_FUNCTION_SET.has(node.expression.text) &&
      isAmbientIdentifier(node.expression, program)
    ) {
      return `${node.expression.text}(...)`;
    }
    return undefined;
  }

  if (!ts.isPropertyAccessExpression(node.expression)) {
    return undefined;
  }

  const object = node.expression.expression;
  const member = node.expression.name.text;
  if (!ts.isIdentifier(object)) {
    return undefined;
  }

  const allowedMembers = JS_DIAGNOSTIC_SURFACE.ambientGlobalCalls[object.text];
  if (!allowedMembers?.includes(member)) {
    return undefined;
  }

  return isAmbientIdentifier(object, program)
    ? `${object.text}.${member}(...)`
    : undefined;
};

const getNonJsGlobalConstructorCall = (
  node: ts.NewExpression,
  program: TsonicProgram
): string | undefined => {
  if (
    ts.isIdentifier(node.expression) &&
    JS_AMBIENT_GLOBAL_FUNCTION_SET.has(node.expression.text) &&
    isAmbientIdentifier(node.expression, program)
  ) {
    return `new ${node.expression.text}(...)`;
  }

  return undefined;
};

const isUnsupportedFunctionLengthAccess = (
  node: ts.Node,
  checker: ts.TypeChecker
): boolean => {
  const receiver = getLengthAccessReceiver(node);
  if (!receiver) {
    return false;
  }

  return isFunctionLikeType(checker.getTypeAtLocation(receiver), checker);
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  return (
    ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false
  );
};

const hasAnyModifier = (
  node: ts.Node,
  kinds: ReadonlySet<ts.SyntaxKind>
): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  return (
    ts.getModifiers(node)?.some((modifier) => kinds.has(modifier.kind)) ?? false
  );
};

const RUNTIME_CLASS_ACCESSIBILITY_MODIFIERS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PublicKeyword,
  ts.SyntaxKind.PrivateKeyword,
  ts.SyntaxKind.ProtectedKeyword,
]);

const RUNTIME_CLASS_ONLY_MODIFIERS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AbstractKeyword,
]);

const PARAMETER_PROPERTY_MODIFIERS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.PublicKeyword,
  ts.SyntaxKind.PrivateKeyword,
  ts.SyntaxKind.ProtectedKeyword,
  ts.SyntaxKind.ReadonlyKeyword,
]);

const isAmbientOrDeclarationNode = (node: ts.Node): boolean => {
  if (node.getSourceFile().isDeclarationFile) return true;

  let current: ts.Node | undefined = node;
  while (current) {
    if (hasModifier(current, ts.SyntaxKind.DeclareKeyword)) return true;
    current = current.parent;
  }

  return false;
};

const getUnsupportedRuntimeClassModifier = (
  node: ts.ClassDeclaration | ts.ClassElement
): string | undefined => {
  if (isAmbientOrDeclarationNode(node)) return undefined;

  if (hasModifier(node, ts.SyntaxKind.AbstractKeyword)) return "abstract";
  if (hasModifier(node, ts.SyntaxKind.PublicKeyword)) return "public";
  if (hasModifier(node, ts.SyntaxKind.PrivateKeyword)) return "private";
  if (hasModifier(node, ts.SyntaxKind.ProtectedKeyword)) return "protected";
  if (
    ts.isPropertyDeclaration(node) &&
    hasModifier(node, ts.SyntaxKind.ReadonlyKeyword)
  ) {
    return "readonly";
  }

  return undefined;
};

const hasUnsupportedParameterPropertyModifier = (
  node: ts.ParameterDeclaration
): boolean =>
  !isAmbientOrDeclarationNode(node) &&
  hasAnyModifier(node, PARAMETER_PROPERTY_MODIFIERS);

export const validateUnsupportedFeatures = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  let currentCollector = collector;
  const checker = program.checker;
  const surfaceCapabilities =
    program.surfaceCapabilities ??
    resolveSurfaceCapabilities(program.options.surface, {
      projectRoot: program.options.projectRoot,
      authoritativePackageRoots: program.authoritativeTsonicPackageRoots,
    });
  const hasJsSurface = surfaceIncludesJs(surfaceCapabilities);

  const addUnsupported = (
    node: ts.Node,
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

  const visitor = (node: ts.Node): void => {
    if (ts.isWithStatement(node)) {
      addUnsupported(
        node,
        "'with' statement is not supported in strict NativeAOT mode.",
        "Use explicit lexical names."
      );
    }

    if (ts.isForInStatement(node)) {
      addUnsupported(
        node,
        "'for...in' is not supported in emitted Tsonic code.",
        "Iterate a concrete collection explicitly, for example over dictionary.Keys."
      );
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.InKeyword
    ) {
      if (!isClosedInOperatorExpression(node, checker)) {
        addUnsupported(
          node,
          "The JavaScript 'in' operator is only supported for statically proven string-key carriers.",
          "Use a string-literal key with a string-indexed dictionary carrier. Declared object properties do not provide JavaScript own-property existence semantics in emitted NativeAOT code."
        );
      }
    }

    if (ts.isMetaProperty(node)) {
      addUnsupported(
        node,
        "import.meta is not supported in emitted Tsonic code.",
        "Pass paths and environment data through explicit typed APIs."
      );
    }

    if (ts.isCallExpression(node) && isDynamicImportCall(node)) {
      addUnsupported(
        node,
        "Dynamic import() is not supported in emitted Tsonic code.",
        "Use static ESM import declarations."
      );
    }

    if (isGlobalThisIdentifier(node)) {
      addUnsupported(
        node,
        "globalThis is not supported in emitted Tsonic code.",
        "Use explicit imports or typed parameters."
      );
    }

    if (ts.isDeleteExpression(node)) {
      addUnsupported(
        node,
        "The JavaScript delete operator is not supported in emitted Tsonic code.",
        "Call a concrete API such as Dictionary.Remove explicitly."
      );
    }

    if (
      (ts.isClassDeclaration(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      (hasAnyModifier(node, RUNTIME_CLASS_ACCESSIBILITY_MODIFIERS) ||
        hasAnyModifier(node, RUNTIME_CLASS_ONLY_MODIFIERS) ||
        (ts.isPropertyDeclaration(node) &&
          hasModifier(node, ts.SyntaxKind.ReadonlyKeyword)))
    ) {
      const modifierName = getUnsupportedRuntimeClassModifier(node);
      if (modifierName) {
        addUnsupported(
          node,
          `TypeScript class modifier '${modifierName}' is not supported in emitted Tsonic code.`,
          "Use standard JavaScript class syntax. Omitted class-member accessibility is public; use ECMAScript #private fields for private runtime state."
        );
      }
    }

    if (ts.isParameter(node) && hasUnsupportedParameterPropertyModifier(node)) {
      addUnsupported(
        node,
        "TypeScript constructor parameter properties are not supported in emitted Tsonic code.",
        "Declare a standard class field and assign it explicitly inside the constructor body."
      );
    }

    if (!hasJsSurface) {
      const memberAccess = getNonJsMemberAccess(node, checker, program);
      if (memberAccess) {
        addUnsupported(
          node,
          `JavaScript surface member '${memberAccess.name}' is not available in the active surface.`,
          `Use a member declared by the receiver type, or compile with a surface that provides JavaScript APIs.`
        );
      }

      const elementAccess = getNonJsElementAccess(node, checker);
      if (elementAccess) {
        addUnsupported(
          node,
          `JavaScript surface member '${elementAccess.name}' is not available in the active surface.`,
          "Use an explicit CLR/domain API, or compile with a surface that provides JavaScript APIs."
        );
      }

      if (ts.isCallExpression(node)) {
        const globalApi = getNonJsGlobalApiCall(node, program);
        if (globalApi) {
          addUnsupported(
            node,
            `JavaScript surface API '${globalApi}' is not available in the active surface.`,
            "Use an explicit CLR/domain API, or compile with a surface that provides JavaScript APIs."
          );
        }
      }

      if (ts.isNewExpression(node)) {
        const globalApi = getNonJsGlobalConstructorCall(node, program);
        if (globalApi) {
          addUnsupported(
            node,
            `JavaScript surface API '${globalApi}' is not available in the active surface.`,
            "Use an explicit CLR/domain API, or compile with a surface that provides JavaScript APIs."
          );
        }
      }
    }

    if (
      ts.isIdentifier(node) &&
      node.text === "arguments" &&
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

    if (isUnsupportedFunctionLengthAccess(node, checker)) {
      currentCollector = addDiagnostic(
        currentCollector,
        createBackendCapabilityDiagnostic(
          program,
          "function-length",
          createDiagnostic(
            "TSN5001",
            "error",
            "JavaScript function.length is not supported in emitted Tsonic code.",
            getNodeLocation(sourceFile, node),
            "Model handler shape with explicit tagged types or separate APIs."
          )
        )
      );
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return currentCollector;
};
