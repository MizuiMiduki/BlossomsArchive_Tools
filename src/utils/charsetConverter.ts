import Encoding from "encoding-japanese";

export type SupportedEncoding =
    | "UTF8"
    | "UTF8_BOM"
    | "SJIS"
    | "EUCJP"
    | "JIS"
    | "UTF16LE"
    | "UTF16BE"
    | "UTF32LE"
    | "UTF32BE"
    | "ASCII"
    | "LATIN1";

export type InputEncodingOption = "AUTO" | SupportedEncoding;

export type NewlineOption = "none" | "LF" | "CRLF" | "CR";

export interface EncodingOptionDetail {
    value: SupportedEncoding;
    label: string;
    description: string;
}

export const ENCODING_OPTIONS: EncodingOptionDetail[] = [
    {
        value: "UTF8",
        label: "UTF-8",
        description: "現代の標準文字コード（Web・アプリ標準）",
    },
    {
        value: "UTF8_BOM",
        label: "UTF-8 (BOM付き)",
        description: "WindowsのExcel等で文字化けを防ぐBOM付加形式",
    },
    {
        value: "SJIS",
        label: "Shift_JIS (CP932 / Windows-31J)",
        description: "Windows標準の日本語文字コード",
    },
    {
        value: "EUCJP",
        label: "EUC-JP",
        description: "UNIX/Linux環境で広く使われた日本語文字コード",
    },
    {
        value: "JIS",
        label: "JIS (ISO-2022-JP)",
        description: "電子メール等で伝統的に使われる7bit文字コード",
    },
    {
        value: "UTF16LE",
        label: "UTF-16LE",
        description: "Windows内部処理等で使われる16bit Unicode (Little Endian)",
    },
    {
        value: "UTF16BE",
        label: "UTF-16BE",
        description: "16bit Unicode (Big Endian)",
    },
    {
        value: "UTF32LE",
        label: "UTF-32LE",
        description: "32bit固定長 Unicode (Little Endian)",
    },
    {
        value: "UTF32BE",
        label: "UTF-32BE",
        description: "32bit固定長 Unicode (Big Endian)",
    },
    {
        value: "LATIN1",
        label: "ISO-8859-1 (Latin-1)",
        description: "西ヨーロッパ言語向け標準8bit文字コード",
    },
    {
        value: "ASCII",
        label: "ASCII",
        description: "英数記号のみ（7bit）",
    },
];

export interface ConversionResult {
    text: string;
    bytes: Uint8Array;
    byteCount: number;
    charCount: number;
    detectedInputEncoding: string;
    hasUnsupportedChars: boolean;
    unsupportedChars: string[];
}

/**
 * 改行コードを変換する
 */
export function convertNewline(text: string, newline: NewlineOption): string {
    if (newline === "none") return text;
    const normalized = text.replace(/\r\n|\r|\n/g, "\n");
    if (newline === "LF") return normalized;
    if (newline === "CRLF") return normalized.replace(/\n/g, "\r\n");
    if (newline === "CR") return normalized.replace(/\n/g, "\r");
    return text;
}

/**
 * バイト配列から推定文字コードを検出
 */
export function detectEncoding(data: number[] | Uint8Array): string {
    const arr = data instanceof Uint8Array ? Array.from(data) : data;
    // UTF-8 BOM
    if (arr.length >= 3 && arr[0] === 0xef && arr[1] === 0xbb && arr[2] === 0xbf) {
        return "UTF8_BOM";
    }
    // UTF-16LE BOM
    if (arr.length >= 2 && arr[0] === 0xff && arr[1] === 0xfe) {
        return "UTF16LE";
    }
    // UTF-16BE BOM
    if (arr.length >= 2 && arr[0] === 0xfe && arr[1] === 0xff) {
        return "UTF16BE";
    }
    // UTF-32LE BOM
    if (
        arr.length >= 4 &&
        arr[0] === 0xff &&
        arr[1] === 0xfe &&
        arr[2] === 0x00 &&
        arr[3] === 0x00
    ) {
        return "UTF32LE";
    }
    // UTF-32BE BOM
    if (
        arr.length >= 4 &&
        arr[0] === 0x00 &&
        arr[1] === 0x00 &&
        arr[2] === 0xfe &&
        arr[3] === 0xff
    ) {
        return "UTF32BE";
    }
    const detected = Encoding.detect(arr);
    return detected ? detected.toString() : "UNKNOWN";
}

/**
 * バイト列を指定の文字コードとして文字列にデコード
 */
export function decodeBytes(
    data: number[] | Uint8Array,
    fromEncoding: InputEncodingOption = "AUTO",
): { text: string; detectedEncoding: string } {
    let arr = data instanceof Uint8Array ? Array.from(data) : data;
    let detected = detectEncoding(arr);

    // BOMの除去
    if (
        (fromEncoding === "UTF8_BOM" || (fromEncoding === "AUTO" && detected === "UTF8_BOM")) &&
        arr.length >= 3 &&
        arr[0] === 0xef &&
        arr[1] === 0xbb &&
        arr[2] === 0xbf
    ) {
        arr = arr.slice(3);
        detected = "UTF8_BOM";
    }

    if (fromEncoding === "LATIN1") {
        const text = new TextDecoder("iso-8859-1", { fatal: false }).decode(
            new Uint8Array(arr),
        );
        return { text, detectedEncoding: "LATIN1" };
    }

    let encName: Encoding.Encoding;
    if (fromEncoding === "AUTO") {
        const det = Encoding.detect(arr);
        encName = det || "UTF8";
    } else if (fromEncoding === "UTF8_BOM") {
        encName = "UTF8";
    } else if (fromEncoding === "UTF16LE") {
        encName = "UTF16LE";
    } else if (fromEncoding === "UTF16BE") {
        encName = "UTF16BE";
    } else if (fromEncoding === "UTF32LE") {
        encName = "UTF32LE" as Encoding.Encoding;
    } else if (fromEncoding === "UTF32BE") {
        encName = "UTF32BE" as Encoding.Encoding;
    } else {
        encName = fromEncoding as Encoding.Encoding;
    }

    try {
        const unicodeArray = Encoding.convert(arr, {
            to: "UNICODE",
            from: encName,
        });
        const text = Encoding.codeToString(unicodeArray);
        return { text, detectedEncoding: detected };
    } catch {
        try {
            const labelMap: Record<string, string> = {
                SJIS: "shift_jis",
                EUCJP: "euc-jp",
                JIS: "iso-2022-jp",
                UTF8: "utf-8",
                UTF16LE: "utf-16le",
                UTF16BE: "utf-16be",
                LATIN1: "iso-8859-1",
            };
            const label = labelMap[fromEncoding] || "utf-8";
            const decoder = new TextDecoder(label, { fatal: false });
            return {
                text: decoder.decode(new Uint8Array(arr)),
                detectedEncoding: detected,
            };
        } catch {
            return { text: "", detectedEncoding: detected };
        }
    }
}

/**
 * 文字列を指定の文字コードにエンコードしてバイト列を取得
 */
export function encodeStringToBytes(
    text: string,
    toEncoding: SupportedEncoding,
): Uint8Array {
    if (toEncoding === "LATIN1") {
        const bytes = new Uint8Array(text.length);
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            bytes[i] = code <= 0xff ? code : 0x3f; // 範囲外は '?'
        }
        return bytes;
    }

    const unicodeCodes = Encoding.stringToCode(text);

    if (toEncoding === "UTF8_BOM") {
        const utf8Bytes = Encoding.convert(unicodeCodes, {
            to: "UTF8",
            from: "UNICODE",
        });
        const result = new Uint8Array(3 + utf8Bytes.length);
        result[0] = 0xef;
        result[1] = 0xbb;
        result[2] = 0xbf;
        result.set(new Uint8Array(utf8Bytes), 3);
        return result;
    }

    if (toEncoding === "UTF16LE") {
        const bytes = Encoding.convert(unicodeCodes, {
            to: "UTF16LE",
            from: "UNICODE",
        });
        return new Uint8Array(bytes);
    }

    if (toEncoding === "UTF16BE") {
        const bytes = Encoding.convert(unicodeCodes, {
            to: "UTF16BE",
            from: "UNICODE",
        });
        return new Uint8Array(bytes);
    }

    if (toEncoding === "UTF32LE") {
        const bytes = Encoding.convert(unicodeCodes, {
            to: "UTF32LE" as Encoding.Encoding,
            from: "UNICODE",
        });
        return new Uint8Array(bytes);
    }

    if (toEncoding === "UTF32BE") {
        const bytes = Encoding.convert(unicodeCodes, {
            to: "UTF32BE" as Encoding.Encoding,
            from: "UNICODE",
        });
        return new Uint8Array(bytes);
    }

    let targetEnc: Encoding.Encoding = "UTF8";
    if (toEncoding === "SJIS") targetEnc = "SJIS";
    else if (toEncoding === "EUCJP") targetEnc = "EUCJP";
    else if (toEncoding === "JIS") targetEnc = "JIS";
    else if (toEncoding === "ASCII") targetEnc = "ASCII";

    const converted = Encoding.convert(unicodeCodes, {
        to: targetEnc,
        from: "UNICODE",
    });

    return new Uint8Array(converted);
}

/**
 * 文字列を変換し、結果テキスト・バイト列・未対応文字などを算出
 */
export function convertText(
    inputText: string,
    toEncoding: SupportedEncoding,
    newline: NewlineOption = "none",
): ConversionResult {
    const adjustedText = convertNewline(inputText, newline);
    const bytes = encodeStringToBytes(adjustedText, toEncoding);

    let previewText: string;
    if (toEncoding === "UTF8_BOM") {
        previewText = decodeBytes(bytes.slice(3), "UTF8").text;
    } else {
        previewText = decodeBytes(bytes, toEncoding).text;
    }

    const unsupportedChars: string[] = [];
    if (toEncoding !== "UTF8" && toEncoding !== "UTF8_BOM") {
        for (const char of adjustedText) {
            if (char === "\n" || char === "\r" || char === "\t") continue;
            const singleBytes = encodeStringToBytes(char, toEncoding);
            const roundTrip = decodeBytes(singleBytes, toEncoding).text;
            if (roundTrip !== char && !unsupportedChars.includes(char)) {
                unsupportedChars.push(char);
            }
        }
    }

    const detected = detectEncoding(Encoding.stringToCode(inputText));

    return {
        text: previewText,
        bytes,
        byteCount: bytes.length,
        charCount: Array.from(previewText).length,
        detectedInputEncoding: detected,
        hasUnsupportedChars: unsupportedChars.length > 0,
        unsupportedChars,
    };
}

/**
 * 16進ダンプ（Hex dump）文字列を生成する
 */
export function generateHexDump(
    bytes: Uint8Array,
    maxBytes: number = 512,
): string {
    const lines: string[] = [];
    const limit = Math.min(bytes.length, maxBytes);

    for (let offset = 0; offset < limit; offset += 16) {
        const hexAddr = offset.toString(16).padStart(8, "0");
        const chunk = bytes.slice(offset, offset + 16);

        const hexBytes: string[] = [];
        let asciiStr = "";

        for (let i = 0; i < 16; i++) {
            if (i < chunk.length) {
                const b = chunk[i];
                hexBytes.push(b.toString(16).padStart(2, "0").toUpperCase());
                asciiStr += b >= 32 && b <= 126 ? String.fromCharCode(b) : ".";
            } else {
                hexBytes.push("  ");
            }
        }

        const hexLeft = hexBytes.slice(0, 8).join(" ");
        const hexRight = hexBytes.slice(8, 16).join(" ");
        lines.push(`${hexAddr}  ${hexLeft}  ${hexRight}  |${asciiStr}|`);
    }

    if (bytes.length > limit) {
        lines.push(`... (${bytes.length - limit} バイト省略)`);
    }

    return lines.join("\n");
}

/* ========================================================
   競合サービス対抗：コード表現・エスケープ・進数変換
   ======================================================== */

/**
 * バイト列を16進数（HEX）文字列へ変換
 */
export function bytesToHexString(
    bytes: Uint8Array,
    delimiter: "space" | "comma" | "0x-comma" | "none" | "percent" = "space",
): string {
    const hexArr = Array.from(bytes).map((b) =>
        b.toString(16).padStart(2, "0").toUpperCase(),
    );
    if (delimiter === "space") return hexArr.join(" ");
    if (delimiter === "comma") return hexArr.join(", ");
    if (delimiter === "0x-comma") return hexArr.map((h) => `0x${h}`).join(", ");
    if (delimiter === "percent") return hexArr.map((h) => `%${h}`).join("");
    return hexArr.join("");
}

/**
 * 16進数文字列（例: "E3 81 82" や "0xE3, 0x81" や "e38182"）をバイト配列に変換
 */
export function parseHexToBytes(hexString: string): Uint8Array {
    const clean = hexString
        .replace(/0x/gi, "")
        .replace(/[^0-9A-Fa-f]/g, "");
    if (clean.length === 0) return new Uint8Array(0);

    const length = Math.floor(clean.length / 2);
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/**
 * バイト列を10進数（DEC）文字列へ変換
 */
export function bytesToDecString(
    bytes: Uint8Array,
    delimiter: "space" | "comma" = "space",
): string {
    const decArr = Array.from(bytes).map((b) => b.toString(10));
    return delimiter === "comma" ? decArr.join(", ") : decArr.join(" ");
}

/**
 * 10進数文字列（例: "227 129 130" や "227, 129, 130"）をバイト配列に変換
 */
export function parseDecToBytes(decString: string): Uint8Array {
    const tokens = decString.trim().split(/[\s,]+/);
    const valid = tokens
        .map((t) => parseInt(t, 10))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 255);
    return new Uint8Array(valid);
}

/**
 * バイト列を2進数（BIN）文字列へ変換
 */
export function bytesToBinString(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(2).padStart(8, "0"))
        .join(" ");
}

/**
 * 2進数文字列をバイト配列に変換
 */
export function parseBinToBytes(binString: string): Uint8Array {
    const tokens = binString.trim().split(/[\s,]+/);
    const valid = tokens
        .map((t) => parseInt(t, 2))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 255);
    return new Uint8Array(valid);
}

/**
 * テキストをUnicodeコードポイント表記に変換
 */
export function textToUnicodeEscapes(
    text: string,
    format: "u-plus" | "backslash-u" | "backslash-u-bracket" = "u-plus",
): string {
    const codePoints: string[] = [];
    for (const char of text) {
        const cp = char.codePointAt(0);
        if (cp === undefined) continue;
        const hex = cp.toString(16).toUpperCase();
        if (format === "u-plus") {
            codePoints.push(`U+${hex.padStart(4, "0")}`);
        } else if (format === "backslash-u") {
            codePoints.push(
                cp > 0xffff
                    ? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}\\u${char.charCodeAt(1).toString(16).padStart(4, "0")}`
                    : `\\u${hex.padStart(4, "0")}`,
            );
        } else if (format === "backslash-u-bracket") {
            codePoints.push(`\\u{${hex}}`);
        }
    }
    return format === "u-plus" ? codePoints.join(" ") : codePoints.join("");
}

/**
 * Unicodeエスケープ表記（例: "U+3042"、"\u3042"、"\u{3042}"）を通常文字列に復元
 */
export function parseUnicodeEscapesToText(input: string): string {
    // \u{...}
    let res = input.replace(/\\u\{([0-9A-Fa-f]+)\}/g, (_, hex) => {
        const cp = parseInt(hex, 16);
        return String.fromCodePoint(cp);
    });
    // \uXXXX
    res = res.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => {
        const cp = parseInt(hex, 16);
        return String.fromCharCode(cp);
    });
    // U+XXXX (区切りのスペースも処理)
    res = res.replace(/U\+([0-9A-Fa-f]{4,6})(?:\s+)?/gi, (_, hex) => {
        const cp = parseInt(hex, 16);
        return String.fromCodePoint(cp);
    });
    return res;
}

/**
 * HTML数値文字参照（NCR）に変換
 */
export function textToHtmlEntities(
    text: string,
    format: "dec" | "hex" = "dec",
): string {
    const parts: string[] = [];
    for (const char of text) {
        const cp = char.codePointAt(0);
        if (cp === undefined) continue;
        if (format === "dec") {
            parts.push(`&#${cp};`);
        } else {
            parts.push(`&#x${cp.toString(16).toUpperCase()};`);
        }
    }
    return parts.join("");
}

/**
 * HTML数値文字参照（例: "&#12354;" や "&#x3042;"）をテキストに復元
 */
export function parseHtmlEntitiesToText(input: string): string {
    // 16進: &#x3042;
    let res = input.replace(/&#x([0-9A-Fa-f]+);/gi, (_, hex) => {
        const cp = parseInt(hex, 16);
        return String.fromCodePoint(cp);
    });
    // 10進: &#12354;
    res = res.replace(/&#([0-9]+);/g, (_, dec) => {
        const cp = parseInt(dec, 10);
        return String.fromCodePoint(cp);
    });
    return res;
}

/**
 * Base64 相互変換
 */
export function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
    const clean = base64.trim().replace(/\s/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * URLパーセントエンコード（文字コード指定）
 */
export function urlEncodeWithEncoding(
    text: string,
    encoding: SupportedEncoding = "UTF8",
): string {
    const bytes = encodeStringToBytes(text, encoding);
    let result = "";
    for (const b of bytes) {
        // 英数や一部のアンリザーブド文字はそのまま
        if (
            (b >= 0x30 && b <= 0x39) || // 0-9
            (b >= 0x41 && b <= 0x5a) || // A-Z
            (b >= 0x61 && b <= 0x7a) || // a-z
            b === 0x2d || // -
            b === 0x5f || // _
            b === 0x2e || // .
            b === 0x7e // ~
        ) {
            result += String.fromCharCode(b);
        } else {
            result += `%${b.toString(16).padStart(2, "0").toUpperCase()}`;
        }
    }
    return result;
}

/**
 * URLパーセントエンコードをデコード
 */
export function urlDecodeWithEncoding(
    percentStr: string,
    encoding: SupportedEncoding = "UTF8",
): string {
    const bytes: number[] = [];
    let i = 0;
    while (i < percentStr.length) {
        if (percentStr[i] === "%" && i + 2 < percentStr.length) {
            const hex = percentStr.substring(i + 1, i + 3);
            const val = parseInt(hex, 16);
            if (!isNaN(val)) {
                bytes.push(val);
                i += 3;
                continue;
            }
        } else if (percentStr[i] === "+") {
            bytes.push(0x20); // space
            i++;
            continue;
        }
        bytes.push(percentStr.charCodeAt(i));
        i++;
    }
    return decodeBytes(new Uint8Array(bytes), encoding).text;
}

/**
 * Unicode正規化
 */
export function normalizeUnicode(
    text: string,
    form: "NFC" | "NFD" | "NFKC" | "NFKD",
): string {
    return text.normalize(form);
}

/* ========================================================
   文字インスペクター（1文字ごとの詳細コード解析）
   ======================================================== */
export interface CharInspection {
    char: string;
    codePoint: string;
    decimal: number;
    utf8Hex: string;
    sjisHex: string;
    eucHex: string;
    category: string;
}

export function inspectCharacters(text: string, limit: number = 100): CharInspection[] {
    const results: CharInspection[] = [];
    let count = 0;

    for (const char of text) {
        if (count >= limit) break;
        const cp = char.codePointAt(0);
        if (cp === undefined) continue;

        const utf8 = encodeStringToBytes(char, "UTF8");
        const sjis = encodeStringToBytes(char, "SJIS");
        const euc = encodeStringToBytes(char, "EUCJP");

        // 簡易文字種別判定
        let category = "その他記号";
        if (cp >= 0x3040 && cp <= 0x309f) category = "ひらがな";
        else if (cp >= 0x30a0 && cp <= 0x30ff) category = "カタカナ";
        else if (cp >= 0xff66 && cp <= 0xff9f) category = "半角カナ";
        else if (
            (cp >= 0x4e00 && cp <= 0x9fff) ||
            (cp >= 0x3400 && cp <= 0x4dbf) ||
            (cp >= 0x20000 && cp <= 0x2a6df)
        )
            category = "漢字";
        else if ((cp >= 0x0041 && cp <= 0x005a) || (cp >= 0x0061 && cp <= 0x007a))
            category = "半角英字";
        else if (cp >= 0x0030 && cp <= 0x0039) category = "半角数字";
        else if (cp >= 0xff01 && cp <= 0xff5e) category = "全角英数記号";
        else if (cp > 0xffff) category = "絵文字・サロゲートペア";

        results.push({
            char: char === "\n" ? "\\n" : char === "\r" ? "\\r" : char === "\t" ? "\\t" : char,
            codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`,
            decimal: cp,
            utf8Hex: bytesToHexString(utf8, "space"),
            sjisHex: sjis.length > 0 ? bytesToHexString(sjis, "space") : "-",
            eucHex: euc.length > 0 ? bytesToHexString(euc, "space") : "-",
            category,
        });
        count++;
    }

    return results;
}

/* ========================================================
   文字化け修復ロジック
   ======================================================== */
export interface MojibakeCandidate {
    label: string;
    description: string;
    restoredText: string;
}

export function fixMojibakeCandidates(corruptedText: string): MojibakeCandidate[] {
    if (!corruptedText || corruptedText.trim().length === 0) return [];

    const candidates: MojibakeCandidate[] = [];

    // パターン1: UTF-8 のテキストを Shift_JIS で開いてしまったケース (例: 縺薙ｓ縺ｫ縺｡縺ｯ)
    try {
        const sjisCodes = Encoding.stringToCode(corruptedText);
        const sjisBytes = Encoding.convert(sjisCodes, {
            to: "SJIS",
            from: "UNICODE",
        });
        const restoredUnicode = Encoding.convert(sjisBytes, {
            to: "UNICODE",
            from: "UTF8",
        });
        const restored = Encoding.codeToString(restoredUnicode);
        if (restored && restored !== corruptedText && !restored.includes("\uFFFD")) {
            candidates.push({
                label: "UTF-8 を Shift_JIS で開いた文字化けの修復",
                description: "「縺...」などの文字化け（Shift_JIS → UTF-8デコード）",
                restoredText: restored,
            });
        }
    } catch {
        // ignore
    }

    // パターン2: UTF-8 のテキストを Latin-1 / Windows-1252 で開いてしまったケース (例: ã‚ã„ã†)
    try {
        const bytes = new Uint8Array(corruptedText.length);
        let valid = true;
        for (let i = 0; i < corruptedText.length; i++) {
            const c = corruptedText.charCodeAt(i);
            if (c > 255) {
                valid = false;
                break;
            }
            bytes[i] = c;
        }
        if (valid) {
            const restored = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
            if (restored && restored !== corruptedText) {
                candidates.push({
                    label: "UTF-8 を Latin-1 (ISO-8859-1) で開いた文字化けの修復",
                    description: "「ã‚...」などの文字化け（Latin-1 → UTF-8デコード）",
                    restoredText: restored,
                });
            }
        }
    } catch {
        // ignore
    }

    // パターン3: EUC-JP のテキストを UTF-8 で開いてしまったケース
    try {
        const utf8Bytes = Encoding.convert(Encoding.stringToCode(corruptedText), {
            to: "UTF8",
            from: "UNICODE",
        });
        const restoredUnicode = Encoding.convert(utf8Bytes, {
            to: "UNICODE",
            from: "EUCJP",
        });
        const restored = Encoding.codeToString(restoredUnicode);
        if (restored && restored !== corruptedText && !restored.includes("\uFFFD")) {
            candidates.push({
                label: "EUC-JP を UTF-8 で開いた文字化けの修復",
                description: "UTF-8 → EUC-JPデコード",
                restoredText: restored,
            });
        }
    } catch {
        // ignore
    }

    // パターン4: Shift_JIS のテキストを EUC-JP で開いてしまったケース
    try {
        const eucBytes = Encoding.convert(Encoding.stringToCode(corruptedText), {
            to: "EUCJP",
            from: "UNICODE",
        });
        const restoredUnicode = Encoding.convert(eucBytes, {
            to: "UNICODE",
            from: "SJIS",
        });
        const restored = Encoding.codeToString(restoredUnicode);
        if (restored && restored !== corruptedText && !restored.includes("\uFFFD")) {
            candidates.push({
                label: "Shift_JIS を EUC-JP で開いた文字化けの修復",
                description: "EUC-JP → Shift_JISデコード",
                restoredText: restored,
            });
        }
    } catch {
        // ignore
    }

    // パターン5: EUC-JP のテキストを Shift_JIS で開いてしまったケース
    try {
        const sjisBytes = Encoding.convert(Encoding.stringToCode(corruptedText), {
            to: "SJIS",
            from: "UNICODE",
        });
        const restoredUnicode = Encoding.convert(sjisBytes, {
            to: "UNICODE",
            from: "EUCJP",
        });
        const restored = Encoding.codeToString(restoredUnicode);
        if (restored && restored !== corruptedText && !restored.includes("\uFFFD")) {
            candidates.push({
                label: "EUC-JP を Shift_JIS で開いた文字化けの修復",
                description: "Shift_JIS → EUC-JPデコード",
                restoredText: restored,
            });
        }
    } catch {
        // ignore
    }

    return candidates;
}
