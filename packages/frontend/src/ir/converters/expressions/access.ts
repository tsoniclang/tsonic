/**
 * Member access expression converters
 *
 * ALICE'S SPEC: All member type queries go through TypeSystem.typeOfMember().
 * Falls back to Binding-resolved MemberId only when the receiver type cannot
 * be normalized nominally (e.g., tsbindgen `$instance & __views` intersections).
 */

export { convertMemberExpression } from "./access/access-converter.js";
