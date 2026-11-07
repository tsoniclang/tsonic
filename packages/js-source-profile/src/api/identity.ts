// JS API declaration identity (D18): which JS standard-library entity a declaration is. Target-neutral; moved from
// the Source half of tsonic-csharp policy/identities/selected-source.ts. Published as facts.profile.identity; a target
// keys its own mapping by it.
import { providerVirtualDeclarationFactKey, type AstReader, type Node, type ReadonlySourceFactResolver } from "@tsonic/tsts";
import { isTsonicSourceProfileDeclarationPath } from "@tsonic/target-api/provider";
import type { SourceJsApiIdentity } from "@tsonic/target-api/source";
import { jsSourceSemanticsIdentity } from "../identities/source.js";

export type JsSourceApiIdentity = SourceJsApiIdentity;

/**
 * A profile declaration identity with its scope. "js": a declaration of the JS source profile (or of its provider).
 * "profile": a declaration under another target source profile; such a profile includes the shared base declarations
 * of this package (Error, Promise, Object, ...), so the JS API table also answers its constructor and call signatures
 * and its native operations.
 */
export interface JsSourceProfileIdentity {
  readonly scope: "js" | "profile";
  readonly identity: JsSourceApiIdentity;
}

export interface JsSourceApiIdentityInput {
  readonly ast: AstReader;
  readonly sourceFacts: ReadonlySourceFactResolver;
  /** `Symbol.iterator` ... for a computed member name, from the selections. */
  wellKnownSymbol(node: Node): string | undefined;
}

const typeDeclarationKinds: ReadonlySet<string> = new Set([
  "KindInterfaceDeclaration", "KindClassDeclaration", "KindTypeAliasDeclaration", "KindEnumDeclaration",
]);
const namedMemberKinds: ReadonlySet<string> = new Set([
  "KindMethodSignature", "KindPropertySignature", "KindMethodDeclaration", "KindPropertyDeclaration",
  "KindGetAccessor", "KindSetAccessor",
]);

/** The profile identity of a declaration, or undefined when no source profile declares it. */
export function jsSourceProfileIdentity(input: JsSourceApiIdentityInput, declaration: Node): JsSourceProfileIdentity | undefined {
  const { ast } = input;
  const provided = providerIdentity(input, declaration);
  if (provided !== undefined) return Object.freeze({ scope: "js", identity: provided });
  const sourceFile = ast.getSourceFile(declaration);
  const fileName = sourceFile === undefined ? undefined : ast.getFileName(sourceFile);
  if (fileName === undefined || !isTsonicSourceProfileDeclarationPath(fileName)) return undefined;
  const identity = structuralIdentity(input, declaration);
  return identity === undefined ? undefined : Object.freeze({
    scope: isTsonicSourceProfileDeclarationPath(fileName, "js") ? "js" : "profile", identity });
}

/** The identity a profile declaration has by its declaration structure (declaring entity and member name). */
function structuralIdentity(input: JsSourceApiIdentityInput, declaration: Node): JsSourceApiIdentity | undefined {
  const { ast } = input;
  const kind = ast.kindName(declaration);
  const parent = ast.parent(declaration);
  const parentKind = parent === undefined ? undefined : ast.kindName(parent);
  if (kind === "KindFunctionDeclaration" && parentKind === "KindSourceFile") {
    const name = declarationName(input, declaration);
    return name === undefined ? undefined : Object.freeze({ kind: "call", declaringName: "Global", name, declaration });
  }
  if (typeDeclarationKinds.has(kind) && parentKind === "KindSourceFile") {
    const name = declarationName(input, declaration);
    return name === undefined ? undefined : Object.freeze({ kind: "type", name, declaration });
  }
  if (kind === "KindMappedType" && parent !== undefined && parentKind === "KindTypeAliasDeclaration") {
    const declaringName = declarationName(input, parent);
    return declaringName === undefined ? undefined : Object.freeze({ kind: "indexer", declaringName, declaration });
  }
  if (parent === undefined || parentKind === undefined || !typeDeclarationKinds.has(parentKind)) return undefined;
  const declaringName = declarationName(input, parent);
  if (declaringName === undefined) return undefined;
  if (kind === "KindIndexSignature") return Object.freeze({ kind: "indexer", declaringName, declaration });
  if (kind === "KindCallSignature") return Object.freeze({ kind: "call", declaringName, declaration });
  if (kind === "KindConstructSignature") return Object.freeze({ kind: "construct", declaringName, declaration });
  if (!namedMemberKinds.has(kind)) return undefined;
  const name = declarationName(input, declaration);
  return name === undefined ? undefined : Object.freeze({ kind: "member", declaringName, name, declaration });
}

function providerIdentity(input: JsSourceApiIdentityInput, declaration: Node): JsSourceApiIdentity | undefined {
  const { ast } = input;
  const fact = input.sourceFacts.getFact(declaration, providerVirtualDeclarationFactKey);
  if (fact?.providerId !== jsSourceSemanticsIdentity.providerId || fact.exportName === undefined) return undefined;
  const kind = ast.kindName(declaration);
  if (typeDeclarationKinds.has(kind)) return Object.freeze({ kind: "type", name: fact.exportName, declaration });
  if (kind === "KindIndexSignature") return Object.freeze({ kind: "indexer", declaringName: fact.exportName, declaration });
  const memberKey = fact.memberKey;
  const name = memberKey?.kind === "property-key" ? memberKey.name
    : memberKey?.kind === "well-known-symbol" ? `Symbol.${memberKey.name}` : fact.memberName;
  if (name === undefined) {
    return fact.signatureId === undefined ? undefined
      : Object.freeze({ kind: "call", declaringName: fact.exportName, name: fact.exportName, declaration });
  }
  return Object.freeze({ kind: "member", declaringName: fact.exportName, name, declaration });
}

function declarationName(input: JsSourceApiIdentityInput, declaration: Node): string | undefined {
  const { ast } = input;
  const name = ast.name(declaration);
  if (name === undefined) return undefined;
  if (ast.is.IsComputedPropertyName(name)) return input.wellKnownSymbol(name);
  const kind = ast.kindName(name);
  if (kind !== "KindIdentifier" && kind !== "KindStringLiteral" && kind !== "KindNumericLiteral" &&
    kind !== "KindPrivateIdentifier") return undefined;
  const text = ast.text(name);
  return text === "" ? undefined : text;
}
