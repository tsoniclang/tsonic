// SourceAnalysisFacts producer: the Host analyses a target needs, published as members of SourceProgramFacts.
// Host-internal module. Every member runs over the Host program and returns frozen, checker-free records (I1).
// Memo tables live in this closure, so their lifetime is the program view (I5).
import type { Node, SourceFile } from "@tsonic/tsts";
import type {
  SourceAnalysisExtension, SourceAnalysisFacts, SourceAnalysisHost, SourceAnalysisKey, SourceCallOnlyAliasRecord,
  SourcePropertyName, SourcePropertyNameIssue,
} from "../public/source/analyses.js";
import type { SourceHeritageEdge } from "../public/source/objects.js";
import type { HostSourceProgram } from "../source-semantics/types.js";
import type { SourcePropertyNameSelection } from "../source-semantics/property-names-model.js";
import { analyzeSourceIntegerRanges, type SourceIntegerRangeQueries } from "../source-navigation/integer-ranges/analysis.js";
import { sourceIntegerIsNonnegative } from "../source-navigation/integer-ranges/guards.js";
import { createSourceCallOnlyAliasQuery } from "../source-navigation/callable-aliases.js";
import { sourceBindingCapturedBeforeFirstWrite, sourceBindingCapturedBeforeInitialization }
  from "../source-navigation/deferred-captures.js";
import { sourceCallableDefinitionIsDiscarded } from "../source-navigation/expression-use.js";
import { sourceCallableValueParameters } from "../source-navigation/callable-parameters.js";
import { sourceExpressionCallArgument } from "../source-navigation/callable-arguments.js";
import { sourceAnnotationHint } from "../source-navigation/annotation-hints.js";
import { selectSourceNativeValueGuard } from "../source-semantics/native-value-guards.js";
import { sourceInterfaceRepresentationBase } from "../source-semantics/interface-representations.js";
import { analyzeSourceArtifactFiles } from "./artifacts/source-files.js";
import { validateSourceBinaryEntry } from "./entry-validation.js";
import { createSourceDeclarationControlFlow } from "./flow/graph.js";
import { createSourceSwitchCoverage } from "./flow/switch-coverage.js";
import { createSourceStorageQuery } from "./source-storage/queries.js";
import { defaultSourceStorageLimits } from "./source-storage/model/resource-budget.js";
import { createSourceGlobalCallStorageEffects } from "./source-storage/model/global-call-effects.js";
import { createSourceDeclarationOwnershipQuery } from "./ownership/query.js";
import { analyzeSourceDeclarationGenericAdoption } from "./ownership/generic-adoption.js";

/** Host-internal: open the opaque handle an extension factory receives. Exported only from `@tsonic/target-api/host`. */
export function hostSourceProgramOfAnalysisHost(host: SourceAnalysisHost): HostSourceProgram {
  return host as unknown as HostSourceProgram;
}

/** A typed extension analysis key (source-core and other Host extension packages declare one per analysis group). */
export function createSourceAnalysisKey<T>(id: string): SourceAnalysisKey<T> {
  return Object.freeze({ id }) as SourceAnalysisKey<T>;
}

/**
 * Build the analyses group. `owner` returns the Host program once it is assembled; members are only called after that
 * (the facts object is published together with the program), so every member reads the finished program.
 */
export function createSourceAnalysisFacts(
  owner: () => HostSourceProgram,
  extensions: readonly SourceAnalysisExtension<unknown>[],
): SourceAnalysisFacts {
  const registered = new Map<string, SourceAnalysisExtension<unknown>>();
  for (const extension of extensions) {
    if (registered.has(extension.key.id)) throw new Error(`Duplicate source analysis extension '${extension.key.id}'.`);
    registered.set(extension.key.id, extension);
  }
  const created = new Map<string, unknown>();
  let integers: SourceIntegerRangeQueries | undefined;
  let aliases: ((declaration: Node) => ReturnType<ReturnType<typeof createSourceCallOnlyAliasQuery>>) | undefined;
  let switches: ((switchStatement: Node) => boolean) | undefined;
  let names: { readonly get: WeakMap<Node, SourcePropertyName>; readonly issues: readonly SourcePropertyNameIssue[] } | undefined;
  const aliasRecords = new WeakMap<Node, SourceCallOnlyAliasRecord | null>();
  const bases = new WeakMap<Node, SourceHeritageEdge | null>();
  const entryIssues = new WeakMap<SourceFile, ReturnType<typeof validateSourceBinaryEntry>>();

  const integerQueries = (): SourceIntegerRangeQueries => {
    if (integers !== undefined) return integers;
    const host = owner();
    integers = analyzeSourceIntegerRanges({
      ast: host.ast, navigation: host.navigation, sourceFiles: host.sourceFiles,
      isNumber: expression => {
        const outcome = host.facts.values.type(expression);
        return outcome.kind !== "refused" && outcome.type.kind === "primitive" && outcome.type.primitive === "float64";
      },
    });
    return integers;
  };

  const propertyNames = () => {
    if (names !== undefined) return names;
    const host = owner();
    const get = new WeakMap<Node, SourcePropertyName>();
    const issues: SourcePropertyNameIssue[] = [];
    for (const sourceFile of host.sourceFiles) {
      const index = host.propertyNames(sourceFile);
      for (const entry of index.entries) get.set(entry.node, publishPropertyName(entry.selection));
      for (const issue of index.issues) {
        issues.push(Object.freeze({ node: issue.node, reason: issue.reason, failure: issue.failure }));
      }
    }
    names = Object.freeze({ get, issues: Object.freeze(issues) });
    return names;
  };

  const facts: SourceAnalysisFacts = {
    integerRange: (expression: Node) => integerQueries().range(expression),
    exactInt32Remainders: () => integerQueries().exactInt32Remainders,
    integerIsNonnegative(expression: Node): boolean {
      const host = owner();
      return sourceIntegerIsNonnegative({ ast: host.ast, navigation: host.navigation, sourceFacts: host.sourceFacts }, expression);
    },

    callOnlyAlias(declaration: Node): SourceCallOnlyAliasRecord | undefined {
      const cached = aliasRecords.get(declaration);
      if (cached !== undefined) return cached ?? undefined;
      aliases ??= createSourceCallOnlyAliasQuery(owner());
      const alias = aliases(declaration);
      const record = alias === undefined ? null : Object.freeze({
        expression: alias.expression,
        selectedDeclaration: alias.selectedDeclaration,
        ...(alias.access === undefined ? {} : { member: alias.access.access }),
        ...(alias.receiverDeclaration === undefined ? {} : { receiverDeclaration: alias.receiverDeclaration }),
        declarations: Object.freeze([...alias.declarations]),
        calls: Object.freeze([...alias.calls]),
      });
      aliasRecords.set(declaration, record);
      return record ?? undefined;
    },
    capturedBeforeInitialization(declaration: Node): boolean {
      const host = owner();
      return sourceBindingCapturedBeforeInitialization(declaration, host.ast, host.navigation);
    },
    capturedBeforeFirstWrite(declaration: Node): boolean {
      const host = owner();
      return sourceBindingCapturedBeforeFirstWrite(declaration, host.ast, host.navigation);
    },
    callableDefinitionDiscarded(declaration: Node): boolean {
      const host = owner();
      return sourceCallableDefinitionIsDiscarded(declaration, host.ast, host.navigation);
    },
    callableValueParameters(declaration: Node): readonly Node[] | undefined {
      const host = owner();
      const parameters = sourceCallableValueParameters(host.ast, declaration, host.navigation);
      return parameters === undefined ? undefined : Object.freeze([...parameters]);
    },
    callArgument(expression: Node) {
      const host = owner();
      const selected = sourceExpressionCallArgument(expression, { ast: host.ast, navigation: host.navigation });
      return selected === undefined ? undefined : Object.freeze({ ...selected });
    },
    annotationHint(expression: Node, annotationType?: string): string | undefined {
      const host = owner();
      return sourceAnnotationHint(expression, {
        ast: host.ast, navigation: host.navigation,
        ...(annotationType === undefined ? {} : { annotationType }),
      });
    },
    nativeValueGuard(expression: Node) {
      const host = owner();
      const guard = selectSourceNativeValueGuard({ ast: host.ast, navigation: host.navigation, values: host.facts.values },
        expression);
      return guard === undefined ? undefined : Object.freeze({ ...guard });
    },
    interfaceRepresentationBase(declaration: Node): SourceHeritageEdge | undefined {
      const cached = bases.get(declaration);
      if (cached !== undefined) return cached ?? undefined;
      const host = owner();
      const edge = sourceInterfaceRepresentationBase(declaration, host.ast, host.navigation);
      let published: SourceHeritageEdge | null = null;
      if (edge !== undefined) {
        const heritage = host.facts.objects.heritage(edge.sourceDeclaration);
        if ("kind" in heritage && heritage.kind === "refused") {
          throw new Error(`Interface representation base '${host.ast.text(declaration)}' has a refused heritage edge.`);
        }
        const match = (heritage as readonly SourceHeritageEdge[]).find(candidate => candidate.heritage === edge.heritage);
        if (match === undefined) throw new Error("Interface representation base requires its published heritage edge.");
        published = match;
      }
      bases.set(declaration, published);
      return published ?? undefined;
    },

    enumConstant: (member: Node) => owner().enums.get(member),
    enumIntegerWidth: (declaration: Node) => owner().enums.integerWidth(declaration),
    enumIssues: () => owner().enums.issues,
    propertyName: (name: Node) => propertyNames().get.get(name),
    propertyNameIssues: () => propertyNames().issues,

    artifactFiles(constructions) {
      const host = owner();
      return analyzeSourceArtifactFiles({ ast: host.ast, sourceFiles: host.navigation.sourceFiles,
        navigation: host.navigation, constructions });
    },
    binaryEntryIssues(entry: SourceFile) {
      let issues = entryIssues.get(entry);
      if (issues === undefined) {
        issues = Object.freeze([...validateSourceBinaryEntry(owner(), entry)]);
        entryIssues.set(entry, issues);
      }
      return issues;
    },
    controlFlow: (declaration, options) => createSourceDeclarationControlFlow(owner(), declaration, options),
    switchCoverage(switchStatement: Node): boolean {
      switches ??= createSourceSwitchCoverage(owner());
      return switches(switchStatement);
    },
    storage: input => createSourceStorageQuery(owner(), input.sourceFiles, input.limits ?? defaultSourceStorageLimits,
      input.effects ?? {}),
    globalCallStorageEffects: (select, selectConstructor) =>
      createSourceGlobalCallStorageEffects(owner(), select, selectConstructor),
    declarationOwnership: input => createSourceDeclarationOwnershipQuery({ source: owner(), ...input }),
    genericAdoption: input => analyzeSourceDeclarationGenericAdoption({ source: owner(), ...input }),

    extension<T>(key: SourceAnalysisKey<T>): T {
      if (created.has(key.id)) return created.get(key.id) as T;
      const extension = registered.get(key.id);
      if (extension === undefined || extension.key !== key) {
        throw new Error(`Source analysis extension '${key.id}' is not registered for this program.`);
      }
      const value = extension.create(owner() as unknown as SourceAnalysisHost);
      created.set(key.id, value);
      return value as T;
    },
  };
  return Object.freeze(facts);
}

function publishPropertyName(selection: SourcePropertyNameSelection): SourcePropertyName {
  switch (selection.kind) {
    case "resolved": {
      const constant = selection.constant;
      return Object.freeze({ kind: "resolved", name: selection.name, constant: constant.kind === "enum-member"
        ? Object.freeze({ kind: "enum-member", declaration: constant.entry.declaration, value: constant.entry.value })
        : constant });
    }
    case "well-known-symbol":
      return Object.freeze({ kind: "well-known-symbol",
        symbol: `Symbol.${selection.symbol.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}` });
    case "unique-symbol":
      // Request R-B2-3 (property-names owner): the Host selection carries the declaring `unique symbol` binding.
      return Object.freeze({ kind: "unique-symbol", declaration: selection.declaration });
    case "rejected":
      return Object.freeze({ kind: "rejected", reason: selection.reason, failure: selection.failure });
  }
}
