// src/pages/PasswordGenerator.tsx
import { createSignal, For, Show } from "solid-js";

export default function PasswordGenerator() {
    const [length, setLength] = createSignal(15);
    const [count, setCount] = createSignal(5); // 生成個数のシグナル（初期値は5個）
    const [useLowercase, setUseLowercase] = createSignal(true);
    const [useUppercase, setUseUppercase] = createSignal(true);
    const [useNumbers, setUseNumbers] = createSignal(true);
    const [useSymbols, setUseSymbols] = createSignal(true);
    const [results, setResults] = createSignal<string[]>([]); // 配列で管理します
    const [copiedIndex, setCopiedIndex] = createSignal<number | null>(null);
    const [allCopied, setAllCopied] = createSignal(false);

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

        // 指定された「個数分」ループを回して生成します。
        for (let c = 0; c < count(); c++) {
            let password = "";
            const randomValues = new Uint32Array(length());
            window.crypto.getRandomValues(randomValues);

            for (let i = 0; i < length(); i++) {
                password += charPool[randomValues[i] % charPool.length];
            }
            newPasswords.push(password);
        }

        setResults(newPasswords);
        setCopiedIndex(null);
        setAllCopied(false);
    };

    // 個別コピー用の関数
    const copyToClipboard = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error("コピー失敗:", err);
        }
    };

    // すべてまとめてコピー用の関数
    const copyAllToClipboard = async () => {
        if (results().length === 0 || results()[0].startsWith("文字種")) return;
        try {
            // 改行で繋げてクリップボードにコピーします
            await navigator.clipboard.writeText(results().join("\n"));
            setAllCopied(true);
            setTimeout(() => setAllCopied(false), 2000);
        } catch (err) {
            console.error("一括コピー失敗:", err);
        }
    };

    return (
        <div class="h-full w-full p-6 flex flex-col">
            <div class="card bg-base-100 shadow-xl p-8 w-full border border-base-200">
                {/* 長さ指定スライダー＆数値入力 */}
                <div class="form-control w-full mb-6">
                    <label class="label">
                        <span class="label-text font-bold text-slate-800">
                            パスワードの長さ: {length()} 文字
                        </span>
                    </label>
                    <div class="flex gap-4 items-center">
                        <input
                            type="range"
                            min="4"
                            max="100"
                            value={length()}
                            onInput={(e) =>
                                setLength(Number(e.currentTarget.value))
                            }
                            class="range range-primary flex-1"
                        />
                        <input
                            type="number"
                            min="4"
                            max="100"
                            value={length()}
                            onInput={(e) =>
                                setLength(
                                    Math.max(
                                        4,
                                        Math.min(
                                            100,
                                            Number(e.currentTarget.value),
                                        ),
                                    ),
                                )
                            }
                            class="input input-bordered w-24 text-center text-lg bg-white border-2 border-slate-300 text-slate-900"
                        />
                    </div>
                </div>

                {/* オプション選択 */}
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <label class="label cursor-pointer justify-start gap-4 p-3 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={useLowercase()}
                            onChange={(e) =>
                                setUseLowercase(e.currentTarget.checked)
                            }
                            class="checkbox checkbox-primary border-2 border-slate-400"
                        />
                        <span class="label-text font-medium text-slate-800">
                            小文字 (a-z)
                        </span>
                    </label>
                    <label class="label cursor-pointer justify-start gap-4 p-3 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={useUppercase()}
                            onChange={(e) =>
                                setUseUppercase(e.currentTarget.checked)
                            }
                            class="checkbox checkbox-primary border-2 border-slate-400"
                        />
                        <span class="label-text font-medium text-slate-800">
                            大文字 (A-Z)
                        </span>
                    </label>
                    <label class="label cursor-pointer justify-start gap-4 p-3 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={useNumbers()}
                            onChange={(e) =>
                                setUseNumbers(e.currentTarget.checked)
                            }
                            class="checkbox checkbox-primary border-2 border-slate-400"
                        />
                        <span class="label-text font-medium text-slate-800">
                            数字 (0-9)
                        </span>
                    </label>
                    <label class="label cursor-pointer justify-start gap-4 p-3 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={useSymbols()}
                            onChange={(e) =>
                                setUseSymbols(e.currentTarget.checked)
                            }
                            class="checkbox checkbox-primary border-2 border-slate-400"
                        />
                        <span class="label-text font-medium text-slate-800">
                            記号 (!@#$)
                        </span>
                    </label>
                </div>

                {/* 個数選択と生成ボタン（横並びで、ボタンのサイズ固定対策もバッチリ！） */}
                <div class="flex gap-4 mb-8">
                    <div class="form-control w-32 flex-shrink-0">
                        <label class="label">
                            <span class="label-text font-bold text-slate-800">
                                生成個数
                            </span>
                        </label>
                        <select
                            value={count()}
                            onChange={(e) =>
                                setCount(Number(e.currentTarget.value))
                            }
                            class="select select-bordered h-14 text-lg bg-white border-2 border-slate-300 text-slate-900 w-full"
                        >
                            <option value="1">1 個</option>
                            <option value="5">5 個</option>
                            <option value="10">10 個</option>
                            <option value="20">20 個</option>
                            <option value="50">50 個</option>
                        </select>
                    </div>
                    <div class="flex-1 flex items-end">
                        <button
                            onClick={generatePassword}
                            class="btn btn-primary w-full text-white text-lg h-14"
                        >
                            パスワードを生成する
                        </button>
                    </div>
                </div>

                {/* 結果表示エリア */}
                {/* 結果表示エリア */}
                <Show when={results().length > 0}>
                    <div class="border-t border-base-200 pt-6 w-full">
                        <div class="flex justify-between items-center mb-4">
                            <span class="font-bold text-slate-800">
                                生成されたパスワード
                            </span>
                            <Show
                                when={
                                    results().length > 1 &&
                                    !results()[0].startsWith("文字種")
                                }
                            >
                                <button
                                    onClick={copyAllToClipboard}
                                    class={`btn btn-sm text-white ${allCopied() ? "btn-success" : "btn-neutral"}`}
                                >
                                    {allCopied()
                                        ? "すべてコピー完了！"
                                        : "すべてコピー"}
                                </button>
                            </Show>
                        </div>

                        {/* ここを縦並びから「レスポンシブなグリッド」に変更しました。 */}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
                            <For each={results()}>
                                {(item, index) => (
                                    <div class="flex gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 items-center">
                                        <input
                                            type="text"
                                            value={item}
                                            readonly
                                            class="input input-sm flex-1 font-mono bg-transparent border-none text-slate-900 tracking-wide focus:outline-none text-base"
                                        />
                                        <Show when={!item.startsWith("文字種")}>
                                            <button
                                                onClick={() =>
                                                    copyToClipboard(
                                                        item,
                                                        index(),
                                                    )
                                                }
                                                class={`btn btn-sm text-white w-20 flex-shrink-0 ${copiedIndex() === index() ? "btn-success" : "btn-neutral"}`}
                                            >
                                                {copiedIndex() === index()
                                                    ? "完了！"
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
    );
}
