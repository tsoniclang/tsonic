import { Console } from "@tsonic/dotnet/System.js";

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type KindOf<T> = T extends number ? "num" : "other";

function assertType<T>(_value: T): void {}

const value = 42 as unknown as UnwrapPromise<Promise<number>>;
const kind = "num" as unknown as KindOf<number>;

assertType<UnwrapPromise<Promise<number>>>(value);
assertType<KindOf<number>>(kind);

Console.WriteLine("conditional+infer ok");
