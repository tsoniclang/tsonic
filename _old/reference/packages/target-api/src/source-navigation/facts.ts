import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputSignature } from "../host-input/identities.js";
import type { SourceInputNodeNavigationQueries, SourceInputHeritage } from "../host-input/navigation-input.js";
import type { SourcePresence, SourceResult, SourceSignatureIdentity, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceNodeConstructors, SourceNodeHeritage, SourceNodeHeritageEdge, SourceNodeNavigationFacts } from "../source-model/navigation.js";
import type { SourceProfileDeclarationIdentity } from "../source-model/profile-identity.js";
import { createSourceEnclosingQuery, sourceCallableRoles, type SourceCallableRole } from "./callable-boundaries.js";

export interface SourceNodeNavigationOwner {
  readonly facts: SourceNodeNavigationFacts;
  readonly analysis: {
    enclosing(node: Node | undefined, role: SourceCallableRole, visit: (node: Node) => boolean): Node | undefined;
  };
}

export function createSourceNodeNavigationFacts(options: {
  readonly ast: AstReader;
  readonly input: SourceInputNodeNavigationQueries;
  readonly assertNode: (node: Node) => void;
  readonly signature: (original: SourceInputSignature) => SourceSignatureIdentity;
  readonly publish: (component: SourceInputComponent) => SourceResult<SourceTypeEvidence>;
  readonly profileDeclaration: (node: Node) => SourcePresence<SourceProfileDeclarationIdentity>;
}): SourceNodeNavigationOwner {
  const { ast, input, assertNode, signature, publish, profileDeclaration } = options;
  const enclosing = createSourceEnclosingQuery(ast);
  const constructors = new WeakMap<Node, SourceResult<SourceNodeConstructors>>();
  const heritages = new WeakMap<Node, SourceResult<SourceNodeHeritage>>();
  const paths = new WeakMap<Node, WeakMap<Node, ReturnType<SourceNodeNavigationFacts["declaredHeritagePath"]>>>();
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  const edges = (original: SourceInputHeritage): SourceResult<SourceNodeHeritage> => {
    if (original.kind === "unresolved") { assertNode(original.heritage); return resolved(original); }
    const selected: SourceNodeHeritageEdge[] = [];
    for (const edge of original.edges) {
      assertNode(edge.sourceDeclaration);
      assertNode(edge.heritage);
      assertNode(edge.target.declaration);
      edge.typeArguments.forEach(assertNode);
      const value = publish(edge.selected);
      if (value.kind === "refused") return value;
      const arguments_: SourceTypeEvidence[] = [];
      for (const argument of edge.arguments) {
        const current = publish(argument);
        if (current.kind === "refused") return current;
        arguments_.push(current.value);
      }
      selected.push(Object.freeze({ kind: edge.kind, sourceDeclaration: edge.sourceDeclaration,
        heritage: edge.heritage, target: edge.target, typeArguments: edge.typeArguments,
        selected: value.value, arguments: Object.freeze(arguments_) }));
    }
    return resolved(Object.freeze({ kind: "resolved", edges: Object.freeze(selected) }));
  };
  const enclosingFor = (node: Node | undefined, role: SourceCallableRole, visit?: (node: Node) => boolean): Node | undefined => {
    if (node !== undefined) assertNode(node);
    const selected = enclosing(node, role, visit);
    if (selected !== undefined) assertNode(selected);
    return selected;
  };
  const facts: SourceNodeNavigationFacts = Object.freeze({ ...input,
    profileDeclaration(node: Node) { assertNode(node); return profileDeclaration(node); },
    callableRoles(node: Node) { assertNode(node); return sourceCallableRoles(ast, node); },
    enclosing: (node: Node | undefined, role: SourceCallableRole) => enclosingFor(node, role),
    classConstructors(declaration: Node): SourceResult<SourceNodeConstructors> {
      assertNode(declaration);
      const previous = constructors.get(declaration);
      if (previous !== undefined) return previous;
      const original = input.classConstructors(declaration);
      if (original.declaration !== declaration) throw new Error("A Source constructor inventory retains its exact original class.");
      if (original.kind === "unresolved") return resolved(original);
      const signatures: Extract<SourceNodeConstructors, { readonly kind: "resolved" }>["signatures"][number][] = [];
      for (const selected of original.signatures) {
        const identity = signature(selected.identity);
        const parameters: typeof signatures[number]["parameters"][number][] = [];
        for (const parameter of selected.parameters) {
          if (parameter.parameterDeclaration !== undefined) assertNode(parameter.parameterDeclaration);
          if (parameter.authoredTypeNode !== undefined) assertNode(parameter.authoredTypeNode);
          const value = publish(parameter.value);
          if (value.kind === "refused") return value;
          parameters.push(Object.freeze({ parameterIndex: parameter.parameterIndex, parameterName: parameter.parameterName,
            parameterDeclaration: parameter.parameterDeclaration,
            ...(parameter.authoredTypeNode === undefined ? {} : { authoredTypeNode: parameter.authoredTypeNode }),
            value: value.value, acceptsOmission: parameter.acceptsOmission, rest: parameter.rest }));
        }
        if (selected.base.kind === "present") assertNode(selected.base.value.declaration);
        const base = selected.base.kind === "none" ? selected.base : Object.freeze({ kind: "present" as const,
          value: Object.freeze({ declaration: selected.base.value.declaration, identity: signature(selected.base.value.identity) }) });
        signatures.push(Object.freeze({ identity, base, parameters: Object.freeze(parameters) }));
      }
      const result: SourceResult<SourceNodeConstructors> = resolved(Object.freeze({ kind: "resolved", declaration,
        witness: original.witness, signatures: Object.freeze(signatures) }));
      constructors.set(declaration, result);
      return result;
    },
    declaredHeritage(declaration: Node): SourceResult<SourceNodeHeritage> {
      assertNode(declaration);
      const previous = heritages.get(declaration);
      if (previous !== undefined) return previous;
      const selected = edges(input.declaredHeritage(declaration));
      heritages.set(declaration, selected);
      return selected;
    },
    declaredHeritagePath(source: Node, target: Node): ReturnType<SourceNodeNavigationFacts["declaredHeritagePath"]> {
      assertNode(source);
      assertNode(target);
      let byTarget = paths.get(source);
      const previous = byTarget?.get(target);
      if (previous !== undefined) return previous;
      const original = input.declaredHeritagePath(source, target);
      const selected = original.kind === "unrelated" ? resolved(original) : edges(original);
      if (byTarget === undefined) { byTarget = new WeakMap(); paths.set(source, byTarget); }
      byTarget.set(target, selected);
      return selected;
    },
  });
  return Object.freeze({ facts, analysis: Object.freeze({
    enclosing: (node: Node | undefined, role: SourceCallableRole, visit: (node: Node) => boolean) => enclosingFor(node, role, visit),
  }) });
}
