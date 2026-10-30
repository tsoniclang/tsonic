import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/types.js";
import { sourceInstanceInitializers } from "../../source-navigation/class-initialization.js";
import type { SourceDeclarationFlowExecutionRegion } from "./model.js";
import { SourceFlowFailure } from "./resources.js";

export interface SourceFlowEntry<Region = SourceDeclarationFlowExecutionRegion> {
  readonly body: Node | undefined;
  readonly parameters: readonly (Node | undefined)[];
  readonly bodyExecution: Region | undefined;
  readonly entryInitializers: readonly SourceFlowInitializer<Region>[];
  readonly superInitializers: readonly SourceFlowInitializer<Region>[];
  readonly completionInitializers: readonly SourceFlowInitializer<Region>[];
  readonly syntaxRoots: readonly Node[];
  readonly rootExecutions: ReadonlyMap<Node, Region>;
}

export interface SourceFlowInitializer<Region = SourceDeclarationFlowExecutionRegion> {
  readonly node: Node;
  readonly execution: Region | undefined;
}

export function sourceDeclarationFlowEntry(source: TargetSourceProgram, declaration: Node,
  step: (node?: Node) => void): SourceFlowEntry<SourceDeclarationFlowExecutionRegion> {
  const { ast, navigation } = source;
  const rootExecutions = new Map<Node, SourceDeclarationFlowExecutionRegion>();
  const syntaxRoots: Node[] = [];
  const region = (owner: Node, root: Node, role: SourceDeclarationFlowExecutionRegion["role"]): SourceDeclarationFlowExecutionRegion => {
    step(root);
    if (!navigation.isProjectDeclaration(owner) || !navigation.isProjectDeclaration(root))
      throw new SourceFlowFailure("Declaration flow regions require their identical checked owner and root.", root);
    const selected = Object.freeze({ owner, root, role });
    rootExecutions.set(root, selected);
    syntaxRoots.push(root);
    return selected;
  };
  const empty = { parameters: [],
    superInitializers: [], completionInitializers: [], syntaxRoots, rootExecutions };
  if (ast.is.IsSourceFile(declaration)) return { ...empty, body: declaration,
    bodyExecution: region(declaration, declaration, "module"), entryInitializers: [] };
  if (ast.is.IsPropertyDeclaration(declaration)) {
    const owner = ast.parent(declaration);
    const initializer = Node_Initializer(ast, declaration);
    if (owner === undefined || !ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner) ||
      !ast.members(owner).includes(declaration) || initializer === undefined)
      throw new SourceFlowFailure("Declaration field flow requires its original checked class, member and initializer.", declaration);
    const execution = region(owner, initializer, ast.hasModifierKind(declaration, "static") ? "static-initializer" : "instance-initializer");
    return { ...empty, body: undefined, bodyExecution: undefined,
      entryInitializers: [Object.freeze({ node: initializer, execution })] };
  }
  const classes: Node[] = [];
  let implementation: Node | undefined = declaration;
  if (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration)) {
    const visited = new Set<Node>();
    let owner: Node | undefined = declaration;
    implementation = undefined;
    while (owner !== undefined) {
      step(owner);
      if (visited.has(owner)) throw new SourceFlowFailure("Declaration construction requires acyclic checked class heritage.", owner);
      visited.add(owner);
      if (!navigation.isProjectDeclaration(owner))
        throw new SourceFlowFailure("Declaration construction requires its selected native contract when the base has no checked source class body.", owner);
      if (!ast.is.IsClassDeclaration(owner) && !ast.is.IsClassExpression(owner)) {
        const semantics = source.semantics.forNode(owner);
        const type = semantics.declarations.declaredValueType(owner);
        const signatures = type === undefined ? [] : semantics.types.constructSignatures(type);
        if (signatures.length === 0)
          throw new SourceFlowFailure("Declaration construction requires its selected native contract when the base has no checked source class body.", owner);
        for (const signature of signatures) {
          const contract = semantics.declarations.signatureDeclaration(signature);
          step(contract);
          const file = ast.getSourceFile(contract);
          if (contract === undefined || file === undefined || !source.semantics.includes(file) ||
            !ast.is.IsConstructorTypeNode(contract) && !ast.is.IsConstructSignatureDeclaration(contract))
            throw new SourceFlowFailure("Declaration construction requires its selected native contract when the base has no checked source class body.", owner);
        }
        break;
      }
      classes.push(owner);
      const constructors = navigation.classConstructors(owner);
      if (constructors.kind !== "resolved") throw new SourceFlowFailure(constructors.reason, owner);
      if (!constructors.implicit) {
        const bodies = ast.members(owner).filter((member): member is Node => member !== undefined &&
          ast.is.IsConstructorDeclaration(member) && ast.body(member) !== undefined);
        if (bodies.length !== 1) throw new SourceFlowFailure("Declaration construction requires one original checked constructor implementation.", owner);
        implementation = bodies[0];
        break;
      }
      const heritage = navigation.declaredHeritage(owner);
      if (heritage.kind !== "resolved") throw new SourceFlowFailure(heritage.reason, owner);
      const bases = heritage.edges.filter(edge => edge.kind === "extends");
      if (bases.length > 1) throw new SourceFlowFailure("Declaration construction requires one exact checked base declaration.", owner);
      owner = bases[0]?.target.declaration;
    }
  }
  const body = implementation === undefined ? undefined : ast.body(implementation);
  if (implementation !== undefined && body === undefined)
    throw new SourceFlowFailure("Declaration flow requires an implemented checked body or a completed selected native contract.", implementation);
  const bodyExecution = body === undefined || implementation === undefined ? undefined : region(implementation, body, "body");
  const parameters = implementation === undefined ? [] : ast.parameters(implementation);
  for (const parameter of parameters) {
    if (parameter === undefined) continue;
    step(parameter);
    const initializer = Node_Initializer(ast, parameter);
    if (initializer !== undefined) {
      const execution = region(implementation!, initializer, "parameter-initializer");
      rootExecutions.set(parameter, execution);
    }
  }
  const fields = (owner: Node): readonly SourceFlowInitializer<SourceDeclarationFlowExecutionRegion>[] => {
    const initializers = sourceInstanceInitializers(owner, source, () => { step(owner); return true; });
    if (initializers === undefined) throw new SourceFlowFailure("Declaration flow requires completed checked instance initializers.", owner);
    return initializers.map(node => Object.freeze({ node, execution: region(owner, node, "instance-initializer") }));
  };
  const owner = classes[classes.length - 1] ?? (ast.is.IsConstructorDeclaration(declaration) ? ast.parent(declaration) : undefined);
  const initializers = owner === undefined ? [] : fields(owner);
  const heritage = owner === undefined ? undefined : navigation.declaredHeritage(owner);
  if (heritage?.kind === "unresolved") throw new SourceFlowFailure(heritage.reason, owner);
  const derived = body !== undefined && (heritage?.edges.some(edge => edge.kind === "extends") ?? false);
  const completionInitializers = classes.slice(0, -1).reverse().flatMap(fields);
  return { body, parameters, bodyExecution,
    entryInitializers: derived ? [] : initializers, superInitializers: derived ? initializers : [],
    completionInitializers, syntaxRoots, rootExecutions };
}
