import { createSignal, createMemo, onSettled, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";

export default function WordCounter() {
    let containerRef: HTMLDivElement | undefined;
    const [text, setText] = createSignal("");
    const [readingSpeed, setReadingSpeed] = createSignal<number>(500); // 1分あたりの文字数 (標準500字)

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".card");
    });

    const stats = createMemo(() => {
        const raw = text();

        // 空白・改行除外文字数
        const noWhitespace = raw.replace(/\s+/g, "");
        const totalChars = raw.length;
        const totalCharsNoSpace = noWhitespace.length;

        // 行数
        const lines = raw ? raw.split(/\r\n|\r|\n/).length : 0;

        // 段落数（連続改行で区切られたブロック）
        const paragraphs = raw
            .split(/\n\s*\n/)
            .filter((p) => p.trim().length > 0).length;

        // 英単語数
        const words = raw
            .trim()
            .split(/\s+/)
            .filter((w) => w.length > 0).length;

        // 400字詰め原稿用紙換算
        const manuscriptPages = Math.ceil(totalCharsNoSpace / 400) || 0;

        // 読了時間（分・秒）
        const speed = Math.max(100, readingSpeed());
        const readingTimeTotalSec = Math.round((totalCharsNoSpace / speed) * 60);
        const readingMinutes = Math.floor(readingTimeTotalSec / 60);
        const readingSeconds = readingTimeTotalSec % 60;

        // 文字種別カウント
        let hiragana = 0;
        let katakana = 0;
        let kanji = 0;
        let latin = 0;
        let digits = 0;
        let other = 0;

        for (const char of noWhitespace) {
            const code = char.charCodeAt(0);
            if (code >= 0x3041 && code <= 0x3096) {
                hiragana++;
            } else if (code >= 0x30a1 && code <= 0x30f6) {
                katakana++;
            } else if (
                (code >= 0x4e00 && code <= 0x9faf) ||
                (code >= 0x3400 && code <= 0x4dbf)
            ) {
                kanji++;
            } else if (
                (code >= 0x0041 && code <= 0x005a) ||
                (code >= 0x0061 && code <= 0x007a)
            ) {
                latin++;
            } else if (code >= 0x0030 && code <= 0x0039) {
                digits++;
            } else {
                other++;
            }
        }

        const getPercent = (count: number) =>
            totalCharsNoSpace > 0
                ? Math.round((count / totalCharsNoSpace) * 100)
                : 0;

        return {
            totalChars,
            totalCharsNoSpace,
            lines,
            paragraphs,
            words,
            manuscriptPages,
            readingMinutes,
            readingSeconds,
            types: {
                hiragana: { count: hiragana, percent: getPercent(hiragana) },
                katakana: { count: katakana, percent: getPercent(katakana) },
                kanji: { count: kanji, percent: getPercent(kanji) },
                latin: { count: latin, percent: getPercent(latin) },
                digits: { count: digits, percent: getPercent(digits) },
                other: { count: other, percent: getPercent(other) },
            },
        };
    });

    return (
        <div ref={containerRef} class="w-full max-w-7xl mx-auto flex flex-col items-center min-w-0">
            <div class="w-full flex flex-col gap-6 sm:gap-8 min-w-0">
                <div class="card bg-base-100 shadow-xl p-4 sm:p-6 md:p-8 w-full border border-base-300 min-w-0">
                    {/* ヘッダー */}
                    <div class="mb-6 border-b border-base-300 pb-4">
                        <h1 class="text-2xl md:text-3xl font-black text-base-content">
                            <BudouX text="文字数カウント・原稿用紙換算" />
                        </h1>
                        <p class="text-xs font-semibold text-base-content/70 mt-1.5 leading-relaxed">
                            文字数（空白除外）、行数、段落数、原稿用紙枚数、読了時間、文字種の割合（ひらがな/漢字/英字等）をリアルタイムに集計します。
                        </p>
                    </div>

                    {/* メインレイアウト */}
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* テキスト入力エリア */}
                        <div class="lg:col-span-7 flex flex-col gap-3">
                            <div class="flex items-center justify-between px-1">
                                <label class="text-xs font-bold text-base-content/80" for="counter-text-input">
                                    テキスト入力
                                </label>
                                <button
                                    type="button"
                                    class="btn btn-ghost btn-xs text-error font-bold"
                                    onClick={() => setText("")}
                                    disabled={!text()}
                                >
                                    クリア
                                </button>
                            </div>
                            <textarea
                                id="counter-text-input"
                                value={text()}
                                onInput={(e) => setText(e.currentTarget.value)}
                                class="textarea textarea-bordered w-full h-80 sm:h-96 text-sm leading-relaxed bg-base-100 p-4 shadow-inner"
                                placeholder="文字数をカウントしたい文章を入力または貼り付けてください..."
                                aria-label="文字数カウント対象テキスト"
                            />

                            {/* 読書スピード設定 */}
                            <div class="bg-base-200/50 p-3 rounded-xl border border-base-300 flex items-center justify-between text-xs">
                                <span class="font-bold text-base-content/80">
                                    読書速度の基準:
                                </span>
                                <div class="flex items-center gap-1.5 font-mono">
                                    {[300, 500, 800].map((speed) => (
                                        <button
                                            type="button"
                                            class={`btn btn-xs ${readingSpeed() === speed ? "btn-primary font-bold" : "btn-outline border-base-300"}`}
                                            onClick={() => setReadingSpeed(speed)}
                                        >
                                            {speed}字/分 {speed === 300 ? "(音読)" : speed === 500 ? "(標準)" : "(速読)"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 集計結果ダッシュボード */}
                        <div class="lg:col-span-5 flex flex-col gap-4">
                            {/* 主要メトリクス */}
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-primary/10 border border-primary/20 p-4 rounded-2xl text-center">
                                    <span class="text-xs font-bold text-primary block mb-1">
                                        文字数 (空白除外)
                                    </span>
                                    <span class="text-3xl font-black font-mono text-primary">
                                        {stats().totalCharsNoSpace.toLocaleString()}
                                    </span>
                                </div>
                                <div class="bg-base-200/60 border border-base-300 p-4 rounded-2xl text-center">
                                    <span class="text-xs font-bold text-base-content/70 block mb-1">
                                        文字数 (空白含む)
                                    </span>
                                    <span class="text-3xl font-black font-mono text-base-content">
                                        {stats().totalChars.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* 原稿用紙 & 読了時間 */}
                            <div class="bg-base-200/50 p-4 rounded-xl border border-base-300 space-y-3">
                                <div class="flex items-center justify-between py-1 border-b border-base-300">
                                    <span class="text-xs font-bold text-base-content/80">
                                        400字詰め原稿用紙換算
                                    </span>
                                    <span class="font-mono font-bold text-sm text-base-content">
                                        約 {stats().manuscriptPages} <span class="text-xs font-normal">枚分</span>
                                    </span>
                                </div>
                                <div class="flex items-center justify-between py-1 border-b border-base-300">
                                    <span class="text-xs font-bold text-base-content/80">
                                        読了目安時間
                                    </span>
                                    <span class="font-mono font-bold text-sm text-base-content">
                                        {stats().readingMinutes > 0 && `${stats().readingMinutes}分 `}
                                        {stats().readingSeconds}秒
                                    </span>
                                </div>
                                <div class="flex items-center justify-between py-1 border-b border-base-300">
                                    <span class="text-xs font-bold text-base-content/80">行数 / 段落数</span>
                                    <span class="font-mono font-bold text-sm text-base-content">
                                        {stats().lines} 行 / {stats().paragraphs} 段落
                                    </span>
                                </div>
                                <div class="flex items-center justify-between py-1">
                                    <span class="text-xs font-bold text-base-content/80">英単語数</span>
                                    <span class="font-mono font-bold text-sm text-base-content">
                                        {stats().words} words
                                    </span>
                                </div>
                            </div>

                            {/* 文字種別比率 */}
                            <div class="bg-base-200/50 p-4 rounded-xl border border-base-300">
                                <h2 class="text-xs font-bold text-base-content/80 mb-2">
                                    文字種別の内訳
                                </h2>
                                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div class="bg-base-100 p-2 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">ひらがな</span>
                                        <span class="font-mono font-bold text-base-content">{stats().types.hiragana.count} ({stats().types.hiragana.percent}%)</span>
                                    </div>
                                    <div class="bg-base-100 p-2 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">カタカナ</span>
                                        <span class="font-mono font-bold text-base-content">{stats().types.katakana.count} ({stats().types.katakana.percent}%)</span>
                                    </div>
                                    <div class="bg-base-100 p-2 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">漢字</span>
                                        <span class="font-mono font-bold text-base-content">{stats().types.kanji.count} ({stats().types.kanji.percent}%)</span>
                                    </div>
                                    <div class="bg-base-100 p-2 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">英字</span>
                                        <span class="font-mono font-bold text-base-content">{stats().types.latin.count} ({stats().types.latin.percent}%)</span>
                                    </div>
                                    <div class="bg-base-100 p-2 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">数字</span>
                                        <span class="font-mono font-bold text-base-content">{stats().types.digits.count} ({stats().types.digits.percent}%)</span>
                                    </div>
                                    <div class="bg-base-100 p-2 rounded-lg border border-base-300">
                                        <span class="text-[10px] text-base-content/60 block">記号・その他</span>
                                        <span class="font-mono font-bold text-base-content">{stats().types.other.count} ({stats().types.other.percent}%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <AdSense />
            </div>
        </div>
    );
}
