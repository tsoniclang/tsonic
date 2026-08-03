import type {
  AstReader,
  CheckedSourceProgram,
  Node,
  SourceFile,
  Type,
} from "@tsonic/tsts";
import type {
  SourceProjectMemberDispatch,
  SourceProjectReference,
} from "./types.js";
import {
  sourceNodeIdentity,
  sourceNodesEqual,
} from "./identity.js";

export interface SourceMemberDispatchNavigation {
  memberDispatch(node: Node | undefined): SourceProjectMemberDispatch | undefined;
}

export function createSourceMemberDispatchNavigation(
  source: CheckedSourceProgram,
  sourceFiles: readonly SourceFile[],
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): SourceMemberDispatchNavigation {
  const ast = source.ast;
  const cache = new Map<string, SourceProjectMemberDispatch | null>();
  const classDeclarations = collectClassDeclarations(ast, sourceFiles);

  const memberDispatch = (
    node: Node | undefined,
  ): SourceProjectMemberDispatch | undefined => {
    if (node === undefined) {
      return undefined;
    }
    const nodeKey = sourceNodeIdentity(ast, node);
    const cached = nodeKey === undefined ? undefined : cache.get(nodeKey);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    if (!isDispatchMember(ast, node, isProjectDeclaration)) {
      if (nodeKey !== undefined) {
        cache.set(nodeKey, null);
      }
      return undefined;
    }
    const classDeclaration = ast.parent(node);
    const sourceFile = ast.getSourceFile(node);
    if (
      classDeclaration === undefined ||
      sourceFile === undefined ||
      !ast.is.IsClassDeclaration(classDeclaration)
    ) {
      if (nodeKey !== undefined) {
        cache.set(nodeKey, null);
      }
      return undefined;
    }
    const memberName = dispatchMemberName(ast, node);
    if (memberName === undefined) {
      if (nodeKey !== undefined) {
        cache.set(nodeKey, null);
      }
      return undefined;
    }
    const result = {
      overridesBase: memberOverridesBase(
        source,
        ast,
        classDeclaration,
        memberName,
        sourceFile,
        referenceFor,
        isProjectDeclaration,
      ),
      hasDerivedOverride: hasDerivedOverride(
        source,
        ast,
        classDeclarations,
        classDeclaration,
        memberName,
        referenceFor,
        isProjectDeclaration,
      ),
    };
    if (nodeKey !== undefined) {
      cache.set(nodeKey, result);
    }
    return result;
  };

  return Object.freeze({ memberDispatch });
}

function isDispatchMember(
  ast: AstReader,
  node: Node | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): boolean {
  return node !== undefined &&
    isProjectDeclaration(node) &&
    (
      ast.is.IsMethodDeclaration(node) ||
      ast.is.IsGetAccessorDeclaration(node) ||
      ast.is.IsSetAccessorDeclaration(node) ||
      ast.is.IsPropertyDeclaration(node)
    ) &&
    !ast.hasModifierKind(node, "private") &&
    !ast.hasModifierKind(node, "static") &&
    dispatchMemberName(ast, node) !== undefined;
}

function dispatchMemberName(
  ast: AstReader,
  member: Node,
): string | undefined {
  const name = ast.name(member);
  return name !== undefined &&
      (
        ast.is.IsIdentifier(name) ||
        ast.is.IsStringLiteral(name) ||
        ast.is.IsNumericLiteral(name)
      )
    ? ast.text(name)
    : undefined;
}

function memberOverridesBase(
  source: CheckedSourceProgram,
  ast: AstReader,
  classDeclaration: Node,
  memberName: string,
  sourceFile: SourceFile,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): boolean {
  const baseType = projectBaseClassType(
    source,
    ast,
    classDeclaration,
    referenceFor,
  );
  if (baseType === undefined) {
    return false;
  }
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const declaration = checker.getPrimarySymbolDeclaration(
    checker.getPropertyOfType(baseType, memberName),
  );
  if (isDispatchMember(ast, declaration, isProjectDeclaration)) {
    return true;
  }
  return false;
}

function hasDerivedOverride(
  source: CheckedSourceProgram,
  ast: AstReader,
  classes: readonly Node[],
  baseClass: Node,
  memberName: string,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
  isProjectDeclaration: (node: Node | undefined) => boolean,
): boolean {
  for (const candidate of classes) {
    if (
      sourceNodesEqual(ast, candidate, baseClass) ||
      !classExtends(ast, candidate, baseClass, referenceFor, new Set())
    ) {
      continue;
    }
    const candidateMember = ast.members(candidate).find((member) =>
      member !== undefined &&
      isDispatchMember(ast, member, isProjectDeclaration) &&
      dispatchMemberName(ast, member) === memberName);
    const candidateFile = ast.getSourceFile(candidate);
    if (
      candidateMember !== undefined &&
      candidateFile !== undefined &&
      memberOverridesBase(
        source,
        ast,
        candidate,
        memberName,
        candidateFile,
        referenceFor,
        isProjectDeclaration,
      )
    ) {
      return true;
    }
  }
  return false;
}

function classExtends(
  ast: AstReader,
  candidate: Node,
  expectedBase: Node,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
  seen: Set<string>,
): boolean {
  const candidateKey = sourceNodeIdentity(ast, candidate);
  if (candidateKey === undefined || seen.has(candidateKey)) {
    return false;
  }
  seen.add(candidateKey);
  const directBase = projectBaseClassDeclaration(ast, candidate, referenceFor);
  return sourceNodesEqual(ast, directBase, expectedBase) ||
    (
      directBase !== undefined &&
      classExtends(ast, directBase, expectedBase, referenceFor, seen)
    );
}

function projectBaseClassType(
  source: CheckedSourceProgram,
  ast: AstReader,
  classDeclaration: Node,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
): Type | undefined {
  const reference = referenceFor(baseClassReferenceNode(ast, classDeclaration));
  if (reference === undefined || !ast.is.IsClassDeclaration(reference.declaration)) {
    return undefined;
  }
  return source.getSourceFileQueries(reference.sourceFile)
    .checker.getDeclaredTypeOfSymbol(reference.symbol);
}

function projectBaseClassDeclaration(
  ast: AstReader,
  classDeclaration: Node,
  referenceFor: (node: Node | undefined) => SourceProjectReference | undefined,
): Node | undefined {
  const reference = referenceFor(baseClassReferenceNode(ast, classDeclaration));
  return reference !== undefined && ast.is.IsClassDeclaration(reference.declaration)
    ? reference.declaration
    : undefined;
}

function baseClassReferenceNode(
  ast: AstReader,
  classDeclaration: Node,
): Node | undefined {
  for (const heritage of ast.extendsHeritageElements(classDeclaration)) {
    if (heritage !== undefined && ast.is.IsExpressionWithTypeArguments(heritage)) {
      return ast.as.AsExpressionWithTypeArguments(heritage)?.Expression;
    }
  }
  return undefined;
}

function collectClassDeclarations(
  ast: AstReader,
  sourceFiles: readonly SourceFile[],
): readonly Node[] {
  const declarations: Node[] = [];
  const visit = (node: Node | undefined): void => {
    if (node === undefined) {
      return;
    }
    if (ast.is.IsClassDeclaration(node)) {
      declarations.push(node);
    }
    ast.forEachChild(node, visit);
  };
  for (const sourceFile of sourceFiles) {
    visit(sourceFile);
  }
  return Object.freeze(declarations);
}
