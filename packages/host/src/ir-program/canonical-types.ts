import type { SigId, TyId } from "../ids/contract.js";
import type {
  CapturedFact,
  HirCallableEndpoint,
  HirCapturedType,
  HirCoreCapture,
  HirFieldBindingCapture,
  HirRecordBindingCapture,
  HirFieldMarkerCapture,
  HirMarkersCapture,
  HirPointerTypeCapture,
} from "../ir-hir/contract.js";
import type {
  ArtifactBindings,
  BindingVector,
  BodyInstance,
  Execution,
  DeclaredExecution,
  ComponentSelector,
  ConstValue,
  PointerEvidence,
  SelfBinding,
  TypeBinding,
  TypeComponent,
  TypeEvidence,
  TypeParameter,
  TypePublication,
} from "../ir-types/contract.js";

import type { BindingLookup } from "./program-values.js";

export interface TypeReferenceRewrite {
  readonly type: (value: TyId) => TyId;
  readonly signature: (value: SigId) => SigId;
}

export interface TypeRewrite extends TypeReferenceRewrite, BindingLookup {}

interface ComponentPath {
  readonly parent: ComponentPath | null;
  readonly segment: string;
}

type ComponentWork =
  | {
      readonly kind: "enter";
      readonly source: TypeComponent;
      readonly target: ComponentSelector[];
      readonly path: ComponentPath;
    }
  | {
      readonly kind: "selector";
      readonly source: ComponentSelector;
      readonly target: ComponentSelector[];
      readonly position: number;
      readonly path: ComponentPath;
    }
  | { readonly kind: "leave"; readonly source: TypeComponent };

export function publicationRewrite(publication: TypePublication): TypeRewrite {
  return {
    type: value => issuedMapping(publication.types, value, "type"),
    signature: value => issuedMapping(publication.signatures, value, "signature"),
    parameterBinding: value => value,
    selfBinding: value => value,
  };
}

function issuedMapping<Identity extends number>(values: readonly Identity[], value: number, kind: string): Identity {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`Type publication has no issued ${kind} mapping for ${Object.is(value, -0) ? "-0" : String(value)}`);
  }
  const mapped = values[value];
  if (mapped === undefined) {
    throw new TypeError(`Type publication has no issued ${kind} mapping for ${String(value)}`);
  }
  return mapped;
}

export function rewriteTypeBinding(rewrite: TypeRewrite, binding: TypeBinding): TypeBinding {
  const value = binding.kind === "rigid" ? rewrite.parameterBinding(binding) : binding;
  switch (value.kind) {
    case "rigid": return value;
    case "bound": return { kind: "bound", parameter: value.parameter, type: rewrite.type(value.type) };
  }
}

export function rewriteSelfBinding(rewrite: TypeRewrite, binding: SelfBinding): SelfBinding {
  const value = binding.kind === "rigid" ? rewrite.selfBinding(binding) : binding;
  switch (value.kind) {
    case "rigid": return value;
    case "bound": return { kind: "bound", owner: value.owner, type: rewrite.type(value.type) };
  }
}

export function rewriteBindings(rewrite: TypeRewrite, bindings: BindingVector): BindingVector {
  return {
    classBindings: bindings.classBindings.map(binding => rewriteTypeBinding(rewrite, binding)),
    methodBindings: bindings.methodBindings.map(binding => rewriteTypeBinding(rewrite, binding)),
    capturedBindings: bindings.capturedBindings.map(binding => rewriteTypeBinding(rewrite, binding)),
    selfBindings: bindings.selfBindings.map(binding => rewriteSelfBinding(rewrite, binding)),
  };
}

export function rewriteArtifactBindings(rewrite: TypeRewrite, bindings: ArtifactBindings): ArtifactBindings {
  switch (bindings.kind) {
    case "parametric": return bindings;
    case "instantiated": return { kind: "instantiated", bindings: rewriteBindings(rewrite, bindings.bindings) };
  }
}

export function rewriteInstance(rewrite: TypeRewrite, instance: BodyInstance): BodyInstance {
  return { body: instance.body, bindings: rewriteArtifactBindings(rewrite, instance.bindings) };
}

export function rewriteConstant(rewrite: TypeReferenceRewrite, value: ConstValue): ConstValue {
  const type = rewrite.type(value.type);
  switch (value.kind) {
    case "number": return { type, kind: "number", value: value.value };
    case "floating": return { type, kind: "floating", bits: value.bits };
    case "bigint": return { type, kind: "bigint", value: value.value };
    case "string": return { type, kind: "string", value: value.value };
    case "boolean": return { type, kind: "boolean", value: value.value };
    case "absence": return { type, kind: "absence" };
    case "unique-symbol": return { type, kind: "unique-symbol", declaration: value.declaration };
    case "error": return { type, kind: "error" };
  }
}

export function rewriteExecution(rewrite: TypeRewrite, execution: Execution): Execution {
  return { instance: rewriteInstance(rewrite, execution.instance), provided: execution.provided };
}

export function rewriteDeclaredExecution(rewrite: TypeRewrite, execution: DeclaredExecution): DeclaredExecution {
  const request = execution.request;
  return { request: { definition: request.definition, endpoint: request.endpoint, ordinal: request.ordinal,
    bindings: rewriteArtifactBindings(rewrite, request.bindings) }, provided: execution.provided };
}

export function rewriteParameter(rewrite: TypeReferenceRewrite, parameter: TypeParameter): TypeParameter {
  return {
    identity: parameter.identity,
    declaration: parameter.declaration,
    constraint: parameter.constraint === null ? null : rewrite.type(parameter.constraint),
    default: parameter.default === null ? null : rewrite.type(parameter.default),
  };
}

export function rewriteEndpoint(rewrite: TypeReferenceRewrite, endpoint: HirCallableEndpoint): HirCallableEndpoint {
  return { ...endpoint, signature: rewrite.signature(endpoint.signature) };
}

export function rewriteComponent(rewrite: TypeReferenceRewrite, component: TypeComponent, at: string): TypeComponent {
  const result: ComponentSelector[] = new Array(component.path.length);
  const active = new Set<TypeComponent>();
  const work: ComponentWork[] = [{
    kind: "enter",
    source: component,
    target: result,
    path: { parent: null, segment: at },
  }];
  let task = work.pop();
  while (task !== undefined) {
    switch (task.kind) {
      case "leave":
        active.delete(task.source);
        break;
      case "enter": {
        if (active.has(task.source)) {
          const segments: string[] = [];
          let path: ComponentPath | null = task.path;
          while (path !== null) {
            segments.push(path.segment);
            path = path.parent;
          }
          throw new TypeError(`Inline cycle at ${segments.reverse().join("")}`);
        }
        active.add(task.source);
        work.push({ kind: "leave", source: task.source });
        const source = task.source;
        const target = task.target;
        const parent = task.path;
        for (let position = source.path.length - 1; position >= 0; position -= 1) {
          const selector = source.path[position];
          if (selector !== undefined) {
            work.push({
              kind: "selector",
              source: selector,
              target,
              position,
              path: { parent, segment: `.path[${position}]` },
            });
          }
        }
        break;
      }
      case "selector": {
        task.target[task.position] = rewriteSelector(rewrite, task.source, task.path, work);
        break;
      }
    }
    task = work.pop();
  }
  return { root: component.root, path: result };
}

function rewriteSelector(
  rewrite: TypeReferenceRewrite,
  selector: ComponentSelector,
  at: ComponentPath,
  work: ComponentWork[],
): ComponentSelector {
  switch (selector.kind) {
    case "parameter":
      return { kind: "parameter", signature: rewrite.signature(selector.signature), index: selector.index };
    case "receiver":
      return { kind: "receiver", signature: rewrite.signature(selector.signature) };
    case "signature-tail":
      return {
        kind: "signature-tail", signature: rewrite.signature(selector.signature),
        start: selector.start, readonly: selector.readonly,
      };
    case "result":
      return { kind: "result", signature: rewrite.signature(selector.signature) };
    case "sum-arm": {
      const path: ComponentSelector[] = new Array(selector.family.component.path.length);
      work.push({
        kind: "enter",
        source: selector.family.component,
        target: path,
        path: { parent: at, segment: ".family.component" },
      });
      return {
        kind: "sum-arm",
        family: {
          origin: selector.family.origin,
          component: { root: selector.family.component.root, path },
          parameters: selector.family.parameters,
          roles: selector.family.roles.map(role => ({ ...role, member: rewrite.type(role.member) })),
        },
        index: selector.index,
      };
    }
    case "class-value":
    case "construction-argument":
    case "optional-value":
    case "array-element":
    case "tuple-element":
    case "union-member":
    case "argument-place":
    case "parameter-place":
    case "intersection-member":
    case "intersection-result":
    case "argument-tail":
    case "parameter-tail":
    case "member":
    case "index-key":
    case "index-value":
    case "projection-source":
    case "tuple-slice":
    case "type-argument":
    case "awaited":
      return selector;
  }
}

export function rewritePointer(rewrite: TypeRewrite, pointer: PointerEvidence): PointerEvidence {
  switch (pointer.kind) {
    case "raw-address":
    case "native-pointer":
      return pointer;
    case "typed-location":
      return { kind: "typed-location", pointee: rewrite.type(pointer.pointee), mutability: pointer.mutability };
    case "function-pointer":
      return {
        kind: "function-pointer",
        declaration: pointer.declaration,
        parameters: pointer.parameters.map(parameter => rewrite.type(parameter)),
        result: rewrite.type(pointer.result),
        abi: pointer.abi,
      };
  }
}

export function rewriteEvidence(rewrite: TypeRewrite, evidence: TypeEvidence): TypeEvidence {
  return {
    type: rewrite.type(evidence.type),
    component: evidence.component,
    category: evidence.category,
    numeric: evidence.numeric,
    sum: evidence.sum === null ? null : {
      kind: evidence.sum.kind,
      component: evidence.sum.component,
      bindings: rewriteBindings(rewrite, evidence.sum.bindings),
      arms: evidence.sum.arms.map(arm => ({ ...arm, member: rewrite.type(arm.member) })),
    },
    nominal: evidence.nominal,
    pointer: evidence.pointer === null ? null : rewritePointer(rewrite, evidence.pointer),
  };
}

function rewriteCaptured<Value>(capture: CapturedFact<Value>, transform: (value: Value) => Value): CapturedFact<Value> {
  switch (capture.kind) {
    case "unavailable": return capture;
    case "available": return { kind: "available", value: transform(capture.value) };
  }
}

function rewriteFieldMarker(rewrite: TypeRewrite, marker: HirFieldMarkerCapture): HirFieldMarkerCapture {
  return {
    name: marker.name,
    typeNode: marker.typeNode,
    type: rewriteCaptured(marker.type, rewrite.type),
    readonly: marker.readonly,
  };
}

function rewriteMarkers(rewrite: TypeRewrite, markers: HirMarkersCapture): HirMarkersCapture {
  return {
    struct: markers.struct === null ? null : {
      valueType: markers.struct.valueType,
      fields: rewriteCaptured(markers.struct.fields, fields => fields.map(field => rewriteFieldMarker(rewrite, field))),
    },
    field: markers.field === null ? null : rewriteFieldMarker(rewrite, markers.field),
    defaultValue: markers.defaultValue === null ? null : {
      typeNode: markers.defaultValue.typeNode,
      type: rewriteCaptured(markers.defaultValue.type, rewrite.type),
    },
    jsString: markers.jsString,
  };
}

function rewriteCapturedType(rewrite: TypeRewrite, captured: HirCapturedType, at: string): HirCapturedType {
  return {
    type: rewriteCaptured(captured.type, rewrite.type),
    component: rewriteComponent(rewrite, captured.component, `${at}.component`),
  };
}

function rewritePointerCapture(rewrite: TypeRewrite, pointer: HirPointerTypeCapture, at: string): HirPointerTypeCapture {
  switch (pointer.kind) {
    case "raw-address":
    case "native-pointer":
      return pointer;
    case "typed-location":
      return {
        kind: "typed-location",
        pointee: rewriteCapturedType(rewrite, pointer.pointee, `${at}.pointee`),
        mutability: pointer.mutability,
      };
    case "function-pointer":
      return {
        kind: "function-pointer",
        declaration: pointer.declaration,
        parameters: pointer.parameters.map((parameter, position) => rewriteCapturedType(rewrite, parameter, `${at}.parameters[${position}]`)),
        result: rewriteCapturedType(rewrite, pointer.result, `${at}.result`),
        abi: pointer.abi,
      };
  }
}

function rewriteFieldBinding(rewrite: TypeRewrite, binding: HirFieldBindingCapture): HirFieldBindingCapture {
  return {
    occurrence: binding.occurrence,
    bindings: rewriteCaptured(binding.bindings, bindings => rewriteBindings(rewrite, bindings)),
    owner: rewriteCaptured(binding.owner, rewrite.type),
    pointee: rewriteCaptured(binding.pointee, rewrite.type),
    fieldExpression: binding.fieldExpression,
    field: binding.field,
    pointerExpression: binding.pointerExpression,
  };
}

function rewriteRecordBinding(rewrite: TypeRewrite, binding: HirRecordBindingCapture): HirRecordBindingCapture {
  return {
    occurrence: binding.occurrence,
    bindings: rewriteCaptured(binding.bindings, bindings => rewriteBindings(rewrite, bindings)),
    source: rewriteCaptured(binding.source, rewrite.type),
    layoutExpression: binding.layoutExpression,
    layout: binding.layout,
    fields: binding.fields,
  };
}

export function rewriteCoreCapture(rewrite: TypeRewrite, core: HirCoreCapture, at: string): HirCoreCapture {
  return {
    provider: core.provider,
    markers: rewriteCaptured(core.markers, markers => rewriteMarkers(rewrite, markers)),
    pointerType: rewriteCaptured(core.pointerType, pointer => pointer === null ? null : rewritePointerCapture(rewrite, pointer, `${at}.pointerType.value`)),
    pointerOperation: core.pointerOperation,
    fieldBinding: rewriteCaptured(core.fieldBinding, binding => binding === null ? null : rewriteFieldBinding(rewrite, binding)),
    recordBinding: rewriteCaptured(core.recordBinding, binding => binding === null ? null : rewriteRecordBinding(rewrite, binding)),
    attribute: core.attribute,
    safety: core.safety,
    argumentPassing: core.argumentPassing,
    flowState: core.flowState,
  };
}
