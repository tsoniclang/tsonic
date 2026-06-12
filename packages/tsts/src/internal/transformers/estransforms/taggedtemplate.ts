import type { bool } from "@tsonic/core/types.js";
import * as strings from "../../../go/strings.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import { Node_SubtreeFacts, Node_TemplateLiteralLikeData, NodeFactory_NewNodeList } from "../../ast/spine.js";
import { AsSourceFile, Node_Expression, NodeFactory_UpdateSourceFile } from "../../ast/ast.js";
import { GetSourceFileOfNode, IsExternalModule } from "../../ast/utilities.js";
import type { TaggedTemplateExpression, TemplateSpan } from "../../ast/generated/data.js";
import type { SourceFile } from "../../ast/ast.js";
import type { TemplateLiteralLikeNodeBase } from "../../ast/generated/node.js";
import { AsTaggedTemplateExpression, AsTemplateExpression, AsTemplateSpan } from "../../ast/generated/casts.js";
import { IsNoSubstitutionTemplateLiteral } from "../../ast/generated/predicates.js";
import { KindSourceFile, KindTaggedTemplateExpression, KindNoSubstitutionTemplateLiteral, KindTemplateTail } from "../../ast/generated/kinds.js";
import { NodeFlagsNone } from "../../ast/generated/flags.js";
import {
  NewArrayLiteralExpression,
  NewCallExpression,
  NewStringLiteral,
  NewVariableDeclaration,
  NewVariableDeclarationList,
  NewVariableStatement,
} from "../../ast/generated/factory.js";
import { SubtreeContainsInvalidTemplateEscape } from "../../ast/subtreefacts.js";
import { TokenFlagsContainsInvalidEscape, TokenFlagsIsInvalid, TokenFlagsNone } from "../../ast/tokenflags.js";
import type { NodeFactory } from "../../printer/factory.js";
import {
  NodeFactory_NewAssignmentExpression,
  NodeFactory_NewLogicalORExpression,
  NodeFactory_NewTemplateObjectHelper,
  NodeFactory_NewUniqueName,
  NodeFactory_NewVoidZeroExpression,
} from "../../printer/factory.js";
import { EmitContext_AddEmitHelper, EmitContext_ReadEmitHelpers } from "../../printer/emitcontext.js";
import { GetSourceTextOfNodeFromSourceFile } from "../../scanner/utilities.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import { Transformer_NewTransformer, Transformer_Visitor, Transformer_Factory, Transformer_EmitContext } from "../transformer.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitNode } from "../../ast/visitor.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::varGroup::newlineNormalizer","kind":"varGroup","status":"implemented","sigHash":"dce52d704baa49e164fda5db876f7ff1b17c67dfbc8fe351b6aa931d6376d7ec","bodyHash":"11bf110a0776be8c74d3c86eb3203a5b19cc1d5cb0715d441643b70d02dca838"}
 *
 * Go source:
 * var newlineNormalizer = strings.NewReplacer("\r\n", "\n", "\r", "\n")
 */
export const newlineNormalizer: strings.Replacer = strings.NewReplacer("\r\n", "\n", "\r", "\n");

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::type::taggedTemplateTransformer","kind":"type","status":"implemented","sigHash":"033c071f62d37bfdec703b2b6c920f3c638ebc6808bef284e00b7c51ec6f0b5a","bodyHash":"168cf1ebeee90001eec747e1dd2e39dcfc59ebdf19423f85ed3f09dc355b1c6c"}
 *
 * Go source:
 * taggedTemplateTransformer struct {
 * 	transformers.Transformer
 * 	currentSourceFile *ast.SourceFile
 *
 * 	taggedTemplateStringDeclarations []*ast.Node
 * }
 */
export interface taggedTemplateTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  currentSourceFile: GoPtr<SourceFile>;
  taggedTemplateStringDeclarations: GoSlice<GoPtr<Node>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::func::newTaggedTemplateLiftRestrictionTransformer","kind":"func","status":"implemented","sigHash":"709ae6cc22766dbc4b8abe5250f6af69fa67a8769012ab1319c35be4296a3566","bodyHash":"28547f24d87911fb7708fed28c209104b50c7afa8c93ffb1197bdccddf56659d"}
 *
 * Go source:
 * func newTaggedTemplateLiftRestrictionTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &taggedTemplateTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export function newTaggedTemplateLiftRestrictionTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const tx: taggedTemplateTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    currentSourceFile: undefined,
    taggedTemplateStringDeclarations: [],
  };
  return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => taggedTemplateTransformer_visit(tx, node), opts!.Context);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::method::taggedTemplateTransformer.visit","kind":"method","status":"implemented","sigHash":"96e265ab9956298902ecacfa7fc4b949dc8d844adc1cf2123cdbe4b7b5ffbb57","bodyHash":"e7c7d14be87a418030e45362b45dd92a3ed6f7a9d519ed2456f149c3faa991f8"}
 *
 * Go source:
 * func (tx *taggedTemplateTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsInvalidTemplateEscape == 0 {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		return tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindTaggedTemplateExpression:
 * 		return tx.visitTaggedTemplateExpression(node.AsTaggedTemplateExpression())
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function taggedTemplateTransformer_visit(receiver: GoPtr<taggedTemplateTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if ((Node_SubtreeFacts(node) & SubtreeContainsInvalidTemplateEscape) === 0) {
    return node;
  }
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  switch (node!.Kind) {
    case KindSourceFile:
      return taggedTemplateTransformer_visitSourceFile(receiver, AsSourceFile(node));
    case KindTaggedTemplateExpression:
      return taggedTemplateTransformer_visitTaggedTemplateExpression(receiver, AsTaggedTemplateExpression(node));
    default:
      return NodeVisitor_VisitEachChild(visitor, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::method::taggedTemplateTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"5c186a4aea5b82d58b78502e052714852a93aa655b7e9ad4c618a9a59ca8376f","bodyHash":"bd1cd62ac476f7bad3c31b1e545ee0cd7f0e9d0bdf0ebfccc96369d4bcbe98f9"}
 *
 * Go source:
 * func (tx *taggedTemplateTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	tx.currentSourceFile = node
 * 	tx.taggedTemplateStringDeclarations = nil
 * 	visited := tx.Visitor().VisitEachChild(node.AsNode())
 *
 * 	if len(tx.taggedTemplateStringDeclarations) > 0 {
 * 		visitedSourceFile := visited.AsSourceFile()
 * 		statements := append(visitedSourceFile.Statements.Nodes[:len(visitedSourceFile.Statements.Nodes):len(visitedSourceFile.Statements.Nodes)],
 * 			tx.Factory().NewVariableStatement(
 * 				nil, /*modifiers* /
 * 				tx.Factory().NewVariableDeclarationList(
 * 					tx.Factory().NewNodeList(tx.taggedTemplateStringDeclarations),
 * 					ast.NodeFlagsNone,
 * 				),
 * 			),
 * 		)
 * 		stmtList := tx.Factory().NewNodeList(statements)
 * 		stmtList.Loc = node.Statements.Loc
 * 		visited = tx.Factory().UpdateSourceFile(visitedSourceFile, stmtList, visitedSourceFile.EndOfFileToken)
 * 	}
 *
 * 	tx.EmitContext().AddEmitHelper(visited, tx.EmitContext().ReadEmitHelpers()...)
 * 	return visited
 * }
 */
export function taggedTemplateTransformer_visitSourceFile(receiver: GoPtr<taggedTemplateTransformer>, node: GoPtr<SourceFile>): GoPtr<Node> {
  receiver!.currentSourceFile = node;
  receiver!.taggedTemplateStringDeclarations = [];
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const af = pf.__tsgoEmbedded0!;
  const emitCtx = Transformer_EmitContext(receiver!.__tsgoEmbedded0);
  let visited = NodeVisitor_VisitEachChild(visitor, node as unknown as GoPtr<Node>);

  if (receiver!.taggedTemplateStringDeclarations.length > 0) {
    const visitedSourceFile = AsSourceFile(visited);
    const statements: GoSlice<GoPtr<Node>> = [
      ...visitedSourceFile!.Statements!.Nodes,
      NewVariableStatement(
        af,
        undefined,
        NewVariableDeclarationList(
          af,
          NodeFactory_NewNodeList(af, receiver!.taggedTemplateStringDeclarations),
          NodeFlagsNone,
        ),
      ),
    ];
    const stmtList = NodeFactory_NewNodeList(af, statements);
    stmtList!.Loc = node!.Statements!.Loc;
    visited = NodeFactory_UpdateSourceFile(af, visitedSourceFile, stmtList, visitedSourceFile!.EndOfFileToken);
  }

  EmitContext_AddEmitHelper(emitCtx, visited, ...EmitContext_ReadEmitHelpers(emitCtx));
  return visited;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::method::taggedTemplateTransformer.visitTaggedTemplateExpression","kind":"method","status":"implemented","sigHash":"14ec18ce95f4f60f206a4b259bc576e1c54016a70274a60e12b61a73e24ae1b0","bodyHash":"993f7f12320053836e5a59e6fc759a3e7a3b6ab07cc11532dfc975bd9dc4e2b1"}
 *
 * Go source:
 * func (tx *taggedTemplateTransformer) visitTaggedTemplateExpression(node *ast.TaggedTemplateExpression) *ast.Node {
 * 	return tx.processTaggedTemplateExpression(node)
 * }
 */
export function taggedTemplateTransformer_visitTaggedTemplateExpression(receiver: GoPtr<taggedTemplateTransformer>, node: GoPtr<TaggedTemplateExpression>): GoPtr<Node> {
  return taggedTemplateTransformer_processTaggedTemplateExpression(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::method::taggedTemplateTransformer.processTaggedTemplateExpression","kind":"method","status":"implemented","sigHash":"254a6109be7fba2c963d25861e55a2882208d37aeb0b7bf1c4bb7f7f24f6acdd","bodyHash":"d9307a8c03bf7e94a8c6465ba39297025d843bde656da3390756ee7e7f741eb2"}
 *
 * Go source:
 * func (tx *taggedTemplateTransformer) processTaggedTemplateExpression(node *ast.TaggedTemplateExpression) *ast.Node {
 * 	tag := tx.Visitor().VisitNode(node.Tag)
 * 	template := node.Template
 *
 * 	if !hasInvalidEscape(template) {
 * 		return tx.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	f := tx.Factory()
 *
 * 	// Build up the template arguments and the raw and cooked strings for the template.
 * 	templateArguments := []*ast.Node{nil} // placeholder for the template object
 * 	var cookedStrings []*ast.Node
 * 	var rawStrings []*ast.Node
 *
 * 	if ast.IsNoSubstitutionTemplateLiteral(template) {
 * 		cookedStrings = append(cookedStrings, createTemplateCooked(f, template.TemplateLiteralLikeData()))
 * 		rawStrings = append(rawStrings, getRawLiteral(f, template))
 * 	} else {
 * 		te := template.AsTemplateExpression()
 * 		cookedStrings = append(cookedStrings, createTemplateCooked(f, te.Head.TemplateLiteralLikeData()))
 * 		rawStrings = append(rawStrings, getRawLiteral(f, te.Head))
 * 		for _, span := range te.TemplateSpans.Nodes {
 * 			ts := span.AsTemplateSpan()
 * 			cookedStrings = append(cookedStrings, createTemplateCooked(f, ts.Literal.TemplateLiteralLikeData()))
 * 			rawStrings = append(rawStrings, getRawLiteral(f, ts.Literal))
 * 			templateArguments = append(templateArguments, tx.Visitor().VisitNode(ts.Expression))
 * 		}
 * 	}
 *
 * 	helperCall := f.NewTemplateObjectHelper(
 * 		f.NewArrayLiteralExpression(f.NewNodeList(cookedStrings), false),
 * 		f.NewArrayLiteralExpression(f.NewNodeList(rawStrings), false),
 * 	)
 *
 * 	// Create a variable to cache the template object if we're in a module.
 * 	// Do not do this in the global scope, as any variable we currently generate could conflict with
 * 	// variables from outside of the current compilation. In the future, we can revisit this behavior.
 * 	if ast.IsExternalModule(tx.currentSourceFile) {
 * 		tempVar := f.NewUniqueName("templateObject")
 * 		tx.taggedTemplateStringDeclarations = append(tx.taggedTemplateStringDeclarations,
 * 			f.NewVariableDeclaration(tempVar, nil, nil, nil),
 * 		)
 * 		templateArguments[0] = f.NewLogicalORExpression(
 * 			tempVar,
 * 			f.NewAssignmentExpression(tempVar, helperCall),
 * 		)
 * 	} else {
 * 		templateArguments[0] = helperCall
 * 	}
 *
 * 	call := f.NewCallExpression(tag, nil /*questionDotToken* /, nil /*typeArguments* /, f.NewNodeList(templateArguments), ast.NodeFlagsNone)
 * 	call.Loc = node.Loc
 * 	return call
 * }
 */
export function taggedTemplateTransformer_processTaggedTemplateExpression(receiver: GoPtr<taggedTemplateTransformer>, node: GoPtr<TaggedTemplateExpression>): GoPtr<Node> {
  const visitor = Transformer_Visitor(receiver!.__tsgoEmbedded0) as ConcreteNodeVisitor;
  const pf = Transformer_Factory(receiver!.__tsgoEmbedded0)!;
  const af = pf.__tsgoEmbedded0!;
  const tag = NodeVisitor_VisitNode(visitor, node!.Tag as unknown as GoPtr<Node>);
  const template = node!.Template as unknown as GoPtr<Node>;

  if (!hasInvalidEscape(template)) {
    return NodeVisitor_VisitEachChild(visitor, node as unknown as GoPtr<Node>);
  }

  // Build up the template arguments and the raw and cooked strings for the template.
  const templateArguments: GoSlice<GoPtr<Node>> = [undefined]; // placeholder for the template object
  const cookedStrings: GoSlice<GoPtr<Node>> = [];
  const rawStrings: GoSlice<GoPtr<Node>> = [];

  if (IsNoSubstitutionTemplateLiteral(template)) {
    cookedStrings.push(createTemplateCooked(pf, Node_TemplateLiteralLikeData(template)));
    rawStrings.push(getRawLiteral(pf, template));
  } else {
    const te = AsTemplateExpression(template);
    cookedStrings.push(createTemplateCooked(pf, Node_TemplateLiteralLikeData(te!.Head as unknown as GoPtr<Node>)));
    rawStrings.push(getRawLiteral(pf, te!.Head as unknown as GoPtr<Node>));
    for (const span of te!.TemplateSpans!.Nodes) {
      const ts: GoPtr<TemplateSpan> = AsTemplateSpan(span);
      cookedStrings.push(createTemplateCooked(pf, Node_TemplateLiteralLikeData(ts!.Literal as unknown as GoPtr<Node>)));
      rawStrings.push(getRawLiteral(pf, ts!.Literal as unknown as GoPtr<Node>));
      templateArguments.push(NodeVisitor_VisitNode(visitor, ts!.Expression as unknown as GoPtr<Node>));
    }
  }

  const helperCall = NodeFactory_NewTemplateObjectHelper(
    pf,
    NewArrayLiteralExpression(af, NodeFactory_NewNodeList(af, cookedStrings), false as bool),
    NewArrayLiteralExpression(af, NodeFactory_NewNodeList(af, rawStrings), false as bool),
  );

  // Create a variable to cache the template object if we're in a module.
  // Do not do this in the global scope, as any variable we currently generate could conflict with
  // variables from outside of the current compilation. In the future, we can revisit this behavior.
  if (IsExternalModule(receiver!.currentSourceFile)) {
    const tempVar = NodeFactory_NewUniqueName(pf, "templateObject");
    receiver!.taggedTemplateStringDeclarations.push(
      NewVariableDeclaration(af, tempVar as unknown as GoPtr<Node>, undefined, undefined, undefined),
    );
    templateArguments[0] = NodeFactory_NewLogicalORExpression(
      pf,
      tempVar as unknown as GoPtr<Node>,
      NodeFactory_NewAssignmentExpression(pf, tempVar as unknown as GoPtr<Node>, helperCall),
    );
  } else {
    templateArguments[0] = helperCall;
  }

  const call = NewCallExpression(af, tag, undefined, undefined, NodeFactory_NewNodeList(af, templateArguments), NodeFlagsNone);
  call!.Loc = node!.Loc;
  return call;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::func::createTemplateCooked","kind":"func","status":"implemented","sigHash":"e98a9d9c03be45265718a6b1ab47d1988c945928d907f4ccd0fbfe44a8617265","bodyHash":"ef7e79ba272b7ca8fd1f494fa3427e36e96d70387976db09172e5b3253948472"}
 *
 * Go source:
 * func createTemplateCooked(f *printer.NodeFactory, template *ast.TemplateLiteralLikeNodeBase) *ast.Node {
 * 	if template.TemplateFlags&ast.TokenFlagsIsInvalid != 0 {
 * 		return f.NewVoidZeroExpression()
 * 	}
 * 	return f.NewStringLiteral(template.Text, ast.TokenFlagsNone)
 * }
 */
export function createTemplateCooked(f: GoPtr<NodeFactory>, template: GoPtr<TemplateLiteralLikeNodeBase>): GoPtr<Node> {
  if ((template!.TemplateFlags & TokenFlagsIsInvalid) !== 0) {
    return NodeFactory_NewVoidZeroExpression(f);
  }
  return NewStringLiteral(f!.__tsgoEmbedded0!, template!.Text, TokenFlagsNone);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::func::getRawLiteral","kind":"func","status":"implemented","sigHash":"48933d15ef1156c4ba891ea7d278df573819dec88b1ad8b14506f10e1597dff5","bodyHash":"df00177c3776c76455806881fe14ca05bd9b93ad497990d6794b34242d8cf558"}
 *
 * Go source:
 * func getRawLiteral(f *printer.NodeFactory, node *ast.Node) *ast.Node {
 * 	text := node.TemplateLiteralLikeData().RawText
 * 	if text == "" {
 * 		text = scanner.GetSourceTextOfNodeFromSourceFile(ast.GetSourceFileOfNode(node), node, false /*includeTrivia* /)
 * 		// text contains the original source, it will also contain quotes ("`"), dollar signs and braces ("${" and "}"),
 * 		// thus we need to remove those characters.
 * 		// First template piece starts with "`", others with "}"
 * 		// Last template piece ends with "`", others with "${"
 * 		isLast := node.Kind == ast.KindNoSubstitutionTemplateLiteral || node.Kind == ast.KindTemplateTail
 * 		endLen := 2
 * 		if isLast {
 * 			endLen = 1
 * 		}
 * 		text = text[1 : len(text)-endLen]
 * 	}
 *
 * 	// Newline normalization:
 * 	// ES6 Spec 11.8.6.1 - Static Semantics of TV's and TRV's
 * 	// <CR><LF> and <CR> LineTerminatorSequences are normalized to <LF> for both TV and TRV.
 * 	text = newlineNormalizer.Replace(text)
 *
 * 	result := f.NewStringLiteral(text, ast.TokenFlagsNone)
 * 	result.Loc = node.Loc
 * 	return result
 * }
 */
export function getRawLiteral(f: GoPtr<NodeFactory>, node: GoPtr<Node>): GoPtr<Node> {
  let text = Node_TemplateLiteralLikeData(node)!.RawText;
  if (text === "") {
    text = GetSourceTextOfNodeFromSourceFile(GetSourceFileOfNode(node) as unknown as GoPtr<Node>, node, false as bool);
    // text contains the original source, it will also contain quotes ("`"), dollar signs and braces ("${" and "}"),
    // thus we need to remove those characters.
    // First template piece starts with "`", others with "}"
    // Last template piece ends with "`", others with "${"
    const isLast = node!.Kind === KindNoSubstitutionTemplateLiteral || node!.Kind === KindTemplateTail;
    const endLen = isLast ? 1 : 2;
    text = text.slice(1, text.length - endLen);
  }

  // Newline normalization:
  // ES6 Spec 11.8.6.1 - Static Semantics of TV's and TRV's
  // <CR><LF> and <CR> LineTerminatorSequences are normalized to <LF> for both TV and TRV.
  text = newlineNormalizer.Replace(text);

  const result = NewStringLiteral(f!.__tsgoEmbedded0!, text, TokenFlagsNone);
  result!.Loc = node!.Loc;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/taggedtemplate.go::func::hasInvalidEscape","kind":"func","status":"implemented","sigHash":"a2d4bb177cfb9724f3673e713b9e7dfb771237ee272f863c6ede1e2918714ab4","bodyHash":"fe4f685d698afc972ad3914a7cddaa95b6c84064e03711db383abc8c72bf7b64"}
 *
 * Go source:
 * func hasInvalidEscape(template *ast.Node) bool {
 * 	if ast.IsNoSubstitutionTemplateLiteral(template) {
 * 		return template.TemplateLiteralLikeData().TemplateFlags&ast.TokenFlagsContainsInvalidEscape != 0
 * 	}
 * 	te := template.AsTemplateExpression()
 * 	if te.Head.TemplateLiteralLikeData().TemplateFlags&ast.TokenFlagsContainsInvalidEscape != 0 {
 * 		return true
 * 	}
 * 	for _, span := range te.TemplateSpans.Nodes {
 * 		if span.AsTemplateSpan().Literal.TemplateLiteralLikeData().TemplateFlags&ast.TokenFlagsContainsInvalidEscape != 0 {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function hasInvalidEscape(template: GoPtr<Node>): bool {
  if (IsNoSubstitutionTemplateLiteral(template)) {
    return ((Node_TemplateLiteralLikeData(template)!.TemplateFlags & TokenFlagsContainsInvalidEscape) !== 0) as bool;
  }
  const te = AsTemplateExpression(template);
  if ((Node_TemplateLiteralLikeData(te!.Head as unknown as GoPtr<Node>)!.TemplateFlags & TokenFlagsContainsInvalidEscape) !== 0) {
    return true as bool;
  }
  for (const span of te!.TemplateSpans!.Nodes) {
    const ts: GoPtr<TemplateSpan> = AsTemplateSpan(span);
    if ((Node_TemplateLiteralLikeData(ts!.Literal as unknown as GoPtr<Node>)!.TemplateFlags & TokenFlagsContainsInvalidEscape) !== 0) {
      return true as bool;
    }
  }
  return false as bool;
}
