import { Console } from "@tsonic/dotnet/System.js";
import { Task, TaskExtensions } from "@tsonic/dotnet/System.Threading.Tasks.js";

function writeTask(): Task {
  Console.WriteLine("WRITE");
  return Task.CompletedTask;
}

export function main(): void {
  const t1 = Task.CompletedTask.ContinueWith<Task>((_t, _state) => {
    Console.WriteLine("CONT-1");
    return Task.CompletedTask;
  }, undefined);
  t1.Wait();

  const t2 = Task.CompletedTask.ContinueWith<Task>((_t: Task, _state: unknown) => {
    Console.WriteLine("CONT-2");
    return Task.CompletedTask;
  }, undefined);
  t2.Wait();

  const t3 = Task.CompletedTask.ContinueWith<Task>(function (_t: Task, _state: unknown) {
    Console.WriteLine("CONT-3");
    return Task.CompletedTask;
  }, undefined);
  t3.Wait();

  const t4 = Task.FromResult<string>("X").ContinueWith<Task>((t: Task<string>, _state) => {
    Console.WriteLine(`CONT-4: ${t.Result}`);
    return writeTask();
  }, undefined);
  TaskExtensions.Unwrap(t4).Wait();
}
