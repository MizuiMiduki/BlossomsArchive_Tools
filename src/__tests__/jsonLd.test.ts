import { describe, it, expect } from "vitest";
import {
    extractJsonLdBlocks,
    validateJsonLdEntity,
    buildTreeNode,
    parseJsonLd,
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
});
