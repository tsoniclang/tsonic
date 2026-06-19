import type { GoPtr, GoSlice } from "../../go/compat.js";
import { NewSetWithSizeHint, Set_Add, Set_Has } from "../collections/set.js";
import { AsJSDoc, AsJSDocParameterOrPropertyTag, AsQualifiedName } from "../ast/generated/casts.js";
import type { Node } from "../ast/spine.js";
import { Node_Name } from "../ast/spine.js";
import { Node_JSDoc, Node_Parameters, Node_Text, Node_Type } from "../ast/ast.js";
import { KindJSDocParameterTag } from "../ast/generated/kinds.js";
import { NodeFlagsJSDoc } from "../ast/generated/flags.js";
import { IsIdentifier, IsQualifiedName } from "../ast/generated/predicates.js";
import { GetNextJSDocCommentLocation, IsBindingPattern, IsInJSFile } from "../ast/utilities.js";
import { JSDoc_param_tag_has_name_0_but_there_is_no_parameter_with_that_name, JSDoc_param_tag_has_name_0_but_there_is_no_parameter_with_that_name_It_would_match_arguments_if_it_had_an_array_type, Qualified_name_0_is_not_allowed_without_a_leading_param_object_1 } from "../diagnostics/generated/messages.js";
import type { Checker } from "./checker/state.js";
import { Checker_containsArgumentsReference } from "./checker/signatures.js";
import { Checker_error, Checker_errorOrSuggestion } from "./checker/support.js";
import { Checker_getTypeFromTypeNode, Checker_isArrayType } from "./checker/types.js";
import { entityNameToString } from "./utilities.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsdoc.go::method::Checker.checkUnmatchedJSDocParameters","kind":"method","status":"implemented","sigHash":"2921bfbb0d5749e0b07664d20c5321dcdb700d68c9c0ee7ba882b0ad6f06011b","bodyHash":"e1f2c56a7992eece4ecfa071805cfc15413e41089116c5811606e3a7ef289f62"}
 *
 * Go source:
 * func (c *Checker) checkUnmatchedJSDocParameters(node *ast.Node) {
 * 	var jsdocParameters []*ast.Node
 * 	for _, tag := range getAllJSDocTags(node) {
 * 		if tag.Kind == ast.KindJSDocParameterTag {
 * 			name := tag.AsJSDocParameterOrPropertyTag().Name()
 * 			if ast.IsIdentifier(name) && len(name.Text()) == 0 {
 * 				continue
 * 			}
 * 			jsdocParameters = append(jsdocParameters, tag)
 * 		}
 * 	}
 * 
 * 	if len(jsdocParameters) == 0 {
 * 		return
 * 	}
 * 
 * 	isJs := ast.IsInJSFile(node)
 * 	parameters := collections.Set[string]{}
 * 	excludedParameters := collections.Set[int]{}
 * 
 * 	for i, param := range node.Parameters() {
 * 		name := param.AsParameterDeclaration().Name()
 * 		if ast.IsIdentifier(name) {
 * 			parameters.Add(name.Text())
 * 		}
 * 		if ast.IsBindingPattern(name) {
 * 			excludedParameters.Add(i)
 * 		}
 * 	}
 * 	if c.containsArgumentsReference(node) {
 * 		if isJs {
 * 			lastJSDocParamIndex := len(jsdocParameters) - 1
 * 			lastJSDocParam := jsdocParameters[lastJSDocParamIndex].AsJSDocParameterOrPropertyTag()
 * 			if lastJSDocParam == nil || !ast.IsIdentifier(lastJSDocParam.Name()) {
 * 				return
 * 			}
 * 			if excludedParameters.Has(lastJSDocParamIndex) || parameters.Has(lastJSDocParam.Name().Text()) {
 * 				return
 * 			}
 * 			if lastJSDocParam.TypeExpression == nil || lastJSDocParam.TypeExpression.Type() == nil {
 * 				return
 * 			}
 * 			if c.isArrayType(c.getTypeFromTypeNode(lastJSDocParam.TypeExpression.Type())) {
 * 				return
 * 			}
 * 			c.error(lastJSDocParam.Name(), diagnostics.JSDoc_param_tag_has_name_0_but_there_is_no_parameter_with_that_name_It_would_match_arguments_if_it_had_an_array_type, lastJSDocParam.Name().Text())
 * 		}
 * 	} else {
 * 		for index, tag := range jsdocParameters {
 * 			name := tag.AsJSDocParameterOrPropertyTag().Name()
 * 			isNameFirst := tag.AsJSDocParameterOrPropertyTag().IsNameFirst
 * 
 * 			if excludedParameters.Has(index) || (ast.IsIdentifier(name) && parameters.Has(name.Text())) {
 * 				continue
 * 			}
 * 
 * 			if ast.IsQualifiedName(name) {
 * 				if isJs {
 * 					c.error(name, diagnostics.Qualified_name_0_is_not_allowed_without_a_leading_param_object_1,
 * 						entityNameToString(name),
 * 						entityNameToString(name.AsQualifiedName().Left),
 * 					)
 * 				}
 * 			} else {
 * 				if !isNameFirst {
 * 					c.errorOrSuggestion(isJs, name,
 * 						diagnostics.JSDoc_param_tag_has_name_0_but_there_is_no_parameter_with_that_name,
 * 						name.Text(),
 * 					)
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export function Checker_checkUnmatchedJSDocParameters(receiver: GoPtr<Checker>, node: GoPtr<Node>): void {
  const jsdocParameters: GoSlice<GoPtr<Node>> = [];
  for (const tag of getAllJSDocTags(node)) {
    if (tag!.Kind === KindJSDocParameterTag) {
      const name = Node_Name(tag);
      if (IsIdentifier(name) && Node_Text(name).length === 0) {
        continue;
      }
      jsdocParameters.push(tag);
    }
  }

  if (jsdocParameters.length === 0) {
    return;
  }

  const isJs = IsInJSFile(node);
  const parameters = NewSetWithSizeHint<string>(0);
  const excludedParameters = NewSetWithSizeHint<number>(0);

  for (let index = 0; index < Node_Parameters(node).length; index++) {
    const param = Node_Parameters(node)[index];
    const name = Node_Name(param);
    if (IsIdentifier(name)) {
      Set_Add(parameters, Node_Text(name));
    }
    if (IsBindingPattern(name)) {
      Set_Add(excludedParameters, index);
    }
  }
  if (Checker_containsArgumentsReference(receiver, node)) {
    if (isJs) {
      const lastJSDocParamIndex = jsdocParameters.length - 1;
      const lastJSDocParam = AsJSDocParameterOrPropertyTag(jsdocParameters[lastJSDocParamIndex]);
      if (lastJSDocParam === undefined || !IsIdentifier(lastJSDocParam.name)) {
        return;
      }
      if (Set_Has(excludedParameters, lastJSDocParamIndex) || Set_Has(parameters, Node_Text(lastJSDocParam.name))) {
        return;
      }
      if (lastJSDocParam.TypeExpression === undefined || Node_Type(lastJSDocParam.TypeExpression) === undefined) {
        return;
      }
      if (Checker_isArrayType(receiver, Checker_getTypeFromTypeNode(receiver, Node_Type(lastJSDocParam.TypeExpression)))) {
        return;
      }
      Checker_error(receiver, lastJSDocParam.name, JSDoc_param_tag_has_name_0_but_there_is_no_parameter_with_that_name_It_would_match_arguments_if_it_had_an_array_type, Node_Text(lastJSDocParam.name));
    }
  } else {
    for (let index = 0; index < jsdocParameters.length; index++) {
      const tag = jsdocParameters[index];
      const jsdocTag = AsJSDocParameterOrPropertyTag(tag)!;
      const name = jsdocTag.name;
      const isNameFirst = jsdocTag.IsNameFirst;

      if (Set_Has(excludedParameters, index) || (IsIdentifier(name) && Set_Has(parameters, Node_Text(name)))) {
        continue;
      }

      if (IsQualifiedName(name)) {
        if (isJs) {
          Checker_error(
            receiver,
            name,
            Qualified_name_0_is_not_allowed_without_a_leading_param_object_1,
            entityNameToString(name),
            entityNameToString(AsQualifiedName(name)!.Left),
          );
        }
      } else {
        if (!isNameFirst) {
          Checker_errorOrSuggestion(
            receiver,
            isJs,
            name,
            JSDoc_param_tag_has_name_0_but_there_is_no_parameter_with_that_name,
            Node_Text(name),
          );
        }
      }
    }
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/jsdoc.go::func::getAllJSDocTags","kind":"func","status":"implemented","sigHash":"64e6a55ef6d0d498291e6a741c2d0231176ba9e6069c1771ce7875c29458684e","bodyHash":"d6ffeae36195eb45eee0b5ac8556d73b53e0677bc5936fa5d8ed17e446268912"}
 *
 * Go source:
 * func getAllJSDocTags(node *ast.Node) []*ast.Node {
 * 	if node.Flags&ast.NodeFlagsJSDoc == 0 {
 * 		for current := node; current != nil; current = ast.GetNextJSDocCommentLocation(current) {
 * 			jsdocs := current.JSDoc(nil)
 * 			if len(jsdocs) == 0 {
 * 				continue
 * 			}
 * 			lastJSDoc := jsdocs[len(jsdocs)-1].AsJSDoc()
 * 			if lastJSDoc.Tags != nil {
 * 				return lastJSDoc.Tags.Nodes
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function getAllJSDocTags(node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  if ((node!.Flags & NodeFlagsJSDoc) === 0) {
    for (let current = node; current !== undefined; current = GetNextJSDocCommentLocation(current)) {
      const jsdocs = Node_JSDoc(current, undefined);
      if ((jsdocs?.length ?? 0) === 0) {
        continue;
      }
      const lastJSDoc = AsJSDoc(jsdocs![jsdocs!.length - 1]);
      if (lastJSDoc!.Tags !== undefined) {
        return lastJSDoc!.Tags!.Nodes;
      }
    }
  }
  return [];
}
