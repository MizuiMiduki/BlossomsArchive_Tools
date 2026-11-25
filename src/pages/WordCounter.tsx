import { createSignal, createMemo, onSettled, Show } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { playPageEntrance } from "../utils/animations";
import { usePageI18n } from "../i18n/index";

export default function WordCounter() {
    const { title, description } = usePageI18n("/word-counter", {
        defaultTitle: "文字数カウント・原稿用紙換算",
        defaultDescription:
            "文字数（空白除外）、行数、段落数、原稿用紙枚数、読了時間、文字種の割合（ひらがな/漢字/英字等）をリアルタイムに集計します。",
    });
    let containerRef: HTMLDivElement | undefined;
    const [text, setText] = createSignal("");
    const [readingSpeed, setReadingSpeed] = createSignal<number>(500); // 1分あたりの文字数 (標準500字)

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
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
        <div ref={containerRef} class="ba-page ba-page--wide">
            <div class="ba-card ba-stack-6">
                {/* ヘッダー */}
                <div style={{ "padding-bottom": "1rem", "border-bottom": "1px solid var(--ba-border)" }}>
                    <h1 class="ba-title">
                        <BudouX text={title()} />
                    </h1>
                    <p class="ba-text-xs ba-text-muted" style={{ "margin-top": "0.375rem", "margin-bottom": 0, "font-weight": 600, "line-height": 1.6 }}>
                        {description()}
                    </p>
                </div>

                {/* メインレイアウト */}
                <div class="ba-flex ba-flex-wrap ba-gap-6 ba-items-start">
                    {/* テキスト入力エリア */}
                    <div class="ba-stack-3 ba-min-w-0" style={{ flex: "7 1 20rem" }}>
                        <div class="ba-flex ba-items-center ba-justify-between">
                            <label class="ba-label" for="counter-text-input">
                                テキスト入力
                            </label>
                            <button
                                type="button"
                                class="ba-btn ba-btn--ghost ba-btn--xs ba-text-danger"
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
                            class="ba-textarea"
                            style={{ height: "22rem", "line-height": 1.65 }}
                            placeholder="文字数をカウントしたい文章を入力または貼り付けてください..."
                            aria-label="文字数カウント対象テキスト"
                        />

                        {/* 読書スピード設定 */}
                        <div class="ba-panel ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2 ba-text-xs" style={{ padding: "0.75rem" }}>
                            <span class="ba-font-bold ba-text-muted">
                                読書速度の基準:
                            </span>
                            <div class="ba-flex ba-flex-wrap ba-items-center ba-gap-1 ba-mono">
                                {[300, 500, 800].map((speed) => (
                                    <button
                                        type="button"
                                        class={`ba-btn ba-btn--xs ${readingSpeed() === speed ? "ba-btn--primary" : "ba-btn--outline"}`}
                                        onClick={() => setReadingSpeed(speed)}
                                    >
                                        {speed}字/分 {speed === 300 ? "(音読)" : speed === 500 ? "(標準)" : "(速読)"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 集計結果ダッシュボード */}
                    <div class="ba-stack-4 ba-min-w-0" style={{ flex: "5 1 16rem" }}>
                        {/* 主要メトリクス */}
                        <div style={{ display: "grid", "grid-template-columns": "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                            <div
                                class="ba-text-center"
                                style={{
                                    "background-color": "var(--ba-primary-soft)",
                                    border: "1px solid var(--ba-primary)",
                                    "border-radius": "var(--ba-radius)",
                                    padding: "1rem",
                                }}
                            >
                                <span class="ba-text-xs ba-font-bold ba-text-primary" style={{ display: "block", "margin-bottom": "0.25rem" }}>
                                    文字数 (空白除外)
                                </span>
                                <span class="ba-mono ba-font-black ba-text-primary" style={{ "font-size": "1.875rem", "line-height": 1.2 }}>
                                    {stats().totalCharsNoSpace.toLocaleString()}
                                </span>
                            </div>
                            <div class="ba-panel ba-text-center">
                                <span class="ba-text-xs ba-font-bold ba-text-muted" style={{ display: "block", "margin-bottom": "0.25rem" }}>
                                    文字数 (空白含む)
                                </span>
                                <span class="ba-mono ba-font-black" style={{ "font-size": "1.875rem", "line-height": 1.2 }}>
                                    {stats().totalChars.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* 原稿用紙 & 読了時間 */}
                        <div class="ba-panel ba-stack-3">
                            <div class="ba-flex ba-items-center ba-justify-between" style={{ "padding-bottom": "0.5rem", "border-bottom": "1px solid var(--ba-border)" }}>
                                <span class="ba-text-xs ba-font-bold ba-text-muted">
                                    400字詰め原稿用紙換算
                                </span>
                                <span class="ba-mono ba-font-bold ba-text-sm">
                                    約 {stats().manuscriptPages} <span class="ba-text-xs" style={{ "font-weight": 400 }}>枚分</span>
                                </span>
                            </div>
                            <div class="ba-flex ba-items-center ba-justify-between" style={{ "padding-bottom": "0.5rem", "border-bottom": "1px solid var(--ba-border)" }}>
                                <span class="ba-text-xs ba-font-bold ba-text-muted">
                                    読了目安時間
                                </span>
                                <span class="ba-mono ba-font-bold ba-text-sm">
                                    {stats().readingMinutes > 0 && `${stats().readingMinutes}分 `}
                                    {stats().readingSeconds}秒
                                </span>
                            </div>
                            <div class="ba-flex ba-items-center ba-justify-between" style={{ "padding-bottom": "0.5rem", "border-bottom": "1px solid var(--ba-border)" }}>
                                <span class="ba-text-xs ba-font-bold ba-text-muted">行数 / 段落数</span>
                                <span class="ba-mono ba-font-bold ba-text-sm">
                                    {stats().lines} 行 / {stats().paragraphs} 段落
                                </span>
                            </div>
                            <div class="ba-flex ba-items-center ba-justify-between">
                                <span class="ba-text-xs ba-font-bold ba-text-muted">英単語数</span>
                                <span class="ba-mono ba-font-bold ba-text-sm">
                                    {stats().words} words
                                </span>
                            </div>
                        </div>

                        {/* 文字種別比率 */}
                        <div class="ba-panel ba-stack-2">
                            <h2 class="ba-text-xs ba-font-bold ba-text-muted" style={{ margin: 0 }}>
                                文字種別の内訳
                            </h2>
                            <div style={{ display: "grid", "grid-template-columns": "repeat(3, minmax(0, 1fr))", gap: "0.5rem", "text-align": "center" }}>
                                <div style={{ "background-color": "var(--ba-surface)", border: "1px solid var(--ba-border)", "border-radius": "var(--ba-radius-sm)", padding: "0.5rem" }}>
                                    <span class="ba-text-muted" style={{ "font-size": "0.6875rem", display: "block" }}>ひらがな</span>
                                    <span class="ba-mono ba-font-bold ba-text-xs">{stats().types.hiragana.count} ({stats().types.hiragana.percent}%)</span>
                                </div>
                                <div style={{ "background-color": "var(--ba-surface)", border: "1px solid var(--ba-border)", "border-radius": "var(--ba-radius-sm)", padding: "0.5rem" }}>
                                    <span class="ba-text-muted" style={{ "font-size": "0.6875rem", display: "block" }}>カタカナ</span>
                                    <span class="ba-mono ba-font-bold ba-text-xs">{stats().types.katakana.count} ({stats().types.katakana.percent}%)</span>
                                </div>
                                <div style={{ "background-color": "var(--ba-surface)", border: "1px solid var(--ba-border)", "border-radius": "var(--ba-radius-sm)", padding: "0.5rem" }}>
                                    <span class="ba-text-muted" style={{ "font-size": "0.6875rem", display: "block" }}>漢字</span>
                                    <span class="ba-mono ba-font-bold ba-text-xs">{stats().types.kanji.count} ({stats().types.kanji.percent}%)</span>
                                </div>
                                <div style={{ "background-color": "var(--ba-surface)", border: "1px solid var(--ba-border)", "border-radius": "var(--ba-radius-sm)", padding: "0.5rem" }}>
                                    <span class="ba-text-muted" style={{ "font-size": "0.6875rem", display: "block" }}>英字</span>
                                    <span class="ba-mono ba-font-bold ba-text-xs">{stats().types.latin.count} ({stats().types.latin.percent}%)</span>
                                </div>
                                <div style={{ "background-color": "var(--ba-surface)", border: "1px solid var(--ba-border)", "border-radius": "var(--ba-radius-sm)", padding: "0.5rem" }}>
                                    <span class="ba-text-muted" style={{ "font-size": "0.6875rem", display: "block" }}>数字</span>
                                    <span class="ba-mono ba-font-bold ba-text-xs">{stats().types.digits.count} ({stats().types.digits.percent}%)</span>
                                </div>
                                <div style={{ "background-color": "var(--ba-surface)", border: "1px solid var(--ba-border)", "border-radius": "var(--ba-radius-sm)", padding: "0.5rem" }}>
                                    <span class="ba-text-muted" style={{ "font-size": "0.6875rem", display: "block" }}>記号・その他</span>
                                    <span class="ba-mono ba-font-bold ba-text-xs">{stats().types.other.count} ({stats().types.other.percent}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AdSense />
        </div>
    );
}
