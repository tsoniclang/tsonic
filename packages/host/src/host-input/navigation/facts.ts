import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { CheckedSourceProgram, Node, Signature, SourceFile } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "@tsonic/target-api/host";
import { sourceBindingWriteAtReference, sourceReferenceMeaning } from "@tsonic/target-api/host";
import type { SourceCallableRole, SourceNodeConstructors, SourceNodeHeritage, SourceNodeHeritageEdge,
  SourceNodeNavigationFacts, SourceNodeReference, SourceNodeWrite, SourceResult, SourceSignatureIdentity,
  SourceTypeEvidence, SourcePresence, SourceProfileDeclarationIdentity } from "@tsonic/target-api/source";
import type { SourceInputIdentityOwner } from "../identity-owner.js";
import { createSourceProgramNavigation } from "./navigation.js";
import type { SourceDeclarationReference, SourceDeclaredHeritageEdge } from "./types.js";

export interface SourceNodeNavigationOwner {
  readonly facts: SourceNodeNavigationFacts;
  readonly analysis: {
    enclosing(node: Node | undefined, role: SourceCallableRole, visit: (node: Node) => boolean): Node | undefined;
  };
}

export function createSourceNodeNavigationFacts(input: {
  readonly checked: CheckedSourceProgram;
  readonly sourceFiles: readonly SourceFile[];
  readonly inventory: { readonly nodes: readonly Node[]; readonly nodesForFiles: (files: readonly SourceFile[]) => readonly Node[];
    readonly contains: (node: Node) => boolean };
  readonly assertNode: (node: Node) => void;
  readonly identities: SourceInputIdentityOwner;
  readonly originalSignature: (owner: Node, kind: "call" | "construct", original: Signature) => SourceInputSignature;
  readonly signature: (original: SourceInputSignature) => SourceSignatureIdentity;
  readonly publish: (component: SourceInputComponent, receiver?: SourceTypeEvidence) => SourceResult<SourceTypeEvidence>;
  readonly profileDeclaration: (node: Node) => SourcePresence<SourceProfileDeclarationIdentity>;
}): SourceNodeNavigationOwner {
  const { checked, sourceFiles, inventory, assertNode, identities, originalSignature, signature, publish } = input;
  const { ast } = checked;
  const raw = createSourceProgramNavigation(checked, { sourceFiles, ...inventory });
  const references = new WeakMap<Node, SourceNodeReference | null>();
  const projectReferences = new WeakMap<Node, SourceNodeReference | null>();
  const constructors = new WeakMap<Node, SourceResult<SourceNodeConstructors>>();
  const heritages = new WeakMap<Node, SourceResult<SourceNodeHeritage>>();
  const paths = new WeakMap<Node, WeakMap<Node, ReturnType<SourceNodeNavigationFacts["declaredHeritagePath"]>>>();
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  const originalReference = (value: SourceDeclarationReference, occurrence: Node): SourceNodeReference => {
    assertNode(value.declaration);
    return Object.freeze({ meaning: sourceReferenceMeaning(ast, occurrence), declaration: value.declaration,
      sourceFile: value.sourceFile, project: value.project });
  };
  const reference = (node: Node | undefined, project: boolean): SourceNodeReference | undefined => {
    if (node === undefined) return undefined;
    assertNode(node);
    const cache = project ? projectReferences : references;
    const existing = cache.get(node);
    if (existing !== undefined) return existing ?? undefined;
    const selected = project ? raw.referenceFor(node) : raw.sourceReferenceFor(node);
    const result = selected === undefined ? undefined : originalReference({ ...selected,
      project: project || "project" in selected && selected.project === true }, node);
    cache.set(node, result ?? null);
    return result;
  };
  const edge = (value: SourceDeclaredHeritageEdge): SourceResult<SourceNodeHeritageEdge> => {
    assertNode(value.heritage);
    const selected = publish(identities.component(value.heritage, [], value.selectedType));
    if (selected.kind === "refused") return selected;
    const arguments_: SourceTypeEvidence[] = [];
    for (let index = 0; index < value.selectedTypeArguments.length; index += 1) {
      const argument = publish(identities.component(value.heritage,
        [{ kind: "type-argument", declaration: value.target.declaration, index }], value.selectedTypeArguments[index]));
      if (argument.kind === "refused") return argument;
      arguments_.push(argument.value);
    }
    return resolved(Object.freeze({ kind: value.kind, sourceDeclaration: value.sourceDeclaration,
      heritage: value.heritage, target: originalReference(value.target, value.heritage),
      typeArguments: value.typeArguments, selected: selected.value, arguments: Object.freeze(arguments_) }));
  };
  const edges = (values: readonly SourceDeclaredHeritageEdge[]): SourceResult<SourceNodeHeritage> => {
    const selected: SourceNodeHeritageEdge[] = [];
    for (const value of values) {
      const current = edge(value);
      if (current.kind === "refused") return current;
      selected.push(current.value);
    }
    return resolved(Object.freeze({ kind: "resolved", edges: Object.freeze(selected) }));
  };
  const within = (node: Node, root: Node): boolean => {
    const seen = new Set<Node>();
    let current: Node | undefined = node;
    while (current !== undefined) {
      if (current === root) return true;
      if (seen.has(current)) throw new Error("Source references require acyclic original parent identities.");
      seen.add(current);
      current = ast.parent(current);
    }
    return false;
  };
  const implementation = (declaration: Node, contract?: Node): ReturnType<SourceNodeNavigationFacts["memberImplementation"]> => {
    assertNode(declaration);
    if (contract !== undefined) assertNode(contract);
    const selected = contract === undefined ? raw.callableImplementation(declaration) : raw.memberImplementation(declaration, contract);
    return selected.kind !== "resolved" ? selected : Object.freeze({ kind: "resolved",
      contractDeclaration: selected.contractDeclaration, implementation: originalReference(selected.implementation, declaration) });
  };
  const facts: SourceNodeNavigationFacts = Object.freeze({
    sourceFiles, nodes: inventory.nodes, referenceIndexStatistics: raw.referenceIndexStatistics, includes: inventory.contains,
    profileDeclaration: input.profileDeclaration,
    callableRoles: (node: Node) => { assertNode(node); return raw.callableRoles(node); },
    enclosing: (node: Node | undefined, role: SourceCallableRole) => raw.enclosing(node, role),
    nodesForFiles: inventory.nodesForFiles,
    sourceReferenceFor: (node: Node | undefined) => reference(node, false),
    referenceFor: (node: Node | undefined) => reference(node, true),
    declarationFor: (node: Node | undefined) => reference(node, true)?.declaration,
    moduleDependencies: (file: SourceFile) => raw.moduleDependencies(file),
    moduleReferences: (file: SourceFile) => raw.moduleReferences(file),
    moduleSpecifierResolution: (specifier: Node) => raw.moduleSpecifierResolution(specifier),
    moduleExports: (file: SourceFile) => Object.freeze(raw.moduleExports(file).map(value =>
      Object.freeze({ exportName: value.exportName, declaration: value.declaration, sourceFile: value.sourceFile }))),
    moduleHasTopLevelAwait: (file: SourceFile) => raw.moduleHasTopLevelAwait(file),
    memberDispatch: (node: Node | undefined) => raw.memberDispatch(node),
    memberImplementation: (declaration: Node, contract: Node) => implementation(declaration, contract),
    memberContracts: (declaration: Node) => raw.memberContracts(declaration),
    callableImplementation: (declaration: Node) => implementation(declaration),
    classConstructors(declaration: Node): SourceResult<SourceNodeConstructors> {
      assertNode(declaration);
      const existing = constructors.get(declaration);
      if (existing !== undefined) return existing;
      const original = raw.classConstructors(declaration);
      if (original.kind === "unresolved") return resolved(original);
      const signatures: Extract<SourceNodeConstructors, { readonly kind: "resolved" }>["signatures"][number][] = [];
      for (const selected of original.signatures) {
        const originalIdentity = originalSignature(declaration, "construct", selected.signature);
        const identity = signature(originalIdentity);
        const parameters: typeof signatures[number]["parameters"][number][] = [];
        for (const parameter of selected.parameters) {
          const value = publish(identities.component(declaration,
            [{ kind: "parameter", signature: originalIdentity, index: parameter.parameterIndex }], parameter.selectedType));
          if (value.kind === "refused") return value;
          parameters.push(Object.freeze({ parameterIndex: parameter.parameterIndex, parameterName: parameter.parameterName,
            parameterDeclaration: parameter.parameterDeclaration,
            ...(parameter.authoredTypeNode === undefined ? {} : { authoredTypeNode: parameter.authoredTypeNode }),
            value: value.value, acceptsOmission: parameter.acceptsOmission, rest: parameter.rest }));
        }
        const base = selected.base === undefined ? Object.freeze({ kind: "none" } as const)
          : Object.freeze({ kind: "present" as const, value: Object.freeze({ declaration: selected.base.declaration,
            identity: signature(originalSignature(selected.base.declaration, "construct", selected.base.signature)) }) });
        signatures.push(Object.freeze({ identity, base, parameters: Object.freeze(parameters) }));
      }
      const result = resolved(Object.freeze({ kind: "resolved", declaration,
        witness: original.implicit ? "implicit" : "declared", signatures: Object.freeze(signatures) } as const));
      constructors.set(declaration, result);
      return result;
    },
    declaredHeritage(declaration: Node): SourceResult<SourceNodeHeritage> {
      assertNode(declaration);
      const existing = heritages.get(declaration);
      if (existing !== undefined) return existing;
      const original = raw.declaredHeritage(declaration);
      const result = original.kind === "unresolved" ? resolved(original) : edges(original.edges);
      heritages.set(declaration, result);
      return result;
    },
    declaredHeritagePath(source: Node, target: Node): ReturnType<SourceNodeNavigationFacts["declaredHeritagePath"]> {
      assertNode(source);
      assertNode(target);
      let targets = paths.get(source);
      const existing = targets?.get(target);
      if (existing !== undefined) return existing;
      const original = raw.declaredHeritagePath(source, target);
      const result = original.kind === "related" ? edges(original.edges) : resolved(original);
      if (targets === undefined) { targets = new WeakMap(); paths.set(source, targets); }
      targets.set(target, result);
      return result;
    },
    declarationWrites(declaration: Node, root: Node): readonly SourceNodeWrite[] {
      assertNode(declaration);
      assertNode(root);
      return Object.freeze(raw.referencesToDeclaration(declaration).filter(node => within(node, root))
        .map(node => sourceBindingWriteAtReference(ast, node))
        .filter((value): value is SourceNodeWrite => value !== undefined && value.kind !== "initialization"));
    },
    referencesToDeclaration: (declaration: Node) => { assertNode(declaration); return raw.referencesToDeclaration(declaration); },
    declarationUses: (declaration: Node) => raw.declarationUses(declaration),
    declarationUseSummary: (declaration: Node) => raw.declarationUseSummary(declaration),
    parameterUseSummary: (parameter: Node) => raw.parameterUseSummary(parameter),
    countedLoop(statement: Node) {
      const selected = raw.countedLoop(statement);
      return selected === undefined ? undefined : Object.freeze({ statement: selected.statement,
        counterDeclaration: selected.counterDeclaration, start: selected.start, bound: selected.bound, body: selected.body,
        direction: selected.direction, comparison: selected.comparison, step: selected.step });
    },
    expressionValueFlow: (expression: Node) => raw.expressionValueFlow(expression),
    expressionResultUse: (expression: Node) => raw.expressionResultUse(expression),
    expressionResultDisposition: (expression: Node) => raw.expressionResultDisposition(expression),
    expressionEffects: (expression: Node) => raw.expressionEffects(expression),
    hasReferenceOutside(declaration: Node, excluded: Node): boolean {
      assertNode(declaration);
      assertNode(excluded);
      return raw.referencesToDeclaration(declaration).some(node => !within(node, excluded));
    },
    isProjectShape: (node: Node | undefined) => raw.isProjectShape(node),
    isProjectConstructibleObject: (node: Node | undefined) => raw.isProjectConstructibleObject(node),
    isProjectDeclaration: (node: Node | undefined) => raw.isProjectDeclaration(node),
    providerDeclaration(node: Node) {
      assertNode(node);
      const selected = checked.sourceFacts.getFact(node, providerVirtualDeclarationFactKey);
      return selected === undefined ? Object.freeze({ kind: "none" }) : Object.freeze({ kind: "present", value: selected });
    },
  });
  return Object.freeze({ facts, analysis: Object.freeze({
    enclosing: (node: Node | undefined, role: SourceCallableRole, visit: (node: Node) => boolean) => raw.enclosing(node, role, visit),
  }) });
}
