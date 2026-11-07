import type { Node } from "@tsonic/tsts";
import type { HostSourceProgram } from "@tsonic/target-api/host";
import { readTsonicDataLayout, readTsonicMemoryFieldLayout, readTsonicMemoryLayout, readTsonicMemoryLayoutQuery, readTsonicRawMemoryOperation } from "./readers.js";
import type { TsonicDataLayoutFact, TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact } from "./facts.js";
import { tsonicMemoryFieldBindingFactKey, tsonicMemoryRecordBindingFactKey } from "./bindings/facts.js";

/** The Legacy witness behind a metadata expression. source-core internal: targets read layouts as Host records (R4). */
export type TsonicMemoryMetadata =
  | { readonly kind: "data-layout"; readonly fact: TsonicDataLayoutFact }
  | { readonly kind: "memory-layout"; readonly fact: TsonicMemoryLayoutFact }
  | { readonly kind: "memory-field"; readonly fact: TsonicMemoryFieldLayoutFact };

/** The runtime-value issues of a const declaration that holds compile-time memory metadata. */
export interface TsonicMemoryMetadataDeclaration {
  readonly issues: readonly { readonly node: Node; readonly reason: string }[];
}

/**
 * The published memory-metadata uses (facts.analyses, I1): which expressions are erased compile-time metadata and
 * which metadata declarations escape as runtime values. The layouts themselves are published once, as Host records
 * (`TsonicCoreSourceAnalyses.memory.layout`); the Legacy witnesses are not published (R4).
 */
export interface TsonicMemoryMetadataUses {
  /** undefined: the node is not a const declaration of memory metadata. */
  declaration(node: Node): TsonicMemoryMetadataDeclaration | undefined;
  isCompileTimeExpression(node: Node): boolean;
}

/** source-core internal index: the published uses plus the Legacy witness of a metadata expression. */
export interface TsonicMemoryMetadataIndex extends TsonicMemoryMetadataUses {
  value(node: Node | undefined): TsonicMemoryMetadata | undefined;
}

export function createTsonicMemoryMetadataIndex(source: HostSourceProgram): TsonicMemoryMetadataIndex {
  const { ast, sourceFacts, navigation } = source;
  const cache = new WeakMap<Node, TsonicMemoryMetadata | null>();
  const declarations = new WeakMap<Node, TsonicMemoryMetadataDeclaration | null>();
  return Object.freeze({ value, declaration, isCompileTimeExpression });

  function declaration(node: Node): TsonicMemoryMetadataDeclaration | undefined {
    if (!ast.is.IsVariableDeclaration(node)) return undefined;
    const cached = declarations.get(node);
    if (cached !== undefined) return cached ?? undefined;
    const metadata = value(node);
    if (metadata === undefined) {
      declarations.set(node, null);
      return undefined;
    }
    const issues: { readonly node: Node; readonly reason: string }[] = [];
    for (const use of navigation.declarationUses(node)) {
      if (use.kind === "type-only" || use.kind === "source-linkage") continue;
      let current: Node | undefined = use.reference;
      let accepted = false;
      while (current !== undefined) {
        if (isCompileTimeExpression(current) || ast.is.IsVariableDeclaration(current) && value(current) !== undefined) {
          accepted = true;
          break;
        }
        if (ast.is.IsCallExpression(current) || ast.is.IsFunctionDeclaration(current) ||
          ast.is.IsArrowFunction(current) || ast.is.IsSourceFile(current)) break;
        current = ast.parent(current);
      }
      if (!accepted) issues.push(Object.freeze({ node: use.reference,
        reason: "A finalized memory-layout descriptor is used as a runtime value rather than selected compile-time metadata." }));
    }
    const result = Object.freeze({ issues: Object.freeze(issues) });
    declarations.set(node, result);
    return result;
  }

  function isCompileTimeExpression(node: Node): boolean {
    const metadata = value(node);
    if ((metadata?.kind === "memory-layout" || metadata?.kind === "memory-field") && metadata.fact.call === node) return true;
    const parent = ast.parent(node);
    if (parent === undefined || !ast.is.IsCallExpression(parent)) return false;
    const query = readTsonicMemoryLayoutQuery(sourceFacts, parent);
    if (query?.call === parent && ast.arguments(parent).includes(node)) return true;
    const fieldBinding = sourceFacts.getFact(parent, tsonicMemoryFieldBindingFactKey);
    if (fieldBinding?.call === parent && fieldBinding.fieldExpression === node) return true;
    const recordBinding = sourceFacts.getFact(parent, tsonicMemoryRecordBindingFactKey);
    if (recordBinding?.call === parent && recordBinding.layoutExpression === node) return true;
    const raw = readTsonicRawMemoryOperation(sourceFacts, parent);
    return raw?.call === parent && (raw.operation === "reinterpret" || raw.operation === "to-raw"
      ? raw.layoutExpression === node : raw.dataLayoutExpression === node);
  }

  function value(node: Node | undefined): TsonicMemoryMetadata | undefined {
    if (node === undefined) return undefined;
    const prior = cache.get(node);
    if (prior !== undefined) return prior ?? undefined;
    const seen = new Set<Node>();
    let current: Node | undefined = node;
    let result: TsonicMemoryMetadata | undefined;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      if (ast.is.IsVariableDeclaration(current) && ast.variableDeclarationKind(current) !== "const") break;
      const data = readTsonicDataLayout(sourceFacts, current);
      const layout = readTsonicMemoryLayout(sourceFacts, current);
      const field = readTsonicMemoryFieldLayout(sourceFacts, current);
      if (data !== undefined || layout !== undefined || field !== undefined) {
        result = data !== undefined ? { kind: "data-layout", fact: data }
          : layout !== undefined ? { kind: "memory-layout", fact: layout }
            : { kind: "memory-field", fact: field! };
        break;
      }
      if (ast.is.IsParenthesizedExpression(current)) current = ast.as.AsParenthesizedExpression(current)?.Expression;
      else if (ast.is.IsIdentifier(current)) current = navigation.sourceReferenceFor(current)?.declaration;
      else if (ast.is.IsVariableDeclaration(current) && ast.variableDeclarationKind(current) === "const") {
        current = ast.as.AsVariableDeclaration(current)?.Initializer;
      } else break;
    }
    const captured = result === undefined ? null : Object.freeze(result);
    for (const subject of seen) cache.set(subject, captured);
    return captured ?? undefined;
  }
}
