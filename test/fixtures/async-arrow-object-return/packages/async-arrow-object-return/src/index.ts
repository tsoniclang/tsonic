import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

type Totals = {
  pageviews: int;
  sessions: int;
};

const queryTotals = async (): Promise<Totals> => {
  return {
    pageviews: 5,
    sessions: 2,
  };
};

export async function main(): Promise<void> {
  const totals = await queryTotals();
  Console.WriteLine(`${totals.pageviews}:${totals.sessions}`);
}
