import { createSignal, Show, For } from "solid-js";

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
        <div class="h-full w-full p-6 flex flex-col">
            <div class="card bg-base-100 shadow-xl p-8 w-full border border-base-300">
                <div class="form-control w-full mb-6">
                    <label class="label">
                        <span class="label-text font-bold text-base-content">
                            抽選対象の入力
                        </span>
                    </label>
                    <p class="text-sm text-base-content/70 mb-2">
                        ※1行に1つずつ対象を入力して改行してください。
                    </p>
                    <textarea
                        value={inputText()}
                        onInput={(e) => setInputText(e.currentTarget.value)}
                        class="textarea textarea-bordered w-full h-48 text-lg bg-base-100 border-base-300 text-base-content font-sans p-4 focus:outline-none"
                        placeholder="（例）&#10;参加者A&#10;参加者B&#10;参加者C"
                    />
                </div>

                <div class="flex flex-wrap gap-6 items-center mb-6 border-b border-base-300 pb-6">
                    <div class="form-control w-40 flex-shrink-0">
                        <label class="label">
                            <span class="label-text font-bold text-base-content">
                                同時に引く個数
                            </span>
                        </label>
                        <select
                            value={drawCount()}
                            onChange={(e) =>
                                setDrawCount(Number(e.currentTarget.value))
                            }
                            class="select select-bordered h-14 text-lg bg-base-100 border-base-300 text-base-content w-full"
                        >
                            <option value="1">1 個</option>
                            <option value="2">2 個</option>
                            <option value="3">3 個</option>
                            <option value="5">5 個</option>
                            <option value="10">10 個</option>
                        </select>
                    </div>

                    <div class="form-control flex-1 justify-end h-full pt-9">
                        <label class="label cursor-pointer justify-start gap-4 p-3 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 w-full max-w-xs">
                            <input
                                type="checkbox"
                                checked={removeOnDraw()}
                                onChange={(e) =>
                                    setRemoveOnDraw(e.currentTarget.checked)
                                }
                                class="toggle toggle-primary"
                            />
                            <span class="label-text font-bold text-base-content">
                                一度引いたものは消す
                            </span>
                        </label>
                    </div>
                </div>

                <div class="flex gap-4 mb-8">
                    <button
                        onClick={startLottery}
                        class="btn btn-primary flex-1 text-white text-lg h-14"
                    >
                        抽選を実行する
                    </button>
                    <button
                        onClick={resetAll}
                        class="btn btn-outline border-base-300 text-base-content h-14 px-6 hover:bg-base-200"
                    >
                        リセット
                    </button>
                </div>

                <Show when={results().length > 0}>
                    <div class="border-t border-base-300 pt-6 w-full mb-6">
                        <div class="flex justify-between items-center mb-4">
                            <span class="font-bold text-base-content">
                                抽選結果
                            </span>
                            <Show when={!results()[0].startsWith("抽選対象")}>
                                <div class="flex gap-2">
                                    <button
                                        onClick={copyResults}
                                        class={`btn btn-sm text-white ${copied() ? "btn-success" : "btn-neutral"}`}
                                    >
                                        {copied()
                                            ? "コピー完了！"
                                            : "結果をコピー"}
                                    </button>
                                    <button
                                        onClick={shareResults}
                                        class={`btn btn-sm text-white ${shared() ? "btn-success" : "btn-primary"}`}
                                    >
                                        {shared()
                                            ? typeof navigator.share ===
                                              "function"
                                                ? "共有しました！"
                                                : "コピーしました！"
                                            : "結果を共有"}
                                    </button>
                                </div>
                            </Show>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <For each={results()}>
                                {(res) => (
                                    <div class="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center shadow-sm">
                                        <h3 class="text-2xl font-black text-primary tracking-wide select-all">
                                            {res}
                                        </h3>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                <Show when={history().length > 0}>
                    <div class="border-t border-base-300 pt-6 w-full">
                        <div class="flex justify-between items-center mb-4">
                            <span class="font-bold text-base-content">
                                抽選履歴
                            </span>
                            <button
                                onClick={clearHistory}
                                class="btn btn-ghost btn-sm text-error hover:bg-error/10"
                            >
                                履歴をクリア
                            </button>
                        </div>
                        <div class="space-y-3 max-h-60 overflow-y-auto pr-1">
                            <For each={history()}>
                                {(hist) => (
                                    <div class="flex items-start gap-4 p-3 bg-base-200 border border-base-300 rounded-xl text-sm">
                                        <span class="font-mono text-base-content/50 shrink-0 mt-0.5">
                                            [{hist.time}]
                                        </span>
                                        <div class="flex flex-wrap gap-1.5 flex-1">
                                            <For each={hist.items}>
                                                {(item) => (
                                                    <span class="badge badge-neutral select-all">
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
            </div>
        </div>
    );
}
