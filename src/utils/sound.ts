// src/utils/sound.ts

type SoundType = "alarm" | "chime";

export interface PlaySoundOptions {
    soundType?: SoundType;
    volume?: number; // 0.0 - 1.0
    pitchModifier?: number; // 0.5 - 2.0
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * ユーザー操作時（スタートボタン押下等）に呼び出し、AudioContextを安全に初期化・resumeします。
 * ブラウザのAutoplay Policyに対応します。
 */
export function initAudio(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
        try {
            sharedAudioCtx = new AudioCtxClass();
        } catch {
            return null;
        }
    }

    if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
}

/**
 * AudioContextを停止・解放します（ページ離脱時等）。
 */
export function closeAudio(): void {
    if (sharedAudioCtx && sharedAudioCtx.state !== "closed") {
        try {
            sharedAudioCtx.close().catch(() => {});
        } finally {
            sharedAudioCtx = null;
        }
    }
}

/**
 * Web Audio API を用いて電子音・チャイムを合成・再生します。
 * 音圧コンプレッサーと音量ブーストにより、スマホやノートPCの内蔵スピーカーでも
 * はっきりと聞き取れる大音量・高明瞭度な通知音を出力します。
 */
export function playNotificationSound(options: PlaySoundOptions = {}): void {
    if (typeof window === "undefined") return;

    const ctx = initAudio();
    if (!ctx) return;

    const rawVolume = typeof options.volume === "number" ? options.volume : 1.0;
    const volume = Number.isFinite(rawVolume)
        ? Math.max(0, Math.min(1, rawVolume))
        : 1.0;

    if (volume <= 0) return;

    const soundType = options.soundType || "alarm";
    const rawPitch =
        typeof options.pitchModifier === "number" ? options.pitchModifier : 1.0;
    const pitch = Number.isFinite(rawPitch)
        ? Math.max(0.2, Math.min(3.0, rawPitch))
        : 1.0;

    const currentTime = ctx.currentTime;

    // 音量をしっかり届けるため、マスターゲインを2.2倍にブースト（実効音圧を大幅強化）
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 2.2, currentTime);

    // ダイナミクスコンプレッサー（リミッター）を通すことで音割れを防ぎつつ最大音圧を維持
    if (typeof ctx.createDynamicsCompressor === "function") {
        try {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.setValueAtTime(-8, currentTime);
            comp.knee.setValueAtTime(6, currentTime);
            comp.ratio.setValueAtTime(12, currentTime);
            comp.attack.setValueAtTime(0.002, currentTime);
            comp.release.setValueAtTime(0.15, currentTime);
            masterGain.connect(comp);
            comp.connect(ctx.destination);
        } catch {
            masterGain.connect(ctx.destination);
        }
    } else {
        masterGain.connect(ctx.destination);
    }

    if (soundType === "alarm") {
        // 電子アラーム音: 「ピピピッ、ピピピッ、ピピピッ」 (基音 + 倍音で力強く明瞭な高音圧パルス)
        const baseFreq = 1046.5 * pitch; // C6 (耳に最も通りやすい帯域)
        const beeps = [
            // 1セット目
            { start: 0.0, end: 0.09, freq: baseFreq },
            { start: 0.13, end: 0.22, freq: baseFreq },
            { start: 0.26, end: 0.35, freq: baseFreq },
            // 2セット目
            { start: 0.55, end: 0.64, freq: baseFreq },
            { start: 0.68, end: 0.77, freq: baseFreq },
            { start: 0.81, end: 0.9, freq: baseFreq },
            // 3セット目
            { start: 1.1, end: 1.19, freq: baseFreq },
            { start: 1.23, end: 1.32, freq: baseFreq },
            { start: 1.36, end: 1.48, freq: baseFreq },
        ];

        beeps.forEach(({ start, end, freq }) => {
            // メインオシレーター（矩形波）
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "square";
            osc.frequency.setValueAtTime(freq, currentTime + start);

            gain.gain.setValueAtTime(0, currentTime + start);
            gain.gain.linearRampToValueAtTime(1.0, currentTime + start + 0.006);
            gain.gain.setValueAtTime(1.0, currentTime + end - 0.006);
            gain.gain.linearRampToValueAtTime(0, currentTime + end);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(currentTime + start);
            osc.stop(currentTime + end);

            // 倍音オシレーター（音の輪郭と迫力を倍加）
            const overtone = ctx.createOscillator();
            const overtoneGain = ctx.createGain();
            overtone.type = "sine";
            overtone.frequency.setValueAtTime(freq * 2, currentTime + start);

            overtoneGain.gain.setValueAtTime(0, currentTime + start);
            overtoneGain.gain.linearRampToValueAtTime(0.5, currentTime + start + 0.006);
            overtoneGain.gain.setValueAtTime(0.5, currentTime + end - 0.006);
            overtoneGain.gain.linearRampToValueAtTime(0, currentTime + end);

            overtone.connect(overtoneGain);
            overtoneGain.connect(masterGain);

            overtone.start(currentTime + start);
            overtone.stop(currentTime + end);
        });
    } else {
        // チャイム音: 「ポーン」 (豊かで大きな和音減衰音)
        const notes = [
            { start: 0.0, duration: 1.2, freq: 523.25 * pitch, peak: 1.1 }, // C5
            { start: 0.15, duration: 1.4, freq: 659.25 * pitch, peak: 1.1 }, // E5
            { start: 0.3, duration: 1.7, freq: 783.99 * pitch, peak: 1.2 }, // G5
            { start: 0.45, duration: 2.0, freq: 1046.5 * pitch, peak: 1.3 }, // C6
        ];

        notes.forEach(({ start, duration, freq, peak }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, currentTime + start);

            gain.gain.setValueAtTime(0, currentTime + start);
            gain.gain.linearRampToValueAtTime(peak, currentTime + start + 0.015);
            if (typeof gain.gain.exponentialRampToValueAtTime === "function") {
                gain.gain.exponentialRampToValueAtTime(
                    0.001,
                    currentTime + start + duration,
                );
            } else {
                gain.gain.linearRampToValueAtTime(0, currentTime + start + duration);
            }

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(currentTime + start);
            osc.stop(currentTime + start + duration);
        });
    }
}

/**
 * 機械式アナログ時計の重厚な秒針音（カチッ / コチッ）をWeb Audio APIで合成・再生します。
 * 低域レゾナンス（共鳴ボディ）と高域メカニカルアタック（エスケープメント爪音）を組み合わせ、
 * 奇数秒と偶数秒でピッチを微調整（Tick-Tock）して重厚感と自然なリズムを表現します。
 *
 * @param isTock trueの場合は偶数秒の低めの音（Tock）、falseの場合は奇数秒の音（Tick）
 * @param volume 音量 (0.0 - 1.0)
 */
export function playClockTickSound(isTock = false, volume = 0.8): void {
    if (typeof window === "undefined") return;

    const ctx = initAudio();
    if (!ctx) return;

    const rawVolume = typeof volume === "number" ? volume : 0.8;
    const finalVolume = Number.isFinite(rawVolume)
        ? Math.max(0, Math.min(1, rawVolume))
        : 0.8;

    if (finalVolume <= 0) return;

    const currentTime = ctx.currentTime;

    // 音量をしっかり存在感あるレベルにするため、マスターゲインを2.0倍にブースト
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(finalVolume * 2.0, currentTime);

    if (typeof ctx.createDynamicsCompressor === "function") {
        try {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.setValueAtTime(-10, currentTime);
            comp.ratio.setValueAtTime(8, currentTime);
            masterGain.connect(comp);
            comp.connect(ctx.destination);
        } catch {
            masterGain.connect(ctx.destination);
        }
    } else {
        masterGain.connect(ctx.destination);
    }

    // 1. 低域ボディ（重みのある「コッ」という共鳴打撃音）
    // Tick: 180Hz -> 60Hz, Tock: 140Hz -> 50Hz
    const baseFreq = isTock ? 140 : 180;
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();

    bodyOsc.type = "sine";
    bodyOsc.frequency.setValueAtTime(baseFreq, currentTime);
    if (typeof bodyOsc.frequency.exponentialRampToValueAtTime === "function") {
        bodyOsc.frequency.exponentialRampToValueAtTime(
            baseFreq * 0.4,
            currentTime + 0.045,
        );
    }

    bodyGain.gain.setValueAtTime(1.1, currentTime);
    if (typeof bodyGain.gain.exponentialRampToValueAtTime === "function") {
        bodyGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.045);
    } else {
        bodyGain.gain.setValueAtTime(0, currentTime + 0.045);
    }

    bodyOsc.connect(bodyGain);
    bodyGain.connect(masterGain);

    bodyOsc.start(currentTime);
    bodyOsc.stop(currentTime + 0.05);

    // 2. 高域アタック（「カチッ」とした金属・歯車の噛み合い音）
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();

    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(isTock ? 1400 : 1800, currentTime);
    if (typeof clickOsc.frequency.exponentialRampToValueAtTime === "function") {
        clickOsc.frequency.exponentialRampToValueAtTime(
            350,
            currentTime + 0.015,
        );
    }

    clickGain.gain.setValueAtTime(0.7, currentTime);
    if (typeof clickGain.gain.exponentialRampToValueAtTime === "function") {
        clickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.015);
    } else {
        clickGain.gain.setValueAtTime(0, currentTime + 0.015);
    }

    clickOsc.connect(clickGain);
    clickGain.connect(masterGain);

    clickOsc.start(currentTime);
    clickOsc.stop(currentTime + 0.02);
}
