/**
 * VRM Loader with VRMA Animation Support
 * Uses official @pixiv/three-vrm-animation for reliable animation playback
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

export class VRMLoader {
    constructor(scene) {
        this.scene = scene;
        this.vrm = null;
        this.mixer = null;
        this.currentAction = null;

        // Setup loader with both VRM and VRMA plugins
        this.loader = new GLTFLoader();
        this.loader.crossOrigin = 'anonymous';
        this.loader.register((parser) => new VRMLoaderPlugin(parser));
        this.loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    }

    async load(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                async (gltf) => {
                    const vrm = gltf.userData.vrm;
                    if (!vrm) {
                        reject(new Error('No VRM data found'));
                        return;
                    }

                    // Rotate VRM0 models to face camera
                    VRMUtils.rotateVRM0(vrm);

                    // Disable frustum culling
                    vrm.scene.traverse((obj) => {
                        obj.frustumCulled = false;
                    });

                    // Store and add to scene
                    this.vrm = vrm;
                    this.scene.add(vrm.scene);

                    // Create animation mixer
                    this.mixer = new THREE.AnimationMixer(vrm.scene);

                    console.log('VRM loaded successfully');

                    // Load idle animation
                    try {
                        await this.loadAnimation('./animations/idle.vrma');
                        console.log('Idle animation loaded and playing');
                    } catch (e) {
                        console.warn('Could not load idle animation:', e.message);
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

    async loadAnimation(url) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const vrmAnimations = gltf.userData.vrmAnimations;
                    if (!vrmAnimations || vrmAnimations.length === 0) {
                        reject(new Error('No VRM animations found in file'));
                        return;
                    }

                    // Create animation clip from VRMA
                    const clip = createVRMAnimationClip(vrmAnimations[0], this.vrm);

                    // Play the animation
                    const action = this.mixer.clipAction(clip);
                    action.play();

                    this.currentAction = action;
                    console.log('Animation playing:', clip.name);

                    resolve(clip);
                },
                undefined,
                reject
            );
        });
    }

    // Crossfade to a new animation
    async crossfadeTo(url, duration = 0.5) {
        const oldAction = this.currentAction;

        try {
            await this.loadAnimation(url);

            if (oldAction) {
                oldAction.fadeOut(duration);
            }
            if (this.currentAction) {
                this.currentAction.reset().fadeIn(duration).play();
            }
        } catch (e) {
            console.error('Failed to crossfade animation:', e);
        }
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

    // Update VRM and mixer each frame - ORDER MATTERS!
    update(deltaTime) {
        // 1. Update VRM (physics/spring bones)
        if (this.vrm) {
            this.vrm.update(deltaTime);
        }
        // 2. Update animation mixer AFTER VRM
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
    }

    dispose() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        if (this.vrm) {
            VRMUtils.deepDispose(this.vrm.scene);
            this.scene.remove(this.vrm.scene);
            this.vrm = null;
        }
    }
}
