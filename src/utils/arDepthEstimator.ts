import { normalizeDepthMap } from "./arCameraOverlay";

export interface EstimatedDepthMap {
    data: Float32Array;
    width: number;
    height: number;
    backend: "webgpu" | "wasm";
}

type DepthPipeline = (input: unknown) => Promise<unknown>;

let cachedPipeline: DepthPipeline | null = null;
let cachedBackend: "webgpu" | "wasm" = "wasm";
let loadingPromise: Promise<{ pipe: DepthPipeline; backend: "webgpu" | "wasm" }> | null = null;

async function detectWebGpuSupport(): Promise<boolean> {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        return false;
    }
    try {
        const gpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown | null> } }).gpu;
        const adapter = await gpu?.requestAdapter?.();
        return Boolean(adapter);
    } catch {
        return false;
    }
}

async function getDepthPipeline(
    onStatus?: (message: string) => void,
): Promise<{ pipe: DepthPipeline; backend: "webgpu" | "wasm" }> {
    if (cachedPipeline) {
        return { pipe: cachedPipeline, backend: cachedBackend };
    }
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        onStatus?.("AI奥行きモデルを端末に読み込み中（初回のみダウンロード）...");
        const transformers = await import("@huggingface/transformers");
        const { pipeline, env } = transformers;
        env.allowLocalModels = false;

        const useWebGpu = await detectWebGpuSupport();
        const tryBackends: Array<"webgpu" | "wasm"> = useWebGpu ? ["webgpu", "wasm"] : ["wasm"];

        let lastError: unknown = null;
        for (const backend of tryBackends) {
            try {
                onStatus?.(
                    backend === "webgpu"
                        ? "WebGPU で Depth Anything V2 Small を初期化中..."
                        : "WebAssembly で Depth Anything V2 Small を初期化中...",
                );
                const pipe = (await (pipeline as unknown as (
                    task: string,
                    model: string,
                    opts: Record<string, unknown>,
                ) => Promise<DepthPipeline>)(
                    "depth-estimation",
                    "onnx-community/depth-anything-v2-small",
                    {
                        device: backend,
                        dtype: "q8",
                    },
                ));
                cachedPipeline = pipe;
                cachedBackend = backend;
                return { pipe, backend };
            } catch (err) {
                lastError = err;
            }
        }
        loadingPromise = null;
        throw lastError instanceof Error ? lastError : new Error("AIモデルの初期化に失敗しました");
    })();

    return loadingPromise;
}

/**
 * カメラ映像または背景画像を端末内（WebGPU/WASM）で解析し、
 * 正規化済み深度マップ（0=奥 .. 1=手前）を返す。
 * 推論は100%ブラウザ内で完結し、外部送信・AI学習は一切行われない。
 */
export async function estimateDepthMapFromCanvas(
    sourceCanvas: HTMLCanvasElement,
    onStatus?: (message: string) => void,
): Promise<EstimatedDepthMap> {
    const { RawImage } = await import("@huggingface/transformers");
    const { pipe, backend } = await getDepthPipeline(onStatus);

    onStatus?.(
        backend === "webgpu"
            ? "WebGPUで端末内の奥行きを解析中..."
            : "端末内CPU(WASM)で奥行きを解析中...",
    );

    // Depth Anything V2 のネイティブ解像度(518px)に合わせて高精細に推論
    const maxSide = 518;
    const srcW = Math.max(1, sourceCanvas.width);
    const srcH = Math.max(1, sourceCanvas.height);
    const ratio = Math.min(1, maxSide / Math.max(srcW, srcH));
    const targetW = Math.max(16, Math.round(srcW * ratio));
    const targetH = Math.max(16, Math.round(srcH * ratio));

    const workCanvas = document.createElement("canvas");
    workCanvas.width = targetW;
    workCanvas.height = targetH;
    const wctx = workCanvas.getContext("2d");
    if (!wctx) {
        throw new Error("解析用キャンバスの作成に失敗しました");
    }
    wctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);

    const rawImg = RawImage.fromCanvas(workCanvas);
    const result = (await pipe(rawImg)) as {
        predicted_depth?: { data?: Float32Array | number[]; dims?: number[] };
        depth?: { data?: Uint8Array | Uint8ClampedArray; width?: number; height?: number };
    };

    if (result?.predicted_depth?.data && result.predicted_depth.dims?.length) {
        const dims = result.predicted_depth.dims;
        const h = dims[dims.length - 2] ?? targetH;
        const w = dims[dims.length - 1] ?? targetW;
        return {
            data: normalizeDepthMap(result.predicted_depth.data, w, h),
            width: w,
            height: h,
            backend,
        };
    }

    if (result?.depth?.data) {
        const w = result.depth.width ?? targetW;
        const h = result.depth.height ?? targetH;
        return {
            data: normalizeDepthMap(result.depth.data, w, h),
            width: w,
            height: h,
            backend,
        };
    }

    throw new Error("深度マップの解析結果を取得できませんでした");
}
