import { createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import {
    delayedCall,
    playPageEntrance,
    animateFadeIn,
    animatePop,
} from "../utils/gsapAnimations";
import {
    convertText,
    ConversionMode,
    htmlToMarkdown,
    markdownToHtml,
    htmlToPlainText,
    plainTextToHtml,
    markdownToPlainText,
    escapeHtml,
    unescapeHtml,
} from "../utils/textConverter";

interface ModeDefinition {
    id: ConversionMode;
    label: string;
    from: "html" | "markdown" | "plain" | "entities" | "url";
    to: "html" | "markdown" | "plain" | "entities" | "url";
    description: string;
    sample: string;
    reverseMode?: ConversionMode;
}

const CONVERSION_MODES: ModeDefinition[] = [
    {
        id: "html-to-markdown",
        label: "HTML → Markdown",
        from: "html",
        to: "markdown",
        description: "HTMLタグを見出し、太字、リンク、テーブルなどのMarkdown記法に変換します。",
        sample: `<h1>見出し1</h1>
<p>これは <strong>太字</strong> と <em>斜体</em>、および <a href="https://example.com">リンク</a> のサンプルです。</p>
<ul>
  <li>リスト項目 A</li>
  <li>リスト項目 B</li>
</ul>
<pre><code class="language-javascript">console.log("Hello, World!");</code></pre>
<table>
  <thead>
    <tr><th>商品</th><th>価格</th></tr>
  </thead>
  <tbody>
    <tr><td>りんご</td><td>150円</td></tr>
    <tr><td>みかん</td><td>100円</td></tr>
  </tbody>
</table>`,
        reverseMode: "markdown-to-html",
    },
    {
        id: "markdown-to-html",
        label: "Markdown → HTML",
        from: "markdown",
        to: "html",
        description: "Markdown記法のテキストをクリーンなHTMLコードに変換します。",
        sample: `# タイトル見出し

これは **太字** と *斜体*、そして [リンク](https://example.com) です。

- 箇条書きアイテム1
- 箇条書きアイテム2

\`\`\`typescript
const greet = (name: string): string => \`Hello, \${name}!\`;
\`\`\`

| 名前 | 役割 |
| --- | --- |
| 太郎 | エンジニア |
| 花子 | デザイナー |`,
        reverseMode: "html-to-markdown",
    },
    {
        id: "html-to-plain",
        label: "HTML → プレーンテキスト",
        from: "html",
        to: "plain",
        description: "HTMLタグやスタイル、スクリプトを除去し、純粋な可読テキストを抽出します。",
        sample: `<h2>記事のタイトル</h2>
<p>ウェブサイトからコピーしたテキストには、余分なHTMLタグや書式が含まれることがあります。</p>
<ul>
  <li>不要なタグを一括削除</li>
  <li>改行や箇条書きを綺麗に整理</li>
  <li>メルマガやメモ帳への貼り付けに最適</li>
</ul>`,
        reverseMode: "plain-to-html",
    },
    {
        id: "plain-to-html",
        label: "プレーンテキスト → HTML",
        from: "plain",
        to: "html",
        description: "通常のテキストをHTML段落（<p>）や改行（<br>）に変換し、特殊文字を安全にエスケープします。",
        sample: `日常で役立つWebツール集

入力したテキストは自動でHTMLタグに変換されます。
空行を入れると段落に分割されます。

参考URL: https://example.com
特殊文字: 5 < 10 && 20 > 15`,
        reverseMode: "html-to-plain",
    },
    {
        id: "markdown-to-plain",
        label: "Markdown → プレーンテキスト",
        from: "markdown",
        to: "plain",
        description: "Markdownの見出し記号やリンク構文などを取り除き、プレーンな文章にします。",
        sample: `# 重要なお知らせ

**日時:** 2026年11月1日 10:00〜
**場所:** [公式オンライン会場](https://example.com)

- 事前登録が必要です
- 参加費は無料です`,
        reverseMode: "plain-to-markdown",
    },
    {
        id: "plain-to-markdown",
        label: "プレーンテキスト → Markdown",
        from: "plain",
        to: "markdown",
        description: "プレーンテキストをMarkdown形式のドキュメントとして整えます。",
        sample: `第1章 はじめに

このドキュメントはプレーンテキストからMarkdownに変換するサンプルです。
改行や段落の構造を保持します。`,
        reverseMode: "markdown-to-plain",
    },
    {
        id: "html-entities-encode",
        label: "HTML特殊文字エスケープ",
        from: "plain",
        to: "entities",
        description: "<, >, &, \", ' などの特殊文字を &lt;, &gt;, &amp; などのHTMLエンティティに変換します。",
        sample: `<script>alert("XSS & danger!");</script>
<div class='box' id="main">こんにちは & さようなら</div>`,
        reverseMode: "html-entities-decode",
    },
    {
        id: "html-entities-decode",
        label: "HTMLエンティティ復元 (デコード)",
        from: "entities",
        to: "plain",
        description: "&amp;, &lt;, &gt;, &quot;, &#39; などのエンティティを元の文字に戻します。",
        sample: `&lt;div class=&quot;sample&quot;&gt;5 &amp;gt; 3 &amp;&amp; 2 &amp;lt; 4&#39;s result&lt;/div&gt;`,
        reverseMode: "html-entities-encode",
    },
    {
        id: "url-encode",
        label: "URLエンコード",
        from: "plain",
        to: "url",
        description: "文字列をURLで安全に送信できるパーセントエンコード形式に変換します。",
        sample: `https://example.com/search?q=ウェブ ツール & 変換=1`,
        reverseMode: "url-decode",
    },
    {
        id: "url-decode",
        label: "URLデコード",
        from: "url",
        to: "plain",
        description: "パーセントエンコードされたURL文字列を人間が読める通常の文字列に復元します。",
        sample: `https%3A%2F%2Fexample.com%2Fsearch%3Fq%3D%E3%82%A6%E3%82%A7%E3%83%96%20%E3%83%84%E3%83%BC%E3%83%AB%20%26%20%E5%A4%89%E6%8F%9B%3D1`,
        reverseMode: "url-encode",
    },
];

export default function TextConverter() {
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
    const runConversion = (text: string, mode: ConversionMode) => {
        if (!text) {
            setOutputText("");
            setErrorMessage(null);
            return;
        }

        const res = convertText(text, mode, {
            convertLineBreaks: convertLineBreaks(),
            wrapInParagraphs: wrapInParagraphs(),
            autoLinkUrls: autoLinkUrls(),
            preserveListBullets: preserveListBullets(),
            includeLinks: includeLinksInPlain(),
        });

        if (res.error) {
            setErrorMessage(res.error);
        } else {
            setErrorMessage(null);
            setOutputText(res.output);
        }
    };

    // 入力や設定の変更時に変換を即時実行
    createEffect(() => {
        const text = inputText();
        const mode = selectedMode();
        // オプション変更も追跡
        convertLineBreaks();
        wrapInParagraphs();
        autoLinkUrls();
        preserveListBullets();
        includeLinksInPlain();

        runConversion(text, mode);
    });

    onMount(() => {
        document.title = "テキスト・HTML・Markdown変換ツール | 無料の相互変換・エンティティ対応";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "HTMLからMarkdown、MarkdownからHTML、プレーンテキスト抽出、HTML特殊文字エスケープ・デコード、URLエンコードに対応した高機能テキスト変換ツール。ブラウザ上で安全かつ高速に変換できます。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "text-converter-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "テキスト・HTML・Markdown変換ツール",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "HTML、Markdown、プレーンテキストの相互変換およびHTMLエンティティやURLエンコードをローカルブラウザ内で完結して実行する無料Webツール。",
        });
        document.head.appendChild(script);

        // 初期状態でHTML→Markdownのサンプルを設定
        setInputText(CONVERSION_MODES[0].sample);

        if (containerRef) {
            playPageEntrance(containerRef, ".card");
        }
    });

    onCleanup(() => {
        const script = document.getElementById("text-converter-jsonld");
        if (script) script.remove();
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

    // サンプルテキスト読み込み
    const handleLoadSample = () => {
        setInputText(currentModeDef().sample);
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

    // プレビュー用HTMLの計算
    const previewHtml = createMemo(() => {
        const mode = selectedMode();
        const out = outputText();
        if (!out) return "";

        if (mode === "markdown-to-html" || mode === "plain-to-html") {
            return out;
        }
        if (mode === "html-to-markdown" || mode === "plain-to-markdown") {
            return markdownToHtml(out);
        }
        if (mode === "html-to-plain" || mode === "markdown-to-plain" || mode === "html-entities-decode" || mode === "url-decode") {
            return `<pre class="whitespace-pre-wrap font-sans">${escapeHtml(out)}</pre>`;
        }
        return `<pre class="whitespace-pre-wrap font-mono">${escapeHtml(out)}</pre>`;
    });

    // カウント情報
    const inputStats = createMemo(() => {
        const text = inputText();
        const lines = text ? text.split("\n").length : 0;
        const chars = text.length;
        const bytes = new Blob([text]).size;
        return { lines, chars, bytes };
    });

    const outputStats = createMemo(() => {
        const text = outputText();
        const lines = text ? text.split("\n").length : 0;
        const chars = text.length;
        const bytes = new Blob([text]).size;
        return { lines, chars, bytes };
    });

    return (
        <div ref={containerRef} class="max-w-6xl mx-auto space-y-8 px-2 sm:px-4">
            {/* ページタイトル & 概要 */}
            <div class="card bg-base-100 border border-base-300 shadow-sm">
                <div class="card-body p-6 sm:p-8">
                    <h1 class="card-title text-2xl sm:text-3xl font-bold text-primary mb-2">
                        <BudouX text="テキスト・HTML・Markdown変換ツール" />
                    </h1>
                    <p class="text-base-content/70 text-sm sm:text-base leading-relaxed">
                        <BudouX text="HTMLからMarkdown、MarkdownからHTML、プレーンテキスト抽出、特殊文字エスケープなどを瞬時に相互変換できます。すべてブラウザ内で処理されるため、データがサーバーに送信される心配はありません。" />
                    </p>

                    {/* モード選択ボタン群 */}
                    <div class="mt-6">
                        <label class="label text-xs sm:text-sm font-semibold text-base-content/70 px-0 mb-1">
                            変換モードを選択
                        </label>
                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            <For each={CONVERSION_MODES}>
                                {(mode) => (
                                    <button
                                        type="button"
                                        class={`btn btn-sm text-xs justify-start h-auto py-2.5 px-3 normal-case ${
                                            selectedMode() === mode.id
                                                ? "btn-primary shadow-sm"
                                                : "btn-outline border-base-300 hover:border-primary/50"
                                        }`}
                                        onClick={() => setSelectedMode(mode.id)}
                                    >
                                        <div class="text-left">
                                            <div class="font-bold">{mode.label}</div>
                                        </div>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* 現在のモードの説明と反転ボタン */}
                    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 bg-base-200/60 rounded-xl border border-base-300">
                        <div class="text-xs sm:text-sm text-base-content/80 flex items-center gap-2">
                            <span class="badge badge-primary badge-sm">機能</span>
                            <span>{currentModeDef().description}</span>
                        </div>
                        <Show when={currentModeDef().reverseMode}>
                            <button
                                type="button"
                                class="btn btn-outline btn-xs gap-1 ml-auto"
                                onClick={handleSwap}
                                title="入力と出力を入れ替えて逆方向に変換"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-3.5 h-3.5"
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
            </div>

            {/* エディターエリア（2カラム / モバイルでは縦積み） */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* 入力パネル */}
                <div class="card bg-base-100 border border-base-300 shadow-sm flex flex-col h-full">
                    <div class="card-body p-4 sm:p-5 flex flex-col flex-1">
                        {/* パネルヘッダー */}
                        <div class="flex items-center justify-between pb-3 border-b border-base-200">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-sm sm:text-base text-base-content">
                                    入力
                                </span>
                                <span class="badge badge-ghost badge-sm text-xs">
                                    {inputStats().chars} 文字 / {inputStats().lines} 行
                                </span>
                            </div>

                            <div class="flex items-center gap-1">
                                <button
                                    type="button"
                                    class="btn btn-ghost btn-xs text-base-content/70 hover:text-primary"
                                    onClick={handleLoadSample}
                                    title="サンプルコードを読み込む"
                                    aria-label="サンプルコードを読み込む"
                                >
                                    サンプル
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-ghost btn-xs text-base-content/70 hover:text-primary"
                                    onClick={() => fileInputRef?.click()}
                                    title="テキストファイルを読み込む"
                                    aria-label="テキストファイルを読み込む"
                                >
                                    読込
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.html,.htm,.md,.json,.xml"
                                    class="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    type="button"
                                    class="btn btn-ghost btn-xs text-error/80 hover:text-error"
                                    onClick={handleClear}
                                    title="入力をクリア"
                                    aria-label="入力をクリア"
                                >
                                    クリア
                                </button>
                            </div>
                        </div>

                        {/* 入力テキストエリア */}
                        <div class="mt-3 flex-1 flex flex-col">
                            <textarea
                                class="textarea textarea-bordered w-full flex-1 font-mono text-xs sm:text-sm leading-relaxed p-3 h-80 lg:h-96 resize-y focus:outline-primary bg-base-200/30"
                                placeholder="変換したいテキストまたはHTML/Markdownをここに入力..."
                                value={inputText()}
                                onInput={(e) => setInputText(e.currentTarget.value)}
                            />
                        </div>

                        {/* 入力側ステータスバー */}
                        <div class="mt-2 text-right text-xs text-base-content/50">
                            容量: {(inputStats().bytes / 1024).toFixed(2)} KB
                        </div>
                    </div>
                </div>

                {/* 出力パネル */}
                <div class="card bg-base-100 border border-base-300 shadow-sm flex flex-col h-full">
                    <div class="card-body p-4 sm:p-5 flex flex-col flex-1">
                        {/* パネルヘッダー */}
                        <div class="flex items-center justify-between pb-3 border-b border-base-200">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-sm sm:text-base text-primary">
                                    変換結果
                                </span>
                                <span class="badge badge-ghost badge-sm text-xs">
                                    {outputStats().chars} 文字 / {outputStats().lines} 行
                                </span>
                            </div>

                            <div class="flex items-center gap-2">
                                {/* タブ切り替え（ソースコード / プレビュー） */}
                                <div class="join">
                                    <button
                                        type="button"
                                        class={`join-item btn btn-xs ${
                                            activeTab() === "code"
                                                ? "btn-primary"
                                                : "btn-ghost text-base-content/60"
                                        }`}
                                        onClick={() => setActiveTab("code")}
                                    >
                                        ソース
                                    </button>
                                    <button
                                        type="button"
                                        class={`join-item btn btn-xs ${
                                            activeTab() === "preview"
                                                ? "btn-primary"
                                                : "btn-ghost text-base-content/60"
                                        }`}
                                        onClick={() => setActiveTab("preview")}
                                    >
                                        プレビュー
                                    </button>
                                </div>

                                {/* コピーボタン */}
                                <button
                                    type="button"
                                    class={`btn btn-xs gap-1 ${
                                        copied() ? "btn-success text-white" : "btn-primary"
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
                                                    class="w-3.5 h-3.5"
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
                                            class="w-3.5 h-3.5"
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
                                    class="btn btn-outline btn-xs"
                                    onClick={handleDownload}
                                    disabled={!outputText()}
                                    title="ファイルとしてダウンロード"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="w-3.5 h-3.5"
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
                        <div class="mt-3 flex-1 flex flex-col">
                            <Show when={errorMessage()}>
                                <div class="alert alert-error text-xs mb-3 py-2">
                                    <span>{errorMessage()}</span>
                                </div>
                            </Show>

                            <Show
                                when={activeTab() === "code"}
                                fallback={
                                    <div
                                        class="w-full flex-1 p-4 bg-base-200/50 rounded-lg border border-base-300 overflow-y-auto h-80 lg:h-96 prose max-w-none text-xs sm:text-sm text-base-content"
                                        innerHTML={previewHtml()}
                                    />
                                }
                            >
                                <textarea
                                    readonly
                                    class="textarea textarea-bordered w-full flex-1 font-mono text-xs sm:text-sm leading-relaxed p-3 h-80 lg:h-96 resize-y bg-base-200/30 text-base-content"
                                    placeholder="変換されたテキストがここに表示されます..."
                                    value={outputText()}
                                />
                            </Show>
                        </div>

                        {/* 出力側ステータスバー */}
                        <div class="mt-2 text-right text-xs text-base-content/50">
                            容量: {(outputStats().bytes / 1024).toFixed(2)} KB
                        </div>
                    </div>
                </div>
            </div>

            {/* 詳細設定オプション（アコーディオン） */}
            <div class="card bg-base-100 border border-base-300 shadow-sm">
                <div class="collapse collapse-arrow">
                    <input type="checkbox" />
                    <div class="collapse-title text-sm font-semibold flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-4 h-4 text-primary"
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
                    </div>
                    <div class="collapse-content space-y-4 pt-2">
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <label class="label cursor-pointer justify-start gap-3 bg-base-200/50 p-3 rounded-lg border border-base-300">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={convertLineBreaks()}
                                    onChange={(e) => setConvertLineBreaks(e.currentTarget.checked)}
                                />
                                <span class="label-text text-xs">
                                    <strong>Markdown→HTML:</strong> 改行を &lt;br /&gt; に変換
                                </span>
                            </label>

                            <label class="label cursor-pointer justify-start gap-3 bg-base-200/50 p-3 rounded-lg border border-base-300">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={wrapInParagraphs()}
                                    onChange={(e) => setWrapInParagraphs(e.currentTarget.checked)}
                                />
                                <span class="label-text text-xs">
                                    <strong>テキスト→HTML:</strong> 空行で段落 (&lt;p&gt;) に分割
                                </span>
                            </label>

                            <label class="label cursor-pointer justify-start gap-3 bg-base-200/50 p-3 rounded-lg border border-base-300">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={autoLinkUrls()}
                                    onChange={(e) => setAutoLinkUrls(e.currentTarget.checked)}
                                />
                                <span class="label-text text-xs">
                                    <strong>テキスト→HTML:</strong> URLを自動リンク化 (&lt;a&gt;)
                                </span>
                            </label>

                            <label class="label cursor-pointer justify-start gap-3 bg-base-200/50 p-3 rounded-lg border border-base-300">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={preserveListBullets()}
                                    onChange={(e) => setPreserveListBullets(e.currentTarget.checked)}
                                />
                                <span class="label-text text-xs">
                                    <strong>HTML→テキスト:</strong> リストにビュレット (•) を付与
                                </span>
                            </label>

                            <label class="label cursor-pointer justify-start gap-3 bg-base-200/50 p-3 rounded-lg border border-base-300">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-primary checkbox-sm"
                                    checked={includeLinksInPlain()}
                                    onChange={(e) => setIncludeLinksInPlain(e.currentTarget.checked)}
                                />
                                <span class="label-text text-xs">
                                    <strong>HTML→テキスト:</strong> リンクURLを末尾に併記
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* 使い方・機能解説ガイド */}
            <div class="card bg-base-100 border border-base-300 shadow-sm">
                <div class="card-body p-6 sm:p-8 space-y-6">
                    <h2 class="text-xl font-bold text-primary flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-5 h-5"
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

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="p-4 bg-base-200/40 rounded-xl border border-base-300 space-y-2">
                            <h3 class="font-bold text-sm sm:text-base text-secondary flex items-center gap-1.5">
                                <span>📄 HTML → Markdown 変換</span>
                            </h3>
                            <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
                                ブログ記事やCMSのリッチテキスト、NotionやGitHubで使いたいHTMLコードを、標準的なMarkdown構文（見出し、リスト、テーブル、コードブロック）に変換します。不要なスタイル属性やスクリプトタグは自動で除去されます。
                            </p>
                        </div>

                        <div class="p-4 bg-base-200/40 rounded-xl border border-base-300 space-y-2">
                            <h3 class="font-bold text-sm sm:text-base text-secondary flex items-center gap-1.5">
                                <span>🌐 Markdown → HTML 変換</span>
                            </h3>
                            <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
                                Markdownで書いたドキュメントを即座にHTML形式に変換します。見出しタグ（h1〜h6）、テーブル、リンク、引用（blockquote）、シンタックス言語クラス付きコードブロックに対応しており、ウェブサイトへの埋め込みに最適です。
                            </p>
                        </div>

                        <div class="p-4 bg-base-200/40 rounded-xl border border-base-300 space-y-2">
                            <h3 class="font-bold text-sm sm:text-base text-secondary flex items-center gap-1.5">
                                <span>🧹 HTML / Markdown → プレーンテキスト</span>
                            </h3>
                            <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
                                ウェブページからコピーした装飾付きテキストやMarkdownから、タグや特殊記号をすべて剥がし、純粋な可読文章だけを抽出します。メール本文やチャットツール、テキストファイルへの転記に便利です。
                            </p>
                        </div>

                        <div class="p-4 bg-base-200/40 rounded-xl border border-base-300 space-y-2">
                            <h3 class="font-bold text-sm sm:text-base text-secondary flex items-center gap-1.5">
                                <span>🛡️ HTMLエンティティ & URLエンコード</span>
                            </h3>
                            <p class="text-xs sm:text-sm text-base-content/80 leading-relaxed">
                                プログラミングやWeb制作で必須となる「&lt;, &gt;, &amp;, &quot;」などの文字実体参照へのエスケープや、日本語URL・クエリパラメータのパーセントエンコード・デコードが簡単に行えます。
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 広告エリア */}
            <AdSense />
            <AdSense />
        </div>
    );
}
