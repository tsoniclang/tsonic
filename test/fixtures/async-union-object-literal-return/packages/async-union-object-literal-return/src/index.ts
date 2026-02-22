import { Console } from "@tsonic/dotnet/System.js";

async function getEvents(
  ok: boolean
): Promise<{ events: number[] } | { error: string; code?: string }> {
  if (!ok) {
    return { error: "ERR", code: "BAD" };
  }
  return { events: [] };
}

export async function main(): Promise<void> {
  const failure = await getEvents(false);
  if ("error" in failure) {
    Console.WriteLine(failure.error + ":" + (failure.code ?? "NONE"));
  }

  const success = await getEvents(true);
  if ("events" in success) {
    Console.WriteLine("COUNT:" + success.events.Length);
  }
}
