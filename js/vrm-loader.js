/**
 * VRM Loader with VRMA Animation Support
 * Based on official three-vrm examples and VRoid Hub implementation
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
        this.clock = new THREE.Clock();

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
                    try {
                        const vrm = gltf.userData.vrm;
                        if (!vrm) {
                            reject(new Error('No VRM data found'));
                            return;
                        }

                        // Rotate VRM0 models to face camera
                        VRMUtils.rotateVRM0(vrm);

                        // Disable frustum culling on all objects
                        vrm.scene.traverse((obj) => {
                            obj.frustumCulled = false;
                        });

                        // Store and add to scene
                        this.vrm = vrm;
                        this.scene.add(vrm.scene);

                        // Create animation mixer for the VRM scene
                        this.mixer = new THREE.AnimationMixer(vrm.scene);

                        console.log('VRM loaded successfully');
                        console.log('Humanoid:', vrm.humanoid ? 'Yes' : 'No');
                        console.log('ExpressionManager:', vrm.expressionManager ? 'Yes' : 'No');

                        // Try to load idle animation
                        try {
                            await this.loadAnimation('./animations/idle.vrma');
                            console.log('VRMA idle animation loaded and playing');
                        } catch (e) {
                            console.warn('Could not load VRMA animation:', e.message);
                            console.log('Model will display in default pose');
                        }

                        resolve(vrm);
                    } catch (e) {
                        reject(e);
                    }
                },
                (progress) => {
                    if (onProgress && progress.total) {
                        onProgress((progress.loaded / progress.total) * 100);
                    }
                },
                (error) => {
                    console.error('Failed to load VRM:', error);
                    reject(error);
                }
            );
        });
    }

    async loadAnimation(url) {
        return new Promise((resolve, reject) => {
            console.log('Loading animation from:', url);

            this.loader.load(
                url,
                (gltf) => {
                    try {
                        const vrmAnimations = gltf.userData.vrmAnimations;

                        if (!vrmAnimations || vrmAnimations.length === 0) {
                            reject(new Error('No VRM animations found in file'));
                            return;
                        }

                        console.log('VRMA file loaded, creating clip...');

                        // Create animation clip from VRMA
                        const clip = createVRMAnimationClip(vrmAnimations[0], this.vrm);

                        console.log('Animation clip created:', clip.name, 'Duration:', clip.duration);

                        // Stop any existing animation
                        if (this.currentAction) {
                            this.currentAction.fadeOut(0.5);
                        }

                        // Create and play the action with smooth settings
                        const action = this.mixer.clipAction(clip);

                        // Smooth looping animation settings
                        action.setLoop(THREE.LoopRepeat);
                        action.clampWhenFinished = false;
                        action.timeScale = 0.7;  // Slow down for smoother, more relaxed motion
                        action.setEffectiveWeight(1.0);
                        action.fadeIn(0.5);  // Smooth fade in
                        action.play();

                        this.currentAction = action;
                        console.log('Animation now playing (timeScale: 0.7 for smooth motion)');

                        resolve(clip);
                    } catch (e) {
                        console.error('Error creating animation clip:', e);
                        reject(e);
                    }
                },
                undefined,
                (error) => {
                    console.error('Failed to load animation file:', error);
                    reject(error);
                }
            );
        });
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

    // Update VRM and mixer each frame
    // Order: mixer first, then VRM (for springbone physics to react to animation)
    update(deltaTime) {
        // 1. Update animation mixer first
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        // 2. Update VRM (physics/springbones react to animation)
        if (this.vrm) {
            this.vrm.update(deltaTime);
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
