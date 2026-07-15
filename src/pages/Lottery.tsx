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
        <div class="h-full w-full p-4 flex flex-col gap-4 bg-base-300/40">
            <div class="card bg-base-100 shadow-2xl p-6 w-full border border-base-300">
                <div class="mb-6 border-b-2 border-base-300 pb-4">
                    <h2 class="text-2xl font-black text-primary flex items-center gap-2">
                        🎯 抽選ツール
                    </h2>
                    <p class="text-xs text-base-content font-bold mt-1 leading-relaxed opacity-80">
                        リストアップした項目からランダムで選定を行います。重複排除や実行履歴機能も備えています。
                    </p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    <div class="lg:col-span-5 flex flex-col gap-5 bg-base-200/70 p-5 rounded-2xl border border-base-300">
                        <div class="form-control w-full">
                            <label class="label py-1">
                                <span class="label-text font-black text-sm text-base-content">
                                    📝 抽選対象の入力
                                </span>
                            </label>
                            <p class="text-[11px] text-base-content/80 font-bold mb-2">
                                ※1行に1つずつ対象を入力して改行してください。
                            </p>
                            <textarea
                                value={inputText()}
                                onInput={(e) =>
                                    setInputText(e.currentTarget.value)
                                }
                                class="textarea textarea-bordered w-full h-52 text-base font-bold bg-base-100 border-base-400 focus:border-primary text-base-content font-sans p-3.5 focus:outline-none shadow-inner"
                                placeholder="（例）&#10;参加者A&#10;参加者B&#10;参加者C"
                            />
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end border-t border-base-300 pt-4">
                            <div class="form-control w-full">
                                <label class="label py-1">
                                    <span class="label-text font-black text-xs text-base-content">
                                        🔢 同時に引く個数
                                    </span>
                                </label>
                                <select
                                    value={drawCount()}
                                    onChange={(e) =>
                                        setDrawCount(
                                            Number(e.currentTarget.value),
                                        )
                                    }
                                    class="select select-bordered select-sm h-11 text-xs font-bold bg-base-100 border-base-400 focus:border-primary text-base-content w-full"
                                >
                                    <option value="1">1 個</option>
                                    <option value="2">2 個</option>
                                    <option value="3">3 個</option>
                                    <option value="5">5 個</option>
                                    <option value="10">10 個</option>
                                </select>
                            </div>

                            <div class="form-control w-full">
                                <label class="label cursor-pointer justify-start gap-3 h-11 p-2 rounded-xl border border-base-400 bg-base-100 hover:bg-base-200 w-full transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={removeOnDraw()}
                                        onChange={(e) =>
                                            setRemoveOnDraw(
                                                e.currentTarget.checked,
                                            )
                                        }
                                        class="toggle toggle-primary toggle-sm"
                                    />
                                    <span class="label-text font-black text-xs text-base-content">
                                        一度引いたものは消す
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div class="flex gap-3 border-t border-base-300 pt-4">
                            <button
                                onClick={startLottery}
                                class="btn btn-primary flex-1 text-white text-sm font-black h-12 min-h-0 shadow-md"
                            >
                                抽選を実行する
                            </button>
                            <button
                                onClick={resetAll}
                                class="btn btn-outline border-base-400 text-base-content font-black text-xs h-12 min-h-0 px-5 hover:bg-base-300"
                            >
                                リセット
                            </button>
                        </div>
                    </div>

                    <div class="lg:col-span-7 flex flex-col gap-5 justify-between">
                        <Show when={results().length > 0}>
                            <div class="bg-base-200 p-6 rounded-2xl border-2 border-base-300 flex flex-col gap-4 shadow-inner">
                                <div class="flex justify-between items-center border-b-2 border-base-300 pb-2.5">
                                    <span class="text-xs font-black text-base-content/85 tracking-wider uppercase">
                                        📊 抽選結果
                                    </span>
                                    <Show
                                        when={
                                            !results()[0].startsWith("抽選対象")
                                        }
                                    >
                                        <div class="flex gap-2">
                                            <button
                                                onClick={copyResults}
                                                class={`btn btn-xs font-black rounded-lg shadow-sm text-white border-none ${copied() ? "btn-success" : "btn-neutral"}`}
                                            >
                                                {copied()
                                                    ? "コピー完了！"
                                                    : "結果をコピー"}
                                            </button>
                                            <button
                                                onClick={shareResults}
                                                class={`btn btn-xs font-black rounded-lg shadow-sm text-white border-none ${shared() ? "btn-success" : "btn-primary"}`}
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

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <For each={results()}>
                                        {(res) => (
                                            <div class="bg-primary/10 border-2 border-primary/45 rounded-xl p-4 text-center shadow-xs">
                                                <h3 class="text-lg font-black text-primary tracking-wide select-all truncate">
                                                    {res}
                                                </h3>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        <Show when={history().length > 0}>
                            <div class="bg-base-200/50 p-5 rounded-2xl border border-base-300 flex flex-col gap-3.5 shadow-sm">
                                <div class="flex justify-between items-center border-b border-base-300 pb-2">
                                    <span class="text-xs font-black text-base-content/80">
                                        📜 抽選履歴
                                    </span>
                                    <button
                                        onClick={clearHistory}
                                        class="btn btn-ghost btn-xs text-error font-black hover:bg-error/15 rounded-lg"
                                    >
                                        履歴をクリア
                                    </button>
                                </div>
                                <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    <For each={history()}>
                                        {(hist) => (
                                            <div class="flex items-start gap-3 p-3 bg-base-100 border border-base-300 rounded-xl text-xs">
                                                <span class="font-mono font-bold text-base-content/50 shrink-0 mt-0.5">
                                                    [{hist.time}]
                                                </span>
                                                <div class="flex flex-wrap gap-1.5 flex-1">
                                                    <For each={hist.items}>
                                                        {(item) => (
                                                            <span class="badge badge-neutral font-bold select-all border-none">
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

                        <Show
                            when={
                                results().length === 0 && history().length === 0
                            }
                        >
                            <div class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-base-300 bg-base-200/30 rounded-2xl p-8 text-center min-h-[250px]">
                                <span class="text-3xl mb-2">🎯</span>
                                <span class="text-xs font-black text-base-content/60">
                                    まだ抽選が実行されていません。
                                </span>
                                <span class="text-[10px] text-base-content/40 mt-1 font-bold">
                                    左のフォームから入力して実行ボタンを押してください。
                                </span>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>
        </div>
    );
}
