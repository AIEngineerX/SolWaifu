/**
 * Animation Controller - Premium VRM Animation System
 * Inspired by high-quality AI companions like MIA
 * Features: Smooth easing, idle variations, look-at camera, breathing, micro-movements
 */

import * as THREE from 'three';
import { loadMixamoAnimation, createProceduralIdleClip } from './mixamo-loader.js';

// Easing functions for smooth, natural movement
const Easing = {
    // Smooth ease in-out (most natural for living movement)
    easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    // Soft bounce for playful movement
    easeOutBack: (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    // Smooth deceleration
    easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
    // Gentle elastic
    easeOutElastic: (t) => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    }
};

// Smooth interpolation helper
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Smooth angle interpolation
function lerpAngle(start, end, t) {
    let diff = end - start;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return start + diff * t;
}

export class AnimationController {
    constructor(vrmLoader) {
        this.vrmLoader = vrmLoader;
        this.mixer = null;
        this.currentAction = null;
        this.idleAction = null;
        this.state = 'idle';
        this.initialized = false;
        this.time = 0;

        // Smooth animation timing
        this.armTime = 0;
        this.armBones = {};

        // Smooth value storage for interpolation
        this.smoothValues = {
            headRotX: 0, headRotY: 0, headRotZ: 0,
            targetHeadX: 0, targetHeadY: 0, targetHeadZ: 0,
            bodySwayX: 0, bodySwayZ: 0,
            breathPhase: 0
        };

        // Look-at target (camera position or mouse)
        this.lookAtTarget = new THREE.Vector3(0, 1.4, 2);
        this.lookAtEnabled = true;
        this.lookAtSmoothing = 0.03; // Very smooth head tracking

        // Idle variation system
        this.idleVariation = 0;
        this.idleVariationTimer = 0;
        this.idleVariationDuration = 8; // Change every 8 seconds

        // Breathing system
        this.breathRate = 0.2; // Breaths per second (12 per minute = relaxed)
        this.breathDepth = 1.0;

        // Micro-movement system (tiny random movements for life)
        this.microMovements = {
            head: { x: 0, y: 0, z: 0, targetX: 0, targetY: 0, targetZ: 0 },
            body: { x: 0, y: 0, z: 0, targetX: 0, targetY: 0, targetZ: 0 }
        };
        this.microTimer = 0;

        // Expression state
        this.currentExpression = 'neutral';
        this.expressionIntensity = 0.25;
        this.targetExpressionIntensity = 0.25;

        // Blinking - more natural timing
        this.blinkTimer = 0;
        this.blinkInterval = 3.5;
        this.isBlinking = false;
        this.blinkProgress = 0;
        this.doubleBlinkChance = 0.15; // Sometimes double blink
        this.isDoubleBlink = false;

        // Talking
        this.isTalking = false;
        this.talkTime = 0;
        this.talkIntensity = 0;
        this.targetTalkIntensity = 0;

        // Emotion influence on pose
        this.emotionPose = {
            happy: { headTiltZ: 0.05, shoulderRaise: 0.02 },
            sad: { headTiltX: 0.1, shoulderDrop: -0.03 },
            surprised: { headTiltX: -0.05, eyebrowRaise: 1 },
            flirty: { headTiltZ: 0.08, hipSway: 0.03 }
        };
    }

    async initialize() {
        if (this.initialized || !this.vrmLoader.vrm) return;

        const vrm = this.vrmLoader.vrm;

        // Create animation mixer on the VRM scene
        this.mixer = new THREE.AnimationMixer(vrm.scene);

        console.log('Creating premium procedural idle animation...');

        // Create and play procedural idle animation
        const idleClip = createProceduralIdleClip(vrm, 8);
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat);
        this.idleAction.play();

        // Cache ALL bones for smooth procedural animation
        this.armBones = {
            // Core body
            hips: vrm.humanoid.getNormalizedBoneNode('hips'),
            spine: vrm.humanoid.getNormalizedBoneNode('spine'),
            chest: vrm.humanoid.getNormalizedBoneNode('chest'),
            upperChest: vrm.humanoid.getNormalizedBoneNode('upperChest'),
            neck: vrm.humanoid.getNormalizedBoneNode('neck'),
            head: vrm.humanoid.getNormalizedBoneNode('head'),
            // Arms
            leftShoulder: vrm.humanoid.getNormalizedBoneNode('leftShoulder'),
            rightShoulder: vrm.humanoid.getNormalizedBoneNode('rightShoulder'),
            leftUpperArm: vrm.humanoid.getNormalizedBoneNode('leftUpperArm'),
            rightUpperArm: vrm.humanoid.getNormalizedBoneNode('rightUpperArm'),
            leftLowerArm: vrm.humanoid.getNormalizedBoneNode('leftLowerArm'),
            rightLowerArm: vrm.humanoid.getNormalizedBoneNode('rightLowerArm'),
            leftHand: vrm.humanoid.getNormalizedBoneNode('leftHand'),
            rightHand: vrm.humanoid.getNormalizedBoneNode('rightHand'),
            // Fingers
            leftThumbProximal: vrm.humanoid.getNormalizedBoneNode('leftThumbProximal'),
            leftThumbIntermediate: vrm.humanoid.getNormalizedBoneNode('leftThumbIntermediate'),
            leftThumbDistal: vrm.humanoid.getNormalizedBoneNode('leftThumbDistal'),
            leftIndexProximal: vrm.humanoid.getNormalizedBoneNode('leftIndexProximal'),
            leftIndexIntermediate: vrm.humanoid.getNormalizedBoneNode('leftIndexIntermediate'),
            leftIndexDistal: vrm.humanoid.getNormalizedBoneNode('leftIndexDistal'),
            leftMiddleProximal: vrm.humanoid.getNormalizedBoneNode('leftMiddleProximal'),
            leftMiddleIntermediate: vrm.humanoid.getNormalizedBoneNode('leftMiddleIntermediate'),
            leftMiddleDistal: vrm.humanoid.getNormalizedBoneNode('leftMiddleDistal'),
            leftRingProximal: vrm.humanoid.getNormalizedBoneNode('leftRingProximal'),
            leftRingIntermediate: vrm.humanoid.getNormalizedBoneNode('leftRingIntermediate'),
            leftRingDistal: vrm.humanoid.getNormalizedBoneNode('leftRingDistal'),
            leftLittleProximal: vrm.humanoid.getNormalizedBoneNode('leftLittleProximal'),
            leftLittleIntermediate: vrm.humanoid.getNormalizedBoneNode('leftLittleIntermediate'),
            leftLittleDistal: vrm.humanoid.getNormalizedBoneNode('leftLittleDistal'),
            rightThumbProximal: vrm.humanoid.getNormalizedBoneNode('rightThumbProximal'),
            rightThumbIntermediate: vrm.humanoid.getNormalizedBoneNode('rightThumbIntermediate'),
            rightThumbDistal: vrm.humanoid.getNormalizedBoneNode('rightThumbDistal'),
            rightIndexProximal: vrm.humanoid.getNormalizedBoneNode('rightIndexProximal'),
            rightIndexIntermediate: vrm.humanoid.getNormalizedBoneNode('rightIndexIntermediate'),
            rightIndexDistal: vrm.humanoid.getNormalizedBoneNode('rightIndexDistal'),
            rightMiddleProximal: vrm.humanoid.getNormalizedBoneNode('rightMiddleProximal'),
            rightMiddleIntermediate: vrm.humanoid.getNormalizedBoneNode('rightMiddleIntermediate'),
            rightMiddleDistal: vrm.humanoid.getNormalizedBoneNode('rightMiddleDistal'),
            rightRingProximal: vrm.humanoid.getNormalizedBoneNode('rightRingProximal'),
            rightRingIntermediate: vrm.humanoid.getNormalizedBoneNode('rightRingIntermediate'),
            rightRingDistal: vrm.humanoid.getNormalizedBoneNode('rightRingDistal'),
            rightLittleProximal: vrm.humanoid.getNormalizedBoneNode('rightLittleProximal'),
            rightLittleIntermediate: vrm.humanoid.getNormalizedBoneNode('rightLittleIntermediate'),
            rightLittleDistal: vrm.humanoid.getNormalizedBoneNode('rightLittleDistal'),
            // Eyes for look-at
            leftEye: vrm.humanoid.getNormalizedBoneNode('leftEye'),
            rightEye: vrm.humanoid.getNormalizedBoneNode('rightEye')
        };

        console.log('Premium animation system initialized');
        this.initialized = true;

        // Try to load Mixamo animation if available
        this.tryLoadMixamoAnimation();
    }

    async tryLoadMixamoAnimation() {
        const animationPaths = [
            './animations/Happy Idle.fbx',
            './animations/idle.fbx',
            './animations/breathing.fbx',
            './animations/Breathing_Idle.fbx'
        ];

        for (const path of animationPaths) {
            try {
                const clip = await loadMixamoAnimation(path, this.vrmLoader.vrm);
                if (clip) {
                    console.log(`Loaded Mixamo animation from ${path}`);

                    const mixamoAction = this.mixer.clipAction(clip);
                    mixamoAction.setLoop(THREE.LoopRepeat);

                    if (this.idleAction) {
                        mixamoAction.enabled = true;
                        mixamoAction.setEffectiveTimeScale(1);
                        mixamoAction.setEffectiveWeight(1);
                        mixamoAction.crossFadeFrom(this.idleAction, 0.5, true);
                        mixamoAction.play();
                    } else {
                        mixamoAction.play();
                    }

                    this.idleAction = mixamoAction;
                    break;
                }
            } catch (e) {
                // Animation file not found, continue with procedural
            }
        }
    }

    setState(newState) {
        if (this.state === newState) return;
        this.state = newState;

        switch (newState) {
            case 'talking':
                this.isTalking = true;
                this.talkTime = 0;
                this.targetTalkIntensity = 1;
                this.currentExpression = 'happy';
                this.targetExpressionIntensity = 0.5;
                break;
            case 'thinking':
                this.isTalking = false;
                this.targetTalkIntensity = 0;
                this.currentExpression = 'neutral';
                this.targetExpressionIntensity = 0.2;
                break;
            case 'flirty':
                this.isTalking = false;
                this.targetTalkIntensity = 0;
                this.currentExpression = 'happy';
                this.targetExpressionIntensity = 0.7;
                break;
            default:
                this.isTalking = false;
                this.targetTalkIntensity = 0;
                this.currentExpression = 'neutral';
                this.targetExpressionIntensity = 0.25;
        }
    }

    setExpression(name, intensity = 0.5) {
        this.currentExpression = name;
        this.targetExpressionIntensity = intensity;
    }

    // Set look-at target (can be called from main.js with mouse position)
    setLookAtTarget(x, y, z) {
        this.lookAtTarget.set(x, y, z);
    }

    update(deltaTime, elapsedTime) {
        if (!this.vrmLoader.vrm) return;
        if (!this.initialized) {
            this.initialize();
            return;
        }

        const dt = Math.min(deltaTime, 0.1);
        this.time = elapsedTime;
        this.armTime += dt;

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(dt);
        }

        // Update idle variation
        this.updateIdleVariation(dt);

        // Update micro-movements
        this.updateMicroMovements(dt);

        // Update breathing
        this.updateBreathing(dt);

        // Apply smooth procedural animation layers
        this.updateBody(dt);
        this.updateArms(dt);
        this.updateFingers(dt);

        // Update look-at (head and eyes follow target)
        this.updateLookAt(dt);

        // Update expressions
        this.updateExpressions(dt);
    }

    // Idle variation - adds personality changes over time
    updateIdleVariation(dt) {
        this.idleVariationTimer += dt;
        if (this.idleVariationTimer >= this.idleVariationDuration) {
            this.idleVariationTimer = 0;
            this.idleVariation = Math.floor(Math.random() * 4);
            this.idleVariationDuration = 6 + Math.random() * 6;
        }
    }

    // Micro-movements - tiny random motions that make character feel alive
    updateMicroMovements(dt) {
        this.microTimer += dt;

        // Update micro-movement targets periodically
        if (this.microTimer > 0.5 + Math.random() * 0.5) {
            this.microTimer = 0;
            const micro = this.microMovements;

            micro.head.targetX = (Math.random() - 0.5) * 0.02;
            micro.head.targetY = (Math.random() - 0.5) * 0.02;
            micro.head.targetZ = (Math.random() - 0.5) * 0.01;

            micro.body.targetX = (Math.random() - 0.5) * 0.005;
            micro.body.targetZ = (Math.random() - 0.5) * 0.005;
        }

        // Smooth interpolation
        const micro = this.microMovements;
        const microSmooth = 0.02;
        micro.head.x = lerp(micro.head.x, micro.head.targetX, microSmooth);
        micro.head.y = lerp(micro.head.y, micro.head.targetY, microSmooth);
        micro.head.z = lerp(micro.head.z, micro.head.targetZ, microSmooth);
        micro.body.x = lerp(micro.body.x, micro.body.targetX, microSmooth);
        micro.body.z = lerp(micro.body.z, micro.body.targetZ, microSmooth);
    }

    // Natural breathing animation
    updateBreathing(dt) {
        this.smoothValues.breathPhase += dt * this.breathRate * Math.PI * 2;
        if (this.smoothValues.breathPhase > Math.PI * 2) {
            this.smoothValues.breathPhase -= Math.PI * 2;
        }
    }

    // Body animation with smooth weight shifting
    updateBody(dt) {
        const t = this.armTime;
        const bones = this.armBones;
        const breath = Math.sin(this.smoothValues.breathPhase) * this.breathDepth;

        // Get emotion pose modifiers
        const emotionMod = this.emotionPose[this.currentExpression] || {};

        // Hips - smooth weight shifting
        if (bones.hips) {
            const swaySpeed = 0.12 + this.idleVariation * 0.02;
            const swayAmount = 0.03 + (emotionMod.hipSway || 0);

            const targetY = Math.sin(t * swaySpeed * Math.PI * 2) * swayAmount;
            const targetZ = Math.sin(t * swaySpeed * 0.7 * Math.PI * 2) * swayAmount * 0.5;

            this.smoothValues.bodySwayX = lerp(this.smoothValues.bodySwayX, targetY, 0.02);
            this.smoothValues.bodySwayZ = lerp(this.smoothValues.bodySwayZ, targetZ, 0.02);

            bones.hips.rotation.y = this.smoothValues.bodySwayX;
            bones.hips.rotation.z = this.smoothValues.bodySwayZ + this.microMovements.body.z;
        }

        // Spine - breathing and counter-rotation
        if (bones.spine) {
            bones.spine.rotation.x = breath * 0.015 + this.microMovements.body.x;
            bones.spine.rotation.y = -this.smoothValues.bodySwayX * 0.5;
        }

        // Chest - main breathing motion
        if (bones.chest) {
            bones.chest.rotation.x = breath * 0.025;
        }

        // Upper chest - breathing follow-through
        if (bones.upperChest) {
            bones.upperChest.rotation.x = breath * 0.015;
        }
    }

    // Smooth look-at with head and eye tracking
    updateLookAt(dt) {
        if (!this.lookAtEnabled) return;

        const bones = this.armBones;
        const target = this.lookAtTarget;

        // Calculate look direction
        if (bones.head) {
            const headPos = new THREE.Vector3();
            bones.head.getWorldPosition(headPos);

            const direction = new THREE.Vector3().subVectors(target, headPos).normalize();

            // Convert to rotation
            const targetRotY = Math.atan2(direction.x, direction.z);
            const targetRotX = -Math.asin(direction.y) * 0.5; // Dampen vertical

            // Clamp look angles
            const clampedRotY = Math.max(-0.4, Math.min(0.4, targetRotY));
            const clampedRotX = Math.max(-0.2, Math.min(0.3, targetRotX));

            // Add emotion-based head tilt
            const emotionMod = this.emotionPose[this.currentExpression] || {};
            const emotionTiltX = emotionMod.headTiltX || 0;
            const emotionTiltZ = emotionMod.headTiltZ || 0;

            // Smooth interpolation
            this.smoothValues.targetHeadX = clampedRotX + emotionTiltX;
            this.smoothValues.targetHeadY = clampedRotY;
            this.smoothValues.targetHeadZ = emotionTiltZ;

            this.smoothValues.headRotX = lerp(this.smoothValues.headRotX, this.smoothValues.targetHeadX, this.lookAtSmoothing);
            this.smoothValues.headRotY = lerp(this.smoothValues.headRotY, this.smoothValues.targetHeadY, this.lookAtSmoothing);
            this.smoothValues.headRotZ = lerp(this.smoothValues.headRotZ, this.smoothValues.targetHeadZ, this.lookAtSmoothing);

            // Apply with micro-movements
            bones.head.rotation.x = this.smoothValues.headRotX + this.microMovements.head.x;
            bones.head.rotation.y = this.smoothValues.headRotY + this.microMovements.head.y;
            bones.head.rotation.z = this.smoothValues.headRotZ + this.microMovements.head.z;
        }

        // Neck follows head partially
        if (bones.neck) {
            bones.neck.rotation.x = this.smoothValues.headRotX * 0.3;
            bones.neck.rotation.y = this.smoothValues.headRotY * 0.4;
        }

        // Eyes look more than head
        const eyeMultiplier = 1.5;
        if (bones.leftEye) {
            bones.leftEye.rotation.x = this.smoothValues.headRotX * eyeMultiplier * 0.5;
            bones.leftEye.rotation.y = this.smoothValues.headRotY * eyeMultiplier;
        }
        if (bones.rightEye) {
            bones.rightEye.rotation.x = this.smoothValues.headRotX * eyeMultiplier * 0.5;
            bones.rightEye.rotation.y = this.smoothValues.headRotY * eyeMultiplier;
        }
    }

    // Smooth arm animation
    updateArms(dt) {
        const t = this.armTime;
        const bones = this.armBones;

        // Arm sway based on idle variation
        const swayMultiplier = 1 + this.idleVariation * 0.2;

        // Left upper arm
        if (bones.leftUpperArm) {
            const baseZ = 1.1;
            const targetX = 0.15 + Math.sin(t * 0.7) * 0.04 * swayMultiplier;
            const targetY = 0.1 + Math.sin(t * 0.9) * 0.03;
            const targetZ = baseZ + Math.sin(t * 0.5) * 0.08 * swayMultiplier + Math.sin(t * 1.1) * 0.04;

            bones.leftUpperArm.rotation.x = lerp(bones.leftUpperArm.rotation.x, targetX, 0.05);
            bones.leftUpperArm.rotation.y = lerp(bones.leftUpperArm.rotation.y, targetY, 0.05);
            bones.leftUpperArm.rotation.z = lerp(bones.leftUpperArm.rotation.z, targetZ, 0.05);
        }

        // Right upper arm
        if (bones.rightUpperArm) {
            const baseZ = -1.1;
            const targetX = 0.15 + Math.sin(t * 0.7 + 0.5) * 0.04 * swayMultiplier;
            const targetY = -0.1 + Math.sin(t * 0.9 + 0.5) * 0.03;
            const targetZ = baseZ + Math.sin(t * 0.5 + Math.PI) * 0.08 * swayMultiplier + Math.sin(t * 1.1 + Math.PI) * 0.04;

            bones.rightUpperArm.rotation.x = lerp(bones.rightUpperArm.rotation.x, targetX, 0.05);
            bones.rightUpperArm.rotation.y = lerp(bones.rightUpperArm.rotation.y, targetY, 0.05);
            bones.rightUpperArm.rotation.z = lerp(bones.rightUpperArm.rotation.z, targetZ, 0.05);
        }

        // Forearms
        if (bones.leftLowerArm) {
            const targetY = -0.4 + Math.sin(t * 0.8) * 0.1;
            bones.leftLowerArm.rotation.y = lerp(bones.leftLowerArm.rotation.y, targetY, 0.05);
            bones.leftLowerArm.rotation.z = Math.sin(t * 0.6) * 0.04;
        }

        if (bones.rightLowerArm) {
            const targetY = 0.4 + Math.sin(t * 0.8 + Math.PI) * 0.1;
            bones.rightLowerArm.rotation.y = lerp(bones.rightLowerArm.rotation.y, targetY, 0.05);
            bones.rightLowerArm.rotation.z = Math.sin(t * 0.6 + Math.PI) * 0.04;
        }

        // Hands
        if (bones.leftHand) {
            bones.leftHand.rotation.x = 0.1 + Math.sin(t * 1.2) * 0.06;
            bones.leftHand.rotation.z = Math.sin(t * 0.7) * 0.05;
        }

        if (bones.rightHand) {
            bones.rightHand.rotation.x = 0.1 + Math.sin(t * 1.2 + 0.3) * 0.06;
            bones.rightHand.rotation.z = Math.sin(t * 0.7 + 0.3) * 0.05;
        }

        // Shoulders
        if (bones.leftShoulder) {
            const emotionMod = this.emotionPose[this.currentExpression] || {};
            bones.leftShoulder.rotation.z = Math.sin(t * 0.4) * 0.02 + (emotionMod.shoulderRaise || 0);
        }

        if (bones.rightShoulder) {
            const emotionMod = this.emotionPose[this.currentExpression] || {};
            bones.rightShoulder.rotation.z = Math.sin(t * 0.4 + 0.2) * 0.02 + (emotionMod.shoulderRaise || 0);
        }
    }

    // Natural finger movement
    updateFingers(dt) {
        const t = this.armTime;
        const bones = this.armBones;

        // Relaxed finger poses
        const relaxedProximal = 0.12;
        const relaxedIntermediate = 0.18;
        const relaxedDistal = 0.08;

        // Left hand
        const leftFingers = ['Index', 'Middle', 'Ring', 'Little'];
        leftFingers.forEach((finger, i) => {
            const offset = i * 0.4;
            const wave = Math.sin(t * 0.4 + offset);

            const proximal = bones[`left${finger}Proximal`];
            const intermediate = bones[`left${finger}Intermediate`];
            const distal = bones[`left${finger}Distal`];

            if (proximal) proximal.rotation.z = relaxedProximal + wave * 0.02;
            if (intermediate) intermediate.rotation.z = relaxedIntermediate + wave * 0.015;
            if (distal) distal.rotation.z = relaxedDistal + wave * 0.01;
        });

        // Left thumb
        if (bones.leftThumbProximal) bones.leftThumbProximal.rotation.z = 0.08;
        if (bones.leftThumbIntermediate) bones.leftThumbIntermediate.rotation.z = 0.12;
        if (bones.leftThumbDistal) bones.leftThumbDistal.rotation.z = 0.04;

        // Right hand
        const rightFingers = ['Index', 'Middle', 'Ring', 'Little'];
        rightFingers.forEach((finger, i) => {
            const offset = i * 0.4 + 0.5;
            const wave = Math.sin(t * 0.4 + offset);

            const proximal = bones[`right${finger}Proximal`];
            const intermediate = bones[`right${finger}Intermediate`];
            const distal = bones[`right${finger}Distal`];

            if (proximal) proximal.rotation.z = -relaxedProximal + wave * 0.02;
            if (intermediate) intermediate.rotation.z = -relaxedIntermediate + wave * 0.015;
            if (distal) distal.rotation.z = -relaxedDistal + wave * 0.01;
        });

        // Right thumb
        if (bones.rightThumbProximal) bones.rightThumbProximal.rotation.z = -0.08;
        if (bones.rightThumbIntermediate) bones.rightThumbIntermediate.rotation.z = -0.12;
        if (bones.rightThumbDistal) bones.rightThumbDistal.rotation.z = -0.04;
    }

    updateExpressions(deltaTime) {
        if (!this.vrmLoader.vrm) return;

        // Smooth expression transitions
        this.expressionIntensity = lerp(this.expressionIntensity, this.targetExpressionIntensity, 0.08);
        this.talkIntensity = lerp(this.talkIntensity, this.targetTalkIntensity, 0.1);

        // Reset expressions
        this.vrmLoader.resetExpressions();

        // Apply current expression
        switch (this.currentExpression) {
            case 'happy':
                this.vrmLoader.setHappy(this.expressionIntensity);
                break;
            case 'sad':
                this.vrmLoader.setSad(this.expressionIntensity);
                break;
            case 'surprised':
                this.vrmLoader.setSurprised(this.expressionIntensity);
                break;
            case 'angry':
                this.vrmLoader.setAngry(this.expressionIntensity);
                break;
            default:
                this.vrmLoader.setHappy(this.expressionIntensity * 0.2);
        }

        // Blinking
        this.updateBlinking(deltaTime);

        // Talking mouth
        if (this.isTalking && this.talkIntensity > 0.1) {
            this.talkTime += deltaTime;

            // More natural talking pattern with multiple frequencies
            const base = Math.abs(Math.sin(this.talkTime * 10));
            const variation = Math.abs(Math.sin(this.talkTime * 6.7)) * 0.3;
            const pause = Math.sin(this.talkTime * 1.8) > 0.5 ? 0.4 : 1;

            const mouthOpen = (base * 0.35 + variation) * pause * this.talkIntensity;
            this.vrmLoader.setMouthOpen(mouthOpen * 0.6);
        }

        // Flirty state effects
        if (this.state === 'flirty') {
            const stateTime = this.time;
            if (stateTime % 4 > 0.3 && stateTime % 4 < 0.9) {
                this.vrmLoader.setWink(true);
            }
        }
    }

    updateBlinking(deltaTime) {
        this.blinkTimer += deltaTime;

        if (this.isBlinking) {
            this.blinkProgress += deltaTime * 12; // Faster blink

            if (this.blinkProgress >= 1) {
                if (this.isDoubleBlink && this.blinkProgress < 1.3) {
                    // Second blink of double blink
                } else {
                    this.isBlinking = false;
                    this.isDoubleBlink = false;
                    this.blinkProgress = 0;
                }
            }

            // Natural blink curve
            let blinkVal;
            const p = this.blinkProgress % 1;
            if (p < 0.3) {
                blinkVal = Easing.easeOutQuad(p / 0.3);
            } else {
                blinkVal = 1 - Easing.easeInOutSine((p - 0.3) / 0.7);
            }

            this.vrmLoader.setBlink(Math.max(0, Math.min(1, blinkVal)));

        } else if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;
            this.blinkInterval = 2.5 + Math.random() * 4;
            this.isBlinking = true;
            this.blinkProgress = 0;
            this.isDoubleBlink = Math.random() < this.doubleBlinkChance;
        }
    }

    // Public API
    stopTalking() {
        this.setState('idle');
        this.setExpression('happy', 0.3);
        setTimeout(() => this.setExpression('neutral', 0.25), 500);
    }

    playReaction(type) {
        switch (type) {
            case 'excited':
                this.setExpression('happy', 0.9);
                setTimeout(() => this.setExpression('neutral', 0.25), 1500);
                break;
            case 'confused':
                this.setExpression('surprised', 0.6);
                setTimeout(() => this.setExpression('neutral', 0.25), 1000);
                break;
            case 'flirty':
                this.setState('flirty');
                setTimeout(() => this.setState('idle'), 2500);
                break;
            case 'thinking':
                this.setState('thinking');
                break;
            case 'laugh':
                this.setExpression('happy', 1);
                this.triggerLaugh();
                break;
            case 'shy':
                this.setExpression('happy', 0.6);
                setTimeout(() => this.setExpression('neutral', 0.25), 1200);
                break;
        }
    }

    triggerLaugh() {
        let t = 0;
        const laugh = () => {
            t += 0.016;
            const decay = 1 - t / 1.4;
            if (decay > 0) {
                const bounce = Easing.easeOutElastic(Math.min(1, t * 2));
                this.vrmLoader.setMouthOpen((Math.sin(t * 18) * 0.25 + 0.45) * decay * bounce);
                requestAnimationFrame(laugh);
            } else {
                this.vrmLoader.setMouthOpen(0);
                this.setExpression('neutral', 0.25);
            }
        };
        laugh();
    }
}
