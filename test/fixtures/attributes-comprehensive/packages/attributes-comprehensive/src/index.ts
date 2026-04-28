import { asinterface, attributes as A } from "@tsonic/core/lang.js";
import {
  Attribute,
  Console,
  ObsoleteAttribute,
  SerializableAttribute,
} from "@tsonic/dotnet/System.js";
import type { Object as ClrObject, Type } from "@tsonic/dotnet/System.js";
import type { ICustomAttributeProvider } from "@tsonic/dotnet/System.Reflection.js";
import "@tsonic/dotnet/System.Reflection.js";

export class NamesAttribute extends Attribute {
  Names!: string[];

  constructor(names: string[]) {
    super();
    this.Names = names;
  }
}

export class User {
  #nameField!: string;

  get name(): string {
    return this.#nameField;
  }

  set name(value: string) {
    this.#nameField = value;
  }

  save(): void {}
}

export class NoCtor {
  value!: number;
}

const d = A.attr(ObsoleteAttribute, "type");

A<User>().add(SerializableAttribute);
A<User>().add(d);
A<User>().add(NamesAttribute, ["Alice", "Bob"]);

A<User>().ctor.add(ObsoleteAttribute, "ctor");
A<User>()
  .method((u) => u.save)
  .add(ObsoleteAttribute, "method");
A<User>()
  .prop((u) => u.name)
  .add(ObsoleteAttribute, "prop");

A<NoCtor>().ctor.add(ObsoleteAttribute, "implicit");

const ok = (value: boolean): string => (value ? "ok" : "fail");

const hasAttribute = (
  member: ICustomAttributeProvider,
  attributeFullName: string
): boolean => {
  const attrs = member.GetCustomAttributes(true);
  for (const a of attrs) {
    const obj = a as ClrObject;
    const t = obj.GetType() as Type;
    if (t.FullName === attributeFullName) return true;
  }
  return false;
};

const user = new User();
user.name = "Alice";
user.save();

const userType = user.GetType();
Console.WriteLine(
  `User.Serializable: ${ok(hasAttribute(asinterface<ICustomAttributeProvider>(userType), "System.SerializableAttribute"))}`
);

let namesOk = false;
const typeAttrs = userType.GetCustomAttributes(true);
for (const a of typeAttrs) {
  const obj = a as ClrObject;
  const t = obj.GetType() as Type;
  if (t.FullName === "AttributesComprehensive.NamesAttribute") {
    const na = a as NamesAttribute;
    namesOk =
      na.Names.Length === 2 && na.Names[0] === "Alice" && na.Names[1] === "Bob";
    break;
  }
}
Console.WriteLine(`User.Names: ${ok(namesOk)}`);

const ctors = userType.GetConstructors();
let ctorHasObsolete = false;
for (const c of ctors) {
  if (hasAttribute(c, "System.ObsoleteAttribute")) {
    ctorHasObsolete = true;
    break;
  }
}
Console.WriteLine(`User.ctor.Obsolete: ${ok(ctorHasObsolete)}`);

const saveMethod = userType.GetMethod("save");
Console.WriteLine(
  `User.save.Obsolete: ${ok(saveMethod !== undefined && hasAttribute(saveMethod, "System.ObsoleteAttribute"))}`
);

const nameProp = userType.GetProperty("name");
Console.WriteLine(
  `User.name.Obsolete: ${ok(nameProp !== undefined && hasAttribute(nameProp, "System.ObsoleteAttribute"))}`
);

const noCtor = new NoCtor();
const noCtorType = noCtor.GetType();
const noCtorCtors = noCtorType.GetConstructors();
let noCtorCtorHasObsolete = false;
for (const c of noCtorCtors) {
  if (hasAttribute(c, "System.ObsoleteAttribute")) {
    noCtorCtorHasObsolete = true;
    break;
  }
}
Console.WriteLine(`NoCtor.ctor.Obsolete: ${ok(noCtorCtorHasObsolete)}`);

Console.WriteLine(user.name);
