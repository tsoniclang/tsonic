import { analyzeSourceIntegerRanges } from "../source-navigation/integer-ranges/analysis.js";
import { sourceIntegerIsNonnegative } from "../source-navigation/integer-ranges/guards.js";
import { createSourceCallOnlyAliasQuery } from "../source-navigation/callable-aliases.js";
import { sourceBindingCapturedBeforeFirstWrite, sourceBindingCapturedBeforeInitialization } from "../source-navigation/deferred-captures.js";
import { sourceCallableDefinitionIsDiscarded } from "../source-navigation/expression-use.js";
import { sourceCallableValueParameters } from "../source-navigation/callable-parameters.js";
import { sourceExpressionCallArgument } from "../source-navigation/callable-arguments.js";
import { createSourceLexicalCaptureQuery } from "../source-navigation/lexical-captures.js";
import { sourceAnnotationHint } from "../source-navigation/annotation-hints.js";
import { selectSourceNativeValueGuard } from "../source-semantics/native-value-guards.js";
import { sourceInterfaceRepresentationBase } from "../source-semantics/interface-representations.js";
import { analyzeSourceArtifactFiles } from "./artifacts/source-files.js";
import { validateSourceBinaryEntry } from "./entry-validation.js";
import { createSourceDeclarationControlFlow } from "./flow/graph.js";
import { createSourceSwitchCoverage } from "./flow/switch-coverage.js";
import { createSourceStorageQuery } from "./source-storage/queries.js";
import { defaultSourceStorageLimits } from "./source-storage/model/resource-budget.js";
import { createSourceProfileStorageEffects } from "./source-storage/model/global-call-effects.js";
import { createSourceDeclarationOwnershipQuery } from "./ownership/query.js";
import { analyzeSourceDeclarationGenericAdoption } from "./ownership/generic-adoption.js";
import { sourcePrimitiveLiteralFit } from "../source-semantics/local-type-flow/operator-decisions.js";
/** Host-internal: open the opaque handle an extension factory receives. Exported only from `@tsonic/target-api/host`. */
export function hostSourceProgramOfAnalysisHost(host) {
    return host;
}
/** A typed extension analysis key (source-core and other Host extension packages declare one per analysis group). */
export function createSourceAnalysisKey(id) {
    return Object.freeze({ id });
}
/**
 * Build the analyses group. `owner` returns the Host program once it is assembled; members are only called after that
 * (the facts object is published together with the program), so every member reads the finished program.
 */
export function createSourceAnalysisFacts(owner, extensions, platform, 
/** The selection owner's signature slots (object-facts/selections.ts): one translation with the call selections. */
signatureParameters) {
    const registered = new Map();
    for (const extension of extensions) {
        if (registered.has(extension.key.id))
            throw new Error(`Duplicate source analysis extension '${extension.key.id}'.`);
        registered.set(extension.key.id, extension);
    }
    const created = new Map();
    let integers;
    let aliases;
    let switches;
    let lexicalCaptures;
    let names;
    const aliasRecords = new WeakMap();
    const bases = new WeakMap();
    const entryIssues = new WeakMap();
    const integerQueries = () => {
        if (integers !== undefined)
            return integers;
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
        if (names !== undefined)
            return names;
        const host = owner();
        const get = new WeakMap();
        const issues = new WeakMap();
        for (const sourceFile of host.sourceFiles) {
            const index = host.propertyNames(sourceFile);
            for (const entry of index.entries)
                get.set(entry.node, publishPropertyName(entry.selection));
            // Issues are Source refusals of project files only (R2 #34): a declaration file's unproven key is not a program form.
            // Each is published per name node (Q93): a target forwards it only where it needs a static named field.
            if (!host.navigation.isProjectDeclaration(sourceFile))
                continue;
            for (const issue of index.issues) {
                issues.set(issue.node, Object.freeze({
                    code: issue.failure === "resource" ? "TSONIC_COMPILER_RESOURCE_LIMIT" : "TSONIC_COMPUTED_PROPERTY_NAME_NOT_PROVEN",
                    node: issue.node, reason: issue.reason, failure: issue.failure,
                }));
            }
        }
        names = Object.freeze({ get, issues });
        return names;
    };
    const facts = {
        // E24 (N5): the composition root's premise, published with its fields unchanged, and the one native fit rule (Q90 b).
        platform: Object.freeze({
            ...platform,
            nativeIntegerFit(value, primitive) {
                const fit = sourcePrimitiveLiteralFit(Object.freeze({ form: "bigint", integerConstant: value }), primitive, platform);
                return fit === "fits" ? "fits" : fit === "outside" ? "does-not-fit" : "refused";
            },
        }),
        integerRange: (expression) => integerQueries().range(expression),
        exactInt32Remainders: () => integerQueries().exactInt32Remainders,
        integerIsNonnegative(expression) {
            const host = owner();
            return sourceIntegerIsNonnegative({ ast: host.ast, navigation: host.navigation, sourceFacts: host.sourceFacts }, expression);
        },
        callOnlyAlias(declaration) {
            const cached = aliasRecords.get(declaration);
            if (cached !== undefined)
                return cached ?? undefined;
            aliases ?? (aliases = createSourceCallOnlyAliasQuery(owner()));
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
        capturedBeforeInitialization(declaration) {
            const host = owner();
            return sourceBindingCapturedBeforeInitialization(declaration, host.ast, host.navigation);
        },
        capturedBeforeFirstWrite(declaration) {
            const host = owner();
            return sourceBindingCapturedBeforeFirstWrite(declaration, host.ast, host.navigation);
        },
        callableDefinitionDiscarded(declaration) {
            const host = owner();
            return sourceCallableDefinitionIsDiscarded(declaration, host.ast, host.navigation);
        },
        callableValueParameters(declaration) {
            const host = owner();
            const parameters = sourceCallableValueParameters(host.ast, declaration, host.navigation);
            return parameters === undefined ? undefined : Object.freeze([...parameters]);
        },
        lexicalCaptures(captureOwner) {
            if (lexicalCaptures === undefined) {
                const host = owner();
                lexicalCaptures = createSourceLexicalCaptureQuery(host.ast, host.navigation);
            }
            return lexicalCaptures(captureOwner);
        },
        signatureParameters,
        callArgument(expression) {
            const host = owner();
            const selected = sourceExpressionCallArgument(expression, { ast: host.ast, navigation: host.navigation });
            return selected === undefined ? undefined : Object.freeze({ ...selected });
        },
        annotationHint(expression, annotationType) {
            const host = owner();
            return sourceAnnotationHint(expression, {
                ast: host.ast, navigation: host.navigation,
                ...(annotationType === undefined ? {} : { annotationType }),
            });
        },
        nativeValueGuard(expression) {
            const host = owner();
            const guard = selectSourceNativeValueGuard({ ast: host.ast, navigation: host.navigation, values: host.facts.values }, expression);
            return guard === undefined ? undefined : Object.freeze({ ...guard });
        },
        interfaceRepresentationBase(declaration) {
            const cached = bases.get(declaration);
            if (cached !== undefined)
                return cached ?? undefined;
            const host = owner();
            const edge = sourceInterfaceRepresentationBase(declaration, host.ast, host.navigation);
            let published = null;
            if (edge !== undefined) {
                const heritage = host.facts.objects.heritage(edge.sourceDeclaration);
                if ("kind" in heritage && heritage.kind === "refused") {
                    throw new Error(`Interface representation base '${host.ast.text(declaration)}' has a refused heritage edge.`);
                }
                const match = heritage.find(candidate => candidate.heritage === edge.heritage);
                if (match === undefined)
                    throw new Error("Interface representation base requires its published heritage edge.");
                published = match;
            }
            bases.set(declaration, published);
            return published ?? undefined;
        },
        enumConstant: (member) => owner().enums.get(member),
        enumIntegerWidth: (declaration) => owner().enums.integerWidth(declaration),
        propertyName: (name) => propertyNames().get.get(name),
        propertyNameIssue: (name) => propertyNames().issues.get(name),
        artifactFiles(constructions) {
            const host = owner();
            return analyzeSourceArtifactFiles({ ast: host.ast, sourceFiles: host.navigation.sourceFiles,
                navigation: host.navigation, constructions });
        },
        binaryEntryIssues(entry) {
            let issues = entryIssues.get(entry);
            if (issues === undefined) {
                issues = Object.freeze([...validateSourceBinaryEntry(owner(), entry)]);
                entryIssues.set(entry, issues);
            }
            return issues;
        },
        controlFlow: (declaration, options) => createSourceDeclarationControlFlow(owner(), declaration, options),
        switchCoverage(switchStatement) {
            switches ?? (switches = createSourceSwitchCoverage(owner()));
            return switches(switchStatement);
        },
        // The Host composes the JS API storage and callback effects from facts.profile; the target adds only its ABI premises.
        storage: input => createSourceStorageQuery(owner(), input.sourceFiles, input.limits ?? defaultSourceStorageLimits, createSourceProfileStorageEffects(owner(), input.premises)),
        declarationOwnership: input => createSourceDeclarationOwnershipQuery({ source: owner(), ...input }),
        genericAdoption: input => analyzeSourceDeclarationGenericAdoption({ source: owner(), ...input }),
        extension(key) {
            if (created.has(key.id))
                return created.get(key.id);
            const extension = registered.get(key.id);
            if (extension === undefined || extension.key !== key) {
                throw new Error(`Source analysis extension '${key.id}' is not registered for this program.`);
            }
            const value = extension.create(owner());
            created.set(key.id, value);
            return value;
        },
    };
    return Object.freeze(facts);
}
function publishPropertyName(selection) {
    switch (selection.kind) {
        case "resolved": {
            const constant = selection.constant;
            return Object.freeze({ kind: "resolved", name: selection.name, constant: constant.kind === "enum-member"
                    ? Object.freeze({ kind: "enum-member", declaration: constant.entry.declaration, value: constant.entry.value })
                    : constant });
        }
        case "well-known-symbol":
            return Object.freeze({ kind: "well-known-symbol",
                symbol: `Symbol.${selection.symbol.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}` });
        case "unique-symbol":
            // Request R-B2-3 (property-names owner): the Host selection carries the declaring `unique symbol` binding.
            return Object.freeze({ kind: "unique-symbol", declaration: selection.declaration });
        case "rejected":
            return Object.freeze({ kind: "rejected", reason: selection.reason, failure: selection.failure });
    }
}
//# sourceMappingURL=source-analyses.js.map