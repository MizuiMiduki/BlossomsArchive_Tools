import { createSignal, createMemo, createEffect, onSettled, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";
import type {
    SupportedEncoding,
    InputEncodingOption,
    NewlineOption,
    EncodingOptionDetail,
    MojibakeCandidate,
} from "../utils/charsetConverter";

type CharsetConverterModule = typeof import("../utils/charsetConverter");

const isTestEnv =
    typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

let cachedConverterMod: CharsetConverterModule | null = null;
let converterModPromise: Promise<CharsetConverterModule> | null = null;

function loadConverterMod(): Promise<CharsetConverterModule> {
    if (!converterModPromise) {
        converterModPromise = import("../utils/charsetConverter").then((mod) => {
            cachedConverterMod = mod;
            return mod;
        });
    }
    return converterModPromise;
}

if (isTestEnv) {
    loadConverterMod();
}

const ENCODING_OPTIONS: EncodingOptionDetail[] = [
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

function normalizeUnicode(
    text: string,
    form: "NFC" | "NFD" | "NFKC" | "NFKD",
): string {
    if (!text) return "";
    return text.normalize(form);
}

type ActiveTab =
    | "text"
    | "code-formats"
    | "inspector"
    | "file"
    | "mojibake"
    | "normalize";

export default function CharsetConverter() {
    const { title, description } = usePageI18n("/charset-converter", {
        defaultTitle: "文字コード総合変換ツール",
        defaultDescription:
            "UTF-8、Shift_JIS、EUC-JP、JIS、UTF-16/32、Latin-1の文字コード・改行コード相互変換、16進数(HEX)・進数・Unicode表記・HTML数値文字参照・Base64・URLエンコード・Unicode正規化・文字化け復元まで完全対応。",
    });
    let containerRef: HTMLDivElement | undefined;

    // タブ状態
    const [activeTab, setActiveTab] = createSignal<ActiveTab>("text");

    // テキスト変換ステート
    const [inputText, setInputText] = createSignal("");
    const [fromEncoding, setFromEncoding] = createSignal<InputEncodingOption>("AUTO");
    const [toEncoding, setToEncoding] = createSignal<SupportedEncoding>("SJIS");
    const [newlineOption, setNewlineOption] = createSignal<NewlineOption>("none");
    const [copied, setCopied] = createSignal(false);
    const [showHexDump, setShowHexDump] = createSignal(false);

    // コード表記・進数変換ステート
    const [cfInput, setCfInput] = createSignal("");
    const [cfEncoding, setCfEncoding] = createSignal<SupportedEncoding>("UTF8");
    const [cfHexFormat, setCfHexFormat] = createSignal<"space" | "comma" | "0x-comma" | "percent">("space");
    const [cfUnicodeFormat, setCfUnicodeFormat] = createSignal<"u-plus" | "backslash-u" | "backslash-u-bracket">("u-plus");
    const [cfHtmlFormat, setCfHtmlFormat] = createSignal<"dec" | "hex">("dec");
    const [cfCopiedKey, setCfCopiedKey] = createSignal<string | null>(null);

    // ファイル変換ステート
    const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
    const [fileDetectedEncoding, setFileDetectedEncoding] = createSignal<string>("");
    const [fileContentPreview, setFileContentPreview] = createSignal<string>("");
    const [fileBytes, setFileBytes] = createSignal<Uint8Array | null>(null);
    const [isConvertingFile, setIsConvertingFile] = createSignal(false);
    const [isDragging, setIsDragging] = createSignal(false);

    // 文字化け修復ステート
    const [mojibakeInput, setMojibakeInput] = createSignal("");
    const [mojibakeCopiedIndex, setMojibakeCopiedIndex] = createSignal<number | null>(null);

    // Unicode正規化ステート
    const [normalizeInput, setNormalizeInput] = createSignal("");
    const [normCopiedKey, setNormCopiedKey] = createSignal<string | null>(null);

    // 変換エンジンモジュール (240KBの辞書を初回LCPチャンクから分離して遅延読込)
    const [converterMod, setConverterMod] =
        createSignal<CharsetConverterModule | null>(cachedConverterMod);

    const ensureConverterLoaded = () => {
        if (!cachedConverterMod) {
            loadConverterMod().then((mod) => setConverterMod(() => mod));
        } else {
            setConverterMod(() => cachedConverterMod);
        }
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
        if (isTestEnv || cachedConverterMod) {
            ensureConverterLoaded();
            return;
        }
        window.addEventListener("pointerdown", ensureConverterLoaded, {
            passive: true,
            once: true,
        });
        window.addEventListener("touchstart", ensureConverterLoaded, {
            passive: true,
            once: true,
        });
        window.addEventListener("keydown", ensureConverterLoaded, {
            passive: true,
            once: true,
        });
        return () => {
            window.removeEventListener("pointerdown", ensureConverterLoaded);
            window.removeEventListener("touchstart", ensureConverterLoaded);
            window.removeEventListener("keydown", ensureConverterLoaded);
        };
    });

    // テキスト変換結果
    const textConversionResult = createMemo(() => {
        const text = inputText();
        const mod = converterMod() ?? cachedConverterMod;
        if (!text) {
            return {
                text: "",
                bytes: new Uint8Array(),
                byteCount: 0,
                charCount: 0,
                detectedInputEncoding: "-",
                hasUnsupportedChars: false,
                unsupportedChars: [],
            };
        }
        if (!mod) {
            ensureConverterLoaded();
            return {
                text: "",
                bytes: new Uint8Array(),
                byteCount: 0,
                charCount: 0,
                detectedInputEncoding: "-",
                hasUnsupportedChars: false,
                unsupportedChars: [],
            };
        }
        return mod.convertText(text, toEncoding(), newlineOption());
    });

    // 16進ダンプ文字列（ダンプ表示が有効な時のみ生成）
    const hexDumpString = createMemo(() => {
        if (!showHexDump()) return "";
        const mod = converterMod() ?? cachedConverterMod;
        const res = textConversionResult();
        if (!mod || res.bytes.length === 0) return "";
        return mod.generateHexDump(res.bytes);
    });

    // コード表記変換の各種出力
    const cfOutputs = createMemo(() => {
        const text = cfInput();
        const enc = cfEncoding();
        const mod = converterMod() ?? cachedConverterMod;
        if (!text || !mod) {
            return {
                hex: "",
                dec: "",
                bin: "",
                unicodeEscape: "",
                htmlEntity: "",
                base64: "",
                urlEncoded: "",
                byteLength: 0,
            };
        }
        const bytes = mod.encodeStringToBytes(text, enc);
        return {
            hex: mod.bytesToHexString(bytes, cfHexFormat()),
            dec: mod.bytesToDecString(bytes, "space"),
            bin: mod.bytesToBinString(bytes),
            unicodeEscape: mod.textToUnicodeEscapes(text, cfUnicodeFormat()),
            htmlEntity: mod.textToHtmlEntities(text, cfHtmlFormat()),
            base64: mod.bytesToBase64(bytes),
            urlEncoded: mod.urlEncodeWithEncoding(text, enc),
            byteLength: bytes.length,
        };
    });

    // 文字インスペクター結果（インスペクタータブ選択時のみ評価）
    const inspectedChars = createMemo(() => {
        if (activeTab() !== "inspector") return [];
        const mod = converterMod() ?? cachedConverterMod;
        if (!mod) return [];
        return mod.inspectCharacters(inputText() || cfInput());
    });

    // 文字化け修復候補（文字化け修復タブ選択時のみ評価）
    const mojibakeCandidates = createMemo((): MojibakeCandidate[] => {
        if (activeTab() !== "mojibake") return [];
        const mod = converterMod() ?? cachedConverterMod;
        if (!mod) return [];
        return mod.fixMojibakeCandidates(mojibakeInput());
    });

    // ファイル読み込み後、変換元文字コード変更時にプレビューを再デコード
    createEffect(
        () => ({ bytes: fileBytes(), enc: fromEncoding(), mod: converterMod() }),
        ({ bytes, enc, mod }) => {
            if (!bytes || !mod) return;
            const decoded = mod.decodeBytes(bytes, enc);
            setFileDetectedEncoding(decoded.detectedEncoding);
            setFileContentPreview(
                decoded.text.length > 1000
                    ? decoded.text.substring(0, 1000) + "\n... (以下省略)"
                    : decoded.text,
            );
        },
    );

    // クリップボードへコピー
    const handleCopyText = async (textToCopy: string, onDone?: () => void) => {
        try {
            await navigator.clipboard.writeText(textToCopy);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
        if (onDone) {
            onDone();
        }
    };

    // テキストダウンロード
    const handleDownloadText = () => {
        const res = textConversionResult();
        if (res.bytes.length === 0) return;

        const blob = new Blob([res.bytes as unknown as BlobPart], {
            type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const extMap: Record<SupportedEncoding, string> = {
            UTF8: "utf8.txt",
            UTF8_BOM: "utf8bom.txt",
            SJIS: "sjis.txt",
            EUCJP: "eucjp.txt",
            JIS: "jis.txt",
            UTF16LE: "utf16le.txt",
            UTF16BE: "utf16be.txt",
            UTF32LE: "utf32le.txt",
            UTF32BE: "utf32be.txt",
            LATIN1: "latin1.txt",
            ASCII: "ascii.txt",
        };
        a.download = `converted_${extMap[toEncoding()] || "text.txt"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ファイル処理
    const processFile = async (file: File) => {
        setSelectedFile(file);
        setIsConvertingFile(true);

        try {
            const mod = converterMod() ?? cachedConverterMod ?? (await loadConverterMod());
            setConverterMod(() => mod);
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            setFileBytes(bytes);

            const decoded = mod.decodeBytes(bytes, fromEncoding());
            setFileDetectedEncoding(decoded.detectedEncoding);
            setFileContentPreview(
                decoded.text.length > 1000
                    ? decoded.text.substring(0, 1000) + "\n... (以下省略)"
                    : decoded.text,
            );
        } catch (error) {
            console.error(error);
            setFileContentPreview("ファイルの読み込み中にエラーが発生しました。");
        } finally {
            setIsConvertingFile(false);
        }
    };

    const handleFileInput = (e: Event) => {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            processFile(input.files[0]);
        }
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleDownloadConvertedFile = () => {
        const file = selectedFile();
        const bytes = fileBytes();
        const mod = converterMod();
        if (!file || !bytes || !mod) return;

        const decoded = mod.decodeBytes(bytes, fromEncoding());
        const adjustedText = mod.convertNewline(decoded.text, newlineOption());
        const convertedBytes = mod.encodeStringToBytes(adjustedText, toEncoding());

        const blob = new Blob([convertedBytes as unknown as BlobPart], {
            type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const originalName = file.name;
        const lastDot = originalName.lastIndexOf(".");
        let baseName = originalName;
        let ext = "";
        if (lastDot !== -1) {
            baseName = originalName.substring(0, lastDot);
            ext = originalName.substring(lastDot);
        }
        a.download = `${baseName}_${toEncoding().toLowerCase()}${ext || ".txt"}`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 入力と出力の入れ替え
    const handleSwapEncoding = () => {
        const curFrom = fromEncoding();
        const curTo = toEncoding();
        if (curFrom !== "AUTO") {
            setToEncoding(curFrom as SupportedEncoding);
        }
        setFromEncoding(curTo);

        const res = textConversionResult();
        if (res.text) {
            setInputText(res.text);
        }
    };

    return (
        <div ref={containerRef} class="ba-page">
            {/* ヘッダー */}
            <div class="ba-text-center ba-stack-3">
                <h1 class="ba-title">
                    <BudouX text={title()} />
                </h1>
                <p
                    class="ba-text-muted ba-text-sm"
                    style={{ "max-width": "42rem", "margin-inline": "auto", "margin-block": 0 }}
                >
                    <BudouX text={description()} />
                </p>
                <div class="ba-flex ba-items-center ba-justify-center ba-gap-2 ba-text-xs ba-font-bold ba-text-success">
                    <span
                        style={{
                            display: "inline-block",
                            width: "0.5rem",
                            height: "0.5rem",
                            "border-radius": "9999px",
                            "background-color": "var(--ba-success)",
                        }}
                    ></span>
                    <span>ブラウザ完全ローカル処理（外部通信なしで機密情報も安全・高速変換）</span>
                </div>
            </div>

            {/* ナビゲーションタブ */}
            <div
                class="ba-w-full ba-scroll-x"
                style={{ "border-bottom": "1px solid var(--ba-border)", "padding-bottom": "0.75rem" }}
            >
                <div class="ba-flex ba-justify-center" style={{ "min-width": "max-content", "padding-inline": "0.25rem" }}>
                    <div class="ba-tabs" style={{ "flex-wrap": "nowrap" }}>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "text" ? "is-active" : ""}`}
                            style={{ "white-space": "nowrap" }}
                            onClick={() => setActiveTab("text")}
                        >
                            テキスト文字コード変換
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "code-formats" ? "is-active" : ""}`}
                            style={{ "white-space": "nowrap" }}
                            onClick={() => setActiveTab("code-formats")}
                        >
                            進数・コード表記変換
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "inspector" ? "is-active" : ""}`}
                            style={{ "white-space": "nowrap" }}
                            onClick={() => setActiveTab("inspector")}
                        >
                            1文字コード解析
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "file" ? "is-active" : ""}`}
                            style={{ "white-space": "nowrap" }}
                            onClick={() => setActiveTab("file")}
                        >
                            ファイル変換
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "normalize" ? "is-active" : ""}`}
                            style={{ "white-space": "nowrap" }}
                            onClick={() => setActiveTab("normalize")}
                        >
                            Unicode正規化 (NFC/NFD)
                        </button>
                        <button
                            type="button"
                            class={`ba-tab ${activeTab() === "mojibake" ? "is-active" : ""}`}
                            style={{ "white-space": "nowrap" }}
                            onClick={() => setActiveTab("mojibake")}
                        >
                            文字化け修復
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB 1: テキスト文字コード変換 */}
            <Show when={activeTab() === "text"}>
                <div class="ba-stack-6">
                    {/* 文字コード設定パネル */}
                    <div class="ba-card ba-stack-4">
                        <div class="ba-grid-3 ba-items-end">
                            <div class="ba-field">
                                <label class="ba-label">
                                    <span>変換元文字コード</span>
                                </label>
                                <select
                                    class="ba-select"
                                    aria-label="変換元文字コード"
                                    value={fromEncoding()}
                                    onChange={(e) =>
                                        setFromEncoding(e.currentTarget.value as InputEncodingOption)
                                    }
                                >
                                    <option value="AUTO">自動判別 (Auto Detect)</option>
                                    <For each={ENCODING_OPTIONS}>
                                        {(opt) => <option value={opt.value}>{opt.label}</option>}
                                    </For>
                                </select>
                            </div>

                            <div class="ba-flex ba-items-center ba-justify-center" style={{ "padding-bottom": "0.15rem" }}>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--circle"
                                    title="文字コードとテキストを入れ替え"
                                    aria-label="文字コードとテキストを入れ替え"
                                    onClick={handleSwapEncoding}
                                >
                                    ⇄
                                </button>
                            </div>

                            <div class="ba-field">
                                <label class="ba-label">
                                    <span>変換先文字コード</span>
                                </label>
                                <select
                                    class="ba-select"
                                    style={{ "border-color": "var(--ba-primary)" }}
                                    aria-label="変換先文字コード"
                                    value={toEncoding()}
                                    onChange={(e) =>
                                        setToEncoding(e.currentTarget.value as SupportedEncoding)
                                    }
                                >
                                    <For each={ENCODING_OPTIONS}>
                                        {(opt) => (
                                            <option value={opt.value}>
                                                {opt.label} - {opt.description}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </div>

                        {/* 改行コード変換設定 */}
                        <div
                            class="ba-flex ba-flex-wrap ba-items-center ba-gap-4 ba-text-sm"
                            style={{ "padding-top": "0.75rem", "border-top": "1px solid var(--ba-border)" }}
                        >
                            <span class="ba-font-bold ba-text-muted">改行コード変換:</span>
                            <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="newline"
                                    class="ba-radio"
                                    checked={newlineOption() === "none"}
                                    onChange={() => setNewlineOption("none")}
                                />
                                <span>変換しない（維持）</span>
                            </label>
                            <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="newline"
                                    class="ba-radio"
                                    checked={newlineOption() === "LF"}
                                    onChange={() => setNewlineOption("LF")}
                                />
                                <span>LF (Unix / macOS)</span>
                            </label>
                            <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="newline"
                                    class="ba-radio"
                                    checked={newlineOption() === "CRLF"}
                                    onChange={() => setNewlineOption("CRLF")}
                                />
                                <span>CRLF (Windows)</span>
                            </label>
                            <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                <input
                                    type="radio"
                                    name="newline"
                                    class="ba-radio"
                                    checked={newlineOption() === "CR"}
                                    onChange={() => setNewlineOption("CR")}
                                />
                                <span>CR (Classic Mac)</span>
                            </label>
                        </div>
                    </div>

                    {/* 入力と出力のテキストエリア */}
                    <div class="ba-grid-2">
                        <div class="ba-card ba-stack-3">
                            <div class="ba-flex ba-items-center ba-justify-between">
                                <h2 class="ba-text-base ba-font-bold" style={{ margin: 0 }}>入力テキスト</h2>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--ghost ba-btn--xs ba-text-danger"
                                    onClick={() => setInputText("")}
                                >
                                    クリア
                                </button>
                            </div>

                            <textarea
                                class="ba-textarea ba-mono ba-text-sm ba-flex-1"
                                style={{ "min-height": "16rem", "line-height": 1.6 }}
                                placeholder="変換したいテキストをここに入力または貼り付け..."
                                aria-label="変換したいテキストの入力"
                                value={inputText()}
                                onInput={(e) => setInputText(e.currentTarget.value)}
                            />

                            <div class="ba-flex ba-justify-between ba-items-center ba-text-xs ba-text-muted">
                                <span>文字数: {Array.from(inputText()).length} 文字</span>
                                <span>
                                    行数: {inputText() ? inputText().split(/\r\n|\r|\n/).length : 0} 行
                                </span>
                            </div>
                        </div>

                        <div class="ba-card ba-stack-3">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                <h2 class="ba-text-base ba-font-bold ba-flex ba-items-center ba-gap-2" style={{ margin: 0 }}>
                                    <span>変換結果プレビュー</span>
                                    <span class="ba-badge ba-badge--primary">
                                        {toEncoding()}
                                    </span>
                                </h2>
                                <div class="ba-flex ba-items-center ba-gap-2">
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs ba-text-primary"
                                        style={{ "border-color": "var(--ba-primary)" }}
                                        onClick={() =>
                                            handleCopyText(textConversionResult().text, () => {
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            })
                                        }
                                        disabled={!textConversionResult().text}
                                    >
                                        {copied() ? "コピー完了！" : "テキストをコピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--primary ba-btn--xs"
                                        onClick={handleDownloadText}
                                        disabled={textConversionResult().bytes.length === 0}
                                    >
                                        ファイル保存
                                    </button>
                                </div>
                            </div>

                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-sm ba-flex-1"
                                style={{
                                    "min-height": "16rem",
                                    "line-height": 1.6,
                                    "background-color": "var(--ba-surface-2)",
                                }}
                                placeholder="変換後のテキストがここに表示されます..."
                                aria-label="変換後のテキスト結果プレビュー"
                                value={textConversionResult().text}
                            />

                            <div class="ba-flex ba-justify-between ba-items-center ba-text-xs ba-text-muted">
                                <span>出力文字数: {textConversionResult().charCount} 文字</span>
                                <span class="ba-font-bold ba-text-primary">
                                    出力サイズ: {textConversionResult().byteCount} バイト
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 未対応文字警告 */}
                    <Show when={textConversionResult().hasUnsupportedChars}>
                        <div class="ba-alert ba-alert--warning" style={{ "align-items": "flex-start" }}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="ba-icon-lg ba-shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                            <div class="ba-stack-1">
                                <h3 class="ba-font-bold ba-text-sm" style={{ margin: 0 }}>文字コード未対応の文字が含まれています</h3>
                                <div class="ba-text-xs" style={{ "font-weight": 500 }}>
                                    選択された「{toEncoding()}」では表現できない文字（絵文字や一部の機種固有文字など）が含まれているため、変換時に置換文字や「?」に変換される場合があります。
                                    <div class="ba-mono ba-text-xs ba-font-bold" style={{ "margin-top": "0.25rem" }}>
                                        該当文字: {textConversionResult().unsupportedChars.slice(0, 10).join(" ")}
                                        {textConversionResult().unsupportedChars.length > 10 ? " ほか" : ""}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* 16進バイナリダンプ */}
                    <Show when={textConversionResult().bytes.length > 0}>
                        <div class="ba-card ba-stack-3">
                            <div class="ba-flex ba-items-center ba-justify-between">
                                <h3 class="ba-text-sm ba-font-bold ba-flex ba-items-center ba-gap-2" style={{ margin: 0 }}>
                                    <span>バイナリ16進ダンプ（Hex Dump）</span>
                                    <span class="ba-text-xs ba-text-muted" style={{ "font-weight": 400 }}>
                                        （先頭最大512バイト）
                                    </span>
                                </h3>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                    onClick={() => setShowHexDump(!showHexDump())}
                                >
                                    {showHexDump() ? "閉じる ▲" : "表示する ▼"}
                                </button>
                            </div>
                            <Show when={showHexDump()}>
                                <pre class="ba-code" style={{ "line-height": 1.35 }}>
                                    {hexDumpString()}
                                </pre>
                            </Show>
                        </div>
                    </Show>
                </div>
            </Show>

            {/* TAB 2: 進数・コード表記変換（競合DenCode/AHREF対抗） */}
            <Show when={activeTab() === "code-formats"}>
                <div class="ba-stack-6">
                    <div class="ba-card ba-stack-4">
                        <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-4">
                            <div>
                                <h2 class="ba-section-title">
                                    進数・コード表記・エスケープ相互変換
                                </h2>
                                <p class="ba-text-xs ba-text-muted" style={{ "margin-top": "0.25rem", "margin-bottom": 0 }}>
                                    テキストを16進数(HEX)・10進数(DEC)・2進数(BIN)・Unicodeコードポイント・HTML数値文字参照・Base64・URLエンコードに一括変換します。
                                </p>
                            </div>
                            <div class="ba-flex ba-items-center ba-gap-2">
                                <span class="ba-text-xs ba-font-bold">基準文字コード:</span>
                                <select
                                    class="ba-select ba-select--sm ba-mono"
                                    style={{ width: "auto" }}
                                    aria-label="基準文字コード"
                                    value={cfEncoding()}
                                    onChange={(e) =>
                                        setCfEncoding(e.currentTarget.value as SupportedEncoding)
                                    }
                                >
                                    <option value="UTF8">UTF-8</option>
                                    <option value="SJIS">Shift_JIS (CP932)</option>
                                    <option value="EUCJP">EUC-JP</option>
                                    <option value="JIS">JIS (ISO-2022-JP)</option>
                                    <option value="UTF16LE">UTF-16LE</option>
                                    <option value="ASCII">ASCII</option>
                                </select>
                            </div>
                        </div>

                        <div class="ba-field">
                            <label class="ba-label">
                                <span>入力テキスト</span>
                            </label>
                            <textarea
                                class="ba-textarea ba-mono ba-text-sm"
                                style={{ "min-height": "5.5rem" }}
                                placeholder="変換したいテキストを入力..."
                                aria-label="変換したい入力テキスト"
                                value={cfInput()}
                                onInput={(e) => setCfInput(e.currentTarget.value)}
                            />
                            <div class="ba-text-xs ba-text-muted">
                                バイト数 ({cfEncoding()}): {cfOutputs().byteLength} bytes
                            </div>
                        </div>
                    </div>

                    {/* 各フォーマットの出力カード群 */}
                    <div class="ba-grid-2">
                        {/* 16進数 (HEX) */}
                        <div class="ba-card ba-stack-2" style={{ padding: "1rem" }}>
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-bold ba-text-sm ba-text-primary">16進数バイト列 (HEX)</span>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1">
                                    <select
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto", "font-size": "0.75rem", padding: "0.2rem 0.5rem" }}
                                        aria-label="16進数バイト列の表記フォーマット"
                                        value={cfHexFormat()}
                                        onChange={(e) =>
                                            setCfHexFormat(e.currentTarget.value as any)
                                        }
                                    >
                                        <option value="space">スペース (E3 81 82)</option>
                                        <option value="comma">カンマ (E3, 81)</option>
                                        <option value="0x-comma">0xカンマ (0xE3, 0x81)</option>
                                        <option value="percent">パーセント (%E3%81%82)</option>
                                    </select>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() =>
                                            handleCopyText(cfOutputs().hex, () => {
                                                setCfCopiedKey("hex");
                                                setTimeout(() => setCfCopiedKey(null), 1500);
                                            })
                                        }
                                    >
                                        {cfCopiedKey() === "hex" ? "コピー完了！" : "コピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                        title="16進数からテキストへ逆変換"
                                        onClick={() => {
                                            const mod = converterMod();
                                            if (!mod) return;
                                            const bytes = mod.parseHexToBytes(cfOutputs().hex);
                                            const text = mod.decodeBytes(bytes, cfEncoding()).text;
                                            setCfInput(text);
                                        }}
                                    >
                                        逆変換 ↩
                                    </button>
                                </div>
                            </div>
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "5rem", "min-height": "5rem", "background-color": "var(--ba-surface-2)" }}
                                aria-label="16進数バイト列 (HEX) 出力"
                                value={cfOutputs().hex}
                            />
                        </div>

                        {/* 10進数 (DEC) */}
                        <div class="ba-card ba-stack-2" style={{ padding: "1rem" }}>
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-bold ba-text-sm ba-text-primary">10進数バイト列 (DEC)</span>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1">
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() =>
                                            handleCopyText(cfOutputs().dec, () => {
                                                setCfCopiedKey("dec");
                                                setTimeout(() => setCfCopiedKey(null), 1500);
                                            })
                                        }
                                    >
                                        {cfCopiedKey() === "dec" ? "コピー完了！" : "コピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                        title="10進数からテキストへ逆変換"
                                        onClick={() => {
                                            const mod = converterMod();
                                            if (!mod) return;
                                            const bytes = mod.parseDecToBytes(cfOutputs().dec);
                                            const text = mod.decodeBytes(bytes, cfEncoding()).text;
                                            setCfInput(text);
                                        }}
                                    >
                                        逆変換 ↩
                                    </button>
                                </div>
                            </div>
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "5rem", "min-height": "5rem", "background-color": "var(--ba-surface-2)" }}
                                aria-label="10進数バイト列 (DEC) 出力"
                                value={cfOutputs().dec}
                            />
                        </div>

                        {/* 2進数 (BIN) */}
                        <div class="ba-card ba-stack-2" style={{ padding: "1rem" }}>
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-bold ba-text-sm ba-text-primary">2進数ビット列 (BIN)</span>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1">
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() =>
                                            handleCopyText(cfOutputs().bin, () => {
                                                setCfCopiedKey("bin");
                                                setTimeout(() => setCfCopiedKey(null), 1500);
                                            })
                                        }
                                    >
                                        {cfCopiedKey() === "bin" ? "コピー完了！" : "コピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                        title="2進数からテキストへ逆変換"
                                        onClick={() => {
                                            const mod = converterMod();
                                            if (!mod) return;
                                            const bytes = mod.parseBinToBytes(cfOutputs().bin);
                                            const text = mod.decodeBytes(bytes, cfEncoding()).text;
                                            setCfInput(text);
                                        }}
                                    >
                                        逆変換 ↩
                                    </button>
                                </div>
                            </div>
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "5rem", "min-height": "5rem", "background-color": "var(--ba-surface-2)" }}
                                aria-label="2進数ビット列 (BIN) 出力"
                                value={cfOutputs().bin}
                            />
                        </div>

                        {/* Unicodeコードポイント */}
                        <div class="ba-card ba-stack-2" style={{ padding: "1rem" }}>
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-bold ba-text-sm ba-text-primary">Unicode表記</span>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1">
                                    <select
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto", "font-size": "0.75rem", padding: "0.2rem 0.5rem" }}
                                        aria-label="Unicode表記フォーマット"
                                        value={cfUnicodeFormat()}
                                        onChange={(e) =>
                                            setCfUnicodeFormat(e.currentTarget.value as any)
                                        }
                                    >
                                        <option value="u-plus">U+XXXX</option>
                                        <option value="backslash-u">\uXXXX</option>
                                        <option value="backslash-u-bracket">\u&#123;XXXX&#125;</option>
                                    </select>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() =>
                                            handleCopyText(cfOutputs().unicodeEscape, () => {
                                                setCfCopiedKey("unicode");
                                                setTimeout(() => setCfCopiedKey(null), 1500);
                                            })
                                        }
                                    >
                                        {cfCopiedKey() === "unicode" ? "コピー完了！" : "コピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                        title="Unicodeエスケープからテキストへ復元"
                                        onClick={() => {
                                            const mod = converterMod();
                                            if (!mod) return;
                                            const text = mod.parseUnicodeEscapesToText(cfOutputs().unicodeEscape);
                                            setCfInput(text);
                                        }}
                                    >
                                        復元 ↩
                                    </button>
                                </div>
                            </div>
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "5rem", "min-height": "5rem", "background-color": "var(--ba-surface-2)" }}
                                aria-label="Unicode表記出力"
                                value={cfOutputs().unicodeEscape}
                            />
                        </div>

                        {/* HTML数値文字参照 (NCR) */}
                        <div class="ba-card ba-stack-2" style={{ padding: "1rem" }}>
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-bold ba-text-sm ba-text-primary">HTML数値文字参照 (NCR)</span>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1">
                                    <select
                                        class="ba-select ba-select--sm"
                                        style={{ width: "auto", "font-size": "0.75rem", padding: "0.2rem 0.5rem" }}
                                        aria-label="HTML数値文字参照フォーマット"
                                        value={cfHtmlFormat()}
                                        onChange={(e) =>
                                            setCfHtmlFormat(e.currentTarget.value as any)
                                        }
                                    >
                                        <option value="dec">10進 (&#12354;)</option>
                                        <option value="hex">16進 (&#x3042;)</option>
                                    </select>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() =>
                                            handleCopyText(cfOutputs().htmlEntity, () => {
                                                setCfCopiedKey("html");
                                                setTimeout(() => setCfCopiedKey(null), 1500);
                                            })
                                        }
                                    >
                                        {cfCopiedKey() === "html" ? "コピー完了！" : "コピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                        title="数値文字参照からテキストへ復元"
                                        onClick={() => {
                                            const mod = converterMod();
                                            if (!mod) return;
                                            const text = mod.parseHtmlEntitiesToText(cfOutputs().htmlEntity);
                                            setCfInput(text);
                                        }}
                                    >
                                        復元 ↩
                                    </button>
                                </div>
                            </div>
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "5rem", "min-height": "5rem", "background-color": "var(--ba-surface-2)" }}
                                aria-label="HTML数値文字参照 (NCR) 出力"
                                value={cfOutputs().htmlEntity}
                            />
                        </div>

                        {/* Base64 */}
                        <div class="ba-card ba-stack-2" style={{ padding: "1rem" }}>
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-bold ba-text-sm ba-text-primary">Base64</span>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1">
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() =>
                                            handleCopyText(cfOutputs().base64, () => {
                                                setCfCopiedKey("b64");
                                                setTimeout(() => setCfCopiedKey(null), 1500);
                                            })
                                        }
                                    >
                                        {cfCopiedKey() === "b64" ? "コピー完了！" : "コピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                        title="Base64からテキストへ復元"
                                        onClick={() => {
                                            try {
                                                const mod = converterMod();
                                                if (!mod) return;
                                                const bytes = mod.base64ToBytes(cfOutputs().base64);
                                                const text = mod.decodeBytes(bytes, cfEncoding()).text;
                                                setCfInput(text);
                                            } catch {
                                                // ignore
                                            }
                                        }}
                                    >
                                        復元 ↩
                                    </button>
                                </div>
                            </div>
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "5rem", "min-height": "5rem", "background-color": "var(--ba-surface-2)" }}
                                aria-label="Base64 出力"
                                value={cfOutputs().base64}
                            />
                        </div>

                        {/* URLエンコード */}
                        <div class="ba-card ba-stack-2" style={{ padding: "1rem", "grid-column": "1 / -1" }}>
                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                <span class="ba-font-bold ba-text-sm ba-text-primary">
                                    URLパーセントエンコード ({cfEncoding()})
                                </span>
                                <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1">
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                        onClick={() =>
                                            handleCopyText(cfOutputs().urlEncoded, () => {
                                                setCfCopiedKey("url");
                                                setTimeout(() => setCfCopiedKey(null), 1500);
                                            })
                                        }
                                    >
                                        {cfCopiedKey() === "url" ? "コピー完了！" : "コピー"}
                                    </button>
                                    <button
                                        type="button"
                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-text-primary"
                                        title="URLエンコード文字列をデコード"
                                        onClick={() => {
                                            const mod = converterMod();
                                            if (!mod) return;
                                            const text = mod.urlDecodeWithEncoding(
                                                cfOutputs().urlEncoded,
                                                cfEncoding(),
                                            );
                                            setCfInput(text);
                                        }}
                                    >
                                        デコード ↩
                                    </button>
                                </div>
                            </div>
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{ height: "4rem", "min-height": "4rem", "background-color": "var(--ba-surface-2)" }}
                                aria-label="URLパーセントエンコード出力"
                                value={cfOutputs().urlEncoded}
                            />
                        </div>
                    </div>
                </div>
            </Show>

            {/* TAB 3: 1文字コード解析（文字インスペクター） */}
            <Show when={activeTab() === "inspector"}>
                <div class="ba-card ba-stack-4">
                    <div class="ba-stack-1">
                        <h2 class="ba-section-title">1文字コード解析インスペクター</h2>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                            入力された文字列の1文字ごとに、Unicodeコードポイント、10進数値、UTF-8・Shift_JIS・EUC-JPバイト列、文字種別を詳細に一覧表示します。
                        </p>
                    </div>

                    <div class="ba-table-wrap">
                        <table class="ba-table ba-mono ba-text-xs">
                            <thead style={{ "font-family": "var(--ba-font-sans)" }}>
                                <tr>
                                    <th>文字</th>
                                    <th>Unicode</th>
                                    <th>10進数</th>
                                    <th>UTF-8 (HEX)</th>
                                    <th>Shift_JIS (HEX)</th>
                                    <th>EUC-JP (HEX)</th>
                                    <th>種別</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={inspectedChars()}>
                                    {(row) => (
                                        <tr>
                                            <td
                                                class="ba-font-bold ba-text-base ba-text-primary"
                                                style={{ "font-family": "var(--ba-font-sans)" }}
                                            >
                                                {row.char}
                                            </td>
                                            <td>{row.codePoint}</td>
                                            <td>{row.decimal}</td>
                                            <td>{row.utf8Hex}</td>
                                            <td>{row.sjisHex}</td>
                                            <td>{row.eucHex}</td>
                                            <td style={{ "font-family": "var(--ba-font-sans)" }}>
                                                <span class="ba-badge ba-badge--neutral">
                                                    {row.category}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </div>
            </Show>

            {/* TAB 4: ファイル一括変換 */}
            <Show when={activeTab() === "file"}>
                <div class="ba-card ba-stack-6">
                    <div class="ba-stack-2">
                        <h2 class="ba-section-title">
                            テキストファイルの一括文字コード変換
                        </h2>
                        <p class="ba-text-sm ba-text-muted" style={{ margin: 0 }}>
                            .txt、.csv、.tsv、.html、.json、.log などのテキストファイルをドラッグ＆ドロップして、指定した文字コード（Shift_JIS、UTF-8等）に変換してダウンロードできます。
                        </p>
                    </div>

                    <div
                        class="ba-dropzone"
                        style={
                            isDragging()
                                ? {
                                      "border-color": "var(--ba-primary)",
                                      "background-color": "var(--ba-primary-soft)",
                                      padding: "2rem",
                                  }
                                : { padding: "2rem" }
                        }
                        onDrop={handleDrop}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                        }}
                        onClick={() => document.getElementById("file-input-el")?.click()}
                    >
                        <input
                            id="file-input-el"
                            type="file"
                            hidden
                            accept=".txt,.csv,.tsv,.html,.htm,.json,.xml,.log,.sql,.md,.css,.js,.ts"
                            onChange={handleFileInput}
                        />
                        <div class="ba-stack-2 ba-items-center">
                            <div class="ba-flex ba-justify-center ba-text-muted">
                                <ToolIcon name="file" class="ba-icon-xl" />
                            </div>
                            <div class="ba-font-bold ba-text-base">
                                ここにファイルをドラッグ＆ドロップ
                            </div>
                            <div class="ba-text-xs ba-text-muted">
                                またはクリックしてファイルを選択（.txt, .csv, .log 等）
                            </div>
                        </div>
                    </div>

                    <Show when={selectedFile()}>
                        <div class="ba-panel ba-stack-4">
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2">
                                <div>
                                    <div class="ba-font-bold ba-text-sm">{selectedFile()?.name}</div>
                                    <div class="ba-text-xs ba-text-muted">
                                        サイズ: {((selectedFile()?.size ?? 0) / 1024).toFixed(2)} KB |
                                        推定文字コード:{" "}
                                        <span class="ba-badge ba-badge--info ba-mono">
                                            {fileDetectedEncoding()}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--primary ba-btn--sm"
                                    onClick={handleDownloadConvertedFile}
                                    disabled={isConvertingFile()}
                                >
                                    {toEncoding()} に変換してダウンロード
                                </button>
                            </div>

                            <div class="ba-stack-1">
                                <label class="ba-text-xs ba-font-bold ba-text-muted">
                                    ファイル内容プレビュー（先頭抜粋）:
                                </label>
                                <pre
                                    class="ba-code"
                                    style={{ "max-height": "12rem", "background-color": "var(--ba-surface)" }}
                                >
                                    {fileContentPreview()}
                                </pre>
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>

            {/* TAB 5: Unicode正規化 (NFC / NFD / NFKC / NFKD) */}
            <Show when={activeTab() === "normalize"}>
                <div class="ba-card ba-stack-6">
                    <div class="ba-stack-1">
                        <h2 class="ba-section-title">
                            Unicode正規化ツール（NFC / NFD / NFKC / NFKD）
                        </h2>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                macOSとWindows間でのファイル名濁点分離問題（「が」が「か」＋「゙」になる等）の解消や、半角カナ・全角英数の標準化を行えます。
                        </p>
                    </div>

                    <div class="ba-field">
                        <label class="ba-label">
                            <span>入力テキスト</span>
                        </label>
                        <textarea
                            class="ba-textarea ba-mono ba-text-sm"
                            style={{ "min-height": "5.5rem" }}
                            aria-label="Unicode正規化する入力テキスト"
                            value={normalizeInput()}
                            onInput={(e) => setNormalizeInput(e.currentTarget.value)}
                        />
                    </div>

                    <div class="ba-grid-2">
                        {/* NFC */}
                        <div class="ba-panel ba-stack-2">
                            <div class="ba-flex ba-justify-between ba-items-center ba-gap-2">
                                <div>
                                    <span class="ba-font-bold ba-text-sm ba-text-primary">NFC (標準合成形式)</span>
                                    <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                        濁点を結合（Web・Linux・Windows標準）
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--xs"
                                    onClick={() =>
                                        handleCopyText(normalizeUnicode(normalizeInput(), "NFC"), () => {
                                            setNormCopiedKey("NFC");
                                            setTimeout(() => setNormCopiedKey(null), 1500);
                                        })
                                    }
                                >
                                    {normCopiedKey() === "NFC" ? "コピー完了！" : "コピー"}
                                </button>
                            </div>
                            <div
                                class="ba-mono ba-text-sm"
                                style={{
                                    padding: "0.75rem",
                                    "background-color": "var(--ba-surface)",
                                    "border-radius": "var(--ba-radius-sm)",
                                    border: "1px solid var(--ba-border)",
                                    "min-height": "2.75rem",
                                }}
                            >
                                {normalizeUnicode(normalizeInput(), "NFC")}
                            </div>
                        </div>

                        {/* NFD */}
                        <div class="ba-panel ba-stack-2">
                            <div class="ba-flex ba-justify-between ba-items-center ba-gap-2">
                                <div>
                                    <span class="ba-font-bold ba-text-sm ba-text-primary">NFD (分解形式)</span>
                                    <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                        文字と濁点を分離（macOS HFS+ファイル名等）
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--xs"
                                    onClick={() =>
                                        handleCopyText(normalizeUnicode(normalizeInput(), "NFD"), () => {
                                            setNormCopiedKey("NFD");
                                            setTimeout(() => setNormCopiedKey(null), 1500);
                                        })
                                    }
                                >
                                    {normCopiedKey() === "NFD" ? "コピー完了！" : "コピー"}
                                </button>
                            </div>
                            <div
                                class="ba-mono ba-text-sm"
                                style={{
                                    padding: "0.75rem",
                                    "background-color": "var(--ba-surface)",
                                    "border-radius": "var(--ba-radius-sm)",
                                    border: "1px solid var(--ba-border)",
                                    "min-height": "2.75rem",
                                }}
                            >
                                {normalizeUnicode(normalizeInput(), "NFD")}
                            </div>
                        </div>

                        {/* NFKC */}
                        <div class="ba-panel ba-stack-2">
                            <div class="ba-flex ba-justify-between ba-items-center ba-gap-2">
                                <div>
                                    <span class="ba-font-bold ba-text-sm ba-text-primary">NFKC (互換合成形式)</span>
                                    <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                        半角カナを全角に、全角英数を半角に統一
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--xs"
                                    onClick={() =>
                                        handleCopyText(normalizeUnicode(normalizeInput(), "NFKC"), () => {
                                            setNormCopiedKey("NFKC");
                                            setTimeout(() => setNormCopiedKey(null), 1500);
                                        })
                                    }
                                >
                                    {normCopiedKey() === "NFKC" ? "コピー完了！" : "コピー"}
                                </button>
                            </div>
                            <div
                                class="ba-mono ba-text-sm"
                                style={{
                                    padding: "0.75rem",
                                    "background-color": "var(--ba-surface)",
                                    "border-radius": "var(--ba-radius-sm)",
                                    border: "1px solid var(--ba-border)",
                                    "min-height": "2.75rem",
                                }}
                            >
                                {normalizeUnicode(normalizeInput(), "NFKC")}
                            </div>
                        </div>

                        {/* NFKD */}
                        <div class="ba-panel ba-stack-2">
                            <div class="ba-flex ba-justify-between ba-items-center ba-gap-2">
                                <div>
                                    <span class="ba-font-bold ba-text-sm ba-text-primary">NFKD (互換分解形式)</span>
                                    <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                        互換文字を展開し分解
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    class="ba-btn ba-btn--outline ba-btn--xs"
                                    onClick={() =>
                                        handleCopyText(normalizeUnicode(normalizeInput(), "NFKD"), () => {
                                            setNormCopiedKey("NFKD");
                                            setTimeout(() => setNormCopiedKey(null), 1500);
                                        })
                                    }
                                >
                                    {normCopiedKey() === "NFKD" ? "コピー完了！" : "コピー"}
                                </button>
                            </div>
                            <div
                                class="ba-mono ba-text-sm"
                                style={{
                                    padding: "0.75rem",
                                    "background-color": "var(--ba-surface)",
                                    "border-radius": "var(--ba-radius-sm)",
                                    border: "1px solid var(--ba-border)",
                                    "min-height": "2.75rem",
                                }}
                            >
                                {normalizeUnicode(normalizeInput(), "NFKD")}
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            {/* TAB 6: 文字化け修復 */}
            <Show when={activeTab() === "mojibake"}>
                <div class="ba-card ba-stack-6">
                    <div class="ba-stack-2">
                        <h2 class="ba-section-title">
                            文字化け自動復元・修復ツール
                        </h2>
                        <p class="ba-text-sm ba-text-muted" style={{ margin: 0 }}>
                                「縺薙ｓ縺ｫ縺｡縺ｯ」や「ã‚ã„ã†」など、UTF-8やShift_JIS、EUC-JP、Latin-1が食い違って文字化けしてしまったテキストを貼り付けると、元の文章を自動推測して復元します。
                        </p>
                    </div>

                    <div class="ba-field">
                        <label class="ba-label">
                            <span>文字化けしたテキスト</span>
                        </label>
                        <textarea
                            class="ba-textarea ba-mono ba-text-sm"
                            style={{ "min-height": "7.5rem" }}
                            placeholder="文字化けした文字列をここに貼り付けてください..."
                            aria-label="文字化けしたテキスト"
                            value={mojibakeInput()}
                            onInput={(e) => setMojibakeInput(e.currentTarget.value)}
                        />
                    </div>

                    <div class="ba-stack-3">
                        <h3 class="ba-text-sm ba-font-bold" style={{ margin: 0 }}>復元候補</h3>
                        <Show
                            when={mojibakeCandidates().length > 0}
                            fallback={
                                <div class="ba-panel ba-text-center ba-text-sm ba-text-muted" style={{ padding: "1.5rem" }}>
                                    {mojibakeInput()
                                        ? "該当する典型的な文字化けパターンは見つかりませんでした。テキスト文字コード変換タブでエンコーディングを手動指定してお試しください。"
                                        : "文字化けしたテキストを入力すると、ここに復元候補が表示されます。"}
                                </div>
                            }
                        >
                            <div class="ba-stack-3">
                                <For each={mojibakeCandidates()}>
                                    {(candidate, idx) => (
                                        <div class="ba-panel ba-stack-2">
                                            <div class="ba-flex ba-flex-wrap ba-justify-between ba-items-center ba-gap-2">
                                                <div>
                                                    <span class="ba-font-bold ba-text-sm ba-text-primary">
                                                        {candidate.label}
                                                    </span>
                                                    <p class="ba-text-xs ba-text-muted" style={{ margin: 0 }}>
                                                        {candidate.description}
                                                    </p>
                                                </div>
                                                <div class="ba-flex ba-gap-2">
                                                    <button
                                                        type="button"
                                                        class="ba-btn ba-btn--outline ba-btn--xs"
                                                        onClick={async () => {
                                                            await handleCopyText(candidate.restoredText);
                                                            setMojibakeCopiedIndex(idx());
                                                            setTimeout(() => setMojibakeCopiedIndex(null), 2000);
                                                        }}
                                                    >
                                                        {mojibakeCopiedIndex() === idx()
                                                            ? "コピー完了！"
                                                            : "コピー"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="ba-btn ba-btn--primary ba-btn--xs"
                                                        onClick={() => {
                                                            setInputText(candidate.restoredText);
                                                            setActiveTab("text");
                                                        }}
                                                    >
                                                        テキスト変換に送る
                                                    </button>
                                                </div>
                                            </div>
                                            <div
                                                class="ba-mono ba-text-sm"
                                                style={{
                                                    padding: "0.75rem",
                                                    "background-color": "var(--ba-surface)",
                                                    "border-radius": "var(--ba-radius-sm)",
                                                    border: "1px solid var(--ba-border)",
                                                    "user-select": "all",
                                                }}
                                            >
                                                {candidate.restoredText}
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* 解説・FAQセクション */}
            <div class="ba-card ba-stack-4 ba-text-sm ba-text-muted">
                <h2 class="ba-section-title">
                    文字コード・進数表記・改行コードに関する技術解説とFAQ
                </h2>

                <div class="ba-stack-4">
                    <div>
                        <h3 class="ba-font-bold ba-text-base ba-text-primary" style={{ "margin-top": 0, "margin-bottom": "0.25rem" }}>
                            Q. UTF-8とShift_JIS（CP932）の違いは何ですか？
                        </h3>
                        <p class="ba-text-sm" style={{ margin: 0, "line-height": 1.65 }}>
                            UTF-8は世界標準のUnicode文字コードであり、日本語だけでなく多言語や絵文字を包括しています。一方、Shift_JISはWindowsや従来の日本国内システムで長年使用されてきた日本語専用文字コードです。現代のWeb標準はUTF-8ですが、Windows用CSV（Excel）や古いレガシーシステム連携ではShift_JISが現在も頻繁に利用されます。
                        </p>
                    </div>

                    <div>
                        <h3 class="ba-font-bold ba-text-base ba-text-primary" style={{ "margin-top": 0, "margin-bottom": "0.25rem" }}>
                            Q. ExcelでCSVを開くと文字化けするのはなぜですか？
                        </h3>
                        <p class="ba-text-sm" style={{ margin: 0, "line-height": 1.65 }}>
                            日本語版WindowsのExcelは、CSVファイルをデフォルトでShift_JIS（CP932）として解釈します。そのためUTF-8で保存されたCSVを開くと文字化けします。解決するには、本ツールで文字コードを「Shift_JIS」に変換するか、「UTF-8 (BOM付き)」で保存してください。BOMが付くことでExcelが自動的にUTF-8と識別できるようになります。
                        </p>
                    </div>

                    <div>
                        <h3 class="ba-font-bold ba-text-base ba-text-primary" style={{ "margin-top": 0, "margin-bottom": "0.25rem" }}>
                            Q. 16進数（HEX）やUnicodeエスケープ（\uXXXX）とは？
                        </h3>
                        <p class="ba-text-sm" style={{ margin: 0, "line-height": 1.65 }}>
                            コンピュータは文字を直接扱えず、バイト列（数値）として保存・通信します。16進数（HEX）はバイト列を人間が読みやすく表記したものです。また、Unicodeエスケープ（\u3042 等）やHTML数値文字参照（&#12354; 等）は、ASCII文字しか送信できない通信路やHTMLソース上で安全に特殊文字を埋め込むための記法です。
                        </p>
                    </div>

                    <div>
                        <h3 class="ba-font-bold ba-text-base ba-text-primary" style={{ "margin-top": 0, "margin-bottom": "0.25rem" }}>
                            Q. Unicode正規化（NFC / NFD）とは何ですか？
                        </h3>
                        <p class="ba-text-sm" style={{ margin: 0, "line-height": 1.65 }}>
                            例えば「が」という文字は、1つの文字「が」（U+304C: NFC）として表す方法と、「か」（U+304B）＋結合濁点（U+3099: NFD）の2文字を合体させて表す方法があります。macOSのファイルシステム（HFS+等）ではNFDが使われるため、Windowsにコピーした際にファイル名が文字化けしたり検索に引っかからなくなる原因となります。NFCに正規化することでこれを解決できます。
                        </p>
                    </div>
                </div>
            </div>

            <AdSense />
            <AdSense />
        </div>
    );
}
