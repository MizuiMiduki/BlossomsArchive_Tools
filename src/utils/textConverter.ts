/**
 * テキスト・HTML・Markdown相互変換ユーティリティ
 */

// HTML特殊文字のエスケープ
export function escapeHtml(str: string): string {
    const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return str.replace(/[&<>"']/g, (char) => map[char] || char);
}

// HTML特殊文字のデコード
export function unescapeHtml(str: string): string {
    if (typeof document !== "undefined") {
        const doc = new DOMParser().parseFromString(str, "text/html");
        return doc.body.textContent || "";
    }
    const map: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
        "&apos;": "'",
        "&nbsp;": " ",
    };
    return str.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => map[match] || match);
}

// すべての非ASCII文字または特殊文字を数値文字参照（数値エンティティ）に変換
export function toNumericEntities(str: string): string {
    return str
        .split("")
        .map((c) => {
            const code = c.charCodeAt(0);
            if (code > 127 || c === "&" || c === "<" || c === ">" || c === '"' || c === "'") {
                return `&#${code};`;
            }
            return c;
        })
        .join("");
}

export interface HtmlToMarkdownOptions {
    headingStyle?: "atx"; // '#'
    bulletListMarker?: "-" | "*" | "+";
    keepLineBreaks?: boolean;
}

/**
 * HTMLからMarkdownへ変換
 */
export function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): string {
    if (!html.trim()) return "";

    const bullet = options.bulletListMarker || "-";

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // 不要タグの削除
    const removals = doc.querySelectorAll("script, style, noscript, svg");
    removals.forEach((el) => el.remove());

    function walk(node: Node, depth: number = 0): string {
        if (node.nodeType === Node.TEXT_NODE) {
            let text = node.textContent || "";
            // pre要素内でない場合は連続空白を1つに圧縮
            let parent = node.parentElement;
            let inPre = false;
            while (parent) {
                if (parent.tagName.toLowerCase() === "pre") {
                    inPre = true;
                    break;
                }
                parent = parent.parentElement;
            }
            if (!inPre) {
                text = text.replace(/[\t\r\n]+/g, " ");
            }
            return text;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return "";
        }

        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        const childMarkdown = Array.from(el.childNodes)
            .map((child) => walk(child, depth))
            .join("");

        switch (tag) {
            case "h1":
                return `\n\n# ${childMarkdown.trim()}\n\n`;
            case "h2":
                return `\n\n## ${childMarkdown.trim()}\n\n`;
            case "h3":
                return `\n\n### ${childMarkdown.trim()}\n\n`;
            case "h4":
                return `\n\n#### ${childMarkdown.trim()}\n\n`;
            case "h5":
                return `\n\n##### ${childMarkdown.trim()}\n\n`;
            case "h6":
                return `\n\n###### ${childMarkdown.trim()}\n\n`;
            case "p":
                return `\n\n${childMarkdown.trim()}\n\n`;
            case "strong":
            case "b":
                return childMarkdown.trim() ? `**${childMarkdown.trim()}**` : "";
            case "em":
            case "i":
                return childMarkdown.trim() ? `*${childMarkdown.trim()}*` : "";
            case "s":
            case "del":
            case "strike":
                return childMarkdown.trim() ? `~~${childMarkdown.trim()}~~` : "";
            case "code": {
                if (el.parentElement?.tagName.toLowerCase() === "pre") {
                    return childMarkdown;
                }
                const codeText = el.textContent || "";
                return `\`${codeText}\``;
            }
            case "pre": {
                const codeEl = el.querySelector("code");
                const codeContent = codeEl ? codeEl.textContent || "" : el.textContent || "";
                let lang = "";
                if (codeEl) {
                    const classList = codeEl.className || "";
                    const langMatch = classList.match(/(?:language-|lang-)(\w+)/);
                    if (langMatch) lang = langMatch[1];
                }
                return `\n\n\`\`\`${lang}\n${codeContent.replace(/\n+$/, "")}\n\`\`\`\n\n`;
            }
            case "blockquote": {
                const lines = childMarkdown
                    .trim()
                    .split("\n")
                    .map((line) => `> ${line}`);
                return `\n\n${lines.join("\n")}\n\n`;
            }
            case "a": {
                const href = el.getAttribute("href") || "";
                const linkText = childMarkdown.trim() || href;
                if (!href) return linkText;
                return `[${linkText}](${href})`;
            }
            case "img": {
                const src = el.getAttribute("src") || "";
                const alt = el.getAttribute("alt") || "";
                return `![${alt}](${src})`;
            }
            case "hr":
                return "\n\n---\n\n";
            case "br":
                return "  \n";
            case "ul":
            case "ol": {
                const isOrdered = tag === "ol";
                let index = 1;
                const items: string[] = [];
                for (const child of Array.from(el.children)) {
                    if (child.tagName.toLowerCase() === "li") {
                        const itemText = Array.from(child.childNodes)
                            .map((c) => walk(c, depth + 1))
                            .join("")
                            .trim();
                        const prefix = isOrdered ? `${index++}. ` : `${bullet} `;
                        items.push(`${"  ".repeat(depth)}${prefix}${itemText}`);
                    }
                }
                return `\n\n${items.join("\n")}\n\n`;
            }
            case "li":
                return childMarkdown;
            case "table": {
                const rows: string[][] = [];
                el.querySelectorAll("tr").forEach((tr) => {
                    const row: string[] = [];
                    tr.querySelectorAll("th, td").forEach((cell) => {
                        row.push((cell.textContent || "").trim().replace(/\|/g, "\\|"));
                    });
                    if (row.length > 0) rows.push(row);
                });

                if (rows.length === 0) return "";

                const colCount = Math.max(...rows.map((r) => r.length));
                const normalizedRows = rows.map((r) => {
                    while (r.length < colCount) r.push("");
                    return r;
                });

                const header = normalizedRows[0];
                const headerLine = `| ${header.join(" | ")} |`;
                const separatorLine = `| ${new Array(colCount).fill("---").join(" | ")} |`;
                const bodyLines = normalizedRows
                    .slice(1)
                    .map((r) => `| ${r.join(" | ")} |`);

                return `\n\n${[headerLine, separatorLine, ...bodyLines].join("\n")}\n\n`;
            }
            default:
                return childMarkdown;
        }
    }

    let result = walk(doc.body);
    // 連続する空行を整える（最大2行）
    result = result.replace(/\n{3,}/g, "\n\n").trim();
    return result;
}

export interface MarkdownToHtmlOptions {
    convertLineBreaks?: boolean;
}

/**
 * MarkdownからHTMLへ変換
 */
export function markdownToHtml(md: string, options: MarkdownToHtmlOptions = {}): string {
    if (!md.trim()) return "";

    const lines = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const output: string[] = [];

    let inCodeBlock = false;
    let codeBlockLang = "";
    let codeBlockLines: string[] = [];

    let inTable = false;
    let tableRows: string[] = [];

    let inUl = false;
    let inOl = false;
    let inBlockquote = false;
    let blockquoteLines: string[] = [];

    const flushBlockquote = () => {
        if (inBlockquote) {
            const innerMd = blockquoteLines.join("\n");
            output.push(`<blockquote>\n${markdownToHtml(innerMd, options)}\n</blockquote>`);
            blockquoteLines = [];
            inBlockquote = false;
        }
    };

    const flushList = () => {
        if (inUl) {
            output.push("</ul>");
            inUl = false;
        }
        if (inOl) {
            output.push("</ol>");
            inOl = false;
        }
    };

    const flushTable = () => {
        if (inTable && tableRows.length > 0) {
            const rows = tableRows.map((r) =>
                r
                    .trim()
                    .replace(/^\|/, "")
                    .replace(/\|$/, "")
                    .split("|")
                    .map((c) => c.trim()),
            );

            let tableHtml = "<table>\n";
            if (rows.length >= 2 && rows[1].every((c) => /^:?-+:?$/.test(c))) {
                // 有効なテーブルヘッダー
                const headerCells = rows[0]
                    .map((c) => `<th>${parseInline(c)}</th>`)
                    .join("");
                tableHtml += `  <thead>\n    <tr>${headerCells}</tr>\n  </thead>\n`;

                const bodyRows = rows.slice(2);
                if (bodyRows.length > 0) {
                    tableHtml += "  <tbody>\n";
                    bodyRows.forEach((row) => {
                        const cells = row.map((c) => `<td>${parseInline(c)}</td>`).join("");
                        tableHtml += `    <tr>${cells}</tr>\n`;
                    });
                    tableHtml += "  </tbody>\n";
                }
            } else {
                tableHtml += "  <tbody>\n";
                rows.forEach((row) => {
                    const cells = row.map((c) => `<td>${parseInline(c)}</td>`).join("");
                    tableHtml += `    <tr>${cells}</tr>\n`;
                });
                tableHtml += "  </tbody>\n";
            }
            tableHtml += "</table>";
            output.push(tableHtml);
            tableRows = [];
            inTable = false;
        }
    };

    function parseInline(text: string): string {
        let res = escapeHtml(text);

        // インラインコード: `code`
        res = res.replace(/`([^`]+)`/g, "<code>$1</code>");

        // 画像: ![alt](url)
        res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

        // リンク: [text](url)
        res = res.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        );

        // 太字: **bold** or __bold__
        res = res.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        res = res.replace(/__([^_]+)__/g, "<strong>$1</strong>");

        // 打ち消し線: ~~strike~~
        res = res.replace(/~~([^~]+)~~/g, "<del>$1</del>");

        // 斜体: *italic* or _italic_
        res = res.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        res = res.replace(/_([^_]+)_/g, "<em>$1</em>");

        return res;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // コードブロックの開始/終了
        const codeMatch = line.match(/^```(\w*)/);
        if (codeMatch) {
            if (inCodeBlock) {
                // 終了
                const codeContent = escapeHtml(codeBlockLines.join("\n"));
                const langClass = codeBlockLang ? ` class="language-${codeBlockLang}"` : "";
                output.push(`<pre><code${langClass}>${codeContent}</code></pre>`);
                codeBlockLines = [];
                inCodeBlock = false;
                codeBlockLang = "";
            } else {
                // 開始
                flushList();
                flushTable();
                flushBlockquote();
                inCodeBlock = true;
                codeBlockLang = codeMatch[1] || "";
                codeBlockLines = [];
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockLines.push(line);
            continue;
        }

        // 引用
        const quoteMatch = line.match(/^>\s?(.*)$/);
        if (quoteMatch) {
            flushList();
            flushTable();
            inBlockquote = true;
            blockquoteLines.push(quoteMatch[1]);
            continue;
        } else {
            flushBlockquote();
        }

        // テーブル
        if (/^\|.*\|$/.test(line.trim())) {
            flushList();
            inTable = true;
            tableRows.push(line.trim());
            continue;
        } else {
            flushTable();
        }

        // 空行
        if (!line.trim()) {
            flushList();
            continue;
        }

        // 水平線
        if (/^(?:---|\*\*\*|___)\s*$/.test(line.trim())) {
            flushList();
            output.push("<hr />");
            continue;
        }

        // 見出し
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushList();
            const level = headingMatch[1].length;
            const content = parseInline(headingMatch[2].trim());
            output.push(`<h${level}>${content}</h${level}>`);
            continue;
        }

        // リスト (unordered)
        const ulMatch = line.match(/^[-*+]\s+(.*)$/);
        if (ulMatch) {
            if (!inUl) {
                flushList();
                output.push("<ul>");
                inUl = true;
            }
            output.push(`  <li>${parseInline(ulMatch[1])}</li>`);
            continue;
        }

        // リスト (ordered)
        const olMatch = line.match(/^\d+\.\s+(.*)$/);
        if (olMatch) {
            if (!inOl) {
                flushList();
                output.push("<ol>");
                inOl = true;
            }
            output.push(`  <li>${parseInline(olMatch[1])}</li>`);
            continue;
        }

        // 通常の段落
        flushList();
        let pContent = parseInline(line);
        if (options.convertLineBreaks) {
            pContent = pContent.replace(/ {2}$/, "<br />");
        }
        output.push(`<p>${pContent}</p>`);
    }

    if (inCodeBlock) {
        const codeContent = escapeHtml(codeBlockLines.join("\n"));
        const langClass = codeBlockLang ? ` class="language-${codeBlockLang}"` : "";
        output.push(`<pre><code${langClass}>${codeContent}</code></pre>`);
    }

    flushList();
    flushTable();
    flushBlockquote();

    return output.join("\n");
}

export interface HtmlToPlainTextOptions {
    preserveListBullets?: boolean;
    includeLinks?: boolean;
}

/**
 * HTMLからプレーンテキストへ変換
 */
export function htmlToPlainText(html: string, options: HtmlToPlainTextOptions = {}): string {
    if (!html.trim()) return "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // 不要タグの削除
    const removals = doc.querySelectorAll("script, style, noscript, svg");
    removals.forEach((el) => el.remove());

    const bullet = options.preserveListBullets ?? true ? "• " : "";

    function walk(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || "";
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return "";
        }

        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === "br") return "\n";

        const childText = Array.from(el.childNodes)
            .map((c) => walk(c))
            .join("");

        if (tag === "a" && options.includeLinks) {
            const href = el.getAttribute("href");
            if (href && href !== childText.trim()) {
                return `${childText} (${href})`;
            }
            return childText;
        }

        if (tag === "li") {
            return `\n${bullet}${childText.trim()}`;
        }

        if (/^h[1-6]$/.test(tag) || tag === "p" || tag === "div" || tag === "blockquote" || tag === "pre" || tag === "tr") {
            return `\n${childText}\n`;
        }

        if (tag === "td" || tag === "th") {
            return `\t${childText.trim()}\t`;
        }

        return childText;
    }

    let result = walk(doc.body);
    // 連続する空行を最大2行に圧縮し、余分なスペースを整える
    result = result
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return result;
}

export interface PlainTextToHtmlOptions {
    wrapInParagraphs?: boolean;
    autoLinkUrls?: boolean;
    preserveLineBreaks?: boolean;
}

/**
 * プレーンテキストからHTMLへ変換
 */
export function plainTextToHtml(text: string, options: PlainTextToHtmlOptions = {}): string {
    if (!text.trim()) return "";

    const wrapP = options.wrapInParagraphs ?? true;
    const autoLink = options.autoLinkUrls ?? true;
    const keepBreaks = options.preserveLineBreaks ?? true;

    const linkify = (str: string) => {
        if (!autoLink) return escapeHtml(str);
        const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        const parts = str.split(urlRegex);
        return parts
            .map((part, index) => {
                if (index % 2 === 1) {
                    const escaped = escapeHtml(part);
                    return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
                }
                return escapeHtml(part);
            })
            .join("");
    };

    if (wrapP) {
        // 2つ以上の改行で段落分割
        const paragraphs = text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

        return paragraphs
            .map((p) => {
                let formatted = linkify(p);
                if (keepBreaks) {
                    formatted = formatted.replace(/\n/g, "<br />\n");
                }
                return `<p>${formatted}</p>`;
            })
            .join("\n\n");
    } else {
        let formatted = linkify(text);
        if (keepBreaks) {
            formatted = formatted.replace(/\n/g, "<br />\n");
        }
        return formatted;
    }
}

/**
 * Markdownからプレーンテキストへ変換
 */
export function markdownToPlainText(md: string): string {
    if (!md.trim()) return "";
    // Markdown -> HTML -> PlainText のパイプラインで確実にマークアップを除去
    const html = markdownToHtml(md);
    return htmlToPlainText(html, { preserveListBullets: true, includeLinks: false });
}

/**
 * プレーンテキストからMarkdownへ変換
 * 特殊記号のエスケープやフォーマット
 */
export function plainTextToMarkdown(text: string): string {
    if (!text.trim()) return "";
    // 特殊文字 `*`, `_`, `#`, `[`, `]`, `~` などのエスケープは必要に応じて行うが、
    // 基本的には段落と改行を保ったプレーンテキストがMarkdownとして有効
    return text.replace(/\r\n/g, "\n");
}

export type ConversionMode =
    | "html-to-markdown"
    | "markdown-to-html"
    | "html-to-plain"
    | "plain-to-html"
    | "markdown-to-plain"
    | "plain-to-markdown"
    | "html-entities-encode"
    | "html-entities-decode"
    | "url-encode"
    | "url-decode";

export interface ConversionResult {
    output: string;
    error?: string;
}

/**
 * 統一変換ディスパッチャー
 */
export function convertText(
    input: string,
    mode: ConversionMode,
    options?: {
        convertLineBreaks?: boolean;
        wrapInParagraphs?: boolean;
        autoLinkUrls?: boolean;
        preserveListBullets?: boolean;
        includeLinks?: boolean;
    },
): ConversionResult {
    if (!input) return { output: "" };

    try {
        switch (mode) {
            case "html-to-markdown":
                return { output: htmlToMarkdown(input) };
            case "markdown-to-html":
                return {
                    output: markdownToHtml(input, {
                        convertLineBreaks: options?.convertLineBreaks ?? true,
                    }),
                };
            case "html-to-plain":
                return {
                    output: htmlToPlainText(input, {
                        preserveListBullets: options?.preserveListBullets ?? true,
                        includeLinks: options?.includeLinks ?? false,
                    }),
                };
            case "plain-to-html":
                return {
                    output: plainTextToHtml(input, {
                        wrapInParagraphs: options?.wrapInParagraphs ?? true,
                        autoLinkUrls: options?.autoLinkUrls ?? true,
                        preserveLineBreaks: true,
                    }),
                };
            case "markdown-to-plain":
                return { output: markdownToPlainText(input) };
            case "plain-to-markdown":
                return { output: plainTextToMarkdown(input) };
            case "html-entities-encode":
                return { output: escapeHtml(input) };
            case "html-entities-decode":
                return { output: unescapeHtml(input) };
            case "url-encode":
                return { output: encodeURIComponent(input) };
            case "url-decode":
                try {
                    return { output: decodeURIComponent(input) };
                } catch {
                    return { output: input, error: "無効なURLエンコード文字列です" };
                }
            default:
                return { output: input };
        }
    } catch (e: any) {
        return { output: "", error: e?.message || "変換中にエラーが発生しました" };
    }
}
