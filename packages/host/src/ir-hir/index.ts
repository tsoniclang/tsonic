import type { ChildrenOfSyntax, IndexSyntaxTree, ParseHir, PrintHir, VerifyHir, WalkSyntaxTree } from "./contract.js";
import { childrenOfSyntax as children } from "./children.js";
import { indexSyntaxTree as index, walkSyntaxTree as walk } from "./walk.js";
import { parseHir as parse } from "./parse.js";
import { printHir as print } from "./print.js";
import { verifyHir as verify } from "./verify.js";

export const childrenOfSyntax: ChildrenOfSyntax = children;
export const indexSyntaxTree: IndexSyntaxTree = index;
export const walkSyntaxTree: WalkSyntaxTree = walk;
export const parseHir: ParseHir = parse;
export const printHir: PrintHir = print;
export const verifyHir: VerifyHir = verify;
