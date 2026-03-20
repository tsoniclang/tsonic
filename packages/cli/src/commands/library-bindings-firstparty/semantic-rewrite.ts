export {
  buildSemanticSignature,
  buildSemanticSignatureFromFunctionType,
  rewriteBindingSemanticParameter,
  rewriteBindingSemanticType,
} from "./semantic-rewrite/rewrite.js";
export {
  reattachBindingClrIdentities,
  resolveFunctionTypeFromValueDeclarator,
} from "./semantic-rewrite/reattach.js";
