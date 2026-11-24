import { describe, it, expect } from "vitest";
import {
    extractJsonLdBlocks,
    validateJsonLdEntity,
    buildTreeNode,
    parseJsonLd,
    flattenJsonLdProperties,
    JSON_LD_SAMPLES,
} from "../utils/jsonLd";

describe("JSON-LD Utilities (src/utils/jsonLd.ts)", () => {
    describe("extractJsonLdBlocks", () => {
        it("空文字列の場合は空配列を返すこと", () => {
            expect(extractJsonLdBlocks("")).toEqual([]);
            expect(extractJsonLdBlocks("   ")).toEqual([]);
        });

        it("生のJSON文字列をそのまま抽出できること", () => {
            const jsonStr = '{"@context": "https://schema.org", "@type": "Person", "name": "Alice"}';
            const blocks = extractJsonLdBlocks(jsonStr);
            expect(blocks).toEqual([jsonStr]);
        });

        it("HTMLスニペット内の <script type=\"application/ld+json\"> を抽出できること", () => {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <script type="application/ld+json">
                    {"@context": "https://schema.org", "@type": "WebSite", "name": "Site A"}
                    </script>
                    <script type="application/ld+json">
                    {"@context": "https://schema.org", "@type": "Organization", "name": "Org B"}
                    </script>
                </head>
                <body><h1>Hello</h1></body>
                </html>
            `;
            const blocks = extractJsonLdBlocks(html);
            expect(blocks.length).toBe(2);
            expect(JSON.parse(blocks[0])["@type"]).toBe("WebSite");
            expect(JSON.parse(blocks[1])["@type"]).toBe("Organization");
        });
    });

    describe("validateJsonLdEntity", () => {
        it("必須プロパティが欠落している場合にエラーを検出すること", () => {
            // Article requires headline
            const entity = {
                "@context": "https://schema.org",
                "@type": "Article",
                "description": "No headline provided",
            };
            const issues = validateJsonLdEntity(entity);
            const headlineIssue = issues.find((i) => i.field === "headline");
            expect(headlineIssue).toBeDefined();
            expect(headlineIssue?.severity).toBe("error");
        });

        it("推奨プロパティが欠落している場合に警告を検出すること", () => {
            const entity = {
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "Sample Title",
            };
            const issues = validateJsonLdEntity(entity);
            const authorIssue = issues.find((i) => i.field === "author");
            expect(authorIssue).toBeDefined();
            expect(authorIssue?.severity).toBe("warning");
        });

        it("@type が未定義の場合にエラーを検出すること", () => {
            const entity = {
                "@context": "https://schema.org",
                "name": "No Type",
            };
            const issues = validateJsonLdEntity(entity);
            const typeIssue = issues.find((i) => i.field === "@type");
            expect(typeIssue).toBeDefined();
            expect(typeIssue?.severity).toBe("error");
        });

        it("@context が未定義の場合に警告を検出すること", () => {
            const entity = {
                "@type": "Person",
                "name": "Bob",
            };
            const issues = validateJsonLdEntity(entity);
            const contextIssue = issues.find((i) => i.field === "@context");
            expect(contextIssue).toBeDefined();
            expect(contextIssue?.severity).toBe("warning");
        });
    });

    describe("buildTreeNode", () => {
        it("プリミティブ値ノードが正しく構築されること", () => {
            const strNode = buildTreeNode("name", "BlossomsArchive", "root.name");
            expect(strNode.key).toBe("name");
            expect(strNode.value).toBe("BlossomsArchive");
            expect(strNode.valueType).toBe("string");

            const numNode = buildTreeNode("price", 1000, "root.price");
            expect(numNode.valueType).toBe("number");
            expect(numNode.value).toBe(1000);

            const nullNode = buildTreeNode("empty", null, "root.empty");
            expect(nullNode.valueType).toBe("null");
        });

        it("配列ノードが再帰的に構築されること", () => {
            const arr = ["item1", "item2"];
            const arrNode = buildTreeNode("list", arr, "root.list");
            expect(arrNode.valueType).toBe("array");
            expect(arrNode.itemCount).toBe(2);
            expect(arrNode.children?.length).toBe(2);
            expect(arrNode.children?.[0].value).toBe("item1");
        });

        it("オブジェクトノードにSchema.orgの型とURLが付与されること", () => {
            const obj = {
                "@type": "Product",
                "name": "Smart Speaker",
            };
            const objNode = buildTreeNode("root", obj, "root");
            expect(objNode.valueType).toBe("object");
            expect(objNode.schemaType).toBe("Product");
            expect(objNode.schemaUrl).toBe("https://schema.org/Product");
            expect(objNode.children?.length).toBe(2);
        });
    });

    describe("parseJsonLd", () => {
        it("空文字列の場合は isValid: false を返すこと", () => {
            const res = parseJsonLd("");
            expect(res.isValid).toBe(false);
            expect(res.entities.length).toBe(0);
        });

        it("構文エラーのJSONに対してエラーメッセージを返すこと", () => {
            const res = parseJsonLd("{ broken json ");
            expect(res.isValid).toBe(false);
            expect(res.error).toBeTruthy();
        });

        it("@graph を含む構造化データを正しく展開・パースできること", () => {
            const graphJson = JSON.stringify({
                "@context": "https://schema.org",
                "@graph": [
                    { "@type": "Organization", "name": "Company A" },
                    { "@type": "WebSite", "name": "Site B", "url": "https://example.com" },
                ],
            });
            const res = parseJsonLd(graphJson);
            expect(res.isValid).toBe(true);
            expect(res.hasGraph).toBe(true);
            expect(res.entities.length).toBe(2);
            expect(res.entities[0].type).toBe("Organization");
            expect(res.entities[1].type).toBe("WebSite");
        });
    });

    describe("JSON_LD_SAMPLES", () => {
        it("すべてのサンプルデータが正常にパースでき、バリデーション致命的エラーがないこと", () => {
            for (const [key, sample] of Object.entries(JSON_LD_SAMPLES)) {
                const jsonStr = JSON.stringify(sample.data);
                const res = parseJsonLd(jsonStr);
                expect(res.isValid).toBe(true);
                expect(res.entities.length).toBeGreaterThan(0);

                // サンプルデータは必須プロパティを満たしていること
                for (const entity of res.entities) {
                    const criticalErrors = entity.validationIssues.filter((i) => i.severity === "error");
                    expect(criticalErrors, `Sample '${key}' had critical errors`).toEqual([]);
                }
            }
        });
    });

    describe("flattenJsonLdProperties", () => {
        it("ネストオブジェクトや配列をドット・インデックス記法でフラット展開できること", () => {
            const input = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                "headline": "テスト記事",
                "author": {
                    "@type": "Person",
                    "name": "山田 太郎",
                    "url": "https://example.com/authors/taro",
                },
                "keywords": ["SEO", "JSON-LD"],
            });
            const parsed = parseJsonLd(input);
            const rows = flattenJsonLdProperties(parsed.entities);

            expect(rows.find((r) => r.propertyPath === "headline")).toMatchObject({
                entityType: "Article",
                value: "テスト記事",
                valueType: "string",
                isUrl: false,
            });
            expect(rows.find((r) => r.propertyPath === "author.name")).toMatchObject({
                entityType: "Article",
                value: "山田 太郎",
                valueType: "string",
            });
            expect(rows.find((r) => r.propertyPath === "author.url")).toMatchObject({
                value: "https://example.com/authors/taro",
                valueType: "url",
                isUrl: true,
            });
            expect(rows.find((r) => r.propertyPath === "keywords[0]")?.value).toBe("SEO");
            expect(rows.find((r) => r.propertyPath === "keywords[1]")?.value).toBe("JSON-LD");
        });

        it("危険なURLスキームをリンク扱いにせず、空配列・空オブジェクト・各種プリミティブ型を正しく分類すること", () => {
            const input = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Thing",
                "unsafeUrl": "javascript:alert(1)",
                "count": 42,
                "active": true,
                "nullable": null,
                "emptyArr": [],
                "emptyObj": {},
            });
            const parsed = parseJsonLd(input);
            const rows = flattenJsonLdProperties(parsed.entities);

            expect(rows.find((r) => r.propertyPath === "unsafeUrl")).toMatchObject({
                valueType: "string",
                isUrl: false,
            });
            expect(rows.find((r) => r.propertyPath === "count")).toMatchObject({
                value: "42",
                valueType: "number",
            });
            expect(rows.find((r) => r.propertyPath === "active")).toMatchObject({
                value: "true",
                valueType: "boolean",
            });
            expect(rows.find((r) => r.propertyPath === "nullable")).toMatchObject({
                value: "null",
                valueType: "null",
            });
            expect(rows.find((r) => r.propertyPath === "emptyArr")).toMatchObject({
                value: "[]",
                valueType: "empty",
            });
            expect(rows.find((r) => r.propertyPath === "emptyObj")).toMatchObject({
                value: "{}",
                valueType: "empty",
            });
        });

        it("@graph を含む複数エンティティがそれぞれの entityType 付きで展開されること", () => {
            const graphJson = JSON.stringify({
                "@context": "https://schema.org",
                "@graph": [
                    { "@type": "Organization", "name": "Org A" },
                    { "@type": "WebSite", "name": "Site B", "url": "https://example.com" },
                ],
            });
            const parsed = parseJsonLd(graphJson);
            const rows = flattenJsonLdProperties(parsed.entities);

            expect(rows.some((r) => r.entityType === "Organization" && r.propertyPath === "name" && r.value === "Org A")).toBe(true);
            expect(rows.some((r) => r.entityType === "WebSite" && r.propertyPath === "url" && r.isUrl === true)).toBe(true);
        });
    });
});
