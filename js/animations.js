/**
 * Animation Controller - Simple working VRM animation
 * Uses RAW bones (getRawBoneNode) for direct manipulation
 */

import * as THREE from 'three';

export class AnimationController {
    constructor(vrmLoader) {
        this.vrmLoader = vrmLoader;
        this.time = 0;
        this.bones = {};
        this.initialized = false;

        // State
        this.state = 'idle';
        this.isTalking = false;
        this.talkTime = 0;

        // Blinking
        this.blinkTimer = 0;
        this.blinkInterval = 3;
        this.isBlinking = false;
        this.blinkProgress = 0;

        // Look at
        this.lookAtTarget = new THREE.Vector3(0, 1.4, 2);
    }

    initialize() {
        if (this.initialized) return;
        if (!this.vrmLoader.vrm?.humanoid) return;

        const h = this.vrmLoader.vrm.humanoid;

        // Cache RAW bones - these can be directly manipulated
        this.bones = {
            hips: h.getRawBoneNode('hips'),
            spine: h.getRawBoneNode('spine'),
            chest: h.getRawBoneNode('chest'),
            upperChest: h.getRawBoneNode('upperChest'),
            neck: h.getRawBoneNode('neck'),
            head: h.getRawBoneNode('head'),
            leftShoulder: h.getRawBoneNode('leftShoulder'),
            rightShoulder: h.getRawBoneNode('rightShoulder'),
            leftUpperArm: h.getRawBoneNode('leftUpperArm'),
            rightUpperArm: h.getRawBoneNode('rightUpperArm'),
            leftLowerArm: h.getRawBoneNode('leftLowerArm'),
            rightLowerArm: h.getRawBoneNode('rightLowerArm'),
            leftHand: h.getRawBoneNode('leftHand'),
            rightHand: h.getRawBoneNode('rightHand'),
            leftUpperLeg: h.getRawBoneNode('leftUpperLeg'),
            rightUpperLeg: h.getRawBoneNode('rightUpperLeg'),
            leftLowerLeg: h.getRawBoneNode('leftLowerLeg'),
            rightLowerLeg: h.getRawBoneNode('rightLowerLeg')
        };

        // Store initial rotations (the model's bind pose)
        this.bindPose = {};
        for (const [name, bone] of Object.entries(this.bones)) {
            if (bone) {
                this.bindPose[name] = {
                    x: bone.rotation.x,
                    y: bone.rotation.y,
                    z: bone.rotation.z
                };
            }
        }

        console.log('Animation system initialized with RAW bones');
        console.log('Bind pose captured:', this.bindPose);
        this.initialized = true;
    }

    setLookAtTarget(x, y, z) {
        this.lookAtTarget.set(x, y, z);
    }

    setState(newState) {
        this.state = newState;
        this.isTalking = newState === 'talking';
        if (this.isTalking) this.talkTime = 0;
    }

    setExpression(name, intensity = 0.5) {
        // Handled externally
    }

    stopTalking() {
        this.setState('idle');
    }

    playReaction(type) {
        // Simple reactions
    }

    update(deltaTime, elapsedTime) {
        if (!this.vrmLoader.vrm) return;

        if (!this.initialized) {
            this.initialize();
            if (!this.initialized) return;
        }

        const dt = Math.min(deltaTime, 0.1);
        this.time = elapsedTime;

        // Apply idle animation
        this.applyIdleAnimation(dt);

        // Apply expressions
        this.updateExpressions(dt);
    }

    applyIdleAnimation(dt) {
        const t = this.time;
        const b = this.bones;
        const bp = this.bindPose;

        // Breathing cycle
        const breathSpeed = 0.8;
        const breath = Math.sin(t * breathSpeed) * 0.5 + 0.5; // 0 to 1

        // Idle sway (very slow)
        const swaySpeed = 0.3;
        const sway = Math.sin(t * swaySpeed);
        const sway2 = Math.sin(t * swaySpeed * 0.7 + 1);

        // === SPINE - Breathing ===
        if (b.spine && bp.spine) {
            b.spine.rotation.x = bp.spine.x + breath * 0.02;
        }

        if (b.chest && bp.chest) {
            b.chest.rotation.x = bp.chest.x + breath * 0.025;
        }

        if (b.upperChest && bp.upperChest) {
            b.upperChest.rotation.x = bp.upperChest.x + breath * 0.015;
        }

        // === HIPS - Subtle sway ===
        if (b.hips && bp.hips) {
            b.hips.rotation.y = bp.hips.y + sway * 0.03;
            b.hips.rotation.z = bp.hips.z + sway2 * 0.015;
        }

        // === HEAD - Look at with gentle movement ===
        if (b.head && bp.head) {
            // Simple head tilt animation
            b.head.rotation.z = bp.head.z + sway * 0.02 + 0.03; // Slight tilt
            b.head.rotation.y = bp.head.y + sway2 * 0.03;
        }

        // === NECK ===
        if (b.neck && bp.neck) {
            b.neck.rotation.y = bp.neck.y + sway2 * 0.02;
        }

        // === SHOULDERS - Breathing rise ===
        if (b.leftShoulder && bp.leftShoulder) {
            b.leftShoulder.rotation.z = bp.leftShoulder.z + breath * 0.01;
        }
        if (b.rightShoulder && bp.rightShoulder) {
            b.rightShoulder.rotation.z = bp.rightShoulder.z - breath * 0.01;
        }

        // === ARMS - Gentle sway ===
        // We add SMALL offsets to the bind pose, not replace it
        if (b.leftUpperArm && bp.leftUpperArm) {
            b.leftUpperArm.rotation.z = bp.leftUpperArm.z + sway * 0.02;
        }
        if (b.rightUpperArm && bp.rightUpperArm) {
            b.rightUpperArm.rotation.z = bp.rightUpperArm.z - sway * 0.02;
        }

        if (b.leftLowerArm && bp.leftLowerArm) {
            b.leftLowerArm.rotation.y = bp.leftLowerArm.y + sway2 * 0.03;
        }
        if (b.rightLowerArm && bp.rightLowerArm) {
            b.rightLowerArm.rotation.y = bp.rightLowerArm.y - sway2 * 0.03;
        }

        // === HANDS - Subtle movement ===
        if (b.leftHand && bp.leftHand) {
            b.leftHand.rotation.z = bp.leftHand.z + sway * 0.02;
        }
        if (b.rightHand && bp.rightHand) {
            b.rightHand.rotation.z = bp.rightHand.z - sway * 0.02;
        }
    }

    updateExpressions(dt) {
        // Blinking
        this.blinkTimer += dt;

        if (this.isBlinking) {
            this.blinkProgress += dt * 10;
            if (this.blinkProgress >= 1) {
                this.isBlinking = false;
                this.blinkProgress = 0;
                this.vrmLoader.setBlink(0);
            } else {
                // Blink curve
                const blinkVal = this.blinkProgress < 0.3
                    ? this.blinkProgress / 0.3
                    : 1 - (this.blinkProgress - 0.3) / 0.7;
                this.vrmLoader.setBlink(blinkVal);
            }
        } else if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;
            this.blinkInterval = 2.5 + Math.random() * 3;
            this.isBlinking = true;
            this.blinkProgress = 0;
        }

        // Talking
        if (this.isTalking) {
            this.talkTime += dt;
            const mouth = (Math.sin(this.talkTime * 10) * 0.5 + 0.5) * 0.4;
            this.vrmLoader.setMouthOpen(mouth);
        }

        // Subtle smile
        this.vrmLoader.setHappy(0.15);
    }
}
