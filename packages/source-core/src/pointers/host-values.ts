// Absence of a Host value (I1/I3): read from the published Host descriptor, never from a checker Type.
import type { Node } from "@tsonic/tsts";
import type { HostSourceProgram } from "@tsonic/target-api/host";
import { sourceTypeDescriptorStructure, type SourceTypeDescriptor } from "@tsonic/target-api/source";

function arms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] {
  const structure = sourceTypeDescriptorStructure(type);
  if (structure.kind === "union") return structure.types.flatMap(arms);
  if (structure.kind === "optional") return [...arms(structure.value), { kind: "intrinsic", intrinsic: "absence" }];
  return [structure];
}

const absentArm = (type: SourceTypeDescriptor): boolean =>
  type.kind === "intrinsic" && (type.intrinsic === "absence" || type.intrinsic === "void");

/** Every arm is null / undefined / void (checker isNullish || isVoidLike). */
export function tsonicDescriptorIsAbsent(type: SourceTypeDescriptor): boolean {
  const selected = arms(type).filter(arm => !(arm.kind === "intrinsic" && arm.intrinsic === "never"));
  return selected.length !== 0 && selected.every(absentArm);
}

/** Some arm is null / undefined / void. */
export function tsonicDescriptorAdmitsAbsence(type: SourceTypeDescriptor): boolean {
  return arms(type).some(absentArm);
}

/** The Host descriptor of a value node; undefined when the Host refused it (the refusal is in facts.refusals()). */
export function tsonicValueType(source: Pick<HostSourceProgram, "facts">, node: Node): SourceTypeDescriptor | undefined {
  const outcome = source.facts.values.type(node);
  return outcome.kind === "refused" ? undefined : outcome.type;
}

/** The arms of a descriptor (union members flattened; an optional is its value plus absence). */
export function tsonicDescriptorArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] {
  return arms(type);
}

/** The descriptor mentions a type parameter (checker couldContainTypeVariables, conservative for signature binders). */
export function tsonicDescriptorHasTypeVariables(
  ast: Pick<HostSourceProgram["ast"], "is">, type: SourceTypeDescriptor, seen = new Set<SourceTypeDescriptor>(),
): boolean {
  if (seen.has(type)) return false;
  seen.add(type);
  const visit = (child: SourceTypeDescriptor): boolean => tsonicDescriptorHasTypeVariables(ast, child, seen);
  switch (type.kind) {
    case "declared":
      return ast.is.IsTypeParameterDeclaration(type.declaration) || type.typeArguments.some(visit) ||
        (type.definition !== undefined && visit(type.definition));
    case "union": return type.types.some(visit);
    case "optional": return visit(type.value);
    case "array": return visit(type.element);
    case "tuple": return type.elements.some(element => visit(element.type));
    case "shape":
      return type.members.some(member => visit(member.type)) || type.indexes.some(index => visit(index.key) || visit(index.value)) ||
        [...type.calls, ...type.constructs].some(signature => signature.parameters.some(parameter => visit(parameter.type)) ||
          visit(signature.result));
    case "callable":
      return [...type.calls, ...type.constructs].some(signature => signature.parameters.some(parameter => visit(parameter.type)) ||
        visit(signature.result));
    default: return false;
  }
}

/** The pointee of a Host `Pointer<T>` value: the first type argument of its declared descriptor. */
export function tsonicPointerValuePointee(source: Pick<HostSourceProgram, "facts">, node: Node): SourceTypeDescriptor | undefined {
  const type = tsonicValueType(source, node);
  return type?.kind === "declared" && type.typeArguments.length >= 1 ? type.typeArguments[0] : undefined;
}
