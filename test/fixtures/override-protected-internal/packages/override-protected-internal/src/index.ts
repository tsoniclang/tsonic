import { Console } from "@tsonic/dotnet/System.js";
import {
  BinaryExpression,
  Expression,
  ExpressionVisitor,
} from "@tsonic/dotnet/System.Linq.Expressions.js";
import { BindingFlags } from "@tsonic/dotnet/System.Reflection.js";

class MyVisitor extends ExpressionVisitor {
  override VisitBinary(node: BinaryExpression): Expression {
    return super.VisitBinary(node);
  }
}

export function main(): void {
  const v = new MyVisitor();
  const t = v.GetType();
  const m = t.GetMethod("VisitBinary", BindingFlags.Instance | BindingFlags.NonPublic);

  // protected internal => IsFamilyOrAssembly = true (not just IsFamily).
  const ok = m !== undefined && m.IsVirtual && m.IsFamilyOrAssembly;
  const msg: string = ok ? "override: ok" : "override: fail";
  Console.WriteLine(msg);
}
