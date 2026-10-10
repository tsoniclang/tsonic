import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageSuperConstructor } from "./construction.js";

export interface SourceStorageInvocationInputs {
  readonly subjects: ReadonlySet<SourceStorageSubject>;
  readonly context: "caller" | "callee";
}

export type SourceStorageInvocationInputQuery = (
  formal: SourceStorageSubject,
  candidate: Node,
  invocation: Node,
) => SourceStorageInvocationInputs;

export function createSourceStorageInvocationInputs(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
  isAccessor: (invocation: Node) => boolean,
  isUnresolved: (invocation: Node) => boolean,
): SourceStorageInvocationInputQuery {
  const { ast, semantics } = source;
  return (formal, candidate, invocation) => {
    const subjects = new Set<SourceStorageSubject>();
    let context: SourceStorageInvocationInputs["context"] = "caller";
    if (isUnresolved(invocation)) return { subjects, context };
    const selected = semantics.forNode(invocation).operations.call(invocation);
    const add = (origin: SourceStorageSubject | undefined): void => {
      if (origin === undefined) return;
      const projected = subject(origin.node, origin.kind, [...origin.projection, ...formal.projection]);
      if (projected !== undefined) subjects.add(projected);
    };
    if (formal.kind === "receiver") {
      if (formal.node !== candidate) subjects.add(formal);
      else {
        const base = sourceStorageSuperConstructor(invocation, source, budget.step);
        add(ast.is.IsNewExpression(invocation) ? subject(invocation)
          : base !== undefined ? subject(base.owner, "receiver")
          : subjectFor(selected?.sourceReceiver?.expression ?? selected?.sourceCalleeAccess?.receiver.expression
            ?? semantics.forNode(invocation).operations.propertyAccess(invocation)?.receiver.expression));
      }
    } else {
      const index = ast.parameters(candidate).indexOf(formal.node);
      if (index === -1) subjects.add(formal);
      else {
        let bound = false;
        for (const binding of selected?.sourceArgumentBindings ?? []) {
          if (!budget.step()) break;
          if (binding.sourceParameterIndex !== index) continue;
          bound = true;
          add(subjectFor(selected?.sourceArguments[binding.sourceArgumentIndex]?.expression));
        }
        if (!bound) {
          const access = isAccessor(invocation) ? ast.parent(invocation) : undefined;
          const assignment = access === undefined || !ast.is.IsBinaryExpression(access) ? undefined : ast.as.AsBinaryExpression(access);
          const actual = assignment?.Left === invocation && ast.operatorKindName(access) === "KindEqualsToken" ? assignment.Right : undefined;
          const initializer = Node_Initializer(ast, formal.node);
          const argument = subjectFor(actual ?? initializer);
          if (actual === undefined && initializer !== undefined) context = "callee";
          if (argument === undefined) subjects.add(formal);
          else add(argument);
        }
      }
    }
    return { subjects, context };
  };
}
