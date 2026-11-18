/**
 * animations.ts
 * 軽量・高パフォーマンスなWeb標準アニメーションユーティリティ
 * GSAPに依存せず、Web Animations API (WAAPI) とCSSでGPUアクセラレーション動作します。
 */

const isTest = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

/**
 * ページルート要素のエントランスアニメーション。
 * Core Web Vitals (LCP / Speed Index) 最大化のため、初回描画時の透明化 (opacity: 0) は行わず即座に表示します。
 * @param _container ページのルートHTMLElement
 * @param _staggerTargets スタッガー対象のセレクタ
 */
export function playPageEntrance(
    _container: HTMLElement,
    _staggerTargets?: string,
): void {
    // 初回描画の LCP・Speed Index 遅延を防ぐため即時表示とする
}

/**
 * 単一要素がマウント・表示された際にフェードイン＋スライドアップを描画する。
 * refコールバックとして直接使用可能: `ref={(el) => animateFadeIn(el)}`
 */
export function animateFadeIn(
    el: HTMLElement,
    options?: { duration?: number; y?: number; ease?: string; [key: string]: unknown },
): void {
    if (isTest || !el) return;
    if (typeof el.animate === "function") {
        try {
            el.animate(
                [
                    { opacity: 0, transform: `translateY(${options?.y ?? 10}px)` },
                    { opacity: 1, transform: "translateY(0)" },
                ],
                {
                    duration: (options?.duration ?? 0.3) * 1000,
                    easing: "ease-out",
                    fill: "none",
                },
            );
        } catch {
            // fail-safe: WAAPI unavailable or failed
        }
    }
}

/**
 * コンテナ内の子要素群を時間差（stagger）でアニメーション描画する。
 */
export function animateStaggerIn(
    container: HTMLElement,
    childSelector: string,
): void {
    if (isTest || !container) return;
    try {
        const targets = container.querySelectorAll<HTMLElement>(childSelector);
        targets.forEach((target, i) => {
            if (typeof target.animate === "function") {
                target.animate(
                    [
                        { opacity: 0, transform: "translateY(10px) scale(0.97)" },
                        { opacity: 1, transform: "translateY(0) scale(1)" },
                    ],
                    {
                        duration: 300,
                        delay: i * 35,
                        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                        fill: "none",
                    },
                );
            }
        });
    } catch {
        // fail-safe
    }
}

/**
 * ボタンや要素をクリックした際、ポンッと弾むフィードバックアニメーションを描画する。
 */
export function animatePop(
    el: HTMLElement,
    scale = 0.94,
    duration = 0.15,
): void {
    if (isTest || !el) return;
    if (typeof el.animate === "function") {
        el.animate(
            [
                { transform: "scale(1)" },
                { transform: `scale(${scale})` },
                { transform: "scale(1)" },
            ],
            {
                duration: duration * 1000,
                easing: "ease-in-out",
            },
        );
    }
}

/**
 * setTimeout のラッパー関数。
 * @param seconds 遅延秒数
 * @param callback 実行するコールバック
 */
export function delayedCall(
    seconds: number,
    callback: () => void,
): number {
    return window.setTimeout(callback, isTest ? 0 : seconds * 1000);
}

/**
 * ホバー時のアニメーションをセットアップする。
 */
export function setupHoverAnimation(
    el: HTMLElement,
    _hoverProps?: unknown,
    _leaveProps?: unknown,
    _duration = 0.2,
): () => void {
    if (isTest || !el) return () => {};
    return () => {};
}
