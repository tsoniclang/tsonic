import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Node, NodeList } from "../ast/spine.js";
import { Node_Clone, Node_Name, Node_SubtreeFacts, NodeFactory_NewNodeList } from "../ast/spine.js";
import { Node_Text, Node_Expression, Node_Initializer } from "../ast/ast.js";
import { AsBinaryExpression, AsElementAccessExpression, AsShorthandPropertyAssignment } from "../ast/generated/casts.js";
import { KindArrayBindingPattern, KindArrayLiteralExpression, KindObjectBindingPattern, KindObjectLiteralExpression, KindColonToken, KindQuestionToken } from "../ast/generated/kinds.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import {
  NewArrayLiteralExpression,
  NewBindingElement,
  NewBindingPattern,
  NewConditionalExpression,
  NewElementAccessExpression,
  NewIdentifier,
  NewNumericLiteral,
  NewObjectLiteralExpression,
  NewOmittedExpression,
  NewPropertyAccessExpression,
  NewSyntaxList,
  NewToken,
  NewVariableDeclaration,
} from "../ast/generated/factory.js";
import {
  IsComputedPropertyName,
  IsBigIntLiteral,
  IsIdentifier,
  IsOmittedExpression,
  IsPropertyAssignment,
  IsShorthandPropertyAssignment,
  IsSpreadElement,
  IsVariableDeclaration,
} from "../ast/generated/predicates.js";
import {
  GetElementsOfBindingOrAssignmentPattern,
  GetRestIndicatorOfBindingOrAssignmentElement,
  GetTargetOfBindingOrAssignmentElement,
  IsAssignmentExpression,
  IsAssignmentPattern,
  IsBindingPattern,
  IsDeclarationBindingElement,
  IsDestructuringAssignment,
  IsEmptyArrayLiteral,
  IsEmptyObjectLiteral,
  IsLiteralExpression,
  IsPropertyNameLiteral,
  IsStringOrNumericLiteralLike,
  NodeIsSynthesized,
  TryGetPropertyNameOfBindingOrAssignmentElement,
} from "../ast/utilities.js";
import { SubtreeContainsObjectRestOrSpread, SubtreeContainsRestOrSpread } from "../ast/subtreefacts.js";
import { NodeFlagsNone } from "../ast/nodeflags.js";
import { TokenFlagsNone } from "../ast/tokenflags.js";
import { Every } from "../core/core.js";
import { Itoa } from "../../go/strconv.js";
import type { Expression, IdentifierNode } from "../ast/generated/unions.js";
import type { TextRange } from "../core/text.js";
import type { NodeFactory as PrinterNodeFactory } from "../printer/factory.js";
import { NodeFactory_NewArraySliceCall, NodeFactory_NewAssignmentExpression, NodeFactory_NewTempVariable, NodeFactory_NewTypeCheck, NodeFactory_InlineExpressions, NodeFactory_NewRestHelper, NodeFactory_NewVoidZeroExpression } from "../printer/factory.js";
import { IsSimpleCopiableExpression, IsSimpleInlineableExpression } from "./utilities.js";
import { EmitContext_AddVariableDeclaration, EmitContext_SetOriginal } from "../printer/emitcontext.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../ast/visitor.js";
import { NodeVisitor_VisitNode } from "../ast/visitor.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_Visitor } from "./transformer.js";
import type { Transformer } from "./transformer.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::type::FlattenLevel","kind":"type","status":"implemented","sigHash":"89f91cf9e4073d497bd63aaf8ae365eab37749b527bd5f9d8e8421342282d342","bodyHash":"ccbbed42a7410b2965acabbf9c1fb86eabca1bab73508cc3377beefbd68a8797"}
 *
 * Go source:
 * FlattenLevel int
 */
export type FlattenLevel = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::constGroup::FlattenLevelAll+FlattenLevelObjectRest","kind":"constGroup","status":"implemented","sigHash":"9c083b589e162532eadc5017a3260a387eab7608bff2cb5f83922df0435653d6","bodyHash":"1cfb9746fb4c240aafe1be6ef7d4f6fa6dd70eef7e33bf71bf7696fcae9dd705"}
 *
 * Go source:
 * const (
 * 	FlattenLevelAll        FlattenLevel = iota // Fully decompose all patterns into individual assignments/bindings
 * 	FlattenLevelObjectRest                     // Only decompose patterns containing object rest elements
 * )
 */
export const FlattenLevelAll: FlattenLevel = 0; // Fully decompose all patterns into individual assignments/bindings
export const FlattenLevelObjectRest: FlattenLevel = 1; // Only decompose patterns containing object rest elements

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::type::CreateAssignmentCallback","kind":"type","status":"implemented","sigHash":"bf243697cba5c726e35c99763200a48b91ba412de68360324edae70e3160f822","bodyHash":"b99c178cfbaee02d53ec79e2055a5ccd8555324012e98d54cba5503abe2e32fd"}
 *
 * Go source:
 * CreateAssignmentCallback func(name *ast.IdentifierNode, value *ast.Expression, location *core.TextRange) *ast.Expression
 */
export type CreateAssignmentCallback = (name: GoPtr<IdentifierNode>, value: GoPtr<Expression>, location: GoPtr<TextRange>) => GoPtr<Expression>;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::FlattenDestructuringAssignment","kind":"func","status":"implemented","sigHash":"559311f1142b906ea38fcd6e5917789a93de1f70933fd7bc622b36ec64bd8faf","bodyHash":"f2a6078479cb5bc915d7478e98b3fe9f3c02ecd5de39bc9b4835598989b36509"}
 *
 * Go source:
 * func FlattenDestructuringAssignment(
 * 	tx *Transformer,
 * 	node *ast.Node, // VariableDeclaration | DestructuringAssignment
 * 	needsValue bool,
 * 	level FlattenLevel,
 * 	createAssignmentCallback CreateAssignmentCallback,
 * ) *ast.Expression {
 * 	f := newFlattener(tx, level)
 * 	f.createAssignmentCallback = createAssignmentCallback
 * 	f.hoistTempVariables = true
 * 	// Assignment mode callbacks
 * 	f.emitBindingOrAssignment = (*flattener).emitAssignment
 * 	f.createArrayBindingOrAssignmentPattern = (*flattener).createArrayAssignmentPattern
 * 	f.createObjectBindingOrAssignmentPattern = (*flattener).createObjectAssignmentPattern
 * 	f.createArrayBindingOrAssignmentElement = (*flattener).createArrayAssignmentElement
 * 	return f.flattenDestructuringAssignment(node, needsValue)
 * }
 */
export function FlattenDestructuringAssignment(tx: GoPtr<Transformer>, node: GoPtr<Node>, needsValue: bool, level: FlattenLevel, createAssignmentCallback: CreateAssignmentCallback): GoPtr<Expression> {
  const f = newFlattener(tx, level);
  f!.createAssignmentCallback = createAssignmentCallback;
  f!.hoistTempVariables = true;
  f!.emitBindingOrAssignment = flattener_emitAssignment;
  f!.createArrayBindingOrAssignmentPattern = flattener_createArrayAssignmentPattern;
  f!.createObjectBindingOrAssignmentPattern = flattener_createObjectAssignmentPattern;
  f!.createArrayBindingOrAssignmentElement = flattener_createArrayAssignmentElement;
  return flattener_flattenDestructuringAssignment(f, node, needsValue);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::type::pendingDecl","kind":"type","status":"implemented","sigHash":"073ae1376b570dc3b7d7b38129dbcbe7a5fb2f943e6acf03914c8cbd4cb3cf4a","bodyHash":"70bab6e4d4d073cd7bc73880b5a8220e478aed3f02fcb8f6170953a79da1a58b"}
 *
 * Go source:
 * pendingDecl struct {
 * 	pendingExpressions []*ast.Node
 * 	name               *ast.Node
 * 	value              *ast.Node
 * 	location           core.TextRange
 * 	original           *ast.Node
 * }
 */
export interface pendingDecl {
  pendingExpressions: GoSlice<GoPtr<Node>>;
  name: GoPtr<Node>;
  value: GoPtr<Node>;
  location: TextRange;
  original: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::FlattenDestructuringBinding","kind":"func","status":"implemented","sigHash":"5fc190158b76e858499f34ca983393b1b8147dfa18a827609045047b24c56808","bodyHash":"086bcd98b295ed8adfb937793200c3347097bab388834d7a7c385ec99e738bb5"}
 *
 * Go source:
 * func FlattenDestructuringBinding(
 * 	tx *Transformer,
 * 	node *ast.Node, // VariableDeclaration | ParameterDeclaration | BindingElement
 * 	rval *ast.Node,
 * 	level FlattenLevel,
 * 	hoistTempVariables bool,
 * 	skipInitializer bool,
 * ) *ast.Node {
 * 	f := newFlattener(tx, level)
 * 	f.hoistTempVariables = hoistTempVariables
 * 	// Binding mode callbacks
 * 	f.emitBindingOrAssignment = (*flattener).emitBinding
 * 	f.createArrayBindingOrAssignmentPattern = (*flattener).createArrayBindingPattern
 * 	f.createObjectBindingOrAssignmentPattern = (*flattener).createObjectBindingPattern
 * 	f.createArrayBindingOrAssignmentElement = (*flattener).createArrayBindingElement
 * 	return f.flattenDestructuringBinding(node, rval, skipInitializer)
 * }
 */
export function FlattenDestructuringBinding(tx: GoPtr<Transformer>, node: GoPtr<Node>, rval: GoPtr<Node>, level: FlattenLevel, hoistTempVariables: bool, skipInitializer: bool): GoPtr<Node> {
  const f = newFlattener(tx, level);
  f!.hoistTempVariables = hoistTempVariables;
  f!.emitBindingOrAssignment = flattener_emitBinding;
  f!.createArrayBindingOrAssignmentPattern = flattener_createArrayBindingPattern;
  f!.createObjectBindingOrAssignmentPattern = flattener_createObjectBindingPattern;
  f!.createArrayBindingOrAssignmentElement = flattener_createArrayBindingElement;
  return flattener_flattenDestructuringBinding(f, node, rval, skipInitializer);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::type::flattener","kind":"type","status":"implemented","sigHash":"d102b0a1bcc94fdcf695fb1015b0add4366ffab7c095c9b35a9ab31e4c5558e6","bodyHash":"dac4d20c8a7c52ce833b426be16922112b62b8b7e7c96bfa8d4deb97a704d74b"}
 *
 * Go source:
 * flattener struct {
 * 	tx    *Transformer
 * 	level FlattenLevel
 * 
 * 	createAssignmentCallback CreateAssignmentCallback
 * 
 * 	// State
 * 	expressions                []*ast.Node
 * 	declarations               []pendingDecl
 * 	hasTransformedPriorElement bool
 * 	hoistTempVariables         bool
 * 
 * 	// Mode callbacks (set by FlattenDestructuringAssignment or FlattenDestructuringBinding)
 * 	emitBindingOrAssignment                func(f *flattener, target *ast.Node, value *ast.Node, location core.TextRange, original *ast.Node)
 * 	createArrayBindingOrAssignmentPattern  func(f *flattener, elements []*ast.Node) *ast.Node
 * 	createObjectBindingOrAssignmentPattern func(f *flattener, elements []*ast.Node) *ast.Node
 * 	createArrayBindingOrAssignmentElement  func(f *flattener, expr *ast.Node) *ast.Node
 * }
 */
export interface flattener {
  tx: GoPtr<Transformer>;
  level: FlattenLevel;
  createAssignmentCallback: CreateAssignmentCallback;
  expressions: GoSlice<GoPtr<Node>>;
  declarations: GoSlice<pendingDecl>;
  hasTransformedPriorElement: bool;
  hoistTempVariables: bool;
  emitBindingOrAssignment: (f: GoPtr<flattener>, target: GoPtr<Node>, value: GoPtr<Node>, location: TextRange, original: GoPtr<Node>) => void;
  createArrayBindingOrAssignmentPattern: (f: GoPtr<flattener>, elements: GoSlice<GoPtr<Node>>) => GoPtr<Node>;
  createObjectBindingOrAssignmentPattern: (f: GoPtr<flattener>, elements: GoSlice<GoPtr<Node>>) => GoPtr<Node>;
  createArrayBindingOrAssignmentElement: (f: GoPtr<flattener>, expr: GoPtr<Node>) => GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::newFlattener","kind":"func","status":"implemented","sigHash":"d85ed953dcae32539671da27ba916e4ab07ee0d54eb0fb2e3d9c8917324c1684","bodyHash":"fd29ed19c5975449884c99de71b326910809b6aae2bfc77eeebbe72e12c9304e"}
 *
 * Go source:
 * func newFlattener(tx *Transformer, level FlattenLevel) *flattener {
 * 	return &flattener{
 * 		tx:    tx,
 * 		level: level,
 * 	}
 * }
 */
export function newFlattener(tx: GoPtr<Transformer>, level: FlattenLevel): GoPtr<flattener> {
  return {
    tx,
    level,
    createAssignmentCallback: undefined!,
    expressions: [],
    declarations: [],
    hasTransformedPriorElement: false,
    hoistTempVariables: false,
    emitBindingOrAssignment: undefined!,
    createArrayBindingOrAssignmentPattern: undefined!,
    createObjectBindingOrAssignmentPattern: undefined!,
    createArrayBindingOrAssignmentElement: undefined!,
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createArrayAssignmentPattern","kind":"method","status":"implemented","sigHash":"906411b9c8a05dcf07db95decd784c6aab517cfa319ac92fdd6f599fb3ef1c91","bodyHash":"7cb441f8b4fca6e8f45904f3a384734d39698a59b74a01fb7ac0eab574a3db1f"}
 *
 * Go source:
 * func (f *flattener) createArrayAssignmentPattern(elements []*ast.Node) *ast.Node {
 * 	return f.tx.Factory().NewArrayLiteralExpression(f.tx.Factory().NewNodeList(elements), false)
 * }
 */
export function flattener_createArrayAssignmentPattern(receiver: GoPtr<flattener>, elements: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  return NewArrayLiteralExpression(af, NodeFactory_NewNodeList(af, elements), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createObjectAssignmentPattern","kind":"method","status":"implemented","sigHash":"6f73778d0aa785c5a998a20c3448abd65b6b8b140cf4d6fef3d8cd3cc092f1cd","bodyHash":"85a8b2ee7b4d6d569db11f9aa6e7b59ff997d7fd410ff854952a7aaefc3b700e"}
 *
 * Go source:
 * func (f *flattener) createObjectAssignmentPattern(elements []*ast.Node) *ast.Node {
 * 	return f.tx.Factory().NewObjectLiteralExpression(f.tx.Factory().NewNodeList(elements), false)
 * }
 */
export function flattener_createObjectAssignmentPattern(receiver: GoPtr<flattener>, elements: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  return NewObjectLiteralExpression(af, NodeFactory_NewNodeList(af, elements), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createArrayAssignmentElement","kind":"method","status":"implemented","sigHash":"d2a0456510278711ff4941f0f4ada24f0d7f587e6556f3ed67c22525c50508a3","bodyHash":"2502be92ccf4a9bfa56909f2c5d93f9ed5057f74ec67a96d3ab8f00de23b3b0d"}
 *
 * Go source:
 * func (f *flattener) createArrayAssignmentElement(expr *ast.Node) *ast.Node {
 * 	return expr
 * }
 */
export function flattener_createArrayAssignmentElement(receiver: GoPtr<flattener>, expr: GoPtr<Node>): GoPtr<Node> {
  return expr;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.emitAssignment","kind":"method","status":"implemented","sigHash":"2026e3a39c099699ab8149c961937798eaf084af121745c50d71d584d8833e29","bodyHash":"a578ace3af4505d0f2b4b6beea0620095f29d521225a4ba2778c91b7892b538f"}
 *
 * Go source:
 * func (f *flattener) emitAssignment(target *ast.Node, value *ast.Node, location core.TextRange, original *ast.Node) {
 * 	var expression *ast.Expression
 * 	if f.createAssignmentCallback != nil && ast.IsIdentifier(target) {
 * 		expression = f.createAssignmentCallback(target, value, &location)
 * 	} else {
 * 		expression = f.tx.Factory().NewAssignmentExpression(f.tx.Visitor().VisitNode(target), value)
 * 		expression.Loc = location
 * 	}
 * 	f.tx.EmitContext().SetOriginal(expression, original)
 * 	f.emitExpression(expression)
 * }
 */
export function flattener_emitAssignment(receiver: GoPtr<flattener>, target: GoPtr<Node>, value: GoPtr<Node>, location: TextRange, original: GoPtr<Node>): void {
  const pf = Transformer_Factory(receiver!.tx)!;
  const visitor = Transformer_Visitor(receiver!.tx) as ConcreteNodeVisitor;
  let expression: GoPtr<Expression>;
  if (receiver!.createAssignmentCallback !== undefined && IsIdentifier(target)) {
    expression = receiver!.createAssignmentCallback(target, value, location);
  } else {
    expression = NodeFactory_NewAssignmentExpression(pf, NodeVisitor_VisitNode(visitor, target), value);
    expression!.Loc = location;
  }
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.tx), expression, original);
  flattener_emitExpression(receiver, expression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createArrayBindingPattern","kind":"method","status":"implemented","sigHash":"e48f238dc3608d40c2689b273103bce35198d907d43261fd8b5e8c2348711080","bodyHash":"6e3ab6fe04ee1bc3af74a0d66eb6af072c8d4f105d0ed54413e45ec45a2a8b7a"}
 *
 * Go source:
 * func (f *flattener) createArrayBindingPattern(elements []*ast.Node) *ast.Node {
 * 	return f.tx.Factory().NewBindingPattern(ast.KindArrayBindingPattern, f.tx.Factory().NewNodeList(elements))
 * }
 */
export function flattener_createArrayBindingPattern(receiver: GoPtr<flattener>, elements: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  return NewBindingPattern(af, KindArrayBindingPattern, NodeFactory_NewNodeList(af, elements));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createObjectBindingPattern","kind":"method","status":"implemented","sigHash":"8afd9cb7d9d51086899002401c84df01f5830c0d209acdfa6b93122274604d9c","bodyHash":"90b3b15e76ffe023c2481c07558a94b12217b484ab68b3ab7e68dce8f859c390"}
 *
 * Go source:
 * func (f *flattener) createObjectBindingPattern(elements []*ast.Node) *ast.Node {
 * 	return f.tx.Factory().NewBindingPattern(ast.KindObjectBindingPattern, f.tx.Factory().NewNodeList(elements))
 * }
 */
export function flattener_createObjectBindingPattern(receiver: GoPtr<flattener>, elements: GoSlice<GoPtr<Node>>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  return NewBindingPattern(af, KindObjectBindingPattern, NodeFactory_NewNodeList(af, elements));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createArrayBindingElement","kind":"method","status":"implemented","sigHash":"595081aabfd3b1fc1c24cf0562ef3f0367ca72d5842849176604695a486d8598","bodyHash":"ffd4d27a8327c322d45d905da288c7d09bd0d45a835e1d337c0866549557bf3f"}
 *
 * Go source:
 * func (f *flattener) createArrayBindingElement(expr *ast.Node) *ast.Node {
 * 	return f.tx.Factory().NewBindingElement(nil, nil, expr, nil)
 * }
 */
export function flattener_createArrayBindingElement(receiver: GoPtr<flattener>, expr: GoPtr<Node>): GoPtr<Node> {
  return NewBindingElement(Transformer_Factory(receiver!.tx)!.__tsgoEmbedded0!, undefined, undefined, expr, undefined);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.emitBinding","kind":"method","status":"implemented","sigHash":"6ea1719c38c655fd67643c7f4eb92928fab97f4d0afb328b21e471a1bcd400ef","bodyHash":"cc172cb8e8acb23f1e13c3cca8ff594f72728040db6e09683687aef6cefa56ba"}
 *
 * Go source:
 * func (f *flattener) emitBinding(target *ast.Node, value *ast.Node, location core.TextRange, original *ast.Node) {
 * 	if len(f.expressions) > 0 {
 * 		value = f.tx.Factory().InlineExpressions(append(f.expressions, value))
 * 		f.expressions = nil
 * 	}
 * 	f.declarations = append(f.declarations, pendingDecl{
 * 		name:     target,
 * 		value:    value,
 * 		location: location,
 * 		original: original,
 * 	})
 * }
 */
export function flattener_emitBinding(receiver: GoPtr<flattener>, target: GoPtr<Node>, value: GoPtr<Node>, location: TextRange, original: GoPtr<Node>): void {
  let finalValue = value;
  if (receiver!.expressions.length > 0) {
    finalValue = NodeFactory_InlineExpressions(Transformer_Factory(receiver!.tx)!, [...receiver!.expressions, value]);
    receiver!.expressions = [];
  }
  receiver!.declarations = [...receiver!.declarations, {
    pendingExpressions: [],
    name: target,
    value: finalValue,
    location,
    original,
  }];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.emitExpression","kind":"method","status":"implemented","sigHash":"e988fbf906d3055802d72b168869b21d9c25274bb6879074099894097baeb1cf","bodyHash":"5c9f2b87ff0e6c512ae13438167b07629cf7bced2ef41584e72cdf3597af3ac5"}
 *
 * Go source:
 * func (f *flattener) emitExpression(expr *ast.Node) {
 * 	f.expressions = append(f.expressions, expr)
 * }
 */
export function flattener_emitExpression(receiver: GoPtr<flattener>, expr: GoPtr<Node>): void {
  receiver!.expressions = [...receiver!.expressions, expr];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.ensureIdentifier","kind":"method","status":"implemented","sigHash":"755a5e3a795696b135aefcf27e4ac309637e50e9da3e3d3abb7f27639839188c","bodyHash":"328f5e4d9d2522ca128f13102ddffed3ad9d2788b00c3ffc4a60941bfe2cfe61"}
 *
 * Go source:
 * func (f *flattener) ensureIdentifier(value *ast.Node, reuseIdentifierExpressions bool, location core.TextRange) *ast.Node {
 * 	if reuseIdentifierExpressions && ast.IsIdentifier(value) {
 * 		return value
 * 	}
 * 	temp := f.tx.Factory().NewTempVariable()
 * 	if f.hoistTempVariables {
 * 		f.tx.EmitContext().AddVariableDeclaration(temp)
 * 		assign := f.tx.Factory().NewAssignmentExpression(temp, value)
 * 		assign.Loc = location
 * 		f.emitExpression(assign)
 * 	} else {
 * 		f.emitBindingOrAssignment(f, temp, value, location, nil)
 * 	}
 * 	return temp
 * }
 */
export function flattener_ensureIdentifier(receiver: GoPtr<flattener>, value: GoPtr<Node>, reuseIdentifierExpressions: bool, location: TextRange): GoPtr<Node> {
  if (reuseIdentifierExpressions && IsIdentifier(value)) {
    return value;
  }
  const pf = Transformer_Factory(receiver!.tx)!;
  const temp = NodeFactory_NewTempVariable(pf);
  if (receiver!.hoistTempVariables) {
    EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.tx), temp);
    const assign = NodeFactory_NewAssignmentExpression(pf, temp, value);
    assign!.Loc = location;
    flattener_emitExpression(receiver, assign);
  } else {
    receiver!.emitBindingOrAssignment(receiver, temp, value, location, undefined);
  }
  return temp;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createDefaultValueCheck","kind":"method","status":"implemented","sigHash":"5ca07f76796a10c29601bab5443f9f89486c175f9ec8e975fc8286610a7cebf9","bodyHash":"67b79d6fa9fcb6a765423c4b7bf0a986f3376a5187928e7aa4eae25f62e843cc"}
 *
 * Go source:
 * func (f *flattener) createDefaultValueCheck(value *ast.Expression, defaultValue *ast.Expression, location core.TextRange) *ast.Node {
 * 	value = f.ensureIdentifier(value, true, location)
 * 	return f.tx.Factory().NewConditionalExpression(
 * 		f.tx.Factory().NewTypeCheck(value, "undefined"),
 * 		f.tx.Factory().NewToken(ast.KindQuestionToken),
 * 		defaultValue,
 * 		f.tx.Factory().NewToken(ast.KindColonToken),
 * 		value,
 * 	)
 * }
 */
export function flattener_createDefaultValueCheck(receiver: GoPtr<flattener>, value: GoPtr<Expression>, defaultValue: GoPtr<Expression>, location: TextRange): GoPtr<Node> {
  const ensured = flattener_ensureIdentifier(receiver, value, true, location);
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  return NewConditionalExpression(
    af,
    NodeFactory_NewTypeCheck(pf, ensured, "undefined"),
    NewToken(af, KindQuestionToken),
    defaultValue,
    NewToken(af, KindColonToken),
    ensured,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.createDestructuringPropertyAccess","kind":"method","status":"implemented","sigHash":"d2c0f0024cdc2a25dfb1e83a0ba34cdf734a0f566ae684de9d450cb240f66191","bodyHash":"30e438df06787e2343473a189b9371171c9b6ffcd286ff523a2f6f9f7f527d72"}
 *
 * Go source:
 * func (f *flattener) createDestructuringPropertyAccess(value *ast.Node, propertyName *ast.Node) *ast.Node {
 * 	if ast.IsComputedPropertyName(propertyName) {
 * 		argumentExpression := f.ensureIdentifier(f.tx.Visitor().VisitNode(propertyName.Expression()), false, propertyName.Loc)
 * 		return f.tx.Factory().NewElementAccessExpression(value, nil, argumentExpression, ast.NodeFlagsNone)
 * 	} else if ast.IsStringOrNumericLiteralLike(propertyName) || ast.IsBigIntLiteral(propertyName) {
 * 		argumentExpression := propertyName.Clone(f.tx.Factory())
 * 		return f.tx.Factory().NewElementAccessExpression(value, nil, argumentExpression, ast.NodeFlagsNone)
 * 	} else {
 * 		name := f.tx.Factory().NewIdentifier(propertyName.Text())
 * 		return f.tx.Factory().NewPropertyAccessExpression(value, nil, name, ast.NodeFlagsNone)
 * 	}
 * }
 */
export function flattener_createDestructuringPropertyAccess(receiver: GoPtr<flattener>, value: GoPtr<Node>, propertyName: GoPtr<Node>): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.tx) as ConcreteNodeVisitor;
  if (IsComputedPropertyName(propertyName)) {
    const argumentExpression = flattener_ensureIdentifier(receiver, NodeVisitor_VisitNode(visitor, Node_Expression(propertyName)), false, propertyName!.Loc);
    return NewElementAccessExpression(af, value, undefined, argumentExpression, NodeFlagsNone);
  } else if (IsStringOrNumericLiteralLike(propertyName) || IsBigIntLiteral(propertyName)) {
    const coercible = { AsNodeFactory: (): typeof af => af };
    const argumentExpression = Node_Clone(propertyName, coercible);
    return NewElementAccessExpression(af, value, undefined, argumentExpression, NodeFlagsNone);
  } else {
    const name = NewIdentifier(af, Node_Text(propertyName));
    return NewPropertyAccessExpression(af, value, undefined, name, NodeFlagsNone);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.flattenDestructuringAssignment","kind":"method","status":"implemented","sigHash":"c55ab021843f64385b78c686b2213b280d1e327ba32f7753928427dacee75498","bodyHash":"8698cb2a3a8e285e0aa5bfd8f01a175a9b46dfa2eb7e4e378cb576890605f61d"}
 *
 * Go source:
 * func (f *flattener) flattenDestructuringAssignment(node *ast.Node, needsValue bool) *ast.Expression {
 * 	location := node.Loc
 * 	var value *ast.Node
 * 	if ast.IsDestructuringAssignment(node) {
 * 		value = node.AsBinaryExpression().Right
 * 		for ast.IsEmptyArrayLiteral(node.AsBinaryExpression().Left) || ast.IsEmptyObjectLiteral(node.AsBinaryExpression().Left) {
 * 			if ast.IsDestructuringAssignment(value) {
 * 				node = value
 * 				location = node.Loc
 * 				value = node.AsBinaryExpression().Right
 * 			} else {
 * 				return f.tx.Visitor().VisitNode(value)
 * 			}
 * 		}
 * 	}
 * 
 * 	if value != nil {
 * 		value = f.tx.Visitor().VisitNode(value)
 * 		if ast.IsIdentifier(value) && BindingOrAssignmentElementAssignsToName(node, value.Text()) || BindingOrAssignmentElementContainsNonLiteralComputedName(node) {
 * 			value = f.ensureIdentifier(value, false, location)
 * 		} else if needsValue {
 * 			value = f.ensureIdentifier(value, true, location)
 * 		} else if ast.NodeIsSynthesized(node) {
 * 			location = value.Loc
 * 		}
 * 	}
 * 
 * 	f.flattenBindingOrAssignmentElement(node, value, location, ast.IsDestructuringAssignment(node))
 * 
 * 	if value != nil && needsValue {
 * 		if len(f.expressions) == 0 {
 * 			return value
 * 		}
 * 		f.expressions = append(f.expressions, value)
 * 	}
 * 
 * 	res := f.tx.Factory().InlineExpressions(f.expressions)
 * 	if res != nil {
 * 		return res
 * 	}
 * 	return f.tx.Factory().NewOmittedExpression()
 * }
 */
export function flattener_flattenDestructuringAssignment(receiver: GoPtr<flattener>, node: GoPtr<Node>, needsValue: bool): GoPtr<Expression> {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  const visitor = Transformer_Visitor(receiver!.tx) as ConcreteNodeVisitor;
  let location = node!.Loc;
  let value: GoPtr<Node> = undefined;
  let currentNode = node;
  if (IsDestructuringAssignment(currentNode)) {
    value = AsBinaryExpression(currentNode)!.Right;
    while (IsEmptyArrayLiteral(AsBinaryExpression(currentNode)!.Left) || IsEmptyObjectLiteral(AsBinaryExpression(currentNode)!.Left)) {
      if (IsDestructuringAssignment(value)) {
        currentNode = value;
        location = currentNode!.Loc;
        value = AsBinaryExpression(currentNode)!.Right;
      } else {
        return NodeVisitor_VisitNode(visitor, value);
      }
    }
  }

  if (value !== undefined) {
    value = NodeVisitor_VisitNode(visitor, value);
    if (IsIdentifier(value) && BindingOrAssignmentElementAssignsToName(currentNode, Node_Text(value)) || BindingOrAssignmentElementContainsNonLiteralComputedName(currentNode)) {
      value = flattener_ensureIdentifier(receiver, value, false, location);
    } else if (needsValue) {
      value = flattener_ensureIdentifier(receiver, value, true, location);
    } else if (NodeIsSynthesized(currentNode)) {
      location = value!.Loc;
    }
  }

  flattener_flattenBindingOrAssignmentElement(receiver, currentNode, value, location, IsDestructuringAssignment(currentNode));

  if (value !== undefined && needsValue) {
    if (receiver!.expressions.length === 0) {
      return value;
    }
    receiver!.expressions = [...receiver!.expressions, value];
  }

  const res = NodeFactory_InlineExpressions(pf, receiver!.expressions);
  if (res !== undefined) {
    return res;
  }
  return NewOmittedExpression(af);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.flattenDestructuringBinding","kind":"method","status":"implemented","sigHash":"60a7d2207800fb49ccac68fbd257f065fce7ff1449f5df254c80bd0511e19b2c","bodyHash":"dcfba0684a90fce894444867f781589898999f8989d3be608a63e8dde2c7d040"}
 *
 * Go source:
 * func (f *flattener) flattenDestructuringBinding(node *ast.Node, rval *ast.Node, skipInitializer bool) *ast.Node {
 * 	if ast.IsVariableDeclaration(node) {
 * 		initializer := GetInitializerOfBindingOrAssignmentElement(node)
 * 		if initializer != nil && (ast.IsIdentifier(initializer) && BindingOrAssignmentElementAssignsToName(node, initializer.Text()) || BindingOrAssignmentElementContainsNonLiteralComputedName(node)) {
 * 			initializer = f.ensureIdentifier(f.tx.Visitor().VisitNode(initializer), false, initializer.Loc)
 * 			node = f.tx.Factory().UpdateVariableDeclaration(node.AsVariableDeclaration(), node.Name(), nil, nil, initializer)
 * 		}
 * 	}
 *
 * 	f.flattenBindingOrAssignmentElement(node, rval, node.Loc, skipInitializer)
 *
 * 	if len(f.expressions) > 0 {
 * 		temp := f.tx.Factory().NewTempVariable()
 * 		if f.hoistTempVariables {
 * 			value := f.tx.Factory().InlineExpressions(f.expressions)
 * 			f.expressions = nil
 * 			f.emitBindingOrAssignment(f, temp, value, core.TextRange{}, nil)
 * 		} else {
 * 			f.tx.EmitContext().AddVariableDeclaration(temp)
 * 			last := &f.declarations[len(f.declarations)-1]
 * 			last.pendingExpressions = append(last.pendingExpressions, f.tx.Factory().NewAssignmentExpression(temp, last.value))
 * 			last.pendingExpressions = append(last.pendingExpressions, f.expressions...)
 * 			last.value = temp
 * 		}
 * 	}
 *
 * 	decls := make([]*ast.Node, 0, len(f.declarations))
 * 	for _, pending := range f.declarations {
 * 		expr := pending.value
 * 		if len(pending.pendingExpressions) > 0 {
 * 			expr = f.tx.Factory().InlineExpressions(append(pending.pendingExpressions, pending.value))
 * 		}
 * 		decl := f.tx.Factory().NewVariableDeclaration(pending.name, nil, nil, expr)
 * 		decl.Loc = pending.location
 * 		if pending.original != nil {
 * 			f.tx.EmitContext().SetOriginal(decl, pending.original)
 * 		}
 * 		decls = append(decls, decl)
 * 	}
 * 
 * 	if len(decls) == 1 {
 * 		return decls[0]
 * 	}
 * 	if len(decls) == 0 {
 * 		return nil
 * 	}
 * 	return f.tx.Factory().NewSyntaxList(decls)
 * }
 */
export function flattener_flattenDestructuringBinding(receiver: GoPtr<flattener>, node: GoPtr<Node>, rval: GoPtr<Node>, skipInitializer: bool): GoPtr<Node> {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  const ec = Transformer_EmitContext(receiver!.tx);
  const visitor = Transformer_Visitor(receiver!.tx) as ConcreteNodeVisitor;
  let currentNode = node;
  if (IsVariableDeclaration(currentNode)) {
    const initializer = GetInitializerOfBindingOrAssignmentElement(currentNode);
    if (initializer !== undefined && (IsIdentifier(initializer) && BindingOrAssignmentElementAssignsToName(currentNode, Node_Text(initializer)) || BindingOrAssignmentElementContainsNonLiteralComputedName(currentNode))) {
      const visitedInitializer = flattener_ensureIdentifier(receiver, NodeVisitor_VisitNode(visitor, initializer), false, initializer!.Loc);
      // UpdateVariableDeclaration equivalent: NewVariableDeclaration + SetOriginal
      const updated = NewVariableDeclaration(af, Node_Name(currentNode), undefined, undefined, visitedInitializer);
      EmitContext_SetOriginal(ec, updated, currentNode);
      currentNode = updated;
    }
  }

  flattener_flattenBindingOrAssignmentElement(receiver, currentNode, rval, currentNode!.Loc, skipInitializer);

  if (receiver!.expressions.length > 0) {
    const temp = NodeFactory_NewTempVariable(pf);
    if (receiver!.hoistTempVariables) {
      const value = NodeFactory_InlineExpressions(pf, receiver!.expressions);
      receiver!.expressions = [];
      receiver!.emitBindingOrAssignment(receiver, temp, value, { pos: 0, end: 0 }, undefined);
    } else {
      EmitContext_AddVariableDeclaration(ec, temp);
      const last: pendingDecl = receiver!.declarations[receiver!.declarations.length - 1]!;
      const updatedLast: pendingDecl = {
        ...last,
        pendingExpressions: [...last.pendingExpressions, NodeFactory_NewAssignmentExpression(pf, temp, last.value), ...receiver!.expressions],
        value: temp,
      };
      receiver!.declarations = [...receiver!.declarations.slice(0, receiver!.declarations.length - 1), updatedLast];
    }
  }

  const decls: GoSlice<GoPtr<Node>> = receiver!.declarations.map((pending) => {
    const expr = pending.pendingExpressions.length > 0
      ? NodeFactory_InlineExpressions(pf, [...pending.pendingExpressions, pending.value])
      : pending.value;
    const decl = NewVariableDeclaration(af, pending.name, undefined, undefined, expr);
    decl!.Loc = pending.location;
    if (pending.original !== undefined) {
      EmitContext_SetOriginal(ec, decl, pending.original);
    }
    return decl;
  });

  if (decls.length === 1) {
    return decls[0];
  }
  if (decls.length === 0) {
    return undefined;
  }
  return NewSyntaxList(af, decls);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.flattenBindingOrAssignmentElement","kind":"method","status":"implemented","sigHash":"e090d8d51cb27a456ae30276795cbb522164e66dcfc674984cf52cb3d7aca738","bodyHash":"30860429a2fde05937ed7c18298a89bf41c09ffcfa1aa249391f668f50d5ef78"}
 *
 * Go source:
 * func (f *flattener) flattenBindingOrAssignmentElement(element *ast.Node, value *ast.Node, location core.TextRange, skipInitializer bool) {
 * 	bindingTarget := ast.GetTargetOfBindingOrAssignmentElement(element)
 * 	if bindingTarget == nil {
 * 		return
 * 	}
 * 	if !skipInitializer {
 * 		initializer := f.tx.Visitor().VisitNode(GetInitializerOfBindingOrAssignmentElement(element))
 * 		if initializer != nil {
 * 			if value != nil {
 * 				value = f.createDefaultValueCheck(value, initializer, location)
 * 				if !IsSimpleCopiableExpression(initializer) && (ast.IsBindingPattern(bindingTarget) || ast.IsAssignmentPattern(bindingTarget)) {
 * 					value = f.ensureIdentifier(value, true, location)
 * 				}
 * 			} else {
 * 				value = initializer
 * 			}
 * 		} else if value == nil {
 * 			value = f.tx.Factory().NewVoidZeroExpression()
 * 		}
 * 	}
 * 
 * 	if isObjectBindingOrAssignmentPattern(bindingTarget) {
 * 		f.flattenObjectBindingOrAssignmentPattern(element, bindingTarget, value, location)
 * 	} else if isArrayBindingOrAssignmentPattern(bindingTarget) {
 * 		f.flattenArrayBindingOrAssignmentPattern(element, bindingTarget, value, location)
 * 	} else {
 * 		f.emitBindingOrAssignment(f, bindingTarget, value, location, element)
 * 	}
 * }
 */
export function flattener_flattenBindingOrAssignmentElement(receiver: GoPtr<flattener>, element: GoPtr<Node>, value: GoPtr<Node>, location: TextRange, skipInitializer: bool): void {
  const pf = Transformer_Factory(receiver!.tx)!;
  const visitor = Transformer_Visitor(receiver!.tx) as ConcreteNodeVisitor;
  const bindingTarget = GetTargetOfBindingOrAssignmentElement(element);
  if (bindingTarget === undefined) {
    return;
  }
  let currentValue = value;
  if (!skipInitializer) {
    const initializer = NodeVisitor_VisitNode(visitor, GetInitializerOfBindingOrAssignmentElement(element));
    if (initializer !== undefined) {
      if (currentValue !== undefined) {
        currentValue = flattener_createDefaultValueCheck(receiver, currentValue, initializer, location);
        if (!IsSimpleCopiableExpression(initializer) && (IsBindingPattern(bindingTarget) || IsAssignmentPattern(bindingTarget))) {
          currentValue = flattener_ensureIdentifier(receiver, currentValue, true, location);
        }
      } else {
        currentValue = initializer;
      }
    } else if (currentValue === undefined) {
      currentValue = NodeFactory_NewVoidZeroExpression(pf);
    }
  }

  if (isObjectBindingOrAssignmentPattern(bindingTarget)) {
    flattener_flattenObjectBindingOrAssignmentPattern(receiver, element, bindingTarget, currentValue, location);
  } else if (isArrayBindingOrAssignmentPattern(bindingTarget)) {
    flattener_flattenArrayBindingOrAssignmentPattern(receiver, element, bindingTarget, currentValue, location);
  } else {
    receiver!.emitBindingOrAssignment(receiver, bindingTarget, currentValue, location, element);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.flattenObjectBindingOrAssignmentPattern","kind":"method","status":"implemented","sigHash":"963f724a8aabdcfdc6fcb26cdd94e676190c481af709a61b0f4507169b3d3fb3","bodyHash":"bca6b6581a0656a774c91c24ded7ad7395dcc28592d116a048c44ed0bf54c5ba"}
 *
 * Go source:
 * func (f *flattener) flattenObjectBindingOrAssignmentPattern(parent *ast.Node, pattern *ast.Node, value *ast.Node, location core.TextRange) {
 * 	elements := ast.GetElementsOfBindingOrAssignmentPattern(pattern)
 * 	numElements := len(elements)
 * 	if numElements != 1 {
 * 		reuseIdentifierExpressions := !ast.IsDeclarationBindingElement(parent) || numElements != 0
 * 		value = f.ensureIdentifier(value, reuseIdentifierExpressions, location)
 * 	}
 * 	var bindingElements []*ast.Node
 * 	var computedTempVariables []*ast.Node
 * 	for i, element := range elements {
 * 		if ast.GetRestIndicatorOfBindingOrAssignmentElement(element) == nil {
 * 			propertyName := ast.TryGetPropertyNameOfBindingOrAssignmentElement(element)
 * 			if f.level >= FlattenLevelObjectRest &&
 * 				element.SubtreeFacts()&(ast.SubtreeContainsRestOrSpread|ast.SubtreeContainsObjectRestOrSpread) == 0 &&
 * 				ast.GetTargetOfBindingOrAssignmentElement(element).SubtreeFacts()&(ast.SubtreeContainsRestOrSpread|ast.SubtreeContainsObjectRestOrSpread) == 0 &&
 * 				!ast.IsComputedPropertyName(propertyName) {
 * 				bindingElements = append(bindingElements, f.tx.Visitor().VisitNode(element))
 * 			} else {
 * 				if len(bindingElements) > 0 {
 * 					f.emitBindingOrAssignment(f, f.createObjectBindingOrAssignmentPattern(f, bindingElements), value, location, pattern)
 * 					bindingElements = nil
 * 				}
 * 				rhsValue := f.createDestructuringPropertyAccess(value, propertyName)
 * 				if ast.IsComputedPropertyName(propertyName) {
 * 					computedTempVariables = append(computedTempVariables, rhsValue.AsElementAccessExpression().ArgumentExpression)
 * 				}
 * 				f.flattenBindingOrAssignmentElement(element, rhsValue, element.Loc, false)
 * 			}
 * 		} else if i == numElements-1 {
 * 			if len(bindingElements) > 0 {
 * 				f.emitBindingOrAssignment(f, f.createObjectBindingOrAssignmentPattern(f, bindingElements), value, location, pattern)
 * 				bindingElements = nil
 * 			}
 * 			rhsValue := f.tx.Factory().NewRestHelper(value, elements, computedTempVariables, pattern.Loc)
 * 			f.flattenBindingOrAssignmentElement(element, rhsValue, element.Loc, false)
 * 		}
 * 	}
 * 	if len(bindingElements) > 0 {
 * 		f.emitBindingOrAssignment(f, f.createObjectBindingOrAssignmentPattern(f, bindingElements), value, location, pattern)
 * 	}
 * }
 */
export function flattener_flattenObjectBindingOrAssignmentPattern(receiver: GoPtr<flattener>, parent: GoPtr<Node>, pattern: GoPtr<Node>, value: GoPtr<Node>, location: TextRange): void {
  const pf = Transformer_Factory(receiver!.tx)!;
  const visitor = Transformer_Visitor(receiver!.tx) as ConcreteNodeVisitor;
  const elements = GetElementsOfBindingOrAssignmentPattern(pattern);
  const numElements = elements.length;
  let currentValue = value;
  if (numElements !== 1) {
    const reuseIdentifierExpressions = !IsDeclarationBindingElement(parent) || numElements !== 0;
    currentValue = flattener_ensureIdentifier(receiver, currentValue, reuseIdentifierExpressions, location);
  }
  let bindingElements: GoSlice<GoPtr<Node>> = [];
  let computedTempVariables: GoSlice<GoPtr<Node>> = [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (GetRestIndicatorOfBindingOrAssignmentElement(element) === undefined) {
      const propertyName = TryGetPropertyNameOfBindingOrAssignmentElement(element);
      if (
        receiver!.level >= FlattenLevelObjectRest &&
        (Node_SubtreeFacts(element) & (SubtreeContainsRestOrSpread | SubtreeContainsObjectRestOrSpread)) === 0 &&
        (Node_SubtreeFacts(GetTargetOfBindingOrAssignmentElement(element)!) & (SubtreeContainsRestOrSpread | SubtreeContainsObjectRestOrSpread)) === 0 &&
        !IsComputedPropertyName(propertyName)
      ) {
        bindingElements = [...bindingElements, NodeVisitor_VisitNode(visitor, element)];
      } else {
        if (bindingElements.length > 0) {
          receiver!.emitBindingOrAssignment(receiver, receiver!.createObjectBindingOrAssignmentPattern(receiver, bindingElements), currentValue, location, pattern);
          bindingElements = [];
        }
        const rhsValue = flattener_createDestructuringPropertyAccess(receiver, currentValue, propertyName!);
        if (IsComputedPropertyName(propertyName)) {
          computedTempVariables = [...computedTempVariables, AsElementAccessExpression(rhsValue)!.ArgumentExpression!];
        }
        flattener_flattenBindingOrAssignmentElement(receiver, element, rhsValue, element!.Loc, false);
      }
    } else if (i === numElements - 1) {
      if (bindingElements.length > 0) {
        receiver!.emitBindingOrAssignment(receiver, receiver!.createObjectBindingOrAssignmentPattern(receiver, bindingElements), currentValue, location, pattern);
        bindingElements = [];
      }
      const rhsValue = NodeFactory_NewRestHelper(pf, currentValue, elements, computedTempVariables, pattern!.Loc);
      flattener_flattenBindingOrAssignmentElement(receiver, element, rhsValue, element!.Loc, false);
    }
  }
  if (bindingElements.length > 0) {
    receiver!.emitBindingOrAssignment(receiver, receiver!.createObjectBindingOrAssignmentPattern(receiver, bindingElements), currentValue, location, pattern);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::type::restIdElemPair","kind":"type","status":"implemented","sigHash":"e42745ebf0c2f187123b09511c377710f88c72fc60800b27ef0b11b3d9b3d34c","bodyHash":"337b5a8e53a2e61de92749c30bdb946c739926955e6b4113093cfa5f7f7abade"}
 *
 * Go source:
 * restIdElemPair struct {
 * 	id      *ast.Node
 * 	element *ast.Node
 * }
 */
export interface restIdElemPair {
  id: GoPtr<Node>;
  element: GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::method::flattener.flattenArrayBindingOrAssignmentPattern","kind":"method","status":"implemented","sigHash":"109563b0c9c134bb07e2b6bdc3a933d2b3adff16cadc2ac546c0ff7fb69f98c1","bodyHash":"80c430d30fdb244e51ae402bac97993477b5a49a0df4f0a84f939167961d6203"}
 *
 * Go source:
 * func (f *flattener) flattenArrayBindingOrAssignmentPattern(parent *ast.Node, pattern *ast.Node, value *ast.Node, location core.TextRange) {
 * 	elements := ast.GetElementsOfBindingOrAssignmentPattern(pattern)
 * 	numElements := len(elements)
 * 	if numElements != 1 && (f.level < FlattenLevelObjectRest || numElements == 0) || core.Every(elements, ast.IsOmittedExpression) {
 * 		reuseIdentifierExpressions := !ast.IsDeclarationBindingElement(parent) || numElements != 0
 * 		value = f.ensureIdentifier(value, reuseIdentifierExpressions, location)
 * 	}
 * 	var bindingElements []*ast.Node
 * 	var restContainingElements []restIdElemPair
 * 	for i, element := range elements {
 * 		if f.level >= FlattenLevelObjectRest {
 * 			if element.SubtreeFacts()&ast.SubtreeContainsObjectRestOrSpread != 0 || f.hasTransformedPriorElement && !isSimpleBindingOrAssignmentElement(element) {
 * 				f.hasTransformedPriorElement = true
 * 				temp := f.tx.Factory().NewTempVariable()
 * 				if f.hoistTempVariables {
 * 					f.tx.EmitContext().AddVariableDeclaration(temp)
 * 				}
 * 				restContainingElements = append(restContainingElements, restIdElemPair{temp, element})
 * 				bindingElements = append(bindingElements, f.createArrayBindingOrAssignmentElement(f, temp))
 * 			} else {
 * 				bindingElements = append(bindingElements, element)
 * 			}
 * 		} else if ast.IsOmittedExpression(element) {
 * 			continue
 * 		} else if ast.GetRestIndicatorOfBindingOrAssignmentElement(element) == nil {
 * 			rhsValue := f.tx.Factory().NewElementAccessExpression(value, nil, f.tx.Factory().NewNumericLiteral(strconv.Itoa(i), ast.TokenFlagsNone), ast.NodeFlagsNone)
 * 			f.flattenBindingOrAssignmentElement(element, rhsValue, element.Loc, false)
 * 		} else if i == numElements-1 {
 * 			rhsValue := f.tx.Factory().NewArraySliceCall(value, i)
 * 			f.flattenBindingOrAssignmentElement(element, rhsValue, element.Loc, false)
 * 		}
 * 	}
 * 	if len(bindingElements) > 0 {
 * 		f.emitBindingOrAssignment(f, f.createArrayBindingOrAssignmentPattern(f, bindingElements), value, location, pattern)
 * 	}
 * 	if len(restContainingElements) > 0 {
 * 		for _, pair := range restContainingElements {
 * 			f.flattenBindingOrAssignmentElement(pair.element, pair.id, pair.element.Loc, false)
 * 		}
 * 	}
 * }
 */
export function flattener_flattenArrayBindingOrAssignmentPattern(receiver: GoPtr<flattener>, parent: GoPtr<Node>, pattern: GoPtr<Node>, value: GoPtr<Node>, location: TextRange): void {
  const pf = Transformer_Factory(receiver!.tx)!;
  const af = pf.__tsgoEmbedded0!;
  const elements = GetElementsOfBindingOrAssignmentPattern(pattern);
  const numElements = elements.length;
  let currentValue = value;
  if ((numElements !== 1 && (receiver!.level < FlattenLevelObjectRest || numElements === 0)) || Every(elements, IsOmittedExpression)) {
    const reuseIdentifierExpressions = !IsDeclarationBindingElement(parent) || numElements !== 0;
    currentValue = flattener_ensureIdentifier(receiver, currentValue, reuseIdentifierExpressions, location);
  }
  let bindingElements: GoSlice<GoPtr<Node>> = [];
  let restContainingElements: GoSlice<restIdElemPair> = [];
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (receiver!.level >= FlattenLevelObjectRest) {
      if ((Node_SubtreeFacts(element) & SubtreeContainsObjectRestOrSpread) !== 0 || receiver!.hasTransformedPriorElement && !isSimpleBindingOrAssignmentElement(element)) {
        receiver!.hasTransformedPriorElement = true;
        const temp = NodeFactory_NewTempVariable(pf);
        if (receiver!.hoistTempVariables) {
          EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.tx), temp);
        }
        restContainingElements = [...restContainingElements, { id: temp, element }];
        bindingElements = [...bindingElements, receiver!.createArrayBindingOrAssignmentElement(receiver, temp)];
      } else {
        bindingElements = [...bindingElements, element];
      }
    } else if (IsOmittedExpression(element)) {
      continue;
    } else if (GetRestIndicatorOfBindingOrAssignmentElement(element) === undefined) {
      const rhsValue = NewElementAccessExpression(af, currentValue, undefined, NewNumericLiteral(af, Itoa(i), TokenFlagsNone), NodeFlagsNone);
      flattener_flattenBindingOrAssignmentElement(receiver, element, rhsValue, element!.Loc, false);
    } else if (i === numElements - 1) {
      const rhsValue = NodeFactory_NewArraySliceCall(pf, currentValue, i);
      flattener_flattenBindingOrAssignmentElement(receiver, element, rhsValue, element!.Loc, false);
    }
  }
  if (bindingElements.length > 0) {
    receiver!.emitBindingOrAssignment(receiver, receiver!.createArrayBindingOrAssignmentPattern(receiver, bindingElements), currentValue, location, pattern);
  }
  if (restContainingElements.length > 0) {
    for (const pair of restContainingElements) {
      flattener_flattenBindingOrAssignmentElement(receiver, pair.element, pair.id, pair.element!.Loc, false);
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::BindingOrAssignmentElementAssignsToName","kind":"func","status":"implemented","sigHash":"6f73be577156b69a6faa13dc1dcbbc7d5170fc5d3377baa5891bf4d5368d50a2","bodyHash":"c1805009ca944ee55516938fe55338aaf7cdeff312993cef8f9beeeb00740f00"}
 *
 * Go source:
 * func BindingOrAssignmentElementAssignsToName(element *ast.Node, name string) bool {
 * 	target := ast.GetTargetOfBindingOrAssignmentElement(element)
 * 	if target == nil {
 * 		return false
 * 	}
 * 	if ast.IsBindingPattern(target) || ast.IsAssignmentPattern(target) {
 * 		return bindingOrAssignmentPatternAssignsToName(target, name)
 * 	} else if ast.IsIdentifier(target) {
 * 		return target.Text() == name
 * 	}
 * 	return false
 * }
 */
export function BindingOrAssignmentElementAssignsToName(element: GoPtr<Node>, name: string): bool {
  const target = GetTargetOfBindingOrAssignmentElement(element);
  if (target === undefined) {
    return false;
  }
  if (IsBindingPattern(target) || IsAssignmentPattern(target)) {
    return bindingOrAssignmentPatternAssignsToName(target, name);
  } else if (IsIdentifier(target)) {
    return Node_Text(target) === name;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::bindingOrAssignmentPatternAssignsToName","kind":"func","status":"implemented","sigHash":"2ae659ba69298ba968b0a952a57d64c10ac124fe1cf4db2173f89c810e7e3a17","bodyHash":"4934be72adc8bfbaba054b05f2615bfb0c524be286161bd791bdeb6b551985f9"}
 *
 * Go source:
 * func bindingOrAssignmentPatternAssignsToName(pattern *ast.Node, name string) bool {
 * 	elements := ast.GetElementsOfBindingOrAssignmentPattern(pattern)
 * 	for _, element := range elements {
 * 		if BindingOrAssignmentElementAssignsToName(element, name) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function bindingOrAssignmentPatternAssignsToName(pattern: GoPtr<Node>, name: string): bool {
  const elements = GetElementsOfBindingOrAssignmentPattern(pattern);
  for (const element of elements) {
    if (BindingOrAssignmentElementAssignsToName(element, name)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::BindingOrAssignmentElementContainsNonLiteralComputedName","kind":"func","status":"implemented","sigHash":"52a3fa18f72a90e72fb754e1b9cd691b77239bd2ee19fa6e5e0001d8d6b34ae4","bodyHash":"5e471bea56aae71e5a7f918e9fabf4834481866ac22db351b98c3af709d9449d"}
 *
 * Go source:
 * func BindingOrAssignmentElementContainsNonLiteralComputedName(element *ast.Node) bool {
 * 	propertyName := ast.TryGetPropertyNameOfBindingOrAssignmentElement(element)
 * 	if propertyName != nil && ast.IsComputedPropertyName(propertyName) && !ast.IsLiteralExpression(propertyName.Expression()) {
 * 		return true
 * 	}
 * 	target := ast.GetTargetOfBindingOrAssignmentElement(element)
 * 	return target != nil && (ast.IsBindingPattern(target) || ast.IsAssignmentPattern(target)) && bindingOrAssignmentPatternContainsNonLiteralComputedName(target)
 * }
 */
export function BindingOrAssignmentElementContainsNonLiteralComputedName(element: GoPtr<Node>): bool {
  const propertyName = TryGetPropertyNameOfBindingOrAssignmentElement(element);
  if (propertyName !== undefined && IsComputedPropertyName(propertyName) && !IsLiteralExpression(Node_Expression(propertyName))) {
    return true;
  }
  const target = GetTargetOfBindingOrAssignmentElement(element);
  return target !== undefined && (IsBindingPattern(target) || IsAssignmentPattern(target)) && bindingOrAssignmentPatternContainsNonLiteralComputedName(target);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::bindingOrAssignmentPatternContainsNonLiteralComputedName","kind":"func","status":"implemented","sigHash":"2fb8fe7375cda0dbeb4c5d5476020eb5c5b23cf458ce06b6ae15c6dbd699f2dd","bodyHash":"0adfa3cf090ddc8c634da337a78784e2a4e9f2bbb1487fbcfe63eba4eebc5f21"}
 *
 * Go source:
 * func bindingOrAssignmentPatternContainsNonLiteralComputedName(pattern *ast.Node) bool {
 * 	elements := ast.GetElementsOfBindingOrAssignmentPattern(pattern)
 * 	return slices.ContainsFunc(elements, BindingOrAssignmentElementContainsNonLiteralComputedName)
 * }
 */
export function bindingOrAssignmentPatternContainsNonLiteralComputedName(pattern: GoPtr<Node>): bool {
  const elements = GetElementsOfBindingOrAssignmentPattern(pattern);
  return elements.some(BindingOrAssignmentElementContainsNonLiteralComputedName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::GetInitializerOfBindingOrAssignmentElement","kind":"func","status":"implemented","sigHash":"2fb9546edc99ea6b0b162bd752e6fdf7418d512fcd7711943eb80b110b461050","bodyHash":"a130daf852be1ff3426ca6c03d8b73fb8c48af4ef1b0d90683389304645ee80f"}
 *
 * Go source:
 * func GetInitializerOfBindingOrAssignmentElement(bindingElement *ast.Node) *ast.Node {
 * 	if bindingElement == nil {
 * 		return nil
 * 	}
 * 	if ast.IsDeclarationBindingElement(bindingElement) {
 * 		return bindingElement.Initializer()
 * 	}
 * 	if ast.IsPropertyAssignment(bindingElement) {
 * 		initializer := bindingElement.Initializer()
 * 		if ast.IsAssignmentExpression(initializer, true) {
 * 			return initializer.AsBinaryExpression().Right
 * 		}
 * 		return nil
 * 	}
 * 	if ast.IsShorthandPropertyAssignment(bindingElement) {
 * 		return bindingElement.AsShorthandPropertyAssignment().ObjectAssignmentInitializer
 * 	}
 * 	if ast.IsAssignmentExpression(bindingElement, true) {
 * 		return bindingElement.AsBinaryExpression().Right
 * 	}
 * 	if ast.IsSpreadElement(bindingElement) {
 * 		return GetInitializerOfBindingOrAssignmentElement(bindingElement.Expression())
 * 	}
 * 	return nil
 * }
 */
export function GetInitializerOfBindingOrAssignmentElement(bindingElement: GoPtr<Node>): GoPtr<Node> {
  if (bindingElement === undefined) {
    return undefined;
  }
  if (IsDeclarationBindingElement(bindingElement)) {
    return Node_Initializer(bindingElement);
  }
  if (IsPropertyAssignment(bindingElement)) {
    const initializer = Node_Initializer(bindingElement);
    if (IsAssignmentExpression(initializer, true)) {
      return AsBinaryExpression(initializer)!.Right;
    }
    return undefined;
  }
  if (IsShorthandPropertyAssignment(bindingElement)) {
    return AsShorthandPropertyAssignment(bindingElement)!.ObjectAssignmentInitializer;
  }
  if (IsAssignmentExpression(bindingElement, true)) {
    return AsBinaryExpression(bindingElement)!.Right;
  }
  if (IsSpreadElement(bindingElement)) {
    return GetInitializerOfBindingOrAssignmentElement(Node_Expression(bindingElement));
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::isObjectBindingOrAssignmentPattern","kind":"func","status":"implemented","sigHash":"3ae1a19a7cb06ac003bc2aaf1e9845f72c5600f0c49276b4d2b9f4522506431d","bodyHash":"761b43b2c76fee2fe0f7b7039462bd0cdee9429039eec3b091e59eba8f253865"}
 *
 * Go source:
 * func isObjectBindingOrAssignmentPattern(node *ast.Node) bool {
 * 	return node != nil && (node.Kind == ast.KindObjectBindingPattern || node.Kind == ast.KindObjectLiteralExpression)
 * }
 */
export function isObjectBindingOrAssignmentPattern(node: GoPtr<Node>): bool {
  return node !== undefined && (node.Kind === KindObjectBindingPattern || node.Kind === KindObjectLiteralExpression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::isArrayBindingOrAssignmentPattern","kind":"func","status":"implemented","sigHash":"cc1a96404b6fc47d10a8fb702925d0deba3205741dc4ec82faad8738a92745d4","bodyHash":"fb12a5c1cc1fc6e77c2353d5fc87772ce22835e81b789af678c46889082ecf4a"}
 *
 * Go source:
 * func isArrayBindingOrAssignmentPattern(node *ast.Node) bool {
 * 	return node != nil && (node.Kind == ast.KindArrayBindingPattern || node.Kind == ast.KindArrayLiteralExpression)
 * }
 */
export function isArrayBindingOrAssignmentPattern(node: GoPtr<Node>): bool {
  return node !== undefined && (node.Kind === KindArrayBindingPattern || node.Kind === KindArrayLiteralExpression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/destructuring.go::func::isSimpleBindingOrAssignmentElement","kind":"func","status":"implemented","sigHash":"03cadb93a37f3f896c3a83b5ea8fdda973be404b7ecda0daccb06ef64a37a96e","bodyHash":"18680dfeba202deda8cc4f8aa11a40340b322510dab8c6b9184b726713c59816"}
 *
 * Go source:
 * func isSimpleBindingOrAssignmentElement(element *ast.Node) bool {
 * 	target := ast.GetTargetOfBindingOrAssignmentElement(element)
 * 	if target == nil || ast.IsOmittedExpression(target) {
 * 		return true
 * 	}
 * 	propertyName := ast.TryGetPropertyNameOfBindingOrAssignmentElement(element)
 * 	if propertyName != nil && !ast.IsPropertyNameLiteral(propertyName) {
 * 		return false
 * 	}
 * 	initializer := GetInitializerOfBindingOrAssignmentElement(element)
 * 	if initializer != nil && !IsSimpleInlineableExpression(initializer) {
 * 		return false
 * 	}
 * 	if ast.IsBindingPattern(target) || ast.IsAssignmentPattern(target) {
 * 		return core.Every(ast.GetElementsOfBindingOrAssignmentPattern(target), isSimpleBindingOrAssignmentElement)
 * 	}
 * 	return ast.IsIdentifier(target)
 * }
 */
export function isSimpleBindingOrAssignmentElement(element: GoPtr<Node>): bool {
  const target = GetTargetOfBindingOrAssignmentElement(element);
  if (target === undefined || IsOmittedExpression(target)) {
    return true;
  }
  const propertyName = TryGetPropertyNameOfBindingOrAssignmentElement(element);
  if (propertyName !== undefined && !IsPropertyNameLiteral(propertyName)) {
    return false;
  }
  const initializer = GetInitializerOfBindingOrAssignmentElement(element);
  if (initializer !== undefined && !IsSimpleInlineableExpression(initializer)) {
    return false;
  }
  if (IsBindingPattern(target) || IsAssignmentPattern(target)) {
    return Every(GetElementsOfBindingOrAssignmentPattern(target), isSimpleBindingOrAssignmentElement);
  }
  return IsIdentifier(target);
}
