import { createSourceProgramNavigation } from "../source-navigation/index.js";
import { createSourceRoleModel } from "../source-navigation/roles.js";
import { createSourceNavigationInput } from "../host-input/navigation.js";
import { createSourceSemanticsInput } from "../host-input/semantics-program.js";
import { createSourceHostInput } from "../host-input/index.js";
import { createHostCheckerInput } from "../host-input/objects.js";
import { createSourceObjectFacts } from "../object-facts/objects.js";
import { createSourceSelectionFacts } from "../object-facts/selections.js";
import { createSourceSelectionRefusals } from "../object-facts/selection-refusals.js";
import { assembleSourceProgramFacts } from "../public/source/assembly.js";
import { createSourceAnalysisFacts } from "../target-analysis/source-analyses.js";
import { createSourceProgramDocuments } from "./source-documents.js";
import { analyzeSourceEnumConstants } from "./enum-constants.js";
import { analyzeSourceEnumNumericUses } from "./enum-numeric-uses.js";
import { resolveSourceFlowConditions } from "./flow-conditions.js";
import { buildSourceValueModelFacts } from "./local-type-flow/program-facts.js";
import { sourceTypeDescriptorStructure } from "./local-type-flow/terms.js";
import { sourceTypeDescriptorPresentArms } from "./descriptor-arms.js";
import { sourceTypeDescriptorTypeofCategory } from "./descriptor-categories.js";
/** The target-facing program: published facts, documents, the authored-syntax reader and the extension facts only (I1). */
export function createTargetSourceProgram(source, options) {
    const host = createHostSourceProgram(source, options);
    return Object.freeze({
        facts: host.facts,
        documents: host.documents,
        sourceFiles: host.sourceFiles,
        syntax: host.ast,
        sourceFacts: host.sourceFacts,
    });
}
/** The Host-internal program owner. Every per-program table (inputs, value model, roles, objects) lives here (I5). */
export function createHostSourceProgram(source, options) {
    return buildHostSourceProgram(source, options).program;
}
/**
 * The Host program plus its host-input instances. Host-internal: createHostSourceProgram keeps only `program`; the
 * test fixtures (host-program-fixtures.ts) also expose the checker views and the host-input adapter to host-input tests.
 * Every input is built exactly once per program and shared (R4): one navigation input, one checker semantics input,
 * one SourceHostInput (value model and object witnesses), one value model.
 */
export function buildHostSourceProgram(source, options) {
    const { ast } = source;
    const sourceFiles = Object.freeze(source.sourceFiles.filter((file) => file !== undefined));
    const documents = createSourceProgramDocuments(ast, sourceFiles);
    const navigationInput = createSourceNavigationInput(source);
    const navigation = createSourceProgramNavigation(navigationInput);
    const enumConstants = analyzeSourceEnumConstants(ast, sourceFiles, navigation);
    const checker = createSourceSemanticsInput(source, { navigation, enumConstants });
    const { semantics } = checker;
    const services = Object.freeze({ ast, sourceFiles, sourceFacts: source.sourceFacts, navigation, semantics,
        platform: options.platform, enumIntegerWidth: (declaration) => enumConstants.integerWidth(declaration) });
    const input = createSourceHostInput(services);
    const valueModel = buildSourceValueModelFacts(services, source.programSourceFiles, input);
    const witnesses = createHostCheckerInput({ ...services, input });
    const selections = createSourceSelectionFacts({
        ast, witnesses, values: valueModel.values, instantiations: valueModel.instantiations,
        pointerOperation: valueModel.pointerOperation, sums: valueModel.sums, navigation,
    });
    const objects = createSourceObjectFacts({ ast, sourceFiles: source.programSourceFiles, navigation, values: valueModel.values, selections,
        substitute: valueModel.sums.substitute, join: valueModel.sums.join });
    const roles = createSourceRoleModel({
        ast,
        navigation,
        valueTypeDeclaration: node => valueTypeDeclaration(valueModel.values, node),
        valueIsPrimitive: node => valueIsPrimitive(ast, valueModel.values, node),
        conditionValue(expression) {
            const kind = ast.kindName(expression);
            if (kind === "KindTrueKeyword")
                return true;
            if (kind === "KindFalseKeyword")
                return false;
            const literal = valueModel.values.literal(expression);
            return literal?.form === "true" ? true : literal?.form === "false" ? false : undefined;
        },
    });
    const profile = options.profile({ ast, sourceFacts: source.sourceFacts, wellKnownSymbol: selections.wellKnownSymbol,
        presentArms: sourceTypeDescriptorPresentArms,
        typeofCategory: type => sourceTypeDescriptorTypeofCategory(ast, type, valueModel.values.literal) });
    let program;
    const analyses = createSourceAnalysisFacts(() => program ?? (() => { throw new Error("Source analyses run only after the Host program is assembled."); })(), options.analyses ?? [], options.platform, signature => selections.signatureParameters(signature));
    const facts = assembleSourceProgramFacts({
        documents,
        values: valueModel.values,
        sums: valueModel.sums,
        relations: valueModel.relations,
        instantiations: valueModel.instantiations,
        selections,
        navigation: roles,
        objects,
        profile,
        analyses,
        obligations: valueModel.obligations,
        refusalSources: Object.freeze([
            valueModel.refusals,
            createSourceSelectionRefusals({ ast, sourceFiles: source.programSourceFiles, selections, profile }),
            objects.refusals,
            // One collection (CONTRACT, R5; R4 #32): the enum declaration and enum-use issues as Host refusals with their own
            // code, message and site. Property-name issues stay a per-node query (analyses.propertyNameIssue, Q93).
            () => owner().enums.issues.map(issue => Object.freeze({ kind: "refused", code: issue.code, message: issue.message,
                site: issue.sourceNode })),
        ]),
    });
    const owner = () => program ?? (() => { throw new Error("Source refusals are read only after the Host program is assembled."); })();
    const enums = hostEnumFacts(enumConstants, () => analyzeSourceEnumNumericUses({ ast, sourceFiles: navigation.sourceFiles, navigation, values: valueModel.values, profile }, enumConstants));
    const flowConditions = new WeakMap();
    program = Object.freeze({
        ast,
        sourceFiles,
        documents,
        sourceFacts: source.sourceFacts,
        navigation,
        facts,
        enums,
        propertyNames(sourceFile) {
            if (!sourceFiles.includes(sourceFile))
                throw new Error("Property-name facts require a source file of the checked program.");
            return checker.propertyNames(sourceFile);
        },
        flowConditions(reference) {
            const known = flowConditions.get(reference);
            if (known !== undefined)
                return known ?? undefined;
            const selected = resolveSourceFlowConditions({ ast, navigation, sourceFacts: source.sourceFacts, effects: roles.expressions.effects }, reference, checker.flowConditions(reference));
            flowConditions.set(reference, selected ?? null);
            return selected;
        },
    });
    return Object.freeze({ program, semantics, input });
}
/**
 * The enum facts of the program: the constant index, with `issues` = the declaration issues followed by the enum-use
 * issues over the value model. The use issues are computed once, on the first read of `issues` (the value model is
 * complete by then).
 */
function hostEnumFacts(constants, useIssues) {
    let issues;
    return Object.freeze({
        entries: constants.entries,
        get: constants.get,
        integerWidth: constants.integerWidth,
        get issues() {
            issues ?? (issues = Object.freeze([...constants.issues, ...useIssues()]));
            return issues;
        },
    });
}
/**
 * The declaration the Host value type at `node` names (role model input): a declared descriptor, or a union whose only
 * non-absent arm is declared. From the Host value model, never a checked type (R3).
 */
function valueTypeDeclaration(values, node) {
    if (!values.has(node))
        return undefined;
    const outcome = values.type(node);
    if (outcome.kind === "refused")
        return undefined;
    const arms = sourceTypeDescriptorPresentArms(outcome.type);
    const arm = arms.length === 1 ? arms[0] : undefined;
    return arm?.kind === "declared" ? arm.declaration : undefined;
}
/**
 * Whether the Host value type at `node` is definitely primitive, so coercing it runs no user code (role model input of
 * the expression effects, R2 #15). Primitive: the number family, bool, char, string, bigint, void, never and absence,
 * an enum, and a union or optional whose every arm is primitive (baseline typeIsDefinitelyPrimitive over the checked
 * type, now over the Host descriptor). any, unknown, object, symbol, type variables, shapes and unexpressible references
 * are not. A node without a value, or a refused value, is not proven primitive (its refusal is in facts.refusals()).
 */
function valueIsPrimitive(ast, values, node) {
    if (!values.has(node))
        return false;
    const outcome = values.type(node);
    if (outcome.kind === "refused")
        return false;
    const primitive = (type, depth) => {
        if (depth > 32)
            return false;
        const structure = sourceTypeDescriptorStructure(type);
        switch (structure.kind) {
            case "primitive":
            case "string": return true;
            case "intrinsic": return structure.intrinsic === "void" || structure.intrinsic === "never" ||
                structure.intrinsic === "absence" || structure.intrinsic === "bigint";
            case "optional": return primitive(structure.value, depth + 1);
            case "union": return structure.types.length > 0 && structure.types.every(arm => primitive(arm, depth + 1));
            case "declared": return ast.is.IsEnumDeclaration(structure.declaration) || ast.is.IsEnumMember(structure.declaration);
            default: return false;
        }
    };
    return primitive(outcome.type, 0);
}
//# sourceMappingURL=target-source-program.js.map