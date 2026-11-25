import { createSignal, createMemo, createEffect, onSettled, Show, For } from "solid-js";
import type { JSX } from "@solidjs/web";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import {
    delayedCall,
    playPageEntrance,
} from "../utils/animations";
import { usePageI18n } from "../i18n/index";
import {
    convertText,
    ConversionMode,
    markdownToHtml,
    escapeHtml,
    parseHtmlToAst,
    HtmlNode,
} from "../utils/textConverter";

function sanitizeSafeUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim().replace(/[<>"'&\s\\]/g, "");
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return undefined;
}

function renderSafeHtmlNode(node: HtmlNode): JSX.Element {
    if (node.type === "text") {
        return node.content;
    }
    const children = () => <For each={node.children}>{(child) => renderSafeHtmlNode(child)}</For>;
    switch (node.tag) {
        case "h1":
            return <h1>{children()}</h1>;
        case "h2":
            return <h2>{children()}</h2>;
        case "h3":
            return <h3>{children()}</h3>;
        case "h4":
            return <h4>{children()}</h4>;
        case "h5":
            return <h5>{children()}</h5>;
        case "h6":
            return <h6>{children()}</h6>;
        case "p":
            return <p>{children()}</p>;
        case "strong":
        case "b":
            return <strong>{children()}</strong>;
        case "em":
        case "i":
            return <em>{children()}</em>;
        case "del":
        case "s":
        case "strike":
            return <del>{children()}</del>;
        case "code":
            return <code class={node.attrs["class"]}>{children()}</code>;
        case "pre":
            return <pre class={node.attrs["class"]}>{children()}</pre>;
        case "blockquote":
            return <blockquote>{children()}</blockquote>;
        case "ul":
            return <ul>{children()}</ul>;
        case "ol":
            return <ol>{children()}</ol>;
        case "li":
            return <li>{children()}</li>;
        case "table":
            return <table>{children()}</table>;
        case "thead":
            return <thead>{children()}</thead>;
        case "tbody":
            return <tbody>{children()}</tbody>;
        case "tr":
            return <tr>{children()}</tr>;
        case "th":
            return <th>{children()}</th>;
        case "td":
            return <td>{children()}</td>;
        case "hr":
            return <hr />;
        case "br":
            return <br />;
        case "a": {
            const safeHref = sanitizeSafeUrl(node.attrs["href"]);
            return safeHref ? (
                <a href={safeHref} target="_blank" rel="noopener noreferrer">
                    {children()}
                </a>
            ) : (
                <span>{children()}</span>
            );
        }
        case "img": {
            const safeSrc = sanitizeSafeUrl(node.attrs["src"]);
            return safeSrc ? <img src={safeSrc} alt={node.attrs["alt"] || ""} /> : null;
        }
        default:
            return <span>{children()}</span>;
    }
}

interface ModeDefinition {
    id: ConversionMode;
    label: string;
    from: "html" | "markdown" | "plain" | "entities" | "url";
    to: "html" | "markdown" | "plain" | "entities" | "url";
    description: string;
    reverseMode?: ConversionMode;
}

const CONVERSION_MODES: ModeDefinition[] = [
    {
        id: "html-to-markdown",
        label: "HTML → Markdown",
        from: "html",
        to: "markdown",
        description: "HTMLタグを見出し、太字、リンク、テーブルなどのMarkdown記法に変換します。",
        reverseMode: "markdown-to-html",
    },
    {
        id: "markdown-to-html",
        label: "Markdown → HTML",
        from: "markdown",
        to: "html",
        description: "Markdown記法のテキストをクリーンなHTMLコードに変換します。",
        reverseMode: "html-to-markdown",
    },
    {
        id: "html-to-plain",
        label: "HTML → プレーンテキスト",
        from: "html",
        to: "plain",
        description: "HTMLタグやスタイル、スクリプトを除去し、純粋な可読テキストを抽出します。",
        reverseMode: "plain-to-html",
    },
    {
        id: "plain-to-html",
        label: "プレーンテキスト → HTML",
        from: "plain",
        to: "html",
        description: "通常のテキストをHTML段落（<p>）や改行（<br>）に変換し、特殊文字を安全にエスケープします。",
        reverseMode: "html-to-plain",
    },
    {
        id: "markdown-to-plain",
        label: "Markdown → プレーンテキスト",
        from: "markdown",
        to: "plain",
        description: "Markdownの見出し記号やリンク構文などを取り除き、プレーンな文章にします。",
        reverseMode: "plain-to-markdown",
    },
    {
        id: "plain-to-markdown",
        label: "プレーンテキスト → Markdown",
        from: "plain",
        to: "markdown",
        description: "プレーンテキストをMarkdown形式のドキュメントとして整えます。",
        reverseMode: "markdown-to-plain",
    },
    {
        id: "html-entities-encode",
        label: "HTML特殊文字エスケープ",
        from: "plain",
        to: "entities",
        description: "<, >, &, \", ' などの特殊文字を &lt;, &gt;, &amp; などのHTMLエンティティに変換します。",
        reverseMode: "html-entities-decode",
    },
    {
        id: "html-entities-decode",
        label: "HTMLエンティティ復元 (デコード)",
        from: "entities",
        to: "plain",
        description: "&amp;, &lt;, &gt;, &quot;, &#39; などのエンティティを元の文字に戻します。",
        reverseMode: "html-entities-encode",
    },
    {
        id: "url-encode",
        label: "URLエンコード",
        from: "plain",
        to: "url",
        description: "文字列をURLで安全に送信できるパーセントエンコード形式に変換します。",
        reverseMode: "url-decode",
    },
    {
        id: "url-decode",
        label: "URLデコード",
        from: "url",
        to: "plain",
        description: "パーセントエンコードされたURL文字列を人間が読める通常の文字列に復元します。",
        reverseMode: "url-encode",
    },
];

export default function TextConverter() {
    const { title, description } = usePageI18n("/text-converter", {
        defaultTitle: "テキスト・HTML・Markdown変換ツール",
        defaultDescription:
            "HTMLからMarkdown、MarkdownからHTML、プレーンテキスト抽出、特殊文字エスケープなどを瞬時に相互変換できます。すべてブラウザ内で処理されるため、データがサーバーに送信される心配はありません。",
    });
    const [selectedMode, setSelectedMode] = createSignal<ConversionMode>("html-to-markdown");
    const [inputText, setInputText] = createSignal("");
    const [outputText, setOutputText] = createSignal("");
    const [activeTab, setActiveTab] = createSignal<"code" | "preview">("code");
    const [copied, setCopied] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    // オプション
    const [convertLineBreaks, setConvertLineBreaks] = createSignal(true);
    const [wrapInParagraphs, setWrapInParagraphs] = createSignal(true);
    const [autoLinkUrls, setAutoLinkUrls] = createSignal(true);
    const [preserveListBullets, setPreserveListBullets] = createSignal(true);
    const [includeLinksInPlain, setIncludeLinksInPlain] = createSignal(false);

    let containerRef: HTMLDivElement | undefined;
    let fileInputRef: HTMLInputElement | undefined;

    // 現在のモード設定を取得
    const currentModeDef = createMemo(() => {
        return CONVERSION_MODES.find((m) => m.id === selectedMode()) || CONVERSION_MODES[0];
    });

    // 変換実行
    const runConversion = (
        text: string,
        mode: ConversionMode,
        options: {
            convertLineBreaks: boolean;
            wrapInParagraphs: boolean;
            autoLinkUrls: boolean;
            preserveListBullets: boolean;
            includeLinks: boolean;
        }
    ) => {
        if (!text) {
            setOutputText("");
            setErrorMessage(null);
            return;
        }

        const res = convertText(text, mode, options);

        if (res.error) {
            setErrorMessage(res.error);
        } else {
            setErrorMessage(null);
            setOutputText(res.output);
        }
    };

    // 入力や設定の変更時に変換を即時実行
    createEffect(
        () => ({
            text: inputText(),
            mode: selectedMode(),
            options: {
                convertLineBreaks: convertLineBreaks(),
                wrapInParagraphs: wrapInParagraphs(),
                autoLinkUrls: autoLinkUrls(),
                preserveListBullets: preserveListBullets(),
                includeLinks: includeLinksInPlain(),
            },
        }),
        ({ text, mode, options }) => {
            runConversion(text, mode, options);
        }
    );

    onSettled(() => {
        if (containerRef) {
            playPageEntrance(containerRef, ".ba-card");
        }
    });

    // スワップ（反転）処理
    const handleSwap = () => {
        const currentDef = currentModeDef();
        if (currentDef.reverseMode) {
            const currentOutput = outputText();
            setSelectedMode(currentDef.reverseMode);
            setInputText(currentOutput);
        } else {
            // 単純に入れ替え
            const curOut = outputText();
            setInputText(curOut);
        }
    };

    // クリア
    const handleClear = () => {
        setInputText("");
        setOutputText("");
        setErrorMessage(null);
    };

    // クリップボードへコピー
    const handleCopy = async () => {
        if (!outputText()) return;
        try {
            await navigator.clipboard.writeText(outputText());
            setCopied(true);
            delayedCall(2, () => setCopied(false));
        } catch {
            // フォールバック
            const ta = document.createElement("textarea");
            ta.value = outputText();
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            delayedCall(2, () => setCopied(false));
        }
    };

    // ファイルダウンロード
    const handleDownload = () => {
        const text = outputText();
        if (!text) return;

        let filename = "converted";
        const mode = selectedMode();
        if (mode.endsWith("markdown") || mode === "plain-to-markdown") {
            filename += ".md";
        } else if (mode.endsWith("html") || mode === "plain-to-html") {
            filename += ".html";
        } else {
            filename += ".txt";
        }

        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ファイル読み込み
    const handleFileUpload = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                setInputText(content);
            }
        };
        reader.readAsText(file);
        target.value = "";
    };

    // プレビュー用HTMLの計算（プレビュータブ選択時のみ評価）
    const previewAstNodes = createMemo(() => {
        if (activeTab() !== "preview") return [];
        const mode = selectedMode();
        const out = outputText();
        if (!out) return [];

        let html = "";
        if (mode === "markdown-to-html" || mode === "plain-to-html") {
            html = out;
        } else if (mode === "html-to-markdown" || mode === "plain-to-markdown") {
            html = markdownToHtml(out);
        } else if (
            mode === "html-to-plain" ||
            mode === "markdown-to-plain" ||
            mode === "html-entities-decode" ||
            mode === "url-decode"
        ) {
            html = `<pre class="ba-code">${escapeHtml(out)}</pre>`;
        } else {
            html = `<pre class="ba-code">${escapeHtml(out)}</pre>`;
        }
        return parseHtmlToAst(html).children;
    });

    // カウント情報（split("\n")による配列生成を避けて高速走査）
    const computeTextStats = (text: string) => {
        if (!text) return { lines: 0, chars: 0, bytes: 0 };
        let lines = 1;
        for (let i = 0; i < text.length; i++) {
            if (text.charCodeAt(i) === 10) lines++;
        }
        return {
            lines,
            chars: text.length,
            bytes: new Blob([text]).size,
        };
    };

    const inputStats = createMemo(() => computeTextStats(inputText()));
    const outputStats = createMemo(() => computeTextStats(outputText()));

    return (
        <div ref={containerRef} class="ba-page">
            {/* ページタイトル & 概要 */}
            <div class="ba-card ba-stack-4">
                <div>
                    <h1 class="ba-title">
                        <BudouX text={title()} />
                    </h1>
                    <p
                        class="ba-text-muted ba-text-sm"
                        style={{ "margin-top": "0.5rem", "margin-bottom": 0, "line-height": 1.65 }}
                    >
                        <BudouX text={description()} />
                    </p>
                </div>

                {/* モード選択ボタン群 */}
                <div class="ba-stack-2">
                    <label class="ba-label ba-text-muted">
                        変換モードを選択
                    </label>
                    <div
                        style={{
                            display: "grid",
                            "grid-template-columns": "repeat(auto-fill, minmax(11rem, 1fr))",
                            gap: "0.5rem",
                        }}
                    >
                        <For each={CONVERSION_MODES}>
                            {(mode) => (
                                <button
                                    type="button"
                                    class={`ba-btn ba-btn--sm ${
                                        selectedMode() === mode.id
                                            ? "ba-btn--primary"
                                            : "ba-btn--outline"
                                    }`}
                                    style={{
                                        "justify-content": "flex-start",
                                        height: "auto",
                                        padding: "0.6rem 0.75rem",
                                        "white-space": "normal",
                                        "text-align": "left",
                                        "font-size": "0.75rem",
                                    }}
                                    onClick={() => setSelectedMode(mode.id)}
                                >
                                    <span class="ba-font-bold">{mode.label}</span>
                                </button>
                            )}
                        </For>
                    </div>
                </div>

                {/* 現在のモードの説明と反転ボタン */}
                <div
                    class="ba-panel ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-3"
                    style={{ padding: "0.75rem" }}
                >
                    <div class="ba-text-xs ba-text-muted ba-flex ba-items-center ba-gap-2">
                        <span class="ba-badge ba-badge--primary">機能</span>
                        <span>{currentModeDef().description}</span>
                    </div>
                    <Show when={currentModeDef().reverseMode}>
                        <button
                            type="button"
                            class="ba-btn ba-btn--outline ba-btn--xs"
                            style={{ "margin-left": "auto" }}
                            onClick={handleSwap}
                            title="入力と出力を入れ替えて逆方向に変換"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="ba-icon-xs"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                />
                            </svg>
                            <span>逆変換に切り替え (⇄)</span>
                        </button>
                    </Show>
                </div>
            </div>

            {/* エディターエリア（2カラム / モバイルでは縦積み） */}
            <div class="ba-grid-2">
                {/* 入力パネル */}
                <div class="ba-card ba-stack-3">
                    {/* パネルヘッダー */}
                    <div
                        class="ba-flex ba-items-center ba-justify-between ba-gap-2"
                        style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                    >
                        <div class="ba-flex ba-items-center ba-gap-2">
                            <span class="ba-font-bold ba-text-sm">
                                入力
                            </span>
                            <span class="ba-badge ba-badge--neutral">
                                {inputStats().chars} 文字 / {inputStats().lines} 行
                            </span>
                        </div>

                        <div class="ba-flex ba-items-center ba-gap-1">
                            <button
                                type="button"
                                class="ba-btn ba-btn--ghost ba-btn--xs"
                                onClick={() => fileInputRef?.click()}
                                title="テキストファイルを読み込む"
                                aria-label="読込"
                            >
                                読込
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt,.html,.htm,.md,.json,.xml"
                                aria-label="テキストファイルを選択"
                                hidden
                                onChange={handleFileUpload}
                            />
                            <button
                                type="button"
                                class="ba-btn ba-btn--ghost ba-btn--xs ba-text-danger"
                                onClick={handleClear}
                                title="入力をクリア"
                                aria-label="クリア"
                            >
                                クリア
                            </button>
                        </div>
                    </div>

                    {/* 入力テキストエリア */}
                    <div class="ba-flex-col ba-flex-1">
                        <textarea
                            class="ba-textarea ba-mono ba-text-xs"
                            style={{
                                height: "22rem",
                                "line-height": 1.6,
                                "background-color": "var(--ba-surface-2)",
                            }}
                            placeholder="変換したいテキストまたはHTML/Markdownをここに入力..."
                            value={inputText()}
                            aria-label="変換前のテキスト入力"
                            onInput={(e) => setInputText(e.currentTarget.value)}
                        />
                    </div>

                    {/* 入力側ステータスバー */}
                    <div class="ba-text-right ba-text-xs ba-text-muted">
                        容量: {(inputStats().bytes / 1024).toFixed(2)} KB
                    </div>
                </div>

                {/* 出力パネル */}
                <div class="ba-card ba-stack-3">
                    {/* パネルヘッダー */}
                    <div
                        class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2"
                        style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                    >
                        <div class="ba-flex ba-items-center ba-gap-2">
                            <span class="ba-font-bold ba-text-sm ba-text-primary">
                                変換結果
                            </span>
                            <span class="ba-badge ba-badge--neutral">
                                {outputStats().chars} 文字 / {outputStats().lines} 行
                            </span>
                        </div>

                        <div class="ba-flex ba-items-center ba-gap-2 ba-flex-wrap">
                            {/* タブ切り替え（ソースコード / プレビュー） */}
                            <div class="ba-tabs" style={{ padding: "0.2rem" }}>
                                <button
                                    type="button"
                                    class={`ba-tab ${activeTab() === "code" ? "is-active" : ""}`}
                                    style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                    onClick={() => setActiveTab("code")}
                                >
                                    ソース
                                </button>
                                <button
                                    type="button"
                                    class={`ba-tab ${activeTab() === "preview" ? "is-active" : ""}`}
                                    style={{ padding: "0.25rem 0.6rem", "font-size": "0.75rem" }}
                                    onClick={() => setActiveTab("preview")}
                                >
                                    プレビュー
                                </button>
                            </div>

                            {/* コピーボタン */}
                            <button
                                type="button"
                                class={`ba-btn ba-btn--xs ${
                                    copied() ? "ba-btn--success" : "ba-btn--primary"
                                }`}
                                onClick={handleCopy}
                                disabled={!outputText()}
                            >
                                <Show
                                    when={copied()}
                                    fallback={
                                        <>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                class="ba-icon-xs"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                                />
                                            </svg>
                                            <span>コピー</span>
                                        </>
                                    }
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="ba-icon-xs"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                    <span>完了!</span>
                                </Show>
                            </button>

                            {/* 保存ボタン */}
                            <button
                                type="button"
                                class="ba-btn ba-btn--outline ba-btn--xs"
                                onClick={handleDownload}
                                disabled={!outputText()}
                                title="ファイルとしてダウンロード"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="ba-icon-xs"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                </svg>
                                <span>保存</span>
                            </button>
                        </div>
                    </div>

                    {/* 出力コンテンツエリア */}
                    <div class="ba-stack-2 ba-flex-1">
                        <Show when={errorMessage()}>
                            <div class="ba-alert ba-alert--error">
                                <span>{errorMessage()}</span>
                            </div>
                        </Show>

                        <Show
                            when={activeTab() === "code"}
                            fallback={
                                <div
                                    class="ba-panel ba-scroll-y ba-text-sm"
                                    style={{ height: "22rem", "line-height": 1.65 }}
                                >
                                    <For each={previewAstNodes()}>
                                        {(node) => renderSafeHtmlNode(node)}
                                    </For>
                                </div>
                            }
                        >
                            <textarea
                                readonly
                                class="ba-textarea ba-mono ba-text-xs"
                                style={{
                                    height: "22rem",
                                    "line-height": 1.6,
                                    "background-color": "var(--ba-surface-2)",
                                }}
                                placeholder="変換されたテキストがここに表示されます..."
                                aria-label="変換後のテキスト結果"
                                value={outputText()}
                            />
                        </Show>
                    </div>

                    {/* 出力側ステータスバー */}
                    <div class="ba-text-right ba-text-xs ba-text-muted">
                        容量: {(outputStats().bytes / 1024).toFixed(2)} KB
                    </div>
                </div>
            </div>

            {/* 詳細設定オプション（アコーディオン） */}
            <details class="ba-accordion">
                <summary>
                    <span class="ba-flex ba-items-center ba-gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="ba-icon-sm ba-text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                        <span>変換オプション設定</span>
                    </span>
                </summary>
                <div class="ba-accordion-body">
                    <div class="ba-grid-3">
                        <label
                            class="ba-flex ba-items-center ba-gap-3"
                            style={{
                                "background-color": "var(--ba-surface)",
                                padding: "0.75rem",
                                "border-radius": "var(--ba-radius-sm)",
                                border: "1px solid var(--ba-border)",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                class="ba-checkbox"
                                checked={convertLineBreaks()}
                                onChange={(e) => setConvertLineBreaks(e.currentTarget.checked)}
                            />
                            <span class="ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                <strong>Markdown→HTML:</strong> 改行を &lt;br /&gt; に変換
                            </span>
                        </label>

                        <label
                            class="ba-flex ba-items-center ba-gap-3"
                            style={{
                                "background-color": "var(--ba-surface)",
                                padding: "0.75rem",
                                "border-radius": "var(--ba-radius-sm)",
                                border: "1px solid var(--ba-border)",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                class="ba-checkbox"
                                checked={wrapInParagraphs()}
                                onChange={(e) => setWrapInParagraphs(e.currentTarget.checked)}
                            />
                            <span class="ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                <strong>テキスト→HTML:</strong> 空行で段落 (&lt;p&gt;) に分割
                            </span>
                        </label>

                        <label
                            class="ba-flex ba-items-center ba-gap-3"
                            style={{
                                "background-color": "var(--ba-surface)",
                                padding: "0.75rem",
                                "border-radius": "var(--ba-radius-sm)",
                                border: "1px solid var(--ba-border)",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                class="ba-checkbox"
                                checked={autoLinkUrls()}
                                onChange={(e) => setAutoLinkUrls(e.currentTarget.checked)}
                            />
                            <span class="ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                <strong>テキスト→HTML:</strong> URLを自動リンク化 (&lt;a&gt;)
                            </span>
                        </label>

                        <label
                            class="ba-flex ba-items-center ba-gap-3"
                            style={{
                                "background-color": "var(--ba-surface)",
                                padding: "0.75rem",
                                "border-radius": "var(--ba-radius-sm)",
                                border: "1px solid var(--ba-border)",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                class="ba-checkbox"
                                checked={preserveListBullets()}
                                onChange={(e) => setPreserveListBullets(e.currentTarget.checked)}
                            />
                            <span class="ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                <strong>HTML→テキスト:</strong> リストにビュレット (•) を付与
                            </span>
                        </label>

                        <label
                            class="ba-flex ba-items-center ba-gap-3"
                            style={{
                                "background-color": "var(--ba-surface)",
                                padding: "0.75rem",
                                "border-radius": "var(--ba-radius-sm)",
                                border: "1px solid var(--ba-border)",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                class="ba-checkbox"
                                checked={includeLinksInPlain()}
                                onChange={(e) => setIncludeLinksInPlain(e.currentTarget.checked)}
                            />
                            <span class="ba-text-xs" style={{ color: "var(--ba-text)" }}>
                                <strong>HTML→テキスト:</strong> リンクURLを末尾に併記
                            </span>
                        </label>
                    </div>
                </div>
            </details>

            {/* 使い方・機能解説ガイド */}
            <div class="ba-card ba-stack-4">
                <h2 class="ba-section-title ba-text-primary ba-flex ba-items-center ba-gap-2">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="ba-icon-md"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <span>各変換機能の特徴とおすすめの使い方</span>
                </h2>

                <div class="ba-grid-2">
                    <div class="ba-panel ba-stack-2">
                        <h3 class="ba-font-bold ba-text-sm ba-text-primary" style={{ margin: 0 }}>
                            HTML → Markdown 変換
                        </h3>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            ブログ記事やCMSのリッチテキスト、NotionやGitHubで使いたいHTMLコードを、標準的なMarkdown構文（見出し、リスト、テーブル、コードブロック）に変換します。不要なスタイル属性やスクリプトタグは自動で除去されます。
                        </p>
                    </div>

                    <div class="ba-panel ba-stack-2">
                        <h3 class="ba-font-bold ba-text-sm ba-text-primary" style={{ margin: 0 }}>
                            Markdown → HTML 変換
                        </h3>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            Markdownで書いたドキュメントを即座にHTML形式に変換します。見出しタグ（h1〜h6）、テーブル、リンク、引用（blockquote）、シンタックス言語クラス付きコードブロックに対応しており、ウェブサイトへの埋め込みに最適です。
                        </p>
                    </div>

                    <div class="ba-panel ba-stack-2">
                        <h3 class="ba-font-bold ba-text-sm ba-text-primary" style={{ margin: 0 }}>
                            HTML / Markdown → プレーンテキスト
                        </h3>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            ウェブページからコピーした装飾付きテキストやMarkdownから、タグや特殊記号をすべて剥がし、純粋な可読文章だけを抽出します。メール本文やチャットツール、テキストファイルへの転記に便利です。
                        </p>
                    </div>

                    <div class="ba-panel ba-stack-2">
                        <h3 class="ba-font-bold ba-text-sm ba-text-primary" style={{ margin: 0 }}>
                            HTMLエンティティ & URLエンコード
                        </h3>
                        <p class="ba-text-xs ba-text-muted" style={{ margin: 0, "line-height": 1.65 }}>
                            プログラミングやWeb制作で必須となる「&lt;, &gt;, &amp;, &quot;」などの文字実体参照へのエスケープや、日本語URL・クエリパラメータのパーセントエンコード・デコードが簡単に行えます。
                        </p>
                    </div>
                </div>
            </div>

            {/* 広告エリア */}
            <AdSense />
            <AdSense />
        </div>
    );
}
