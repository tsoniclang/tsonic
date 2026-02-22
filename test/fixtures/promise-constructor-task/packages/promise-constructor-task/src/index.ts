import { Console } from "@tsonic/dotnet/System.js";

function resolveOne(value: boolean): Promise<boolean> {
  return new Promise<boolean>((resolve: (result: boolean) => void) => {
    resolve(value);
  });
}

function resolveTwo(value: boolean): Promise<boolean> {
  return new Promise<boolean>(
    (
      resolve: (result: boolean) => void,
      _reject: (reason: unknown) => void
    ) => {
      resolve(value);
    }
  );
}

export async function main(): Promise<void> {
  const first = await resolveOne(true);
  Console.WriteLine(first ? "T" : "F");

  const second = await resolveTwo(true);
  Console.WriteLine(second ? "TWO" : "NO");
}
