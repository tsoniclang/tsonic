import { Console } from "@tsonic/dotnet/System.js";

async function getEvents(
  ok: boolean
): Promise<
  | { success: true; events: number[] }
  | { success: false; error: string; code?: string }
> {
  if (!ok) {
    return { success: false, error: "ERR", code: "BAD" };
  }
  return { success: true, events: [] };
}

export async function main(): Promise<void> {
  const failure = await getEvents(false);
  if (failure.success === false) {
    Console.WriteLine(failure.error + ":" + (failure.code ?? "NONE"));
  }

  const success = await getEvents(true);
  if (success.success) {
    Console.WriteLine("COUNT:" + success.events.Length);
  }
}
