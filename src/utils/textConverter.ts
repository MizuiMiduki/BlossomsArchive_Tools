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

// HTML特殊文字のデコード（単一パスの文字列置換のみで安全にデコード）
export function unescapeHtml(str: string): string {
    const map: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        "#39": "'",
        apos: "'",
        nbsp: " ",
    };
    return str.replace(
        /&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|#39|apos|nbsp));/gi,
        (match, dec, hex, named) => {
            if (dec !== undefined) {
                const code = Number(dec);
                return Number.isFinite(code) ? String.fromCodePoint(code) : match;
            }
            if (hex !== undefined) {
                const code = parseInt(hex, 16);
                return Number.isFinite(code) ? String.fromCodePoint(code) : match;
            }
            if (named !== undefined) {
                return map[named.toLowerCase()] ?? match;
            }
            return match;
        },
    );
}

export interface HtmlTextNode {
    type: "text";
    content: string;
}

export interface HtmlElementNode {
    type: "element";
    tag: string;
    attrs: Record<string, string>;
    children: HtmlNode[];
}

export type HtmlNode = HtmlTextNode | HtmlElementNode;

const VOID_TAGS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

const IGNORED_TAGS = new Set(["script", "style", "noscript", "svg"]);

function extractHtmlAttributes(attrString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(attrString)) !== null) {
        const name = match[1].toLowerCase();
        const rawVal = match[2] ?? match[3] ?? match[4] ?? "";
        attrs[name] = unescapeHtml(rawVal);
    }
    return attrs;
}

/**
 * DOMParserや正規表現による文字列削除を使用せず、トークナイザで安全にHTML文字列を軽量ASTへ変換する
 */
export function parseHtmlToAst(html: string): HtmlElementNode {
    const root: HtmlElementNode = {
        type: "element",
        tag: "root",
        attrs: {},
        children: [],
    };

    const stack: HtmlElementNode[] = [root];
    let ignoredTag: string | null = null;
    const tokenRegex = /(<!--[\s\S]*?-->)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>|([^<]+)/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(html)) !== null) {
        // コメントトークンはASTに含めずスキップ
        if (match[1] !== undefined) {
            continue;
        }

        const textPart = match[6];
        if (textPart !== undefined) {
            if (ignoredTag !== null) {
                continue;
            }
            const current = stack[stack.length - 1];
            current.children.push({
                type: "text",
                content: unescapeHtml(textPart),
            });
            continue;
        }

        const isClosing = Boolean(match[2]);
        const tag = match[3].toLowerCase();
        const attrPart = match[4] || "";
        const isSelfClosing = Boolean(match[5]) || VOID_TAGS.has(tag);

        if (ignoredTag !== null) {
            if (isClosing && tag === ignoredTag) {
                ignoredTag = null;
            }
            continue;
        }

        if (!isClosing && IGNORED_TAGS.has(tag)) {
            if (!isSelfClosing) {
                ignoredTag = tag;
            }
            continue;
        }

        if (isClosing) {
            for (let i = stack.length - 1; i >= 1; i--) {
                if (stack[i].tag === tag) {
                    stack.length = i;
                    break;
                }
            }
        } else {
            const element: HtmlElementNode = {
                type: "element",
                tag,
                attrs: extractHtmlAttributes(attrPart),
                children: [],
            };
            const current = stack[stack.length - 1];
            current.children.push(element);
            if (!isSelfClosing) {
                stack.push(element);
            }
        }
    }

    return root;
}

function getAstTextContent(node: HtmlNode): string {
    if (node.type === "text") {
        return node.content;
    }
    return node.children.map(getAstTextContent).join("");
}

function findAstElements(node: HtmlElementNode, targetTags: Set<string>): HtmlElementNode[] {
    const results: HtmlElementNode[] = [];
    for (const child of node.children) {
        if (child.type === "element") {
            if (targetTags.has(child.tag)) {
                results.push(child);
            }
            results.push(...findAstElements(child, targetTags));
        }
    }
    return results;
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
    const root = parseHtmlToAst(html);

    function walk(node: HtmlNode, depth: number = 0, inPre: boolean = false, parentTag: string = ""): string {
        if (node.type === "text") {
            let text = node.content;
            if (!inPre) {
                text = text.replace(/[\t\r\n]+/g, " ");
            }
            return text;
        }

        const tag = node.tag;
        const nextInPre = inPre || tag === "pre";

        const childMarkdown = node.children
            .map((child) => walk(child, depth, nextInPre, tag))
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
                if (parentTag === "pre") {
                    return childMarkdown;
                }
                const codeText = getAstTextContent(node);
                return `\`${codeText}\``;
            }
            case "pre": {
                const codeEl = findAstElements(node, new Set(["code"]))[0];
                const codeContent = codeEl ? getAstTextContent(codeEl) : getAstTextContent(node);
                let lang = "";
                if (codeEl) {
                    const classList = codeEl.attrs["class"] || "";
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
                const href = node.attrs["href"] || "";
                const linkText = childMarkdown.trim() || href;
                if (!href) return linkText;
                return `[${linkText}](${href})`;
            }
            case "img": {
                const src = node.attrs["src"] || "";
                const alt = node.attrs["alt"] || "";
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
                for (const child of node.children) {
                    if (child.type === "element" && child.tag === "li") {
                        const itemText = child.children
                            .map((c) => walk(c, depth + 1, nextInPre, "li"))
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
                const trElements = findAstElements(node, new Set(["tr"]));
                for (const tr of trElements) {
                    const row: string[] = [];
                    const cells = findAstElements(tr, new Set(["th", "td"]));
                    for (const cell of cells) {
                        row.push(
                            getAstTextContent(cell)
                                .trim()
                                .replace(/\\/g, "\\\\")
                                .replace(/\|/g, "\\|"),
                        );
                    }
                    if (row.length > 0) rows.push(row);
                }

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

    let result = walk(root);
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

    const root = parseHtmlToAst(html);
    const bullet = options.preserveListBullets ?? true ? "• " : "";

    function walk(node: HtmlNode): string {
        if (node.type === "text") {
            return node.content;
        }

        const tag = node.tag;

        if (tag === "br") return "\n";

        const childText = node.children
            .map((c) => walk(c))
            .join("");

        if (tag === "a" && options.includeLinks) {
            const href = node.attrs["href"];
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

    let result = walk(root);
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
