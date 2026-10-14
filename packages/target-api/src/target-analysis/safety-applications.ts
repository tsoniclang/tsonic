import type {
  AstReader,
  ExtensionFactSubject,
  Node,
  SourceFile,
} from "@tsonic/tsts";
import { Node_Expression } from "../source-navigation/ast.js";
import { isAstNode } from "../source-navigation/node-access.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";

export type TargetSafetyApplicationPlacement =
  | "declaration"
  | "constructor"
  | "getter"
  | "setter";

export interface TargetSafetyApplicationFact {
  readonly kind: "application";
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
  readonly selectedMemberDeclaration?: Node;
  readonly selectedMemberDeclarations?: readonly Node[];
  readonly applicationPlacement: TargetSafetyApplicationPlacement;
}

export type TargetSafetyApplication<Fact extends TargetSafetyApplicationFact> = Fact & {
  readonly sourceSubject: Node;
  readonly sourceFile: SourceFile;
  readonly selectedMemberDeclarations: readonly Node[];
  readonly resolvedRootDeclaration?: Node;
  readonly targetDeclarations: readonly Node[];
};

export type TargetSafetyOperation<UnsafeContext, Builder> =
  | { readonly kind: "unsafe-context"; readonly fact: UnsafeContext }
  | { readonly kind: "safety-builder"; readonly fact: Builder };

export interface TargetSafetyApplicationIndexInput<UnsafeContext, Builder extends { readonly kind: string }> {
  readonly ast: AstReader;
  readonly sourceFiles: readonly SourceFile[];
  readonly navigation: Pick<SourceProgramNavigation, "referenceFor" | "declarationFor" | "isProjectDeclaration">;
  readUnsafeContext(subject: Node): UnsafeContext | undefined;
  readSafetyBuilder(subject: Node): Builder | undefined;
}

export interface TargetSafetyApplicationIndex<UnsafeContext, Builder, Application> {
  readonly all: readonly Application[];
  forSourceFile(sourceFile: SourceFile): readonly Application[];
  forDeclaration(declaration: Node): readonly Application[];
  isCompileTimeApplicationReference(declaration: Node, reference: Node): boolean;
  operationForSubject(subject: Node): TargetSafetyOperation<UnsafeContext, Builder> | undefined;
  operationForExpression(expression: Node): TargetSafetyOperation<UnsafeContext, Builder> | undefined;
}

export function createTargetSafetyApplicationIndex<UnsafeContext, Builder extends { readonly kind: string }>(
  input: TargetSafetyApplicationIndexInput<UnsafeContext, Builder>,
): TargetSafetyApplicationIndex<
  UnsafeContext,
  Builder,
  TargetSafetyApplication<Builder & TargetSafetyApplicationFact>
> {
  type Application = TargetSafetyApplication<Builder & TargetSafetyApplicationFact>;
  const all: Application[] = [];
  const bySourceFile = new Map<SourceFile, readonly Application[]>();
  const byDeclaration = new Map<Node, Application[]>();
  const bySubject = new Map<Node, TargetSafetyOperation<UnsafeContext, Builder>>();
  const wrappers: Node[] = [];
  for (const sourceFile of input.sourceFiles) {
    const applications: Application[] = [];
    walkSubtree(sourceFile, input.ast, (node) => {
      if (input.ast.is.IsParenthesizedExpression(node)) {
        wrappers.push(node);
      }
      const unsafeContext = input.readUnsafeContext(node);
      if (unsafeContext !== undefined) {
        bySubject.set(node, { kind: "unsafe-context", fact: unsafeContext });
      }
      const builder = input.readSafetyBuilder(node);
      if (builder === undefined) {
        return;
      }
      bySubject.set(node, { kind: "safety-builder", fact: builder });
      if (!isApplicationFact(builder)) {
        return;
      }
      const application = resolveApplication(node, sourceFile, builder, input);
      applications.push(application);
      all.push(application);
      for (const declaration of application.targetDeclarations) {
        const existing = byDeclaration.get(declaration) ?? [];
        existing.push(application);
        byDeclaration.set(declaration, existing);
      }
    });
    bySourceFile.set(sourceFile, Object.freeze(applications));
  }
  const byExpression = new Map<Node, TargetSafetyOperation<UnsafeContext, Builder>>();
  for (const wrapper of wrappers) {
    let current: Node | undefined = wrapper;
    while (current !== undefined) {
      const operation = bySubject.get(current);
      if (operation !== undefined) {
        byExpression.set(wrapper, operation);
        break;
      }
      current = input.ast.is.IsParenthesizedExpression(current)
        ? Node_Expression(input.ast, current)
        : undefined;
    }
  }
  const enclosingApplications = new Map<Node, Application[]>();
  for (const application of all) {
    walkSubtree(application.sourceSubject, input.ast, (node) => {
      const existing = enclosingApplications.get(node) ?? [];
      existing.push(application);
      enclosingApplications.set(node, existing);
    });
  }
  const emptyApplications: readonly Application[] = Object.freeze([]);
  return Object.freeze({
    all: Object.freeze(all),
    forSourceFile: (sourceFile: SourceFile) =>
      bySourceFile.get(sourceFile) ?? emptyApplications,
    forDeclaration: (declaration: Node) =>
      byDeclaration.get(declaration) ?? emptyApplications,
    isCompileTimeApplicationReference(declaration: Node, reference: Node) {
      return (enclosingApplications.get(reference) ?? emptyApplications).some(
        (application) => application.targetDeclarations.includes(declaration),
      );
    },
    operationForSubject: (subject: Node) => bySubject.get(subject),
    operationForExpression: (expression: Node) =>
      bySubject.get(expression) ?? byExpression.get(expression),
  });
}

function isApplicationFact<Builder extends { readonly kind: string }>(
  fact: Builder,
): fact is Builder & TargetSafetyApplicationFact {
  return fact.kind === "application";
}

function resolveApplication<Fact extends TargetSafetyApplicationFact>(
  sourceSubject: Node,
  sourceFile: SourceFile,
  fact: Fact,
  input: Pick<TargetSafetyApplicationIndexInput<unknown, { readonly kind: string }>, "ast" | "navigation">,
): TargetSafetyApplication<Fact> {
  const selectedMemberDeclarations = Object.freeze(
    [
      ...(fact.selectedMemberDeclarations ?? []),
      fact.selectedMemberDeclaration,
      fact.selectedMember,
    ].filter((subject): subject is Node => isAstNode(input.ast, subject)),
  );
  const applicationTarget = isAstNode(input.ast, fact.applicationTarget)
    ? fact.applicationTarget
    : undefined;
  const resolvedRootDeclaration = applicationTarget === undefined
    ? undefined
    : projectDeclaration(applicationTarget, input.navigation);
  return Object.freeze({
    ...fact,
    sourceSubject,
    sourceFile,
    selectedMemberDeclarations,
    ...(resolvedRootDeclaration === undefined ? {} : { resolvedRootDeclaration }),
    targetDeclarations: applicationDeclarations(
      fact.applicationPlacement,
      selectedMemberDeclarations,
      resolvedRootDeclaration,
      input.ast,
    ),
  });
}

function projectDeclaration(
  subject: Node,
  navigation: TargetSafetyApplicationIndexInput<unknown, { readonly kind: string }>["navigation"],
): Node | undefined {
  return navigation.referenceFor(subject)?.declaration ??
    navigation.declarationFor(subject) ??
    (navigation.isProjectDeclaration(subject) ? subject : undefined);
}

function applicationDeclarations(
  placement: TargetSafetyApplicationPlacement,
  selectedMemberDeclarations: readonly Node[],
  resolvedRootDeclaration: Node | undefined,
  ast: AstReader,
): readonly Node[] {
  switch (placement) {
    case "declaration":
      return uniqueNodes([...selectedMemberDeclarations, resolvedRootDeclaration]);
    case "constructor":
      return resolvedRootDeclaration === undefined || !ast.is.IsClassDeclaration(resolvedRootDeclaration)
        ? Object.freeze([])
        : uniqueNodes([
            resolvedRootDeclaration,
            ...ast.members(resolvedRootDeclaration).filter(
              (member): member is Node =>
                member !== undefined && ast.is.IsConstructorDeclaration(member),
            ),
          ]);
    case "getter":
      return uniqueNodes(selectedMemberDeclarations.filter((declaration) =>
        ast.is.IsGetAccessorDeclaration(declaration) || carriesBothAccessors(ast, declaration)));
    case "setter":
      return uniqueNodes(selectedMemberDeclarations.filter((declaration) =>
        ast.is.IsSetAccessorDeclaration(declaration) || carriesBothAccessors(ast, declaration)));
  }
}

function carriesBothAccessors(ast: AstReader, declaration: Node): boolean {
  return ast.is.IsIndexSignatureDeclaration(declaration) ||
    ast.is.IsPropertyDeclaration(declaration) ||
    ast.is.IsPropertySignatureDeclaration(declaration);
}

function uniqueNodes(nodes: readonly (Node | undefined)[]): readonly Node[] {
  return Object.freeze([...new Set(nodes.filter(
    (node): node is Node => node !== undefined,
  ))]);
}

function walkSubtree(
  root: Node,
  ast: AstReader,
  visit: (node: Node) => void,
): void {
  const pending: Node[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) {
      continue;
    }
    visit(node);
    const children = ast.children(node).filter(
      (child): child is Node => child !== undefined,
    );
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push(children[index]!);
    }
  }
}
