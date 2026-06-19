import type { GoPtr, GoSlice } from "../../go/compat.js";
import { CopyOnWriteMap_EnterScope, CopyOnWriteSet_EnterScope } from "../collections/cow.js";
import type { Node } from "../ast/spine.js";
import { NodeFactory_NewNodeList, Node_LocalsContainerData, Node_Name } from "../ast/spine.js";
import type { Symbol, SymbolTable } from "../ast/symbol.js";
import { Node_Elements } from "../ast/ast.js";
import { NewBlock } from "../ast/generated/factory.js";
import { IsBindingElement, IsBlock, IsOmittedExpression, IsParameterDeclaration } from "../ast/generated/predicates.js";
import { GetLocals, GetSymbolId, IsBindingPattern } from "../ast/utilities.js";
import { Some } from "../core/core.js";
import { LinkStore_Get, LinkStore_Has } from "../core/linkstore.js";
import type { LinkStore } from "../core/linkstore.js";
import { Assert } from "../debug/debug.js";
import { FlagsGenerateNamesForShadowedTypeParams } from "../nodebuilder/types.js";
import { Checker_getExpandedParameters, NodeBuilderImpl_typeParameterToName } from "./nodebuilderimpl.js";
import type { TypeMapper } from "./mapper.js";
import type { NodeBuilderContext, NodeBuilderImpl, NodeBuilderLinks } from "./nodebuilderimpl.js";
import { Checker_getSymbolOfDeclaration } from "./checker/symbols.js";
import type { Signature, Type } from "./types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderscopes.go::func::cloneNodeBuilderContext","kind":"func","status":"implemented","sigHash":"cef5cfcbd3fe93c77a553213fca509928f8bb4ea24a9c34c720f8900e0675e8b","bodyHash":"9c908b5249db817bb567a98ee8eedc1a1695e9b9951eccdef7ac08289701fe98"}
 *
 * Go source:
 * func cloneNodeBuilderContext(context *NodeBuilderContext) func() {
 * 	// Make type parameters created within this context not consume the name outside this context
 * 	// The symbol serializer ends up creating many sibling scopes that all need "separate" contexts when
 * 	// it comes to naming things - within a normal `typeToTypeNode` call, the node builder only ever descends
 * 	// through the type tree, so the only cases where we could have used distinct sibling scopes was when there
 * 	// were multiple generic overloads with similar generated type parameter names
 * 	// The effect:
 * 	// When we write out
 * 	// export const x: <T>(x: T) => T
 * 	// export const y: <T>(x: T) => T
 * 	// we write it out like that, rather than as
 * 	// export const x: <T>(x: T) => T
 * 	// export const y: <T_1>(x: T_1) => T_1
 * 	restoreNames := context.typeParameterNames.EnterScope()
 * 	restoreNamesByText := context.typeParameterNamesByText.EnterScope()
 * 	restoreNamesByTextNextNameCount := context.typeParameterNamesByTextNextNameCount.EnterScope()
 * 	restoreSymbolList := context.typeParameterSymbolList.EnterScope()
 * 	return func() {
 * 		restoreNames()
 * 		restoreNamesByText()
 * 		restoreNamesByTextNextNameCount()
 * 		restoreSymbolList()
 * 	}
 * }
 */
export function cloneNodeBuilderContext(context: GoPtr<NodeBuilderContext>): () => void {
  // Make type parameters created within this context not consume the name outside this context
  // The symbol serializer ends up creating many sibling scopes that all need "separate" contexts when
  // it comes to naming things - within a normal `typeToTypeNode` call, the node builder only ever descends
  // through the type tree, so the only cases where we could have used distinct sibling scopes was when there
  // were multiple generic overloads with similar generated type parameter names
  // The effect:
  // When we write out
  // export const x: <T>(x: T) => T
  // export const y: <T>(x: T) => T
  // we write it out like that, rather than as
  // export const x: <T>(x: T) => T
  // export const y: <T_1>(x: T_1) => T_1
  const restoreNames = CopyOnWriteMap_EnterScope(context!.typeParameterNames);
  const restoreNamesByText = CopyOnWriteSet_EnterScope(context!.typeParameterNamesByText);
  const restoreNamesByTextNextNameCount = CopyOnWriteMap_EnterScope(context!.typeParameterNamesByTextNextNameCount);
  const restoreSymbolList = CopyOnWriteSet_EnterScope(context!.typeParameterSymbolList);
  return () => {
    restoreNames();
    restoreNamesByText();
    restoreNamesByTextNextNameCount();
    restoreSymbolList();
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderscopes.go::type::localsRecord","kind":"type","status":"implemented","sigHash":"1dbbda6a9119188d46c1f6697fcee4075ce71e96b4da79b09a5dcd1b9e271778","bodyHash":"36e145be0fdba1cdbe18b39648ccaa362220912d66ff290e903c6e1b706ac5df"}
 *
 * Go source:
 * localsRecord struct {
 * 	name      string
 * 	oldSymbol *ast.Symbol
 * }
 */
export interface localsRecord {
  name: string;
  oldSymbol: GoPtr<Symbol>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderscopes.go::method::NodeBuilderImpl.addSymbolTypeToContext","kind":"method","status":"implemented","sigHash":"d81fae3d81b46d304d217ab5d786f064938b5f9790df2004ea454767f402d314","bodyHash":"96f87004af2b2cc665b918dafa2610436d8ccdd90938213b4ac9177dc8475cde"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) addSymbolTypeToContext(symbol *ast.Symbol, t *Type) func() {
 * 	id := ast.GetSymbolId(symbol)
 * 	oldType, oldTypeExists := b.ctx.enclosingSymbolTypes[id]
 * 	b.ctx.enclosingSymbolTypes[id] = t
 * 	return func() {
 * 		if oldTypeExists {
 * 			b.ctx.enclosingSymbolTypes[id] = oldType
 * 		} else {
 * 			delete(b.ctx.enclosingSymbolTypes, id)
 * 		}
 * 	}
 * }
 */
export function NodeBuilderImpl_addSymbolTypeToContext(receiver: GoPtr<NodeBuilderImpl>, symbol_: GoPtr<Symbol>, t: GoPtr<Type>): () => void {
  const id = GetSymbolId(symbol_);
  const oldType = receiver!.ctx!.enclosingSymbolTypes.get(id);
  const oldTypeExists = receiver!.ctx!.enclosingSymbolTypes.has(id);
  receiver!.ctx!.enclosingSymbolTypes.set(id, t);
  return () => {
    if (oldTypeExists) {
      receiver!.ctx!.enclosingSymbolTypes.set(id, oldType);
    } else {
      receiver!.ctx!.enclosingSymbolTypes.delete(id);
    }
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderscopes.go::method::NodeBuilderImpl.enterSignatureScope","kind":"method","status":"implemented","sigHash":"4dd663e272f9787e14fd75df9f7cf5129dca8e1a96a5df4974eeda07ca9c6153","bodyHash":"271e053f57dcfd7b90c0eea2c5b67e8ecb5d2c0cd8535fb118194a9ad1ff5d22"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) enterSignatureScope(signature *Signature) (expandedParams []*ast.Symbol, cleanup func()) {
 * 	expandedParams = b.ch.getExpandedParameters(signature, true /*skipUnionExpanding* /)[0]
 * 	cleanup = b.enterNewScope(signature.declaration, expandedParams, signature.typeParameters, signature.parameters, signature.mapper)
 * 	return expandedParams, cleanup
 * }
 */
export function NodeBuilderImpl_enterSignatureScope(receiver: GoPtr<NodeBuilderImpl>, signature: GoPtr<Signature>): [GoSlice<GoPtr<Symbol>>, () => void] {
  const expandedParams = Checker_getExpandedParameters(receiver!.ch, signature, true)[0] ?? [];
  const cleanup = NodeBuilderImpl_enterNewScope(receiver, signature!.declaration, expandedParams, signature!.typeParameters, signature!.parameters, signature!.mapper);
  return [expandedParams, cleanup];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/nodebuilderscopes.go::method::NodeBuilderImpl.enterNewScope","kind":"method","status":"implemented","sigHash":"ad1edc80279b80f281d3d602714e955be116084433c938c9e2907f8b9cbd17d3","bodyHash":"c7947b0779ab649989991df42e5526563e78aca33b6d38b7a67fc2c1da8abf4b"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) enterNewScope(declaration *ast.Node, expandedParams []*ast.Symbol, typeParameters []*Type, originalParameters []*ast.Symbol, mapper *TypeMapper) func() {
 * 	cleanupContext := cloneNodeBuilderContext(b.ctx)
 * 	// For regular function/method declarations, the enclosing declaration will already be signature.declaration,
 * 	// so this is a no-op, but for arrow functions and function expressions, the enclosing declaration will be
 * 	// the declaration that the arrow function / function expression is assigned to.
 * 	//
 * 	// If the parameters or return type include "typeof globalThis.paramName", using the wrong scope will lead
 * 	// us to believe that we can emit "typeof paramName" instead, even though that would refer to the parameter,
 * 	// not the global. Make sure we are in the right scope by changing the enclosingDeclaration to the function.
 * 	//
 * 	// We can't use the declaration directly; it may be in another file and so we may lose access to symbols
 * 	// accessible to the current enclosing declaration, or gain access to symbols not accessible to the current
 * 	// enclosing declaration. To keep this chain accurate, insert a fake scope into the chain which makes the
 * 	// function's parameters visible.
 * 	var cleanupParams func()
 * 	var cleanupTypeParams func()
 * 	oldEnclosingDecl := b.ctx.enclosingDeclaration
 * 	oldMapper := b.ctx.mapper
 * 	if mapper != nil {
 * 		b.ctx.mapper = mapper
 * 	}
 * 	if b.ctx.enclosingDeclaration != nil && declaration != nil {
 * 		// As a performance optimization, reuse the same fake scope within this chain.
 * 		// This is especially needed when we are working on an excessively deep type;
 * 		// if we don't do this, then we spend all of our time adding more and more
 * 		// scopes that need to be searched in isSymbolAccessible later. Since all we
 * 		// really want to do is to mark certain names as unavailable, we can just keep
 * 		// all of the names we're introducing in one large table and push/pop from it as
 * 		// needed; isSymbolAccessible will walk upward and find the closest "fake" scope,
 * 		// which will conveniently report on any and all faked scopes in the chain.
 * 		//
 * 		// It'd likely be better to store this somewhere else for isSymbolAccessible, but
 * 		// since that API _only_ uses the enclosing declaration (and its parents), this is
 * 		// seems like the best way to inject names into that search process.
 * 		//
 * 		// Note that we only check the most immediate enclosingDeclaration; the only place we
 * 		// could potentially add another fake scope into the chain is right here, so we don't
 * 		// traverse all ancestors.
 * 		pushFakeScope := func(kind string, addAll func(addSymbol func(name string, symbol *ast.Symbol))) func() {
 * 			// We only ever need to look two declarations upward.
 * 			debug.Assert(b.ctx.enclosingDeclaration != nil)
 * 			var existingFakeScope *ast.Node
 * 			if b.links.Has(b.ctx.enclosingDeclaration) {
 * 				links := b.links.Get(b.ctx.enclosingDeclaration)
 * 				if links.fakeScopeForSignatureDeclaration != nil && *links.fakeScopeForSignatureDeclaration == kind {
 * 					existingFakeScope = b.ctx.enclosingDeclaration
 * 				}
 * 			}
 * 			if existingFakeScope == nil && b.ctx.enclosingDeclaration.Parent != nil {
 * 				if b.links.Has(b.ctx.enclosingDeclaration.Parent) {
 * 					links := b.links.Get(b.ctx.enclosingDeclaration.Parent)
 * 					if links.fakeScopeForSignatureDeclaration != nil && *links.fakeScopeForSignatureDeclaration == kind {
 * 						existingFakeScope = b.ctx.enclosingDeclaration.Parent
 * 					}
 * 				}
 * 			}
 * 			debug.Assert(existingFakeScope == nil || ast.IsBlock(existingFakeScope))
 * 
 * 			var locals ast.SymbolTable
 * 			if existingFakeScope != nil {
 * 				locals = existingFakeScope.Locals()
 * 			}
 * 			if locals == nil {
 * 				locals = make(ast.SymbolTable)
 * 			}
 * 			newLocals := []string{}
 * 			oldLocals := []localsRecord{}
 * 			addAll(func(name string, symbol *ast.Symbol) {
 * 				// Add cleanup information only if we don't own the fake scope
 * 				if existingFakeScope != nil {
 * 					oldSymbol, ok := locals[name]
 * 					if !ok || oldSymbol == nil {
 * 						newLocals = append(newLocals, name)
 * 					} else {
 * 						oldLocals = append(oldLocals, localsRecord{name, oldSymbol})
 * 					}
 * 				}
 * 				locals[name] = symbol
 * 			})
 * 
 * 			if existingFakeScope == nil {
 * 				// Use a Block for this; the type of the node doesn't matter so long as it
 * 				// has locals, and this is cheaper/easier than using a function-ish Node.
 * 				fakeScope := b.f.NewBlock(b.f.NewNodeList([]*ast.Node{}), false)
 * 				b.links.Get(fakeScope).fakeScopeForSignatureDeclaration = &kind
 * 				data := fakeScope.LocalsContainerData()
 * 				data.Locals = locals
 * 				fakeScope.Parent = b.ctx.enclosingDeclaration
 * 				b.ctx.enclosingDeclaration = fakeScope
 * 				return nil
 * 			} else {
 * 				// We did not create the current scope, so we have to clean it up
 * 				undo := func() {
 * 					for _, s := range newLocals {
 * 						delete(locals, s)
 * 					}
 * 					for _, s := range oldLocals {
 * 						locals[s.name] = s.oldSymbol
 * 					}
 * 				}
 * 				return undo
 * 			}
 * 		}
 * 
 * 		if expandedParams == nil || !core.Some(expandedParams, func(p *ast.Symbol) bool { return p != nil }) {
 * 			cleanupParams = nil
 * 		} else {
 * 			cleanupParams = pushFakeScope("params", func(add func(name string, symbol *ast.Symbol)) {
 * 				if expandedParams == nil {
 * 					return
 * 				}
 * 				for pIndex, param := range expandedParams {
 * 					var originalParam *ast.Symbol
 * 					if pIndex < len(originalParameters) {
 * 						originalParam = originalParameters[pIndex]
 * 					}
 * 					if originalParameters != nil && originalParam != param {
 * 						// Can't reference parameters that come from an expansion
 * 						add(param.Name, b.ch.unknownSymbol)
 * 						// Can't reference the original expanded parameter either
 * 						if originalParam != nil {
 * 							add(originalParam.Name, b.ch.unknownSymbol)
 * 						}
 * 					} else if !core.Some(param.Declarations, func(d *ast.Node) bool {
 * 						var bindElement func(e *ast.BindingElement)
 * 						var bindPattern func(e *ast.BindingPattern)
 * 
 * 						bindPatternWorker := func(p *ast.BindingPattern) {
 * 							for _, e := range p.Elements.Nodes {
 * 								switch e.Kind {
 * 								case ast.KindOmittedExpression:
 * 									return
 * 								case ast.KindBindingElement:
 * 									bindElement(e.AsBindingElement())
 * 									return
 * 								default:
 * 									panic("Unhandled binding element kind")
 * 								}
 * 							}
 * 						}
 * 
 * 						bindElementWorker := func(e *ast.BindingElement) {
 * 							if e.Name() != nil && ast.IsBindingPattern(e.Name()) {
 * 								bindPattern(e.Name().AsBindingPattern())
 * 								return
 * 							}
 * 							symbol := b.ch.getSymbolOfDeclaration(e.AsNode())
 * 							if symbol != nil { // omitted expressions are now parsed as nameless binding patterns and also have no symbol
 * 								add(symbol.Name, symbol)
 * 							}
 * 						}
 * 						bindElement = bindElementWorker
 * 						bindPattern = bindPatternWorker
 * 
 * 						if ast.IsParameterDeclaration(d) && d.Name() != nil && ast.IsBindingPattern(d.Name()) {
 * 							bindPattern(d.Name().AsBindingPattern())
 * 							return true
 * 						}
 * 						return false
 * 					}) {
 * 						add(param.Name, param)
 * 					}
 * 				}
 * 			})
 * 		}
 * 
 * 		if b.ctx.flags&nodebuilder.FlagsGenerateNamesForShadowedTypeParams != 0 && typeParameters != nil && core.Some(typeParameters, func(p *Type) bool { return p != nil }) {
 * 			cleanupTypeParams = pushFakeScope("typeParams", func(add func(name string, symbol *ast.Symbol)) {
 * 				if typeParameters == nil {
 * 					return
 * 				}
 * 				for _, typeParam := range typeParameters {
 * 					if typeParam == nil {
 * 						continue
 * 					}
 * 					typeParamName := b.typeParameterToName(typeParam).Text
 * 					add(typeParamName, typeParam.symbol)
 * 				}
 * 			})
 * 		}
 * 
 * 	}
 * 
 * 	return func() {
 * 		if cleanupParams != nil {
 * 			cleanupParams()
 * 		}
 * 		if cleanupTypeParams != nil {
 * 			cleanupTypeParams()
 * 		}
 * 		cleanupContext()
 * 		b.ctx.enclosingDeclaration = oldEnclosingDecl
 * 		b.ctx.mapper = oldMapper
 * 	}
 * }
 */
export function NodeBuilderImpl_enterNewScope(receiver: GoPtr<NodeBuilderImpl>, declaration: GoPtr<Node>, expandedParams: GoSlice<GoPtr<Symbol>>, typeParameters: GoSlice<GoPtr<Type>>, originalParameters: GoSlice<GoPtr<Symbol>>, mapper: GoPtr<TypeMapper>): () => void {
  const cleanupContext = cloneNodeBuilderContext(receiver!.ctx);
  let cleanupParams: (() => void) | undefined;
  let cleanupTypeParams: (() => void) | undefined;
  const oldEnclosingDecl = receiver!.ctx!.enclosingDeclaration;
  const oldMapper = receiver!.ctx!.mapper;
  if (mapper !== undefined) {
    receiver!.ctx!.mapper = mapper;
  }
  if (receiver!.ctx!.enclosingDeclaration !== undefined && declaration !== undefined) {
    const links = receiver!.links as LinkStore<GoPtr<Node>, NodeBuilderLinks>;
    const pushFakeScope = (kind: string, addAll: (addSymbol: (name: string, symbol_: GoPtr<Symbol>) => void) => void): (() => void) | undefined => {
      Assert(receiver!.ctx!.enclosingDeclaration !== undefined);
      let existingFakeScope: GoPtr<Node>;
      if (LinkStore_Has<GoPtr<Node>, NodeBuilderLinks>(links, receiver!.ctx!.enclosingDeclaration)) {
        const existingLinks = LinkStore_Get<GoPtr<Node>, NodeBuilderLinks>(links, receiver!.ctx!.enclosingDeclaration);
        if (existingLinks!.fakeScopeForSignatureDeclaration !== undefined && existingLinks!.fakeScopeForSignatureDeclaration === kind) {
          existingFakeScope = receiver!.ctx!.enclosingDeclaration;
        }
      }
      if (existingFakeScope === undefined && receiver!.ctx!.enclosingDeclaration!.Parent !== undefined) {
        if (LinkStore_Has<GoPtr<Node>, NodeBuilderLinks>(links, receiver!.ctx!.enclosingDeclaration!.Parent)) {
          const parentLinks = LinkStore_Get<GoPtr<Node>, NodeBuilderLinks>(links, receiver!.ctx!.enclosingDeclaration!.Parent);
          if (parentLinks!.fakeScopeForSignatureDeclaration !== undefined && parentLinks!.fakeScopeForSignatureDeclaration === kind) {
            existingFakeScope = receiver!.ctx!.enclosingDeclaration!.Parent;
          }
        }
      }
      Assert(existingFakeScope === undefined || IsBlock(existingFakeScope));
      let locals: SymbolTable | undefined;
      if (existingFakeScope !== undefined) {
        locals = GetLocals(existingFakeScope);
      }
      locals ??= new globalThis.Map<string, GoPtr<Symbol>>();
      const newLocals: string[] = [];
      const oldLocals: localsRecord[] = [];
      addAll((name: string, symbol_: GoPtr<Symbol>): void => {
        if (existingFakeScope !== undefined) {
          const oldSymbol = locals!.get(name);
          if (oldSymbol === undefined) {
            newLocals.push(name);
          } else {
            oldLocals.push({ name, oldSymbol });
          }
        }
        locals!.set(name, symbol_);
      });
      if (existingFakeScope === undefined) {
        const fakeScope = NewBlock(receiver!.f, NodeFactory_NewNodeList(receiver!.f, []), false);
        LinkStore_Get<GoPtr<Node>, NodeBuilderLinks>(links, fakeScope)!.fakeScopeForSignatureDeclaration = kind;
        const data = Node_LocalsContainerData(fakeScope);
        (data as unknown as { Locals?: SymbolTable }).Locals = locals;
        fakeScope!.Parent = receiver!.ctx!.enclosingDeclaration;
        receiver!.ctx!.enclosingDeclaration = fakeScope;
        return undefined;
      }
      return () => {
        for (const name of newLocals) {
          locals!.delete(name);
        }
        for (const record of oldLocals) {
          locals!.set(record.name, record.oldSymbol);
        }
      };
    };
    if (expandedParams === undefined || !Some(expandedParams, (p: GoPtr<Symbol>) => p !== undefined)) {
      cleanupParams = undefined;
    } else {
      cleanupParams = pushFakeScope("params", (add: (name: string, symbol_: GoPtr<Symbol>) => void): void => {
        if (expandedParams === undefined) {
          return;
        }
        for (let pIndex = 0; pIndex < expandedParams.length; pIndex++) {
          const param = expandedParams[pIndex];
          let originalParam: GoPtr<Symbol>;
          if (pIndex < (originalParameters?.length ?? 0)) {
            originalParam = originalParameters[pIndex];
          }
          if (originalParameters !== undefined && originalParam !== param) {
            add(param!.Name, receiver!.ch!.unknownSymbol);
            if (originalParam !== undefined) {
              add(originalParam!.Name, receiver!.ch!.unknownSymbol);
            }
          } else if (!Some(param!.Declarations, (d: GoPtr<Node>) => {
            const bindElement = (e: GoPtr<Node>): void => {
              const name = Node_Name(e);
              if (name !== undefined && IsBindingPattern(name)) {
                bindPattern(name);
                return;
              }
              const symbol_ = Checker_getSymbolOfDeclaration(receiver!.ch, e);
              if (symbol_ !== undefined) {
                add(symbol_!.Name, symbol_);
              }
            };
            const bindPattern = (p: GoPtr<Node>): void => {
              for (const e of Node_Elements(p) ?? []) {
                if (IsOmittedExpression(e)) {
                  return;
                }
                if (IsBindingElement(e)) {
                  bindElement(e);
                  return;
                }
                throw new globalThis.Error("Unhandled binding element kind");
              }
            };
            if (IsParameterDeclaration(d) && Node_Name(d) !== undefined && IsBindingPattern(Node_Name(d))) {
              bindPattern(Node_Name(d));
              return true;
            }
            return false;
          })) {
            add(param!.Name, param);
          }
        }
      });
    }
    if ((receiver!.ctx!.flags & FlagsGenerateNamesForShadowedTypeParams) !== 0 && typeParameters !== undefined && Some(typeParameters, (p: GoPtr<Type>) => p !== undefined)) {
      cleanupTypeParams = pushFakeScope("typeParams", (add: (name: string, symbol_: GoPtr<Symbol>) => void): void => {
        if (typeParameters === undefined) {
          return;
        }
        for (const typeParam of typeParameters) {
          if (typeParam === undefined) {
            continue;
          }
          const typeParamName = NodeBuilderImpl_typeParameterToName(receiver, typeParam)!.Text;
          add(typeParamName, typeParam!.symbol);
        }
      });
    }
  }
  return () => {
    if (cleanupParams !== undefined) {
      cleanupParams();
    }
    if (cleanupTypeParams !== undefined) {
      cleanupTypeParams();
    }
    cleanupContext();
    receiver!.ctx!.enclosingDeclaration = oldEnclosingDecl;
    receiver!.ctx!.mapper = oldMapper;
  };
}
