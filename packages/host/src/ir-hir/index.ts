import type { CallableEndpointKey, ChildrenOfSyntax, HasOverloadEndpoints, IndexSyntaxTree, OrderPragmaArguments, ParseHir, PrintHir, SelectedEndpointRoleFaults, VerifyHir, WalkSyntaxTree } from "./contract.js";
import { childrenOfSyntax as children } from "./children.js";
import { indexSyntaxTree as index, walkSyntaxTree as walk } from "./walk.js";
import { parseHir as parse } from "./parse.js";
import { printHir as print } from "./print.js";
import { verifyHir as verify } from "./verify.js";
import { orderPragmaArguments as orderPragmas } from "./pragmas.js";
import { callableEndpointKey as endpointKey, hasOverloadEndpoints as overloadEndpoints, selectedEndpointRoleFaults as roleFaults } from "./endpoints.js";
import type { CreateModuleBindingViews, IsModuleBindingKind, ProjectExportDeclarations, ResolveModuleBinding } from "./contract.js";
import { createModuleBindingViews as bindingViews, isModuleBindingKind as bindingKind, projectExportDeclarations as exportDeclarations, resolveModuleBinding as resolveBinding } from "./bindings.js";

export const resolveModuleBinding: ResolveModuleBinding = resolveBinding;
export const isModuleBindingKind: IsModuleBindingKind = bindingKind;
export const createModuleBindingViews: CreateModuleBindingViews = bindingViews;
export const projectExportDeclarations: ProjectExportDeclarations = exportDeclarations;

export const childrenOfSyntax: ChildrenOfSyntax = children;
export const indexSyntaxTree: IndexSyntaxTree = index;
export const walkSyntaxTree: WalkSyntaxTree = walk;
export const parseHir: ParseHir = parse;
export const printHir: PrintHir = print;
export const verifyHir: VerifyHir = verify;
export const orderPragmaArguments: OrderPragmaArguments = orderPragmas;
export const callableEndpointKey: CallableEndpointKey = endpointKey;
export const hasOverloadEndpoints: HasOverloadEndpoints = overloadEndpoints;
export const selectedEndpointRoleFaults: SelectedEndpointRoleFaults = roleFaults;
