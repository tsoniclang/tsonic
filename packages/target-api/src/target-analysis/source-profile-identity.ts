import type { AstReader, Node, ProviderVirtualDeclarationFact } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";
import type { SourceProfileDeclarationIdentity } from "../source-model/profile-identity.js";

export function createSourceProfileDeclarationQuery(input: {
  readonly ast: AstReader;
  readonly assertNode: (node: Node) => void;
  readonly owner: (node: Node) => SourcePresence<string>;
  readonly providerDeclaration: (node: Node) => SourcePresence<ProviderVirtualDeclarationFact>;
  readonly wellKnownDeclaration: (node: Node) => SourcePresence<Node>;
}): (declaration: Node) => SourcePresence<SourceProfileDeclarationIdentity> {
  const { ast, assertNode, owner, providerDeclaration, wellKnownDeclaration } = input;
  const retained = new WeakMap<Node, SourcePresence<SourceProfileDeclarationIdentity>>();
  const none = Object.freeze({ kind: "none" } as const);
  const typeKinds = new Set(["KindInterfaceDeclaration", "KindClassDeclaration", "KindTypeAliasDeclaration", "KindEnumDeclaration"]);
  const memberKinds = new Set(["KindMethodSignature", "KindPropertySignature", "KindMethodDeclaration",
    "KindPropertyDeclaration", "KindGetAccessor", "KindSetAccessor"]);
  const nameOf = (declaration: Node): string | undefined => {
    assertNode(declaration);
    const name = ast.name(declaration);
    if (name === undefined) return undefined;
    if (ast.is.IsComputedPropertyName(name)) {
      const symbol = wellKnownDeclaration(name);
      if (symbol.kind === "none") return undefined;
      assertNode(symbol.value);
      const original = ast.name(symbol.value);
      return original === undefined || !ast.is.IsIdentifier(original) ? undefined : `Symbol.${ast.text(original)}`;
    }
    const kind = ast.kindName(name);
    return kind === "KindIdentifier" || kind === "KindStringLiteral" || kind === "KindNumericLiteral" || kind === "KindPrivateIdentifier"
      ? ast.text(name) : undefined;
  };
  return declaration => {
    assertNode(declaration);
    const existing = retained.get(declaration);
    if (existing !== undefined) return existing;
    const selectedOwner = owner(declaration);
    if (selectedOwner.kind === "none") { retained.set(declaration, none); return none; }
    const kind = ast.kindName(declaration);
    const provider = providerDeclaration(declaration);
    let parent = ast.parent(declaration);
    if (parent !== undefined && ast.kindName(parent) === "KindTypeLiteral") {
      const alias = ast.parent(parent);
      if (alias !== undefined && ast.is.IsTypeAliasDeclaration(alias) && ast.typeNode(alias) === parent) parent = alias;
    }
    const parentKind = parent === undefined ? undefined : ast.kindName(parent);
    const providerValue = provider.kind === "present" ? provider.value : undefined;
    const declaringName = providerValue?.exportName ?? (parent !== undefined && parentKind !== undefined && typeKinds.has(parentKind) ? nameOf(parent) : undefined);
    const memberKey = providerValue?.memberKey;
    const name = memberKey?.kind === "property-key" ? memberKey.name
      : memberKey?.kind === "well-known-symbol" ? `Symbol.${memberKey.name}`
      : providerValue?.memberName ?? nameOf(declaration);
    let identity: SourceProfileDeclarationIdentity | undefined;
    const base = { owner: selectedOwner.value, declaration };
    if (typeKinds.has(kind)) identity = { ...base, kind: "type", declaringName: undefined, name: providerValue?.exportName ?? name };
    else if (kind === "KindIndexSignature" || kind === "KindMappedType")
      identity = { ...base, kind: "indexer", declaringName, name: undefined };
    else if (kind === "KindConstructSignature" || kind === "KindConstructor")
      identity = { ...base, kind: "construct", declaringName, name: undefined };
    else if (kind === "KindCallSignature") identity = { ...base, kind: "call", declaringName, name: undefined };
    else if (kind === "KindFunctionDeclaration") identity = { ...base, kind: "call", declaringName: undefined, name: providerValue?.exportName ?? name };
    else if (memberKinds.has(kind)) identity = { ...base, kind: "member", declaringName, name };
    const result: SourcePresence<SourceProfileDeclarationIdentity> = identity === undefined ? none
      : Object.freeze({ kind: "present", value: Object.freeze(identity) });
    retained.set(declaration, result);
    return result;
  };
}
