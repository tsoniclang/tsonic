import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../host-input/descriptor-input.js";
import type { SourceInputComponent } from "../host-input/identities.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import { sourceFiniteLiteralDomain, sourcePresentLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceCategoryDomain, SourceEnumDeclaration, SourceEnumFacts, SourceEnumMember, SourceRefusal, SourceResult, SourceTypeComponent, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceDescriptorBuilder } from "./descriptor-contracts.js";
import { createSourceEnumConstantLedger } from "./enum-constants.js";
import { sourceSemanticRefusal } from "./local-type-flow/semantic-production.js";

export function createSourceEnumFacts(input: {
  readonly sourceFiles: readonly SourceFile[];
  readonly input: SourceDescriptorInput;
  readonly navigation: SourceNodeNavigationFacts;
  readonly builder: SourceDescriptorBuilder;
  componentIdentity(component: SourceInputComponent): SourceTypeComponent;
}): {
  readonly facts: SourceEnumFacts;
  value(component: SourceInputComponent, declaration: Node): SourceResult<SourceTypeEvidence>;
  refusals(): readonly SourceRefusal[];
} {
  const { builder } = input;
  const { ast } = input.input;
  const ledger = createSourceEnumConstantLedger(input, input.navigation);
  const declarations = new WeakMap<Node, SourceResult<SourceEnumDeclaration>>();
  const members = new WeakMap<Node, SourceResult<SourceEnumMember>>();
  const underlying = new WeakMap<Node, SourceResult<SourceTypeEvidence>>();
  const issues = new Set<SourceRefusal>();
  for (const issue of ledger.issues) issues.add(sourceSemanticRefusal(issue.sourceNode, issue.message, issue.code));

  function refuse(site: Node, message: string, code = "TSONIC_ENUM_NUMERIC_USE_NOT_SUPPORTED"): SourceRefusal {
    const refusal = sourceSemanticRefusal(site, message, code);
    issues.add(refusal);
    return refusal;
  }

  function nativeBase(declaration: Node): SourceResult<SourceTypeEvidence> {
    const previous = underlying.get(declaration);
    if (previous !== undefined) return previous;
    const selected = ledger.integerWidth(declaration);
    const value: SourceResult<SourceTypeEvidence> = selected === undefined
      ? refuse(declaration, "An enum requires its complete original constant and width inventory.")
      : selected.kind === "rejected" ? refuse(selected.member, selected.reason, selected.admissionIssue?.code)
        : { kind: "resolved", value: builder.evidence({ type: builder.primitive(selected.integerWidth === 32 ? "int32" : "int64"),
          component: builder.componentIdentity(declaration, []), category: { kind: "known", category: "number" },
          numeric: { producer: declaration, kind: "declared", category: { kind: "known", category: "number" } }, sum: undefined },
        [], input.input.syntax(declaration), { kind: "open", presence: "present" },
        { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [declaration] } }) };
    underlying.set(declaration, value);
    return value;
  }

  function member(declaration: Node): SourceResult<SourceEnumMember> {
    input.input.assertNode(declaration);
    if (!ast.is.IsEnumMember(declaration)) throw new Error("A Source enum member query requires its actual original enum member.");
    const previous = members.get(declaration);
    if (previous !== undefined) return previous;
    const owner = ast.parent(declaration);
    if (owner === undefined || !ast.is.IsEnumDeclaration(owner)) throw new Error("An original enum member requires its exact original owner.");
    const constant = ledger.get(declaration);
    let result: SourceResult<SourceEnumMember>;
    if (constant === undefined) result = refuse(declaration, "An enum member requires its complete original constant observation.");
    else if (constant.kind === "rejected") result = refuse(declaration, constant.reason);
    else {
      builder.define({ kind: "declaration", declaration: owner, facet: "instance" }, [], () => nativeBase(owner), () => ({ kind: "resolved", value: { kind: "unavailable" } }));
      const category = typeof constant.value === "string" ? "string" : "number";
      const value = builder.evidence({ type: builder.declared({ declaration: owner, facet: "instance", typeArguments: [] }),
        component: builder.componentIdentity(declaration, []), category: { kind: "known", category },
        numeric: category === "number" ? { producer: declaration, kind: "literal", category: { kind: "known", category } } : undefined,
        sum: undefined }, [], input.input.syntax(declaration), sourceFiniteLiteralDomain([typeof constant.value === "string"
        ? { kind: "string", value: constant.value } : { kind: "number", value: { kind: "integer", value: constant.value } }]),
      { members: { kind: "definition" }, origins: { kind: "complete", nodes: [declaration, owner] } });
      result = { kind: "resolved", value: Object.freeze({ declaration, owner, value, constant: constant.value }) };
    }
    members.set(declaration, result);
    return result;
  }

  function declaration(node: Node): SourceResult<SourceEnumDeclaration> {
    input.input.assertNode(node);
    if (!ast.is.IsEnumDeclaration(node)) throw new Error("A Source enum declaration query requires its actual original enum declaration.");
    const previous = declarations.get(node);
    if (previous !== undefined) return previous;
    const base = nativeBase(node);
    if (base.kind === "refused") { declarations.set(node, base); return base; }
    const selected: SourceEnumMember[] = [];
    for (const child of ast.as.AsEnumDeclaration(node)?.Members?.Nodes ?? []) {
      if (child === undefined) throw new Error("An original enum declaration requires its complete original member vector.");
      const value = member(child);
      if (value.kind === "refused") { declarations.set(node, value); return value; }
      selected.push(value.value);
    }
    const result: SourceResult<SourceEnumDeclaration> = { kind: "resolved", value: Object.freeze({ declaration: node,
      underlying: base.value, members: Object.freeze(selected) }) };
    declarations.set(node, result);
    return result;
  }

  function nominal(component: SourceInputComponent, declaration: Node): SourceTypeEvidence {
    builder.define({ kind: "declaration", declaration, facet: "instance" }, [], () => nativeBase(declaration), () => ({ kind: "resolved", value: { kind: "unavailable" } }));
    const categories = new Set<"string" | "number">();
    let complete = true;
    for (const member of ast.as.AsEnumDeclaration(declaration)?.Members?.Nodes ?? []) {
      if (member === undefined) throw new Error("An original enum requires every original member declaration.");
      const constant = ledger.get(member);
      if (constant?.kind !== "resolved") complete = false;
      else categories.add(typeof constant.value === "string" ? "string" : "number");
    }
    const category: SourceCategoryDomain = !complete || categories.size === 0 ? { kind: "dynamic" }
      : categories.size === 1 ? { kind: "known", category: [...categories][0]! }
        : { kind: "choice", alternatives: [...categories].map(category => ({ kind: "known", category })) };
    return builder.evidence({ type: builder.declared({ declaration, facet: "instance", typeArguments: [] }), component: input.componentIdentity(component),
      category, numeric: category.kind === "known" && category.category === "number"
        ? { producer: declaration, kind: "declared", category } : undefined, sum: undefined },
    [], component, sourcePresentLiteralDomain,
    { members: { kind: "definition" }, origins: { kind: "complete", nodes: [declaration] } });
  }

  return Object.freeze({ facts: Object.freeze({ declaration, member }), refusals: () => Object.freeze([...issues]),
    value(component: SourceInputComponent, node: Node): SourceResult<SourceTypeEvidence> {
      input.input.assertComponent(component);
      if (ast.is.IsEnumMember(node)) {
        const owner = ast.parent(node);
        if (owner === undefined || !ast.is.IsEnumDeclaration(owner)) throw new Error("An original enum member requires its enum owner.");
        const observed = input.input.enumDeclaration(owner).members.find(member => member.declaration === node);
        if (ast.getSourceFile(owner)?.IsDeclarationFile && observed?.constant.kind === "unavailable")
          return { kind: "resolved", value: nominal(component, owner) };
        const selected = member(node);
        return selected.kind === "refused" ? selected : builder.join(input.componentIdentity(component), "inferred", [selected.value.value], component);
      }
      if (!ast.is.IsEnumDeclaration(node)) throw new Error("A nominal Source enum requires its original declaration or member.");
      return { kind: "resolved", value: nominal(component, node) };
    },
  });
}
