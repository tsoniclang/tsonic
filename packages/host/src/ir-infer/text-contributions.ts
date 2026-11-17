import type { AtomicContribution, ConstraintRef, ContributionKey, ContributionRole } from "./contract.js";
import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface EqualityRoleRecord {
  readonly kind: "equality";
  readonly direction: "left-to-right" | "right-to-left";
}

export interface FlowContributionRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface SelectionRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface ArgumentFlowRecord {
  readonly kind: "argument-flow";
  readonly argument: number;
  readonly component: number;
}

export interface ReceiverFlowRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface ContextFlowRecord {
  readonly kind: "context-flow";
  readonly argument: number;
  readonly parameter: number;
}

export interface ClosureFlowRecord {
  readonly kind: "closure-result-flow";
  readonly argument: number;
  readonly result: number;
}

export interface ApplicationResultRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface MemberRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface IndexRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface OperatorRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface LiteralRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface ProtocolRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface RefinementRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface DischargeRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface DefaultRoleRecord {
  readonly kind: "flow" | "selection" | "receiver-flow" | "application-result" | "member" | "index" | "operator" | "literal" | "protocol" | "refinement" | "discharge" | "default";

}

export interface ConstructionPartRoleRecord {
  readonly kind: "construction-part";
  readonly part: number;
}

export interface ContributionsSchemas {
  readonly constraintRefSchema: RecordSchema<ConstraintRef>;
  readonly atomicContributionSchema: RecordSchema<AtomicContribution>;
  readonly contributionKeySchema: RecordSchema<ContributionKey>;
  readonly contributionRoleSchema: RecordSchema<ContributionRole>;
  readonly equalityRoleSchema: RecordSchema<EqualityRoleRecord>;
  readonly equalityDirectionSchema: Schema<"left-to-right" | "right-to-left">;
  readonly flowContributionSchema: RecordSchema<FlowContributionRecord>;
  readonly selectionRoleSchema: RecordSchema<SelectionRoleRecord>;
  readonly argumentFlowSchema: RecordSchema<ArgumentFlowRecord>;
  readonly receiverFlowSchema: RecordSchema<ReceiverFlowRecord>;
  readonly contextFlowSchema: RecordSchema<ContextFlowRecord>;
  readonly closureFlowSchema: RecordSchema<ClosureFlowRecord>;
  readonly applicationResultSchema: RecordSchema<ApplicationResultRecord>;
  readonly memberRoleSchema: RecordSchema<MemberRoleRecord>;
  readonly indexRoleSchema: RecordSchema<IndexRoleRecord>;
  readonly operatorRoleSchema: RecordSchema<OperatorRoleRecord>;
  readonly literalRoleSchema: RecordSchema<LiteralRoleRecord>;
  readonly protocolRoleSchema: RecordSchema<ProtocolRoleRecord>;
  readonly refinementRoleSchema: RecordSchema<RefinementRoleRecord>;
  readonly dischargeRoleSchema: RecordSchema<DischargeRoleRecord>;
  readonly defaultRoleSchema: RecordSchema<DefaultRoleRecord>;
  readonly constructionPartRoleSchema: RecordSchema<ConstructionPartRoleRecord>;
}

export function createContributionsSchemas(data: DataSchemas): ContributionsSchemas {
  const { bodySchema, nodeRefSchema, numberSchema } = data;
  const constraintRefSchema = recordSchema<ConstraintRef>("ConstraintRef", "ConstraintRef", read => {
    const body = read("body", () => bodySchema, value => value.body);
    const index = read("index", () => numberSchema, value => value.index);
    return { fields: [body, index], value: () => ({ body: body.value(), index: index.value() }) };
  });

  const atomicContributionSchema = recordSchema<AtomicContribution>("AtomicContribution", "AtomicContribution", read => {
    const key = read("key", () => contributionKeySchema, value => value.key);
    const reads = read("reads", () => arraySchema(numberSchema), value => value.reads);
    const bounds = read("bounds", () => arraySchema(numberSchema), value => value.bounds);
    const constraint = read("constraint", () => constraintRefSchema, value => value.constraint);
    return { fields: [key, reads, bounds, constraint], value: () => ({ key: key.value(), reads: reads.value(), bounds: bounds.value(), constraint: constraint.value() }) };
  });

  const contributionKeySchema = recordSchema<ContributionKey>("ContributionKey", "ContributionKey", read => {
    const node = read("node", () => nodeRefSchema, value => value.node);
    const candidate = read("candidate", () => nullableSchema(numberSchema), value => value.candidate);
    const role = read("role", () => contributionRoleSchema, value => value.role);
    return { fields: [node, candidate, role], value: () => ({ node: node.value(), candidate: candidate.value(), role: role.value() }) };
  });

  const contributionRoleSchema: RecordSchema<ContributionRole> = unionSchema<ContributionRole>("ContributionRole",
    () => [equalityRoleSchema, flowContributionSchema, selectionRoleSchema, argumentFlowSchema, receiverFlowSchema, contextFlowSchema, closureFlowSchema, applicationResultSchema, memberRoleSchema, indexRoleSchema, operatorRoleSchema, literalRoleSchema, protocolRoleSchema, refinementRoleSchema, dischargeRoleSchema, defaultRoleSchema, constructionPartRoleSchema], value => {
    switch (value.kind) {
      case "equality": return equalityRoleSchema.stage(value);
      case "flow": return flowContributionSchema.stage(value);
      case "selection": return selectionRoleSchema.stage(value);
      case "argument-flow": return argumentFlowSchema.stage(value);
      case "receiver-flow": return receiverFlowSchema.stage(value);
      case "context-flow": return contextFlowSchema.stage(value);
      case "closure-result-flow": return closureFlowSchema.stage(value);
      case "application-result": return applicationResultSchema.stage(value);
      case "member": return memberRoleSchema.stage(value);
      case "index": return indexRoleSchema.stage(value);
      case "operator": return operatorRoleSchema.stage(value);
      case "literal": return literalRoleSchema.stage(value);
      case "protocol": return protocolRoleSchema.stage(value);
      case "refinement": return refinementRoleSchema.stage(value);
      case "discharge": return dischargeRoleSchema.stage(value);
      case "default": return defaultRoleSchema.stage(value);
      case "construction-part": return constructionPartRoleSchema.stage(value);
    }
  });

  const equalityRoleSchema = recordSchema<EqualityRoleRecord>("EqualityRole", "equality", read => {
    const direction = read("direction", () => equalityDirectionSchema, value => value.direction);
    return { fields: [direction], value: () => ({ kind: "equality", direction: direction.value() }) };
  });

  const equalityDirectionSchema = enumSchema("EqualityDirection", ["left-to-right","right-to-left"]);

  const flowContributionSchema = recordSchema<FlowContributionRecord>("FlowContribution", "flow", () => {
    return { fields: [], value: () => ({ kind: "flow" }) };
  });

  const selectionRoleSchema = recordSchema<SelectionRoleRecord>("SelectionRole", "selection", () => {
    return { fields: [], value: () => ({ kind: "selection" }) };
  });

  const argumentFlowSchema = recordSchema<ArgumentFlowRecord>("ArgumentFlow", "argument-flow", read => {
    const argument = read("argument", () => numberSchema, value => value.argument);
    const component = read("component", () => numberSchema, value => value.component);
    return { fields: [argument, component], value: () => ({ kind: "argument-flow", argument: argument.value(), component: component.value() }) };
  });

  const receiverFlowSchema = recordSchema<ReceiverFlowRecord>("ReceiverFlow", "receiver-flow", () => {
    return { fields: [], value: () => ({ kind: "receiver-flow" }) };
  });

  const contextFlowSchema = recordSchema<ContextFlowRecord>("ContextFlow", "context-flow", read => {
    const argument = read("argument", () => numberSchema, value => value.argument);
    const parameter = read("parameter", () => numberSchema, value => value.parameter);
    return { fields: [argument, parameter], value: () => ({ kind: "context-flow", argument: argument.value(), parameter: parameter.value() }) };
  });

  const closureFlowSchema = recordSchema<ClosureFlowRecord>("ClosureFlow", "closure-result-flow", read => {
    const argument = read("argument", () => numberSchema, value => value.argument);
    const result = read("result", () => numberSchema, value => value.result);
    return { fields: [argument, result], value: () => ({ kind: "closure-result-flow", argument: argument.value(), result: result.value() }) };
  });

  const applicationResultSchema = recordSchema<ApplicationResultRecord>("ApplicationResult", "application-result", () => {
    return { fields: [], value: () => ({ kind: "application-result" }) };
  });

  const memberRoleSchema = recordSchema<MemberRoleRecord>("MemberRole", "member", () => {
    return { fields: [], value: () => ({ kind: "member" }) };
  });

  const indexRoleSchema = recordSchema<IndexRoleRecord>("IndexRole", "index", () => {
    return { fields: [], value: () => ({ kind: "index" }) };
  });

  const operatorRoleSchema = recordSchema<OperatorRoleRecord>("OperatorRole", "operator", () => {
    return { fields: [], value: () => ({ kind: "operator" }) };
  });

  const literalRoleSchema = recordSchema<LiteralRoleRecord>("LiteralRole", "literal", () => {
    return { fields: [], value: () => ({ kind: "literal" }) };
  });

  const protocolRoleSchema = recordSchema<ProtocolRoleRecord>("ProtocolRole", "protocol", () => {
    return { fields: [], value: () => ({ kind: "protocol" }) };
  });

  const refinementRoleSchema = recordSchema<RefinementRoleRecord>("RefinementRole", "refinement", () => {
    return { fields: [], value: () => ({ kind: "refinement" }) };
  });

  const dischargeRoleSchema = recordSchema<DischargeRoleRecord>("DischargeRole", "discharge", () => {
    return { fields: [], value: () => ({ kind: "discharge" }) };
  });

  const defaultRoleSchema = recordSchema<DefaultRoleRecord>("DefaultRole", "default", () => {
    return { fields: [], value: () => ({ kind: "default" }) };
  });

  const constructionPartRoleSchema = recordSchema<ConstructionPartRoleRecord>("ConstructionPartRole", "construction-part", read => {
    const part = read("part", () => numberSchema, value => value.part);
    return { fields: [part], value: () => ({ kind: "construction-part", part: part.value() }) };
  });
  return { constraintRefSchema, atomicContributionSchema, contributionKeySchema, contributionRoleSchema, equalityRoleSchema, equalityDirectionSchema, flowContributionSchema, selectionRoleSchema, argumentFlowSchema, receiverFlowSchema, contextFlowSchema, closureFlowSchema, applicationResultSchema, memberRoleSchema, indexRoleSchema, operatorRoleSchema, literalRoleSchema, protocolRoleSchema, refinementRoleSchema, dischargeRoleSchema, defaultRoleSchema, constructionPartRoleSchema };
}
