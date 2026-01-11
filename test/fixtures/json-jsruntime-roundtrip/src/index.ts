import { Console } from "@tsonic/dotnet/System.js";
import { JSON } from "@tsonic/js/index.js";
import { int } from "@tsonic/core/types.js";

type Payload = {
  id: int;
  displayName: string;
  tags: string[];
  nested: {
    count: int;
    ok: boolean;
  };
};

export function main(): void {
  const json =
    '{"id":1,"displayName":"Alice","tags":["x","y"],"nested":{"count":2,"ok":true}}';
  const parsed = JSON.parse<Payload>(json);

  Console.writeLine(`PARSE.displayName=${parsed.displayName}`);
  Console.writeLine(`PARSE.tagsLen=${parsed.tags.length}`);
  Console.writeLine(`PARSE.nested.ok=${parsed.nested.ok}`);

  const roundtrip = JSON.stringify(parsed);
  Console.writeLine(`STRINGIFY=${roundtrip}`);

  const special = JSON.stringify({
    text: 'He said "hi"\nline2 \\ end',
  });
  Console.writeLine(`ESCAPES=${special}`);

  const parsedNumber = JSON.parse<number>("123");
  Console.writeLine(`PRIMITIVE.number=${parsedNumber}`);

  const parsedBool = JSON.parse<boolean>("true");
  Console.writeLine(`PRIMITIVE.bool=${parsedBool}`);
}

