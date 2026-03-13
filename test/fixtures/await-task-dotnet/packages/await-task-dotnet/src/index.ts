import { Console } from "@tsonic/dotnet/System.js";
import type { Task, ValueTask } from "@tsonic/dotnet/System.Threading.Tasks.js";
import {
  Task as TaskValue,
  ValueTask as ValueTaskValue,
} from "@tsonic/dotnet/System.Threading.Tasks.js";
import { int } from "@tsonic/core/types.js";
import { flushImported, notifyImported } from "./support.ts";

function getNumber(): Task<int> {
  return TaskValue.FromResult(41 as int);
}

function getText(): ValueTask<string> {
  return ValueTaskValue.FromResult("ok");
}

function notifyLocal(): Task {
  return TaskValue.CompletedTask;
}

function flushLocal(): ValueTask {
  return ValueTaskValue.CompletedTask;
}

export async function main(): Promise<void> {
  const n = await getNumber();
  const t = await getText();
  await notifyLocal();
  await flushLocal();
  await notifyImported();
  await flushImported();

  Console.WriteLine(`N=${n + (1 as int)}`);
  Console.WriteLine(`T=${t}`);
  Console.WriteLine(`LEN=${t.Length}`);
  Console.WriteLine("TASK_VOID_OK");
  Console.WriteLine("VALUETASK_VOID_OK");
  Console.WriteLine("IMPORTED_TASK_VOID_OK");
  Console.WriteLine("IMPORTED_VALUETASK_VOID_OK");
}
