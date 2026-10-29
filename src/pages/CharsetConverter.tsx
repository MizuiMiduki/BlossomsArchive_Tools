import { createSignal, createMemo, onMount, onCleanup, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/gsapAnimations";
import {
    SupportedEncoding,
    InputEncodingOption,
    NewlineOption,
    ENCODING_OPTIONS,
    convertNewline,
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
    MojibakeCandidate,
} from "../utils/charsetConverter";

type ActiveTab =
    | "text"
    | "code-formats"
    | "inspector"
    | "file"
    | "mojibake"
    | "normalize";

export default function CharsetConverter() {
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

    // SEOと構造化データの動的注入
    onMount(() => {
        document.title =
            "文字コード総合変換ツール | UTF-8・Shift_JIS・EUC・Unicode・進数・文字化け完全対応";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "ブラウザ上で動作する高機能な文字コード総合変換ツール。UTF-8、Shift_JIS (CP932)、EUC-JP、JIS、UTF-16/32の相互変換、改行コード変換、ファイル一括変換のほか、16進数(HEX)・10進数・2進数・Unicodeエスケープ・HTML数値文字参照・Base64・URLエンコード・Unicode正規化・文字化け自動復元まで完全網羅。サーバー送信なしで安全に処理されます。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "charset-converter-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "文字コード総合変換ツール",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "文字コード、進数表記、エスケープシーケンス、数値文字参照、Unicode正規化、文字化け復元を一括で行える総合Webツール。",
        });
        document.head.appendChild(script);

        if (containerRef) playPageEntrance(containerRef, ".card");
    });

    onCleanup(() => {
        const script = document.getElementById("charset-converter-jsonld");
        if (script) {
            script.remove();
        }
    });

    // テキスト変換結果
    const textConversionResult = createMemo(() => {
        const text = inputText();
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
        return convertText(text, toEncoding(), newlineOption());
    });

    // 16進ダンプ文字列
    const hexDumpString = createMemo(() => {
        const res = textConversionResult();
        if (res.bytes.length === 0) return "";
        return generateHexDump(res.bytes);
    });

    // コード表記変換の各種出力
    const cfOutputs = createMemo(() => {
        const text = cfInput();
        const enc = cfEncoding();
        if (!text) {
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
        const bytes = encodeStringToBytes(text, enc);
        return {
            hex: bytesToHexString(bytes, cfHexFormat()),
            dec: bytesToDecString(bytes, "space"),
            bin: bytesToBinString(bytes),
            unicodeEscape: textToUnicodeEscapes(text, cfUnicodeFormat()),
            htmlEntity: textToHtmlEntities(text, cfHtmlFormat()),
            base64: bytesToBase64(bytes),
            urlEncoded: urlEncodeWithEncoding(text, enc),
            byteLength: bytes.length,
        };
    });

    // 文字インスペクター結果
    const inspectedChars = createMemo(() => {
        return inspectCharacters(inputText() || cfInput());
    });

    // 文字化け修復候補
    const mojibakeCandidates = createMemo((): MojibakeCandidate[] => {
        return fixMojibakeCandidates(mojibakeInput());
    });

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
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            setFileBytes(bytes);

            const decoded = decodeBytes(bytes, fromEncoding());
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
        if (!file || !bytes) return;

        const decoded = decodeBytes(bytes, fromEncoding());
        const adjustedText = convertNewline(decoded.text, newlineOption());
        const convertedBytes = encodeStringToBytes(adjustedText, toEncoding());

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
        <div ref={containerRef} class="max-w-5xl mx-auto space-y-8 p-4">
            {/* ヘッダー */}
            <div class="text-center space-y-3">
                <h1 class="text-3xl md:text-4xl font-bold text-primary">
                    <BudouX text="文字コード総合変換ツール" />
                </h1>
                <p class="text-base-content/70 max-w-2xl mx-auto text-sm md:text-base">
                    <BudouX text="UTF-8、Shift_JIS、EUC-JP、JIS、UTF-16/32、Latin-1の文字コード・改行コード相互変換、16進数(HEX)・進数・Unicode表記・HTML数値文字参照・Base64・URLエンコード・Unicode正規化・文字化け復元まで完全対応。" />
                </p>
                <div class="flex items-center justify-center gap-2 text-xs text-success">
                    <span class="inline-block w-2 h-2 rounded-full bg-success"></span>
                    <span>ブラウザ完全ローカル処理（外部通信なしで機密情報も安全・高速変換）</span>
                </div>
            </div>

            {/* ナビゲーションタブ */}
            <div class="flex justify-center border-b border-base-300 overflow-x-auto">
                <div class="tabs tabs-boxed bg-base-200 p-1 flex-nowrap">
                    <button
                        type="button"
                        class={`tab whitespace-nowrap transition-all ${
                            activeTab() === "text"
                                ? "tab-active !bg-primary !text-primary-content font-bold shadow-sm"
                                : ""
                        }`}
                        onClick={() => setActiveTab("text")}
                    >
                        テキスト文字コード変換
                    </button>
                    <button
                        type="button"
                        class={`tab whitespace-nowrap transition-all ${
                            activeTab() === "code-formats"
                                ? "tab-active !bg-primary !text-primary-content font-bold shadow-sm"
                                : ""
                        }`}
                        onClick={() => setActiveTab("code-formats")}
                    >
                        進数・コード表記変換
                    </button>
                    <button
                        type="button"
                        class={`tab whitespace-nowrap transition-all ${
                            activeTab() === "inspector"
                                ? "tab-active !bg-primary !text-primary-content font-bold shadow-sm"
                                : ""
                        }`}
                        onClick={() => setActiveTab("inspector")}
                    >
                        1文字コード解析
                    </button>
                    <button
                        type="button"
                        class={`tab whitespace-nowrap transition-all ${
                            activeTab() === "file"
                                ? "tab-active !bg-primary !text-primary-content font-bold shadow-sm"
                                : ""
                        }`}
                        onClick={() => setActiveTab("file")}
                    >
                        ファイル変換
                    </button>
                    <button
                        type="button"
                        class={`tab whitespace-nowrap transition-all ${
                            activeTab() === "normalize"
                                ? "tab-active !bg-primary !text-primary-content font-bold shadow-sm"
                                : ""
                        }`}
                        onClick={() => setActiveTab("normalize")}
                    >
                        Unicode正規化 (NFC/NFD)
                    </button>
                    <button
                        type="button"
                        class={`tab whitespace-nowrap transition-all ${
                            activeTab() === "mojibake"
                                ? "tab-active !bg-primary !text-primary-content font-bold shadow-sm"
                                : ""
                        }`}
                        onClick={() => setActiveTab("mojibake")}
                    >
                        文字化け修復
                    </button>
                </div>
            </div>

            {/* TAB 1: テキスト文字コード変換 */}
            <Show when={activeTab() === "text"}>
                <div class="space-y-6">
                    {/* 文字コード設定パネル */}
                    <div class="card bg-base-100 border border-base-300 shadow-sm">
                        <div class="card-body p-4 md:p-6 space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                <div class="form-control">
                                    <label class="label py-1">
                                        <span class="label-text font-semibold">変換元文字コード</span>
                                    </label>
                                    <select
                                        class="select select-bordered w-full select-sm md:select-md"
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

                                <div class="flex items-center gap-2 md:pt-6 justify-center">
                                    <button
                                        type="button"
                                        class="btn btn-outline btn-circle btn-sm"
                                        title="文字コードとテキストを入れ替え"
                                        onClick={handleSwapEncoding}
                                    >
                                        ⇄
                                    </button>
                                </div>

                                <div class="form-control">
                                    <label class="label py-1">
                                        <span class="label-text font-semibold">変換先文字コード</span>
                                    </label>
                                    <select
                                        class="select select-bordered select-primary w-full select-sm md:select-md"
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
                            <div class="flex flex-wrap items-center gap-4 pt-2 border-t border-base-200 text-sm">
                                <span class="font-semibold text-base-content/80">改行コード変換:</span>
                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="newline"
                                        class="radio radio-primary radio-sm"
                                        checked={newlineOption() === "none"}
                                        onChange={() => setNewlineOption("none")}
                                    />
                                    <span>変換しない（維持）</span>
                                </label>
                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="newline"
                                        class="radio radio-primary radio-sm"
                                        checked={newlineOption() === "LF"}
                                        onChange={() => setNewlineOption("LF")}
                                    />
                                    <span>LF (Unix / macOS)</span>
                                </label>
                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="newline"
                                        class="radio radio-primary radio-sm"
                                        checked={newlineOption() === "CRLF"}
                                        onChange={() => setNewlineOption("CRLF")}
                                    />
                                    <span>CRLF (Windows)</span>
                                </label>
                                <label class="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="newline"
                                        class="radio radio-primary radio-sm"
                                        checked={newlineOption() === "CR"}
                                        onChange={() => setNewlineOption("CR")}
                                    />
                                    <span>CR (Classic Mac)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 入力と出力のテキストエリア */}
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div class="card bg-base-100 border border-base-300 shadow-sm flex flex-col">
                            <div class="card-body p-4 md:p-6 flex-1 flex flex-col space-y-3">
                                <div class="flex items-center justify-between">
                                    <h2 class="card-title text-base font-bold">入力テキスト</h2>
                                    <button
                                        type="button"
                                        class="btn btn-ghost btn-xs text-error"
                                        onClick={() => setInputText("")}
                                        disabled={!inputText()}
                                    >
                                        クリア
                                    </button>
                                </div>

                                <textarea
                                    class="textarea textarea-bordered w-full flex-1 font-mono text-sm leading-relaxed min-h-[260px]"
                                    placeholder="変換したいテキストをここに入力または貼り付け..."
                                    value={inputText()}
                                    onInput={(e) => setInputText(e.currentTarget.value)}
                                />

                                <div class="flex justify-between items-center text-xs text-base-content/60">
                                    <span>文字数: {Array.from(inputText()).length} 文字</span>
                                    <span>
                                        行数: {inputText() ? inputText().split(/\r\n|\r|\n/).length : 0} 行
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="card bg-base-100 border border-base-300 shadow-sm flex flex-col">
                            <div class="card-body p-4 md:p-6 flex-1 flex flex-col space-y-3">
                                <div class="flex items-center justify-between">
                                    <h2 class="card-title text-base font-bold flex items-center gap-2">
                                        <span>変換結果プレビュー</span>
                                        <span class="badge badge-primary badge-sm">
                                            {toEncoding()}
                                        </span>
                                    </h2>
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-primary btn-xs"
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
                                            class="btn btn-primary btn-xs"
                                            onClick={handleDownloadText}
                                            disabled={textConversionResult().bytes.length === 0}
                                        >
                                            ファイル保存
                                        </button>
                                    </div>
                                </div>

                                <textarea
                                    readonly
                                    class="textarea textarea-bordered w-full flex-1 font-mono text-sm leading-relaxed min-h-[260px] bg-base-200/50"
                                    placeholder="変換後のテキストがここに表示されます..."
                                    value={textConversionResult().text}
                                />

                                <div class="flex justify-between items-center text-xs text-base-content/60">
                                    <span>出力文字数: {textConversionResult().charCount} 文字</span>
                                    <span class="font-semibold text-primary">
                                        出力サイズ: {textConversionResult().byteCount} バイト
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 未対応文字警告 */}
                    <Show when={textConversionResult().hasUnsupportedChars}>
                        <div class="alert alert-warning shadow-sm">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="stroke-current shrink-0 h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                            <div>
                                <h3 class="font-bold text-sm">文字コード未対応の文字が含まれています</h3>
                                <div class="text-xs">
                                    選択された「{toEncoding()}」では表現できない文字（絵文字や一部の機種固有文字など）が含まれているため、変換時に置換文字や「?」に変換される場合があります。
                                    <div class="mt-1 font-mono text-xs font-semibold">
                                        該当文字: {textConversionResult().unsupportedChars.slice(0, 10).join(" ")}
                                        {textConversionResult().unsupportedChars.length > 10 ? " ほか" : ""}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* 16進バイナリダンプ */}
                    <Show when={textConversionResult().bytes.length > 0}>
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-4 md:p-6 space-y-3">
                                <div class="flex items-center justify-between">
                                    <h3 class="text-sm font-bold flex items-center gap-2">
                                        <span>バイナリ16進ダンプ（Hex Dump）</span>
                                        <span class="text-xs text-base-content/50 font-normal">
                                            （先頭最大512バイト）
                                        </span>
                                    </h3>
                                    <button
                                        type="button"
                                        class="btn btn-ghost btn-xs text-primary"
                                        onClick={() => setShowHexDump(!showHexDump())}
                                    >
                                        {showHexDump() ? "閉じる ▲" : "表示する ▼"}
                                    </button>
                                </div>
                                <Show when={showHexDump()}>
                                    <pre class="bg-base-200 p-4 rounded-lg font-mono text-xs overflow-x-auto text-base-content leading-tight">
                                        {hexDumpString()}
                                    </pre>
                                </Show>
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>

            {/* TAB 2: 進数・コード表記変換（競合DenCode/AHREF対抗） */}
            <Show when={activeTab() === "code-formats"}>
                <div class="space-y-6">
                    <div class="card bg-base-100 border border-base-300 shadow-sm">
                        <div class="card-body p-6 space-y-4">
                            <div class="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h2 class="card-title text-lg font-bold">
                                        進数・コード表記・エスケープ相互変換
                                    </h2>
                                    <p class="text-xs text-base-content/70">
                                        テキストを16進数(HEX)・10進数(DEC)・2進数(BIN)・Unicodeコードポイント・HTML数値文字参照・Base64・URLエンコードに一括変換します。
                                    </p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-semibold">基準文字コード:</span>
                                    <select
                                        class="select select-bordered select-sm font-mono"
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

                            <div class="form-control">
                                <label class="label py-1">
                                    <span class="label-text font-semibold">入力テキスト</span>
                                </label>
                                <textarea
                                    class="textarea textarea-bordered w-full font-mono text-sm min-h-[90px]"
                                    placeholder="変換したいテキストを入力..."
                                    value={cfInput()}
                                    onInput={(e) => setCfInput(e.currentTarget.value)}
                                />
                                <div class="text-xs text-base-content/60 mt-1">
                                    バイト数 ({cfEncoding()}): {cfOutputs().byteLength} bytes
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 各フォーマットの出力カード群 */}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 16進数 (HEX) */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-sm text-primary">16進数バイト列 (HEX)</span>
                                    <div class="flex items-center gap-2">
                                        <select
                                            class="select select-bordered select-xs"
                                            value={cfHexFormat()}
                                            onChange={(e) =>
                                                setCfHexFormat(e.currentTarget.value as any)
                                            }
                                        >
                                            <option value="space">スペース区切り (E3 81 82)</option>
                                            <option value="comma">カンマ区切り (E3, 81)</option>
                                            <option value="0x-comma">0xカンマ (0xE3, 0x81)</option>
                                            <option value="percent">パーセント (%E3%81%82)</option>
                                        </select>
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-xs"
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
                                            class="btn btn-ghost btn-xs text-primary"
                                            title="16進数からテキストへ逆変換"
                                            onClick={() => {
                                                const bytes = parseHexToBytes(cfOutputs().hex);
                                                const text = decodeBytes(bytes, cfEncoding()).text;
                                                setCfInput(text);
                                            }}
                                        >
                                            逆変換 ↩
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    readonly
                                    class="textarea textarea-bordered w-full font-mono text-xs h-20 bg-base-200/50"
                                    value={cfOutputs().hex}
                                />
                            </div>
                        </div>

                        {/* 10進数 (DEC) */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-sm text-primary">10進数バイト列 (DEC)</span>
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-xs"
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
                                            class="btn btn-ghost btn-xs text-primary"
                                            title="10進数からテキストへ逆変換"
                                            onClick={() => {
                                                const bytes = parseDecToBytes(cfOutputs().dec);
                                                const text = decodeBytes(bytes, cfEncoding()).text;
                                                setCfInput(text);
                                            }}
                                        >
                                            逆変換 ↩
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    readonly
                                    class="textarea textarea-bordered w-full font-mono text-xs h-20 bg-base-200/50"
                                    value={cfOutputs().dec}
                                />
                            </div>
                        </div>

                        {/* 2進数 (BIN) */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-sm text-primary">2進数ビット列 (BIN)</span>
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-xs"
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
                                            class="btn btn-ghost btn-xs text-primary"
                                            title="2進数からテキストへ逆変換"
                                            onClick={() => {
                                                const bytes = parseBinToBytes(cfOutputs().bin);
                                                const text = decodeBytes(bytes, cfEncoding()).text;
                                                setCfInput(text);
                                            }}
                                        >
                                            逆変換 ↩
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    readonly
                                    class="textarea textarea-bordered w-full font-mono text-xs h-20 bg-base-200/50"
                                    value={cfOutputs().bin}
                                />
                            </div>
                        </div>

                        {/* Unicodeコードポイント */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-sm text-primary">Unicode表記</span>
                                    <div class="flex items-center gap-2">
                                        <select
                                            class="select select-bordered select-xs"
                                            value={cfUnicodeFormat()}
                                            onChange={(e) =>
                                                setCfUnicodeFormat(e.currentTarget.value as any)
                                            }
                                        >
                                            <option value="u-plus">U+XXXX 形式</option>
                                            <option value="backslash-u">\uXXXX 形式</option>
                                            <option value="backslash-u-bracket">\u&#123;XXXX&#125; 形式</option>
                                        </select>
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-xs"
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
                                            class="btn btn-ghost btn-xs text-primary"
                                            title="Unicodeエスケープからテキストへ復元"
                                            onClick={() => {
                                                const text = parseUnicodeEscapesToText(cfOutputs().unicodeEscape);
                                                setCfInput(text);
                                            }}
                                        >
                                            復元 ↩
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    readonly
                                    class="textarea textarea-bordered w-full font-mono text-xs h-20 bg-base-200/50"
                                    value={cfOutputs().unicodeEscape}
                                />
                            </div>
                        </div>

                        {/* HTML数値文字参照 (NCR) */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-sm text-primary">HTML数値文字参照 (NCR)</span>
                                    <div class="flex items-center gap-2">
                                        <select
                                            class="select select-bordered select-xs"
                                            value={cfHtmlFormat()}
                                            onChange={(e) =>
                                                setCfHtmlFormat(e.currentTarget.value as any)
                                            }
                                        >
                                            <option value="dec">10進数 (&#12354;)</option>
                                            <option value="hex">16進数 (&#x3042;)</option>
                                        </select>
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-xs"
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
                                            class="btn btn-ghost btn-xs text-primary"
                                            title="数値文字参照からテキストへ復元"
                                            onClick={() => {
                                                const text = parseHtmlEntitiesToText(cfOutputs().htmlEntity);
                                                setCfInput(text);
                                            }}
                                        >
                                            復元 ↩
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    readonly
                                    class="textarea textarea-bordered w-full font-mono text-xs h-20 bg-base-200/50"
                                    value={cfOutputs().htmlEntity}
                                />
                            </div>
                        </div>

                        {/* Base64 */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm">
                            <div class="card-body p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-sm text-primary">Base64</span>
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-xs"
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
                                            class="btn btn-ghost btn-xs text-primary"
                                            title="Base64からテキストへ復元"
                                            onClick={() => {
                                                try {
                                                    const bytes = base64ToBytes(cfOutputs().base64);
                                                    const text = decodeBytes(bytes, cfEncoding()).text;
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
                                    class="textarea textarea-bordered w-full font-mono text-xs h-20 bg-base-200/50"
                                    value={cfOutputs().base64}
                                />
                            </div>
                        </div>

                        {/* URLエンコード */}
                        <div class="card bg-base-100 border border-base-300 shadow-sm md:col-span-2">
                            <div class="card-body p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-sm text-primary">
                                        URLパーセントエンコード ({cfEncoding()})
                                    </span>
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            class="btn btn-outline btn-xs"
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
                                            class="btn btn-ghost btn-xs text-primary"
                                            title="URLエンコード文字列をデコード"
                                            onClick={() => {
                                                const text = urlDecodeWithEncoding(
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
                                    class="textarea textarea-bordered w-full font-mono text-xs h-16 bg-base-200/50"
                                    value={cfOutputs().urlEncoded}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            {/* TAB 3: 1文字コード解析（文字インスペクター） */}
            <Show when={activeTab() === "inspector"}>
                <div class="card bg-base-100 border border-base-300 shadow-sm">
                    <div class="card-body p-6 space-y-4">
                        <div class="space-y-1">
                            <h2 class="card-title text-lg font-bold">1文字コード解析インスペクター</h2>
                            <p class="text-xs text-base-content/70">
                                入力された文字列の1文字ごとに、Unicodeコードポイント、10進数値、UTF-8・Shift_JIS・EUC-JPバイト列、文字種別を詳細に一覧表示します。
                            </p>
                        </div>

                        <div class="overflow-x-auto border border-base-300 rounded-lg">
                            <table class="table table-zebra table-sm w-full font-mono text-xs">
                                <thead class="bg-base-200 text-base-content font-sans">
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
                                                <td class="font-bold text-base font-sans text-primary">
                                                    {row.char}
                                                </td>
                                                <td>{row.codePoint}</td>
                                                <td>{row.decimal}</td>
                                                <td>{row.utf8Hex}</td>
                                                <td>{row.sjisHex}</td>
                                                <td>{row.eucHex}</td>
                                                <td class="font-sans">
                                                    <span class="badge badge-ghost badge-sm">
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
                </div>
            </Show>

            {/* TAB 4: ファイル一括変換 */}
            <Show when={activeTab() === "file"}>
                <div class="card bg-base-100 border border-base-300 shadow-sm">
                    <div class="card-body p-6 space-y-6">
                        <h2 class="card-title text-lg font-bold">
                            テキストファイルの一括文字コード変換
                        </h2>
                        <p class="text-sm text-base-content/70">
                            .txt、.csv、.tsv、.html、.json、.log などのテキストファイルをドラッグ＆ドロップして、指定した文字コード（Shift_JIS、UTF-8等）に変換してダウンロードできます。
                        </p>

                        <div
                            class={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                                isDragging()
                                    ? "border-primary bg-primary/10"
                                    : "border-base-300 hover:border-primary/50 bg-base-200/30"
                            }`}
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
                                class="hidden"
                                accept=".txt,.csv,.tsv,.html,.htm,.json,.xml,.log,.sql,.md,.css,.js,.ts"
                                onChange={handleFileInput}
                            />
                            <div class="space-y-2">
                                <div class="text-4xl">📄</div>
                                <div class="font-bold text-base">
                                    ここにファイルをドラッグ＆ドロップ
                                </div>
                                <div class="text-xs text-base-content/60">
                                    またはクリックしてファイルを選択（.txt, .csv, .log 等）
                                </div>
                            </div>
                        </div>

                        <Show when={selectedFile()}>
                            <div class="bg-base-200/50 p-4 rounded-lg space-y-4 border border-base-300">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div class="font-bold text-sm">{selectedFile()?.name}</div>
                                        <div class="text-xs text-base-content/60">
                                            サイズ: {((selectedFile()?.size ?? 0) / 1024).toFixed(2)} KB |
                                            推定文字コード:{" "}
                                            <span class="badge badge-sm badge-info font-mono">
                                                {fileDetectedEncoding()}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        class="btn btn-primary btn-sm"
                                        onClick={handleDownloadConvertedFile}
                                        disabled={isConvertingFile()}
                                    >
                                        {toEncoding()} に変換してダウンロード
                                    </button>
                                </div>

                                <div class="space-y-1">
                                    <label class="text-xs font-semibold text-base-content/70">
                                        ファイル内容プレビュー（先頭抜粋）:
                                    </label>
                                    <pre class="bg-base-100 p-3 rounded font-mono text-xs max-h-48 overflow-y-auto border border-base-300 whitespace-pre-wrap">
                                        {fileContentPreview()}
                                    </pre>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* TAB 5: Unicode正規化 (NFC / NFD / NFKC / NFKD) */}
            <Show when={activeTab() === "normalize"}>
                <div class="card bg-base-100 border border-base-300 shadow-sm">
                    <div class="card-body p-6 space-y-6">
                        <div class="space-y-1">
                            <h2 class="card-title text-lg font-bold">
                                Unicode正規化ツール（NFC / NFD / NFKC / NFKD）
                            </h2>
                            <p class="text-xs text-base-content/70">
                                macOSとWindows間でのファイル名濁点分離問題（「が」が「か」＋「゙」になる等）の解消や、半角カナ・全角英数の標準化を行えます。
                            </p>
                        </div>

                        <div class="form-control">
                            <label class="label py-1">
                                <span class="label-text font-semibold">入力テキスト</span>
                            </label>
                            <textarea
                                class="textarea textarea-bordered w-full font-mono text-sm min-h-[90px]"
                                value={normalizeInput()}
                                onInput={(e) => setNormalizeInput(e.currentTarget.value)}
                            />
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* NFC */}
                            <div class="card bg-base-200/50 border border-base-300 p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <span class="font-bold text-sm text-primary">NFC (標準合成形式)</span>
                                        <p class="text-xs text-base-content/60">
                                            濁点を結合（Web・Linux・Windows標準）
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="btn btn-outline btn-xs"
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
                                <div class="p-3 bg-base-100 rounded border border-base-300 font-mono text-sm">
                                    {normalizeUnicode(normalizeInput(), "NFC")}
                                </div>
                            </div>

                            {/* NFD */}
                            <div class="card bg-base-200/50 border border-base-300 p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <span class="font-bold text-sm text-primary">NFD (分解形式)</span>
                                        <p class="text-xs text-base-content/60">
                                            文字と濁点を分離（macOS HFS+ファイル名等）
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="btn btn-outline btn-xs"
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
                                <div class="p-3 bg-base-100 rounded border border-base-300 font-mono text-sm">
                                    {normalizeUnicode(normalizeInput(), "NFD")}
                                </div>
                            </div>

                            {/* NFKC */}
                            <div class="card bg-base-200/50 border border-base-300 p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <span class="font-bold text-sm text-primary">NFKC (互換合成形式)</span>
                                        <p class="text-xs text-base-content/60">
                                            半角カナを全角に、全角英数を半角に統一
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="btn btn-outline btn-xs"
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
                                <div class="p-3 bg-base-100 rounded border border-base-300 font-mono text-sm">
                                    {normalizeUnicode(normalizeInput(), "NFKC")}
                                </div>
                            </div>

                            {/* NFKD */}
                            <div class="card bg-base-200/50 border border-base-300 p-4 space-y-2">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <span class="font-bold text-sm text-primary">NFKD (互換分解形式)</span>
                                        <p class="text-xs text-base-content/60">
                                            互換文字を展開し分解
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="btn btn-outline btn-xs"
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
                                <div class="p-3 bg-base-100 rounded border border-base-300 font-mono text-sm">
                                    {normalizeUnicode(normalizeInput(), "NFKD")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            {/* TAB 6: 文字化け修復 */}
            <Show when={activeTab() === "mojibake"}>
                <div class="card bg-base-100 border border-base-300 shadow-sm">
                    <div class="card-body p-6 space-y-6">
                        <div class="space-y-2">
                            <h2 class="card-title text-lg font-bold">
                                文字化け自動復元・修復ツール
                            </h2>
                            <p class="text-sm text-base-content/70">
                                「縺薙ｓ縺ｫ縺｡縺ｯ」や「ã‚ã„ã†」など、UTF-8やShift_JIS、EUC-JP、Latin-1が食い違って文字化けしてしまったテキストを貼り付けると、元の文章を自動推測して復元します。
                            </p>
                        </div>

                        <div class="form-control">
                            <div class="mb-1">
                                <label class="label-text font-semibold">文字化けしたテキスト</label>
                            </div>
                            <textarea
                                class="textarea textarea-bordered w-full font-mono text-sm min-h-[120px]"
                                placeholder="文字化けした文字列をここに貼り付けてください..."
                                value={mojibakeInput()}
                                onInput={(e) => setMojibakeInput(e.currentTarget.value)}
                            />
                        </div>

                        <div class="space-y-3">
                            <h3 class="text-sm font-bold">復元候補</h3>
                            <Show
                                when={mojibakeCandidates().length > 0}
                                fallback={
                                    <div class="p-6 text-center text-sm text-base-content/50 bg-base-200/40 rounded-lg">
                                        {mojibakeInput()
                                            ? "該当する典型的な文字化けパターンは見つかりませんでした。テキスト文字コード変換タブでエンコーディングを手動指定してお試しください。"
                                            : "文字化けしたテキストを入力すると、ここに復元候補が表示されます。"}
                                    </div>
                                }
                            >
                                <div class="space-y-3">
                                    <For each={mojibakeCandidates()}>
                                        {(candidate, idx) => (
                                            <div class="card bg-base-200/50 border border-base-300 p-4 space-y-2">
                                                <div class="flex justify-between items-center">
                                                    <div>
                                                        <span class="font-bold text-sm text-primary">
                                                            {candidate.label}
                                                        </span>
                                                        <p class="text-xs text-base-content/60">
                                                            {candidate.description}
                                                        </p>
                                                    </div>
                                                    <div class="flex gap-2">
                                                        <button
                                                            type="button"
                                                            class="btn btn-outline btn-xs"
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
                                                            class="btn btn-primary btn-xs"
                                                            onClick={() => {
                                                                setInputText(candidate.restoredText);
                                                                setActiveTab("text");
                                                            }}
                                                        >
                                                            テキスト変換に送る
                                                        </button>
                                                    </div>
                                                </div>
                                                <div class="p-3 bg-base-100 rounded border border-base-300 font-mono text-sm select-all">
                                                    {candidate.restoredText}
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>
            </Show>

            {/* 解説・FAQセクション */}
            <div class="card bg-base-100 border border-base-300 shadow-sm">
                <div class="card-body p-6 space-y-6 text-sm text-base-content/80">
                    <h2 class="card-title text-lg font-bold text-base-content">
                        文字コード・進数表記・改行コードに関する技術解説とFAQ
                    </h2>

                    <div class="space-y-4">
                        <div>
                            <h3 class="font-bold text-base text-primary mb-1">
                                Q. UTF-8とShift_JIS（CP932）の違いは何ですか？
                            </h3>
                            <p class="leading-relaxed text-sm">
                                UTF-8は世界標準のUnicode文字コードであり、日本語だけでなく多言語や絵文字を包括しています。一方、Shift_JISはWindowsや従来の日本国内システムで長年使用されてきた日本語専用文字コードです。現代のWeb標準はUTF-8ですが、Windows用CSV（Excel）や古いレガシーシステム連携ではShift_JISが現在も頻繁に利用されます。
                            </p>
                        </div>

                        <div>
                            <h3 class="font-bold text-base text-primary mb-1">
                                Q. ExcelでCSVを開くと文字化けするのはなぜですか？
                            </h3>
                            <p class="leading-relaxed text-sm">
                                日本語版WindowsのExcelは、CSVファイルをデフォルトでShift_JIS（CP932）として解釈します。そのためUTF-8で保存されたCSVを開くと文字化けします。解決するには、本ツールで文字コードを「Shift_JIS」に変換するか、「UTF-8 (BOM付き)」で保存してください。BOMが付くことでExcelが自動的にUTF-8と識別できるようになります。
                            </p>
                        </div>

                        <div>
                            <h3 class="font-bold text-base text-primary mb-1">
                                Q. 16進数（HEX）やUnicodeエスケープ（\uXXXX）とは？
                            </h3>
                            <p class="leading-relaxed text-sm">
                                コンピュータは文字を直接扱えず、バイト列（数値）として保存・通信します。16進数（HEX）はバイト列を人間が読みやすく表記したものです。また、Unicodeエスケープ（\u3042 等）やHTML数値文字参照（&#12354; 等）は、ASCII文字しか送信できない通信路やHTMLソース上で安全に特殊文字を埋め込むための記法です。
                            </p>
                        </div>

                        <div>
                            <h3 class="font-bold text-base text-primary mb-1">
                                Q. Unicode正規化（NFC / NFD）とは何ですか？
                            </h3>
                            <p class="leading-relaxed text-sm">
                                例えば「が」という文字は、1つの文字「が」（U+304C: NFC）として表す方法と、「か」（U+304B）＋結合濁点（U+3099: NFD）の2文字を合体させて表す方法があります。macOSのファイルシステム（HFS+等）ではNFDが使われるため、Windowsにコピーした際にファイル名が文字化けしたり検索に引っかからなくなる原因となります。NFCに正規化することでこれを解決できます。
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <AdSense />
            <AdSense />
        </div>
    );
}
