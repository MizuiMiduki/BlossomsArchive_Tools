import { createSignal, Show, onSettled } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { delayedCall, playPageEntrance, animatePop } from "../utils/animations";

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
    const [networkType, setNetworkType] = createSignal("");
    const [batteryLevel, setBatteryLevel] = createSignal("");

    let containerRef: HTMLDivElement | undefined;

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef);
    });

    const fetchAccessInfo = async () => {
        if (loading()) return;
        setLoading(true);
        setError("");
        setInfo(null);
        setHasFetched(true);

        try {
            setUserAgent(navigator.userAgent || "不明");
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
            <div
                class="ba-flex ba-flex-wrap ba-items-center ba-justify-between ba-gap-2"
                style={{
                    padding: "0.875rem 1rem",
                    "border-bottom": "1px solid var(--ba-border)",
                }}
            >
                {/* ラベル + モバイル用コピーボタン (横並び) */}
                <div
                    class="ba-flex ba-items-center ba-justify-between ba-shrink-0"
                    style={{ "min-width": "13rem", flex: "0 1 14rem" }}
                >
                    <span class="ba-font-bold ba-text-sm ba-text-muted">
                        {label}
                    </span>
                    <button
                        disabled={options?.disabled || isValEmpty}
                        onClick={() => copyRow(val, copyKey)}
                        aria-label={`${label}をコピー`}
                        class={`ba-btn ba-btn--xs ba-hidden-desktop ${
                            isCopied() ? "ba-btn--success" : "ba-btn--secondary"
                        }`}
                    >
                        {isCopied() ? "完了" : "コピー"}
                    </button>
                </div>

                {/* 値エリア：スマホでも幅いっぱいに折り返して見切れない */}
                <div
                    class={`ba-flex-1 ba-break-all ba-text-sm ${
                        options?.isMono ? "ba-mono" : ""
                    } ${
                        options?.isPrimary
                            ? "ba-font-bold ba-text-base ba-text-primary"
                            : "ba-font-bold"
                    }`}
                    style={{ "min-width": "12rem" }}
                >
                    {val}
                </div>

                {/* PC用コピーボタン */}
                <div class="ba-only-desktop ba-shrink-0">
                    <button
                        disabled={options?.disabled || isValEmpty}
                        onClick={() => copyRow(val, copyKey)}
                        aria-label={`${label}をコピー`}
                        class={`ba-btn ba-btn--xs ${
                            isCopied() ? "ba-btn--success" : "ba-btn--secondary"
                        }`}
                    >
                        {isCopied() ? "完了" : "コピー"}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div ref={containerRef} class="ba-page">
            <h1 class="ba-sr-only">アクセス環境解析ツール</h1>
            <div class="ba-card">
                <Show when={!hasFetched() && !loading()}>
                    <div
                        class="ba-flex-col ba-items-center ba-justify-center ba-gap-4 ba-text-center"
                        style={{ "padding-block": "3.5rem" }}
                    >
                        <BudouX
                            as="p"
                            class="ba-text-muted ba-text-base"
                            style={{ "font-weight": 500, margin: 0 }}
                            text="ボタンを押すと、現在のネットワークや端末環境を解析します。"
                        />
                        <button
                            onClick={(e) => {
                                animatePop(e.currentTarget, 0.95, 0.15);
                                fetchAccessInfo();
                            }}
                            class="ba-btn ba-btn--primary ba-btn--lg"
                            style={{
                                padding: "0.9rem 2.25rem",
                                "font-size": "1.0625rem",
                                "border-radius": "var(--ba-radius-lg)",
                                "box-shadow": "var(--ba-shadow-md)",
                            }}
                        >
                            アクセス情報を取得する
                        </button>
                    </div>
                </Show>

                <Show when={loading()}>
                    <div
                        class="ba-flex-col ba-items-center ba-justify-center ba-gap-4"
                        style={{ "padding-block": "3rem" }}
                    >
                        <span
                            class="ba-spinner ba-text-primary"
                            style={{ width: "2rem", height: "2rem", "border-width": "3px" }}
                        ></span>
                        <p class="ba-text-muted ba-text-sm" style={{ "font-weight": 500, margin: 0 }}>
                            情報を解析中...
                        </p>
                    </div>
                </Show>

                <Show when={error() && !loading()}>
                    <div
                        class="ba-alert ba-alert--error ba-flex-wrap ba-justify-between"
                        style={{ "margin-bottom": "1.5rem" }}
                    >
                        <div class="ba-flex ba-items-center ba-gap-2 ba-text-sm">
                            <ToolIcon name="alert" class="ba-icon-md ba-shrink-0" />
                            <span>{error()}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                animatePop(e.currentTarget, 0.95, 0.15);
                                fetchAccessInfo();
                            }}
                            class="ba-btn ba-btn--sm ba-shrink-0"
                            style={{ color: "var(--ba-danger)" }}
                        >
                            もう一度試す
                        </button>
                    </div>
                </Show>

                <Show when={info() && !loading()}>
                    <div class="ba-w-full ba-stack-6">
                        {/* 接続環境・位置情報 */}
                        <div class="ba-stack-3">
                            <h2 class="ba-section-title">
                                接続環境・位置情報
                            </h2>
                            <div
                                style={{
                                    border: "1px solid var(--ba-border)",
                                    "border-radius": "var(--ba-radius-lg)",
                                    "background-color": "var(--ba-surface)",
                                    overflow: "hidden",
                                    "box-shadow": "var(--ba-shadow-xs)",
                                }}
                            >
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
                        <div class="ba-stack-3">
                            <h2 class="ba-section-title">
                                端末・ブラウザ環境
                            </h2>
                            <div
                                style={{
                                    border: "1px solid var(--ba-border)",
                                    "border-radius": "var(--ba-radius-lg)",
                                    "background-color": "var(--ba-surface)",
                                    overflow: "hidden",
                                    "box-shadow": "var(--ba-shadow-xs)",
                                }}
                            >
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
                        <div class="ba-flex ba-justify-end ba-w-full" style={{ "padding-top": "0.5rem" }}>
                            <button
                                onClick={copyAllToClipboard}
                                class={`ba-btn ba-btn--lg ${
                                    allCopied() ? "ba-btn--success" : "ba-btn--secondary"
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
