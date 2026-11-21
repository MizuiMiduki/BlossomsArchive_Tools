import { createSignal, onSettled, For, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { delayedCall, playPageEntrance } from "../utils/gsapAnimations";

export default function PasswordGenerator() {
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
        if (containerRef) playPageEntrance(containerRef, ".card");
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
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0">
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                {/* メインツールカード */}
                <div class="card bg-base-100 shadow-xl p-3 sm:p-6 md:p-10 w-full border border-base-300 min-w-0">
                    {/* ヘッダーセクション */}
                    <div class="mb-8 border-b border-base-300 pb-5">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="パスワード生成ツール" />
                        </h1>
                        <BudouX
                            as="p"
                            class="text-xs font-semibold text-base-content/70 mt-2 leading-relaxed"
                            text="指定されたパラメータ（文字種・長さ）に基づき、ランダムな文字列をローカル環境で作成します。ブラウザの標準 API である Crypto API を利用してシード値を生成します。"
                        />
                    </div>

                    {/* 2カラムレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* 左側：設定コントロール */}
                        <div class="lg:col-span-7 flex flex-col justify-between gap-6">
                            <div class="flex flex-col gap-6">
                                {/* 1. パスワードの長さ */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            パスワードの長さ:{" "}
                                            <span class="text-base-content font-black font-mono">
                                                {length()}
                                            </span>{" "}
                                            文字
                                        </span>
                                    </label>
                                    <div class="flex gap-4 items-center">
                                        <input
                                            type="range"
                                            min="4"
                                            max="100"
                                            value={length()}
                                            aria-label="パスワードの文字数（桁数）スライダー"
                                            onInput={(e) => {
                                                const v = Number(
                                                    e.currentTarget.value,
                                                );
                                                if (Number.isFinite(v)) {
                                                    setLength(
                                                        Math.max(
                                                            4,
                                                            Math.min(
                                                                100,
                                                                Math.floor(v),
                                                            ),
                                                        ),
                                                    );
                                                }
                                            }}
                                            class="range range-xs range-primary flex-1"
                                        />
                                        <input
                                            type="number"
                                            min="4"
                                            max="100"
                                            value={length()}
                                            aria-label="パスワードの文字数（桁数）"
                                            onInput={(e) => {
                                                const v = Number(
                                                    e.currentTarget.value,
                                                );
                                                if (Number.isFinite(v)) {
                                                    setLength(
                                                        Math.max(
                                                            4,
                                                            Math.min(
                                                                100,
                                                                Math.floor(v),
                                                            ),
                                                        ),
                                                    );
                                                }
                                            }}
                                            class="input input-bordered w-20 h-10 text-center text-sm font-bold bg-base-100 border-2 border-base-300 text-base-content"
                                        />
                                    </div>
                                </div>

                                {/* 2. 使用する文字種 */}
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            使用する文字の種類
                                        </span>
                                    </label>
                                    <div class="grid grid-cols-2 gap-3">
                                        <label class="label cursor-pointer justify-start gap-3 p-3.5 rounded-xl border-2 border-base-300 bg-base-100 hover:bg-base-200 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={useLowercase()}
                                                onChange={(e) =>
                                                    setUseLowercase(
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-primary checkbox-sm rounded-md"
                                            />
                                            <span class="label-text font-bold text-xs text-base-content">
                                                小文字 (a-z)
                                            </span>
                                        </label>
                                        <label class="label cursor-pointer justify-start gap-3 p-3.5 rounded-xl border-2 border-base-300 bg-base-100 hover:bg-base-200 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={useUppercase()}
                                                onChange={(e) =>
                                                    setUseUppercase(
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-primary checkbox-sm rounded-md"
                                            />
                                            <span class="label-text font-bold text-xs text-base-content">
                                                大文字 (A-Z)
                                            </span>
                                        </label>
                                        <label class="label cursor-pointer justify-start gap-3 p-3.5 rounded-xl border-2 border-base-300 bg-base-100 hover:bg-base-200 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={useNumbers()}
                                                onChange={(e) =>
                                                    setUseNumbers(
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-primary checkbox-sm rounded-md"
                                            />
                                            <span class="label-text font-bold text-xs text-base-content">
                                                数字 (0-9)
                                            </span>
                                        </label>
                                        <label class="label cursor-pointer justify-start gap-3 p-3.5 rounded-xl border-2 border-base-300 bg-base-100 hover:bg-base-200 transition-all">
                                            <input
                                                type="checkbox"
                                                checked={useSymbols()}
                                                onChange={(e) =>
                                                    setUseSymbols(
                                                        e.currentTarget.checked,
                                                    )
                                                }
                                                class="checkbox checkbox-primary checkbox-sm rounded-md"
                                            />
                                            <span class="label-text font-bold text-xs text-base-content">
                                                記号 (!@#$)
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* 3. 生成個数 */}
                                <div class="form-control w-full md:w-48">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-sm text-base-content/90">
                                            生成する個数
                                        </span>
                                    </label>
                                    <select
                                        value={count()}
                                        aria-label="生成する個数"
                                        onChange={(e) => {
                                            const v = Number(
                                                e.currentTarget.value,
                                            );
                                            if (Number.isFinite(v)) {
                                                setCount(
                                                    Math.max(
                                                        1,
                                                        Math.min(
                                                            50,
                                                            Math.floor(v),
                                                        ),
                                                    ),
                                                );
                                            }
                                        }}
                                        class="select select-bordered h-12 text-sm font-bold bg-base-100 border-2 border-base-300 text-base-content w-full"
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
                            <div class="mt-4">
                                <button
                                    onClick={generatePassword}
                                    class="btn btn-primary text-white w-full text-lg h-16 font-black transition-all shadow-md"
                                >
                                    パスワードを自動生成
                                </button>
                            </div>
                        </div>

                        {/* 右側：生成結果プレビュー */}
                        <div class="lg:col-span-5 flex flex-col bg-base-200/60 rounded-2xl p-6 border border-base-300 min-h-[300px]">
                            <Show
                                when={results().length > 0}
                                fallback={
                                    <div class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-base-content/60">
                                        <span class="text-5xl block mb-2">
                                            📊
                                        </span>
                                        <p class="text-xs font-semibold leading-relaxed">
                                            パラメータを入力して「自動生成」を押すと、
                                            <br />
                                            生成された文字列がここに表示されます。
                                        </p>
                                    </div>
                                }
                            >
                                <div
                                    class="flex flex-col h-full gap-4"
                                >
                                    <div class="flex justify-between items-center pb-2 border-b border-base-300">
                                        <span class="font-bold text-sm text-base-content">
                                            生成結果 ({results().length}件)
                                        </span>
                                        <Show
                                            when={
                                                results().length > 1 &&
                                                !results()[0].startsWith(
                                                    "文字種",
                                                )
                                            }
                                        >
                                            <button
                                                onClick={copyAllToClipboard}
                                                class={`btn btn-xs text-white border-none transition-colors ${allCopied() ? "bg-emerald-600 hover:bg-emerald-700" : "btn-neutral"}`}
                                            >
                                                {allCopied()
                                                    ? "全コピー完了"
                                                    : "すべてコピー"}
                                            </button>
                                        </Show>
                                    </div>

                                    {/* 結果リストコンテナ */}
                                    <div
                                        class="flex-1 flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1"
                                    >
                                        <For each={results()}>
                                            {(item, index) => (
                                                <div class="password-item flex gap-2 bg-base-100 p-2.5 rounded-xl border border-base-300 items-center shadow-xs">
                                                    <input
                                                        type="text"
                                                        value={item}
                                                        readonly
                                                        aria-label={`生成されたパスワード ${index() + 1}`}
                                                        class="input input-sm flex-1 min-w-0 font-mono bg-transparent border-none text-base-content tracking-wide focus:outline-none text-sm h-8"
                                                    />
                                                    <Show
                                                        when={
                                                            !item.startsWith(
                                                                "文字種",
                                                            )
                                                        }
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                copyToClipboard(
                                                                    item,
                                                                    index(),
                                                                )
                                                            }
                                                            class={`btn btn-xs text-white w-16 border-none transition-colors h-8 ${copiedIndex() === index() ? "bg-emerald-600 hover:bg-emerald-700" : "btn-neutral"}`}
                                                        >
                                                            {copiedIndex() ===
                                                            index()
                                                                ? "OK"
                                                                : "コピー"}
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

                {/* 💡 技術仕様 ＆ FAQセクション（アピールを廃止し、学術的・客観的な記述に統一） */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    {/* 暗号理論・乱数発生器の仕様 */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm justify-between">
                        <div>
                            <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                                技術仕様および乱数発生アルゴリズムについて
                            </h2>
                            <div class="space-y-4 text-xs text-base-content/80 leading-relaxed font-medium">
                                <p>
                                    本システムは、JavaScriptの一般的な
                                    `Math.random()` ではなく、Web Cryptography
                                    API に準拠した{" "}
                                    <strong>
                                        `window.crypto.getRandomValues`
                                    </strong>{" "}
                                    を利用しています。
                                </p>
                                <p>
                                    この仕組み（CSPRNG：暗号学的擬似乱数生成器）により、予測不能かつ一様に分布したエントロピーを取得し、出力データの推測可能性を数学的に排除しています。
                                </p>
                                <p>
                                    処理はすべて利用者のブラウザ（クライアントサイド）にロードされたコードのみで実行され、外部ネットワークに生成結果を送信するルーティングは実装されていません。
                                </p>
                            </div>
                        </div>
                        <div class="mt-6 pt-4 border-t border-base-200 text-xs text-base-content/60">
                            ※データ取り扱い等の基本方針は、当サイトの
                            <a
                                href="/privacy"
                                class="text-base-content font-bold underline ml-1 hover:text-primary"
                            >
                                プライバシーポリシー
                            </a>
                            に準拠しています。
                        </div>
                    </div>

                    {/* 設計・強度の基礎知識（FAQ） */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-base-300 shadow-sm">
                        <h2 class="text-base font-bold text-base-content border-b border-base-300 pb-3 mb-5">
                            パスワードの強度設計（FAQ）
                        </h2>

                        <div class="space-y-2">
                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="桁数と文字種の関係性についての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    強度を定義するパラメータ（桁数と文字種）の関係性は？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    一般的に、文字の種類（英数字記号）を増やすよりも、
                                    <strong>
                                        パスワードの桁数を増やす方が
                                    </strong>
                                    ブルートフォースアタック（総当たり攻撃）に対する時間的複雑度が指数関数的に増大します。推奨長は最低12〜16文字以上です。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="クライアントサイドでの処理状況の確認方法についての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    クライアントサイドでの処理状況を確認する方法は？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    ブラウザの開発者ツール（ChromeのF12キー等）から「Network」タブを開き、生成ボタン押下時に外部のドメインに対する
                                    HTTP
                                    リクエスト（POST/GET）が発生していないことを確認することで、ローカルで完結している挙動を確認できます。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-base-200/60 border border-base-300 rounded-lg">
                                <input type="checkbox" aria-label="生成されたランダム文字列の取り扱いについての質問を開閉" class="peer" />
                                <div class="collapse-title text-xs font-bold text-base-content peer-checked:bg-base-200">
                                    Q.
                                    生成されたランダム文字列の適切な取り扱い方法は？
                                </div>
                                <div class="collapse-content text-xs text-base-content/80 pt-3 peer-checked:bg-base-200/50">
                                    生成した強力なパスワードをブラウザのプレーンテキストとしてメモに残したり、同一アカウントの使い回しをすることはセキュリティ上の脆弱性となります。OS統合型の暗号化キーチェーン、もしくは専用のパスワード管理ツール（KeePassやBitwarden等）での管理を推奨します。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <AdSense />
            <AdSense />
        </div>
    );
}
