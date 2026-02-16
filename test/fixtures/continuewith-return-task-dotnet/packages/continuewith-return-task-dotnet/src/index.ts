import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

export function main(): void {
  const t = Task.CompletedTask.ContinueWith<Task>((_t, _state) => {
    Console.WriteLine("CONT");
    return Task.CompletedTask;
  }, undefined);
  t.Wait();
}

