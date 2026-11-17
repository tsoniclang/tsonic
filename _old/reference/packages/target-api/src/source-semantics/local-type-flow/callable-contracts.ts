import type { Node } from "@tsonic/tsts";
import type {
  SourceCallableBody, SourceCallableCapture, SourceCallableContract, SourceCallableEndpoint, SourceCallableExecution,
  SourceCallableImplementation, SourceCallableParameterBinding, SourceCallableParameterEndpoint, SourceCallableResultBoundary,
  SourcePresence, SourceSignatureIdentity, SourceTypeBinding, SourceTypeDescriptorSignature, SourceTypeEvidence,
} from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceDeclarationProduction } from "./production-context.js";
import type { SourceCallCore } from "./application-data.js";
import { createSourceProductionCache } from "./production-cache.js";
import { produceSourceSignatureHead } from "./callable-production.js";
import { produceSourceCallableBindings, type SourceCallableEquation } from "./callable-equations.js";
import { produceSourceCallableEmbedding } from "./callable-embedding.js";
import { produceSourceReceiver } from "./receivers.js";
import { sourceLexicalEnvironment } from "../../source-navigation/lexical-environments.js";
import { Node_Initializer } from "../../source-navigation/ast.js";
import { sourceTypeExpansionBudget } from "../type-expansion-budget.js";
import { failTargetCompilerResourceLimit } from "../../artifacts.js";
import { produceSourceSequenceLayout } from "./tuple-layout.js";
import { createSourceOmissionAllowance } from "./signature-omissions.js";
import { sourceOriginalTypeParameterCaptures } from "./type-parameter-captures.js";
import { sourcePresentLiteralDomain } from "../../source-model/literals/domain.js";

interface SourceCallableSlot {
  readonly endpoint: SourceCallableParameterEndpoint;
  readonly sequence: SourceCallableParameterEndpoint | undefined;
  readonly optional: boolean;
  readonly empty: boolean;
  readonly initializer: SourcePresence<Node>;
}

export function createSourceCallableContracts(context: SourceDeclarationProduction & {
  equivalent(left: SourceTypeEvidence, right: SourceTypeEvidence): boolean;
  enclosing(node: Node | undefined, role: "execution", visit: (node: Node) => boolean): Node | undefined;
}) {
  const { ast, input, builder, reader, navigation } = context;
  const none = Object.freeze({ kind: "none" } as const);
  const pending = (...values: readonly SourceTypeEvidence[]): SourceProductionResult<never> =>
    ({ kind: "pending", dependencies: Object.freeze([...new Set(values.map(value => value.component))]) });
  const contracts = createSourceProductionCache<SourceTypeEvidence, readonly SourceCallableContract[]>({
    authenticate(value, bindings) {
      builder.assertEvidence(value);
      const seen = new Set<Node>();
      for (const binding of bindings) {
        input.assertNode(binding.declaration);
        builder.typeParameter(binding.declaration);
        builder.assertEvidence(binding.value);
        if (seen.has(binding.declaration)) throw new Error("A callable contract retains each original binder once in its ordered environment.");
        seen.add(binding.declaration);
      }
    }, dependency: value => value.component, produce });

  function descriptor(head: SourceTypeEvidence, signature: SourceSignatureIdentity): SourceTypeDescriptorSignature {
    const type = head.type;
    if (type.kind !== "shape" && type.kind !== "callable") throw new Error("A Source callable endpoint retains its actual canonical callable head.");
    const signatures = [...type.calls, ...type.constructs].filter(selected => selected.identity === signature);
    if (signatures.length !== 1) throw new Error("A Source callable endpoint retains exactly its own original signature identity.");
    return signatures[0]!;
  }

  function classOwner(signature: SourceSignatureIdentity): Node | undefined {
    const declaration = signature.declaration;
    const parent = declaration === undefined ? signature.owner : ast.parent(declaration);
    return parent !== undefined && (ast.is.IsClassDeclaration(parent) || ast.is.IsClassExpression(parent) || ast.is.IsInterfaceDeclaration(parent)) ? parent : undefined;
  }

  function constructedClass(signature: SourceSignatureIdentity): Node | undefined {
    const owner = classOwner(signature);
    return signature.kind === "construct" && owner !== undefined && !ast.is.IsInterfaceDeclaration(owner) ? owner : undefined;
  }

  function template(signature: SourceSignatureIdentity, root: Node): SourceProductionResult<SourceTypeEvidence> {
    const original = builder.originalSignature(signature);
    return produceSourceSignatureHead(context, original, [], constructedClass(signature), root);
  }

  function endpoint(head: SourceTypeEvidence, original: SourceTypeEvidence, signature: SourceSignatureIdentity,
    bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceCallableEndpoint> {
    descriptor(head, signature);
    const supplied = new Map(builder.bindings(head).map(binding => [binding.declaration, binding.value]));
    for (const binding of bindings) if (signature.typeParameters.includes(binding.declaration) || !supplied.has(binding.declaration))
      supplied.set(binding.declaration, binding.value);
    const owner = classOwner(signature);
    const classParameters = owner === undefined ? [] : input.describe(input.syntax(owner)).definitionParameters;
    if (classParameters === undefined) return pending(original);
    const classSet = new Set(classParameters), own = new Set(signature.typeParameters);
    const free = builder.freeParameters(original).map(parameter => parameter.declaration);
    const inventory = signature.declaration !== undefined && navigation.callableRoles(signature.declaration).body
      ? sourceOriginalTypeParameterCaptures(context, signature.declaration, free) : free;
    const captured = inventory.filter(declaration => !classSet.has(declaration) && !own.has(declaration));
    function ordered(declarations: readonly Node[]): SourceProductionResult<readonly SourceTypeBinding[]> {
      const result: SourceTypeBinding[] = [];
      for (const declaration of declarations) {
        const value = supplied.get(declaration);
        if (value !== undefined) { builder.assertEvidence(value); result.push(Object.freeze({ declaration, value })); continue; }
        const parameter = reader.describeSyntax(declaration, []);
        if (parameter.kind !== "resolved") return parameter;
        if (parameter.value.type.kind !== "parameter" || parameter.value.type.declaration !== declaration)
          throw new Error("An open callable environment retains its exact canonical original parameter evidence.");
        result.push(Object.freeze({ declaration, value: parameter.value }));
      }
      return { kind: "resolved", value: Object.freeze(result) };
    }
    const classes = ordered(classParameters);
    if (classes.kind !== "resolved") return classes;
    const signatures = ordered(signature.typeParameters);
    if (signatures.kind !== "resolved") return signatures;
    const captures = ordered(captured);
    if (captures.kind !== "resolved") return captures;
    return { kind: "resolved", value: Object.freeze({ head, signature, classBindings: classes.value,
      signatureBindings: signatures.value, capturedBindings: captures.value }) };
  }

  function result(endpoint: SourceCallableEndpoint): SourceProductionResult<SourceTypeEvidence> {
    return builder.component(endpoint.head, { kind: "result", signature: endpoint.signature });
  }

  function slots(endpoint: SourceCallableEndpoint): SourceProductionResult<readonly SourceCallableSlot[]> {
    const signature = descriptor(endpoint.head, endpoint.signature);
    const result: SourceCallableSlot[] = [];
    for (const [index, parameter] of signature.parameters.entries()) {
      const selected = builder.component(endpoint.head, { kind: "parameter", signature: endpoint.signature, index });
      if (selected.kind !== "resolved") return selected;
      const original: SourceCallableParameterEndpoint = Object.freeze({ signature: endpoint.signature, index, path: Object.freeze([]), value: selected.value });
      if (parameter.kind !== "rest") result.push(Object.freeze({ endpoint: original, sequence: undefined,
        optional: parameter.omission.acceptsOmission, empty: false, initializer: parameter.omission.initializer }));
      else {
        const layout = produceSourceSequenceLayout(builder, selected.value);
        if (layout.kind !== "resolved") return layout;
        if (layout.value.length === 0) result.push(Object.freeze({ endpoint: original, sequence: original, optional: true, empty: true, initializer: none }));
        for (const slot of layout.value) {
          if (slot.kind === "rest") {
            if (slot.element === undefined) return pending(slot.type);
            result.push(Object.freeze({ endpoint: Object.freeze({ signature: endpoint.signature, index,
              path: Object.freeze([...slot.path, { kind: "array-element" as const }]), value: slot.element }),
            sequence: Object.freeze({ signature: endpoint.signature, index, path: slot.path, value: slot.type }), optional: true, empty: false, initializer: none }));
          } else result.push(Object.freeze({ endpoint: Object.freeze({ signature: endpoint.signature, index, path: slot.path, value: slot.type }),
            sequence: undefined, optional: slot.kind === "optional", empty: false, initializer: none }));
        }
      }
    }
    return { kind: "resolved", value: Object.freeze(result) };
  }

  function produce(head: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]): SourceProductionResult<readonly SourceCallableContract[]> {
    let work = 0;
    const charge = (count = 1): void => {
      if (count > sourceTypeExpansionBudget.types - work) failTargetCompilerResourceLimit("tsonic", "Source type expansion", "types", sourceTypeExpansionBudget.types, head.component.root);
      work += count;
    };
    if (head.sum !== undefined) {
      const values: SourceCallableContract[] = [];
      for (const arm of head.sum.arms) {
        charge();
        const selected = contracts.query(arm, bindings);
        if (selected.kind !== "resolved") return selected;
        charge(selected.value.length);
        values.push(...selected.value);
      }
      return { kind: "resolved", value: Object.freeze(values) };
    }
    const definition = builder.produceDefinition(head);
    if (definition.kind !== "resolved") return definition;
    if (definition.value !== head) return contracts.query(definition.value, bindings);
    if (head.type.kind !== "shape" && head.type.kind !== "callable") return { kind: "resolved", value: Object.freeze([]) };
    const values: SourceCallableContract[] = [];
    for (const signature of [...head.type.calls, ...head.type.constructs]) {
      const identities = signature.identity.composition.kind === "present" ? signature.identity.composition.value.signatures : [signature.identity];
      for (const identity of identities) {
        charge();
        const original = template(identity, head.component.root);
        if (original.kind !== "resolved") return original;
        const applied = produceSourceSignatureHead(context, builder.originalSignature(identity), bindings, constructedClass(identity), head.component.root);
        if (applied.kind !== "resolved") return applied;
        const advertised = endpoint(applied.value, original.value, identity, bindings);
        if (advertised.kind !== "resolved") return advertised;
        const implementation = implement(advertised.value, charge);
        if (implementation.kind !== "resolved") return implementation;
        values.push(Object.freeze({ advertised: advertised.value, implementation: implementation.value }));
      }
    }
    return { kind: "resolved", value: Object.freeze(values) };
  }

  function implement(advertised: SourceCallableEndpoint, charge: (count?: number) => void): SourceProductionResult<SourcePresence<SourceCallableImplementation>> {
    const declaration = advertised.signature.declaration;
    if (declaration === undefined) {
      const owner = classOwner(advertised.signature);
      if (owner === undefined || advertised.signature.kind !== "construct") return pending(advertised.head);
      const constructors = navigation.classConstructors(owner);
      if (constructors.kind !== "resolved") return constructors;
      if (constructors.value.kind !== "resolved" || constructors.value.witness !== "implicit" ||
        !constructors.value.signatures.some(signature => signature.identity === advertised.signature)) return pending(advertised.head);
      return { kind: "resolved", value: none };
    }
    input.assertNode(declaration);
    const file = ast.getSourceFile(declaration);
    if (file?.IsDeclarationFile || ast.hasModifierKind(declaration, "declare") || ast.hasModifierKind(declaration, "abstract") ||
      ast.is.IsMethodSignatureDeclaration(declaration) || ast.is.IsCallSignatureDeclaration(declaration) ||
      ast.is.IsConstructSignatureDeclaration(declaration) || ast.is.IsFunctionTypeNode(declaration) || ast.is.IsConstructorTypeNode(declaration))
      return { kind: "resolved", value: none };
    const association = navigation.callableImplementation(declaration);
    if (association.kind !== "resolved") return pending(advertised.head);
    if (association.contractDeclaration !== declaration || !association.implementation.project) throw new Error("A project callable body retains its authentic original declaration association.");
    const bodyDeclaration = association.implementation.declaration;
    input.assertNode(bodyDeclaration);
    const bodyNode = ast.body(bodyDeclaration);
    if (bodyNode === undefined || !navigation.callableRoles(bodyDeclaration).body) return pending(advertised.head);
    const originalBody = context.callableHead(bodyDeclaration, "body", []);
    if (originalBody.kind !== "resolved") return originalBody;
    const witness = input.signatureForDeclaration(bodyDeclaration);
    if (witness.kind !== "present") return pending(originalBody.value);
    const bodyIdentity = builder.signature(witness.value.owner, witness.value.signatureKind, witness.value,
      witness.value.declaration, witness.value.typeParameters);
    const originalEndpoint = endpoint(originalBody.value, originalBody.value, bodyIdentity, []);
    if (originalEndpoint.kind !== "resolved") return originalEndpoint;
    const advertisedSlots = slots(advertised);
    if (advertisedSlots.kind !== "resolved") return advertisedSlots;
    const equations: SourceCallableEquation[] = [];
    const inputs = advertisedSlots.value.filter(slot => !slot.empty);
    const bodyDescriptor = descriptor(originalBody.value, bodyIdentity);
    let sourceIndex = 0;
    for (const [index, parameter] of bodyDescriptor.parameters.entries()) {
      charge();
      const destination = builder.component(originalBody.value, { kind: "parameter", signature: bodyIdentity, index });
      if (destination.kind !== "resolved") return destination;
      if (parameter.kind === "rest") {
        if (index !== bodyDescriptor.parameters.length - 1) throw new Error("An original callable rest formal must terminate its authored formal vector.");
        const tail = inputs.slice(sourceIndex);
        charge(tail.length);
        const values = tail.map(slot => (slot.sequence ?? slot.endpoint).value);
        const sequence = builder.evidence({ type: builder.tuple(tail.map((slot, offset) => ({
          kind: slot.sequence !== undefined ? "rest" as const : slot.optional ? "optional" as const : "required" as const, type: values[offset]!.type,
        })), false), component: destination.value.component, category: { kind: "known", category: "object" },
        numeric: undefined, sum: undefined }, values.map((value, index) => ({ selector: { kind: "tuple-element", index }, value })),
        undefined, sourcePresentLiteralDomain, { members: { kind: "complete", members: [], indexes: [] }, origins: { kind: "unavailable" } });
        equations.push({ template: destination.value, actual: sequence, direction: "input" });
        sourceIndex = inputs.length;
      } else {
        const source = inputs[sourceIndex];
        if (source === undefined) continue;
        if (source.sequence !== undefined) return pending(advertised.head, originalBody.value);
        equations.push({ template: destination.value, actual: source.endpoint.value, direction: "input" });
        sourceIndex++;
      }
    }
    const bodyResult = result(originalEndpoint.value), advertisedResult = result(advertised);
    if (bodyResult.kind !== "resolved") return bodyResult;
    if (advertisedResult.kind !== "resolved") return advertisedResult;
    equations.push({ template: bodyResult.value, actual: advertisedResult.value, direction: "result" });
    const advertisedDescriptor = descriptor(advertised.head, advertised.signature);
    if (bodyDescriptor.receiver !== undefined && advertisedDescriptor.receiver !== undefined) {
      const source = builder.component(advertised.head, { kind: "receiver", signature: advertised.signature });
      if (source.kind !== "resolved") return source;
      const destination = builder.component(originalBody.value, { kind: "receiver", signature: bodyIdentity });
      if (destination.kind !== "resolved") return destination;
      equations.push({ template: destination.value, actual: source.value, direction: "input" });
    }
    const bodyParameters = [...originalEndpoint.value.classBindings, ...originalEndpoint.value.signatureBindings,
      ...originalEndpoint.value.capturedBindings].map(binding => binding.declaration);
    const incoming = [...advertised.classBindings, ...advertised.signatureBindings, ...advertised.capturedBindings]
      .filter(binding => bodyParameters.includes(binding.declaration));
    const environment = produceSourceCallableBindings(context, bodyDeclaration, bodyParameters, incoming, equations);
    if (environment.kind !== "resolved") return environment;
    const appliedHead = context.callableHead(bodyDeclaration, "body", environment.value);
    if (appliedHead.kind !== "resolved") return appliedHead;
    const applied = endpoint(appliedHead.value, originalBody.value, bodyIdentity, environment.value);
    if (applied.kind !== "resolved") return applied;
    const body = bodyData(bodyDeclaration, bodyNode, originalEndpoint.value, charge);
    if (body.kind !== "resolved") return body;
    const parameters = parameterBindings(advertised, applied.value);
    if (parameters.kind !== "resolved") return parameters;
    const receiver = receiverBinding(advertised, applied.value);
    if (receiver.kind !== "resolved") return receiver;
    const actualResult = result(applied.value);
    if (actualResult.kind !== "resolved") return actualResult;
    let boundary: SourceCallableResultBoundary;
    if (declaration !== bodyDeclaration && ast.body(declaration) === undefined) boundary = Object.freeze({ kind: "declared-overload",
      contractDeclaration: declaration, bodyDeclaration, source: actualResult.value, destination: advertisedResult.value });
    else {
      const embedding = produceSourceCallableEmbedding(context, actualResult.value, advertisedResult.value);
      if (embedding.kind !== "resolved") return embedding;
      boundary = Object.freeze({ kind: "embedding", embedding: embedding.value });
    }
    return { kind: "resolved", value: Object.freeze({ kind: "present", value: Object.freeze({ body: body.value, applied: applied.value,
      parameters: parameters.value, receiver: receiver.value, result: boundary }) }) };
  }

  function bodyData(declaration: Node, body: Node, template: SourceCallableEndpoint,
    charge: (count?: number) => void): SourceProductionResult<SourceCallableBody> {
    const lexical = sourceLexicalEnvironment(declaration, [declaration], ast, navigation, { has: navigation.includes }, undefined, () => charge());
    if (lexical.kind !== "resolved") return pending(template.head);
    const captures: SourceCallableCapture[] = [];
    const bindings = [...template.classBindings, ...template.signatureBindings, ...template.capturedBindings];
    for (const capture of lexical.captures) {
      charge(1 + capture.references.length);
      const slot = context.context.declared(capture.declaration, bindings);
      if (slot.kind !== "resolved") return slot;
      captures.push(Object.freeze({ kind: "binding", declaration: capture.declaration, references: capture.references, slot: slot.value }));
    }
    for (const capture of lexical.receivers) {
      charge(1 + capture.references.length);
      const receiver = produceSourceReceiver(context, capture.owner, bindings);
      if (receiver.kind !== "resolved") return receiver;
      if (receiver.value.kind !== "present") return pending(template.head);
      captures.push(Object.freeze({ kind: "receiver", owner: capture.owner, references: capture.references,
        origin: receiver.value.value.origin, value: receiver.value.value.value }));
    }
    const signature = descriptor(template.head, template.signature);
    const parameters: SourceCallableBody["parameters"][number][] = [];
    for (const [index, parameter] of signature.parameters.entries()) {
      if (parameter.declaration === undefined) return pending(template.head);
      const value = builder.component(template.head, { kind: "parameter", signature: template.signature, index });
      if (value.kind !== "resolved") return value;
      const slot = context.context.declared(parameter.declaration, bindings);
      if (slot.kind !== "resolved") return slot;
      const initializer = Node_Initializer(ast, parameter.declaration);
      parameters.push(Object.freeze({ input: Object.freeze({ signature: template.signature, index, path: Object.freeze([]), value: value.value }),
        slot: slot.value, initializer: initializer === undefined ? none : Object.freeze({ kind: "present", value: initializer }) }));
    }
    const activation = context.enclosing(declaration, "execution", () => { charge(); return true; });
    if (activation === undefined) return pending(template.head);
    return { kind: "resolved", value: Object.freeze({ declaration, body, template, activation,
      captures: Object.freeze(captures), parameters: Object.freeze(parameters) }) };
  }

  function parameterBindings(source: SourceCallableEndpoint, destination: SourceCallableEndpoint): SourceProductionResult<readonly SourceCallableParameterBinding[]> {
    const sourceSlots = slots(source), outputs = slots(destination);
    if (sourceSlots.kind !== "resolved") return sourceSlots;
    if (outputs.kind !== "resolved") return outputs;
    const inputs = sourceSlots.value.filter(slot => !slot.empty);
    const values: SourceCallableParameterBinding[] = [];
    const allowsOmission = createSourceOmissionAllowance(builder, destination.head.component.root);
    let inputIndex = 0;
    for (const [index, output] of outputs.value.entries()) {
      if (output.empty) {
        values.push(Object.freeze({ kind: "omitted", destination: output.endpoint, action: Object.freeze({ kind: "empty-rest" }) }));
        continue;
      }
      const boundary = output.sequence === undefined ? inputIndex + 1 : Math.max(inputIndex, inputs.length - (outputs.value.length - index - 1));
      if (inputs[inputIndex] === undefined || inputIndex === boundary) {
        const allowed = output.optional ? { kind: "resolved" as const, value: true } : allowsOmission(output.endpoint.value, false);
        if (allowed.kind !== "resolved") return allowed;
        if (!allowed.value) return pending(source.head, destination.head);
        const action = output.sequence !== undefined ? Object.freeze({ kind: "empty-rest" as const })
          : output.initializer.kind === "present" ? Object.freeze({ kind: "initializer" as const, initializer: output.initializer.value })
            : Object.freeze({ kind: "absence" as const, value: builder.evidence({ type: builder.intrinsic("absence"),
              component: output.endpoint.value.component, category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined },
            [], undefined, { kind: "finite", values: [{ kind: "absence" }] },
            { members: { kind: "unavailable" }, origins: builder.sourceOriginSubjects(output.endpoint.value) }) });
        values.push(Object.freeze({ kind: "omitted", destination: output.sequence ?? output.endpoint, action }));
        continue;
      }
      while (inputIndex < boundary && inputIndex < inputs.length) {
        const input = inputs[inputIndex]!;
        if (input.sequence !== undefined && output.sequence === undefined) return pending(source.head, destination.head);
        const from = input.sequence ?? input.endpoint;
        const to = input.sequence === undefined ? output.endpoint : output.sequence!;
        const embedding = produceSourceCallableEmbedding(context, from.value, to.value);
        if (embedding.kind !== "resolved") return embedding;
        values.push(Object.freeze({ kind: "parameter", source: from, destination: to, embedding: embedding.value }));
        inputIndex++;
      }
    }
    return { kind: "resolved", value: Object.freeze(values) };
  }

  function receiverBinding(source: SourceCallableEndpoint, destination: SourceCallableEndpoint): SourceProductionResult<SourceCallableImplementation["receiver"]> {
    const receiver = descriptor(destination.head, destination.signature).receiver;
    if (receiver === undefined) return { kind: "resolved", value: none };
    if (descriptor(source.head, source.signature).receiver === undefined) return pending(source.head, destination.head);
    const from = builder.component(source.head, { kind: "receiver", signature: source.signature });
    if (from.kind !== "resolved") return from;
    const to = builder.component(destination.head, { kind: "receiver", signature: destination.signature });
    if (to.kind !== "resolved") return to;
    const embedding = produceSourceCallableEmbedding(context, from.value, to.value);
    return embedding.kind !== "resolved" ? embedding : { kind: "resolved", value: Object.freeze({ kind: "present",
      value: Object.freeze({ origin: receiver.origin, source: from.value, destination: to.value, embedding: embedding.value }) }) };
  }

  function execution(application: SourceCallCore): SourceProductionResult<SourcePresence<SourceCallableExecution>> {
    if (application.argumentDisposition === "skip") return { kind: "resolved", value: none };
    const bindings = [...application.identity.classBindings, ...application.identity.signatureBindings];
    const selected = contracts.query(application.callee.value, bindings);
    if (selected.kind !== "resolved") return selected;
    const identities = application.identity.signature.composition.kind === "present"
      ? application.identity.signature.composition.value.signatures : [application.identity.signature];
    const results: SourceCallableExecution["results"][number][] = [];
    for (const identity of identities) {
      const matches = selected.value.filter(contract => contract.advertised.signature === identity);
      if (matches.length !== 1) return pending(application.callee.value);
      const source = result(matches[0]!.advertised);
      if (source.kind !== "resolved") return source;
      const applied = builder.substitute(source.value, bindings);
      if (applied.kind !== "resolved") return applied;
      const embedding = produceSourceCallableEmbedding(context, applied.value, application.result);
      if (embedding.kind !== "resolved") return embedding;
      results.push(Object.freeze({ signature: identity, embedding: embedding.value }));
    }
    return { kind: "resolved", value: Object.freeze({ kind: "present", value: Object.freeze({ contracts: selected.value, results: Object.freeze(results) }) }) };
  }
  return Object.freeze({ contracts: contracts.query, execution });
}
