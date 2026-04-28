import * as ts from "typescript";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "../types/diagnostic.js";
import { getNodeLocation } from "./helpers.js";
import {
  resolveSurfaceCapabilities,
  surfaceIncludesJs,
} from "../surface/profiles.js";

const JS_BUILTIN_MEMBER_NAMES = new Set([
  "length",
  "slice",
  "map",
  "filter",
  "some",
  "every",
  "reduce",
  "reduceRight",
  "find",
  "findIndex",
  "forEach",
  "includes",
  "indexOf",
  "lastIndexOf",
  "join",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "concat",
  "flat",
  "flatMap",
  "charAt",
  "charCodeAt",
  "codePointAt",
  "startsWith",
  "endsWith",
  "trim",
  "trimStart",
  "trimEnd",
  "toLowerCase",
  "toUpperCase",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "split",
  "substring",
  "substr",
  "replace",
  "replaceAll",
  "match",
  "matchAll",
  "search",
  "localeCompare",
]);

const JS_AMBIENT_GLOBAL_CALLS: Readonly<Record<string, readonly string[]>> = {
  Array: ["isArray", "from", "of"],
  JSON: ["parse", "stringify"],
  Object: ["entries", "fromEntries", "keys", "values"],
};

const JS_AMBIENT_GLOBAL_FUNCTIONS = new Set(["Symbol"]);

const isDynamicImportCall = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

const isGlobalThisIdentifier = (node: ts.Node): node is ts.Identifier =>
  ts.isIdentifier(node) && node.text === "globalThis";

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
  return sourceNames.has(normalizeFileName(declaration.getSourceFile().fileName));
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

const TYPED_ARRAY_SYMBOL_NAMES = new Set([
  "Uint8Array",
  "Int8Array",
  "Uint16Array",
  "Int16Array",
  "Uint32Array",
  "Int32Array",
  "Float32Array",
  "Float64Array",
  "Uint8ClampedArray",
  "BigInt64Array",
  "BigUint64Array",
]);

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
  return symbolName ? TYPED_ARRAY_SYMBOL_NAMES.has(symbolName) : false;
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
  if (!JS_BUILTIN_MEMBER_NAMES.has(memberName)) return undefined;
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
  if (
    !(
      ts.isElementAccessExpression(node) ||
      ts.isElementAccessChain(node)
    )
  ) {
    return undefined;
  }

  const argument = node.argumentExpression;
  if (
    !argument ||
    (!ts.isNumericLiteral(argument) &&
      !ts.isPrefixUnaryExpression(argument))
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
      JS_AMBIENT_GLOBAL_FUNCTIONS.has(node.expression.text) &&
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

  const allowedMembers = JS_AMBIENT_GLOBAL_CALLS[object.text];
  if (!allowedMembers?.includes(member)) {
    return undefined;
  }

  return isAmbientIdentifier(object, program)
    ? `${object.text}.${member}(...)`
    : undefined;
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
      addUnsupported(
        node,
        "The JavaScript 'in' operator is not supported in emitted Tsonic code.",
        "Use a concrete discriminant field, dictionary.ContainsKey, or a typed domain API."
      );
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
    }

    if (
      ts.isIdentifier(node) &&
      node.text === "arguments" &&
      !isAmbientOrDeclarationNode(node) &&
      isIdentifierReference(node)
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
        createDiagnostic(
          "TSN5001",
          "error",
          "JavaScript function.length is not supported in emitted Tsonic code.",
          getNodeLocation(sourceFile, node),
          "Model handler shape with explicit tagged types or separate APIs."
        )
      );
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return currentCollector;
};
