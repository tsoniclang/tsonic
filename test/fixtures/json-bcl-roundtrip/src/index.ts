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

  const serialized = JsonSerializer.serialize<UserDto>(user);
  Console.writeLine(`SERIALIZE=${serialized}`);

  const upperCasedJson =
    '{"ID":456,"DISPLAYNAME":"Bob","ISADMIN":true,"TAGS":["x"],"NOTE":"Z"}';
  const deserialized = JsonSerializer.deserialize<UserDto>(upperCasedJson);
  if (deserialized === undefined) {
    Console.writeLine("DESERIALIZE=undefined");
    return;
  }
  Console.writeLine(`DESERIALIZE.displayName=${deserialized.displayName}`);
  Console.writeLine(`DESERIALIZE.isAdmin=${deserialized.isAdmin}`);
  Console.writeLine(`DESERIALIZE.tags0=${deserialized.tags[0]}`);

  const doc = JsonDocument.parse(serialized);
  const docDisplayName =
    doc.rootElement.getProperty("displayName").getString() ?? "<null>";
  Console.writeLine(`DOCUMENT.displayName=${docDisplayName}`);
  doc.dispose();

  const dict = new SortedDictionary<string, int>();
  dict.add("UserId", 1);
  dict.add("PostId", 2);
  const dictJson = JsonSerializer.serialize<SortedDictionary<string, int>>(dict);
  Console.writeLine(`DICTIONARY=${dictJson}`);

  const node = JsonNode.parse(serialized);
  if (node === undefined) {
    Console.writeLine("NODE_PARSE=undefined");
    return;
  }
  const obj = node.asObject();
  const extra: int = 42;
  obj.add("extraValue", JsonValue.create(extra));
  Console.writeLine(`NODE=${obj.toJsonString()}`);
}
