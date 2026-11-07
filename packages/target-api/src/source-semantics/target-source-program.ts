import type { CheckedSourceProgram, Node, SourceFile } from "@tsonic/tsts";
import { createSourceProgramNavigation } from "../source-navigation/index.js";
import { createSourceRoleModel } from "../source-navigation/roles.js";
import { createSourceNavigationInput } from "../host-input/navigation.js";
import { createSourceSemanticsInput } from "../host-input/semantics-program.js";
import { createSourceHostInput, type SourceHostInput } from "../host-input/index.js";
import { createHostCheckerInput } from "../host-input/objects.js";
import type { SourceProgramSemantics } from "../host-input/semantics-types.js";
import { createSourceObjectFacts } from "../object-facts/objects.js";
import { createSourceSelectionFacts } from "../object-facts/selections.js";
import { createSourceSelectionRefusals } from "../object-facts/selection-refusals.js";
import { assembleSourceProgramFacts, type SourceJsApiFactsFactory } from "../public/source/assembly.js";
import type { TargetSourceProgramFacts } from "../public/source/index.js";
import type { SourceAnalysisExtension } from "../public/source/analyses.js";
import type { SourceValueFacts } from "../public/source/facts.js";
import { createSourceAnalysisFacts } from "../target-analysis/source-analyses.js";
import { createSourceProgramDocuments } from "./source-documents.js";
import { analyzeSourceEnumConstants } from "./enum-constants.js";
import { analyzeSourceEnumNumericUses } from "./enum-numeric-uses.js";
import type { SourceEnumAdmissionIssue, SourceEnumConstantIndex } from "./enum-model.js";
import { resolveSourceFlowConditions } from "./flow-conditions.js";
import { buildSourceValueModelFacts } from "./local-type-flow/program-facts.js";
import { sourceTypeDescriptorStructure } from "./local-type-flow/terms.js";
import type { SourceTypeDescriptor } from "./local-type-flow/types.js";
import type { SourceFlowConditions } from "./value-flow-model.js";
import type { HostSourceProgram } from "./types.js";
import type { SourcePlatformFacts } from "./platform-model.js";

export interface TargetSourceProgramOptions {
  /** The JS API profile builder (js-source-profile createJsSourceApiFacts), supplied by the composition root. */
  readonly profile: SourceJsApiFactsFactory;
  /** Host extension analyses (source-core), published as facts.analyses.extension(key); supplied by the composition root. */
  readonly analyses?: readonly SourceAnalysisExtension<unknown>[];
  /**
   * The active target/toolchain ABI premise for native-int / native-uint (E24, N5): known 32 / 64, missing or
   * conflicting. The composition root passes the selected target's own premise for the compilation being built; it is
   * never the coordinating machine's width. Published unchanged as facts.analyses.platform.
   */
  readonly platform: SourcePlatformFacts;
}

/** The target-facing program: published facts, documents, the authored-syntax reader and the extension facts only (I1). */
export function createTargetSourceProgram(
  source: CheckedSourceProgram,
  options: TargetSourceProgramOptions,
): TargetSourceProgramFacts {
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
export function createHostSourceProgram(
  source: CheckedSourceProgram,
  options: TargetSourceProgramOptions,
): HostSourceProgram {
  return buildHostSourceProgram(source, options).program;
}

/**
 * The Host program plus its host-input instances. Host-internal: createHostSourceProgram keeps only `program`; the
 * test fixtures (host-program-fixtures.ts) also expose the checker views and the host-input adapter to host-input tests.
 * Every input is built exactly once per program and shared (R4): one navigation input, one checker semantics input,
 * one SourceHostInput (value model and object witnesses), one value model.
 */
export function buildHostSourceProgram(
  source: CheckedSourceProgram,
  options: TargetSourceProgramOptions,
): { readonly program: HostSourceProgram; readonly semantics: SourceProgramSemantics; readonly input: SourceHostInput } {
  const { ast } = source;
  const sourceFiles = Object.freeze(source.sourceFiles.filter((file): file is SourceFile => file !== undefined));
  const documents = createSourceProgramDocuments(ast, sourceFiles);
  const navigationInput = createSourceNavigationInput(source);
  const navigation = createSourceProgramNavigation(navigationInput);
  const enumConstants = analyzeSourceEnumConstants(ast, sourceFiles, navigation);
  const checker = createSourceSemanticsInput(source, { navigation, enumConstants });
  const { semantics } = checker;

  const services = Object.freeze({ ast, sourceFiles, sourceFacts: source.sourceFacts, navigation, semantics,
    platform: options.platform });
  const input = createSourceHostInput(services);
  const valueModel = buildSourceValueModelFacts(services, source.programSourceFiles, input);
  const witnesses = createHostCheckerInput({ ...services, input });
  const selections = createSourceSelectionFacts({
    ast, witnesses, values: valueModel.values, instantiations: valueModel.instantiations,
    pointerOperation: valueModel.pointerOperation,
  });
  const objects = createSourceObjectFacts({ ast, navigation, values: valueModel.values, selections,
    substitute: valueModel.sums.substitute });
  const roles = createSourceRoleModel({
    ast,
    navigation,
    valueTypeDeclaration: node => valueTypeDeclaration(valueModel.values, node),
    conditionValue(expression: Node) {
      const kind = ast.kindName(expression);
      if (kind === "KindTrueKeyword") return true;
      if (kind === "KindFalseKeyword") return false;
      const literal = valueModel.values.literal(expression);
      return literal?.form === "true" ? true : literal?.form === "false" ? false : undefined;
    },
  });
  const profile = options.profile({ ast, sourceFacts: source.sourceFacts, wellKnownSymbol: selections.wellKnownSymbol });
  let program: HostSourceProgram | undefined;
  const analyses = createSourceAnalysisFacts(
    () => program ?? (() => { throw new Error("Source analyses run only after the Host program is assembled."); })(),
    options.analyses ?? [], options.platform);
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
    ]),
  });

  const enums = hostEnumFacts(enumConstants, () => analyzeSourceEnumNumericUses(
    { ast, sourceFiles: navigation.sourceFiles, navigation, values: valueModel.values }, enumConstants));
  const flowConditions = new WeakMap<Node, SourceFlowConditions | null>();
  program = Object.freeze({
    ast,
    sourceFiles,
    documents,
    sourceFacts: source.sourceFacts,
    navigation,
    facts,
    enums,
    propertyNames(sourceFile: SourceFile) {
      if (!sourceFiles.includes(sourceFile)) throw new Error("Property-name facts require a source file of the checked program.");
      return checker.propertyNames(sourceFile);
    },
    flowConditions(reference: Node) {
      const known = flowConditions.get(reference);
      if (known !== undefined) return known ?? undefined;
      const selected = resolveSourceFlowConditions({ ast, navigation, sourceFacts: source.sourceFacts },
        reference, checker.flowConditions(reference));
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
function hostEnumFacts(
  constants: SourceEnumConstantIndex,
  useIssues: () => readonly SourceEnumAdmissionIssue[],
): SourceEnumConstantIndex {
  let issues: readonly SourceEnumAdmissionIssue[] | undefined;
  return Object.freeze({
    entries: constants.entries,
    get: constants.get,
    integerWidth: constants.integerWidth,
    get issues() {
      issues ??= Object.freeze([...constants.issues, ...useIssues()]);
      return issues;
    },
  });
}

/**
 * The declaration the Host value type at `node` names (role model input): a declared descriptor, or a union whose only
 * non-absent arm is declared. From the Host value model, never a checked type (R3).
 */
function valueTypeDeclaration(values: Pick<SourceValueFacts, "has" | "type">, node: Node): Node | undefined {
  if (!values.has(node)) return undefined;
  const outcome = values.type(node);
  if (outcome.kind === "refused") return undefined;
  const present = (type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] => {
    if (type.kind === "optional") return present(type.value);
    if (type.kind === "union") return type.types.flatMap(present);
    const structure = sourceTypeDescriptorStructure(type);
    if (structure.kind === "union" || structure.kind === "optional") return present(structure);
    return structure.kind === "intrinsic" && (structure.intrinsic === "absence" || structure.intrinsic === "void") ? [] : [type];
  };
  const arms = present(outcome.type);
  const arm = arms.length === 1 ? arms[0]! : undefined;
  return arm?.kind === "declared" ? arm.declaration : undefined;
}
