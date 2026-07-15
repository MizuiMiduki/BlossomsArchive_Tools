import { createSignal, onMount, onCleanup, Show, For } from "solid-js";

interface HistoryItem {
    id: number;
    time: string;
    items: string[];
}

export default function Lottery() {
    const [inputText, setInputText] = createSignal("");
    const [results, setResults] = createSignal<string[]>([]);
    const [drawCount, setDrawCount] = createSignal(1);
    const [removeOnDraw, setRemoveOnDraw] = createSignal(false);
    const [copied, setCopied] = createSignal(false);
    const [shared, setShared] = createSignal(false);
    const [history, setHistory] = createSignal<HistoryItem[]>([]);

    // SEO対策：メタデータおよび構造化データの動的注入
    onMount(() => {
        document.title =
            "オンライン抽選ツール | リストからランダム選定（CSPRNG準拠）";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "ブラウザ上で動作する抽選・選定ツール。改行区切りで入力したリストから、暗号学的疑似乱数（CSPRNG）を利用してランダムに項目を抽出します。複数個の同時選定、当選した項目の重複排除設定、履歴保存などの機能をフロントエンドのみで実行可能です。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "lottery-generator-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "オンライン抽選・ランダム選定ツール",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                " window.crypto.getRandomValues を使用した、リストからの高精度ランダム選定ツール。",
        });
        document.head.appendChild(script);
    });

    onCleanup(() => {
        const script = document.getElementById("lottery-generator-jsonld");
        if (script) {
            script.remove();
        }
    });

    const startLottery = () => {
        let items = inputText()
            .split("\n")
            .map((item) => item.trim())
            .filter((item) => item !== "");

        if (items.length === 0) {
            setResults(["抽選対象を入力してください"]);
            return;
        }

        const currentDrawCount = drawCount();
        const selectedResults: string[] = [];
        const loops = Math.min(currentDrawCount, items.length);

        for (let i = 0; i < loops; i++) {
            const randomArray = new Uint32Array(1);
            window.crypto.getRandomValues(randomArray);
            const randomIndex = randomArray[0] % items.length;

            const selectedItem = items[randomIndex];
            selectedResults.push(selectedItem);

            if (removeOnDraw()) {
                items.splice(randomIndex, 1);
            }
        }

        setResults(selectedResults);
        setCopied(false);
        setShared(false);

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

        setHistory((prev) => [
            { id: Date.now(), time: timeStr, items: selectedResults },
            ...prev,
        ]);

        if (removeOnDraw()) {
            setInputText(items.join("\n"));
        }
    };

    const copyResults = async () => {
        if (results().length === 0 || results()[0].startsWith("抽選対象"))
            return;
        try {
            const copyText = results()
                .map((r, i) => `結果 ${i + 1}: ${r}`)
                .join("\n");
            await navigator.clipboard.writeText(copyText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    const shareResults = async () => {
        if (results().length === 0 || results()[0].startsWith("抽選対象"))
            return;

        const shareText = results()
            .map((r, i) => `結果 ${i + 1}: ${r}`)
            .join("\n");

        if (navigator.share) {
            try {
                await navigator.share({
                    title: "抽選結果",
                    text: shareText,
                });
                setShared(true);
                setTimeout(() => setShared(false), 2000);
            } catch (err) {
                console.error("Share failed:", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
            } catch (err) {
                console.error("Clipboard fallback failed:", err);
            }
        }
    };

    const resetAll = () => {
        setInputText("");
        setResults([]);
        setDrawCount(1);
        setRemoveOnDraw(false);
        setCopied(false);
        setShared(false);
    };

    const clearHistory = () => {
        setHistory([]);
    };

    return (
        <div class="h-full w-full p-4 md:p-8 flex flex-col items-center bg-base-300/30 overflow-x-hidden font-sans">
            <div class="w-full max-w-7xl flex flex-col gap-8">
                {/* メインツールカード：左右スプリット（2カラム） */}
                <div class="card bg-base-100 shadow-xl p-6 md:p-10 w-full border border-slate-200">
                    {/* ヘッダーセクション */}
                    <div class="mb-8 border-b border-slate-200 pb-5">
                        <h1 class="text-2xl md:text-3xl font-black text-slate-800">
                            抽選・ランダム選定ツール
                        </h1>
                        <p class="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
                            テキストエリアに入力された複数の候補から、システム（CSPRNG）によってランダムに項目を抽出します。
                            ブラウザ内のフロントエンド処理により一括選定を行い、ネットワーク通信なしで挙動が完結します。
                        </p>
                    </div>

                    {/* グリッドレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* 左側：入力とコントロール */}
                        <div class="lg:col-span-5 flex flex-col gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                            <div class="form-control w-full">
                                <label class="label py-1">
                                    <span class="label-text font-bold text-sm text-slate-700">
                                        抽選対象のリスト入力
                                    </span>
                                </label>
                                <p class="text-[10px] text-slate-400 font-semibold mb-2">
                                    ※1行につき1つの項目（名前、番号など）を入力してください。
                                </p>
                                <textarea
                                    value={inputText()}
                                    onInput={(e) =>
                                        setInputText(e.currentTarget.value)
                                    }
                                    class="textarea textarea-bordered w-full h-56 text-sm bg-white border-2 border-slate-300 text-slate-900 focus:border-slate-500 font-medium p-3 focus:outline-none shadow-sm"
                                    placeholder="項目 A&#10;項目 B&#10;項目 C"
                                />
                            </div>

                            {/* 条件パラメータ設定 */}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end border-t border-slate-200 pt-4">
                                <div class="form-control w-full">
                                    <label class="label py-1">
                                        <span class="label-text font-bold text-xs text-slate-600">
                                            同時選定数
                                        </span>
                                    </label>
                                    <select
                                        value={drawCount()}
                                        onChange={(e) =>
                                            setDrawCount(
                                                Number(e.currentTarget.value),
                                            )
                                        }
                                        class="select select-bordered select-sm h-11 text-xs font-bold bg-white border-2 border-slate-300 text-slate-900 w-full focus:border-slate-500"
                                    >
                                        <option value="1">1 個</option>
                                        <option value="2">2 個</option>
                                        <option value="3">3 個</option>
                                        <option value="5">5 個</option>
                                        <option value="10">10 個</option>
                                    </select>
                                </div>

                                <div class="form-control w-full">
                                    <label class="label cursor-pointer justify-start gap-3 h-11 px-3 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 w-full transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={removeOnDraw()}
                                            onChange={(e) =>
                                                setRemoveOnDraw(
                                                    e.currentTarget.checked,
                                                )
                                            }
                                            class="checkbox checkbox-sm checkbox-primary rounded-md"
                                        />
                                        <span class="label-text font-bold text-xs text-slate-700">
                                            当選時にリストから除外
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* アクションボタン */}
                            <div class="flex gap-3 border-t border-slate-200 pt-4">
                                <button
                                    onClick={startLottery}
                                    class="btn bg-slate-800 hover:bg-slate-900 border-none text-white flex-1 text-sm font-black h-12 min-h-0 shadow-md transition-all"
                                >
                                    抽選を実行
                                </button>
                                <button
                                    onClick={resetAll}
                                    class="btn btn-outline border-2 border-slate-300 text-slate-700 font-bold text-xs h-12 min-h-0 px-5 hover:bg-slate-100"
                                >
                                    クリア
                                </button>
                            </div>
                        </div>

                        {/* 右側：抽選結果および履歴表示 */}
                        <div class="lg:col-span-7 flex flex-col gap-5 justify-between">
                            <Show when={results().length > 0}>
                                <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col gap-4 shadow-sm">
                                    <div class="flex justify-between items-center border-b border-slate-200 pb-2.5">
                                        <span class="text-xs font-black text-slate-600 tracking-wider">
                                            選定結果
                                        </span>
                                        <Show
                                            when={
                                                !results()[0].startsWith(
                                                    "抽選対象",
                                                )
                                            }
                                        >
                                            <div class="flex gap-2">
                                                <button
                                                    onClick={copyResults}
                                                    class={`btn btn-xs font-bold rounded-lg text-white border-none transition-colors ${copied() ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-800 hover:bg-slate-900"}`}
                                                >
                                                    {copied()
                                                        ? "コピー完了"
                                                        : "クリップボードにコピー"}
                                                </button>
                                                <button
                                                    onClick={shareResults}
                                                    class={`btn btn-xs font-bold rounded-lg text-slate-800 border-2 border-slate-300 bg-white hover:bg-slate-100 transition-colors`}
                                                >
                                                    {shared()
                                                        ? "共有完了"
                                                        : "共有 / 出力"}
                                                </button>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* 当選アイテム */}
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <For each={results()}>
                                            {(res) => (
                                                <div class="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
                                                    <h3 class="text-sm font-black text-slate-800 select-all truncate">
                                                        {res}
                                                    </h3>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* 履歴セクション */}
                            <Show when={history().length > 0}>
                                <div class="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 flex flex-col gap-3">
                                    <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                                        <span class="text-xs font-black text-slate-500">
                                            実行ログ
                                        </span>
                                        <button
                                            onClick={clearHistory}
                                            class="btn btn-ghost btn-xs text-rose-600 font-bold hover:bg-rose-50 rounded-lg"
                                        >
                                            ログを消去
                                        </button>
                                    </div>
                                    <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                                        <For each={history()}>
                                            {(hist) => (
                                                <div class="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs shadow-xs">
                                                    <span class="font-mono font-semibold text-slate-400 shrink-0 mt-0.5">
                                                        [{hist.time}]
                                                    </span>
                                                    <div class="flex flex-wrap gap-1.5 flex-1">
                                                        <For each={hist.items}>
                                                            {(item) => (
                                                                <span class="badge bg-slate-100 border border-slate-200 text-slate-700 font-bold select-all rounded-md px-2 py-1">
                                                                    {item}
                                                                </span>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* 初期表示（未実行時） */}
                            <Show
                                when={
                                    results().length === 0 &&
                                    history().length === 0
                                }
                            >
                                <div class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-8 text-center min-h-[250px]">
                                    <span class="text-5xl block mb-3">📊</span>
                                    <p class="text-xs font-bold text-slate-500">
                                        データ入力後、「抽選を実行」を押すと結果がここに表示されます。
                                    </p>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* 💡 技術仕様 ＆ 学術的なQ&Aセクション */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    {/* アルゴリズム仕様 */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-slate-200 shadow-sm justify-between">
                        <div>
                            <h2 class="text-base font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5">
                                抽選アルゴリズムおよび実行スペック
                            </h2>
                            <div class="space-y-4 text-xs text-slate-600 leading-relaxed font-medium">
                                <p>
                                    本システムは、JavaScriptの一般的な
                                    `Math.random()` ではなく、Web Cryptography
                                    API に準拠した{" "}
                                    <strong>
                                        `window.crypto.getRandomValues`
                                    </strong>{" "}
                                    から高精度なシードを生成してランダム抽選を行っています。
                                </p>
                                <p>
                                    これにより、入力された要素数（インデックス番号）に対して数学的に偏りのない確率空間から選定結果を出力します。
                                </p>
                                <p>
                                    処理はすべてローカル環境（クライアントサイド）のメモリ上で行われ、入力されたデータ自体がブラウザの外へ漏出または送信されることは構造上ありません。
                                </p>
                            </div>
                        </div>
                        <div class="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
                            ※データ保護方針等の規定については、当サイトの
                            <a
                                href="/privacy-policy"
                                class="text-slate-800 font-bold underline ml-1 hover:text-slate-950"
                            >
                                プライバシーポリシー
                            </a>
                            に準拠しています。
                        </div>
                    </div>

                    {/* 抽選技術の解説（FAQ） */}
                    <div class="card bg-base-100 p-6 md:p-8 border border-slate-200 shadow-sm">
                        <h2 class="text-base font-bold text-slate-800 border-b border-slate-200 pb-3 mb-5">
                            ランダム選定に関する基本要件（FAQ）
                        </h2>

                        <div class="space-y-2">
                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q. Math.randomとCrypto
                                    APIの乱数はどう違いますか？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    標準の `Math.random()`
                                    はブラウザエンジンごとの実装（V8の場合はxorshift128+等）に依存し、暗号的に安全ではない擬似乱数を生成するため、一部のゲーム等で偏りが生じる懸念があります。`window.crypto.getRandomValues`
                                    は OS
                                    レベルの環境ノイズをソースにした暗号学的疑似乱数生成器（CSPRNG）であり、偏りやパターンの偏向が極限まで抑えられています。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q.
                                    大量データの抽選時のパフォーマンスや上限は？
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    本システムはクライアントのブラウザのCPUおよびメモリ上で直接動作します。数千件規模のリスト入力であっても、サーバーAPI通信のボトルネックが発生しないため、ミリ秒単位での結果出力が可能です。
                                </div>
                            </div>

                            <div class="collapse collapse-arrow bg-slate-50 border border-slate-200 rounded-lg">
                                <input type="checkbox" class="peer" />
                                <div class="collapse-title text-xs font-bold text-slate-800 peer-checked:bg-slate-100">
                                    Q. 当選済みデータの除外アルゴリズムについて
                                </div>
                                <div class="collapse-content text-xs text-slate-600 pt-3 peer-checked:bg-slate-100/50">
                                    「一度引いたものは消す」を有効にすると、抽出処理の終了後、入力した元の配列データから該当するインデックスを自動で
                                    `splice`
                                    して削除し、テキストエリアの値を書き換える同期処理を行います。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
