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
  readonly contract: string;
  readonly applicationTarget: ExtensionFactSubject;
  readonly selectedMember?: ExtensionFactSubject;
  readonly selectedMemberDeclaration?: Node;
  readonly selectedMemberDeclarations?: readonly Node[];
  readonly applicationPlacement: TargetSafetyApplicationPlacement;
}

export type TargetSafetyBuilderFact = TargetSafetyApplicationFact | { readonly kind: "builder-state" };

export type TargetSafetyApplication<Fact extends TargetSafetyApplicationFact> = Fact & {
  readonly sourceSubject: Node;
  readonly sourceFile: SourceFile;
  readonly selectedMemberDeclarations: readonly Node[];
  readonly resolvedRootDeclaration?: Node;
  readonly targetDeclarations: readonly Node[];
};

export type TargetSafetyApplicationStatus = "target-not-resolved" | "conflicting" | "candidate";

export interface TargetSafetyApplicationFindings<Application> {
  readonly conflicts: readonly { readonly declaration: Node; readonly first: Application }[];
  readonly applications: readonly { readonly application: Application; readonly status: TargetSafetyApplicationStatus }[];
}

export type TargetSafetyOperation<UnsafeContext, Builder> =
  | { readonly kind: "unsafe-context"; readonly fact: UnsafeContext }
  | { readonly kind: "safety-builder"; readonly fact: Builder };

export interface TargetSafetyApplicationIndexInput<UnsafeContext, Builder extends TargetSafetyBuilderFact> {
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
  findings(sourceFile: SourceFile): TargetSafetyApplicationFindings<Application>;
  isCompileTimeApplicationReference(declaration: Node, reference: Node): boolean;
  operationForSubject(subject: Node): TargetSafetyOperation<UnsafeContext, Builder> | undefined;
  operationForExpression(expression: Node): TargetSafetyOperation<UnsafeContext, Builder> | undefined;
}

export function createTargetSafetyApplicationIndex<UnsafeContext, Builder extends TargetSafetyBuilderFact>(
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
  const enclosingDeclarations = new Map<Node, ReadonlySet<Node>>();
  const wrappers: Node[] = [];
  for (const sourceFile of input.sourceFiles) {
    const applications: Application[] = [];
    walkSubtree(sourceFile, input.ast, (node) => {
      const parent = input.ast.parent(node);
      let enclosing = parent === undefined ? undefined : enclosingDeclarations.get(parent);
      if (input.ast.is.IsParenthesizedExpression(node)) {
        wrappers.push(node);
      }
      const unsafeContext = input.readUnsafeContext(node);
      if (unsafeContext !== undefined) {
        bySubject.set(node, Object.freeze({ kind: "unsafe-context", fact: unsafeContext }));
      }
      const builder = input.readSafetyBuilder(node);
      if (builder !== undefined) {
        bySubject.set(node, Object.freeze({ kind: "safety-builder", fact: builder }));
        if (isApplicationFact(builder)) {
          const application = resolveApplication(node, sourceFile, builder, input);
          applications.push(application);
          all.push(application);
          if (application.targetDeclarations.length > 0) {
            const declarations = new Set(enclosing);
            for (const declaration of application.targetDeclarations) {
              declarations.add(declaration);
              const existing = byDeclaration.get(declaration) ?? [];
              existing.push(application);
              byDeclaration.set(declaration, existing);
            }
            enclosing = declarations;
          }
        }
      }
      if (enclosing !== undefined) enclosingDeclarations.set(node, enclosing);
    });
    bySourceFile.set(sourceFile, Object.freeze(applications));
  }
  const byExpression = new Map(bySubject);
  for (let index = wrappers.length - 1; index >= 0; index -= 1) {
    const wrapper = wrappers[index]!;
    const operand = Node_Expression(input.ast, wrapper);
    const operation = bySubject.get(wrapper) ?? (operand === undefined ? undefined : byExpression.get(operand));
    if (operation !== undefined) byExpression.set(wrapper, operation);
  }
  for (const applications of byDeclaration.values()) Object.freeze(applications);
  const emptyApplications: readonly Application[] = Object.freeze([]);
  const findingsBySourceFile = new Map<SourceFile, TargetSafetyApplicationFindings<Application>>();
  for (const [sourceFile, applications] of bySourceFile) {
    findingsBySourceFile.set(sourceFile, applicationFindings(
      sourceFile,
      applications,
      (declaration) => byDeclaration.get(declaration) ?? emptyApplications,
      input.ast,
    ));
  }
  const emptyFindings: TargetSafetyApplicationFindings<Application> = Object.freeze({
    conflicts: Object.freeze([]),
    applications: Object.freeze([]),
  });
  return Object.freeze({
    all: Object.freeze(all),
    forSourceFile: (sourceFile: SourceFile) =>
      bySourceFile.get(sourceFile) ?? emptyApplications,
    forDeclaration: (declaration: Node) =>
      byDeclaration.get(declaration) ?? emptyApplications,
    findings: (sourceFile: SourceFile) =>
      findingsBySourceFile.get(sourceFile) ?? emptyFindings,
    isCompileTimeApplicationReference: (declaration: Node, reference: Node) =>
      enclosingDeclarations.get(reference)?.has(declaration) === true,
    operationForSubject: (subject: Node) => bySubject.get(subject),
    operationForExpression: (expression: Node) =>
      byExpression.get(expression),
  });
}

function applicationFindings<Application extends TargetSafetyApplication<TargetSafetyApplicationFact>>(
  sourceFile: SourceFile,
  applications: readonly Application[],
  forDeclaration: (declaration: Node) => readonly Application[],
  ast: AstReader,
): TargetSafetyApplicationFindings<Application> {
  const conflicting = new Set<Node>();
  const conflicts: { readonly declaration: Node; readonly first: Application }[] = [];
  for (const application of applications) {
    for (const declaration of application.targetDeclarations) {
      if (conflicting.has(declaration)) continue;
      const related = forDeclaration(declaration)
        .filter((candidate) => candidate.applicationPlacement === application.applicationPlacement);
      if (new Set(related.map((candidate) => candidate.contract)).size <= 1) continue;
      conflicting.add(declaration);
      const first = [...related].sort((left, right) => compareApplications(ast, left, right))[0];
      if (first?.sourceFile === sourceFile) conflicts.push(Object.freeze({ declaration, first }));
    }
  }
  return Object.freeze({
    conflicts: Object.freeze(conflicts),
    applications: Object.freeze(applications.map((application) => Object.freeze({
      application,
      status: application.targetDeclarations.length === 0
        ? "target-not-resolved" as const
        : application.targetDeclarations.some((declaration) => conflicting.has(declaration))
          ? "conflicting" as const
          : "candidate" as const,
    }))),
  });
}

function compareApplications(
  ast: AstReader,
  left: TargetSafetyApplication<TargetSafetyApplicationFact>,
  right: TargetSafetyApplication<TargetSafetyApplicationFact>,
): number {
  const pathOrder = ast.getPath(left.sourceFile).localeCompare(ast.getPath(right.sourceFile));
  return pathOrder !== 0 ? pathOrder : ast.pos(left.sourceSubject) - ast.pos(right.sourceSubject);
}

function isApplicationFact<Builder extends TargetSafetyBuilderFact>(
  fact: Builder,
): fact is Builder & TargetSafetyApplicationFact {
  return fact.kind === "application";
}

function resolveApplication<Fact extends TargetSafetyApplicationFact>(
  sourceSubject: Node,
  sourceFile: SourceFile,
  fact: Fact,
  input: Pick<TargetSafetyApplicationIndexInput<unknown, TargetSafetyBuilderFact>, "ast" | "navigation">,
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
  navigation: TargetSafetyApplicationIndexInput<unknown, TargetSafetyBuilderFact>["navigation"],
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
