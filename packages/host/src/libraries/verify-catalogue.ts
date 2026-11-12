import type { KeyData, LibraryExportIdentity, LibraryModuleIdentity, LibraryTypeId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { Violation } from "../diag/contract.js";
import type { BindingVector, ExactRational, TypeBinding } from "../ir-types/contract.js";
import type {
  LibraryCatalogue, LibraryDeclaration, LibraryMember, LibraryModule, LibraryRule, LibrarySignature,
  LibrarySite, LibraryType, LibraryTypeParameter,
} from "./contract.js";

export type LocatedSite = LibrarySite & { readonly kind: "source" | "module" | "type" | "export" | "text" | "authored-summary" };

export interface LibraryViolation extends Violation<LibraryRule, LocatedSite> {
  readonly detail: readonly { readonly kind: "text"; readonly value: string }[];
}

export interface ExportEntry {
  readonly identity: LibraryExportIdentity;
  readonly module: LibraryModule;
  readonly declaration: LibraryDeclaration;
  readonly member: LibraryMember | null;
  readonly signature: LibrarySignature | null;
}

export interface CatalogueIndex {
  readonly modules: ReadonlyMap<string, LibraryModule | null>;
  readonly exports: ReadonlyMap<string, ExportEntry | null>;
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNullableText(left: string | null, right: string | null): number {
  return left === null ? right === null ? 0 : -1 : right === null ? 1 : compareText(left, right);
}

export function moduleIdentityData(identity: LibraryModuleIdentity): readonly KeyData[] {
  return [identity.providerId, identity.providerVersion, identity.packageName,
    identity.moduleSpecifier, identity.providerModuleId];
}

export function moduleKey(identity: LibraryModuleIdentity): string {
  return encodeKey(moduleIdentityData(identity));
}

export function exportIdentityData(identity: LibraryExportIdentity): readonly KeyData[] {
  return [moduleIdentityData(identity.module), identity.exportId, identity.memberId, identity.signatureId];
}

export function exportKey(identity: LibraryExportIdentity): string {
  return encodeKey(exportIdentityData(identity));
}

function typeBindingData(binding: TypeBinding): readonly KeyData[] {
  return binding.kind === "bound"
    ? [binding.kind, binding.parameter.owner, binding.parameter.index, binding.type]
    : [binding.kind, binding.parameter.owner, binding.parameter.index];
}

export function bindingData(bindings: BindingVector): readonly KeyData[] {
  return [bindings.classBindings.map(typeBindingData), bindings.methodBindings.map(typeBindingData),
    bindings.capturedBindings.map(typeBindingData), bindings.selfBindings.map(binding => binding.kind === "bound"
      ? [binding.kind, binding.owner, binding.type] : [binding.kind, binding.owner])];
}

export function compareModules(left: LibraryModuleIdentity, right: LibraryModuleIdentity): number {
  return compareText(left.providerId, right.providerId) || compareText(left.providerVersion, right.providerVersion) ||
    compareNullableText(left.packageName, right.packageName) || compareText(left.moduleSpecifier, right.moduleSpecifier) ||
    compareText(left.providerModuleId, right.providerModuleId);
}

export function compareExports(left: LibraryExportIdentity, right: LibraryExportIdentity): number {
  return compareModules(left.module, right.module) || compareText(left.exportId, right.exportId) ||
    compareNullableText(left.memberId, right.memberId) || compareNullableText(left.signatureId, right.signatureId);
}

function siteData(site: LocatedSite): readonly KeyData[] {
  switch (site.kind) {
    case "source": return [site.kind, site.source];
    case "module": return [site.kind, moduleIdentityData(site.module)];
    case "type": return [site.kind, moduleIdentityData(site.module), site.type];
    case "export": return [site.kind, exportIdentityData(site.identity)];
    case "text": return [site.kind, site.fileName];
    case "authored-summary": return [site.kind, exportIdentityData(site.identity), site.table, site.index];
  }
}

export function violation(rule: LibraryRule, site: LocatedSite, ...detail: readonly string[]): LibraryViolation {
  return { rule, site, detail: detail.map(value => ({ kind: "text", value })) };
}

export function orderedViolations(values: readonly LibraryViolation[]): readonly LibraryViolation[] {
  return values.map(value => ({ value, key: encodeKey([siteData(value.site), value.rule,
    value.detail.map(argument => [argument.kind, argument.value])]) })).sort((left, right) => compareText(left.key, right.key))
    .map(entry => entry.value);
}

export function catalogueIndex(catalogue: LibraryCatalogue): CatalogueIndex {
  const modules = new Map<string, LibraryModule | null>();
  const exports = new Map<string, ExportEntry | null>();
  const add = (entry: ExportEntry): void => {
    const key = exportKey(entry.identity);
    exports.set(key, exports.has(key) ? null : entry);
  };
  for (const source of catalogue.sources) {
    for (const module of source.modules) {
      const key = moduleKey(module.identity);
      modules.set(key, modules.has(key) ? null : module);
      for (const declaration of module.exports) {
        const identity: LibraryExportIdentity = {
          module: module.identity, exportId: declaration.id, memberId: null, signatureId: null,
        };
        add({ identity, module, declaration, member: null, signature: null });
        for (const signature of declaration.signatures) {
          add({ identity: { ...identity, signatureId: signature.id }, module, declaration, member: null, signature });
        }
        for (const member of declaration.members) {
          const memberIdentity: LibraryExportIdentity = { ...identity, memberId: member.id };
          add({ identity: memberIdentity, module, declaration, member, signature: null });
          for (const signature of member.signatures) {
            add({ identity: { ...memberIdentity, signatureId: signature.id }, module, declaration, member, signature });
          }
        }
      }
    }
  }
  return { modules, exports };
}

export function exactRational(value: ExactRational): boolean {
  if (value.denominator <= 0n || value.negativeZero && value.numerator !== 0n) return false;
  let numerator = value.numerator < 0n ? -value.numerator : value.numerator;
  let denominator = value.denominator;
  while (denominator !== 0n) {
    const remainder = numerator % denominator;
    numerator = denominator;
    denominator = remainder;
  }
  return numerator === 1n;
}

function referenceSlots(type: LibraryType): readonly LibraryTypeId[] {
  switch (type.kind) {
    case "array": return [type.elementType];
    case "tuple": return type.elementTypes;
    case "union": case "intersection": return type.types;
    case "source-global": case "provider-ref": return type.typeArguments;
    case "function": return signatureSlots(type.signature);
    case "any": case "unknown": case "void": case "never": case "absence": case "boolean":
    case "string": case "number": case "bigint": case "object": case "source-primitive":
    case "type-parameter": case "literal": return [];
  }
}

function parameterSlots(parameters: readonly LibraryTypeParameter[]): readonly LibraryTypeId[] {
  const slots: LibraryTypeId[] = [];
  for (const parameter of parameters) {
    for (const constraint of parameter.constraints) slots.push(constraint);
    if (parameter.defaultType !== null) slots.push(parameter.defaultType);
  }
  return slots;
}

function signatureSlots(signature: LibrarySignature): readonly LibraryTypeId[] {
  const slots: LibraryTypeId[] = [...parameterSlots(signature.typeParameters)];
  for (const parameter of signature.parameters) {
    slots.push(parameter.type);
    if (parameter.defaultType !== null) slots.push(parameter.defaultType);
  }
  if (signature.returnType !== null) slots.push(signature.returnType);
  return slots;
}

function duplicateNames(parameters: readonly LibraryTypeParameter[], site: LocatedSite,
  output: LibraryViolation[]): void {
  const names = new Set<string>();
  for (const parameter of parameters) {
    if (names.has(parameter.name)) output.push(violation("type-parameter-names-unique", site, parameter.name));
    names.add(parameter.name);
  }
}

function verifySignatures(signatures: readonly LibrarySignature[], site: LocatedSite,
  output: LibraryViolation[]): void {
  const identifiers = new Set<string>();
  for (const signature of signatures) {
    if (identifiers.has(signature.id)) output.push(violation("signature-ids-unique", site, signature.id));
    identifiers.add(signature.id);
    duplicateNames(signature.typeParameters, site, output);
    for (const [index, parameter] of signature.parameters.entries()) {
      if (parameter.rest && index !== signature.parameters.length - 1) {
        output.push(violation("rest-parameter-last", site, signature.id, String(index)));
      }
    }
  }
}

interface ScopeRequest {
  readonly roots: readonly LibraryTypeId[];
  readonly names: readonly ReadonlySet<string>[];
  readonly site: LocatedSite;
}

function verifyModule(module: LibraryModule, index: CatalogueIndex, output: LibraryViolation[]): void {
  const site: LibrarySite = { kind: "module", module: module.identity };
  const types = new Map<LibraryTypeId, LibraryType>();
  for (let position = 0; position < module.types.length; position += 1) {
    const type = module.types[position];
    if (type === undefined) {
      output.push(violation("type-id-dense", site, String(position)));
    } else {
      if (!Number.isSafeInteger(type.id) || Object.is(type.id, -0) || type.id !== position) {
        output.push(violation("type-id-dense", { kind: "type", module: module.identity, type: type.id }, String(position)));
      } else {
        types.set(type.id, type);
      }
    }
  }
  const checkReferences = (references: readonly LibraryTypeId[], owner: LocatedSite): void => {
    for (const reference of references) {
      if (!Number.isSafeInteger(reference) || reference < 0 || Object.is(reference, -0) || !types.has(reference)) {
        output.push(violation("type-reference-resolves", owner, encodeKey(reference)));
      }
    }
  };
  for (const type of module.types) {
    if (type === undefined) continue;
    const typeSite: LibrarySite = { kind: "type", module: module.identity, type: type.id };
    checkReferences(referenceSlots(type), typeSite);
    if (type.kind === "function") verifySignatures([type.signature], typeSite, output);
    if (type.kind === "literal" && type.value.kind === "number" && !exactRational(type.value.value)) {
      output.push(violation("literal-exact", typeSite));
    }
  }
  const declarations = new Set<string>();
  const names = new Set<string>();
  const scopeRequests: ScopeRequest[] = [];
  const boundNames = new Map<string, number>();
  for (const declaration of module.exports) {
    const identity: LibraryExportIdentity = {
      module: module.identity, exportId: declaration.id, memberId: null, signatureId: null,
    };
    const exportSite: LibrarySite = { kind: "export", identity };
    if (declarations.has(declaration.id)) output.push(violation("declaration-ids-unique", exportSite));
    declarations.add(declaration.id);
    if (names.has(declaration.exportName)) output.push(violation("export-names-unique", exportSite, declaration.exportName));
    names.add(declaration.exportName);
    if (declaration.typeFamily !== null && (!Number.isSafeInteger(declaration.typeFamily.typeArgumentCount) ||
      Object.is(declaration.typeFamily.typeArgumentCount, -0) ||
      declaration.typeFamily.typeArgumentCount !== declaration.typeParameters.length)) {
      output.push(violation("type-family-arity-exact", exportSite));
    }
    duplicateNames(declaration.typeParameters, exportSite, output);
    const declarationRoots: LibraryTypeId[] = [...parameterSlots(declaration.typeParameters)];
    if (declaration.type !== null) declarationRoots.push(declaration.type);
    for (const heritage of declaration.heritage) declarationRoots.push(heritage.type);
    const outerNames = new Set(declaration.typeParameters.map(parameter => parameter.name));
    let outerUses = 0;
    const signatures = (values: readonly LibrarySignature[], owner: LocatedSite): void => {
      verifySignatures(values, owner, output);
      for (const signature of values) {
        const roots = signatureSlots(signature);
        checkReferences(roots, owner);
        if (roots.length === 0) continue;
        const localNames = new Set(signature.typeParameters.map(parameter => parameter.name));
        scopeRequests.push({ roots, names: [outerNames, localNames], site: owner });
        outerUses += 1;
        for (const name of localNames) if (!outerNames.has(name)) boundNames.set(name, (boundNames.get(name) ?? 0) + 1);
      }
    };
    signatures(declaration.signatures, exportSite);
    const members = new Set<string>();
    for (const member of declaration.members) {
      const memberSite: LibrarySite = { kind: "export", identity: { ...identity, memberId: member.id } };
      if (members.has(member.id)) output.push(violation("member-ids-unique", memberSite));
      members.add(member.id);
      if (member.type !== null) {
        checkReferences([member.type], memberSite);
        scopeRequests.push({ roots: [member.type], names: [outerNames], site: memberSite });
        outerUses += 1;
      }
      if (member.name.kind === "number-literal" && !exactRational(member.name.value)) {
        output.push(violation("literal-exact", memberSite));
      }
      signatures(member.signatures, memberSite);
    }
    checkReferences(declarationRoots, exportSite);
    if (declarationRoots.length > 0) {
      scopeRequests.push({ roots: declarationRoots, names: [outerNames], site: exportSite });
      outerUses += 1;
    }
    for (const name of outerNames) boundNames.set(name, (boundNames.get(name) ?? 0) + outerUses);
  }
  verifyScopes(types, scopeRequests, boundNames, output);
  let previousRole: LibraryExportIdentity | null = null;
  const roles = new Set<string>();
  for (const role of module.roles) {
    const roleSite: LibrarySite = { kind: "export", identity: role.identity };
    const key = exportKey(role.identity);
    if (previousRole !== null && compareExports(previousRole, role.identity) > 0) {
      output.push(violation("role-identities-order", roleSite));
    }
    previousRole = role.identity;
    if (roles.has(key)) output.push(violation("role-identities-unique", roleSite));
    roles.add(key);
    const declaration = index.exports.get(key);
    if (moduleKey(role.identity.module) !== moduleKey(module.identity) || declaration === undefined || declaration === null) {
      output.push(violation("role-export-resolves", roleSite));
    }
  }
}

function verifyScopes(types: ReadonlyMap<LibraryTypeId, LibraryType>,
  requests: readonly ScopeRequest[], boundNames: ReadonlyMap<string, number>, output: LibraryViolation[]): void {
  if (requests.length === 0) return;
  const reverse = new Map<LibraryTypeId, { readonly type: LibraryTypeId; readonly binders: ReadonlySet<string> }[]>();
  const seeds = new Map<string, LibraryTypeId[]>();
  const freeNames = new Map<LibraryTypeId, Set<string>>();
  const emptyBinders: ReadonlySet<string> = new Set<string>();
  for (const type of types.values()) {
    const references = referenceSlots(type);
    if (references.length > 0) {
      const binders = type.kind === "function" && type.signature.typeParameters.length > 0
        ? new Set(type.signature.typeParameters.map(parameter => parameter.name)) : emptyBinders;
      const parent = { type: type.id, binders };
      for (const reference of references) {
        const parents = reverse.get(reference);
        if (parents === undefined) reverse.set(reference, [parent]);
        else parents.push(parent);
      }
    }
    if (type.kind === "type-parameter" && boundNames.get(type.name) !== requests.length) {
      const identifiers = seeds.get(type.name);
      if (identifiers === undefined) seeds.set(type.name, [type.id]);
      else identifiers.push(type.id);
    }
  }
  for (const [name, identifiers] of seeds) {
    const visited = new Set<LibraryTypeId>();
    const work = [...identifiers];
    for (const identifier of work) {
      if (visited.has(identifier)) continue;
      visited.add(identifier);
      const names = freeNames.get(identifier);
      if (names === undefined) freeNames.set(identifier, new Set([name]));
      else names.add(name);
      const parents = reverse.get(identifier);
      if (parents === undefined) continue;
      for (const parent of parents) if (!parent.binders.has(name)) work.push(parent.type);
    }
  }
  for (const request of requests) {
    const missing = new Set<string>();
    for (const root of request.roots) {
      const names = freeNames.get(root);
      if (names === undefined) continue;
      for (const name of names) if (!request.names.some(binders => binders.has(name))) missing.add(name);
    }
    for (const name of [...missing].sort(compareText)) {
      output.push(violation("type-parameter-resolves", request.site, name));
    }
  }
}

export function checkLibraryCatalogue(catalogue: LibraryCatalogue): readonly LibraryViolation[] {
  const output: LibraryViolation[] = [];
  const index = catalogueIndex(catalogue);
  const sources = new Set<string>();
  const modules = new Set<string>();
  for (const source of catalogue.sources) {
    if (sources.has(source.id)) output.push(violation("source-ids-unique", { kind: "source", source: source.id }));
    sources.add(source.id);
    let previous: LibraryModuleIdentity | null = null;
    for (const module of source.modules) {
      const site: LibrarySite = { kind: "module", module: module.identity };
      if (previous !== null && compareModules(previous, module.identity) > 0) {
        output.push(violation("module-identities-order", site));
      }
      previous = module.identity;
      const key = moduleKey(module.identity);
      if (modules.has(key)) output.push(violation("module-identities-unique", site));
      modules.add(key);
      verifyModule(module, index, output);
    }
    for (const text of source.declarations) {
      const declared = text.module === null ? null : index.modules.get(moduleKey(text.module));
      if (text.module !== null && (declared === undefined || declared === null)) {
        output.push(violation("text-module-resolves", { kind: "text", fileName: text.fileName }));
      }
    }
  }
  return orderedViolations(output);
}
