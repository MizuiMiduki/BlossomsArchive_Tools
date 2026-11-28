import { describe, it, expect } from "vitest";
import {
    sortCharacterLayersByDepth,
    hitTestCharacterLayer,
    estimateLocalEnvironmentLighting,
} from "../utils/photoComposite";

describe("photoComposite utilities", () => {
    it("sortCharacterLayersByDepth: orders farther characters behind nearer ones", () => {
        const ordered = sortCharacterLayersByDepth([
            { id: "near", cameraDistanceM: 1.5, posYPercent: 80 },
            { id: "far", cameraDistanceM: 4.5, posYPercent: 60 },
            { id: "mid", cameraDistanceM: 2.5, posYPercent: 72 },
        ]);
        expect(ordered.map((x) => x.id)).toEqual(["far", "mid", "near"]);
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
});
