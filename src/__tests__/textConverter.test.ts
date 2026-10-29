import { describe, it, expect } from "vitest";
import {
    htmlToMarkdown,
    markdownToHtml,
    htmlToPlainText,
    plainTextToHtml,
    markdownToPlainText,
    escapeHtml,
    unescapeHtml,
    convertText,
} from "../utils/textConverter";

describe("textConverter", () => {
    describe("htmlToMarkdown", () => {
        it("見出しタグを正しく変換できること", () => {
            const html = "<h1>見出し1</h1><h2>見出し2</h2><h3>見出し3</h3>";
            const md = htmlToMarkdown(html);
            expect(md).toContain("# 見出し1");
            expect(md).toContain("## 見出し2");
            expect(md).toContain("### 見出し3");
        });

        it("リンクと画像を正しく変換できること", () => {
            const html = '<p><a href="https://example.com">リンクテキスト</a></p><p><img src="https://example.com/image.png" alt="画像代替テキスト" /></p>';
            const md = htmlToMarkdown(html);
            expect(md).toContain("[リンクテキスト](https://example.com)");
            expect(md).toContain("![画像代替テキスト](https://example.com/image.png)");
        });

        it("装飾タグ（太字、斜体、打ち消し、インラインコード）を変換できること", () => {
            const html = "<p><strong>太字</strong>と<em>斜体</em>と<del>取消</del>と<code>code</code></p>";
            const md = htmlToMarkdown(html);
            expect(md).toContain("**太字**");
            expect(md).toContain("*斜体*");
            expect(md).toContain("~~取消~~");
            expect(md).toContain("`code`");
        });

        it("コードブロックを変換できること", () => {
            const html = '<pre><code class="language-typescript">const x: number = 42;</code></pre>';
            const md = htmlToMarkdown(html);
            expect(md).toContain("```typescript");
            expect(md).toContain("const x: number = 42;");
            expect(md).toContain("```");
        });

        it("リストを変換できること", () => {
            const html = "<ul><li>項目1</li><li>項目2</li></ul><ol><li>順序1</li><li>順序2</li></ol>";
            const md = htmlToMarkdown(html);
            expect(md).toContain("- 項目1");
            expect(md).toContain("- 項目2");
            expect(md).toContain("1. 順序1");
            expect(md).toContain("2. 順序2");
        });

        it("テーブルをMarkdown形式に変換できること", () => {
            const html = "<table><thead><tr><th>名前</th><th>年齢</th></tr></thead><tbody><tr><td>太郎</td><td>20</td></tr></tbody></table>";
            const md = htmlToMarkdown(html);
            expect(md).toContain("| 名前 | 年齢 |");
            expect(md).toContain("| --- | --- |");
            expect(md).toContain("| 太郎 | 20 |");
        });

        it("不要なscriptやstyleタグを除去すること", () => {
            const html = '<p>こんにちは</p><script>alert("xss")</script><style>body { color: red; }</style>';
            const md = htmlToMarkdown(html);
            expect(md).toContain("こんにちは");
            expect(md).not.toContain("alert");
            expect(md).not.toContain("body { color: red; }");
        });
    });

    describe("markdownToHtml", () => {
        it("見出しをHTMLタグに変換できること", () => {
            const md = "# 大見出し\n## 中見出し";
            const html = markdownToHtml(md);
            expect(html).toContain("<h1>大見出し</h1>");
            expect(html).toContain("<h2>中見出し</h2>");
        });

        it("装飾記法をHTMLタグに変換できること", () => {
            const md = "ここが**太字**で*斜体*で~~打ち消し~~で`インラインコード`です。";
            const html = markdownToHtml(md);
            expect(html).toContain("<strong>太字</strong>");
            expect(html).toContain("<em>斜体</em>");
            expect(html).toContain("<del>打ち消し</del>");
            expect(html).toContain("<code>インラインコード</code>");
        });

        it("リンクと画像を変換できること", () => {
            const md = "[サイト](https://example.com)\n![画像](https://example.com/cat.jpg)";
            const html = markdownToHtml(md);
            expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">サイト</a>');
            expect(html).toContain('<img src="https://example.com/cat.jpg" alt="画像" />');
        });

        it("リストを変換できること", () => {
            const md = "- りんご\n- みかん\n\n1. 一番\n2. 二番";
            const html = markdownToHtml(md);
            expect(html).toContain("<ul>");
            expect(html).toContain("<li>りんご</li>");
            expect(html).toContain("<li>みかん</li>");
            expect(html).toContain("</ul>");
            expect(html).toContain("<ol>");
            expect(html).toContain("<li>一番</li>");
            expect(html).toContain("<li>二番</li>");
            expect(html).toContain("</ol>");
        });

        it("コードブロックを変換できること", () => {
            const md = "```javascript\nconsole.log('hello');\n```";
            const html = markdownToHtml(md);
            expect(html).toContain('<pre><code class="language-javascript">console.log(&#39;hello&#39;);</code></pre>');
        });

        it("テーブル記法をHTMLテーブルに変換できること", () => {
            const md = "| 列1 | 列2 |\n| --- | --- |\n| 値A | 値B |";
            const html = markdownToHtml(md);
            expect(html).toContain("<table>");
            expect(html).toContain("<th>列1</th>");
            expect(html).toContain("<th>列2</th>");
            expect(html).toContain("<td>値A</td>");
            expect(html).toContain("<td>値B</td>");
        });
    });

    describe("htmlToPlainText", () => {
        it("タグを除去してプレーンテキストを抽出すること", () => {
            const html = "<h1>タイトル</h1><p>段落テキストです。<br>2行目です。</p>";
            const text = htmlToPlainText(html);
            expect(text).toContain("タイトル");
            expect(text).toContain("段落テキストです。");
            expect(text).toContain("2行目です。");
            expect(text).not.toContain("<");
            expect(text).not.toContain(">");
        });

        it("リスト項目にビュレットを付与できること", () => {
            const html = "<ul><li>項目A</li><li>項目B</li></ul>";
            const text = htmlToPlainText(html, { preserveListBullets: true });
            expect(text).toContain("• 項目A");
            expect(text).toContain("• 項目B");
        });
    });

    describe("plainTextToHtml", () => {
        it("特殊文字をエスケープして段落タグで囲むこと", () => {
            const text = "こんにちは <world> & 'test'";
            const html = plainTextToHtml(text);
            expect(html).toContain("&lt;world&gt;");
            expect(html).toContain("&amp;");
            expect(html).toContain("<p>");
            expect(html).toContain("</p>");
        });

        it("URLを検知して自動リンク化すること", () => {
            const text = "参照リンク: https://example.com/test です。";
            const html = plainTextToHtml(text, { autoLinkUrls: true });
            expect(html).toContain('<a href="https://example.com/test" target="_blank" rel="noopener noreferrer">https://example.com/test</a>');
        });
    });

    describe("markdownToPlainText", () => {
        it("Markdown記号を除去して可読テキストを取り出すこと", () => {
            const md = "# タイトル\n\n**重要:** [リンク](https://example.com) をクリックしてください。\n\n- 項目1\n- 項目2";
            const text = markdownToPlainText(md);
            expect(text).toContain("タイトル");
            expect(text).toContain("重要: リンク をクリックしてください。");
            expect(text).toContain("• 項目1");
            expect(text).toContain("• 項目2");
            expect(text).not.toContain("**");
            expect(text).not.toContain("https://example.com");
        });
    });

    describe("HTMLエンティティ変換", () => {
        it("特殊文字を正しくエンコード＆デコードできること", () => {
            const original = '<div class="test">Fish & Chips \'OK\'</div>';
            const encoded = escapeHtml(original);
            expect(encoded).toBe("&lt;div class=&quot;test&quot;&gt;Fish &amp; Chips &#39;OK&#39;&lt;/div&gt;");

            const decoded = unescapeHtml(encoded);
            expect(decoded).toBe(original);
        });
    });

    describe("convertTextディスパッチャー", () => {
        it("各種モードで正常に変換結果を返すこと", () => {
            expect(convertText("<h1>test</h1>", "html-to-markdown").output).toContain("# test");
            expect(convertText("# test", "markdown-to-html").output).toContain("<h1>test</h1>");
            expect(convertText("hello world", "url-encode").output).toBe("hello%20world");
            expect(convertText("hello%20world", "url-decode").output).toBe("hello world");
        });
    });
});
