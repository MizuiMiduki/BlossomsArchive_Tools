/**
 * gsapAnimations.ts
 * 全ページ共通のGSAPアニメーションユーティリティ
 */
import gsap from "gsap";

/**
 * ページルート要素にフェードイン＋スライドアップのエントランスアニメーションを適用する。
 * @param container ページのルートHTMLElement
 * @param staggerTargets スタッガー対象のセレクタ（省略時はコンテナ自体をアニメーション）
 */
export function playPageEntrance(
    container: HTMLElement,
    staggerTargets?: string,
): gsap.core.Timeline {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    if (staggerTargets) {
        const targets = container.querySelectorAll(staggerTargets);
        if (targets.length > 0) {
            tl.from(targets, {
                opacity: 0,
                y: 20,
                duration: 0.45,
                stagger: 0.06,
                clearProps: "transform,opacity",
            });
            return tl;
        }
    }

    tl.from(container, {
        opacity: 0,
        y: 16,
        duration: 0.4,
        clearProps: "transform,opacity",
    });

    return tl;
}

/**
 * 単一要素がマウント・表示された際にGSAPでフェードイン＋スライドアップを描画する。
 * refコールバックとして直接使用可能: `ref={(el) => animateFadeIn(el)}`
 */
export function animateFadeIn(
    el: HTMLElement,
    vars?: gsap.TweenVars,
): gsap.core.Tween {
    return gsap.fromTo(
        el,
        { opacity: 0, y: 14, ...vars?.from },
        {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: "power2.out",
            clearProps: "transform,opacity",
            ...vars,
        },
    );
}

/**
 * コンテナ内の子要素群を時間差（stagger）でGSAPアニメーション描画する。
 */
export function animateStaggerIn(
    container: HTMLElement,
    childSelector: string,
    vars?: gsap.TweenVars,
): gsap.core.Tween | null {
    const targets = container.querySelectorAll(childSelector);
    if (targets.length === 0) return null;

    return gsap.fromTo(
        targets,
        { opacity: 0, y: 16, scale: 0.96 },
        {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.35,
            stagger: 0.05,
            ease: "back.out(1.5)",
            clearProps: "transform,opacity",
            ...vars,
        },
    );
}

/**
 * ボタンや要素をクリックした際、ポンッと弾むフィードバックアニメーションを描画する。
 */
export function animatePop(
    el: HTMLElement,
    scale = 0.92,
    duration = 0.18,
): gsap.core.Timeline {
    const tl = gsap.timeline();
    tl.to(el, { scale, duration: duration / 2, ease: "power1.in" }).to(el, {
        scale: 1,
        duration: duration / 2,
        ease: "back.out(2)",
        clearProps: "transform",
    });
    return tl;
}

/**
 * setTimeout の GSAP版ラッパー。
 * @param seconds 遅延秒数
 * @param callback 実行するコールバック
 */
export function delayedCall(
    seconds: number,
    callback: () => void,
): gsap.core.Tween {
    return gsap.delayedCall(seconds, callback);
}

/**
 * ホバー時のGSAPアニメーションをセットアップする。
 */
export function setupHoverAnimation(
    el: HTMLElement,
    hoverProps: gsap.TweenVars,
    leaveProps: gsap.TweenVars,
    duration = 0.2,
): () => void {
    const over = () => gsap.to(el, { duration, ease: "power1.out", ...hoverProps });
    const out = () => gsap.to(el, { duration, ease: "power1.out", ...leaveProps });

    el.addEventListener("mouseenter", over);
    el.addEventListener("mouseleave", out);

    return () => {
        el.removeEventListener("mouseenter", over);
        el.removeEventListener("mouseleave", out);
    };
}
