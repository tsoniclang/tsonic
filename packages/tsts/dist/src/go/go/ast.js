export const ArrayType = "ArrayType";
export const AssignStmt = "AssignStmt";
export const BasicLit = "BasicLit";
export const BinaryExpr = "BinaryExpr";
export const CaseClause = "CaseClause";
export const ChanType = "ChanType";
export const CommClause = "CommClause";
export const Ellipsis = "Ellipsis";
export const GenDecl = "GenDecl";
export const IndexExpr = "IndexExpr";
export const IndexListExpr = "IndexListExpr";
export const InterfaceType = "InterfaceType";
export const MapType = "MapType";
export const ParenExpr = "ParenExpr";
export const SelectorExpr = "SelectorExpr";
export const SelectStmt = "SelectStmt";
export const StarExpr = "StarExpr";
export const StructType = "StructType";
export const SwitchStmt = "SwitchStmt";
export const UnaryExpr = "UnaryExpr";
export function Inspect(root, fn) {
    const seen = new WeakSet();
    const visit = (node) => {
        if (node === undefined || node === null || typeof node !== "object") {
            return;
        }
        if (seen.has(node)) {
            return;
        }
        seen.add(node);
        if (!fn(node)) {
            return;
        }
        for (const value of Object.values(node)) {
            if (globalThis.Array.isArray(value)) {
                for (const child of value) {
                    visit(child);
                }
            }
            else {
                visit(value);
            }
        }
        fn(undefined);
    };
    visit(root);
}
//# sourceMappingURL=ast.js.map