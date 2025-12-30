import { Console } from "@tsonic/dotnet/System";

async function fetchData(): Promise<string> {
  return await getData();
}

async function getData(): Promise<string> {
  return "Hello from async";
}

async function main(): Promise<void> {
  const result = await fetchData();
  Console.writeLine(`Result: ${result}`);
}

main();
