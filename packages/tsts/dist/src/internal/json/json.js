import { Deterministic as json_Deterministic, JsonFieldNames, Marshal as json_Marshal, MarshalEncode as json_MarshalEncode, MarshalWrite as json_MarshalWrite, Unmarshal as json_Unmarshal, UnmarshalDecode as json_UnmarshalDecode, UnmarshalRead as json_UnmarshalRead, } from "../../go/github.com/go-json-experiment/json.js";
export { JsonFieldNames };
import { AllowDuplicateNames as jsontext_AllowDuplicateNames, AllowInvalidUTF8 as jsontext_AllowInvalidUTF8, NewDecoder as jsontext_NewDecoder, WithIndent as jsontext_WithIndent, WithIndentPrefix as jsontext_WithIndentPrefix, } from "../../go/github.com/go-json-experiment/json/jsontext.js";
import { BeginArray as BeginArray_jsontext, BeginObject as BeginObject_jsontext, EndArray as EndArray_jsontext, EndObject as EndObject_jsontext, Null as Null_jsontext, } from "../../go/github.com/go-json-experiment/json/jsontext.js";
import { Clip } from "../../go/slices.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::varGroup::allowInvalid","kind":"varGroup","status":"implemented","sigHash":"4ca491a9062bcfff59a0c9819d0cecd849aa6ca334c47b7dbcc5fa97d2f6b829","bodyHash":"d8515ff0504a25de75d9ee82de1b3b1b345e5fb7c27ed41617c8b47347b121d2"}
 *
 * Go source:
 * var allowInvalid []json.Options = slices.Clip([]json.Options{jsontext.AllowInvalidUTF8(true)})
 */
export const allowInvalid = Clip([jsontext_AllowInvalidUTF8(true)]);
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::Marshal","kind":"func","status":"implemented","sigHash":"dae80d7bc275a95555465a2200ab5240a71e863562a537cf8f91a6c5974667fe","bodyHash":"105d86b507d5708bb4b3a2e0bd6722dadb9abac0906e4bdb4458446c8ec2763c"}
 *
 * Go source:
 * func Marshal(in any, opts ...json.Options) (out []byte, err error) {
 * 	if len(opts) == 0 {
 * 		opts = allowInvalid
 * 	} else {
 * 		opts = append(allowInvalid, opts...)
 * 	}
 * 	return json.Marshal(in, opts...)
 * }
 */
export function Marshal(in_, ...opts) {
    const resolvedOpts = opts.length === 0 ? allowInvalid : [...allowInvalid, ...opts];
    return json_Marshal(in_, ...resolvedOpts);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::MarshalEncode","kind":"func","status":"implemented","sigHash":"876eaa7e5d21bc38d2cc381cf997fc364d44f02df48a8152e394ed87943ec8da","bodyHash":"25fc207c985a591e9215c2e3fe7de1fb2fe70af59fde603adf10fa21409219c4"}
 *
 * Go source:
 * func MarshalEncode(out *jsontext.Encoder, in any, opts ...json.Options) (err error) {
 * 	if len(opts) == 0 {
 * 		opts = allowInvalid
 * 	} else {
 * 		opts = append(allowInvalid, opts...)
 * 	}
 * 	return json.MarshalEncode(out, in, opts...)
 * }
 */
export function MarshalEncode(out, in_, ...opts) {
    const resolvedOpts = opts.length === 0 ? allowInvalid : [...allowInvalid, ...opts];
    return json_MarshalEncode(out, in_, ...resolvedOpts);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::MarshalWrite","kind":"func","status":"implemented","sigHash":"97457c6dd9e39db0c9b18dd56661fe7a489b468f2033587d55b529dea944e976","bodyHash":"88f89588365d942f1be828a7c007b154fb8c2f40a40c733c17a9316f709abf1f"}
 *
 * Go source:
 * func MarshalWrite(out io.Writer, in any, opts ...json.Options) (err error) {
 * 	if len(opts) == 0 {
 * 		opts = allowInvalid
 * 	} else {
 * 		opts = append(allowInvalid, opts...)
 * 	}
 * 	return json.MarshalWrite(out, in, opts...)
 * }
 */
export function MarshalWrite(out, in_, ...opts) {
    const resolvedOpts = opts.length === 0 ? allowInvalid : [...allowInvalid, ...opts];
    return json_MarshalWrite(out, in_, ...resolvedOpts);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::MarshalIndent","kind":"func","status":"implemented","sigHash":"d26f45ea8f2b4a34c03b5dc67ff89eb14656056ef9efcc74923cf5153abac298","bodyHash":"c74ae0a7db81ab92903b492cbcf2dd0edc7838c49916d5a574dc0b451429e737"}
 *
 * Go source:
 * func MarshalIndent(in any, prefix, indent string) (out []byte, err error) {
 * 	if prefix == "" && indent == "" {
 * 		// WithIndentPrefix and WithIndent imply multiline output, so skip them.
 * 		return Marshal(in)
 * 	}
 * 	return Marshal(in, jsontext.WithIndentPrefix(prefix), jsontext.WithIndent(indent))
 * }
 */
export function MarshalIndent(in_, prefix, indent) {
    if (prefix === "" && indent === "") {
        return Marshal(in_);
    }
    return Marshal(in_, jsontext_WithIndentPrefix(prefix), jsontext_WithIndent(indent));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::MarshalIndentWrite","kind":"func","status":"implemented","sigHash":"e502d9b521495abce43b485d8a1738ab6e51f05f653eda03881b16841ac01e8e","bodyHash":"3d3a0ef637a475f7fb36326e375d17455c6179dc99261602f9fdc0cb8c36730f"}
 *
 * Go source:
 * func MarshalIndentWrite(out io.Writer, in any, prefix, indent string) (err error) {
 * 	if prefix == "" && indent == "" {
 * 		// WithIndentPrefix and WithIndent imply multiline output, so skip them.
 * 		return MarshalWrite(out, in)
 * 	}
 * 	return MarshalWrite(out, in, jsontext.WithIndentPrefix(prefix), jsontext.WithIndent(indent))
 * }
 */
export function MarshalIndentWrite(out, in_, prefix, indent) {
    if (prefix === "" && indent === "") {
        return MarshalWrite(out, in_);
    }
    return MarshalWrite(out, in_, jsontext_WithIndentPrefix(prefix), jsontext_WithIndent(indent));
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::Unmarshal","kind":"func","status":"implemented","sigHash":"de1aef5c7f7c49031891680cfd91939b7ecdf726f5caac6e3f32c227fa6545aa","bodyHash":"b20e1ea981d58033311b57dac182937cbd222ef90ce89965c77b0a431dfd7a41"}
 *
 * Go source:
 * func Unmarshal(in []byte, out any, opts ...json.Options) (err error) {
 * 	return json.Unmarshal(in, out, opts...)
 * }
 */
export function Unmarshal(in_, out, ...opts) {
    return json_Unmarshal(in_, out, ...opts);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::UnmarshalDecode","kind":"func","status":"implemented","sigHash":"22458d086eafe73d5ef31c6027a25be7646f4dfe13e9be5e043197daa174a027","bodyHash":"1ae5641d32effec3574ef4d7012ba757b543240b0797d1e8389e8e45a2ef261a"}
 *
 * Go source:
 * func UnmarshalDecode(in *jsontext.Decoder, out any, opts ...json.Options) (err error) {
 * 	return json.UnmarshalDecode(in, out, opts...)
 * }
 */
export function UnmarshalDecode(in_, out, ...opts) {
    return json_UnmarshalDecode(in_, out, ...opts);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::UnmarshalRead","kind":"func","status":"implemented","sigHash":"54af2abbd3d268ecd38b36310093cf40a41a915ab4998fa5ed0216cc6792f54a","bodyHash":"336f8f2086cfe962b3d85c36808087d5c0a3c50c012e2b9ae2d310203afb6e23"}
 *
 * Go source:
 * func UnmarshalRead(in io.Reader, out any, opts ...json.Options) (err error) {
 * 	return json.UnmarshalRead(in, out, opts...)
 * }
 */
export function UnmarshalRead(in_, out, ...opts) {
    return json_UnmarshalRead(in_, out, ...opts);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::AllowDuplicateNames","kind":"func","status":"implemented","sigHash":"92d203fcdd49acc2975c65617d3501ac157179e6f0c93ac9ea8897f5ebd3a734","bodyHash":"7b3e71fda30031c218abef62b10b31e67e8b4f904d5f3116379d28e3decc734b"}
 *
 * Go source:
 * func AllowDuplicateNames(allow bool) json.Options {
 * 	return jsontext.AllowDuplicateNames(allow)
 * }
 */
export function AllowDuplicateNames(allow) {
    return jsontext_AllowDuplicateNames(allow);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::Deterministic","kind":"func","status":"implemented","sigHash":"e64f14d2c17a847bdba7b95ad9c9a658c656a5a647d76934b150c317f1ea7f37","bodyHash":"eb47a9676a0e48df04115d98fa2189c213ceea29dee1c0faef7641325adb546c"}
 *
 * Go source:
 * func Deterministic(v bool) json.Options {
 * 	return json.Deterministic(v)
 * }
 */
export function Deterministic(v) {
    return json_Deterministic(v);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::WithIndent","kind":"func","status":"implemented","sigHash":"233554c99fa3bdec99e6fdb8230ee5f7e0e46f54dd522ce8b509f83510c97f3f","bodyHash":"f7b3949f02ac1ffa39a04109b57126a3b281f92699fa561bc9b38151b7fe758b"}
 *
 * Go source:
 * func WithIndent(indent string) json.Options {
 * 	return jsontext.WithIndent(indent)
 * }
 */
export function WithIndent(indent) {
    return jsontext_WithIndent(indent);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::func::NewDecoder","kind":"func","status":"implemented","sigHash":"4dd70f9993ded7d9737a3d963edc4b65648c3667d982ef12c45a79466dec6bb2","bodyHash":"2f0a65550edc9b9b187a64c6a12c4e31f1f20b49fb81e86f17df4bc378243d40"}
 *
 * Go source:
 * func NewDecoder(r io.Reader) *jsontext.Decoder {
 * 	return jsontext.NewDecoder(r)
 * }
 */
export function NewDecoder(r) {
    return jsontext_NewDecoder(r);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/json/json.go::varGroup::BeginObject+EndObject+Null+BeginArray+EndArray","kind":"varGroup","status":"implemented","sigHash":"fb8c55f79fbf45b5063e830ab2d30a7c7ed6f5321bb7436d3c0ecb44771cd3d1","bodyHash":"33deb5d36b062ed547eecd7d31efad6a64b2ae66ec3ef15fb62575b176b7b237"}
 *
 * Go source:
 * var (
 * 	BeginObject = jsontext.BeginObject
 * 	EndObject   = jsontext.EndObject
 * 	Null        = jsontext.Null
 * 	BeginArray  = jsontext.BeginArray
 * 	EndArray    = jsontext.EndArray
 * )
 */
export const BeginObject = BeginObject_jsontext;
export const EndObject = EndObject_jsontext;
export const Null = Null_jsontext;
export const BeginArray = BeginArray_jsontext;
export const EndArray = EndArray_jsontext;
//# sourceMappingURL=json.js.map