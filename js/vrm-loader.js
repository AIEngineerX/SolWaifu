import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm';

export class VRMLoader {
    constructor(scene) {
        this.scene = scene;
        this.vrm = null;
        this.loader = null;

        // Cache bone references for performance
        this.boneCache = {};

        // Store original bone transforms for reset
        this.originalTransforms = {};

        this.init();
    }

    init() {
        // Create GLTF loader with VRM plugin
        this.loader = new GLTFLoader();
        this.loader.register((parser) => new VRMLoaderPlugin(parser));
    }

    async load(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => {
                    const vrm = gltf.userData.vrm;

                    if (!vrm) {
                        reject(new Error('No VRM data found in file'));
                        return;
                    }

                    // Store VRM reference
                    this.vrm = vrm;

                    // Rotate model to face camera (VRM models face +Z by default)
                    VRMUtils.rotateVRM0(vrm);

                    // Add to scene
                    this.scene.add(vrm.scene);

                    // Log available info for debugging
                    this.logDebugInfo();

                    // CRITICAL: Reset normalized pose BEFORE caching bones
                    // This puts all normalized bones into their T-pose reference state
                    // where rotation (0,0,0) = T-pose. Without this, normalized bone
                    // rotations are relative to whatever the model's bind pose was,
                    // causing unpredictable results.
                    if (vrm.humanoid) {
                        vrm.humanoid.resetNormalizedPose();
                        console.log('Normalized pose reset to T-pose reference');
                    }

                    // Cache bone references - using NORMALIZED bones for animation
                    // Normalized bones: rotations are relative to T-pose
                    // vrm.update() automatically syncs these to the raw skeleton
                    this.cacheBones();

                    // Initial vrm.update() to sync the reset pose
                    vrm.update(0);

                    resolve(vrm);
                },
                (progress) => {
                    if (onProgress && progress.total) {
                        const percent = (progress.loaded / progress.total) * 100;
                        onProgress(percent);
                    }
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    logDebugInfo() {
        console.log('=== VRM Debug Info ===');

        // Log expressions
        if (this.vrm.expressionManager) {
            const expNames = Object.keys(this.vrm.expressionManager.expressionMap || {});
            console.log('Available expressions:', expNames);
        } else {
            console.log('No expression manager found');
        }

        // Log humanoid bones with their current rotations
        if (this.vrm.humanoid) {
            const boneNames = [];
            const standardBones = [
                'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
                'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
                'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
                'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
                'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
            ];

            standardBones.forEach(name => {
                const bone = this.vrm.humanoid.getRawBoneNode(name);
                if (bone) {
                    boneNames.push(name);
                    // Log arm rotations specifically to help debug T-pose
                    if (name.includes('Arm')) {
                        console.log(`${name} initial rotation:`, {
                            x: bone.rotation.x.toFixed(3),
                            y: bone.rotation.y.toFixed(3),
                            z: bone.rotation.z.toFixed(3)
                        });
                    }
                }
            });

            console.log('Available bones:', boneNames);
        } else {
            console.log('No humanoid found');
        }

        // Log SpringBone info
        if (this.vrm.springBoneManager) {
            console.log('SpringBone physics: ENABLED ✓');
            const jointCount = this.vrm.springBoneManager.joints?.length || 0;
            console.log('SpringBone joints:', jointCount);
        } else {
            console.log('SpringBone physics: NOT FOUND');
        }
    }

    cacheBones() {
        if (!this.vrm || !this.vrm.humanoid) return;

        const boneNames = [
            'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
            'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
            'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
            'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
            'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
            'leftEye', 'rightEye', 'jaw'
        ];

        boneNames.forEach(name => {
            // Use getNormalizedBoneNode for animation (three-vrm v2)
            // After resetNormalizedPose(), these bones are in T-pose reference:
            // - rotation (0,0,0) = T-pose
            // - positive Z on leftUpperArm = rotate arm DOWN
            // - negative Z on rightUpperArm = rotate arm DOWN
            // vrm.update() syncs these to raw bones automatically
            let bone = this.vrm.humanoid.getNormalizedBoneNode(name);

            if (bone) {
                this.boneCache[name] = bone;
                // Store T-pose reference transforms (after resetNormalizedPose)
                // These should all be essentially zero rotations
                this.originalTransforms[name] = {
                    rotation: bone.rotation.clone(),
                    position: bone.position.clone(),
                    quaternion: bone.quaternion.clone()
                };
            }
        });

        console.log('Cached normalized bones:', Object.keys(this.boneCache));

        // Debug: verify arms are at T-pose reference (should be ~0)
        const leftArm = this.boneCache['leftUpperArm'];
        const rightArm = this.boneCache['rightUpperArm'];
        if (leftArm && rightArm) {
            console.log('T-pose reference - leftUpperArm rotation:', {
                x: leftArm.rotation.x.toFixed(4),
                y: leftArm.rotation.y.toFixed(4),
                z: leftArm.rotation.z.toFixed(4)
            });
            console.log('T-pose reference - rightUpperArm rotation:', {
                x: rightArm.rotation.x.toFixed(4),
                y: rightArm.rotation.y.toFixed(4),
                z: rightArm.rotation.z.toFixed(4)
            });
        }
    }

    // Get expression value (0-1)
    getExpression(name) {
        if (!this.vrm || !this.vrm.expressionManager) return 0;
        return this.vrm.expressionManager.getValue(name) || 0;
    }

    // Set expression value (0-1)
    setExpression(name, value) {
        if (!this.vrm || !this.vrm.expressionManager) return;

        // Try the exact name first
        try {
            this.vrm.expressionManager.setValue(name, Math.max(0, Math.min(1, value)));
        } catch (e) {
            // Silently fail if expression doesn't exist
        }
    }

    // Common expression shortcuts
    setMouthOpen(value) {
        // VRM 1.0 uses 'aa', VRM 0.x might use others
        this.setExpression('aa', value);
        this.setExpression('oh', value * 0.5);
    }

    setHappy(value) {
        this.setExpression('happy', value);
        this.setExpression('relaxed', value * 0.5);
    }

    setSad(value) {
        this.setExpression('sad', value);
    }

    setAngry(value) {
        this.setExpression('angry', value);
    }

    setSurprised(value) {
        this.setExpression('surprised', value);
    }

    setBlink(value) {
        this.setExpression('blink', value);
        this.setExpression('blinkLeft', value);
        this.setExpression('blinkRight', value);
    }

    setWink(isLeft = true) {
        if (isLeft) {
            this.setExpression('blinkLeft', 1);
            this.setExpression('blinkRight', 0);
        } else {
            this.setExpression('blinkLeft', 0);
            this.setExpression('blinkRight', 1);
        }
    }

    // Reset all expressions to neutral
    resetExpressions() {
        if (!this.vrm || !this.vrm.expressionManager) return;

        // Reset all known expressions
        const expressions = [
            'happy', 'angry', 'sad', 'relaxed', 'surprised',
            'aa', 'ih', 'ou', 'ee', 'oh',
            'blink', 'blinkLeft', 'blinkRight',
            'lookUp', 'lookDown', 'lookLeft', 'lookRight',
            'neutral'
        ];

        expressions.forEach(exp => {
            try {
                this.vrm.expressionManager.setValue(exp, 0);
            } catch (e) {
                // Ignore missing expressions
            }
        });
    }

    // Get normalized bone by name for animation
    // Normalized bones: rotations relative to T-pose, synced to raw by vrm.update()
    getBone(boneName) {
        // Return from cache first
        if (this.boneCache[boneName]) {
            return this.boneCache[boneName];
        }

        // Try to get normalized bone from humanoid
        if (!this.vrm || !this.vrm.humanoid) return null;

        const bone = this.vrm.humanoid.getNormalizedBoneNode(boneName);
        if (bone) {
            this.boneCache[boneName] = bone;
        }
        return bone;
    }

    // Reset bone to original position/rotation
    resetBone(boneName) {
        const bone = this.boneCache[boneName];
        const original = this.originalTransforms[boneName];
        if (bone && original) {
            bone.rotation.copy(original.rotation);
            bone.position.copy(original.position);
        }
    }

    // Reset all bones
    resetAllBones() {
        Object.keys(this.boneCache).forEach(name => {
            this.resetBone(name);
        });
    }

    // Update VRM (call each frame)
    update(deltaTime) {
        if (this.vrm) {
            this.vrm.update(deltaTime);
        }
    }

    // Dispose of VRM model
    dispose() {
        if (this.vrm) {
            VRMUtils.deepDispose(this.vrm.scene);
            this.scene.remove(this.vrm.scene);
            this.vrm = null;
            this.boneCache = {};
        }
    }
}
