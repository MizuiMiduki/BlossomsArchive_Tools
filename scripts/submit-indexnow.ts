// scripts/submit-indexnow.ts
import path from "path";
import { fileURLToPath } from "url";
import { routes, SITE_URL, INDEXNOW_KEY, type Route } from "../src/routes";

export interface IndexNowPayload {
    host: string;
    key: string;
    keyLocation: string;
    urlList: string[];
}

export function buildIndexNowPayload(
    options: {
        host?: string;
        key?: string;
        routesList?: Route[];
    } = {},
): IndexNowPayload {
    const rawHost = options.host || SITE_URL;
    const urlObj = new URL(rawHost);
    const host = urlObj.hostname;
    const key = options.key || process.env.INDEXNOW_KEY || INDEXNOW_KEY;
    const targetRoutes = options.routesList || routes;

    const urlList = targetRoutes
        .filter((r) => r.path !== "*" && !r.hidden)
        .map((r) => `${rawHost}${r.path === "/" ? "/" : r.path}`);

    return {
        host,
        key,
        keyLocation: `${rawHost}/${key}.txt`,
        urlList,
    };
}

export async function submitToIndexNow(
    payload: IndexNowPayload,
    fetchFn: typeof fetch = fetch,
): Promise<{ status: number; message: string }> {
    const endpoint = "https://api.indexnow.org/indexnow";
    const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
    });

    if (response.status === 200 || response.status === 202) {
        return {
            status: response.status,
            message: `Successfully submitted ${payload.urlList.length} URLs to IndexNow (HTTP ${response.status})`,
        };
    }

    const text = await response.text().catch(() => "");
    throw new Error(`IndexNow submission failed: HTTP ${response.status} - ${text}`);
}

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes("--dry-run");
    const payload = buildIndexNowPayload();

    console.log("📡 IndexNow Payload:");
    console.log(`- Host: ${payload.host}`);
    console.log(`- Key: ${payload.key}`);
    console.log(`- KeyLocation: ${payload.keyLocation}`);
    console.log(`- URL Count: ${payload.urlList.length}`);

    if (isDryRun) {
        console.log("ℹ️ Dry-run mode enabled. Skipping HTTP submission.");
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    try {
        const res = await submitToIndexNow(payload);
        console.log(`✅ ${res.message}`);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`⚠️ ${message}`);
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main();
}
