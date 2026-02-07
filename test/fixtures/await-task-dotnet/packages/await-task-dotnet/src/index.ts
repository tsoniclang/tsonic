import { Console } from "@tsonic/dotnet/System.js";
import type { Task, ValueTask } from "@tsonic/dotnet/System.Threading.Tasks.js";
import { Task as TaskValue, ValueTask as ValueTaskValue } from "@tsonic/dotnet/System.Threading.Tasks.js";
import { int } from "@tsonic/core/types.js";

function getNumber(): Task<int> {
  return TaskValue.FromResult(41 as int);
}

function getText(): ValueTask<string> {
  return ValueTaskValue.FromResult("ok");
}

export async function main(): Promise<void> {
  const n = await getNumber();
  const t = await getText();

  Console.WriteLine(`N=${n + (1 as int)}`);
  Console.WriteLine(`T=${t}`);
  Console.WriteLine(`LEN=${t.Length}`);
}
