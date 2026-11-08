import type { Node } from "@tsonic/tsts";
import type { SourceJsApiFactsInput } from "@tsonic/target-api/host";
import type { SourceJsApiIdentity } from "@tsonic/target-api/source";
import { jsSourceSemanticsIdentity } from "../identities/source.js";

export interface JsProfileIdentity {
  readonly scope: "js" | "shared";
  readonly identity: SourceJsApiIdentity;
}

const typeKinds = new Set(["KindInterfaceDeclaration", "KindClassDeclaration", "KindTypeAliasDeclaration", "KindEnumDeclaration"]);
const memberKinds = new Set(["KindMethodSignature", "KindPropertySignature", "KindMethodDeclaration",
  "KindPropertyDeclaration", "KindGetAccessor", "KindSetAccessor"]);

export function createJsProfileIdentityQuery(input: SourceJsApiFactsInput): (declaration: Node) => JsProfileIdentity | undefined {
  const { syntax, assertNode, profileDeclaration, providerDeclaration, wellKnownSymbol } = input;
  const retained = new WeakMap<Node, JsProfileIdentity | null>();
  const nameOf = (declaration: Node): string | undefined => {
    const name = syntax.name(declaration);
    if (name === undefined) return undefined;
    if (syntax.is.IsComputedPropertyName(name)) {
      const symbol = wellKnownSymbol(name);
      return symbol === undefined ? undefined : `Symbol.${symbol}`;
    }
    const kind = syntax.kindName(name);
    if (!["KindIdentifier", "KindStringLiteral", "KindNumericLiteral", "KindPrivateIdentifier"].includes(kind)) return undefined;
    const text = syntax.text(name);
    return text === "" ? undefined : text;
  };
  const select = (declaration: Node): JsProfileIdentity | undefined => {
    const kind = syntax.kindName(declaration);
    const provider = providerDeclaration(declaration);
    if (provider?.providerId === jsSourceSemanticsIdentity.providerId && provider.exportName !== undefined) {
      const declaringName = provider.exportName;
      const member = provider.memberKey;
      const name = member?.kind === "property-key" ? member.name
        : member?.kind === "well-known-symbol" ? `Symbol.${member.name}` : provider.memberName;
      let identity: SourceJsApiIdentity | undefined;
      if (typeKinds.has(kind)) identity = { kind: "type", declaringName: undefined, name: declaringName, declaration };
      else if (kind === "KindIndexSignature") identity = { kind: "indexer", declaringName, name: undefined, declaration };
      else if (kind === "KindConstructSignature" || kind === "KindConstructor")
        identity = { kind: "construct", declaringName, name: undefined, declaration };
      else if (kind === "KindCallSignature") identity = { kind: "call", declaringName, name: undefined, declaration };
      else if (name !== undefined) identity = { kind: "member", declaringName, name, declaration };
      else if (kind === "KindFunctionDeclaration" && provider.signatureId !== undefined)
        identity = { kind: "call", declaringName: "Global", name: declaringName, declaration };
      return identity === undefined ? undefined : Object.freeze({ scope: "js", identity: Object.freeze(identity) });
    }
    const scope = profileDeclaration(declaration);
    if (scope === undefined) return undefined;
    const parent = syntax.parent(declaration);
    const parentKind = parent === undefined ? undefined : syntax.kindName(parent);
    let identity: SourceJsApiIdentity | undefined;
    if (parentKind === "KindSourceFile") {
      const name = nameOf(declaration);
      if (name !== undefined && typeKinds.has(kind)) identity = { kind: "type", declaringName: undefined, name, declaration };
      else if (name !== undefined && kind === "KindFunctionDeclaration") identity = { kind: "call", declaringName: "Global", name, declaration };
    } else if (parent !== undefined && parentKind !== undefined && typeKinds.has(parentKind)) {
      const declaringName = nameOf(parent);
      if (declaringName === undefined) return undefined;
      if (kind === "KindMappedType" || kind === "KindIndexSignature")
        identity = { kind: "indexer", declaringName, name: undefined, declaration };
      else if (kind === "KindCallSignature") identity = { kind: "call", declaringName, name: undefined, declaration };
      else if (kind === "KindConstructSignature" || kind === "KindConstructor")
        identity = { kind: "construct", declaringName, name: undefined, declaration };
      else if (memberKinds.has(kind)) {
        const name = nameOf(declaration);
        if (name !== undefined) identity = { kind: "member", declaringName, name, declaration };
      }
    }
    return identity === undefined ? undefined : Object.freeze({ scope, identity: Object.freeze(identity) });
  };
  return declaration => {
    assertNode(declaration);
    const known = retained.get(declaration);
    if (known !== undefined) return known ?? undefined;
    const selected = select(declaration);
    retained.set(declaration, selected ?? null);
    return selected;
  };
}
