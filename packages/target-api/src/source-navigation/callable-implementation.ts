import type {
  AstReader,
  CheckedSourceProgram,
  Node,
  Symbol,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import type {
  SourceCallableImplementationResult,
  SourceDeclarationReference,
} from "./types.js";

type CallableCategory = "function" | "method" | "get" | "set" | "constructor";

export interface SourceCallableImplementationNavigation {
  callableImplementation(
    contractDeclaration: Node,
  ): SourceCallableImplementationResult;
}

export function createSourceCallableImplementationNavigation(
  source: CheckedSourceProgram,
  sourceReferenceFor: (
    node: Node | undefined,
  ) => SourceDeclarationReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): SourceCallableImplementationNavigation {
  const cache = new WeakMap<Node, SourceCallableImplementationResult>();

  const callableImplementation = (
    contractDeclaration: Node,
  ): SourceCallableImplementationResult => {
    const existing = cache.get(contractDeclaration);
    if (existing !== undefined) {
      return existing;
    }
    const result = resolveCallableImplementation(
      source,
      contractDeclaration,
      sourceReferenceFor,
      isProjectDeclaration,
    );
    cache.set(contractDeclaration, result);
    return result;
  };

  return Object.freeze({ callableImplementation });
}

function resolveCallableImplementation(
  source: CheckedSourceProgram,
  contractDeclaration: Node,
  sourceReferenceFor: (
    node: Node | undefined,
  ) => SourceDeclarationReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): SourceCallableImplementationResult {
  const { ast } = source;
  const category = callableCategory(ast, contractDeclaration);
  const sourceFile = ast.getSourceFile(contractDeclaration);
  if (category === undefined || sourceFile === undefined ||
    !isProjectDeclaration(contractDeclaration)) {
    return Object.freeze({
      kind: "unresolved",
      reason:
        "Callable implementation resolution requires an exact project function, method, accessor, or constructor declaration.",
    });
  }
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const referenceNode = category === "constructor"
    ? ast.name(ast.parent(contractDeclaration))
    : ast.name(contractDeclaration);
  const reference = sourceReferenceFor(referenceNode);
  const symbol = reference?.symbol;
  const implementationDeclaration = selectCallableImplementationDeclaration(
    ast,
    checker,
    contractDeclaration,
    symbol,
  );
  const implementationSourceFile = ast.getSourceFile(implementationDeclaration);
  if (symbol === undefined || implementationDeclaration === undefined ||
    implementationSourceFile === undefined ||
    !isProjectDeclaration(implementationDeclaration)) {
    return Object.freeze({
      kind: "unresolved",
      reason:
        "The checked source program did not expose one concrete project implementation for the callable declaration.",
    });
  }
  return Object.freeze({
    kind: "resolved",
    contractDeclaration,
    implementation: Object.freeze({
      symbol,
      declaration: implementationDeclaration,
      sourceFile: implementationSourceFile,
      project: true,
    }),
  });
}

export function selectCallableImplementationDeclaration(
  ast: AstReader,
  checker: TypeCheckerQueries,
  contractDeclaration: Node,
  symbol: Symbol | undefined,
): Node | undefined {
  const category = callableCategory(ast, contractDeclaration);
  if (category === undefined || symbol === undefined) {
    return undefined;
  }
  const candidates = category === "constructor"
    ? ast.members(ast.parent(contractDeclaration))
    : checker.getSymbolDeclarations(symbol);
  const implementations = candidates.filter((candidate): candidate is Node =>
    candidate !== undefined &&
    callableCategory(ast, candidate) === category &&
    ast.body(candidate) !== undefined);
  return implementations.length === 1 ? implementations[0] : undefined;
}

function callableCategory(
  ast: AstReader,
  declaration: Node | undefined,
): CallableCategory | undefined {
  const kind = declaration === undefined ? "" : ast.kindName(declaration);
  if (kind === "KindFunctionDeclaration") {
    return "function";
  }
  if (kind === "KindMethodDeclaration" || kind === "KindMethodSignature") {
    return "method";
  }
  if (kind === "KindGetAccessor") {
    return "get";
  }
  if (kind === "KindSetAccessor") {
    return "set";
  }
  return kind === "KindConstructor" ? "constructor" : undefined;
}
