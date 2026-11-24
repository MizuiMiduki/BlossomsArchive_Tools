/**
 * JSON-LD (JavaScript Object Notation for Linked Data) 解析・構造化ユーティリティ
 */

export interface JsonLdValidationIssue {
    severity: "error" | "warning" | "info";
    field?: string;
    message: string;
}

export interface JsonLdEntitySummary {
    id: string;
    type: string;
    context: string;
    identifier?: string;
    name?: string;
    url?: string;
    description?: string;
    raw: any;
    validationIssues: JsonLdValidationIssue[];
}

export interface JsonLdTreeNode {
    id: string;
    key: string;
    value: any;
    valueType: "object" | "array" | "string" | "number" | "boolean" | "null";
    schemaType?: string;
    schemaUrl?: string;
    children?: JsonLdTreeNode[];
    itemCount?: number;
}

export interface JsonLdParseResult {
    isValid: boolean;
    error: string | null;
    rawText: string;
    entities: JsonLdEntitySummary[];
    treeNodes: JsonLdTreeNode[];
    totalEntitiesCount: number;
    hasGraph: boolean;
    extractedCount: number;
}

/**
 * 主要なSchema.org型と推奨プロパティの定義
 */
const SCHEMA_RECOMMENDATIONS: Record<string, { required: string[]; recommended: string[] }> = {
    Article: {
        required: ["headline"],
        recommended: ["image", "datePublished", "author", "publisher"],
    },
    BlogPosting: {
        required: ["headline"],
        recommended: ["image", "datePublished", "author", "publisher"],
    },
    NewsArticle: {
        required: ["headline"],
        recommended: ["image", "datePublished", "dateModified", "author", "publisher"],
    },
    Product: {
        required: ["name"],
        recommended: ["image", "description", "offers", "aggregateRating", "brand"],
    },
    Organization: {
        required: ["name"],
        recommended: ["url", "logo", "contactPoint", "sameAs"],
    },
    LocalBusiness: {
        required: ["name", "address"],
        recommended: ["telephone", "image", "priceRange", "openingHoursSpecification"],
    },
    BreadcrumbList: {
        required: ["itemListElement"],
        recommended: [],
    },
    FAQPage: {
        required: ["mainEntity"],
        recommended: [],
    },
    Question: {
        required: ["name", "acceptedAnswer"],
        recommended: [],
    },
    Answer: {
        required: ["text"],
        recommended: [],
    },
    Person: {
        required: ["name"],
        recommended: ["url", "image", "jobTitle", "sameAs"],
    },
    WebSite: {
        required: ["name", "url"],
        recommended: ["potentialAction"],
    },
    WebPage: {
        required: ["name"],
        recommended: ["url", "description", "breadcrumb"],
    },
    Event: {
        required: ["name", "startDate", "location"],
        recommended: ["endDate", "description", "image", "offers"],
    },
    Recipe: {
        required: ["name", "recipeIngredient", "recipeInstructions"],
        recommended: ["image", "author", "cookTime", "prepTime"],
    },
};

/**
 * HTMLまたは生のJSONテキストからJSON-LDスニペットを安全に抽出する
 */
export function extractJsonLdBlocks(input: string): string[] {
    const trimmed = input.trim();
    if (!trimmed) return [];

    const lower = trimmed.toLowerCase();
    const looksLikeHtml =
        lower.includes("<script") ||
        lower.includes("<html") ||
        lower.includes("<!doctype") ||
        lower.includes("<head");

    if (looksLikeHtml) {
        if (typeof DOMParser !== "undefined") {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(trimmed, "text/html");
                const scripts = doc.querySelectorAll("script");
                const results: string[] = [];
                scripts.forEach((script) => {
                    const typeAttr = script.getAttribute("type");
                    if (
                        typeAttr &&
                        typeAttr.toLowerCase().includes("application/ld+json")
                    ) {
                        const text = script.textContent?.trim();
                        if (text) {
                            results.push(text);
                        }
                    }
                });
                return results;
            } catch {
                // DOMParser失敗時は空配列
            }
        }
        return [];
    }

    // 単一のJSON文字列として返す
    return [trimmed];
}

/**
 * エンティティのバリデーションを実行する
 */
export function validateJsonLdEntity(entity: any, parentContext?: string): JsonLdValidationIssue[] {
    const issues: JsonLdValidationIssue[] = [];

    if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
        issues.push({
            severity: "error",
            message: "エンティティは有効なJSONオブジェクトである必要があります",
        });
        return issues;
    }

    // @context チェック
    const context = entity["@context"] || parentContext;
    if (!context) {
        issues.push({
            severity: "warning",
            field: "@context",
            message: "@context が指定されていません（推奨: \"https://schema.org\"）",
        });
    } else if (typeof context === "string") {
        if (!context.includes("schema.org")) {
            issues.push({
                severity: "info",
                field: "@context",
                message: `@context が schema.org 以外の語彙 (${context}) を参照しています`,
            });
        }
    }

    // @type チェック
    const type = entity["@type"];
    if (!type) {
        issues.push({
            severity: "error",
            field: "@type",
            message: "@type が定義されていません",
        });
    } else {
        const types = Array.isArray(type) ? type : [type];
        for (const t of types) {
            if (typeof t === "string" && SCHEMA_RECOMMENDATIONS[t]) {
                const spec = SCHEMA_RECOMMENDATIONS[t];
                // 必須フィールドチェック
                for (const req of spec.required) {
                    if (entity[req] === undefined || entity[req] === null || entity[req] === "") {
                        issues.push({
                            severity: "error",
                            field: req,
                            message: `${t} 型では必須プロパティ '${req}' が欠落しています`,
                        });
                    }
                }
                // 推奨フィールドチェック
                for (const rec of spec.recommended) {
                    if (entity[rec] === undefined || entity[rec] === null || entity[rec] === "") {
                        issues.push({
                            severity: "warning",
                            field: rec,
                            message: `${t} 型では推奨プロパティ '${rec}' の設定が推奨されます`,
                        });
                    }
                }
            }
        }
    }

    return issues;
}

/**
 * 任意のオブジェクトからツリーノード階層を再帰的に生成する
 */
export function buildTreeNode(key: string, value: any, path: string = "root"): JsonLdTreeNode {
    if (value === null) {
        return {
            id: path,
            key,
            value: null,
            valueType: "null",
        };
    }

    if (Array.isArray(value)) {
        return {
            id: path,
            key,
            value: null,
            valueType: "array",
            itemCount: value.length,
            children: value.map((item, index) =>
                buildTreeNode(`[${index}]`, item, `${path}.${index}`),
            ),
        };
    }

    if (typeof value === "object") {
        const schemaType = value["@type"]
            ? (Array.isArray(value["@type"]) ? value["@type"].join(", ") : String(value["@type"]))
            : undefined;
        const schemaUrl = schemaType && !schemaType.includes(",")
            ? `https://schema.org/${schemaType.trim()}`
            : undefined;

        const entries = Object.entries(value);
        return {
            id: path,
            key,
            value: null,
            valueType: "object",
            schemaType,
            schemaUrl,
            itemCount: entries.length,
            children: entries.map(([childKey, childVal]) =>
                buildTreeNode(childKey, childVal, `${path}.${childKey}`),
            ),
        };
    }

    const valueType = typeof value as "string" | "number" | "boolean";
    return {
        id: path,
        key,
        value,
        valueType,
    };
}

/**
 * 入力テキストからJSON-LD全体を解析・構造化する
 */
export function parseJsonLd(input: string): JsonLdParseResult {
    const blocks = extractJsonLdBlocks(input);
    if (blocks.length === 0) {
        return {
            isValid: false,
            error: null,
            rawText: "",
            entities: [],
            treeNodes: [],
            totalEntitiesCount: 0,
            hasGraph: false,
            extractedCount: 0,
        };
    }

    const allEntities: JsonLdEntitySummary[] = [];
    const rootTreeNodes: JsonLdTreeNode[] = [];
    let hasGraph = false;
    let parseError: string | null = null;

    blocks.forEach((block, blockIndex) => {
        try {
            const parsed = JSON.parse(block);
            const blockContext = parsed["@context"]
                ? (typeof parsed["@context"] === "string" ? parsed["@context"] : JSON.stringify(parsed["@context"]))
                : "https://schema.org";

            // 単一オブジェクト、配列、@graph のいずれかを平坦化してエンティティリスト化
            let targetList: any[] = [];
            if (Array.isArray(parsed)) {
                targetList = parsed;
            } else if (parsed && parsed["@graph"] && Array.isArray(parsed["@graph"])) {
                hasGraph = true;
                targetList = parsed["@graph"];
            } else if (parsed && typeof parsed === "object") {
                targetList = [parsed];
            }

            targetList.forEach((item, itemIdx) => {
                if (item && typeof item === "object") {
                    const typeStr = item["@type"]
                        ? (Array.isArray(item["@type"]) ? item["@type"].join(", ") : String(item["@type"]))
                        : "Unknown";
                    const itemContext = item["@context"] ? String(item["@context"]) : blockContext;
                    const issues = validateJsonLdEntity(item, itemContext);

                    allEntities.push({
                        id: `block-${blockIndex}-entity-${itemIdx}`,
                        type: typeStr,
                        context: itemContext,
                        identifier: item["@id"],
                        name: item.name || item.headline || item.title,
                        url: item.url,
                        description: item.description,
                        raw: item,
                        validationIssues: issues,
                    });
                }
            });

            // ツリー構築
            const label = blocks.length > 1
                ? `スニペット #${blockIndex + 1} (${parsed["@type"] || (parsed["@graph"] ? "@graph" : "Object")})`
                : (parsed["@type"] || (parsed["@graph"] ? "@graph" : "JSON-LD Root"));
            rootTreeNodes.push(buildTreeNode(label, parsed, `block-${blockIndex}`));
        } catch (err: any) {
            parseError = err?.message || "JSONのパースに失敗しました";
        }
    });

    if (parseError && allEntities.length === 0) {
        return {
            isValid: false,
            error: parseError,
            rawText: input,
            entities: [],
            treeNodes: [],
            totalEntitiesCount: 0,
            hasGraph: false,
            extractedCount: blocks.length,
        };
    }

    return {
        isValid: true,
        error: null,
        rawText: input,
        entities: allEntities,
        treeNodes: rootTreeNodes,
        totalEntitiesCount: allEntities.length,
        hasGraph,
        extractedCount: blocks.length,
    };
}

/**
 * サンプルプリセットデータ
 */
export const JSON_LD_SAMPLES: Record<string, { label: string; description: string; data: object }> = {
    article: {
        label: "記事 (Article / BlogPosting)",
        description: "ニュース記事やブログ記事に最適なSchema.org構造化データ",
        data: {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "@id": "https://example.com/blog/sample-post#article",
            "headline": "Web開発を加速させるモダンフロントエンドツールの活用法",
            "description": "最新のフロントエンド技術スタックとWebツールの効果的な組み合わせについて詳しく解説します。",
            "image": [
                "https://example.com/images/16x9/photo.jpg",
                "https://example.com/images/4x3/photo.jpg"
            ],
            "datePublished": "2026-11-20T10:00:00+09:00",
            "dateModified": "2026-11-24T15:30:00+09:00",
            "author": {
                "@type": "Person",
                "name": "山田 太郎",
                "url": "https://example.com/authors/taro-yamada"
            },
            "publisher": {
                "@type": "Organization",
                "name": "BlossomsArchive Tech",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://example.com/logo.png"
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": "https://example.com/blog/sample-post"
            }
        },
    },
    product: {
        label: "商品 (Product / Offer)",
        description: "ECサイトの製品詳細・価格・在庫・レビュー評価データ",
        data: {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "ハイレゾ対応 高音質ワイヤレスヘッドホン Pro",
            "image": "https://example.com/images/headphones-pro.jpg",
            "description": "ノイズキャンセリング機能と40mm大口径ドライバーを搭載したフラッグシップモデル。",
            "brand": {
                "@type": "Brand",
                "name": "SoundCraft"
            },
            "sku": "SC-HP-2026",
            "offers": {
                "@type": "Offer",
                "url": "https://example.com/products/headphones-pro",
                "priceCurrency": "JPY",
                "price": "29800",
                "priceValidUntil": "2027-12-31",
                "itemCondition": "https://schema.org/NewCondition",
                "availability": "https://schema.org/InStock",
                "seller": {
                    "@type": "Organization",
                    "name": "公式ストア"
                }
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "reviewCount": "128"
            }
        },
    },
    breadcrumbs: {
        label: "パンくずリスト (BreadcrumbList)",
        description: "Google検索結果にページ階層を表示するパンくず構造化データ",
        data: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "ホーム",
                    "item": "https://example.com/"
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "カメラ・写真ツール",
                    "item": "https://example.com/camera/"
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": "露出計算ツール",
                    "item": "https://example.com/camera/exposure-calculator"
                }
            ]
        },
    },
    faq: {
        label: "よくある質問 (FAQPage)",
        description: "Q&A形式のリッチスニペットを表示するFAQPage構造化データ",
        data: {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "ツールの利用に料金はかかりますか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "すべてのツールを完全無料でご利用いただけます。登録やインストールも不要です。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "入力したデータはサーバーに保存されますか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "いいえ、すべての処理はご利用のブラウザ内で完結して実行されるため、データがサーバーに送信されることはありません。"
                    }
                }
            ]
        },
    },
    graph: {
        label: "複合グラフ (@graph)",
        description: "WebSite・Organization・WebPageをまとめた現代的な@graph構造",
        data: {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Organization",
                    "@id": "https://example.com/#organization",
                    "name": "BlossomsArchive",
                    "url": "https://example.com/",
                    "logo": {
                        "@type": "ImageObject",
                        "url": "https://example.com/icon.png"
                    }
                },
                {
                    "@type": "WebSite",
                    "@id": "https://example.com/#website",
                    "url": "https://example.com/",
                    "name": "BlossomsArchive Tools",
                    "publisher": {
                        "@id": "https://example.com/#organization"
                    }
                },
                {
                    "@type": "WebPage",
                    "@id": "https://example.com/tools/json-ld-viewer#webpage",
                    "url": "https://example.com/tools/json-ld-viewer",
                    "name": "JSON-LD構造可視化・検証ツール",
                    "isPartOf": {
                        "@id": "https://example.com/#website"
                    }
                }
            ]
        },
    },
};
