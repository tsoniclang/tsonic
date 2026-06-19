import type { bool, sbyte } from "../../go/scalars.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import { OrderedMap_Keys, OrderedMap_Size } from "../collections/ordered_map.js";
import type { OrderedMap } from "../collections/ordered_map.js";
import type { Decoder, UnmarshalerFrom } from "../json/json.js";
import { unmarshalJSONValueV2WithFactory, JSONValueTypeObject, JSONValueTypeArray, JSONValueTypeNotPresent } from "./jsonvalue.js";
import type { JSONValue } from "./jsonvalue.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::type::objectKind","kind":"type","status":"implemented","sigHash":"40af4365e00141a9986d7f8562c3d98a481e932bc1179f15412016475b1e3332","bodyHash":"af5f381ae99a40ae4605767ec2eba91fb371454e5f002d086a3355aa124083a6"}
 *
 * Go source:
 * objectKind int8
 */
export type objectKind = sbyte;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::constGroup::objectKindUnknown+objectKindSubpaths+objectKindConditions+objectKindImports+objectKindInvalid","kind":"constGroup","status":"implemented","sigHash":"7f462576ae937c23770a3b384950039e01ca88a049dc484507361e9b0f75f687","bodyHash":"feb0f7e43a540fb0e17f427608c1f3eb648a5c4f66125f211d84db01dd871799"}
 *
 * Go source:
 * const (
 * 	objectKindUnknown objectKind = iota
 * 	objectKindSubpaths
 * 	objectKindConditions
 * 	objectKindImports
 * 	objectKindInvalid
 * )
 */
export const objectKindUnknown: objectKind = 0 as objectKind;
export const objectKindSubpaths: objectKind = 1 as objectKind;
export const objectKindConditions: objectKind = 2 as objectKind;
export const objectKindImports: objectKind = 3 as objectKind;
export const objectKindInvalid: objectKind = 4 as objectKind;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::type::ExportsOrImports","kind":"type","status":"implemented","sigHash":"64a5c7a5aa91cf6469e69a5bb4d7514cd620fba7e1b96ac7bc2ed75403ab1b43","bodyHash":"c6009288f596f324787b0edbc3e45f553475dd8ab6a8b33e9b4f95b7c8a1c200"}
 *
 * Go source:
 * ExportsOrImports struct {
 * 	JSONValue
 * 	objectKind objectKind
 * }
 */
export interface ExportsOrImports {
  __tsgoEmbedded0?: JSONValue;
  objectKind: objectKind;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::varGroup::_","kind":"varGroup","status":"implemented","sigHash":"49fbaf64ae10ed60e869e0234672578cdcd492d18042f56b9c710f8c12be2c3e","bodyHash":"21c88ce41254efb67b7c345d1d4eca6a7cdb8ad5d146dc5f38d7ec60dbbafcf5"}
 *
 * Go source:
 * var _ json.UnmarshalerFrom = (*ExportsOrImports)(nil)
 */
export const __fac7894a_0: UnmarshalerFrom = ExportsOrImports_as_json_UnmarshalerFrom(undefined);

export function ExportsOrImports_as_json_UnmarshalerFrom(receiver: GoPtr<ExportsOrImports>): UnmarshalerFrom {
  return {
    UnmarshalJSONFrom: (decoder: Decoder): GoError => ExportsOrImports_UnmarshalJSONFrom(receiver, decoder),
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::method::ExportsOrImports.UnmarshalJSONFrom","kind":"method","status":"implemented","sigHash":"0bedde69f9b9c17ba4aa81a22db4515bd14cfc176f980e625a93a90f66079e2d","bodyHash":"a9d52932cf2087e5ccb1be24c80282f75b783eacd9a7b4e7deb666781165af39"}
 *
 * Go source:
 * func (e *ExportsOrImports) UnmarshalJSONFrom(dec *json.Decoder) error {
 * 	return unmarshalJSONValueV2[ExportsOrImports](&e.JSONValue, dec)
 * }
 */
export function ExportsOrImports_UnmarshalJSONFrom(receiver: GoPtr<ExportsOrImports>, dec: GoPtr<Decoder>): GoError {
  const e = receiver!;
  if (e.__tsgoEmbedded0 === undefined) {
    e.__tsgoEmbedded0 = { Type: JSONValueTypeNotPresent, Value: undefined };
  }
  return unmarshalJSONValueV2WithFactory<ExportsOrImports>(
    e.__tsgoEmbedded0,
    dec,
    value => ({ __tsgoEmbedded0: value, objectKind: objectKindUnknown }),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::method::ExportsOrImports.AsObject","kind":"method","status":"implemented","sigHash":"59828c157d2a6b6d1ab64def67c069ae7089ae82737c5b0a8d667d4b8549ca83","bodyHash":"6e5fc95fb6455135e97950436659ec3aadca31dc746eba18f7a4749f2850d26f"}
 *
 * Go source:
 * func (e ExportsOrImports) AsObject() *collections.OrderedMap[string, ExportsOrImports] {
 * 	if e.Type != JSONValueTypeObject {
 * 		panic("expected object")
 * 	}
 * 	return e.Value.(*collections.OrderedMap[string, ExportsOrImports])
 * }
 */
export function ExportsOrImports_AsObject(receiver: ExportsOrImports): GoPtr<OrderedMap<string, ExportsOrImports>> {
  if (receiver.__tsgoEmbedded0!.Type !== JSONValueTypeObject) {
    throw new globalThis.Error("expected object");
  }
  return receiver.__tsgoEmbedded0!.Value as GoPtr<OrderedMap<string, ExportsOrImports>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::method::ExportsOrImports.AsArray","kind":"method","status":"implemented","sigHash":"6b983ce3c7c800501e8bbae92bd5da40a82038581409848e7ecc6e4a3e2bab86","bodyHash":"fea1355bf5336e96f7ec61e8fd47325e2dc61c2210ca2c4a05b93be86728e6c9"}
 *
 * Go source:
 * func (e ExportsOrImports) AsArray() []ExportsOrImports {
 * 	if e.Type != JSONValueTypeArray {
 * 		panic("expected array")
 * 	}
 * 	return e.Value.([]ExportsOrImports)
 * }
 */
export function ExportsOrImports_AsArray(receiver: ExportsOrImports): GoSlice<ExportsOrImports> {
  if (receiver.__tsgoEmbedded0!.Type !== JSONValueTypeArray) {
    throw new globalThis.Error("expected array");
  }
  return receiver.__tsgoEmbedded0!.Value as GoSlice<ExportsOrImports>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::method::ExportsOrImports.IsSubpaths","kind":"method","status":"implemented","sigHash":"b3be11a3fe5b5a6b8b536bbfd6e3f9a67a5b2da3edd6fdbbabf8c4ce3fc10822","bodyHash":"6eff4b348d441fc3539c464bd3c3c5ed3e95cd33f0bd014186fa4f449f02acd1"}
 *
 * Go source:
 * func (e ExportsOrImports) IsSubpaths() bool {
 * 	e.initObjectKind()
 * 	return e.objectKind == objectKindSubpaths
 * }
 */
export function ExportsOrImports_IsSubpaths(receiver: ExportsOrImports): bool {
  ExportsOrImports_initObjectKind(receiver);
  return receiver.objectKind === objectKindSubpaths;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::method::ExportsOrImports.IsImports","kind":"method","status":"implemented","sigHash":"f573b4d0e108268bdb944e46d1285b1fa5cf4e71aeccc34c891bf4de7a9ab444","bodyHash":"381bd9753a47d80ce6d18f2c2c9cfb5ef72df23e8ad4a34354f3a83a086d5d6d"}
 *
 * Go source:
 * func (e ExportsOrImports) IsImports() bool {
 * 	e.initObjectKind()
 * 	return e.objectKind == objectKindImports
 * }
 */
export function ExportsOrImports_IsImports(receiver: ExportsOrImports): bool {
  ExportsOrImports_initObjectKind(receiver);
  return receiver.objectKind === objectKindImports;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::method::ExportsOrImports.IsConditions","kind":"method","status":"implemented","sigHash":"e775fec3680e85b446ad9aad1ff990886c01a571678e1d155b32ec79c087312f","bodyHash":"977f067a10c8b3ed90abeda86c080c6b8d6f16e5c7cb13444e8c5cba98ab64b7"}
 *
 * Go source:
 * func (e ExportsOrImports) IsConditions() bool {
 * 	e.initObjectKind()
 * 	return e.objectKind == objectKindConditions
 * }
 */
export function ExportsOrImports_IsConditions(receiver: ExportsOrImports): bool {
  ExportsOrImports_initObjectKind(receiver);
  return receiver.objectKind === objectKindConditions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/packagejson/exportsorimports.go::method::ExportsOrImports.initObjectKind","kind":"method","status":"implemented","sigHash":"5cc8de38d529134388720162078219c18cead1880539770bfc728e0ee31c2e35","bodyHash":"ad96b16bcffa6753983796d402ac2c20a73152f2a9bfdc83e96ffeda936b69e8"}
 *
 * Go source:
 * func (e *ExportsOrImports) initObjectKind() {
 * 	if e.objectKind == objectKindUnknown && e.Type == JSONValueTypeObject {
 * 		if obj := e.AsObject(); obj.Size() > 0 {
 * 			seenDot, seenHash, seenOther := false, false, false
 * 			for k := range obj.Keys() {
 * 				if len(k) > 0 {
 * 					seenDot = seenDot || k[0] == '.'
 * 					seenHash = seenHash || k[0] == '#'
 * 					seenOther = seenOther || (k[0] != '.' && k[0] != '#')
 * 					if seenOther && (seenDot || seenHash) {
 * 						e.objectKind = objectKindInvalid
 * 						return
 * 					}
 * 				}
 * 			}
 * 			if seenDot {
 * 				e.objectKind = objectKindSubpaths
 * 				return
 * 			}
 * 			if seenHash {
 * 				e.objectKind = objectKindImports
 * 				return
 * 			}
 * 		}
 * 		e.objectKind = objectKindConditions
 * 	}
 * }
 */
export function ExportsOrImports_initObjectKind(receiver: GoPtr<ExportsOrImports>): void {
  const e = receiver!;
  if (e.objectKind === objectKindUnknown && e.__tsgoEmbedded0!.Type === JSONValueTypeObject) {
    const obj = ExportsOrImports_AsObject(e);
    if (OrderedMap_Size(obj) > 0) {
      const state = { seenDot: false, seenHash: false, seenOther: false, done: false };
      OrderedMap_Keys(obj as GoPtr<OrderedMap<string, ExportsOrImports>>)((k: string): bool => {
        if (k.length > 0) {
          state.seenDot = state.seenDot || k[0] === ".";
          state.seenHash = state.seenHash || k[0] === "#";
          state.seenOther = state.seenOther || (k[0] !== "." && k[0] !== "#");
          if (state.seenOther && (state.seenDot || state.seenHash)) {
            e.objectKind = objectKindInvalid;
            state.done = true;
            return false;
          }
        }
        return true;
      });
      if (state.done) {
        return;
      }
      if (state.seenDot) {
        e.objectKind = objectKindSubpaths;
        return;
      }
      if (state.seenHash) {
        e.objectKind = objectKindImports;
        return;
      }
    }
    e.objectKind = objectKindConditions;
  }
}
