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
 * スマートフォンの内蔵スピーカーでもしっかり再生可能な中低域（210Hz〜260Hz）の筐体共鳴と、
 * エスケープメント爪の硬質なメカニカルアタックとケース共鳴を組み合わせ、
 * リアルな時計の秒針音（Tick-Tock）を忠実に合成します。
 *
 * @param isTock trueの場合は偶数秒の低めの音（Tock）、falseの場合は奇数秒の音（Tick）
 * @param volume 音量 (0.0 - 1.0)
 */
let cachedNoiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    if (typeof ctx.createBuffer !== "function") return null;
    if (!cachedNoiseBuffer || cachedNoiseBuffer.sampleRate !== ctx.sampleRate) {
        const length = Math.floor(ctx.sampleRate * 0.08); // 80ms分のホワイトノイズ
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // 暗号学的乱数 (CSPRNG) による均一なノイズ生成
        if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
            const uint32Array = new Uint32Array(length);
            window.crypto.getRandomValues(uint32Array);
            for (let i = 0; i < length; i++) {
                data[i] = (uint32Array[i] / 2147483648) - 1.0;
            }
        } else {
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1.0;
            }
        }
        cachedNoiseBuffer = buffer;
    }
    return cachedNoiseBuffer;
}

export function playClockTickSound(isTock = false, volume = 1.0): void {
    if (typeof window === "undefined") return;

    const ctx = initAudio();
    if (!ctx) return;

    const rawVolume = typeof volume === "number" ? volume : 1.0;
    const finalVolume = Number.isFinite(rawVolume)
        ? Math.max(0, Math.min(1, rawVolume))
        : 1.0;

    if (finalVolume <= 0) return;

    const currentTime = ctx.currentTime;

    // 音圧と音量を最適化（通常端末音量でも心地よく明瞭に聴こえるゲイン）
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(finalVolume * 2.8, currentTime);

    if (typeof ctx.createDynamicsCompressor === "function") {
        try {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.setValueAtTime(-6, currentTime);
            comp.knee.setValueAtTime(3, currentTime);
            comp.ratio.setValueAtTime(8, currentTime);
            comp.attack.setValueAtTime(0.001, currentTime);
            comp.release.setValueAtTime(0.08, currentTime);
            masterGain.connect(comp);
            comp.connect(ctx.destination);
        } catch {
            masterGain.connect(ctx.destination);
        }
    } else {
        masterGain.connect(ctx.destination);
    }

    const noiseBuffer = getNoiseBuffer(ctx);
    const hasBufferSource = typeof ctx.createBufferSource === "function";
    const hasFilter = typeof ctx.createBiquadFilter === "function";

    // 1. プレ・ストライク（脱進機のアンクル爪がガンギ車から外れる約7ms前の微細な金属擦過音）
    if (noiseBuffer && hasBufferSource && hasFilter) {
        try {
            const preNoise = ctx.createBufferSource();
            preNoise.buffer = noiseBuffer;
            const preFilter = ctx.createBiquadFilter();
            preFilter.type = "bandpass";
            preFilter.frequency.setValueAtTime(isTock ? 4000 : 4600, currentTime);
            preFilter.Q.setValueAtTime(4, currentTime);

            const preGain = ctx.createGain();
            preGain.gain.setValueAtTime(0.4, currentTime);
            if (typeof preGain.gain.exponentialRampToValueAtTime === "function") {
                preGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.006);
            } else {
                preGain.gain.setValueAtTime(0, currentTime + 0.006);
            }

            preNoise.connect(preFilter);
            preFilter.connect(preGain);
            preGain.connect(masterGain);

            preNoise.start(currentTime);
            preNoise.stop(currentTime + 0.007);
        } catch {}
    }

    // 2. メイン・ストライク（ガンギ車の歯とアンクル爪の衝突音: 約7ms後）
    const strikeTime = currentTime + 0.007;

    // 2-a. 高域メカニカルノイズ（硬質でクリスプな金属・ルビー打撃の「カチッ」）
    if (noiseBuffer && hasBufferSource && hasFilter) {
        try {
            const strikeNoise = ctx.createBufferSource();
            strikeNoise.buffer = noiseBuffer;
            const strikeFilter = ctx.createBiquadFilter();
            strikeFilter.type = "bandpass";
            strikeFilter.frequency.setValueAtTime(isTock ? 2900 : 3600, strikeTime);
            strikeFilter.Q.setValueAtTime(3.2, strikeTime);

            const strikeGain = ctx.createGain();
            strikeGain.gain.setValueAtTime(1.1, strikeTime);
            if (typeof strikeGain.gain.exponentialRampToValueAtTime === "function") {
                strikeGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 0.022);
            } else {
                strikeGain.gain.setValueAtTime(0, strikeTime + 0.022);
            }

            strikeNoise.connect(strikeFilter);
            strikeFilter.connect(strikeGain);
            strikeGain.connect(masterGain);

            strikeNoise.start(strikeTime);
            strikeNoise.stop(strikeTime + 0.025);
        } catch {}
    }

    // 2-b. 筐体・内部共鳴（時計ケースの空洞で鳴る自然な「コッ」という中域レゾナンス）
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = "sine";
    const bodyFreq = isTock ? 560 : 680;
    bodyOsc.frequency.setValueAtTime(bodyFreq, strikeTime);
    if (typeof bodyOsc.frequency.exponentialRampToValueAtTime === "function") {
        bodyOsc.frequency.exponentialRampToValueAtTime(bodyFreq * 0.7, strikeTime + 0.035);
    }

    bodyGain.gain.setValueAtTime(0.7, strikeTime);
    if (typeof bodyGain.gain.exponentialRampToValueAtTime === "function") {
        bodyGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 0.035);
    } else {
        bodyGain.gain.setValueAtTime(0, strikeTime + 0.035);
    }

    bodyOsc.connect(bodyGain);
    bodyGain.connect(masterGain);
    bodyOsc.start(strikeTime);
    bodyOsc.stop(strikeTime + 0.038);

    // 2-c. メカニカルな打撃の芯・底打ち感（中低域 220Hz〜260Hz のタイトなインパルス）
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = "triangle";
    const thumpFreq = isTock ? 220 : 260;
    thumpOsc.frequency.setValueAtTime(thumpFreq, strikeTime);
    if (typeof thumpOsc.frequency.exponentialRampToValueAtTime === "function") {
        thumpOsc.frequency.exponentialRampToValueAtTime(thumpFreq * 0.5, strikeTime + 0.025);
    }

    thumpGain.gain.setValueAtTime(0.8, strikeTime);
    if (typeof thumpGain.gain.exponentialRampToValueAtTime === "function") {
        thumpGain.gain.exponentialRampToValueAtTime(0.001, strikeTime + 0.025);
    } else {
        thumpGain.gain.setValueAtTime(0, strikeTime + 0.025);
    }

    thumpOsc.connect(thumpGain);
    thumpGain.connect(masterGain);
    thumpOsc.start(strikeTime);
    thumpOsc.stop(strikeTime + 0.028);
}
