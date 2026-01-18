// REGRESSION TEST: Interface property typed as 'int' should accept 'int' values
//
// This tests the fix for a bug where extractStructuralMembers was resolving
// the `int` type alias to `number` (its underlying type), causing TSN5110
// to incorrectly reject int→int assignments as int→double.
//
// The bug was: TypeScript's typeToTypeNode eagerly resolves aliases like `int`
// to their underlying type `number`. The fix checks propType.aliasSymbol before
// calling typeToTypeNode and preserves CLR primitive aliases from @tsonic/core.

import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

// Interface with int-typed property
interface Todo {
  id: int;
  title: string;
}

// Create function returns Todo with id from int variable
function createTodo(id: int, title: string): Todo {
  // id is type 'int', Todo.id expects 'int'
  // This SHOULD NOT trigger TSN5110 - int→int is valid
  return {
    id,
    title,
  };
}

export function main(): void {
  const todo = createTodo(1, "Test todo");
  Console.WriteLine("Created todo: " + todo.title);
}
