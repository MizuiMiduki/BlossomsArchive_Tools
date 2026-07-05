// src/pages/Lottery.tsx
import { createSignal, Show, For } from "solid-js";

export default function Lottery() {
    const [inputText, setInputText] = createSignal("");
    const [results, setResults] = createSignal<string[]>([]);
    const [drawCount, setDrawCount] = createSignal(1); // 同時に引く個数（デフォルトは1）
    const [removeOnDraw, setRemoveOnDraw] = createSignal(false); // 引いたものを削除するオプション
    const [copied, setCopied] = createSignal(false);

    const startLottery = () => {
        // 現在の入力から対象の配列を作成します
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

        // 実際に引く回数を決定します（対象より多く引こうとした場合は全件分で留めます）
        const loops = Math.min(currentDrawCount, items.length);

        for (let i = 0; i < loops; i++) {
            const randomArray = new Uint32Array(1);
            window.crypto.getRandomValues(randomArray);
            const randomIndex = randomArray[0] % items.length;

            // 当選者を確定させて保存します
            const selectedItem = items[randomIndex];
            selectedResults.push(selectedItem);

            // 「一度引かれたものは消す」がONなら、配列から削除します
            if (removeOnDraw()) {
                items.splice(randomIndex, 1);
            }
        }

        setResults(selectedResults);
        setCopied(false);

        // 「一度引かれたものは消す」がONの場合、残ったリストで入力欄を更新します
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
            console.error("コピー失敗:", err);
        }
    };

    const resetAll = () => {
        setInputText("");
        setResults([]);
        setDrawCount(1);
        setRemoveOnDraw(false);
        setCopied(false);
    };

    return (
        <div class="h-full w-full p-6 flex flex-col">
            <div class="card bg-base-100 shadow-xl p-8 w-full border border-base-200">
                {/* ①抽選対象の入力 */}
                <div class="form-control w-full mb-6">
                    <label class="label">
                        <span class="label-text font-bold text-slate-800">
                            抽選対象の入力
                        </span>
                    </label>
                    <p class="text-sm text-slate-500 mb-2">
                        ※1行に1つずつ対象を入力して改行してください。
                    </p>
                    <textarea
                        value={inputText()}
                        onInput={(e) => setInputText(e.currentTarget.value)}
                        class="textarea textarea-bordered w-full h-48 text-lg bg-white border-2 border-slate-300 text-slate-900 font-sans p-4 focus:outline-none"
                        placeholder="（例）&#10;参加者A&#10;参加者B&#10;参加者C"
                    />
                </div>

                {/* オプション設定エリア */}
                <div class="flex flex-wrap gap-6 items-center mb-6 border-b border-base-200 pb-6">
                    {/* 同時に引く個数 */}
                    <div class="form-control w-40 flex-shrink-0">
                        <label class="label">
                            <span class="label-text font-bold text-slate-800">
                                同時に引く個数
                            </span>
                        </label>
                        <select
                            value={drawCount()}
                            onChange={(e) =>
                                setDrawCount(Number(e.currentTarget.value))
                            }
                            class="select select-bordered h-14 text-lg bg-white border-2 border-slate-300 text-slate-900 w-full"
                        >
                            <option value="1">1 個</option>
                            <option value="2">2 個</option>
                            <option value="3">3 個</option>
                            <option value="5">5 個</option>
                            <option value="10">10 個</option>
                        </select>
                    </div>

                    {/* 一度引いたものは消すトグル */}
                    <div class="form-control flex-1 justify-end h-full pt-9">
                        <label class="label cursor-pointer justify-start gap-4 p-3 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 w-full max-w-xs">
                            <input
                                type="checkbox"
                                checked={removeOnDraw()}
                                onChange={(e) =>
                                    setRemoveOnDraw(e.currentTarget.checked)
                                }
                                class="toggle toggle-primary border-2 border-slate-400"
                            />
                            <span class="label-text font-bold text-slate-800">
                                一度引いたものは消す
                            </span>
                        </label>
                    </div>
                </div>

                {/* ②アクションボタン */}
                <div class="flex gap-4 mb-8">
                    <button
                        onClick={startLottery}
                        class="btn btn-primary flex-1 text-white text-lg h-14"
                    >
                        抽選を実行する
                    </button>
                    <button
                        onClick={resetAll}
                        class="btn btn-outline border-2 border-slate-400 text-slate-800 h-14 px-6"
                    >
                        リセット
                    </button>
                </div>

                {/* ③抽選結果の確認 */}
                <Show when={results().length > 0}>
                    <div class="border-t border-base-200 pt-6 w-full">
                        <div class="flex justify-between items-center mb-4">
                            <span class="font-bold text-slate-800">
                                抽選結果
                            </span>
                            <Show when={!results()[0].startsWith("抽選対象")}>
                                <button
                                    onClick={copyResults}
                                    class={`btn btn-sm text-white ${copied() ? "btn-success" : "btn-neutral"}`}
                                >
                                    {copied()
                                        ? "結果をコピー完了！"
                                        : "すべての結果をコピー"}
                                </button>
                            </Show>
                        </div>

                        {/* 綺麗なグリッドで結果を並べます */}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <For each={results()}>
                                {(res) => (
                                    <div class="bg-primary/5 border-2 border-primary/20 rounded-2xl p-6 text-center shadow-sm">
                                        <h3 class="text-2xl font-black text-primary tracking-wide select-all">
                                            {res}
                                        </h3>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}
