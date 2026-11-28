import { describe, it, expect } from "vitest";
import {
    sortCharacterLayersByDepth,
    hitTestCharacterLayer,
    estimateLocalEnvironmentLighting,
    segmentDepthIntoObjectLayers,
    recommendInsertSlotForDepth,
} from "../utils/photoComposite";

describe("photoComposite utilities", () => {
    it("sortCharacterLayersByDepth: orders farther characters behind nearer ones", () => {
        const ordered = sortCharacterLayersByDepth([
            { id: "near", cameraDistanceM: 1.5, posYPercent: 80 },
            { id: "far", cameraDistanceM: 4.5, posYPercent: 60 },
            { id: "mid", cameraDistanceM: 2.5, posYPercent: 72 },
        ]);
        expect(ordered.map((x) => x.id)).toEqual(["far", "mid", "near"]);

        const sameDist = sortCharacterLayersByDepth([
            { id: "frontY", cameraDistanceM: 2.5, posYPercent: 82 },
            { id: "backY", cameraDistanceM: 2.5, posYPercent: 68 },
        ]);
        expect(sameDist.map((x) => x.id)).toEqual(["backY", "frontY"]);
    });

    it("hitTestCharacterLayer: selects foreground character when bounding boxes overlap", () => {
        const layers = [
            {
                id: "back",
                posXPercent: 50,
                posYPercent: 75,
                scale: 0.7,
                cameraDistanceM: 4.0,
                aspectRatio: 0.5,
                footCenterXRatio: 0.5,
                footBottomYRatio: 1.0,
            },
            {
                id: "front",
                posXPercent: 52,
                posYPercent: 78,
                scale: 0.8,
                cameraDistanceM: 2.0,
                aspectRatio: 0.5,
                footCenterXRatio: 0.5,
                footBottomYRatio: 1.0,
            },
        ];
        expect(hitTestCharacterLayer(layers, 0.51, 0.55)).toBe("front");
        expect(hitTestCharacterLayer(layers, 0.05, 0.05)).toBeNull();
    });

    it("estimateLocalEnvironmentLighting: adapts local tint and luminance to character region", () => {
        const w = 16;
        const h = 16;
        const rgba = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const p = (y * w + x) * 4;
                // 左側は暗い青、右側は明るい暖色
                if (x < 8) {
                    rgba[p] = 20;
                    rgba[p + 1] = 40;
                    rgba[p + 2] = 90;
                } else {
                    rgba[p] = 240;
                    rgba[p + 1] = 190;
                    rgba[p + 2] = 120;
                }
                rgba[p + 3] = 255;
            }
        }
        const leftLight = estimateLocalEnvironmentLighting(rgba, w, h, 0.2, 0.5);
        const rightLight = estimateLocalEnvironmentLighting(rgba, w, h, 0.8, 0.5);
        expect(rightLight.luminance).toBeGreaterThan(leftLight.luminance);
        expect(rightLight.ambientColor.r).toBeGreaterThan(leftLight.ambientColor.r);
    });

    it("segmentDepthIntoObjectLayers & recommendInsertSlotForDepth: slices photo into ordered depth layers and picks sandwich slot", () => {
        const w = 8;
        const h = 8;
        const depth = new Float32Array(w * h);
        // 上から奥(0.1) -> 中奥(0.35) -> 中手前(0.65) -> 最手前(0.9)
        for (let y = 0; y < h; y++) {
            const val = y < 2 ? 0.1 : y < 4 ? 0.35 : y < 6 ? 0.65 : 0.9;
            for (let x = 0; x < w; x++) {
                depth[y * w + x] = val;
            }
        }
        const layers = segmentDepthIntoObjectLayers(depth, w, h, 4);
        expect(layers).toHaveLength(4);
        expect(layers[0].index).toBe(0);
        expect(layers[0].label).toBe("最前面オブジェクト");
        expect(layers[3].label).toBe("遠景・背景");
        // 最手前レイヤーは奥よりも meanDepth が大きく、推定距離が近い
        expect(layers[0].meanDepth).toBeGreaterThan(layers[3].meanDepth);
        expect(layers[0].estimatedDistanceM).toBeLessThan(layers[3].estimatedDistanceM);
        // 最手前(y=7)では layer[0] のアルファが255、最奥(y=0)では layer[0] のアルファが0
        expect(layers[0].maskRgba[(7 * w + 0) * 4 + 3]).toBe(255);
        expect(layers[0].maskRgba[(0 * w + 0) * 4 + 3]).toBe(0);
        // 最奥レイヤーは全背景の土台として不透明
        expect(layers[3].maskRgba[3]).toBe(255);

        // 挟み込みスロット推奨: 手前(0.95) -> 0, 中間(0.5) -> 1または2, 最奥(0.05) -> 4以下
        expect(recommendInsertSlotForDepth(layers, 0.95)).toBe(0);
        const midSlot = recommendInsertSlotForDepth(layers, 0.5);
        expect(midSlot).toBeGreaterThanOrEqual(1);
        expect(midSlot).toBeLessThanOrEqual(3);
        expect(recommendInsertSlotForDepth(layers, 0.05)).toBeGreaterThanOrEqual(3);
    });
});
