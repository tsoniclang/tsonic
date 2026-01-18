import { Console } from "@tsonic/dotnet/System.js";
import { SortedDictionary } from "@tsonic/dotnet/System.Collections.Generic.js";
import { JsonSerializer, JsonDocument } from "@tsonic/dotnet/System.Text.Json.js";
import { JsonNode, JsonValue } from "@tsonic/dotnet/System.Text.Json.Nodes.js";
import { int } from "@tsonic/core/types.js";

type UserDto = {
  id: int;
  displayName: string;
  isAdmin: boolean;
  tags: string[];
  note: string;
};

export function main(): void {
  const user: UserDto = {
    id: 123,
    displayName: 'Alice "The Great"',
    isAdmin: false,
    tags: ["a", "b"],
    note: "line1\nline2 \\ end ☃",
  };

  const serialized = JsonSerializer.Serialize<UserDto>(user);
  Console.WriteLine(`SERIALIZE=${serialized}`);

  const upperCasedJson =
    '{"ID":456,"DISPLAYNAME":"Bob","ISADMIN":true,"TAGS":["x"],"NOTE":"Z"}';
  const deserialized = JsonSerializer.Deserialize<UserDto>(upperCasedJson);
  if (deserialized === undefined) {
    Console.WriteLine("DESERIALIZE=undefined");
    return;
  }
  Console.WriteLine(`DESERIALIZE.displayName=${deserialized.displayName}`);
  Console.WriteLine(`DESERIALIZE.isAdmin=${deserialized.isAdmin}`);
  Console.WriteLine(`DESERIALIZE.tags0=${deserialized.tags[0]}`);

  const doc = JsonDocument.Parse(serialized);
  const docDisplayName =
    doc.RootElement.GetProperty("displayName").GetString() ?? "<null>";
  Console.WriteLine(`DOCUMENT.displayName=${docDisplayName}`);
  doc.Dispose();

  const dict = new SortedDictionary<string, int>();
  dict.Add("UserId", 1);
  dict.Add("PostId", 2);
  const dictJson = JsonSerializer.Serialize<SortedDictionary<string, int>>(dict);
  Console.WriteLine(`DICTIONARY=${dictJson}`);

  const node = JsonNode.Parse(serialized);
  if (node === undefined) {
    Console.WriteLine("NODE_PARSE=undefined");
    return;
  }
  const obj = node.AsObject();
  const extra: int = 42;
  obj.Add("extraValue", JsonValue.Create(extra));
  Console.WriteLine(`NODE=${obj.ToJsonString()}`);
}
