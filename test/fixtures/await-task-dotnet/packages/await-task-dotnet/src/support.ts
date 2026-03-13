import type { Task, ValueTask } from "@tsonic/dotnet/System.Threading.Tasks.js";
import {
  Task as TaskValue,
  ValueTask as ValueTaskValue,
} from "@tsonic/dotnet/System.Threading.Tasks.js";

export function notifyImported(): Task {
  return TaskValue.CompletedTask;
}

export function flushImported(): ValueTask {
  return ValueTaskValue.CompletedTask;
}
