// src/utils/exposureCalculator.ts

/**
 * 標準の絞り値（1/3段刻み）
 */
export const STANDARD_APERTURES = [
    1.0, 1.1, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.5, 2.8, 3.2, 3.5, 4.0, 4.5, 5.0,
    5.6, 6.3, 7.1, 8.0, 9.0, 10, 11, 13, 14, 16, 18, 20, 22, 25, 29, 32, 36,
    40, 45, 64,
] as const;

/**
 * 標準のISO感度（1/3段刻み）
 */
export const STANDARD_ISOS = [
    50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250,
    1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000,
    25600, 32000, 40000, 51200, 102400,
] as const;

export interface ShutterSpeedEntry {
    value: number; // 秒数
    label: string;
}

/**
 * 標準シャッタースピード（1/3段刻み＋代表的長秒露光）
 */
export const STANDARD_SHUTTER_SPEEDS: ShutterSpeedEntry[] = [
    { value: 1 / 8000, label: "1/8000s" },
    { value: 1 / 6400, label: "1/6400s" },
    { value: 1 / 5000, label: "1/5000s" },
    { value: 1 / 4000, label: "1/4000s" },
    { value: 1 / 3200, label: "1/3200s" },
    { value: 1 / 2500, label: "1/2500s" },
    { value: 1 / 2000, label: "1/2000s" },
    { value: 1 / 1600, label: "1/1600s" },
    { value: 1 / 1250, label: "1/1250s" },
    { value: 1 / 1000, label: "1/1000s" },
    { value: 1 / 800, label: "1/800s" },
    { value: 1 / 640, label: "1/640s" },
    { value: 1 / 500, label: "1/500s" },
    { value: 1 / 400, label: "1/400s" },
    { value: 1 / 320, label: "1/320s" },
    { value: 1 / 250, label: "1/250s" },
    { value: 1 / 200, label: "1/200s" },
    { value: 1 / 160, label: "1/160s" },
    { value: 1 / 125, label: "1/125s" },
    { value: 1 / 100, label: "1/100s" },
    { value: 1 / 80, label: "1/80s" },
    { value: 1 / 60, label: "1/60s" },
    { value: 1 / 50, label: "1/50s" },
    { value: 1 / 40, label: "1/40s" },
    { value: 1 / 30, label: "1/30s" },
    { value: 1 / 25, label: "1/25s" },
    { value: 1 / 20, label: "1/20s" },
    { value: 1 / 15, label: "1/15s" },
    { value: 1 / 13, label: "1/13s" },
    { value: 1 / 10, label: "1/10s" },
    { value: 1 / 8, label: "1/8s" },
    { value: 1 / 6, label: "1/6s" },
    { value: 1 / 5, label: "1/5s" },
    { value: 1 / 4, label: "1/4s" },
    { value: 0.3, label: "0.3s" },
    { value: 0.4, label: "0.4s" },
    { value: 0.5, label: "0.5s" },
    { value: 0.6, label: "0.6s" },
    { value: 0.8, label: "0.8s" },
    { value: 1.0, label: "1s" },
    { value: 1.3, label: "1.3s" },
    { value: 1.6, label: "1.6s" },
    { value: 2.0, label: "2s" },
    { value: 2.5, label: "2.5s" },
    { value: 3.2, label: "3.2s" },
    { value: 4.0, label: "4s" },
    { value: 5.0, label: "5s" },
    { value: 6.0, label: "6s" },
    { value: 8.0, label: "8s" },
    { value: 10.0, label: "10s" },
    { value: 13.0, label: "13s" },
    { value: 15.0, label: "15s" },
    { value: 20.0, label: "20s" },
    { value: 25.0, label: "25s" },
    { value: 30.0, label: "30s" },
    { value: 45.0, label: "45s" },
    { value: 60.0, label: "60s (1分)" },
    { value: 90.0, label: "90s (1分30秒)" },
    { value: 120.0, label: "120s (2分)" },
    { value: 180.0, label: "180s (3分)" },
    { value: 240.0, label: "240s (4分)" },
    { value: 300.0, label: "300s (5分)" },
    { value: 600.0, label: "600s (10分)" },
];

export interface NdFilterPreset {
    id: string;
    name: string;
    stops: number;
    factor: number;
}

export const ND_FILTER_PRESETS: NdFilterPreset[] = [
    { id: "none", name: "フィルターなし (0段)", stops: 0, factor: 1 },
    { id: "nd2", name: "ND2 (1段減光 / 50%)", stops: 1, factor: 2 },
    { id: "nd4", name: "ND4 (2段減光 / 25%)", stops: 2, factor: 4 },
    { id: "nd8", name: "ND8 (3段減光 / 12.5%)", stops: 3, factor: 8 },
    { id: "nd16", name: "ND16 (4段減光 / 6.25%)", stops: 4, factor: 16 },
    { id: "nd32", name: "ND32 (5段減光 / 3.125%)", stops: 5, factor: 32 },
    { id: "nd64", name: "ND64 (6段減光 / 水流・波の描写)", stops: 6, factor: 64 },
    { id: "nd128", name: "ND128 (7段減光)", stops: 7, factor: 128 },
    { id: "nd256", name: "ND256 (8段減光)", stops: 8, factor: 256 },
    { id: "nd500", name: "ND500 (約9段減光)", stops: 8.966, factor: 500 },
    { id: "nd1000", name: "ND1000 (10段減光 / 昼間の長秒露光)", stops: 10, factor: 1024 },
    { id: "nd2000", name: "ND2000 (11段減光)", stops: 11, factor: 2048 },
    { id: "nd4000", name: "ND4000 (12段減光)", stops: 12, factor: 4096 },
    { id: "nd8000", name: "ND8000 (13段減光)", stops: 13, factor: 8192 },
    { id: "nd16000", name: "ND16000 (14段減光)", stops: 14, factor: 16384 },
    { id: "nd32000", name: "ND32000 (15段減光 / 雲の流動・人消し)", stops: 15, factor: 32768 },
    { id: "nd64000", name: "ND64000 (16段減光)", stops: 16, factor: 65536 },
    { id: "nd100000", name: "ND100000 (16.6段減光 / 日食・超高輝度)", stops: 16.61, factor: 100000 },
    { id: "custom", name: "カスタム指定（段数を自由入力）", stops: 0, factor: 1 },
];

export interface ScenePreset {
    id: string;
    title: string;
    ev100: number;
    description: string;
}

export const SCENE_PRESETS: ScenePreset[] = [
    {
        id: "snow-beach",
        title: "快晴の雪山・夏の砂浜",
        ev100: 16,
        description: "直射日光が強く白い砂や雪で強い反射がある極めて明るい環境",
    },
    {
        id: "sunny-16",
        title: "快晴の日中 (Sunny 16)",
        ev100: 15,
        description: "直射日光の下、くっきりとした影ができる標準的な晴天",
    },
    {
        id: "hazy-sun",
        title: "晴天・薄曇り・日陰",
        ev100: 14,
        description: "柔らかな影ができる薄曇りや、晴れた日の明るい日陰",
    },
    {
        id: "cloudy-overcast",
        title: "曇天・日没前の夕景",
        ev100: 12,
        description: "空全体が雲に覆われた昼間や、日没直前の屋外",
    },
    {
        id: "sunset-dusk",
        title: "日没直後・マジックアワー",
        ev100: 10,
        description: "夕暮れのグラデーションや、十分な明るさがある都市風景",
    },
    {
        id: "bright-indoor",
        title: "明るい商業施設・店舗内",
        ev100: 8,
        description: "十分な照明があるオフィス、ギャラリー、ショーウィンドウ",
    },
    {
        id: "home-indoor",
        title: "一般的な家庭の室内照明",
        ev100: 6,
        description: "夜間のリビングや一般的な暖色・蛍光灯の室内照明",
    },
    {
        id: "night-cityscape",
        title: "夜景・ライトアップ・街灯",
        ev100: 4,
        description: "ライトアップされた建築物、街灯のある夜道、繁華街の夜景",
    },
    {
        id: "full-moon",
        title: "満月の月明かり・遠景夜景",
        ev100: 0,
        description: "月明かりに照らされた風景や、街明かりの少ない夜間",
    },
    {
        id: "milky-way",
        title: "天の川・星空・オーロラ",
        ev100: -4,
        description: "街明かりのない新月の夜空、星景写真、天体撮影",
    },
];

export interface SensorPreset {
    id: string;
    name: string;
    cropFactor: number;
    defaultPixelPitchUm: number;
}

export const SENSOR_PRESETS: SensorPreset[] = [
    {
        id: "fullframe",
        name: "フルサイズ (35mm基準 1.0x)",
        cropFactor: 1.0,
        defaultPixelPitchUm: 5.9,
    },
    {
        id: "apsc-sony",
        name: "APS-C (Sony / Nikon / Fujifilm 1.5x)",
        cropFactor: 1.5,
        defaultPixelPitchUm: 3.9,
    },
    {
        id: "apsc-canon",
        name: "APS-C (Canon 1.6x)",
        cropFactor: 1.6,
        defaultPixelPitchUm: 3.7,
    },
    {
        id: "m43",
        name: "マイクロフォーサーズ (2.0x)",
        cropFactor: 2.0,
        defaultPixelPitchUm: 3.3,
    },
    {
        id: "medium-gfx",
        name: "中判 (Fujifilm GFX / 0.79x)",
        cropFactor: 0.79,
        defaultPixelPitchUm: 5.3,
    },
    {
        id: "custom",
        name: "カスタム（センサー係数を手動設定）",
        cropFactor: 1.0,
        defaultPixelPitchUm: 5.0,
    },
];

/**
 * 露出値 (EV100) を計算
 * EV100 = log2(N^2 / t) - log2(S / 100) + ndStops
 */
export function calculateEv100(
    aperture: number,
    shutterSpeedSeconds: number,
    iso: number,
    ndStops = 0,
): number {
    if (
        !Number.isFinite(aperture) ||
        !Number.isFinite(shutterSpeedSeconds) ||
        !Number.isFinite(iso) ||
        aperture <= 0 ||
        shutterSpeedSeconds <= 0 ||
        iso <= 0
    ) {
        return 0;
    }
    const cleanNd = Number.isFinite(ndStops) ? ndStops : 0;
    const evS = Math.log2((aperture * aperture) / shutterSpeedSeconds);
    const ev100 = evS - Math.log2(iso / 100) + cleanNd;
    return Math.round(ev100 * 100) / 100;
}

/**
 * 適正シャッタースピード（秒数）を計算
 * t = (N^2 * 100) / (S * 2^(targetEv - ndStops))
 */
export function calculateShutterSpeed(
    targetEv: number,
    aperture: number,
    iso: number,
    ndStops = 0,
): number {
    if (
        !Number.isFinite(targetEv) ||
        !Number.isFinite(aperture) ||
        !Number.isFinite(iso) ||
        aperture <= 0 ||
        iso <= 0
    ) {
        return 1 / 125;
    }
    const cleanNd = Number.isFinite(ndStops) ? ndStops : 0;
    const effectiveEv = targetEv - cleanNd;
    const denom = (iso / 100) * Math.pow(2, effectiveEv);
    if (denom <= 0 || !Number.isFinite(denom)) return 1 / 125;
    const t = (aperture * aperture) / denom;
    return Math.max(1 / 16000, Math.min(86400, t));
}

/**
 * 適正絞り値（F値）を計算
 * N = sqrt(t * (S / 100) * 2^(targetEv - ndStops))
 */
export function calculateAperture(
    targetEv: number,
    shutterSpeedSeconds: number,
    iso: number,
    ndStops = 0,
): number {
    if (
        !Number.isFinite(targetEv) ||
        !Number.isFinite(shutterSpeedSeconds) ||
        !Number.isFinite(iso) ||
        shutterSpeedSeconds <= 0 ||
        iso <= 0
    ) {
        return 2.8;
    }
    const cleanNd = Number.isFinite(ndStops) ? ndStops : 0;
    const effectiveEv = targetEv - cleanNd;
    const nSquared =
        shutterSpeedSeconds * (iso / 100) * Math.pow(2, effectiveEv);
    if (nSquared <= 0 || !Number.isFinite(nSquared)) return 1.0;
    const n = Math.sqrt(nSquared);
    return Math.max(0.7, Math.min(64, Math.round(n * 100) / 100));
}

/**
 * 適正ISO感度を計算
 * S = 100 * (N^2) / (t * 2^(targetEv - ndStops))
 */
export function calculateIso(
    targetEv: number,
    aperture: number,
    shutterSpeedSeconds: number,
    ndStops = 0,
): number {
    if (
        !Number.isFinite(targetEv) ||
        !Number.isFinite(aperture) ||
        !Number.isFinite(shutterSpeedSeconds) ||
        aperture <= 0 ||
        shutterSpeedSeconds <= 0
    ) {
        return 100;
    }
    const cleanNd = Number.isFinite(ndStops) ? ndStops : 0;
    const effectiveEv = targetEv - cleanNd;
    const denom = shutterSpeedSeconds * Math.pow(2, effectiveEv);
    if (denom <= 0 || !Number.isFinite(denom)) return 100;
    const s = 100 * ((aperture * aperture) / denom);
    return Math.max(12, Math.min(1024000, Math.round(s)));
}

/**
 * 最も近い標準ステップ値を探すヘルパー関数
 */
export function findClosestStandardValue<T>(
    val: number,
    list: readonly T[],
    getValue: (item: T) => number,
): T {
    if (!list || list.length === 0) throw new Error("List cannot be empty");
    if (!Number.isFinite(val)) return list[0];

    let closest = list[0];
    let minDiff = Math.abs(getValue(closest) - val);

    for (let i = 1; i < list.length; i++) {
        const item = list[i];
        const itemVal = getValue(item);
        const diff = Math.abs(itemVal - val);
        if (diff < minDiff) {
            minDiff = diff;
            closest = item;
        }
    }
    return closest;
}

/**
 * NDフィルターによる長秒露光時間を計算
 * newTime = baseTime * 2^ndStops
 */
export function calculateNdExposure(
    baseShutterSpeedSeconds: number,
    ndStops: number,
): number {
    if (
        !Number.isFinite(baseShutterSpeedSeconds) ||
        baseShutterSpeedSeconds <= 0
    ) {
        return 0;
    }
    const cleanStops =
        Number.isFinite(ndStops) && ndStops >= 0 ? ndStops : 0;
    const factor = Math.pow(2, cleanStops);
    return baseShutterSpeedSeconds * factor;
}

/**
 * 時間（秒）をカメラマンが直感的に理解できるフォーマットに変換
 * - 1秒未満: 1/8000s, 1/250s, 0.5s など
 * - 1秒以上60秒未満: 15s (15秒)
 * - 60秒以上: 2分15秒 (135s)
 */
export function formatShutterSpeed(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0s";

    // 1秒未満で分数表現に適している場合
    if (seconds < 0.25) {
        const denom = Math.round(1 / seconds);
        return `1/${denom}秒`;
    }
    if (seconds < 1) {
        return `${seconds.toFixed(1)}秒`;
    }
    if (seconds < 60) {
        const rounded = Math.round(seconds * 10) / 10;
        return Number.isInteger(rounded)
            ? `${rounded}秒`
            : `${rounded.toFixed(1)}秒`;
    }

    const totalSeconds = Math.round(seconds);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const parts: string[] = [];
    if (hrs > 0) parts.push(`${hrs}時間`);
    if (mins > 0) parts.push(`${mins}分`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

    return `${parts.join(" ")} (${totalSeconds}秒)`;
}

/**
 * 星景写真の星が流れない限界露光時間を計算 (500ルール & NPFルール)
 * 500ルール: t = 500 / (f * cropFactor)
 * NPFルール: t = (35 * N + 30 * p) / f (f: 焦点距離mm, N: 絞り, p: センサーピッチμm)
 */
export function calculateAstroShutterLimit(
    focalLengthMm: number,
    cropFactor: number,
    aperture = 2.8,
    pixelPitchUm = 4.0,
): { rule500: number; npfRule: number } {
    if (
        !Number.isFinite(focalLengthMm) ||
        !Number.isFinite(cropFactor) ||
        focalLengthMm <= 0 ||
        cropFactor <= 0
    ) {
        return { rule500: 0, npfRule: 0 };
    }

    const effective35mmFocal = focalLengthMm * cropFactor;
    const rule500 = Math.max(0.1, 500 / effective35mmFocal);

    const safeN = Number.isFinite(aperture) && aperture > 0 ? aperture : 2.8;
    const safeP =
        Number.isFinite(pixelPitchUm) && pixelPitchUm > 0 ? pixelPitchUm : 4.0;

    // NPF簡易式: (35 * N + 30 * p) / f
    const npfRule = Math.max(
        0.1,
        (35 * safeN + 30 * safeP) / focalLengthMm,
    );

    return {
        rule500: Math.round(rule500 * 10) / 10,
        npfRule: Math.round(npfRule * 10) / 10,
    };
}

export type MeteringMode = "spot" | "center" | "matrix";

/**
 * ImageData から指定された測光方式（スポット/中央重点/平均）で平均輝度(0〜255)を計算
 */
export function calculateLuminanceFromImageData(
    imageData: ImageData,
    mode: MeteringMode = "center",
): number {
    const { width, height, data } = imageData;
    if (width <= 0 || height <= 0 || !data || data.length === 0) return 120;

    const centerX = width / 2;
    const centerY = height / 2;
    const spotRadiusX = width * 0.12;
    const spotRadiusY = height * 0.12;
    const centerRadiusX = width * 0.35;
    const centerRadiusY = height * 0.35;

    let totalWeightedLum = 0;
    let totalWeight = 0;

    // パフォーマンスのため適宜間引きサンプリング (縦横2pxステップ)
    const step = Math.max(1, Math.floor(Math.min(width, height) / 120));

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // ITU-R BT.709 相対輝度
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            let weight = 1.0;
            const dx = Math.abs(x - centerX);
            const dy = Math.abs(y - centerY);

            if (mode === "spot") {
                // スポット: 中央スポット枠外は重み0
                if (dx <= spotRadiusX && dy <= spotRadiusY) {
                    weight = 1.0;
                } else {
                    weight = 0;
                }
            } else if (mode === "center") {
                // 中央重点: 中央部に3倍のウェイト
                if (dx <= centerRadiusX && dy <= centerRadiusY) {
                    weight = 3.0;
                } else {
                    weight = 1.0;
                }
            } else {
                // 画面全体平均 (matrix)
                weight = 1.0;
            }

            if (weight > 0) {
                totalWeightedLum += lum * weight;
                totalWeight += weight;
            }
        }
    }

    if (totalWeight <= 0) return 120;
    return totalWeightedLum / totalWeight;
}

/**
 * 測定された輝度とカメラ自動露出特性から EV100 を推定
 * targetLum = 120 (標準18%グレー付近)
 */
export function estimateEvFromLuminance(
    measuredLum: number,
    baseEv = 10,
    calibrationOffset = 0,
): { ev: number; offsetEv: number; lux: number } {
    const safeLum = Number.isFinite(measuredLum) && measuredLum > 0
        ? Math.max(1, Math.min(255, measuredLum))
        : 120;
    const targetLum = 120;

    // 輝度比率からの露出ズレ段数 (EV offset)
    const offsetEv = Math.log2(safeLum / targetLum);

    // 有効EV = 基準EV + オフセット + ユーザーキャリブレーション
    const rawEv = baseEv + offsetEv + (Number.isFinite(calibrationOffset) ? calibrationOffset : 0);
    const ev = Math.round(Math.max(-8, Math.min(22, rawEv)) * 10) / 10;

    // 照度 (Lux) の概算: Lux ≈ 2.5 * 2^EV
    const lux = Math.round(2.5 * Math.pow(2, ev));

    return {
        ev,
        offsetEv: Math.round(offsetEv * 10) / 10,
        lux: Math.max(0, lux),
    };
}

/**
 * カメラの MediaTrackSettings から実際の露光時間・ISO・F値が得られる場合に厳密な EV100 を計算
 * ※ W3C MediaStream Image Capture 仕様において、exposureTime は 100μs (0.1ms = 1/10,000秒) 単位で返されます。
 * ブラウザや端末実装によって秒単位(0.033)や100μs単位(333)が返る場合に対応して秒数に正規化します。
 */
export function calculateEvFromCameraSettings(
    rawExposureTime?: number,
    iso?: number,
    fNumber?: number,
): number | null {
    if (
        typeof rawExposureTime === "number" &&
        typeof iso === "number" &&
        Number.isFinite(rawExposureTime) &&
        Number.isFinite(iso) &&
        rawExposureTime > 0 &&
        iso > 0
    ) {
        let seconds = rawExposureTime;
        // W3C Image Capture 仕様: 100 microseconds (0.1ms = 1/10,000s)
        // 例: 333 (約1/30秒) => 333 / 10000 = 0.0333秒
        // 例: 10 (1/1000秒) => 10 / 10000 = 0.001秒
        // 例: 10000 (1秒) => 10000 / 10000 = 1.0秒
        if (rawExposureTime >= 1) {
            seconds = rawExposureTime / 10000;
        }

        const fn =
            typeof fNumber === "number" && Number.isFinite(fNumber) && fNumber > 0
                ? fNumber
                : 1.8; // スマートフォンの標準的な単焦点開放F値目安

        return calculateEv100(fn, seconds, iso);
    }
    return null;
}

