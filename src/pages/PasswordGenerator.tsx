import { createSignal, onSettled, For, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { delayedCall, playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";

export default function PasswordGenerator() {
    const { title, description } = usePageI18n("/password-generator", {
        defaultTitle: "パスワード生成ツール",
        defaultDescription:
            "指定されたパラメータ（文字種・長さ）に基づき、ランダムな文字列をローカル環境で作成します。ブラウザの標準 API である Crypto API を利用してシード値を生成します。",
    });
    const [length, setLength] = createSignal(16);
    const [count, setCount] = createSignal(5);
    const [useLowercase, setUseLowercase] = createSignal(true);
    const [useUppercase, setUseUppercase] = createSignal(true);
    const [useNumbers, setUseNumbers] = createSignal(true);
    const [useSymbols, setUseSymbols] = createSignal(true);
    const [results, setResults] = createSignal<string[]>([]);
    const [copiedIndex, setCopiedIndex] = createSignal<number | null>(null);
    const [allCopied, setAllCopied] = createSignal(false);

    let containerRef: HTMLDivElement | undefined;

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
    });

    const generatePassword = () => {
        const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
        const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numberChars = "0123456789";
        const symbolChars = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

        let charPool = "";
        if (useLowercase()) charPool += lowercaseChars;
        if (useUppercase()) charPool += uppercaseChars;
        if (useNumbers()) charPool += numberChars;
        if (useSymbols()) charPool += symbolChars;

        if (!charPool) {
            setResults(["文字種を選択してください"]);
            return;
        }

        const newPasswords: string[] = [];
        const safeCount = Number.isFinite(count())
            ? Math.max(1, Math.min(50, Math.floor(count())))
            : 5;
        const safeLength = Number.isFinite(length())
            ? Math.max(4, Math.min(100, Math.floor(length())))
            : 16;

        const allRandomValues = new Uint32Array(safeCount * safeLength);
        window.crypto.getRandomValues(allRandomValues);

        for (let c = 0; c < safeCount; c++) {
            let password = "";
            const offset = c * safeLength;

            for (let i = 0; i < safeLength; i++) {
                password += charPool[allRandomValues[offset + i] % charPool.length];
            }
            newPasswords.push(password);
        }

        setResults(newPasswords);
        setCopiedIndex(null);
        setAllCopied(false);
    };

    const copyToClipboard = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            delayedCall(2, () => setCopiedIndex(null));
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const copyAllToClipboard = async () => {
        if (results().length === 0 || results()[0].startsWith("文字種")) return;
        try {
            await navigator.clipboard.writeText(results().join("\n"));
            setAllCopied(true);
            delayedCall(2, () => setAllCopied(false));
        } catch (err) {
            console.error("Bulk copy failed:", err);
        }
    };

    return (
        <div ref={containerRef} class="ba-page ba-page--wide">
            {/* メインツールカード */}
            <div class="ba-card ba-stack-6">
                {/* ヘッダーセクション */}
                <div style={{ "padding-bottom": "1.25rem", "border-bottom": "1px solid var(--ba-border)" }}>
                    <h1 class="ba-title">
                        <BudouX text={title()} />
                    </h1>
                    <BudouX
                        as="p"
                        class="ba-text-xs ba-text-muted"
                        style={{ "margin-top": "0.5rem", "margin-bottom": 0, "font-weight": 600, "line-height": 1.6 }}
                        text={description()}
                    />
                </div>

                {/* 2カラムレイアウト */}
                <div class="ba-flex ba-flex-wrap ba-gap-6" style={{ "align-items": "stretch" }}>
                    {/* 左側：設定コントロール */}
                    <div class="ba-flex-col ba-justify-between ba-gap-6 ba-min-w-0" style={{ flex: "7 1 20rem" }}>
                        <div class="ba-stack-6">
                            {/* 1. パスワードの長さ */}
                            <div class="ba-field">
                                <label class="ba-label">
                                    <span>
                                        パスワードの長さ:{" "}
                                        <span class="ba-mono ba-font-black">{length()}</span>{" "}
                                        文字
                                    </span>
                                </label>
                                <div class="ba-flex ba-gap-4 ba-items-center">
                                    <input
                                        type="range"
                                        min="4"
                                        max="100"
                                        value={length()}
                                        aria-label="パスワードの文字数（桁数）スライダー"
                                        onInput={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v)) {
                                                setLength(Math.max(4, Math.min(100, Math.floor(v))));
                                            }
                                        }}
                                        class="ba-range ba-flex-1"
                                    />
                                    <input
                                        type="number"
                                        min="4"
                                        max="100"
                                        value={length()}
                                        aria-label="パスワードの文字数（桁数）"
                                        onInput={(e) => {
                                            const v = Number(e.currentTarget.value);
                                            if (Number.isFinite(v)) {
                                                setLength(Math.max(4, Math.min(100, Math.floor(v))));
                                            }
                                        }}
                                        class="ba-input ba-text-center ba-font-bold"
                                        style={{ width: "5rem" }}
                                    />
                                </div>
                            </div>

                            {/* 2. 使用する文字種 */}
                            <div class="ba-field">
                                <label class="ba-label">
                                    <span>使用する文字の種類</span>
                                </label>
                                <div style={{ display: "grid", "grid-template-columns": "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                                    <label
                                        class="ba-flex ba-items-center ba-gap-3"
                                        style={{
                                            cursor: "pointer",
                                            padding: "0.85rem",
                                            "border-radius": "var(--ba-radius)",
                                            border: "1.5px solid var(--ba-border-strong)",
                                            "background-color": "var(--ba-surface)",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={useLowercase()}
                                            onChange={(e) => setUseLowercase(e.currentTarget.checked)}
                                            class="ba-checkbox"
                                        />
                                        <span class="ba-font-bold ba-text-xs">小文字 (a-z)</span>
                                    </label>
                                    <label
                                        class="ba-flex ba-items-center ba-gap-3"
                                        style={{
                                            cursor: "pointer",
                                            padding: "0.85rem",
                                            "border-radius": "var(--ba-radius)",
                                            border: "1.5px solid var(--ba-border-strong)",
                                            "background-color": "var(--ba-surface)",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={useUppercase()}
                                            onChange={(e) => setUseUppercase(e.currentTarget.checked)}
                                            class="ba-checkbox"
                                        />
                                        <span class="ba-font-bold ba-text-xs">大文字 (A-Z)</span>
                                    </label>
                                    <label
                                        class="ba-flex ba-items-center ba-gap-3"
                                        style={{
                                            cursor: "pointer",
                                            padding: "0.85rem",
                                            "border-radius": "var(--ba-radius)",
                                            border: "1.5px solid var(--ba-border-strong)",
                                            "background-color": "var(--ba-surface)",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={useNumbers()}
                                            onChange={(e) => setUseNumbers(e.currentTarget.checked)}
                                            class="ba-checkbox"
                                        />
                                        <span class="ba-font-bold ba-text-xs">数字 (0-9)</span>
                                    </label>
                                    <label
                                        class="ba-flex ba-items-center ba-gap-3"
                                        style={{
                                            cursor: "pointer",
                                            padding: "0.85rem",
                                            "border-radius": "var(--ba-radius)",
                                            border: "1.5px solid var(--ba-border-strong)",
                                            "background-color": "var(--ba-surface)",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={useSymbols()}
                                            onChange={(e) => setUseSymbols(e.currentTarget.checked)}
                                            class="ba-checkbox"
                                        />
                                        <span class="ba-font-bold ba-text-xs">記号 (!@#$)</span>
                                    </label>
                                </div>
                            </div>

                            {/* 3. 生成個数 */}
                            <div class="ba-field" style={{ "max-width": "12rem" }}>
                                <label class="ba-label">
                                    <span>生成する個数</span>
                                </label>
                                <select
                                    value={count()}
                                    aria-label="生成する個数"
                                    onChange={(e) => {
                                        const v = Number(e.currentTarget.value);
                                        if (Number.isFinite(v)) {
                                            setCount(Math.max(1, Math.min(50, Math.floor(v))));
                                        }
                                    }}
                                    class="ba-select ba-font-bold"
                                >
                                    <option value="1">1 個</option>
                                    <option value="5">5 個</option>
                                    <option value="10">10 個</option>
                                    <option value="20">20 個</option>
                                    <option value="50">50 個</option>
                                </select>
                            </div>
                        </div>

                        {/* 生成ボタン */}
                        <div>
                            <button
                                type="button"
                                onClick={generatePassword}
                                class="ba-btn ba-btn--primary ba-btn--lg ba-btn--block ba-font-black"
                                style={{ height: "3.75rem", "font-size": "1.05rem" }}
                            >
                                パスワードを自動生成
                            </button>
                        </div>
                    </div>

                    {/* 右側：生成結果プレビュー */}
                    <div
                        class="ba-panel ba-flex-col ba-min-w-0"
                        style={{ flex: "5 1 16rem", "min-height": "300px", padding: "1.25rem" }}
                    >
                        <Show
                            when={results().length > 0}
                            fallback={
                                <div class="ba-flex-1 ba-flex-col ba-items-center ba-justify-center ba-text-center ba-gap-2 ba-text-muted" style={{ padding: "2rem" }}>
                                    <ToolIcon name="key" class="ba-icon-xl" />
                                    <p class="ba-text-xs" style={{ margin: 0, "font-weight": 600, "line-height": 1.6 }}>
                                        パラメータを入力して「自動生成」を押すと、
                                        <br />
                                        生成された文字列がここに表示されます。
                                    </p>
                                </div>
                            }
                        >
                            <div class="ba-flex-col ba-gap-4" style={{ height: "100%" }}>
                                <div
                                    class="ba-flex ba-justify-between ba-items-center"
                                    style={{ "padding-bottom": "0.5rem", "border-bottom": "1px solid var(--ba-border)" }}
                                >
                                    <span class="ba-font-bold ba-text-sm">
                                        生成結果 ({results().length}件)
                                    </span>
                                    <Show when={results().length > 1 && !results()[0].startsWith("文字種")}>
                                        <button
                                            type="button"
                                            onClick={copyAllToClipboard}
                                            class={`ba-btn ba-btn--xs ${allCopied() ? "ba-btn--success" : "ba-btn--secondary"}`}
                                        >
                                            {allCopied() ? "全コピー完了" : "すべてコピー"}
                                        </button>
                                    </Show>
                                </div>

                                {/* 結果リストコンテナ */}
                                <div
                                    class="ba-flex-1 ba-stack-2 ba-scroll-y"
                                    style={{ "max-height": "350px", "padding-right": "0.25rem" }}
                                >
                                    <For each={results()}>
                                        {(item, index) => (
                                            <div
                                                class="ba-flex ba-gap-2 ba-items-center"
                                                style={{
                                                    "background-color": "var(--ba-surface)",
                                                    padding: "0.5rem 0.625rem",
                                                    "border-radius": "var(--ba-radius-sm)",
                                                    border: "1px solid var(--ba-border)",
                                                }}
                                            >
                                                <input
                                                    type="text"
                                                    value={item}
                                                    readonly
                                                    aria-label={`生成されたパスワード ${index() + 1}`}
                                                    class="ba-flex-1 ba-min-w-0 ba-mono ba-text-sm"
                                                    style={{
                                                        background: "transparent",
                                                        border: "none",
                                                        outline: "none",
                                                        "letter-spacing": "0.02em",
                                                    }}
                                                />
                                                <Show when={!item.startsWith("文字種")}>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(item, index())}
                                                        class={`ba-btn ba-btn--xs ba-shrink-0 ${copiedIndex() === index() ? "ba-btn--success" : "ba-btn--secondary"}`}
                                                        style={{ width: "4rem" }}
                                                    >
                                                        {copiedIndex() === index() ? "OK" : "コピー"}
                                                    </button>
                                                </Show>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>

            <AdSense />

            {/* 技術仕様 ＆ FAQセクション */}
            <div class="ba-grid-2">
                {/* 暗号理論・乱数発生器の仕様 */}
                <div class="ba-card ba-flex-col ba-justify-between ba-gap-6">
                    <div class="ba-stack-4">
                        <h2
                            class="ba-section-title ba-text-base"
                            style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                        >
                            技術仕様および乱数発生アルゴリズムについて
                        </h2>
                        <div class="ba-stack-3 ba-text-xs ba-text-muted" style={{ "line-height": 1.65 }}>
                            <p style={{ margin: 0 }}>
                                本システムは、JavaScriptの一般的な `Math.random()` ではなく、Web Cryptography API に準拠した{" "}
                                <strong>`window.crypto.getRandomValues`</strong> を利用しています。
                            </p>
                            <p style={{ margin: 0 }}>
                                この仕組み（CSPRNG：暗号学的擬似乱数生成器）により、予測不能かつ一様に分布したエントロピーを取得し、出力データの推測可能性を数学的に排除しています。
                            </p>
                            <p style={{ margin: 0 }}>
                                処理はすべて利用者のブラウザ（クライアントサイド）にロードされたコードのみで実行され、外部ネットワークに生成結果を送信するルーティングは実装されていません。
                            </p>
                        </div>
                    </div>
                    <div class="ba-text-xs ba-text-muted" style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}>
                        ※データ取り扱い等の基本方針は、当サイトの
                        <a href="/privacy" class="ba-font-bold ba-underline ba-text-primary" style={{ "margin-left": "0.25rem" }}>
                            プライバシーポリシー
                        </a>
                        に準拠しています。
                    </div>
                </div>

                {/* 設計・強度の基礎知識（FAQ） */}
                <div class="ba-card ba-stack-4">
                    <h2
                        class="ba-section-title ba-text-base"
                        style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                    >
                        パスワードの強度設計（FAQ）
                    </h2>

                    <div class="ba-stack-2">
                        <details class="ba-accordion">
                            <summary>Q. 強度を定義するパラメータ（桁数と文字種）の関係性は？</summary>
                            <div class="ba-accordion-body">
                                一般的に、文字の種類（英数字記号）を増やすよりも、
                                <strong>パスワードの桁数を増やす方が</strong>
                                ブルートフォースアタック（総当たり攻撃）に対する時間的複雑度が指数関数的に増大します。推奨長は最低12〜16文字以上です。
                            </div>
                        </details>

                        <details class="ba-accordion">
                            <summary>Q. クライアントサイドでの処理状況を確認する方法は？</summary>
                            <div class="ba-accordion-body">
                                ブラウザの開発者ツール（ChromeのF12キー等）から「Network」タブを開き、生成ボタン押下時に外部のドメインに対する HTTP リクエスト（POST/GET）が発生していないことを確認することで、ローカルで完結している挙動を確認できます。
                            </div>
                        </details>

                        <details class="ba-accordion">
                            <summary>Q. 生成されたランダム文字列の適切な取り扱い方法は？</summary>
                            <div class="ba-accordion-body">
                                生成した強力なパスワードをブラウザのプレーンテキストとしてメモに残したり、同一アカウントの使い回しをすることはセキュリティ上の脆弱性となります。OS統合型の暗号化キーチェーン、もしくは専用のパスワード管理ツール（KeePassやBitwarden等）での管理を推奨します。
                            </div>
                        </details>
                    </div>
                </div>
            </div>

            <AdSense />
            <AdSense />
        </div>
    );
}
