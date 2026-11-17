/**
 * animations.ts
 * 軽量・高パフォーマンスなWeb標準アニメーションユーティリティ
 * GSAPに依存せず、Web Animations API (WAAPI) とCSSでGPUアクセラレーション動作します。
 */

const isTest = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

/**
 * ページルート要素にフェードインのエントランスアニメーションを適用する。
 * @param container ページのルートHTMLElement
 * @param staggerTargets スタッガー対象のセレクタ（省略時はコンテナ自体をアニメーション）
 */
export function playPageEntrance(
    container: HTMLElement,
    staggerTargets?: string,
): void {
    if (isTest || !container) return;

    if (staggerTargets) {
        const targets = container.querySelectorAll<HTMLElement>(staggerTargets);
        if (targets.length > 0) {
            targets.forEach((target, i) => {
                if (typeof target.animate === "function") {
                    target.animate(
                        [{ opacity: 0 }, { opacity: 1 }],
                        {
                            duration: 300,
                            delay: i * 35,
                            easing: "ease-out",
                            fill: "both",
                        },
                    );
                }
            });
            return;
        }
    }

    if (typeof container.animate === "function") {
        container.animate(
            [{ opacity: 0 }, { opacity: 1 }],
            {
                duration: 250,
                easing: "ease-out",
                fill: "both",
            },
        );
    }
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
        el.animate(
            [
                { opacity: 0, transform: `translateY(${options?.y ?? 10}px)` },
                { opacity: 1, transform: "translateY(0)" },
            ],
            {
                duration: (options?.duration ?? 0.3) * 1000,
                easing: "ease-out",
                fill: "both",
            },
        );
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
                    fill: "both",
                },
            );
        }
    });
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
