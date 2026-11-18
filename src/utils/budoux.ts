/**
 * 軽量ネイティブ日本語文節改行ユーティリティ
 * 外部機械学習辞書 (212KB) を使わず、ブラウザ標準 Intl.Segmenter と日本語文節結合ルールで
 * 自然な改行位置 (<wbr> / U+200B) を軽量 (< 1KB) に提供します。
 */

export interface LightweightBudouXParser {
    parse(text: string): string[];
    applyToElement(el: HTMLElement): void;
}

const ATTACH_TO_PREV_RE =
    /^(?:[、。，．・：；！？）」』】〉》〕］｝"'\)\]]+|は|が|を|に|へ|と|で|や|の|も|か|ね|よ|わ|ぞ|さ|な|ば|て|し|だ|た|です|ます|ました|ません|でした|ない|たい|れる|られる|せる|させる|から|まで|より|ほど|だけ|など|って|という|として|による|について|において|に対して)$/;

const ATTACH_TO_NEXT_RE = /^[（「『【〈《〔［｛"\(\[]+$/;

const wordSegmenter: Intl.Segmenter | null =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter("ja", { granularity: "word" })
        : null;

function tokenizeWords(text: string): string[] {
    if (wordSegmenter) {
        const tokens: string[] = [];
        for (const seg of wordSegmenter.segment(text)) {
            tokens.push(seg.segment);
        }
        return tokens;
    }
    return text.match(/[一-龠々]+|[ァ-ヶー]+|[ぁ-ん]+|[A-Za-z0-9_]+|\s+|./g) ?? [text];
}

export function parseBudouX(text: string): string[] {
    if (!text) return [];
    const tokens = tokenizeWords(text);
    const chunks: string[] = [];
    let pendingPrefix = "";

    for (const token of tokens) {
        if (pendingPrefix) {
            chunks.push(pendingPrefix + token);
            pendingPrefix = "";
            continue;
        }
        if (ATTACH_TO_NEXT_RE.test(token)) {
            pendingPrefix = token;
            continue;
        }
        if (
            chunks.length > 0 &&
            (ATTACH_TO_PREV_RE.test(token) || /^\s+$/.test(token))
        ) {
            chunks[chunks.length - 1] += token;
            continue;
        }
        chunks.push(token);
    }

    if (pendingPrefix) {
        if (chunks.length > 0) {
            chunks[chunks.length - 1] += pendingPrefix;
        } else {
            chunks.push(pendingPrefix);
        }
    }

    return chunks;
}

/**
 * 対象の DOM 要素に自然な文節改行スタイルとゼロ幅スペース (U+200B) を適用します。
 */
export function applyBudouX(el: HTMLElement): void {
    if (!el) return;
    try {
        el.style.wordBreak = "keep-all";
        el.style.overflowWrap = "anywhere";

        const applyToTextNodes = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const raw = node.textContent;
                if (raw && raw.trim().length > 0) {
                    const chunks = parseBudouX(raw);
                    if (chunks.length > 1) {
                        node.textContent = chunks.join("\u200B");
                    }
                }
                return;
            }
            for (const child of Array.from(node.childNodes)) {
                applyToTextNodes(child);
            }
        };

        applyToTextNodes(el);
    } catch (e) {
        console.warn("BudouX apply error:", e);
    }
}

export function getBudouXParser(): LightweightBudouXParser {
    return {
        parse: parseBudouX,
        applyToElement: applyBudouX,
    };
}

/**
 * Solid.js ディレクティブ / ref ハンドラ
 * 使用法: `<p ref={budoux}>長いテキスト...</p>`
 */
export function budoux(el: Element) {
    if (el instanceof HTMLElement) {
        applyBudouX(el);
    }
}
