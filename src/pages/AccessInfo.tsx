import { createSignal, Show, onMount, onCleanup } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import { delayedCall, playPageEntrance, animateFadeIn, animatePop } from "../utils/gsapAnimations";

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

    let containerRef: HTMLDivElement | undefined;

    // SEO対策：メタデータの動的挿入
    onMount(() => {
        document.title =
            "アクセス環境解析ツール | IP・端末・回線情報チェッカー";

        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement("meta");
            metaDesc.setAttribute("name", "description");
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute(
            "content",
            "現在のIPアドレス、位置情報、ブラウザのユーザーエージェント、回線速度、画面解像度などをリアルタイムで解析・確認できるWebツールです。",
        );

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "access-info-jsonld";
        script.text = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "アクセス環境解析ツール",
            operatingSystem: "All",
            applicationCategory: "UtilityApplication",
            browserRequirements: "Requires JavaScript. Requires HTML5.",
            description:
                "IPアドレスや端末の各種環境情報をまとめて取得・表示する解析ツールです。",
        });
        document.head.appendChild(script);

        if (containerRef) playPageEntrance(containerRef);
    });

    onCleanup(() => {
        const script = document.getElementById("access-info-jsonld");
        if (script) {
            script.remove();
        }
    });

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
            delayedCall(1.5, () => setCopiedKey(null));
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
            delayedCall(2, () => setAllCopied(false));
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * スマホでも文字が見切れないレスポンシブな情報行レンダラー
     */
    const renderRow = (
        label: string,
        value: string | undefined,
        copyKey: string,
        options?: { isMono?: boolean; isPrimary?: boolean; disabled?: boolean },
    ) => {
        const val = value || "---";
        const isValEmpty = !value || value === "---";
        const isCopied = () => copiedKey() === copyKey;

        return (
            <div class="flex flex-col md:flex-row md:items-center justify-between p-3.5 sm:p-4 gap-2 hover:bg-base-200/50 transition-colors">
                {/* ラベル + モバイル用コピーボタン (横並び) */}
                <div class="flex items-center justify-between md:w-52 lg:w-60 shrink-0">
                    <span class="font-bold text-xs sm:text-sm text-base-content/70">
                        {label}
                    </span>
                    <button
                        disabled={options?.disabled || isValEmpty}
                        onClick={() => copyRow(val, copyKey)}
                        class={`btn btn-xs h-7 px-2.5 rounded-lg text-white font-medium md:hidden transition-colors ${
                            isCopied() ? "btn-success" : "btn-neutral"
                        }`}
                    >
                        {isCopied() ? "完了" : "コピー"}
                    </button>
                </div>

                {/* 値エリア：スマホでも幅いっぱいに折り返して見切れない */}
                <div
                    class={`flex-1 break-all whitespace-normal text-sm sm:text-base text-base-content md:px-4 ${
                        options?.isMono ? "font-mono" : ""
                    } ${
                        options?.isPrimary
                            ? "font-bold text-base sm:text-lg text-primary"
                            : "font-semibold"
                    }`}
                >
                    {val}
                </div>

                {/* PC用コピーボタン */}
                <div class="hidden md:flex shrink-0">
                    <button
                        disabled={options?.disabled || isValEmpty}
                        onClick={() => copyRow(val, copyKey)}
                        class={`btn btn-xs h-7 px-3 rounded-lg text-white font-medium transition-colors ${
                            isCopied() ? "btn-success" : "btn-neutral"
                        }`}
                    >
                        {isCopied() ? "完了" : "コピー"}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div ref={containerRef} class="h-full w-full p-3 sm:p-6 flex flex-col gap-4 sm:gap-6">
            <div class="card bg-base-100 shadow-xl p-4 sm:p-8 w-full border border-base-300">
                <Show when={!hasFetched() && !loading()}>
                    <div class="flex flex-col items-center justify-center py-12 sm:py-16 gap-4 text-center">
                        <BudouX
                            as="p"
                            class="text-base-content/70 font-medium text-sm sm:text-lg"
                            text="ボタンを押すと、現在のネットワークや端末環境を解析します。"
                        />
                        <button
                            onClick={(e) => {
                                animatePop(e.currentTarget, 0.95, 0.15);
                                fetchAccessInfo();
                            }}
                            class="btn btn-primary text-white text-base sm:text-xl h-12 sm:h-16 px-8 sm:px-12 rounded-xl sm:rounded-2xl shadow-lg transition-all hover:scale-105"
                        >
                            アクセス情報を取得する
                        </button>
                    </div>
                </Show>

                <Show when={loading()}>
                    <div class="flex flex-col items-center justify-center py-12 gap-4">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                        <p class="text-base-content/70 font-medium text-sm sm:text-base">
                            情報を解析中...
                        </p>
                    </div>
                </Show>

                <Show when={error() && !loading()}>
                    <div class="alert alert-error text-white font-bold mb-6 shadow-md rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div class="flex items-center gap-2 text-sm sm:text-base">
                            <span>⚠️</span>
                            <span>{error()}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                animatePop(e.currentTarget, 0.95, 0.15);
                                fetchAccessInfo();
                            }}
                            class="btn btn-sm bg-base-100 text-error border-none hover:bg-base-200 flex-shrink-0"
                        >
                            もう一度試す
                        </button>
                    </div>
                </Show>

                <Show when={info() && !loading()}>
                    <div ref={(el) => animateFadeIn(el)} class="w-full flex flex-col gap-6 sm:gap-8">
                        {/* 接続環境・位置情報 */}
                        <div>
                            <h3 class="text-lg sm:text-xl font-bold mb-3 text-primary flex items-center gap-2">
                                <span>🌐</span> 接続環境・位置情報
                            </h3>
                            <div class="border border-base-300 rounded-2xl bg-base-100 overflow-hidden divide-y divide-base-200 shadow-xs">
                                {renderRow("IPアドレス", info()?.ip, "ip", {
                                    isMono: true,
                                    isPrimary: true,
                                })}
                                {renderRow("プロバイダ (ISP)", info()?.org, "org")}
                                {renderRow(
                                    "国 / 地域",
                                    `${info()?.country_name} (${info()?.country_code})`,
                                    "country",
                                )}
                                {renderRow(
                                    "都道府県 / 都市",
                                    `${info()?.region} / ${info()?.city}`,
                                    "region",
                                )}
                                {renderRow("郵便番号", info()?.postal, "postal", {
                                    isMono: true,
                                    disabled: !info()?.postal || info()?.postal === "---",
                                })}
                                {renderRow(
                                    "緯度 / 経度 (推定)",
                                    `${info()?.latitude} , ${info()?.longitude}`,
                                    "latlng",
                                    { isMono: true },
                                )}
                            </div>
                        </div>

                        {/* 端末・ブラウザ環境 */}
                        <div>
                            <h3 class="text-lg sm:text-xl font-bold mb-3 text-secondary flex items-center gap-2">
                                <span>💻</span> 端末・ブラウザ環境
                            </h3>
                            <div class="border border-base-300 rounded-2xl bg-base-100 overflow-hidden divide-y divide-base-200 shadow-xs">
                                {renderRow("物理解像度", physicScreenSize(), "physic", {
                                    isMono: true,
                                })}
                                {renderRow("論理解像度", screenSize(), "logic", {
                                    isMono: true,
                                })}
                                {renderRow("回線種別", networkType(), "net")}
                                {renderRow("ユーザーエージェント", userAgent(), "ua", {
                                    isMono: true,
                                })}
                                {renderRow("バッテリー残量", batteryLevel(), "bat")}
                            </div>
                        </div>

                        {/* 全体コピーボタン */}
                        <div class="flex justify-end w-full pt-2">
                            <button
                                onClick={copyAllToClipboard}
                                class={`btn text-white w-full sm:w-auto h-11 sm:h-12 px-6 text-sm sm:text-base rounded-xl shadow-sm transition-all ${
                                    allCopied() ? "btn-success" : "btn-neutral"
                                }`}
                            >
                                {allCopied()
                                    ? "すべてコピー完了！"
                                    : "すべての情報をコピー"}
                            </button>
                        </div>
                    </div>
                </Show>
            </div>
            <AdSense />
            <AdSense />
        </div>
    );
}
