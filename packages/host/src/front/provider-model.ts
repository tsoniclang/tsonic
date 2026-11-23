import type { ProviderDeclarationModel, ProviderExportDeclaration, ProviderImportDeclaration, ProviderMemberDeclaration,
  ProviderParameterDeclaration, ProviderPropertyName, ProviderSignatureDeclaration, ProviderTypeExpression,
  ProviderTypeParameterDeclaration } from "@tsonic/tsts";
import type { Diagnostic, InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { LibraryTypeId, Origin } from "../ids/contract.js";
import { libraryTypeId } from "../ids/index.js";
import type { LibraryDeclaration, LibraryImport, LibraryMember, LibraryModuleModel, LibraryParameter, LibraryPropertyName,
  LibrarySignature, LibraryType, LibraryTypeParameter } from "../libraries/contract.js";
import type { LiteralCaptureLimits } from "./contract.js";
import { captureCheckerNumber, captureNumericLiteral } from "./literals.js";
import type { SessionDocument } from "./program-data.js";

interface ModelCapture {
  readonly admit: (kind: "facts" | "edges") => boolean;
  readonly literals: LiteralCaptureLimits;
}

type ModelProjection =
  | { readonly kind: "complete"; readonly module: LibraryModuleModel }
  | { readonly kind: "refused"; readonly diagnostic: Diagnostic | null };

const missingRow: InvariantFailure = { owner: "front", query: null, origin: null,
  message: "An admitted provider declaration model must retain its dense original rows." };

export function projectProviderModel(capture: ModelCapture, document: SessionDocument, model: ProviderDeclarationModel,
  origin: Origin): ModelProjection {
  const { admit, literals } = capture;
  if (!admit("facts") || !admit("facts") || !admit("facts"))
    return { kind: "refused", diagnostic: null };
  const types: LibraryType[] = [];
  const ids = new Map<ProviderTypeExpression, LibraryTypeId>();
  const scratch: { checkerNumberBits: DataView | null } = { checkerNumberBits: null };
  let diagnostic: Diagnostic | null = null;
  const refused = (): ModelProjection => ({ kind: "refused", diagnostic });

  function rows<Source, Value>(read: () => readonly Source[] | undefined, project: (entry: Source) => Value | undefined): Value[] | undefined {
    if (!admit("facts")) return undefined;
    const result: Value[] = [];
    const source = read();
    if (source === undefined) return result;
    const length = source.length;
    for (let index = 0; index < length; index += 1) {
      if (!admit("edges")) return undefined;
      const entry = source[index];
      if (entry === undefined) return throwInvariant(missingRow);
      const value = project(entry);
      if (value === undefined) return undefined;
      result.push(value);
    }
    return result;
  }

  function number(value: number) {
    const result = captureCheckerNumber(literals, value, origin, document.module, scratch, "captureModule");
    if (result.kind === "complete") return result.value;
    diagnostic = result.diagnostic;
    return undefined;
  }

  function propertyName(source: ProviderPropertyName): LibraryPropertyName | undefined {
    if (!admit("facts")) return undefined;
    if (typeof source === "string") return { kind: "identifier", text: source };
    const kind = source.kind;
    switch (kind) {
      case "identifier": case "string-literal": return { kind, text: source.text };
      case "well-known-symbol": return { kind, name: source.name };
      case "number-literal": {
        const value = number(source.value);
        return value === undefined ? undefined : { kind, value: value.value };
      }
    }
  }

  function optionalType(type: ProviderTypeExpression | undefined): LibraryTypeId | null | undefined {
    return type === undefined ? null : expression(type);
  }

  function typeParameter(source: ProviderTypeParameterDeclaration): LibraryTypeParameter | undefined {
    if (!admit("facts")) return undefined;
    const constraints = rows(() => source.constraints, expression);
    if (constraints === undefined) return undefined;
    const defaultType = optionalType(source.defaultType);
    return defaultType === undefined ? undefined : { name: source.name, constraints, defaultType, variance: source.variance ?? "invariant" };
  }

  function parameter(source: ProviderParameterDeclaration): LibraryParameter | undefined {
    if (!admit("facts")) return undefined;
    const type = expression(source.type);
    if (type === undefined) return undefined;
    const defaultType = optionalType(source.defaultType);
    return defaultType === undefined ? undefined : { name: source.name, type, defaultType, passingMode: source.passingMode ?? "by-value",
      optional: source.optional ?? false, rest: source.rest ?? false };
  }

  function signature(source: ProviderSignatureDeclaration): LibrarySignature | undefined {
    if (!admit("facts")) return undefined;
    const typeParameters = rows(() => source.typeParameters, typeParameter);
    if (typeParameters === undefined) return undefined;
    const parameters = rows(() => source.parameters, parameter);
    if (parameters === undefined) return undefined;
    const returnType = optionalType(source.returnType);
    return returnType === undefined ? undefined : { id: source.id, name: source.name ?? null, accessibility: source.accessibility ?? "public",
      typeParameters, parameters, returnType, documentation: source.documentation ?? null };
  }

  function expression(source: ProviderTypeExpression): LibraryTypeId | undefined {
    if (!admit("edges")) return undefined;
    const existing = ids.get(source);
    if (existing !== undefined) return existing;
    if (!admit("facts") || !admit("facts")) return undefined;
    function retain(term: LibraryTerm): LibraryTypeId {
      const id = libraryTypeId(types.length);
      types.push({ ...term, id });
      ids.set(source, id);
      return id;
    }
    const kind = source.kind;
    switch (kind) {
      case "any": case "unknown": case "void": case "never": case "boolean": case "string": case "number":
      case "bigint": case "object": return retain({ kind });
      case "undefined": return retain({ kind: "absence" });
      case "source-primitive": return retain({ kind, name: source.name });
      case "type-parameter": return retain({ kind, name: source.name });
      case "source-global": {
        const typeArguments = rows(() => source.typeArguments, expression);
        return typeArguments === undefined ? undefined : retain({ kind: "source-global", name: source.name, typeArguments });
      }
      case "provider-ref": {
        const typeArguments = rows(() => source.typeArguments, expression);
        return typeArguments === undefined ? undefined : retain({ kind: "provider-ref", moduleSpecifier: source.moduleSpecifier,
          exportName: source.exportName, localName: source.localName ?? null, namespaceImport: source.namespaceImport ?? null, typeArguments });
      }
      case "array": {
        const elementType = expression(source.elementType);
        return elementType === undefined ? undefined : retain({ kind: "array", elementType });
      }
      case "tuple": {
        const elementTypes = rows(() => source.elementTypes, expression);
        return elementTypes === undefined ? undefined : retain({ kind: "tuple", elementTypes });
      }
      case "union": case "intersection": {
        const members = rows(() => source.types, expression);
        return members === undefined ? undefined : retain({ kind, types: members });
      }
      case "function": {
        const callable = signature(source);
        return callable === undefined ? undefined : retain({ kind: "function", signature: callable });
      }
      case "literal": {
        const value = source.value;
        if (value === null) return retain({ kind: "literal", value: { kind: "absence" } });
        if (typeof value === "boolean") return retain({ kind: "literal", value: { kind: "boolean", value } });
        if (typeof value === "string") return retain({ kind: "literal", value: { kind: "string", value } });
        const exact = number(value);
        return exact === undefined ? undefined : retain({ kind: "literal", value: exact });
      }
      case "bigint-literal": {
        const exact = captureNumericLiteral(literals, { token: source.value, origin }, "captureModule");
        if (exact.kind !== "complete") {
          diagnostic = exact.diagnostic;
          return undefined;
        }
        return retain({ kind: "literal", value: { kind: "bigint", value: exact.value.value.numerator } });
      }
    }
  }

  function member(source: ProviderMemberDeclaration): LibraryMember | undefined {
    if (!admit("facts")) return undefined;
    const name = propertyName(source.name);
    if (name === undefined) return undefined;
    const type = optionalType(source.type);
    if (type === undefined) return undefined;
    const signatures = rows(() => source.signatures, signature);
    return signatures === undefined ? undefined : { id: source.id, name, kind: source.kind, type, signatures,
      static: source.static ?? false, readonly: source.readonly ?? false, optional: source.optional ?? false,
      documentation: source.documentation ?? null };
  }

  function declaration(source: ProviderExportDeclaration): LibraryDeclaration | undefined {
    if (!admit("facts")) return undefined;
    const typeParameters = rows(() => source.typeParameters, typeParameter);
    if (typeParameters === undefined) return undefined;
    const type = optionalType(source.type);
    if (type === undefined) return undefined;
    const heritage = rows(() => source.heritage, entry => {
      if (!admit("facts")) return undefined;
      const represented = expression(entry.type);
      return represented === undefined ? undefined : { kind: entry.kind, type: represented };
    });
    if (heritage === undefined) return undefined;
    const members = rows(() => source.members, member);
    if (members === undefined) return undefined;
    const signatures = rows(() => source.signatures, signature);
    if (signatures === undefined) return undefined;
    const exportKind = source.exportKind ?? "named";
    const family = source.sourceTypeFamily;
    if (family !== undefined && !admit("facts")) return undefined;
    return { id: source.id, name: source.name, exportName: exportKind === "default" ? "default" : source.exportName ?? source.name, exportKind,
      kind: source.kind, typeFamily: family === undefined ? null : { exportName: family.exportName, typeArgumentCount: family.typeArgumentCount },
      type, typeParameters, heritage, members, signatures,
      documentation: source.documentation ?? null };
  }

  function imports(source: ProviderImportDeclaration): LibraryImport | undefined {
    if (!admit("facts")) return undefined;
    const namedImports = rows(() => source.namedImports, entry => admit("facts") ?
      { exportedName: entry.exportedName, localName: entry.localName ?? null, kind: entry.kind ?? "unknown" } : undefined);
    return namedImports === undefined ? undefined : { moduleSpecifier: source.moduleSpecifier, defaultImport: source.defaultImport ?? null,
      namespaceImport: source.namespaceImport ?? null, typeOnly: source.typeOnly ?? false, namedImports };
  }

  const imported = rows(() => model.imports, imports);
  if (imported === undefined) return refused();
  const exported = rows(() => model.exports, declaration);
  return exported === undefined ? refused() : { kind: "complete", module: { identity: document.provider, types,
    imports: imported, exports: exported } };
}

type ModelTerm<Value> = Value extends { readonly id: LibraryTypeId } ? Omit<Value, "id"> : never;
type LibraryTerm = ModelTerm<LibraryType>;
