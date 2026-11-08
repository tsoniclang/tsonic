import type { Node, SourceFile } from "@tsonic/tsts";
import type { SourceDescriptorInput } from "../host-input/descriptor-input.js";
import type { SourceInputComponent } from "../host-input/identities.js";
import type { SourceNodeNavigationFacts } from "../source-model/navigation.js";
import { sourceFiniteLiteralDomain } from "../source-model/literals/domain.js";
import type { SourceEnumDeclaration, SourceEnumFacts, SourceEnumMember, SourceRefusal, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceDescriptorBuilder } from "./descriptor-contracts.js";
import { createSourceEnumConstantLedger } from "./enum-constants.js";
import { sourceSemanticRefusal } from "./local-type-flow/semantic-production.js";

export function createSourceEnumFacts(input: {
  readonly sourceFiles: readonly SourceFile[];
  readonly input: SourceDescriptorInput;
  readonly navigation: SourceNodeNavigationFacts;
  readonly builder: SourceDescriptorBuilder;
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
      builder.define(owner, [], () => nativeBase(owner));
      const category = typeof constant.value === "string" ? "string" : "number";
      const value = builder.evidence({ type: builder.declared({ declaration: owner, typeArguments: [] }),
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

  return Object.freeze({ facts: Object.freeze({ declaration, member }), refusals: () => Object.freeze([...issues]),
    value(component: SourceInputComponent, node: Node): SourceResult<SourceTypeEvidence> {
      input.input.assertComponent(component);
      if (ast.is.IsEnumMember(node)) {
        const selected = member(node);
        return selected.kind === "refused" ? selected : builder.join(builder.componentIdentity(component.root, []), "inferred", [selected.value.value], component);
      }
      const selected = declaration(node);
      if (selected.kind === "refused") return selected;
      builder.define(node, [], () => nativeBase(node));
      const joined = builder.join(builder.componentIdentity(node, []), "authored", selected.value.members.map(member => member.value), component);
      return joined;
    },
  });
}
