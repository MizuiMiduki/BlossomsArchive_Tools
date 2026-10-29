import { describe, it, expect } from "vitest";
import {
    convertNewline,
    detectEncoding,
    decodeBytes,
    encodeStringToBytes,
    convertText,
    generateHexDump,
    bytesToHexString,
    parseHexToBytes,
    bytesToDecString,
    parseDecToBytes,
    bytesToBinString,
    parseBinToBytes,
    textToUnicodeEscapes,
    parseUnicodeEscapesToText,
    textToHtmlEntities,
    parseHtmlEntitiesToText,
    bytesToBase64,
    base64ToBytes,
    urlEncodeWithEncoding,
    urlDecodeWithEncoding,
    normalizeUnicode,
    inspectCharacters,
    fixMojibakeCandidates,
} from "../utils/charsetConverter";
import Encoding from "encoding-japanese";

describe("charsetConverter utility", () => {
    describe("convertNewline", () => {
        it("改行コードを正しくLFに統一できる", () => {
            const input = "a\r\nb\rc\nd";
            expect(convertNewline(input, "LF")).toBe("a\nb\nc\nd");
        });

        it("改行コードをCRLFに変換できる", () => {
            const input = "a\nb\rc\r\nd";
            expect(convertNewline(input, "CRLF")).toBe("a\r\nb\r\nc\r\nd");
        });

        it("改行コードをCRに変換できる", () => {
            const input = "a\nb\r\nc";
            expect(convertNewline(input, "CR")).toBe("a\rb\rc");
        });

        it("noneのときは変更しない", () => {
            const input = "a\r\nb\nc";
            expect(convertNewline(input, "none")).toBe(input);
        });
    });

    describe("encodeStringToBytes and decodeBytes", () => {
        it("UTF-8 のエンコード・デコードが正しく動作する", () => {
            const text = "こんにちは、世界！123";
            const bytes = encodeStringToBytes(text, "UTF8");
            const result = decodeBytes(bytes, "UTF8");
            expect(result.text).toBe(text);
        });

        it("UTF-8 (BOM付) のエンコード・デコードが正しく動作する", () => {
            const text = "テスト";
            const bytes = encodeStringToBytes(text, "UTF8_BOM");
            expect(bytes[0]).toBe(0xef);
            expect(bytes[1]).toBe(0xbb);
            expect(bytes[2]).toBe(0xbf);
            const result = decodeBytes(bytes, "UTF8_BOM");
            expect(result.text).toBe(text);
        });

        it("Shift_JIS のエンコード・デコードが正しく動作する", () => {
            const text = "あいうえお漢字";
            const bytes = encodeStringToBytes(text, "SJIS");
            const result = decodeBytes(bytes, "SJIS");
            expect(result.text).toBe(text);
        });

        it("EUC-JP のエンコード・デコードが正しく動作する", () => {
            const text = "日本語テキストEUC";
            const bytes = encodeStringToBytes(text, "EUCJP");
            const result = decodeBytes(bytes, "EUCJP");
            expect(result.text).toBe(text);
        });

        it("JIS のエンコード・デコードが正しく動作する", () => {
            const text = "JISメール本文";
            const bytes = encodeStringToBytes(text, "JIS");
            const result = decodeBytes(bytes, "JIS");
            expect(result.text).toBe(text);
        });

        it("Latin-1 のエンコード・デコードが正しく動作する", () => {
            const text = "Hello Café";
            const bytes = encodeStringToBytes(text, "LATIN1");
            const result = decodeBytes(bytes, "LATIN1");
            expect(result.text).toBe(text);
        });
    });

    describe("HEX, DEC, BIN 相互変換", () => {
        it("16進数（HEX）文字列とバイト列の相互変換", () => {
            const originalBytes = new Uint8Array([0xe3, 0x81, 0x82]); // 'あ' in UTF-8
            const hexSpace = bytesToHexString(originalBytes, "space");
            expect(hexSpace).toBe("E3 81 82");
            expect(bytesToHexString(originalBytes, "0x-comma")).toBe("0xE3, 0x81, 0x82");
            expect(bytesToHexString(originalBytes, "percent")).toBe("%E3%81%82");

            const parsed = parseHexToBytes("E3 81 82");
            expect(parsed).toEqual(originalBytes);
            const parsed0x = parseHexToBytes("0xE3, 0x81, 0x82");
            expect(parsed0x).toEqual(originalBytes);
        });

        it("10進数（DEC）文字列とバイト列の相互変換", () => {
            const originalBytes = new Uint8Array([227, 129, 130]);
            const decStr = bytesToDecString(originalBytes, "space");
            expect(decStr).toBe("227 129 130");

            const parsed = parseDecToBytes("227, 129, 130");
            expect(parsed).toEqual(originalBytes);
        });

        it("2進数（BIN）文字列とバイト列の相互変換", () => {
            const originalBytes = new Uint8Array([0x41, 0x42]);
            const binStr = bytesToBinString(originalBytes);
            expect(binStr).toBe("01000001 01000010");

            const parsed = parseBinToBytes(binStr);
            expect(parsed).toEqual(originalBytes);
        });
    });

    describe("UnicodeエスケープとHTML数値文字参照", () => {
        it("Unicodeコードポイント形式への変換と復元", () => {
            const text = "あA😀";
            const uPlus = textToUnicodeEscapes(text, "u-plus");
            expect(uPlus).toBe("U+3042 U+0041 U+1F600");
            expect(parseUnicodeEscapesToText(uPlus)).toBe(text);

            const slashU = textToUnicodeEscapes(text, "backslash-u-bracket");
            expect(slashU).toBe("\\u{3042}\\u{41}\\u{1F600}");
            expect(parseUnicodeEscapesToText(slashU)).toBe(text);
        });

        it("HTML数値文字参照への変換と復元", () => {
            const text = "あ<>";
            const decEntity = textToHtmlEntities(text, "dec");
            expect(decEntity).toBe("&#12354;&#60;&#62;");
            expect(parseHtmlEntitiesToText(decEntity)).toBe(text);

            const hexEntity = textToHtmlEntities(text, "hex");
            expect(hexEntity).toBe("&#x3042;&#x3C;&#x3E;");
            expect(parseHtmlEntitiesToText(hexEntity)).toBe(text);
        });
    });

    describe("Base64 & URLエンコード", () => {
        it("Base64の相互変換", () => {
            const bytes = encodeStringToBytes("こんにちは", "UTF8");
            const b64 = bytesToBase64(bytes);
            const decodedBytes = base64ToBytes(b64);
            const text = decodeBytes(decodedBytes, "UTF8").text;
            expect(text).toBe("こんにちは");
        });

        it("URLパーセントエンコード（Shift_JIS対応）", () => {
            const text = "あ";
            const encodedSjis = urlEncodeWithEncoding(text, "SJIS");
            expect(encodedSjis).toBe("%82%A0");
            const decoded = urlDecodeWithEncoding(encodedSjis, "SJIS");
            expect(decoded).toBe("あ");
        });
    });

    describe("Unicode正規化", () => {
        it("NFCとNFDの正規化変換ができる", () => {
            // NFD: 'か' + 結合濁点 (U+3099)
            const nfd = "\u304B\u3099";
            // NFC: 'が' (U+304C)
            const nfc = normalizeUnicode(nfd, "NFC");
            expect(nfc).toBe("が");
        });
    });

    describe("inspectCharacters", () => {
        it("各文字のコードポイントや各文字コードのバイト列を解析できる", () => {
            const inspection = inspectCharacters("あA");
            expect(inspection.length).toBe(2);
            expect(inspection[0].char).toBe("あ");
            expect(inspection[0].codePoint).toBe("U+3042");
            expect(inspection[0].utf8Hex).toBe("E3 81 82");
            expect(inspection[0].sjisHex).toBe("82 A0");
            expect(inspection[0].category).toBe("ひらがな");
        });
    });

    describe("fixMojibakeCandidates", () => {
        it("UTF-8 を Shift_JIS で開いてしまった典型的な文字化けを復元できる", () => {
            const original = "こんにちは";
            const utf8Bytes = Encoding.convert(Encoding.stringToCode(original), {
                to: "UTF8",
                from: "UNICODE",
            });
            const mojibake = Encoding.codeToString(
                Encoding.convert(utf8Bytes, { to: "UNICODE", from: "SJIS" }),
            );
            expect(mojibake).toBe("縺薙ｓ縺ｫ縺｡縺ｯ");

            const candidates = fixMojibakeCandidates(mojibake);
            const found = candidates.find((c) => c.restoredText === original);
            expect(found).toBeDefined();
        });

        it("UTF-8 を Latin-1 で開いた文字化け（ã ‚...）を復元できる", () => {
            const original = "あい";
            const utf8Bytes = new TextEncoder().encode(original);
            let latin1Mojibake = "";
            for (const b of utf8Bytes) {
                latin1Mojibake += String.fromCharCode(b);
            }
            const candidates = fixMojibakeCandidates(latin1Mojibake);
            const found = candidates.find((c) => c.restoredText === original);
            expect(found).toBeDefined();
        });
    });
});
