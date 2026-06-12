import type { GoPtr } from "../../go/compat.js";
import type { SourceFile } from "../ast/ast.js";
import type { Node } from "../ast/spine.js";
import type { NodeVisitor } from "../ast/visitor.js";
import { NodeVisitor_VisitSourceFile } from "../ast/visitor.js";
import type { EmitContext as EmitContext_680f09ca } from "../printer/emitcontext.js";
import { EmitContext_NewNodeVisitor, NewEmitContext } from "../printer/emitcontext.js";
import type { NodeFactory } from "../printer/factory.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/transformer.go::type::Transformer","kind":"type","status":"implemented","sigHash":"5fa010274cdfe50c30d5bc0081e251425ae74f7e76e7ef1a4923c0c6df44c813","bodyHash":"5b632586efde74a79176f2d3bd4d54e68ff683beca4b1058919178791dcdb75b"}
 *
 * Go source:
 * Transformer struct {
 * 	emitContext *printer.EmitContext
 * 	factory     *printer.NodeFactory
 * 	visitor     *ast.NodeVisitor
 * }
 */
export interface Transformer {
  emitContext: GoPtr<EmitContext_680f09ca>;
  factory: GoPtr<NodeFactory>;
  visitor: GoPtr<NodeVisitor>;
}

interface TransformerCarrier {
  readonly __tsgoEmbedded0?: Transformer;
}

function resolveTransformer(receiver: GoPtr<Transformer | TransformerCarrier>): GoPtr<Transformer> {
  if (receiver === undefined) {
    return undefined;
  }
  const embedded = (receiver as TransformerCarrier).__tsgoEmbedded0;
  return embedded === undefined ? receiver as Transformer : embedded;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/transformer.go::method::Transformer.NewTransformer","kind":"method","status":"implemented","sigHash":"eea5ad75fe651a3f5a4f134d075cc199ca0923570a303b33ea88ec5af90e92c2","bodyHash":"1a1dc3e5e465936245c2e337c5c3119892e4d9a1e7445e523f87804eb55c365f"}
 *
 * Go source:
 * func (tx *Transformer) NewTransformer(visit func(node *ast.Node) *ast.Node, emitContext *printer.EmitContext) *Transformer {
 * 	if tx.emitContext != nil {
 * 		panic("Transformer already initialized")
 * 	}
 * 	if emitContext == nil {
 * 		emitContext = printer.NewEmitContext()
 * 	}
 * 	tx.emitContext = emitContext
 * 	tx.factory = emitContext.Factory
 * 	tx.visitor = emitContext.NewNodeVisitor(visit)
 * 	return tx
 * }
 */
export function Transformer_NewTransformer(receiver: GoPtr<Transformer>, visit: (node: GoPtr<Node>) => GoPtr<Node>, emitContext: GoPtr<EmitContext_680f09ca>): GoPtr<Transformer> {
  const tx = resolveTransformer(receiver)!;
  if (tx.emitContext !== undefined) {
    throw new globalThis.Error("Transformer already initialized");
  }
  const ec = emitContext === undefined ? NewEmitContext() : emitContext;
  tx.emitContext = ec;
  tx.factory = ec!.Factory;
  tx.visitor = EmitContext_NewNodeVisitor(ec, visit);
  return tx;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/transformer.go::method::Transformer.EmitContext","kind":"method","status":"implemented","sigHash":"47d14d9bb860a93156eff6efc3bff9633ae375b5a3c2df623a6810c9a6ec3e85","bodyHash":"1e6aaf06f8721820cc3f9d18a5ede6f55a56d517b5a774ca03b9c43e15c44cf3"}
 *
 * Go source:
 * func (tx *Transformer) EmitContext() *printer.EmitContext {
 * 	return tx.emitContext
 * }
 */
export function Transformer_EmitContext(receiver: GoPtr<Transformer>): GoPtr<EmitContext_680f09ca> {
  return resolveTransformer(receiver)!.emitContext;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/transformer.go::method::Transformer.Visitor","kind":"method","status":"implemented","sigHash":"f7880904fbe3061fe2b5f18adf9e97f137bf0b5fc592f63baf89bb658e20968f","bodyHash":"db65fe97aab7511f38b1d7da7391faad1077590f10cabdbbbe8c6212a2a4fcd3"}
 *
 * Go source:
 * func (tx *Transformer) Visitor() *ast.NodeVisitor {
 * 	return tx.visitor
 * }
 */
export function Transformer_Visitor(receiver: GoPtr<Transformer>): GoPtr<NodeVisitor> {
  return resolveTransformer(receiver)!.visitor;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/transformer.go::method::Transformer.Factory","kind":"method","status":"implemented","sigHash":"823907beaacc0030c6fd2ba39bc5c944b2e45d995a5ad306405e4d2f9bceb61f","bodyHash":"edf1348205164a5bd2ae1cf7f1dde11439165acd383dfdd39ccdb7599857b3cd"}
 *
 * Go source:
 * func (tx *Transformer) Factory() *printer.NodeFactory {
 * 	return tx.factory
 * }
 */
export function Transformer_Factory(receiver: GoPtr<Transformer>): GoPtr<NodeFactory> {
  return resolveTransformer(receiver)!.factory;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/transformer.go::method::Transformer.TransformSourceFile","kind":"method","status":"implemented","sigHash":"593431a64895bff97778164c286001ce5d4fdff297017da63b743bae495c01e3","bodyHash":"06f6065f1f3357b6e630255ea0b7245eb139f3aa72d5e2350f1a9f95d771b6d9"}
 *
 * Go source:
 * func (tx *Transformer) TransformSourceFile(file *ast.SourceFile) *ast.SourceFile {
 * 	return tx.visitor.VisitSourceFile(file)
 * }
 */
export function Transformer_TransformSourceFile(receiver: GoPtr<Transformer>, file: GoPtr<SourceFile>): GoPtr<SourceFile> {
  return NodeVisitor_VisitSourceFile(resolveTransformer(receiver)!.visitor, file);
}
