import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

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
}
