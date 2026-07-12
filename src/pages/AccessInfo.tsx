import { createSignal, Show } from "solid-js";

interface IpData {
    ip: string;
    country_name: string;
    country_code: string;
    region: string;
    city: string;
    postal: string;
    timezone: string;
    latitude: number;
    longitude: number;
    org: string;
}

export default function AccessInfo() {
    const [info, setInfo] = createSignal<IpData | null>(null);
    const [loading, setLoading] = createSignal(false);
    const [hasFetched, setHasFetched] = createSignal(false);
    const [error, setError] = createSignal("");

    const [allCopied, setAllCopied] = createSignal(false);
    const [copiedKey, setCopiedKey] = createSignal<string | null>(null);

    const [userAgent, setUserAgent] = createSignal("");
    const [screenSize, setScreenSize] = createSignal("");
    const [physicScreenSize, setPhysicScreenSize] = createSignal("");
    const [language, setLanguage] = createSignal("");
    const [networkType, setNetworkType] = createSignal("");
    const [batteryLevel, setBatteryLevel] = createSignal("");

    const fetchAccessInfo = async () => {
        if (loading()) return;
        setLoading(true);
        setError("");
        setInfo(null);
        setHasFetched(true);

        try {
            setUserAgent(navigator.userAgent || "不明");
            setLanguage(navigator.language || "ja");
            setScreenSize(
                `${window.screen.width || 0} x ${window.screen.height || 0}`,
            );

            const dpr = window.devicePixelRatio || 1;
            const realWidth = Math.round((window.screen.width || 0) * dpr);
            const realHeight = Math.round((window.screen.height || 0) * dpr);
            setPhysicScreenSize(
                `${realWidth} x ${realHeight} (画面倍率: ${dpr}倍)`,
            );

            const conn =
                (navigator as any).connection ||
                (navigator as any).mozConnection ||
                (navigator as any).webkitConnection;
            if (conn) {
                const connectionType = conn.type || "unknown";
                const effectiveType = conn.effectiveType || "4g";

                let displayType = "";

                if (
                    connectionType === "wifi" ||
                    connectionType === "ethernet"
                ) {
                    displayType = "固定回線 (Wi-Fi / 有線LAN)";
                } else if (connectionType === "cellular") {
                    displayType = `モバイル回線 (${effectiveType.toUpperCase()})`;
                } else {
                    if (effectiveType === "4g") {
                        displayType = "固定回線または高速モバイル回線";
                    } else {
                        displayType = `モバイル回線 (${effectiveType.toUpperCase()}相当)`;
                    }
                }

                setNetworkType(displayType);
            } else {
                setNetworkType("取得不可");
            }

            if ((navigator as any).getBattery) {
                try {
                    const battery = await (navigator as any).getBattery();
                    setBatteryLevel(
                        `${Math.round(battery.level * 100)}% (${battery.charging ? "充電中" : "放電中"})`,
                    );
                } catch (e) {
                    setBatteryLevel("取得失敗");
                }
            } else {
                setBatteryLevel("取得不可");
            }
        } catch (deviceErr) {
            console.error("Device info error:", deviceErr);
        }

        try {
            const response = await fetch("https://ipapi.co/json/").catch(() => {
                throw new Error(
                    "ネットワークエラーが発生しました。接続を確認してください。",
                );
            });

            if (!response.ok) {
                throw new Error("APIサーバーの応答制限、または混雑中です。");
            }

            const data = await response.json().catch(() => {
                throw new Error("データの解析に失敗しました。");
            });

            if (!data || data.error || !data.ip) {
                throw new Error(
                    "APIの無料利用回数制限に達したため、現在データを取得できません。時間を空けて再度お試しください。",
                );
            }

            setInfo({
                ip: data.ip,
                country_name: data.country_name || "不明",
                country_code: data.country_code || "---",
                region: data.region || "不明",
                city: data.city || "不明",
                postal: data.postal || "---",
                timezone: data.timezone || "Asia/Tokyo",
                latitude: Number(data.latitude) || 0,
                longitude: Number(data.longitude) || 0,
                org: data.org || "不明",
            });
        } catch (err: any) {
            console.error(err);
            setError(
                err.message ||
                    "原因不明のエラーでIPアドレスが取得できませんでした。",
            );
            setInfo(null);
        } finally {
            setLoading(false);
        }
    };

    const copyRow = async (text: string, key: string) => {
        if (!text || text === "---") return;
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 1500);
        } catch (err) {
            console.error(err);
        }
    };

    const copyAllToClipboard = async () => {
        const data = info();
        if (!data) return;

        const text = `【アクセス解析情報】
■ 接続環境
IPアドレス: ${data.ip}
プロバイダ(ISP): ${data.org}
国: ${data.country_name}
都道府県 / 都市: ${data.region} / ${data.city}
郵便番号: ${data.postal}
緯度 / 経度: ${data.latitude} , ${data.longitude}

■ 端末環境
物理解像度: ${physicScreenSize()}
論理解像度: ${screenSize()}
回線種別: ${networkType()}
ユーザーエージェント: ${userAgent()}
バッテリー残量: ${batteryLevel()}`;

        try {
            await navigator.clipboard.writeText(text);
            setAllCopied(true);
            setTimeout(() => setAllCopied(false), 2000);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div class="h-full w-full p-6 flex flex-col gap-6">
            <div class="card bg-base-100 shadow-xl p-8 w-full border border-base-300">
                <Show when={!hasFetched() && !loading()}>
                    <div class="flex flex-col items-center justify-center py-16 gap-4">
                        <p class="text-base-content/70 font-medium text-lg">
                            ボタンを押すと、現在のネットワークや端末環境を解析します。
                        </p>
                        <button
                            onClick={fetchAccessInfo}
                            class="btn btn-primary text-white text-xl h-16 px-12 rounded-2xl shadow-lg transition-all hover:scale-105"
                        >
                            アクセス情報を取得する
                        </button>
                    </div>
                </Show>

                <Show when={loading()}>
                    <div class="flex flex-col items-center justify-center py-12 gap-4">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                        <p class="text-base-content/70 font-medium">
                            情報を解析中...
                        </p>
                    </div>
                </Show>

                <Show when={error() && !loading()}>
                    <div class="alert alert-error text-white font-bold mb-6 shadow-md rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div class="flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{error()}</span>
                        </div>
                        <button
                            onClick={fetchAccessInfo}
                            class="btn btn-sm bg-base-100 text-error border-none hover:bg-base-200 flex-shrink-0"
                        >
                            もう一度試す
                        </button>
                    </div>
                </Show>

                <Show when={info() && !loading()}>
                    <div class="w-full flex flex-col gap-8 animate-fade-in">
                        <div>
                            <h3 class="text-xl font-bold mb-3 text-primary flex items-center gap-2">
                                <span>🌐</span> 接続環境・位置情報
                            </h3>
                            <div class="overflow-x-auto border border-base-300 rounded-xl bg-base-100">
                                <table class="table table-zebra w-full text-base table-fixed">
                                    <tbody>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 w-1/3 bg-base-200/30">
                                                IPアドレス
                                            </td>
                                            <td class="font-mono text-base-content font-bold text-lg truncate">
                                                {info()?.ip}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                info()?.ip ||
                                                                    "",
                                                                "ip",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "ip" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() === "ip"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                プロバイダ (ISP)
                                            </td>
                                            <td class="text-base-content font-semibold truncate">
                                                {info()?.org}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                info()?.org ||
                                                                    "",
                                                                "org",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "org" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() === "org"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                国 / 地域
                                            </td>
                                            <td class="text-base-content truncate">
                                                {info()?.country_name} (
                                                {info()?.country_code})
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                `${info()?.country_name} (${info()?.country_code})`,
                                                                "country",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "country" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() ===
                                                        "country"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                都道府県 / 都市
                                            </td>
                                            <td class="text-base-content truncate">
                                                {info()?.region} /{" "}
                                                {info()?.city}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                `${info()?.region} / ${info()?.city}`,
                                                                "region",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "region" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() ===
                                                        "region"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                郵便番号
                                            </td>
                                            <td class="text-base-content font-mono truncate">
                                                {info()?.postal || "---"}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        disabled={
                                                            !info()?.postal ||
                                                            info()?.postal ===
                                                                "---"
                                                        }
                                                        onClick={() =>
                                                            copyRow(
                                                                info()
                                                                    ?.postal ||
                                                                    "",
                                                                "postal",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "postal" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() ===
                                                        "postal"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                緯度 / 経度 (推定)
                                            </td>
                                            <td class="text-base-content font-mono truncate">
                                                {info()?.latitude} ,{" "}
                                                {info()?.longitude}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                `${info()?.latitude} , ${info()?.longitude}`,
                                                                "latlng",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "latlng" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() ===
                                                        "latlng"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <h3 class="text-xl font-bold mb-3 text-secondary flex items-center gap-2">
                                <span>💻</span> 端末・ブラウザ環境
                            </h3>
                            <div class="overflow-x-auto border border-base-300 rounded-xl bg-base-100">
                                <table class="table table-zebra w-full text-base">
                                    <tbody>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 w-1/3 bg-base-200/30">
                                                物理解像度
                                            </td>
                                            <td class="text-base-content font-mono font-bold">
                                                {physicScreenSize()}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                physicScreenSize(),
                                                                "physic",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "physic" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() ===
                                                        "physic"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                論理解像度
                                            </td>
                                            <td class="text-base-content font-mono">
                                                {screenSize()}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                screenSize(),
                                                                "logic",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "logic" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() === "logic"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                回線種別
                                            </td>
                                            <td class="text-base-content">
                                                {networkType()}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                networkType(),
                                                                "net",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "net" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() === "net"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr class="border-b border-base-200">
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                ユーザーエージェント
                                            </td>
                                            <td class="text-xs font-mono text-base-content/80 break-all whitespace-normal pr-4">
                                                {userAgent()}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                userAgent(),
                                                                "ua",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "ua" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() === "ua"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="font-bold text-base-content/70 bg-base-200/30">
                                                バッテリー残量
                                            </td>
                                            <td class="text-base-content">
                                                {batteryLevel()}
                                            </td>
                                            <td class="w-28 border-none">
                                                <div class="flex items-center justify-end h-full">
                                                    <button
                                                        onClick={() =>
                                                            copyRow(
                                                                batteryLevel(),
                                                                "bat",
                                                            )
                                                        }
                                                        class={`btn btn-xs text-white ${copiedKey() === "bat" ? "btn-success" : "btn-neutral"}`}
                                                    >
                                                        {copiedKey() === "bat"
                                                            ? "完了"
                                                            : "コピー"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="flex flex-row justify-between items-center mb-6 w-full">
                            <Show when={info() && !loading()}>
                                <div class="flex justify-end w-full">
                                    <button
                                        onClick={copyAllToClipboard}
                                        class={`btn text-white h-12 px-6 text-lg rounded-xl shadow-sm transition-all ${allCopied() ? "btn-success" : "btn-neutral"}`}
                                    >
                                        {allCopied()
                                            ? "すべてコピー完了！"
                                            : "すべての情報をコピー"}
                                    </button>
                                </div>
                            </Show>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}
