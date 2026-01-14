/**
 * VRM Loader - Minimal working implementation
 * Based on official three-vrm examples
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class VRMLoader {
    constructor(scene) {
        this.scene = scene;
        this.vrm = null;
        this.loader = new GLTFLoader();
        this.loader.crossOrigin = 'anonymous';

        // Register VRM plugin - NO special options
        this.loader.register((parser) => new VRMLoaderPlugin(parser));
    }

    async load(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const vrm = gltf.userData.vrm;
                    if (!vrm) {
                        reject(new Error('No VRM data found'));
                        return;
                    }

                    // Rotate VRM0 models to face camera (do this first)
                    VRMUtils.rotateVRM0(vrm);

                    // Disable frustum culling
                    vrm.scene.traverse((obj) => {
                        obj.frustumCulled = false;
                    });

                    // Store and add to scene
                    this.vrm = vrm;
                    this.scene.add(vrm.scene);

                    console.log('VRM loaded:', vrm);
                    console.log('Humanoid:', vrm.humanoid);

                    // Log available bones
                    if (vrm.humanoid) {
                        const bones = ['hips', 'spine', 'chest', 'neck', 'head',
                            'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm'];
                        bones.forEach(name => {
                            const bone = vrm.humanoid.getRawBoneNode(name);
                            if (bone) {
                                console.log(`Bone ${name}:`, bone.rotation);
                            }
                        });
                    }

                    resolve(vrm);
                },
                (progress) => {
                    if (onProgress && progress.total) {
                        onProgress((progress.loaded / progress.total) * 100);
                    }
                },
                reject
            );
        });
    }

    // Get RAW bone for direct manipulation
    getBone(name) {
        if (!this.vrm?.humanoid) return null;
        return this.vrm.humanoid.getRawBoneNode(name);
    }

    // Expression methods
    setExpression(name, value) {
        if (!this.vrm?.expressionManager) return;
        try {
            this.vrm.expressionManager.setValue(name, Math.max(0, Math.min(1, value)));
        } catch (e) {}
    }

    resetExpressions() {
        if (!this.vrm?.expressionManager) return;
        ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'aa', 'ih', 'ou', 'ee', 'oh',
         'blink', 'blinkLeft', 'blinkRight'].forEach(exp => {
            try { this.vrm.expressionManager.setValue(exp, 0); } catch (e) {}
        });
    }

    setHappy(v) { this.setExpression('happy', v); }
    setSad(v) { this.setExpression('sad', v); }
    setAngry(v) { this.setExpression('angry', v); }
    setSurprised(v) { this.setExpression('surprised', v); }
    setMouthOpen(v) { this.setExpression('aa', v); }
    setBlink(v) {
        this.setExpression('blink', v);
        this.setExpression('blinkLeft', v);
        this.setExpression('blinkRight', v);
    }
    setWink(isLeft = true) {
        this.setExpression('blinkLeft', isLeft ? 1 : 0);
        this.setExpression('blinkRight', isLeft ? 0 : 1);
    }

    // Update VRM each frame
    update(deltaTime) {
        if (this.vrm) {
            this.vrm.update(deltaTime);
        }
    }

    dispose() {
        if (this.vrm) {
            VRMUtils.deepDispose(this.vrm.scene);
            this.scene.remove(this.vrm.scene);
            this.vrm = null;
        }
    }
}
