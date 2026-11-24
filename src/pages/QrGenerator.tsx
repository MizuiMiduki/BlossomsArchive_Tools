import { createSignal, onSettled, Show, For } from "solid-js";
import AdSense from "../components/AdSense";
import BudouX from "../components/BudouX";
import ToolIcon from "../components/ToolIcon";
import { animatePop, delayedCall, playPageEntrance } from "../utils/animations";

// ボタンオプション用の型を定義して TypeScript に型を教えます
interface FormatOption {
    value: string;
    label: string;
    desc: string;
}

export default function QrGenerator() {
    const [mode, setMode] = createSignal<"text" | "wifi">("text");
    const [text, setText] = createSignal("");
    const [wifiSsid, setWifiSsid] = createSignal("");
    const [wifiPassword, setWifiPassword] = createSignal("");
    const [wifiAuth, setWifiAuth] = createSignal<"WPA" | "WEP" | "nopass">("WPA");
    const [wifiHidden, setWifiHidden] = createSignal(false);
    const [showPassword, setShowPassword] = createSignal(false);

    const [qrData, setQrData] = createSignal("");
    const [isLarge, setIsLarge] = createSignal(false);
    const [fileFormat, setFileFormat] = createSignal("png");

    let containerRef: HTMLDivElement | undefined;
    let generateButtonRef: HTMLButtonElement | undefined;

    const escapeWifiStr = (str: string) => {
        return str.replace(/([\\;,":])/g, "\\$1");
    };

    const getPayload = () => {
        if (mode() === "wifi") {
            const ssid = escapeWifiStr(wifiSsid());
            const pass = escapeWifiStr(wifiPassword());
            const auth = wifiAuth();
            const hidden = wifiHidden() ? "true" : "false";
            return `WIFI:S:${ssid};T:${auth};P:${pass};H:${hidden};;`;
        }
        return text();
    };

    const isPayloadValid = () => {
        if (mode() === "wifi") {
            return wifiSsid().trim().length > 0;
        }
        return text().trim().length > 0;
    };

    onSettled(() => {
        if (containerRef) playPageEntrance(containerRef, ".ba-card");
    });

    const getMimeType = (format: string) => {
        switch (format) {
            case "jpeg":
                return "image/jpeg";
            case "webp":
                return "image/webp";
            default:
                return "image/png";
        }
    };

    const generate = async () => {
        const payload = getPayload();
        if (!payload) return;
        if (generateButtonRef) animatePop(generateButtonRef);
        try {
            const { default: QRCode } = await import("qrcode");
            const data = await QRCode.toDataURL(payload, {
                width: 600,
                type: getMimeType(fileFormat()),
            });
            setQrData(data);
        } catch (err) {
            console.error(err);
        }
    };

    const getFormattedDateTime = () => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
    };

    const download = async () => {
        const payload = getPayload();
        if (!qrData() || !payload) return;

        const safePrefix = mode() === "wifi" ? `wifi_${wifiSsid()}` : text();
        const safeInput = safePrefix
            .replace(/[^a-zA-Z0-9ぁ-んァ-ヶー一-龠_-]/g, "_")
            .substring(0, 20);
        const dateTimeStr = getFormattedDateTime();
        const fileName = `qrcode_${safeInput}_${dateTimeStr}.${fileFormat()}`;

        const link = document.createElement("a");
        link.download = fileName;

        let revokeUrl = "";

        if (fileFormat() === "svg") {
            try {
                const { default: QRCode } = await import("qrcode");
                const svgString = await QRCode.toString(payload, {
                    type: "svg",
                    width: 600,
                });
                const blob = new Blob([svgString], { type: "image/svg+xml" });
                revokeUrl = URL.createObjectURL(blob);
                link.href = revokeUrl;
            } catch (err) {
                console.error(err);
                return;
            }
        } else {
            try {
                const { default: QRCode } = await import("qrcode");
                const data = await QRCode.toDataURL(payload, {
                    width: 600,
                    type: getMimeType(fileFormat()),
                });
                link.href = data;
            } catch (err) {
                console.error(err);
                return;
            }
        }

        link.click();
        if (revokeUrl) {
            const urlToRevoke = revokeUrl;
            delayedCall(1, () => URL.revokeObjectURL(urlToRevoke));
        }
    };

    // ループ用のボタン形式リストに型アサーションを適用するため定数化します
    const formatOptions: FormatOption[] = [
        { value: "png", label: "PNG", desc: "標準・Web向け" },
        { value: "jpeg", label: "JPEG", desc: "汎用画像" },
        { value: "webp", label: "WebP", desc: "軽量・次世代" },
        { value: "svg", label: "SVG", desc: "ベクター・高品質" },
    ];

    return (
        <div ref={containerRef} class="ba-page ba-page--wide">
            {/* メインツールカード */}
            <div class="ba-card ba-stack-6">
                {/* ヘッダーセクション */}
                <div style={{ "padding-bottom": "1.25rem", "border-bottom": "1px solid var(--ba-border)" }}>
                    <h1 class="ba-title">
                        <BudouX text="QRコード作成・生成ツール" />
                    </h1>
                    <BudouX
                        as="p"
                        class="ba-text-xs ba-text-muted"
                        style={{ "margin-top": "0.5rem", "margin-bottom": 0, "font-weight": 600, "line-height": 1.6 }}
                        text="WebサイトのURLや任意のテキストから、高品質なQRコードをブラウザ内で瞬時に作成します。高解像度PNGに加え、拡大しても画質が荒れないベクター（SVG）出力に対応しています。"
                    />
                </div>

                {/* 2カラムレイアウト */}
                <div class="ba-flex ba-flex-wrap ba-gap-6" style={{ "align-items": "stretch" }}>
                    {/* 左側：設定コントロール */}
                    <div class="ba-flex-col ba-justify-between ba-gap-6 ba-min-w-0" style={{ flex: "7 1 20rem" }}>
                        <div class="ba-stack-6">
                            {/* 種別タブ（テキスト・URL / Wi-Fi） */}
                            <div class="ba-tabs ba-w-full" style={{ display: "grid", "grid-template-columns": "repeat(2, minmax(0, 1fr))" }}>
                                <button
                                    type="button"
                                    class={`ba-tab ${mode() === "text" ? "is-active" : ""}`}
                                    onClick={() => setMode("text")}
                                >
                                    テキスト・URL
                                </button>
                                <button
                                    type="button"
                                    class={`ba-tab ${mode() === "wifi" ? "is-active" : ""}`}
                                    onClick={() => setMode("wifi")}
                                >
                                    Wi-Fi接続設定
                                </button>
                            </div>

                            {/* 1. 文字列入力フォーム or Wi-Fi入力 */}
                            <Show
                                when={mode() === "wifi"}
                                fallback={
                                    <div class="ba-field">
                                        <label class="ba-label">
                                            <span>QRコードに埋め込む文字列・URL</span>
                                        </label>
                                        <textarea
                                            value={text()}
                                            aria-label="QRコードに埋め込む文字列・URL"
                                            onInput={(e) => setText(e.currentTarget.value)}
                                            class="ba-textarea"
                                            style={{ height: "8rem" }}
                                            placeholder="https://example.com または 任意のテキストを入力してください"
                                        />
                                    </div>
                                }
                            >
                                <div class="ba-panel ba-stack-3">
                                    <div class="ba-field">
                                        <label class="ba-label">
                                            <span>ネットワーク名 (SSID) *</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={wifiSsid()}
                                            onInput={(e) => setWifiSsid(e.currentTarget.value)}
                                            class="ba-input ba-input--sm"
                                            placeholder="My-Home-WiFi"
                                            aria-label="SSID (ネットワーク名)"
                                        />
                                    </div>

                                    <div class="ba-grid-2">
                                        <div class="ba-field">
                                            <label class="ba-label">
                                                <span>セキュリティ方式</span>
                                            </label>
                                            <select
                                                value={wifiAuth()}
                                                onChange={(e) => setWifiAuth(e.currentTarget.value as "WPA" | "WEP" | "nopass")}
                                                class="ba-select ba-select--sm"
                                                aria-label="セキュリティ方式"
                                            >
                                                <option value="WPA">WPA / WPA2 / WPA3</option>
                                                <option value="WEP">WEP</option>
                                                <option value="nopass">パスワードなし (オープン)</option>
                                            </select>
                                        </div>

                                        <Show when={wifiAuth() !== "nopass"}>
                                            <div class="ba-field">
                                                <label class="ba-label">
                                                    <span>パスワード</span>
                                                </label>
                                                <div style={{ position: "relative" }}>
                                                    <input
                                                        type={showPassword() ? "text" : "password"}
                                                        value={wifiPassword()}
                                                        onInput={(e) => setWifiPassword(e.currentTarget.value)}
                                                        class="ba-input ba-input--sm"
                                                        style={{ "padding-right": "2.25rem" }}
                                                        placeholder="パスワードを入力"
                                                        aria-label="Wi-Fiパスワード"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword())}
                                                        class="ba-btn ba-btn--ghost ba-btn--xs ba-btn--square"
                                                        style={{ position: "absolute", right: "0.2rem", top: "50%", transform: "translateY(-50%)" }}
                                                        aria-label={showPassword() ? "パスワードを隠す" : "パスワードを表示"}
                                                    >
                                                        <Show
                                                            when={showPassword()}
                                                            fallback={
                                                                <svg xmlns="http://www.w3.org/2000/svg" class="ba-icon-xs" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                            }
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" class="ba-icon-xs" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                            </svg>
                                                        </Show>
                                                    </button>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>

                                    <label class="ba-flex ba-items-center ba-gap-2" style={{ cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={wifiHidden()}
                                            onChange={(e) => setWifiHidden(e.currentTarget.checked)}
                                            class="ba-checkbox"
                                            aria-label="非公開ネットワーク (ステルスSSID)"
                                        />
                                        <span class="ba-text-xs ba-text-muted">
                                            非公開ネットワーク (ステルスSSID)
                                        </span>
                                    </label>
                                </div>
                            </Show>

                            {/* 2. 保存フォーマットの選択 */}
                            <div class="ba-field">
                                <label class="ba-label">
                                    <span>保存形式の選択</span>
                                </label>
                                <div class="ba-grid-4">
                                    <For each={formatOptions}>
                                        {(opt) => (
                                            <button
                                                type="button"
                                                aria-pressed={fileFormat() === opt.value ? "true" : "false"}
                                                onClick={() => setFileFormat(opt.value)}
                                                class={`ba-flex-col ba-items-center ba-justify-center ${fileFormat() === opt.value ? "is-active" : ""}`}
                                                style={{
                                                    padding: "0.75rem",
                                                    "border-radius": "var(--ba-radius)",
                                                    border: fileFormat() === opt.value
                                                        ? "2px solid var(--ba-primary)"
                                                        : "1.5px solid var(--ba-border-strong)",
                                                    "background-color": fileFormat() === opt.value
                                                        ? "var(--ba-primary-soft)"
                                                        : "var(--ba-surface)",
                                                    color: fileFormat() === opt.value
                                                        ? "var(--ba-primary-soft-fg)"
                                                        : "var(--ba-text)",
                                                    cursor: "pointer",
                                                    transition: "all 0.15s ease",
                                                }}
                                            >
                                                <span class="ba-font-black ba-text-sm">{opt.label}</span>
                                                <span class="ba-text-muted" style={{ "font-size": "0.6875rem", "font-weight": 600, "margin-top": "0.15rem" }}>
                                                    {opt.desc}
                                                </span>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </div>

                        {/* 生成ボタン */}
                        <div>
                            <button
                                ref={generateButtonRef}
                                type="button"
                                onClick={generate}
                                disabled={!isPayloadValid()}
                                class="ba-btn ba-btn--primary ba-btn--lg ba-btn--block ba-font-black"
                                style={{ height: "3.75rem", "font-size": "1.05rem" }}
                            >
                                QRコードを作成する
                            </button>
                        </div>
                    </div>

                    {/* 右側：生成プレビュー */}
                    <div
                        class="ba-panel ba-flex-col ba-items-center ba-justify-center ba-min-w-0"
                        style={{ flex: "5 1 16rem", "min-height": "300px", padding: "1.5rem" }}
                    >
                        <Show
                            when={qrData()}
                            fallback={
                                <div class="ba-flex-col ba-items-center ba-text-center ba-gap-2 ba-text-muted" style={{ padding: "2rem" }}>
                                    <ToolIcon name="qr" class="ba-icon-xl" />
                                    <p class="ba-text-xs" style={{ margin: 0, "font-weight": 600, "line-height": 1.6 }}>
                                        文字列を入力して生成ボタンを押すと、
                                        <br />
                                        ここにプレビューが表示されます。
                                    </p>
                                </div>
                            }
                        >
                            <div class="ba-flex-col ba-items-center ba-gap-4 ba-w-full">
                                <div
                                    style={{
                                        "background-color": "#ffffff",
                                        padding: "1rem",
                                        "border-radius": "var(--ba-radius-lg)",
                                        border: "1px solid var(--ba-border)",
                                        "box-shadow": "var(--ba-shadow-sm)",
                                    }}
                                >
                                    <img
                                        src={qrData()}
                                        alt="QRコード プレビュー"
                                        style={{
                                            width: "14rem",
                                            height: "14rem",
                                            "border-radius": "var(--ba-radius-sm)",
                                            cursor: "pointer",
                                        }}
                                        onClick={() => setIsLarge(true)}
                                    />
                                </div>

                                <div class="ba-flex ba-gap-3 ba-w-full" style={{ "max-width": "22rem" }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsLarge(true)}
                                        class="ba-btn ba-btn--outline ba-flex-1"
                                    >
                                        表示拡大
                                    </button>
                                    <button
                                        type="button"
                                        onClick={download}
                                        class="ba-btn ba-btn--primary ba-flex-1 ba-font-black"
                                    >
                                        保存 ({fileFormat().toUpperCase()})
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>
                </div>
            </div>

            {/* お役立ちインフォメーションセクション */}
            <div class="ba-grid-2">
                {/* ツールならではのメリット */}
                <div class="ba-card ba-flex-col ba-justify-between ba-gap-6">
                    <div class="ba-stack-4">
                        <h2
                            class="ba-section-title"
                            style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                        >
                            技術的な特徴と処理方式について
                        </h2>
                        <div class="ba-stack-3 ba-text-xs ba-text-muted" style={{ "line-height": 1.65 }}>
                            <p style={{ margin: 0 }}>
                                本ツールは、入力されたデータを外部のWebサーバーに転送することなく、
                                <strong>お使いの端末（ブラウザ）内部のみでQRコードの画像データへ直接変換</strong>します。
                            </p>
                            <p style={{ margin: 0 }}>
                                そのため、サーバーとの通信ラグが発生せず、常に一瞬で安全に生成が完了します（インターネットを切断したオフライン環境でも動作します）。
                            </p>
                            <p style={{ margin: 0 }}>
                                生成したQRコードは商用・非商用問わず、印刷物やWebサイトなどに無制限かつ無料で永続的にご利用いただけます。
                            </p>
                        </div>
                    </div>
                    <div class="ba-text-xs ba-text-muted" style={{ "padding-top": "1rem", "border-top": "1px solid var(--ba-border)" }}>
                        ※データの取り扱い方針に関する詳細は、当サイトの
                        <a href="/privacy" class="ba-font-bold ba-underline ba-text-primary" style={{ "margin-left": "0.25rem" }}>
                            プライバシーポリシー
                        </a>
                        をご確認ください。
                    </div>
                </div>

                {/* FAQ：アコーディオン */}
                <div class="ba-card ba-stack-4">
                    <h2
                        class="ba-section-title"
                        style={{ "padding-bottom": "0.75rem", "border-bottom": "1px solid var(--ba-border)" }}
                    >
                        技術的な仕様について（FAQ）
                    </h2>

                    <div class="ba-stack-2">
                        <details class="ba-accordion">
                            <summary>Q. 生成したQRコードにアクセス期限や料金は発生しますか？</summary>
                            <div class="ba-accordion-body">
                                いいえ。本ツールで生成するQRコードは、入力された情報がそのまま画像に埋め込まれている「静的なコード」です。当サイトを経由しないため、期限切れや後から課金されるような心配は一切ございません。
                            </div>
                        </details>

                        <details class="ba-accordion">
                            <summary>Q. 印刷・グラフィックデザインに適した形式はどれですか？</summary>
                            <div class="ba-accordion-body">
                                パンフレットや大型ポスター、名刺など印刷用途で使用される場合は、縮小・拡大しても線の輪郭が絶対にぼやけないベクターデータ形式である
                                <strong>「SVG形式」</strong>での保存を強く推奨します。
                            </div>
                        </details>

                        <details class="ba-accordion">
                            <summary>Q. カメラでQRコードが正しく読み取れない場合の対処法は？</summary>
                            <div class="ba-accordion-body">
                                入力したURLや文字列が長すぎる場合、コードのドットパターンが極限まで細密になり、カメラでピントが合わずに認識しづらくなることがあります。その場合は、短縮URLサービスなどを一度経由させてからQRコードを生成することをお試しください。
                            </div>
                        </details>
                    </div>
                </div>
            </div>

            <AdSense />
            <AdSense />

            {/* 拡大表示用モーダル */}
            <Show when={isLarge()}>
                <div
                    class="ba-modal is-open"
                    style={{ cursor: "pointer" }}
                    onClick={() => setIsLarge(false)}
                >
                    <div
                        class="ba-modal-box ba-flex-col ba-items-center ba-gap-4"
                        style={{ width: "auto", "max-width": "90vw" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={qrData()}
                            alt="QRコード 拡大表示"
                            style={{
                                "max-width": "80vw",
                                "max-height": "75vh",
                                "object-fit": "contain",
                                "background-color": "#ffffff",
                                padding: "0.5rem",
                                "border-radius": "var(--ba-radius-sm)",
                            }}
                        />
                        <button
                            type="button"
                            class="ba-btn ba-btn--sm ba-btn--primary"
                            onClick={() => setIsLarge(false)}
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
}
