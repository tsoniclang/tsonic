import { providerVirtualDeclarationFactKey, type CheckedSourceProgram, type Diagnostic, type Node, type SourceFile } from "@tsonic/tsts";
import { createSourceProfileDeclarationQuery, createTargetSourceProgram, createSourceNodeInventory } from "@tsonic/target-api/host";
import type { SourceJsApiFactsFactory, SourceProgramInput } from "@tsonic/target-api/host";
import type { TargetSourceSafetyProvider } from "@tsonic/target-api";
import { createSourceCoreInput, selectTsonicFixedArray } from "@tsonic/source-core/host";
import type { TargetSourceProfileFile } from "../target/source-profile.js";
import { createSourceDescriptorInput } from "./descriptor-factory.js";
import { createSourceNodeNavigationInput } from "./navigation/input.js";
import { createSourcePropertyNameInput } from "./navigation/property-names.js";
import { sourceProjectFiles } from "./navigation/navigation.js";
import { createSourceProtocolInput } from "./protocols.js";

export function createHostSourceProgramInput(options: {
  readonly checked: CheckedSourceProgram;
  readonly apiFacts: SourceJsApiFactsFactory | undefined;
  readonly profileFiles: readonly TargetSourceProfileFile[];
  readonly safetyProviders: readonly TargetSourceSafetyProvider[];
}) {
  const { checked } = options;
  void checked.diagnostics;
  const { ast } = checked;
  const programSourceFiles = Object.freeze([...checked.programSourceFiles]);
  const sourceFiles = sourceProjectFiles(checked);
  const inventory = createSourceNodeInventory(checked, programSourceFiles);
  const assertNode = (node: Node): void => {
    if (!inventory.contains(node)) throw new Error("A Source input requires its exact original node from this checked program.");
  };
  const queries = (node: Node) => {
    assertNode(node);
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("An original Source fact requires its authentic source file.");
    return checked.getSourceFileQueries(file);
  };
  const raw = createSourceDescriptorInput({ checked, assertNode, markers: occurrence => core.markers(occurrence),
    extent(component, authoredTypeNode, observed) {
      const terminal = observed(component);
      if (terminal === undefined) return undefined;
      const selected = selectTsonicFixedArray(terminal, queries(component.root), checked.sourceFacts,
        authoredTypeNode === undefined ? {} : { authoredTypeNode });
      if (selected === undefined) return undefined;
      if (selected.kind === "invalid") throw new Error(selected.reason);
      return Object.freeze({ length: selected.fact.length, runtimeBase: selected.fact.lengthRuntimeBase });
    } });
  const core = createSourceCoreInput({ checked, assertNode, observedComponent: raw.identities.checkedComponent,
    syntax: raw.input.syntax, safetyProviders: options.safetyProviders,
    originalApplication: raw.calls.originalApplication, originalComponent: raw.calls.originalComponent });
  const navigation = createSourceNodeNavigationInput({ checked, sourceFiles, inventory, assertNode,
    identities: raw.identities, originalSignature: raw.facts.originalSignature });
  const none = Object.freeze({ kind: "none" } as const);
  const profileOwners = new WeakMap<SourceFile, string>();
  const selectedFiles = new Map(options.profileFiles.map(file => [file.path, file.ownerId]));
  for (const file of programSourceFiles) {
    const owner = selectedFiles.get(ast.getFileName(file));
    if (owner !== undefined) profileOwners.set(file, owner);
  }
  const profileDeclaration = createSourceProfileDeclarationQuery({ ast, assertNode,
    owner(node) {
      const file = ast.getSourceFile(node);
      const selected = file === undefined ? undefined : profileOwners.get(file);
      const provider = checked.sourceFacts.getFact(node, providerVirtualDeclarationFactKey);
      const owner = selected ?? provider?.providerId;
      return owner === undefined ? none : Object.freeze({ kind: "present", value: owner });
    },
    providerDeclaration(node) {
      assertNode(node);
      const selected = checked.sourceFacts.getFact(node, providerVirtualDeclarationFactKey);
      return selected === undefined ? none : Object.freeze({ kind: "present", value: selected });
    },
    wellKnownDeclaration(node) {
      const selected = queries(node).checker.getResolvedWellKnownSymbolInfo(node);
      if (selected?.wellKnownDeclaration === undefined) return none;
      assertNode(selected.wellKnownDeclaration);
      return Object.freeze({ kind: "present", value: selected.wellKnownDeclaration });
    } });
  const dischargedDiagnostics = new Set<Diagnostic>();
  const publishedDiagnostics = new Set(checked.diagnostics.filter((value): value is Diagnostic => value !== undefined));
  const protocolInput = createSourceProtocolInput({ checked, identities: raw.identities, assertNode,
    syntax: raw.input.syntax, originalSignature: raw.facts.originalSignature });
  const input: SourceProgramInput = {
    ast, sourceFiles, programSourceFiles, inventory, input: raw.input, protocolInput,
    navigation, core, profileDeclaration,
    apiFacts: options.apiFacts === undefined ? none : Object.freeze({ kind: "present", value: options.apiFacts }),
    propertyNames: createSourcePropertyNameInput({ checked, assertNode, declarationFor: navigation.declarationFor }),
    memberUse: raw.memberUse,
    discharge(diagnostics) {
      for (const identity of diagnostics) {
        const diagnostic = raw.calls.originalDiagnostic(identity);
        if (!publishedDiagnostics.has(diagnostic)) throw new Error("A Source discharge requires an exact originally published checker diagnostic root.");
        dischargedDiagnostics.add(diagnostic);
      }
    },
  };
  return Object.freeze({ input, dischargedDiagnostics });
}

export function createHostSourceProgram(options: Parameters<typeof createHostSourceProgramInput>[0]) {
  const original = createHostSourceProgramInput(options);
  return Object.freeze({ source: createTargetSourceProgram(original.input), dischargedDiagnostics: original.dischargedDiagnostics });
}
