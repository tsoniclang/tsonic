/**
 * Anonymous Type Declaration Synthesis
 *
 * Named type generation, structural carrier reuse, template argument
 * inference, and object-to-class member conversion for anonymous type lowering.
 *
 * FACADE: re-exports from anon-type-naming and anon-type-template-inference.
 */

export {
  interfaceMembersToClassMembers,
  classMembersToInterfaceMembers,
  getOrCreateTypeName,
  isReusableStructuralCarrierName,
  getOrCreateBehavioralObjectTypeName,
} from "./anon-type-naming.js";

export {
  inferTemplateTypeArguments,
  tryInstantiateReusableStructuralCarrier,
  getOrCreateObjectTypeReference,
} from "./anon-type-template-inference.js";
