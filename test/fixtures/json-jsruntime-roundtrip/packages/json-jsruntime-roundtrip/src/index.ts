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

  Console.WriteLine(`PARSE.displayName=${parsed.displayName}`);
  Console.WriteLine(`PARSE.tagsLen=${parsed.tags.Length}`);
  Console.WriteLine(`PARSE.nested.ok=${parsed.nested.ok}`);

  const inline = JSON.parse<{ x: number }>('{"x": 1}');
  Console.WriteLine(`INLINE.x=${inline.x}`);
  Console.WriteLine(`INLINE.stringify=${JSON.stringify(inline)}`);

  const roundtrip = JSON.stringify(parsed);
  Console.WriteLine(`STRINGIFY=${roundtrip}`);

  const special = JSON.stringify({
    text: 'He said "hi"\nline2 \\ end',
  });
  Console.WriteLine(`ESCAPES=${special}`);

  const parsedNumber = JSON.parse<number>("123");
  Console.WriteLine(`PRIMITIVE.number=${parsedNumber}`);

  const parsedBool = JSON.parse<boolean>("true");
  Console.WriteLine(`PRIMITIVE.bool=${parsedBool}`);
}
