import type { byte } from "@tsonic/core/types.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import type { Reader as Reader_565be45f, Writer as Writer_8cbaef7c } from "../../go/bufio.js";
import type { Reader as Reader_9d71ca04, Writer as Writer_51cf46eb } from "../../go/io.js";
import * as bufio from "../../go/bufio.js";
import * as bytes from "../../go/bytes.js";
import * as errors from "../../go/errors.js";
import * as fmt from "../../go/fmt.js";
import * as io from "../../go/io.js";
import * as strconv from "../../go/strconv.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/baseproto.go::varGroup::ErrInvalidHeader+ErrInvalidContentLength+ErrNoContentLength","kind":"varGroup","status":"implemented","sigHash":"862c9b190fde8da9a1cbb69d9098659668f791284c7faf6fa5562c2b21340571","bodyHash":"d3416a4a386ff60b239b10ce7a79f4227151742c91dc3c5329fa9966d05c48ba"}
 *
 * Go source:
 * var (
 * 	ErrInvalidHeader        = errors.New("jsonrpc: invalid header")
 * 	ErrInvalidContentLength = errors.New("jsonrpc: invalid content length")
 * 	ErrNoContentLength      = errors.New("jsonrpc: no content length")
 * )
 */
export const ErrInvalidHeader: GoError = errors.New("jsonrpc: invalid header");
export const ErrInvalidContentLength: GoError = errors.New("jsonrpc: invalid content length");
export const ErrNoContentLength: GoError = errors.New("jsonrpc: no content length");

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/baseproto.go::type::Reader","kind":"type","status":"implemented","sigHash":"63b33221a9a2526b999143ae8173671fdbe4c32d4047c49ae6127f204a6cdda5","bodyHash":"ef29dd1e525f91fab999ed8cd0845ca162d773c10d9ad73ef307052f4814dadb"}
 *
 * Go source:
 * Reader struct {
 * 	r *bufio.Reader
 * }
 */
export interface Reader {
  r: GoPtr<Reader_565be45f>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/baseproto.go::func::NewReader","kind":"func","status":"implemented","sigHash":"f0c1873c848f48953e5b4885462d2486f57b54e7d8a84fc698ef2a1ba7203461","bodyHash":"e9d60525b01a0557790c8d152900a042c483e234f6a39e5d0f4696c5d4269baf"}
 *
 * Go source:
 * func NewReader(r io.Reader) *Reader {
 * 	return &Reader{
 * 		r: bufio.NewReader(r),
 * 	}
 * }
 */
export function NewReader(r: Reader_9d71ca04): GoPtr<Reader> {
  return { r: bufio.NewReader(r) };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/baseproto.go::method::Reader.Read","kind":"method","status":"implemented","sigHash":"998469f1a00741d46dc210bd55c703724e4d3e3dc62b437d97deee34cc3631c9","bodyHash":"dc39839b976cf5f4c72e90a7fd3733a980480f7085ea991ad2f7a7289c36f3d3"}
 *
 * Go source:
 * func (r *Reader) Read() ([]byte, error) {
 * 	var contentLength int64
 * 
 * 	for {
 * 		line, err := r.r.ReadBytes('\n')
 * 		if err != nil {
 * 			if errors.Is(err, io.EOF) {
 * 				return nil, io.EOF
 * 			}
 * 			return nil, fmt.Errorf("jsonrpc: read header: %w", err)
 * 		}
 * 
 * 		if bytes.Equal(line, []byte("\r\n")) {
 * 			break
 * 		}
 * 
 * 		key, value, ok := bytes.Cut(line, []byte(":"))
 * 		if !ok {
 * 			return nil, fmt.Errorf("%w: %q", ErrInvalidHeader, line)
 * 		}
 * 
 * 		if bytes.Equal(key, []byte("Content-Length")) {
 * 			contentLength, err = strconv.ParseInt(string(bytes.TrimSpace(value)), 10, 64)
 * 			if err != nil {
 * 				return nil, fmt.Errorf("%w: parse error: %w", ErrInvalidContentLength, err)
 * 			}
 * 			if contentLength < 0 {
 * 				return nil, fmt.Errorf("%w: negative value %d", ErrInvalidContentLength, contentLength)
 * 			}
 * 		}
 * 	}
 * 
 * 	if contentLength <= 0 {
 * 		return nil, ErrNoContentLength
 * 	}
 * 
 * 	data := make([]byte, contentLength)
 * 	if _, err := io.ReadFull(r.r, data); err != nil {
 * 		return nil, fmt.Errorf("jsonrpc: read content: %w", err)
 * 	}
 * 
 * 	return data, nil
 * }
 */
export function Reader_Read(receiver: GoPtr<Reader>): [GoSlice<byte>, GoError] {
  let contentLength = 0;
  for (;;) {
    const [line, err] = receiver!.r!.ReadBytes("\n".charCodeAt(0) as byte);
    if (err !== undefined) {
      if (errors.Is(err, io.EOF)) {
        return [[], io.EOF];
      }
      return [[], fmt.Errorf("jsonrpc: read header: %w", err)];
    }
    if (bytes.Equal(line, [13 as byte, 10 as byte])) {
      break;
    }
    const [key, value, ok] = bytes.Cut(line, [":".charCodeAt(0) as byte]);
    if (!ok) {
      return [[], fmt.Errorf("%w: %q", ErrInvalidHeader, line)];
    }
    if (bytes.Equal(key, Array.from(new TextEncoder().encode("Content-Length")) as GoSlice<byte>)) {
      const [parsed, parseErr] = strconv.ParseInt(new TextDecoder().decode(bytes.TrimSpace(value)), 10, 64);
      if (parseErr !== undefined) {
        return [[], fmt.Errorf("%w: parse error: %w", ErrInvalidContentLength, parseErr)];
      }
      if (parsed < 0) {
        return [[], fmt.Errorf("%w: negative value %d", ErrInvalidContentLength, parsed)];
      }
      contentLength = parsed;
    }
  }
  if (contentLength <= 0) {
    return [[], ErrNoContentLength];
  }
  const data = new globalThis.Array(contentLength).fill(0) as GoSlice<byte>;
  const [, err] = io.ReadFull(receiver!.r!, data);
  if (err !== undefined) {
    return [[], fmt.Errorf("jsonrpc: read content: %w", err)];
  }
  return [data, undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/baseproto.go::type::Writer","kind":"type","status":"implemented","sigHash":"81bd5d41d446bb38be04ae104d88e84b8b878129fd197e5e9206e30544ad4040","bodyHash":"3168f07211684e3bcb45c1db02730e78415bb24be238455d126ff4664e3209b3"}
 *
 * Go source:
 * Writer struct {
 * 	w *bufio.Writer
 * }
 */
export interface Writer {
  w: GoPtr<Writer_8cbaef7c>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/baseproto.go::func::NewWriter","kind":"func","status":"implemented","sigHash":"d244441eea35d7bbeb051234d15586506e0802f59db256be9cfff78106d54ad3","bodyHash":"d9c8f36bb67fb3ef8c072d412476449a0186821e5697b7877b9f7e55eb29d710"}
 *
 * Go source:
 * func NewWriter(w io.Writer) *Writer {
 * 	return &Writer{
 * 		w: bufio.NewWriter(w),
 * 	}
 * }
 */
export function NewWriter(w: Writer_51cf46eb): GoPtr<Writer> {
  return { w: new bufio.Writer(w) };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/jsonrpc/baseproto.go::method::Writer.Write","kind":"method","status":"implemented","sigHash":"90cceffe1221626d3566c85e823119d6668db1a1945e86421af4b367500e0207","bodyHash":"806a067b16cf5f8702d56a8fedf125a2edb1ec50340943c90cb68a1d59bd497c"}
 *
 * Go source:
 * func (w *Writer) Write(data []byte) error {
 * 	if _, err := fmt.Fprintf(w.w, "Content-Length: %d\r\n\r\n", len(data)); err != nil {
 * 		return err
 * 	}
 * 	if _, err := w.w.Write(data); err != nil {
 * 		return err
 * 	}
 * 	return w.w.Flush()
 * }
 */
export function Writer_Write(receiver: GoPtr<Writer>, data: GoSlice<byte>): GoError {
  const [, headerErr] = fmt.Fprintf(receiver!.w!, "Content-Length: %d\r\n\r\n", data.length);
  if (headerErr !== undefined) {
    return headerErr;
  }
  const [, writeErr] = receiver!.w!.Write(data);
  if (writeErr !== undefined) {
    return writeErr;
  }
  return receiver!.w!.Flush();
}
