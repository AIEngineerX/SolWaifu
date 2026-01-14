/**
 * Animation Controller - Ultra-Smooth VRM Animation System
 * Clean architecture with frame-rate independent interpolation
 * Eliminates jitter through proper delta-time based smoothing
 */

import * as THREE from 'three';

// Frame-rate independent smooth interpolation
function smoothDamp(current, target, velocity, smoothTime, deltaTime) {
    // Based on Game Programming Gems 4 smooth damp
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = current - target;
    const temp = (velocity + omega * change) * deltaTime;
    velocity = (velocity - omega * temp) * exp;
    return {
        value: target + (change + temp) * exp,
        velocity: velocity
    };
}

// Simple lerp with delta-time factor
function dLerp(current, target, speed, dt) {
    const t = 1 - Math.pow(1 - speed, dt * 60);
    return current + (target - t) * t;
}

// Smooth step for easing
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

export class AnimationController {
    constructor(vrmLoader) {
        this.vrmLoader = vrmLoader;
        this.initialized = false;
        this.time = 0;

        // Bone cache
        this.bones = {};

        // Animation state
        this.state = 'idle';
        this.isTalking = false;
        this.talkTime = 0;

        // Current values with velocities for smooth damping
        this.current = {
            // Head
            headX: 0, headY: 0, headZ: 0,
            headVelX: 0, headVelY: 0, headVelZ: 0,
            // Neck
            neckX: 0, neckY: 0,
            neckVelX: 0, neckVelY: 0,
            // Body sway
            hipsX: 0, hipsY: 0, hipsZ: 0,
            hipsVelX: 0, hipsVelY: 0, hipsVelZ: 0,
            // Spine
            spineX: 0, spineY: 0, spineZ: 0,
            // Chest breathing
            chestX: 0, chestY: 0,
            upperChestX: 0,
            // Arms - left (natural hanging position)
            leftUpperArmX: 0.05, leftUpperArmY: 0.05, leftUpperArmZ: 0.15,
            leftLowerArmY: -0.15, leftLowerArmZ: 0.02,
            leftHandX: -0.05, leftHandZ: 0.03,
            // Arms - right
            rightUpperArmX: 0.06, rightUpperArmY: -0.04, rightUpperArmZ: -0.12,
            rightLowerArmY: 0.12, rightLowerArmZ: -0.02,
            rightHandX: -0.05, rightHandZ: -0.03,
            // Expression
            expressionIntensity: 0.25,
            talkIntensity: 0,
            blinkValue: 0
        };

        // Target values
        this.target = { ...this.current };

        // Look-at system
        this.lookAtTarget = new THREE.Vector3(0, 1.4, 2);
        this.lookAtEnabled = true;

        // Smoothing times (higher = smoother but slower)
        this.smoothTime = {
            head: 0.15,      // Head follows mouse smoothly
            neck: 0.2,       // Neck even smoother
            body: 0.4,       // Body sway very smooth
            arms: 0.25,      // Arms gentle movement
            expression: 0.12 // Expressions responsive
        };

        // Breathing
        this.breathPhase = 0;
        this.breathRate = 0.18; // Breaths per second

        // Idle variation
        this.idlePhase = 0;
        this.idleSpeed = 0.08; // Very slow variation

        // Blinking
        this.blinkTimer = 0;
        this.blinkInterval = 3.5;
        this.isBlinking = false;
        this.blinkProgress = 0;

        // Expression
        this.currentExpression = 'neutral';
        this.targetExpressionIntensity = 0.25;
    }

    async initialize() {
        if (this.initialized || !this.vrmLoader.vrm) return;

        const vrm = this.vrmLoader.vrm;

        // Cache all bones
        this.bones = {
            hips: vrm.humanoid.getNormalizedBoneNode('hips'),
            spine: vrm.humanoid.getNormalizedBoneNode('spine'),
            chest: vrm.humanoid.getNormalizedBoneNode('chest'),
            upperChest: vrm.humanoid.getNormalizedBoneNode('upperChest'),
            neck: vrm.humanoid.getNormalizedBoneNode('neck'),
            head: vrm.humanoid.getNormalizedBoneNode('head'),
            leftShoulder: vrm.humanoid.getNormalizedBoneNode('leftShoulder'),
            rightShoulder: vrm.humanoid.getNormalizedBoneNode('rightShoulder'),
            leftUpperArm: vrm.humanoid.getNormalizedBoneNode('leftUpperArm'),
            rightUpperArm: vrm.humanoid.getNormalizedBoneNode('rightUpperArm'),
            leftLowerArm: vrm.humanoid.getNormalizedBoneNode('leftLowerArm'),
            rightLowerArm: vrm.humanoid.getNormalizedBoneNode('rightLowerArm'),
            leftHand: vrm.humanoid.getNormalizedBoneNode('leftHand'),
            rightHand: vrm.humanoid.getNormalizedBoneNode('rightHand'),
            leftUpperLeg: vrm.humanoid.getNormalizedBoneNode('leftUpperLeg'),
            rightUpperLeg: vrm.humanoid.getNormalizedBoneNode('rightUpperLeg'),
            leftLowerLeg: vrm.humanoid.getNormalizedBoneNode('leftLowerLeg'),
            rightLowerLeg: vrm.humanoid.getNormalizedBoneNode('rightLowerLeg'),
            leftEye: vrm.humanoid.getNormalizedBoneNode('leftEye'),
            rightEye: vrm.humanoid.getNormalizedBoneNode('rightEye'),
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
            rightLittleDistal: vrm.humanoid.getNormalizedBoneNode('rightLittleDistal')
        };

        console.log('Ultra-smooth animation system initialized');
        this.initialized = true;
    }

    setLookAtTarget(x, y, z) {
        this.lookAtTarget.set(x, y, z);
    }

    setState(newState) {
        if (this.state === newState) return;
        this.state = newState;

        switch (newState) {
            case 'talking':
                this.isTalking = true;
                this.talkTime = 0;
                this.target.talkIntensity = 1;
                this.currentExpression = 'happy';
                this.targetExpressionIntensity = 0.5;
                break;
            case 'thinking':
                this.isTalking = false;
                this.target.talkIntensity = 0;
                this.currentExpression = 'neutral';
                this.targetExpressionIntensity = 0.3;
                break;
            case 'flirty':
                this.isTalking = false;
                this.target.talkIntensity = 0;
                this.currentExpression = 'happy';
                this.targetExpressionIntensity = 0.7;
                break;
            default:
                this.isTalking = false;
                this.target.talkIntensity = 0;
                this.currentExpression = 'neutral';
                this.targetExpressionIntensity = 0.25;
        }
    }

    setExpression(name, intensity = 0.5) {
        this.currentExpression = name;
        this.targetExpressionIntensity = intensity;
    }

    update(deltaTime, elapsedTime) {
        if (!this.vrmLoader.vrm) return;

        if (!this.initialized) {
            this.initialize();
            return;
        }

        // Clamp delta to prevent jumps
        const dt = Math.min(deltaTime, 0.05);
        this.time = elapsedTime;

        // Update phase timers
        this.breathPhase += dt * this.breathRate * Math.PI * 2;
        this.idlePhase += dt * this.idleSpeed * Math.PI * 2;

        // Calculate target values based on animations
        this.calculateTargets(dt);

        // Smooth damp all values
        this.smoothUpdate(dt);

        // Apply to bones
        this.applyToBones();

        // Update expressions
        this.updateExpressions(dt);
    }

    calculateTargets(dt) {
        const breath = Math.sin(this.breathPhase);
        const idle1 = Math.sin(this.idlePhase);
        const idle2 = Math.sin(this.idlePhase * 0.7 + 1);
        const idle3 = Math.sin(this.idlePhase * 1.3 + 2);

        // === HEAD LOOK-AT ===
        if (this.lookAtEnabled && this.bones.head) {
            const headPos = new THREE.Vector3();
            this.bones.head.getWorldPosition(headPos);

            const direction = new THREE.Vector3()
                .subVectors(this.lookAtTarget, headPos)
                .normalize();

            // Calculate look angles
            const lookY = Math.atan2(direction.x, direction.z);
            const lookX = -Math.asin(Math.max(-1, Math.min(1, direction.y))) * 0.4;

            // Clamp to natural range
            this.target.headY = Math.max(-0.5, Math.min(0.5, lookY));
            this.target.headX = Math.max(-0.25, Math.min(0.35, lookX));
            // Flirty head tilt - slight consistent tilt with subtle variation
            this.target.headZ = 0.04 + idle1 * 0.025;
        }

        // Neck follows head partially
        this.target.neckY = this.target.headY * 0.35;
        this.target.neckX = this.target.headX * 0.25;

        // === BODY SWAY - Flowing natural movement ===
        // More movement in hips for feminine sway
        this.target.hipsY = idle1 * 0.04 + idle2 * 0.02;
        this.target.hipsZ = 0.02 + idle2 * 0.025; // Hip tilt with sway
        this.target.hipsX = idle3 * 0.015; // Forward/back hip movement

        // === SPINE / BREATHING - More flowing ===
        this.target.spineX = breath * 0.02 + idle1 * 0.01;
        this.target.spineY = -this.target.hipsY * 0.6; // Counter-rotate spine
        this.target.spineZ = idle2 * 0.015; // Side bend
        this.target.chestX = breath * 0.03 + idle3 * 0.008;
        this.target.chestY = idle1 * 0.02; // Chest twist
        this.target.upperChestX = breath * 0.015;

        // === ARMS - Natural hanging, close to body ===
        const armSway = idle3 * 0.02;

        // Left arm - hanging naturally at side
        this.target.leftUpperArmX = 0.05 + idle1 * 0.03; // Slight forward
        this.target.leftUpperArmY = 0.05 + idle2 * 0.02; // Minimal rotation
        this.target.leftUpperArmZ = 0.15 + idle1 * 0.04 + armSway; // Close to body!
        this.target.leftLowerArmY = -0.15 + idle2 * 0.08; // Natural bend
        this.target.leftLowerArmZ = 0.02 + idle3 * 0.03;
        this.target.leftHandX = -0.05 + idle1 * 0.04; // Relaxed wrist
        this.target.leftHandZ = 0.03 + idle2 * 0.02;

        // Right arm - slightly different for asymmetry
        this.target.rightUpperArmX = 0.06 + idle1 * 0.025;
        this.target.rightUpperArmY = -0.04 + idle2 * 0.02;
        this.target.rightUpperArmZ = -0.12 - idle1 * 0.04 - armSway; // Close to body!
        this.target.rightLowerArmY = 0.12 - idle2 * 0.08;
        this.target.rightLowerArmZ = -0.02 - idle3 * 0.03;
        this.target.rightHandX = -0.05 + idle1 * 0.04;
        this.target.rightHandZ = -0.03 - idle2 * 0.02;
    }

    smoothUpdate(dt) {
        const c = this.current;
        const t = this.target;
        const st = this.smoothTime;
        let result;

        // Head - smooth damp for natural movement
        result = smoothDamp(c.headX, t.headX, c.headVelX, st.head, dt);
        c.headX = result.value; c.headVelX = result.velocity;

        result = smoothDamp(c.headY, t.headY, c.headVelY, st.head, dt);
        c.headY = result.value; c.headVelY = result.velocity;

        result = smoothDamp(c.headZ, t.headZ, c.headVelZ, st.head, dt);
        c.headZ = result.value; c.headVelZ = result.velocity;

        // Neck
        result = smoothDamp(c.neckX, t.neckX, c.neckVelX, st.neck, dt);
        c.neckX = result.value; c.neckVelX = result.velocity;

        result = smoothDamp(c.neckY, t.neckY, c.neckVelY, st.neck, dt);
        c.neckY = result.value; c.neckVelY = result.velocity;

        // Body - extra smooth
        result = smoothDamp(c.hipsX, t.hipsX, c.hipsVelX, st.body, dt);
        c.hipsX = result.value; c.hipsVelX = result.velocity;

        result = smoothDamp(c.hipsY, t.hipsY, c.hipsVelY, st.body, dt);
        c.hipsY = result.value; c.hipsVelY = result.velocity;

        result = smoothDamp(c.hipsZ, t.hipsZ, c.hipsVelZ, st.body, dt);
        c.hipsZ = result.value; c.hipsVelZ = result.velocity;

        // Spine/chest - direct smooth (no velocity needed, slow movement)
        const bodyFactor = 1 - Math.pow(0.03, dt); // Slower for more fluid movement
        c.spineX += (t.spineX - c.spineX) * bodyFactor;
        c.spineY += (t.spineY - c.spineY) * bodyFactor;
        c.spineZ += (t.spineZ - c.spineZ) * bodyFactor;
        c.chestX += (t.chestX - c.chestX) * bodyFactor;
        c.chestY += (t.chestY - c.chestY) * bodyFactor;
        c.upperChestX += (t.upperChestX - c.upperChestX) * bodyFactor;

        // Arms - smooth interpolation
        const armFactor = 1 - Math.pow(0.08, dt);
        c.leftUpperArmX += (t.leftUpperArmX - c.leftUpperArmX) * armFactor;
        c.leftUpperArmY += (t.leftUpperArmY - c.leftUpperArmY) * armFactor;
        c.leftUpperArmZ += (t.leftUpperArmZ - c.leftUpperArmZ) * armFactor;
        c.leftLowerArmY += (t.leftLowerArmY - c.leftLowerArmY) * armFactor;
        c.leftLowerArmZ += (t.leftLowerArmZ - c.leftLowerArmZ) * armFactor;
        c.leftHandX += (t.leftHandX - c.leftHandX) * armFactor;
        c.leftHandZ += (t.leftHandZ - c.leftHandZ) * armFactor;

        c.rightUpperArmX += (t.rightUpperArmX - c.rightUpperArmX) * armFactor;
        c.rightUpperArmY += (t.rightUpperArmY - c.rightUpperArmY) * armFactor;
        c.rightUpperArmZ += (t.rightUpperArmZ - c.rightUpperArmZ) * armFactor;
        c.rightLowerArmY += (t.rightLowerArmY - c.rightLowerArmY) * armFactor;
        c.rightLowerArmZ += (t.rightLowerArmZ - c.rightLowerArmZ) * armFactor;
        c.rightHandX += (t.rightHandX - c.rightHandX) * armFactor;
        c.rightHandZ += (t.rightHandZ - c.rightHandZ) * armFactor;

        // Expressions
        const exprFactor = 1 - Math.pow(0.1, dt);
        c.expressionIntensity += (this.targetExpressionIntensity - c.expressionIntensity) * exprFactor;
        c.talkIntensity += (t.talkIntensity - c.talkIntensity) * exprFactor;
    }

    applyToBones() {
        const b = this.bones;
        const c = this.current;

        // Head
        if (b.head) {
            b.head.rotation.x = c.headX;
            b.head.rotation.y = c.headY;
            b.head.rotation.z = c.headZ;
        }

        // Neck
        if (b.neck) {
            b.neck.rotation.x = c.neckX;
            b.neck.rotation.y = c.neckY;
        }

        // Hips - full flowing movement
        if (b.hips) {
            b.hips.rotation.x = c.hipsX;
            b.hips.rotation.y = c.hipsY;
            b.hips.rotation.z = c.hipsZ;
        }

        // Spine - flowing counter-rotation
        if (b.spine) {
            b.spine.rotation.x = c.spineX;
            b.spine.rotation.y = c.spineY;
            b.spine.rotation.z = c.spineZ;
        }

        // Chest - breathing and twist
        if (b.chest) {
            b.chest.rotation.x = c.chestX;
            b.chest.rotation.y = c.chestY;
        }

        // Upper chest
        if (b.upperChest) {
            b.upperChest.rotation.x = c.upperChestX;
        }

        // Left arm
        if (b.leftUpperArm) {
            b.leftUpperArm.rotation.x = c.leftUpperArmX;
            b.leftUpperArm.rotation.y = c.leftUpperArmY;
            b.leftUpperArm.rotation.z = c.leftUpperArmZ;
        }
        if (b.leftLowerArm) {
            b.leftLowerArm.rotation.y = c.leftLowerArmY;
            b.leftLowerArm.rotation.z = c.leftLowerArmZ;
        }
        if (b.leftHand) {
            b.leftHand.rotation.x = c.leftHandX;
            b.leftHand.rotation.z = c.leftHandZ;
        }

        // Right arm
        if (b.rightUpperArm) {
            b.rightUpperArm.rotation.x = c.rightUpperArmX;
            b.rightUpperArm.rotation.y = c.rightUpperArmY;
            b.rightUpperArm.rotation.z = c.rightUpperArmZ;
        }
        if (b.rightLowerArm) {
            b.rightLowerArm.rotation.y = c.rightLowerArmY;
            b.rightLowerArm.rotation.z = c.rightLowerArmZ;
        }
        if (b.rightHand) {
            b.rightHand.rotation.x = c.rightHandX;
            b.rightHand.rotation.z = c.rightHandZ;
        }

        // Shoulders - subtle breathing motion
        const shoulderBreath = Math.sin(this.breathPhase) * 0.01;
        if (b.leftShoulder) {
            b.leftShoulder.rotation.z = shoulderBreath;
        }
        if (b.rightShoulder) {
            b.rightShoulder.rotation.z = -shoulderBreath;
        }

        // Legs - subtle weight shift
        const legShift = Math.sin(this.idlePhase * 0.5) * 0.015;
        if (b.leftUpperLeg) {
            b.leftUpperLeg.rotation.x = legShift;
            b.leftUpperLeg.rotation.z = -0.01 + legShift * 0.5;
        }
        if (b.rightUpperLeg) {
            b.rightUpperLeg.rotation.x = -legShift;
            b.rightUpperLeg.rotation.z = 0.01 - legShift * 0.5;
        }
        if (b.leftLowerLeg) {
            b.leftLowerLeg.rotation.x = 0.02 + legShift * 0.8;
        }
        if (b.rightLowerLeg) {
            b.rightLowerLeg.rotation.x = 0.02 - legShift * 0.8;
        }

        // Eyes follow head direction more
        const eyeMultiplier = 0.8;
        if (b.leftEye) {
            b.leftEye.rotation.x = c.headX * eyeMultiplier * 0.3;
            b.leftEye.rotation.y = c.headY * eyeMultiplier;
        }
        if (b.rightEye) {
            b.rightEye.rotation.x = c.headX * eyeMultiplier * 0.3;
            b.rightEye.rotation.y = c.headY * eyeMultiplier;
        }

        // Apply finger poses
        this.applyFingerPose();
    }

    applyFingerPose() {
        const b = this.bones;
        const fingerWave = Math.sin(this.idlePhase * 0.3);

        // Relaxed, natural finger curl
        const relaxed = {
            proximal: 0.1,
            intermediate: 0.15,
            distal: 0.08
        };

        // Left hand fingers
        ['Index', 'Middle', 'Ring', 'Little'].forEach((finger, i) => {
            const offset = fingerWave * 0.015 * (1 + i * 0.1);

            const prox = b[`left${finger}Proximal`];
            const inter = b[`left${finger}Intermediate`];
            const dist = b[`left${finger}Distal`];

            if (prox) prox.rotation.z = relaxed.proximal + offset;
            if (inter) inter.rotation.z = relaxed.intermediate + offset * 0.7;
            if (dist) dist.rotation.z = relaxed.distal + offset * 0.4;
        });

        // Left thumb
        if (b.leftThumbProximal) b.leftThumbProximal.rotation.z = 0.06;
        if (b.leftThumbIntermediate) b.leftThumbIntermediate.rotation.z = 0.1;
        if (b.leftThumbDistal) b.leftThumbDistal.rotation.z = 0.03;

        // Right hand fingers (mirror)
        ['Index', 'Middle', 'Ring', 'Little'].forEach((finger, i) => {
            const offset = fingerWave * 0.015 * (1 + i * 0.1);

            const prox = b[`right${finger}Proximal`];
            const inter = b[`right${finger}Intermediate`];
            const dist = b[`right${finger}Distal`];

            if (prox) prox.rotation.z = -(relaxed.proximal + offset);
            if (inter) inter.rotation.z = -(relaxed.intermediate + offset * 0.7);
            if (dist) dist.rotation.z = -(relaxed.distal + offset * 0.4);
        });

        // Right thumb
        if (b.rightThumbProximal) b.rightThumbProximal.rotation.z = -0.06;
        if (b.rightThumbIntermediate) b.rightThumbIntermediate.rotation.z = -0.1;
        if (b.rightThumbDistal) b.rightThumbDistal.rotation.z = -0.03;
    }

    updateExpressions(dt) {
        if (!this.vrmLoader.vrm) return;

        // Reset all expressions first
        this.vrmLoader.resetExpressions();

        // Apply current expression
        const intensity = this.current.expressionIntensity;
        switch (this.currentExpression) {
            case 'happy':
                this.vrmLoader.setHappy(intensity);
                break;
            case 'sad':
                this.vrmLoader.setSad(intensity);
                break;
            case 'surprised':
                this.vrmLoader.setSurprised(intensity);
                break;
            case 'angry':
                this.vrmLoader.setAngry(intensity);
                break;
            default:
                // Subtle happy for neutral
                this.vrmLoader.setHappy(intensity * 0.15);
        }

        // Blinking
        this.updateBlinking(dt);

        // Talking mouth
        if (this.isTalking && this.current.talkIntensity > 0.1) {
            this.talkTime += dt;

            // Natural speech pattern with pauses
            const base = Math.sin(this.talkTime * 9) * 0.5 + 0.5;
            const variation = Math.sin(this.talkTime * 5.3) * 0.3;
            const pause = Math.sin(this.talkTime * 1.5) > 0.3 ? 1 : 0.2;

            const mouthOpen = (base * 0.3 + variation * 0.15) * pause * this.current.talkIntensity;
            this.vrmLoader.setMouthOpen(Math.max(0, Math.min(0.5, mouthOpen)));
        }

        // Flirty wink
        if (this.state === 'flirty') {
            const winkCycle = this.time % 4;
            if (winkCycle > 0.5 && winkCycle < 1.2) {
                this.vrmLoader.setWink(true);
            }
        }
    }

    updateBlinking(dt) {
        this.blinkTimer += dt;

        if (this.isBlinking) {
            this.blinkProgress += dt * 10;

            if (this.blinkProgress >= 1) {
                this.isBlinking = false;
                this.blinkProgress = 0;
            }

            // Smooth blink curve
            let blinkVal;
            if (this.blinkProgress < 0.35) {
                // Close eyes
                blinkVal = smoothstep(this.blinkProgress / 0.35);
            } else {
                // Open eyes
                blinkVal = 1 - smoothstep((this.blinkProgress - 0.35) / 0.65);
            }

            this.current.blinkValue = blinkVal;
            this.vrmLoader.setBlink(blinkVal);

        } else if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;
            this.blinkInterval = 2.5 + Math.random() * 4;
            this.isBlinking = true;
            this.blinkProgress = 0;
        } else {
            // Ensure eyes are open when not blinking
            if (this.current.blinkValue > 0) {
                this.current.blinkValue *= 0.8;
                this.vrmLoader.setBlink(this.current.blinkValue);
            }
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
        let startTime = performance.now();
        const duration = 1400;

        const animateLaugh = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const decay = 1 - progress;
                const bounce = Math.sin(elapsed * 0.015) * 0.5 + 0.5;
                const mouthOpen = (bounce * 0.35 + 0.15) * decay;
                this.vrmLoader.setMouthOpen(mouthOpen);
                requestAnimationFrame(animateLaugh);
            } else {
                this.vrmLoader.setMouthOpen(0);
                this.setExpression('neutral', 0.25);
            }
        };

        animateLaugh();
    }
}
