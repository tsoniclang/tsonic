import type { CandidateInput, CoreInput, DeferredDecision, DeferredInvocation, DomainFitInput, EmbedInput, IndexInput, LibraryInput, LiteralConstructionInput, LiteralFitInput, MemberInput, MemoryEquivalentInput, OperatorInput, ProtocolInput, RefinementInput } from "./contract.js";
import { enumSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { RuleInputsSchemas } from "./text-rule-inputs.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface DeferredEmbedRecord {
  readonly rule: "embed";
  readonly input: EmbedInput;
}

export interface DeferredDomainRecord {
  readonly rule: "domain-fit";
  readonly input: DomainFitInput;
}

export interface DeferredMemoryRecord {
  readonly rule: "memory-equivalent";
  readonly input: MemoryEquivalentInput;
}

export interface DeferredMemberRecord {
  readonly rule: "member";
  readonly input: MemberInput;
}

export interface DeferredIndexRecord {
  readonly rule: "index";
  readonly input: IndexInput;
}

export interface DeferredConstructionRecord {
  readonly rule: "construct-literal";
  readonly input: LiteralConstructionInput;
}

export interface DeferredCandidateRecord {
  readonly rule: "candidate";
  readonly input: CandidateInput;
}

export interface DeferredOperatorRecord {
  readonly rule: "operator";
  readonly input: OperatorInput;
}

export interface DeferredLiteralRecord {
  readonly rule: "literal-fit";
  readonly input: LiteralFitInput;
}

export interface DeferredProtocolRecord {
  readonly rule: "protocol";
  readonly input: ProtocolInput;
}

export interface DeferredRefinementRecord {
  readonly rule: "refinement";
  readonly input: RefinementInput;
}

export interface DeferredLibraryRecord {
  readonly rule: "library";
  readonly input: LibraryInput;
}

export interface DeferredCoreRecord {
  readonly rule: "core";
  readonly input: CoreInput;
}

export interface InvocationsSchemas {
  readonly deferredDecisionSchema: RecordSchema<DeferredDecision>;
  readonly deferredInvocationSchema: RecordSchema<DeferredInvocation>;
  readonly deferredEmbedSchema: RecordSchema<DeferredEmbedRecord>;
  readonly deferredDomainSchema: RecordSchema<DeferredDomainRecord>;
  readonly deferredMemorySchema: RecordSchema<DeferredMemoryRecord>;
  readonly deferredMemberSchema: RecordSchema<DeferredMemberRecord>;
  readonly deferredIndexSchema: RecordSchema<DeferredIndexRecord>;
  readonly deferredConstructionSchema: RecordSchema<DeferredConstructionRecord>;
  readonly deferredCandidateSchema: RecordSchema<DeferredCandidateRecord>;
  readonly deferredOperatorSchema: RecordSchema<DeferredOperatorRecord>;
  readonly deferredLiteralSchema: RecordSchema<DeferredLiteralRecord>;
  readonly deferredProtocolSchema: RecordSchema<DeferredProtocolRecord>;
  readonly deferredRefinementSchema: RecordSchema<DeferredRefinementRecord>;
  readonly deferredLibrarySchema: RecordSchema<DeferredLibraryRecord>;
  readonly deferredCoreSchema: RecordSchema<DeferredCoreRecord>;
  readonly embedRuleSchema: Schema<"embed">;
  readonly domainRuleSchema: Schema<"domain-fit">;
  readonly memoryRuleSchema: Schema<"memory-equivalent">;
  readonly memberRuleSchema: Schema<"member">;
  readonly indexRuleSchema: Schema<"index">;
  readonly constructionRuleSchema: Schema<"construct-literal">;
  readonly candidateRuleSchema: Schema<"candidate">;
  readonly operatorRuleSchema: Schema<"operator">;
  readonly literalRuleSchema: Schema<"literal-fit">;
  readonly protocolRuleSchema: Schema<"protocol">;
  readonly refinementRuleSchema: Schema<"refinement">;
  readonly libraryRuleSchema: Schema<"library">;
  readonly coreRuleSchema: Schema<"core">;
}

export function createInvocationsSchemas(data: DataSchemas, ruleInputs: RuleInputsSchemas): InvocationsSchemas {
  const { tSchema } = data;
  const { candidateInputSchema, coreInputSchema, domainFitInputSchema, embedInputSchema, indexInputSchema, libraryInputSchema, literalConstructionInputSchema, literalFitInputSchema, memberInputSchema, memoryEquivalentInputSchema, operatorInputSchema, protocolInputSchema, refinementInputSchema } = ruleInputs;
  const deferredDecisionSchema = recordSchema<DeferredDecision>("DeferredDecision", "DeferredDecision", read => {
    const invocation = read("invocation", () => deferredInvocationSchema, value => value.invocation);
    const result = read("result", () => tSchema, value => value.result);
    return { fields: [invocation, result], value: () => ({ invocation: invocation.value(), result: result.value() }) };
  });

  const deferredInvocationSchema: RecordSchema<DeferredInvocation> = unionSchema<DeferredInvocation>("DeferredInvocation",
    () => [deferredEmbedSchema, deferredDomainSchema, deferredMemorySchema, deferredMemberSchema, deferredIndexSchema, deferredConstructionSchema, deferredCandidateSchema, deferredOperatorSchema, deferredLiteralSchema, deferredProtocolSchema, deferredRefinementSchema, deferredLibrarySchema, deferredCoreSchema], value => {
    switch (value.rule) {
      case "embed": return deferredEmbedSchema.stage(value);
      case "domain-fit": return deferredDomainSchema.stage(value);
      case "memory-equivalent": return deferredMemorySchema.stage(value);
      case "member": return deferredMemberSchema.stage(value);
      case "index": return deferredIndexSchema.stage(value);
      case "construct-literal": return deferredConstructionSchema.stage(value);
      case "candidate": return deferredCandidateSchema.stage(value);
      case "operator": return deferredOperatorSchema.stage(value);
      case "literal-fit": return deferredLiteralSchema.stage(value);
      case "protocol": return deferredProtocolSchema.stage(value);
      case "refinement": return deferredRefinementSchema.stage(value);
      case "library": return deferredLibrarySchema.stage(value);
      case "core": return deferredCoreSchema.stage(value);
    }
  });

  const deferredEmbedSchema = recordSchema<DeferredEmbedRecord>("DeferredEmbed", "DeferredInvocation", read => {
    const rule = read("rule", () => embedRuleSchema, value => value.rule);
    const input = read("input", () => embedInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredDomainSchema = recordSchema<DeferredDomainRecord>("DeferredDomain", "DeferredInvocation", read => {
    const rule = read("rule", () => domainRuleSchema, value => value.rule);
    const input = read("input", () => domainFitInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredMemorySchema = recordSchema<DeferredMemoryRecord>("DeferredMemory", "DeferredInvocation", read => {
    const rule = read("rule", () => memoryRuleSchema, value => value.rule);
    const input = read("input", () => memoryEquivalentInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredMemberSchema = recordSchema<DeferredMemberRecord>("DeferredMember", "DeferredInvocation", read => {
    const rule = read("rule", () => memberRuleSchema, value => value.rule);
    const input = read("input", () => memberInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredIndexSchema = recordSchema<DeferredIndexRecord>("DeferredIndex", "DeferredInvocation", read => {
    const rule = read("rule", () => indexRuleSchema, value => value.rule);
    const input = read("input", () => indexInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredConstructionSchema = recordSchema<DeferredConstructionRecord>("DeferredConstruction", "DeferredInvocation", read => {
    const rule = read("rule", () => constructionRuleSchema, value => value.rule);
    const input = read("input", () => literalConstructionInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredCandidateSchema = recordSchema<DeferredCandidateRecord>("DeferredCandidate", "DeferredInvocation", read => {
    const rule = read("rule", () => candidateRuleSchema, value => value.rule);
    const input = read("input", () => candidateInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredOperatorSchema = recordSchema<DeferredOperatorRecord>("DeferredOperator", "DeferredInvocation", read => {
    const rule = read("rule", () => operatorRuleSchema, value => value.rule);
    const input = read("input", () => operatorInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredLiteralSchema = recordSchema<DeferredLiteralRecord>("DeferredLiteral", "DeferredInvocation", read => {
    const rule = read("rule", () => literalRuleSchema, value => value.rule);
    const input = read("input", () => literalFitInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredProtocolSchema = recordSchema<DeferredProtocolRecord>("DeferredProtocol", "DeferredInvocation", read => {
    const rule = read("rule", () => protocolRuleSchema, value => value.rule);
    const input = read("input", () => protocolInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredRefinementSchema = recordSchema<DeferredRefinementRecord>("DeferredRefinement", "DeferredInvocation", read => {
    const rule = read("rule", () => refinementRuleSchema, value => value.rule);
    const input = read("input", () => refinementInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredLibrarySchema = recordSchema<DeferredLibraryRecord>("DeferredLibrary", "DeferredInvocation", read => {
    const rule = read("rule", () => libraryRuleSchema, value => value.rule);
    const input = read("input", () => libraryInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const deferredCoreSchema = recordSchema<DeferredCoreRecord>("DeferredCore", "DeferredInvocation", read => {
    const rule = read("rule", () => coreRuleSchema, value => value.rule);
    const input = read("input", () => coreInputSchema, value => value.input);
    return { fields: [rule, input], value: () => ({ rule: rule.value(), input: input.value() }) };
  });

  const embedRuleSchema = enumSchema("EmbedRule", ["embed"]);

  const domainRuleSchema = enumSchema("DomainRule", ["domain-fit"]);

  const memoryRuleSchema = enumSchema("MemoryRule", ["memory-equivalent"]);

  const memberRuleSchema = enumSchema("MemberRule", ["member"]);

  const indexRuleSchema = enumSchema("IndexRule", ["index"]);

  const constructionRuleSchema = enumSchema("ConstructionRule", ["construct-literal"]);

  const candidateRuleSchema = enumSchema("CandidateRule", ["candidate"]);

  const operatorRuleSchema = enumSchema("OperatorRule", ["operator"]);

  const literalRuleSchema = enumSchema("LiteralRule", ["literal-fit"]);

  const protocolRuleSchema = enumSchema("ProtocolRule", ["protocol"]);

  const refinementRuleSchema = enumSchema("RefinementRule", ["refinement"]);

  const libraryRuleSchema = enumSchema("LibraryRule", ["library"]);

  const coreRuleSchema = enumSchema("CoreRule", ["core"]);
  return { deferredDecisionSchema, deferredInvocationSchema, deferredEmbedSchema, deferredDomainSchema, deferredMemorySchema, deferredMemberSchema, deferredIndexSchema, deferredConstructionSchema, deferredCandidateSchema, deferredOperatorSchema, deferredLiteralSchema, deferredProtocolSchema, deferredRefinementSchema, deferredLibrarySchema, deferredCoreSchema, embedRuleSchema, domainRuleSchema, memoryRuleSchema, memberRuleSchema, indexRuleSchema, constructionRuleSchema, candidateRuleSchema, operatorRuleSchema, literalRuleSchema, protocolRuleSchema, refinementRuleSchema, libraryRuleSchema, coreRuleSchema };
}
