export interface VideoMetadata {
    name: string;
    size: number;
    width: number;
    height: number;
    duration: number;
    type: string;
}

export interface CompressPreset {
    id: "balanced" | "aggressive" | "high_quality" | "custom";
    label: string;
    description: string;
    scalePercent: number;
    maxDimension: number;
    videoBitrateKbps: number;
    fps: number;
    includeAudio: boolean;
}

export const COMPRESS_PRESETS: CompressPreset[] = [
    {
        id: "balanced",
        label: "おすすめ（バランス重視）",
        description: "画質を保ちながらファイルサイズを大幅に削減します（720p相当）。",
        scalePercent: 75,
        maxDimension: 1280,
        videoBitrateKbps: 1500,
        fps: 30,
        includeAudio: true,
    },
    {
        id: "aggressive",
        label: "強力圧縮（サイズ最優先）",
        description: "SNS投稿やメール添付向けにサイズを極限まで小さくします（480p相当）。",
        scalePercent: 50,
        maxDimension: 854,
        videoBitrateKbps: 700,
        fps: 24,
        includeAudio: true,
    },
    {
        id: "high_quality",
        label: "高画質（控えめ圧縮）",
        description: "元の解像度を維持しながらデータレートを最適化します（1080p対応）。",
        scalePercent: 100,
        maxDimension: 1920,
        videoBitrateKbps: 3500,
        fps: 30,
        includeAudio: true,
    },
    {
        id: "custom",
        label: "カスタム設定",
        description: "解像度・ビットレート・フレームレートを自由に設定します。",
        scalePercent: 75,
        maxDimension: 1280,
        videoBitrateKbps: 1500,
        fps: 30,
        includeAudio: true,
    },
];

export interface SupportedCodec {
    label: string;
    mimeType: string;
    extension: string;
}

/**
 * バイト数を読みやすい単位（B, KB, MB, GB）に変換
 */
export function formatBytes(bytes: number, decimals = 1): string {
    if (bytes <= 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const normalizedIndex = Math.min(i, sizes.length - 1);
    const value = bytes / Math.pow(k, normalizedIndex);
    return `${value.toFixed(dm)} ${sizes[normalizedIndex]}`;
}

/**
 * 秒数を "MM:SS" または "HH:MM:SS" にフォーマット
 */
export function formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const totalSecs = Math.floor(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");
    if (hrs > 0) {
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
}

/**
 * 目標の解像度（幅と高さ）を計算する（偶数に丸める）
 */
export function calculateTargetDimensions(
    originalWidth: number,
    originalHeight: number,
    scalePercent: number,
    maxDimension?: number,
): { width: number; height: number } {
    if (originalWidth <= 0 || originalHeight <= 0) {
        return { width: 0, height: 0 };
    }

    const scale = Math.max(0.1, Math.min(1.0, scalePercent / 100));
    let targetWidth = originalWidth * scale;
    let targetHeight = originalHeight * scale;

    if (maxDimension && maxDimension > 0) {
        const longestEdge = Math.max(targetWidth, targetHeight);
        if (longestEdge > maxDimension) {
            const aspectScale = maxDimension / longestEdge;
            targetWidth *= aspectScale;
            targetHeight *= aspectScale;
        }
    }

    // 動画エンコーダの多くは偶数の寸法を要求するため、偶数に切り捨て
    const evenWidth = Math.max(2, Math.floor(targetWidth / 2) * 2);
    const evenHeight = Math.max(2, Math.floor(targetHeight / 2) * 2);

    return {
        width: evenWidth,
        height: evenHeight,
    };
}

/**
 * 予想ファイルサイズを計算（バイト）
 */
export function estimateCompressedSize(
    durationSec: number,
    videoBitrateKbps: number,
    audioBitrateKbps = 128,
    includeAudio = true,
): number {
    if (durationSec <= 0 || videoBitrateKbps <= 0) return 0;
    const totalBitrateKbps = videoBitrateKbps + (includeAudio ? audioBitrateKbps : 0);
    // (kbps * 1000 / 8) * durationSec
    return Math.floor((totalBitrateKbps * 1000 * durationSec) / 8);
}

/**
 * 削減率（%）を計算
 */
export function calculateReductionPercent(originalSize: number, compressedSize: number): number {
    if (originalSize <= 0 || compressedSize <= 0) return 0;
    const diff = originalSize - compressedSize;
    const percent = (diff / originalSize) * 100;
    return Math.round(percent * 10) / 10;
}

/**
 * ブラウザがサポートしている動画コーデックの一覧を取得
 */
export function getSupportedVideoCodecs(): SupportedCodec[] {
    if (typeof MediaRecorder === "undefined") {
        return [
            { label: "WebM (デフォルト)", mimeType: "video/webm", extension: "webm" },
        ];
    }

    const candidates: Array<{ label: string; mimeType: string; extension: string }> = [
        { label: "MP4 (H.264 / AAC) - 互換性高", mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
        { label: "MP4 (標準)", mimeType: "video/mp4", extension: "mp4" },
        { label: "WebM (VP9) - 高圧縮率", mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
        { label: "WebM (VP8)", mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
        { label: "WebM (標準)", mimeType: "video/webm", extension: "webm" },
    ];

    const supported = candidates.filter((c) => {
        try {
            return MediaRecorder.isTypeSupported(c.mimeType);
        } catch {
            return false;
        }
    });

    if (supported.length === 0) {
        return [{ label: "WebM (デフォルト)", mimeType: "video/webm", extension: "webm" }];
    }

    return supported;
}

/**
 * BlobまたはFileから安全なObject URLを生成し、DOMベースのXSS（不正スキーム注入）を防止する
 */
export function createSafeObjectUrl(source: Blob): string {
    const rawUrl = URL.createObjectURL(source);
    const sanitized = rawUrl.replace(/[<>"'&\s\\]/g, "");
    if (!/^blob:/i.test(sanitized)) {
        URL.revokeObjectURL(rawUrl);
        throw new Error("不正なオブジェクトURLが検出されました。");
    }
    return sanitized;
}

/**
 * 動画ファイルからメタデータを抽出
 */
export function extractVideoMetadata(file: File): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        let objectUrl = "";
        try {
            objectUrl = createSafeObjectUrl(file);
        } catch (err) {
            reject(err instanceof Error ? err : new Error("動画URLの生成に失敗しました。"));
            return;
        }
        video.src = objectUrl;

        video.onloadedmetadata = () => {
            const meta: VideoMetadata = {
                name: file.name,
                size: file.size,
                width: video.videoWidth,
                height: video.videoHeight,
                duration: video.duration,
                type: file.type || "video/mp4",
            };
            URL.revokeObjectURL(objectUrl);
            resolve(meta);
        };

        video.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("動画ファイルの読み込みに失敗しました。対応していない形式か破損しています。"));
        };
    });
}

export interface CompressProgress {
    currentTime: number;
    duration: number;
    percent: number;
}

export interface CompressVideoOptions {
    file: File;
    width: number;
    height: number;
    fps: number;
    videoBitrateKbps: number;
    audioBitrateKbps?: number;
    mimeType: string;
    includeAudio: boolean;
    onProgress: (progress: CompressProgress) => void;
    signal?: AbortSignal;
}

/**
 * ブラウザ標準API (Canvas + MediaRecorder + AudioContext) で動画を圧縮
 */
export async function compressVideo(options: CompressVideoOptions): Promise<Blob> {
    const {
        file,
        width,
        height,
        fps,
        videoBitrateKbps,
        audioBitrateKbps = 128,
        mimeType,
        includeAudio,
        onProgress,
        signal,
    } = options;

    return new Promise(async (resolve, reject) => {
        if (signal?.aborted) {
            return reject(new Error("圧縮がキャンセルされました。"));
        }

        const video = document.createElement("video");
        let objectUrl = "";
        try {
            objectUrl = createSafeObjectUrl(file);
        } catch (err) {
            return reject(err instanceof Error ? err : new Error("動画URLの生成に失敗しました。"));
        }
        video.src = objectUrl;
        video.playsInline = true;
        video.muted = false;

        let animationFrameId = 0;
        let audioContext: AudioContext | null = null;
        let recorder: MediaRecorder | null = null;

        const cleanup = () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            video.pause();
            URL.revokeObjectURL(objectUrl);
            if (audioContext && audioContext.state !== "closed") {
                audioContext.close().catch(() => {});
            }
        };

        if (signal) {
            signal.addEventListener("abort", () => {
                cleanup();
                if (recorder && recorder.state !== "inactive") {
                    recorder.stop();
                }
                reject(new Error("圧縮がキャンセルされました。"));
            });
        }

        video.onloadedmetadata = async () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d", { alpha: false });
                if (!ctx) {
                    cleanup();
                    return reject(new Error("Canvasコンテキストの初期化に失敗しました。"));
                }

                // 映像ストリーム
                const canvasStream = canvas.captureStream(fps);
                const tracks = [...canvasStream.getVideoTracks()];

                // 音声処理
                if (includeAudio) {
                    try {
                        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                        if (AudioCtx) {
                            audioContext = new AudioCtx();
                            if (audioContext.state === "suspended") {
                                await audioContext.resume();
                            }
                            const source = audioContext.createMediaElementSource(video);
                            const destination = audioContext.createMediaStreamDestination();
                            source.connect(destination);
                            const audioTracks = destination.stream.getAudioTracks();
                            if (audioTracks.length > 0) {
                                tracks.push(audioTracks[0]);
                            }
                        }
                    } catch (e) {
                        console.warn("音声トラックの抽出をスキップします:", e);
                    }
                }

                const combinedStream = new MediaStream(tracks);
                const recorderOptions: MediaRecorderOptions = {
                    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
                    videoBitsPerSecond: videoBitrateKbps * 1000,
                    audioBitsPerSecond: audioBitrateKbps * 1000,
                };

                recorder = new MediaRecorder(combinedStream, recorderOptions);
                const chunks: Blob[] = [];

                recorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };

                recorder.onstop = () => {
                    cleanup();
                    if (chunks.length === 0) {
                        return reject(new Error("エンコードされたデータが存在しません。"));
                    }
                    const outputBlob = new Blob(chunks, { type: recorderOptions.mimeType || mimeType });
                    resolve(outputBlob);
                };

                recorder.onerror = (e) => {
                    cleanup();
                    reject(new Error(`録画エンコーダでエラーが発生しました: ${(e as unknown as { error?: Error }).error?.message || "不明なエラー"}`));
                };

                // レンダリングループ
                const duration = video.duration || 1;
                const renderFrame = () => {
                    if (signal?.aborted) return;

                    ctx.drawImage(video, 0, 0, width, height);
                    const current = Math.min(video.currentTime, duration);
                    const percent = Math.min(99, Math.round((current / duration) * 100));
                    onProgress({ currentTime: current, duration, percent });

                    if (!video.ended && !video.paused) {
                        animationFrameId = requestAnimationFrame(renderFrame);
                    }
                };

                video.onended = () => {
                    onProgress({ currentTime: duration, duration, percent: 100 });
                    setTimeout(() => {
                        if (recorder && recorder.state !== "inactive") {
                            recorder.stop();
                        }
                    }, 200);
                };

                // 録画開始
                recorder.start(250);
                await video.play();
                renderFrame();
            } catch (err) {
                cleanup();
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        };

        video.onerror = () => {
            cleanup();
            reject(new Error("動画の再生・エンコードに失敗しました。"));
        };
    });
}
