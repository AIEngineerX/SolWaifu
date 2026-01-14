/**
 * Animation Controller - Professional VRM Animation System
 * Studio-quality procedural animation with:
 * - Frame-rate independent smoothDamp (Game Programming Gems 4)
 * - Multi-layered organic motion (breathing, micro-sway, idle variation)
 * - Velocity-based interpolation for natural momentum
 * - Anatomically correct bone hierarchy
 */

import * as THREE from 'three';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Frame-rate independent smooth interpolation with velocity
 * Based on Game Programming Gems 4 - critical for consistent motion
 */
function smoothDamp(current, target, velocity, smoothTime, deltaTime, maxSpeed = Infinity) {
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

    let change = current - target;
    const originalTo = target;

    // Clamp maximum speed
    const maxChange = maxSpeed * smoothTime;
    change = Math.max(-maxChange, Math.min(maxChange, change));
    target = current - change;

    const temp = (velocity + omega * change) * deltaTime;
    let newVelocity = (velocity - omega * temp) * exp;
    let newValue = target + (change + temp) * exp;

    // Prevent overshoot
    if ((originalTo - current > 0) === (newValue > originalTo)) {
        newValue = originalTo;
        newVelocity = (newValue - originalTo) / deltaTime;
    }

    return { value: newValue, velocity: newVelocity };
}

/**
 * Attempt a single smooth damp and update both value and velocity in object
 */
function dampValue(obj, key, velKey, target, smoothTime, dt) {
    const result = smoothDamp(obj[key], target, obj[velKey], smoothTime, dt);
    obj[key] = result.value;
    obj[velKey] = result.velocity;
}

/**
 * Attempt multiple dampings to an object at once
 */
function dampMultiple(obj, targets, smoothTime, dt) {
    for (const [key, velKey, target] of targets) {
        dampValue(obj, key, velKey, target, smoothTime, dt);
    }
}

/**
 * Attempt frame-rate independent exponential decay lerp
 * Good for secondary motion that doesn't need velocity tracking
 */
function expLerp(current, target, halfLife, dt) {
    // halfLife = time to reach halfway to target
    // More intuitive than arbitrary speed values
    return target + (current - target) * Math.pow(0.5, dt / halfLife);
}

/**
 * Attempt smooth step easing (for blink curves, etc)
 */
function smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
}

/**
 * Attempt smoother step (Ken Perlin's improved version)
 */
function smootherstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Attempt organic noise from multiple sine waves (more natural than single sine)
 */
function organicNoise(phase, speeds = [1, 0.7, 1.3], offsets = [0, 1, 2]) {
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < speeds.length; i++) {
        const w = 1 / (i + 1); // Decreasing weights
        sum += Math.sin(phase * speeds[i] + offsets[i]) * w;
        weight += w;
    }
    return sum / weight;
}

// ============================================================
// ANIMATION CONTROLLER
// ============================================================

export class AnimationController {
    constructor(vrmLoader) {
        this.vrmLoader = vrmLoader;
        this.initialized = false;
        this.time = 0;
        this.frameCount = 0;

        // Bone cache
        this.bones = {};

        // Animation state
        this.state = 'idle';
        this.isTalking = false;
        this.talkTime = 0;

        // ============================================================
        // ANIMATION VALUES - All with velocity tracking for smooth motion
        // ============================================================
        this.anim = {
            // Head tracking (follows mouse/look target)
            headX: 0, headY: 0, headZ: 0,
            headVelX: 0, headVelY: 0, headVelZ: 0,

            // Neck (follows head with lag)
            neckX: 0, neckY: 0, neckZ: 0,
            neckVelX: 0, neckVelY: 0, neckVelZ: 0,

            // Spine chain (hips -> spine -> chest -> upperChest)
            hipsX: 0, hipsY: 0, hipsZ: 0,
            hipsVelX: 0, hipsVelY: 0, hipsVelZ: 0,

            spineX: 0, spineY: 0, spineZ: 0,
            spineVelX: 0, spineVelY: 0, spineVelZ: 0,

            chestX: 0, chestY: 0, chestZ: 0,
            chestVelX: 0, chestVelY: 0, chestVelZ: 0,

            upperChestX: 0, upperChestY: 0,
            upperChestVelX: 0, upperChestVelY: 0,

            // Shoulders (breathing motion)
            leftShoulderZ: 0, rightShoulderZ: 0,
            leftShoulderVelZ: 0, rightShoulderVelZ: 0,

            // Arms - Left
            leftUpperArmX: 0.08, leftUpperArmY: 0.05, leftUpperArmZ: 0.18,
            leftUpperArmVelX: 0, leftUpperArmVelY: 0, leftUpperArmVelZ: 0,
            leftLowerArmX: 0, leftLowerArmY: -0.12, leftLowerArmZ: 0.03,
            leftLowerArmVelX: 0, leftLowerArmVelY: 0, leftLowerArmVelZ: 0,
            leftHandX: -0.08, leftHandY: 0, leftHandZ: 0.05,
            leftHandVelX: 0, leftHandVelY: 0, leftHandVelZ: 0,

            // Arms - Right
            rightUpperArmX: 0.06, rightUpperArmY: -0.04, rightUpperArmZ: -0.15,
            rightUpperArmVelX: 0, rightUpperArmVelY: 0, rightUpperArmVelZ: 0,
            rightLowerArmX: 0, rightLowerArmY: 0.10, rightLowerArmZ: -0.03,
            rightLowerArmVelX: 0, rightLowerArmVelY: 0, rightLowerArmVelZ: 0,
            rightHandX: -0.08, rightHandY: 0, rightHandZ: -0.05,
            rightHandVelX: 0, rightHandVelY: 0, rightHandVelZ: 0,

            // Legs
            leftUpperLegX: 0, leftUpperLegZ: -0.02,
            leftUpperLegVelX: 0, leftUpperLegVelZ: 0,
            rightUpperLegX: 0, rightUpperLegZ: 0.02,
            rightUpperLegVelX: 0, rightUpperLegVelZ: 0,
            leftLowerLegX: 0.03, rightLowerLegX: 0.03,
            leftLowerLegVelX: 0, rightLowerLegVelX: 0,

            // Eyes
            leftEyeX: 0, leftEyeY: 0,
            rightEyeX: 0, rightEyeY: 0,

            // Expression
            expressionIntensity: 0.25,
            expressionVel: 0,
            talkIntensity: 0,
            talkVel: 0,
            blinkValue: 0
        };

        // Target values (computed each frame)
        this.target = {};

        // ============================================================
        // LOOK-AT SYSTEM
        // ============================================================
        this.lookAtTarget = new THREE.Vector3(0, 1.4, 2);
        this.lookAtEnabled = true;
        this.smoothLookAt = new THREE.Vector3(0, 1.4, 2);
        this.lookAtVelocity = new THREE.Vector3();

        // ============================================================
        // TIMING PARAMETERS (tuned for natural motion)
        // ============================================================
        this.timing = {
            // Smooth times (seconds to reach ~86% of target)
            head: 0.12,          // Head responds quickly to mouse
            neck: 0.18,          // Neck follows with slight delay
            spine: 0.35,         // Spine is slower, more mass
            hips: 0.4,           // Hips slowest - center of mass
            arms: 0.22,          // Arms follow body
            shoulders: 0.25,     // Shoulders with breathing
            legs: 0.3,           // Legs subtle shifts
            expression: 0.15     // Expressions responsive
        };

        // ============================================================
        // ORGANIC MOTION PARAMETERS
        // ============================================================

        // Breathing (primary life indicator)
        this.breath = {
            phase: 0,
            rate: 0.22,           // ~13 breaths per minute (relaxed)
            depth: 1.0,           // Breath depth multiplier
            chestExpand: 0.025,   // How much chest expands
            shoulderRise: 0.012,  // Shoulder rise on inhale
            spineExtend: 0.015    // Spine extension on inhale
        };

        // Idle micro-movement (prevents statue look)
        this.idle = {
            phase: Math.random() * Math.PI * 2, // Random start
            speed: 0.06,          // Very slow drift
            hipSway: 0.035,       // Side-to-side hip motion
            spineWave: 0.012,     // S-curve through spine
            headDrift: 0.02,      // Subtle head movement
            weightShift: 0.015    // Weight between legs
        };

        // Secondary motion layer (even slower variation)
        this.secondary = {
            phase: Math.random() * Math.PI * 2,
            speed: 0.025,
            intensity: 0.6
        };

        // ============================================================
        // BLINKING
        // ============================================================
        this.blink = {
            timer: Math.random() * 2,
            interval: 3.5,
            isBlinking: false,
            progress: 0,
            speed: 12,            // Blink speed (full cycle per second * speed)
            closeRatio: 0.3       // How much of blink is closing vs opening
        };

        // ============================================================
        // EXPRESSION STATE
        // ============================================================
        this.expression = {
            current: 'neutral',
            targetIntensity: 0.25,
            blendSpeed: 0.15
        };
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async initialize() {
        if (this.initialized || !this.vrmLoader.vrm) return;

        const vrm = this.vrmLoader.vrm;
        const getBone = (name) => vrm.humanoid.getNormalizedBoneNode(name);

        // Cache all bones
        this.bones = {
            // Core
            hips: getBone('hips'),
            spine: getBone('spine'),
            chest: getBone('chest'),
            upperChest: getBone('upperChest'),
            neck: getBone('neck'),
            head: getBone('head'),

            // Shoulders
            leftShoulder: getBone('leftShoulder'),
            rightShoulder: getBone('rightShoulder'),

            // Arms
            leftUpperArm: getBone('leftUpperArm'),
            rightUpperArm: getBone('rightUpperArm'),
            leftLowerArm: getBone('leftLowerArm'),
            rightLowerArm: getBone('rightLowerArm'),
            leftHand: getBone('leftHand'),
            rightHand: getBone('rightHand'),

            // Legs
            leftUpperLeg: getBone('leftUpperLeg'),
            rightUpperLeg: getBone('rightUpperLeg'),
            leftLowerLeg: getBone('leftLowerLeg'),
            rightLowerLeg: getBone('rightLowerLeg'),

            // Eyes
            leftEye: getBone('leftEye'),
            rightEye: getBone('rightEye'),

            // Fingers - Left
            leftThumbProximal: getBone('leftThumbProximal'),
            leftThumbIntermediate: getBone('leftThumbIntermediate'),
            leftThumbDistal: getBone('leftThumbDistal'),
            leftIndexProximal: getBone('leftIndexProximal'),
            leftIndexIntermediate: getBone('leftIndexIntermediate'),
            leftIndexDistal: getBone('leftIndexDistal'),
            leftMiddleProximal: getBone('leftMiddleProximal'),
            leftMiddleIntermediate: getBone('leftMiddleIntermediate'),
            leftMiddleDistal: getBone('leftMiddleDistal'),
            leftRingProximal: getBone('leftRingProximal'),
            leftRingIntermediate: getBone('leftRingIntermediate'),
            leftRingDistal: getBone('leftRingDistal'),
            leftLittleProximal: getBone('leftLittleProximal'),
            leftLittleIntermediate: getBone('leftLittleIntermediate'),
            leftLittleDistal: getBone('leftLittleDistal'),

            // Fingers - Right
            rightThumbProximal: getBone('rightThumbProximal'),
            rightThumbIntermediate: getBone('rightThumbIntermediate'),
            rightThumbDistal: getBone('rightThumbDistal'),
            rightIndexProximal: getBone('rightIndexProximal'),
            rightIndexIntermediate: getBone('rightIndexIntermediate'),
            rightIndexDistal: getBone('rightIndexDistal'),
            rightMiddleProximal: getBone('rightMiddleProximal'),
            rightMiddleIntermediate: getBone('rightMiddleIntermediate'),
            rightMiddleDistal: getBone('rightMiddleDistal'),
            rightRingProximal: getBone('rightRingProximal'),
            rightRingIntermediate: getBone('rightRingIntermediate'),
            rightRingDistal: getBone('rightRingDistal'),
            rightLittleProximal: getBone('rightLittleProximal'),
            rightLittleIntermediate: getBone('rightLittleIntermediate'),
            rightLittleDistal: getBone('rightLittleDistal')
        };

        // Verify essential bones
        if (!this.bones.hips || !this.bones.spine || !this.bones.head) {
            console.warn('Essential bones not found - model may not be VRM compatible');
            return;
        }

        console.log('Professional animation system initialized');
        this.initialized = true;

        // Apply initial pose immediately
        this.applyToBones();
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

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
                this.expression.current = 'happy';
                this.expression.targetIntensity = 0.5;
                break;
            case 'thinking':
                this.isTalking = false;
                this.expression.current = 'neutral';
                this.expression.targetIntensity = 0.3;
                break;
            case 'flirty':
                this.isTalking = false;
                this.expression.current = 'happy';
                this.expression.targetIntensity = 0.7;
                break;
            case 'idle':
            default:
                this.isTalking = false;
                this.expression.current = 'neutral';
                this.expression.targetIntensity = 0.25;
        }
    }

    setExpression(name, intensity = 0.5) {
        this.expression.current = name;
        this.expression.targetIntensity = intensity;
    }

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

    // ============================================================
    // MAIN UPDATE LOOP
    // ============================================================

    update(deltaTime, elapsedTime) {
        if (!this.vrmLoader.vrm) return;

        if (!this.initialized) {
            this.initialize();
            if (!this.initialized) return;
        }

        // Clamp delta to prevent large jumps (tab switching, etc)
        const dt = Math.min(deltaTime, 0.1);
        this.time = elapsedTime;
        this.frameCount++;

        // Update all animation phases
        this.updatePhases(dt);

        // Calculate target poses
        this.calculateTargets(dt);

        // Smooth interpolation to targets
        this.smoothUpdate(dt);

        // Apply to skeleton
        this.applyToBones();

        // Update facial expressions
        this.updateExpressions(dt);
    }

    // ============================================================
    // PHASE UPDATES
    // ============================================================

    updatePhases(dt) {
        // Breathing - organic rhythm
        this.breath.phase += dt * this.breath.rate * Math.PI * 2;

        // Idle motion - very slow drift
        this.idle.phase += dt * this.idle.speed * Math.PI * 2;

        // Secondary layer - even slower
        this.secondary.phase += dt * this.secondary.speed * Math.PI * 2;
    }

    // ============================================================
    // TARGET CALCULATION
    // ============================================================

    calculateTargets(dt) {
        const a = this.anim;
        const t = this.timing;

        // Organic noise values for natural motion
        const breathCurve = this.getBreathCurve();
        const idleNoise = this.getIdleNoise();
        const secondaryNoise = this.getSecondaryNoise();

        // ========== HEAD LOOK-AT ==========
        this.calculateHeadTargets(idleNoise);

        // ========== NECK (follows head with lag) ==========
        this.target.neckX = a.headX * 0.3;
        this.target.neckY = a.headY * 0.35;
        this.target.neckZ = a.headZ * 0.25;

        // ========== SPINE CHAIN (bottom-up wave) ==========
        this.calculateSpineTargets(breathCurve, idleNoise, secondaryNoise);

        // ========== SHOULDERS (breathing) ==========
        const shoulderBreath = breathCurve.inhale * this.breath.shoulderRise;
        this.target.leftShoulderZ = shoulderBreath + idleNoise.subtle * 0.005;
        this.target.rightShoulderZ = -shoulderBreath - idleNoise.subtle * 0.005;

        // ========== ARMS (natural hanging with sway) ==========
        this.calculateArmTargets(idleNoise, secondaryNoise);

        // ========== LEGS (weight shift) ==========
        this.calculateLegTargets(idleNoise);

        // ========== EYES (follow head direction) ==========
        this.target.leftEyeX = a.headX * 0.25;
        this.target.leftEyeY = a.headY * 0.7;
        this.target.rightEyeX = a.headX * 0.25;
        this.target.rightEyeY = a.headY * 0.7;
    }

    getBreathCurve() {
        // Asymmetric breath - inhale faster than exhale
        const phase = this.breath.phase;
        const raw = Math.sin(phase);

        // Ease the breath curve for more natural feel
        const inhale = Math.max(0, raw);
        const exhale = Math.max(0, -raw);

        return {
            raw,
            inhale: smoothstep(inhale),
            exhale: smoothstep(exhale),
            chest: raw * 0.5 + 0.5  // 0-1 range for chest expansion
        };
    }

    getIdleNoise() {
        const phase = this.idle.phase;
        return {
            // Primary sway
            sway: organicNoise(phase, [1, 0.7, 1.3], [0, 1.1, 2.3]),
            // Perpendicular movement
            drift: organicNoise(phase, [0.8, 1.1, 0.6], [0.5, 1.7, 3.1]),
            // Very subtle micro-motion
            subtle: organicNoise(phase * 2, [1, 1.4, 0.9], [0, 0.8, 1.6]),
            // Weight shift
            weight: organicNoise(phase * 0.5, [1, 0.6], [0, 1.2])
        };
    }

    getSecondaryNoise() {
        const phase = this.secondary.phase;
        const intensity = this.secondary.intensity;
        return {
            x: organicNoise(phase, [1, 0.7], [0, 2]) * intensity,
            y: organicNoise(phase, [0.8, 1.2], [1, 0]) * intensity,
            z: organicNoise(phase, [0.9, 0.6], [0.5, 1.5]) * intensity
        };
    }

    calculateHeadTargets(idleNoise) {
        if (!this.lookAtEnabled || !this.bones.head) return;

        // Get head world position
        const headPos = new THREE.Vector3();
        this.bones.head.getWorldPosition(headPos);

        // Smooth the look-at target itself (prevents jerky mouse movement)
        const lookDt = 0.016; // Assume ~60fps for look smoothing
        this.smoothLookAt.x = expLerp(this.smoothLookAt.x, this.lookAtTarget.x, 0.08, lookDt);
        this.smoothLookAt.y = expLerp(this.smoothLookAt.y, this.lookAtTarget.y, 0.08, lookDt);
        this.smoothLookAt.z = expLerp(this.smoothLookAt.z, this.lookAtTarget.z, 0.08, lookDt);

        // Calculate look direction
        const direction = new THREE.Vector3()
            .subVectors(this.smoothLookAt, headPos)
            .normalize();

        // Convert to rotation angles
        const lookY = Math.atan2(direction.x, direction.z);
        const lookX = -Math.asin(Math.max(-1, Math.min(1, direction.y))) * 0.5;

        // Clamp to natural human range
        this.target.headY = Math.max(-0.6, Math.min(0.6, lookY));
        this.target.headX = Math.max(-0.3, Math.min(0.4, lookX));

        // Flirty head tilt with subtle variation
        this.target.headZ = 0.05 + idleNoise.subtle * 0.02 + this.idle.headDrift * idleNoise.drift;
    }

    calculateSpineTargets(breathCurve, idleNoise, secondaryNoise) {
        const breath = breathCurve;
        const hipSway = this.idle.hipSway;
        const spineWave = this.idle.spineWave;

        // HIPS - Center of mass, slowest movement
        this.target.hipsX = idleNoise.drift * 0.01 + secondaryNoise.x * 0.008;
        this.target.hipsY = idleNoise.sway * hipSway + secondaryNoise.y * 0.015;
        this.target.hipsZ = 0.02 + idleNoise.drift * 0.02; // Slight forward tilt (feminine)

        // SPINE - Counter-rotation creates S-curve
        this.target.spineX = breath.raw * this.breath.spineExtend + idleNoise.subtle * 0.008;
        this.target.spineY = -this.target.hipsY * 0.5; // Counter-rotate
        this.target.spineZ = idleNoise.sway * spineWave;

        // CHEST - Breathing focus
        this.target.chestX = breath.chest * this.breath.chestExpand + idleNoise.drift * 0.006;
        this.target.chestY = -this.target.spineY * 0.4; // Continue counter-rotation
        this.target.chestZ = idleNoise.subtle * 0.008;

        // UPPER CHEST - Top of breath, subtle
        this.target.upperChestX = breath.chest * this.breath.chestExpand * 0.6;
        this.target.upperChestY = idleNoise.sway * 0.01;
    }

    calculateArmTargets(idleNoise, secondaryNoise) {
        const armSway = idleNoise.sway * 0.025;
        const armDrift = idleNoise.drift * 0.02;

        // LEFT ARM - Natural hang with organic motion
        this.target.leftUpperArmX = 0.08 + idleNoise.drift * 0.025 + secondaryNoise.x * 0.015;
        this.target.leftUpperArmY = 0.05 + idleNoise.subtle * 0.02;
        this.target.leftUpperArmZ = 0.18 + armSway + secondaryNoise.z * 0.02; // Close to body!

        this.target.leftLowerArmX = idleNoise.subtle * 0.015;
        this.target.leftLowerArmY = -0.12 + armDrift * 0.5;
        this.target.leftLowerArmZ = 0.03 + idleNoise.sway * 0.02;

        this.target.leftHandX = -0.08 + idleNoise.drift * 0.03;
        this.target.leftHandY = idleNoise.subtle * 0.02;
        this.target.leftHandZ = 0.05 + idleNoise.sway * 0.015;

        // RIGHT ARM - Slightly different for asymmetry
        this.target.rightUpperArmX = 0.06 + idleNoise.drift * 0.02 + secondaryNoise.x * 0.012;
        this.target.rightUpperArmY = -0.04 + idleNoise.subtle * 0.018;
        this.target.rightUpperArmZ = -0.15 - armSway - secondaryNoise.z * 0.018; // Close to body!

        this.target.rightLowerArmX = idleNoise.subtle * 0.012;
        this.target.rightLowerArmY = 0.10 - armDrift * 0.4;
        this.target.rightLowerArmZ = -0.03 - idleNoise.sway * 0.018;

        this.target.rightHandX = -0.08 + idleNoise.drift * 0.025;
        this.target.rightHandY = idleNoise.subtle * 0.015;
        this.target.rightHandZ = -0.05 - idleNoise.sway * 0.012;
    }

    calculateLegTargets(idleNoise) {
        const weightShift = idleNoise.weight * this.idle.weightShift;

        // Weight distribution between legs
        this.target.leftUpperLegX = weightShift;
        this.target.leftUpperLegZ = -0.02 + weightShift * 0.3;

        this.target.rightUpperLegX = -weightShift;
        this.target.rightUpperLegZ = 0.02 - weightShift * 0.3;

        // Lower legs - slight bend
        this.target.leftLowerLegX = 0.03 + Math.max(0, weightShift) * 0.5;
        this.target.rightLowerLegX = 0.03 + Math.max(0, -weightShift) * 0.5;
    }

    // ============================================================
    // SMOOTH INTERPOLATION
    // ============================================================

    smoothUpdate(dt) {
        const a = this.anim;
        const t = this.target;
        const tm = this.timing;

        // HEAD - fastest response
        dampValue(a, 'headX', 'headVelX', t.headX, tm.head, dt);
        dampValue(a, 'headY', 'headVelY', t.headY, tm.head, dt);
        dampValue(a, 'headZ', 'headVelZ', t.headZ, tm.head, dt);

        // NECK - slight delay after head
        dampValue(a, 'neckX', 'neckVelX', t.neckX, tm.neck, dt);
        dampValue(a, 'neckY', 'neckVelY', t.neckY, tm.neck, dt);
        dampValue(a, 'neckZ', 'neckVelZ', t.neckZ, tm.neck, dt);

        // HIPS - slowest, center of mass
        dampValue(a, 'hipsX', 'hipsVelX', t.hipsX, tm.hips, dt);
        dampValue(a, 'hipsY', 'hipsVelY', t.hipsY, tm.hips, dt);
        dampValue(a, 'hipsZ', 'hipsVelZ', t.hipsZ, tm.hips, dt);

        // SPINE
        dampValue(a, 'spineX', 'spineVelX', t.spineX, tm.spine, dt);
        dampValue(a, 'spineY', 'spineVelY', t.spineY, tm.spine, dt);
        dampValue(a, 'spineZ', 'spineVelZ', t.spineZ, tm.spine, dt);

        // CHEST
        dampValue(a, 'chestX', 'chestVelX', t.chestX, tm.spine, dt);
        dampValue(a, 'chestY', 'chestVelY', t.chestY, tm.spine, dt);
        dampValue(a, 'chestZ', 'chestVelZ', t.chestZ, tm.spine, dt);

        // UPPER CHEST
        dampValue(a, 'upperChestX', 'upperChestVelX', t.upperChestX, tm.spine, dt);
        dampValue(a, 'upperChestY', 'upperChestVelY', t.upperChestY, tm.spine, dt);

        // SHOULDERS
        dampValue(a, 'leftShoulderZ', 'leftShoulderVelZ', t.leftShoulderZ, tm.shoulders, dt);
        dampValue(a, 'rightShoulderZ', 'rightShoulderVelZ', t.rightShoulderZ, tm.shoulders, dt);

        // LEFT ARM
        dampValue(a, 'leftUpperArmX', 'leftUpperArmVelX', t.leftUpperArmX, tm.arms, dt);
        dampValue(a, 'leftUpperArmY', 'leftUpperArmVelY', t.leftUpperArmY, tm.arms, dt);
        dampValue(a, 'leftUpperArmZ', 'leftUpperArmVelZ', t.leftUpperArmZ, tm.arms, dt);
        dampValue(a, 'leftLowerArmX', 'leftLowerArmVelX', t.leftLowerArmX, tm.arms, dt);
        dampValue(a, 'leftLowerArmY', 'leftLowerArmVelY', t.leftLowerArmY, tm.arms, dt);
        dampValue(a, 'leftLowerArmZ', 'leftLowerArmVelZ', t.leftLowerArmZ, tm.arms, dt);
        dampValue(a, 'leftHandX', 'leftHandVelX', t.leftHandX, tm.arms, dt);
        dampValue(a, 'leftHandY', 'leftHandVelY', t.leftHandY, tm.arms, dt);
        dampValue(a, 'leftHandZ', 'leftHandVelZ', t.leftHandZ, tm.arms, dt);

        // RIGHT ARM
        dampValue(a, 'rightUpperArmX', 'rightUpperArmVelX', t.rightUpperArmX, tm.arms, dt);
        dampValue(a, 'rightUpperArmY', 'rightUpperArmVelY', t.rightUpperArmY, tm.arms, dt);
        dampValue(a, 'rightUpperArmZ', 'rightUpperArmVelZ', t.rightUpperArmZ, tm.arms, dt);
        dampValue(a, 'rightLowerArmX', 'rightLowerArmVelX', t.rightLowerArmX, tm.arms, dt);
        dampValue(a, 'rightLowerArmY', 'rightLowerArmVelY', t.rightLowerArmY, tm.arms, dt);
        dampValue(a, 'rightLowerArmZ', 'rightLowerArmVelZ', t.rightLowerArmZ, tm.arms, dt);
        dampValue(a, 'rightHandX', 'rightHandVelX', t.rightHandX, tm.arms, dt);
        dampValue(a, 'rightHandY', 'rightHandVelY', t.rightHandY, tm.arms, dt);
        dampValue(a, 'rightHandZ', 'rightHandVelZ', t.rightHandZ, tm.arms, dt);

        // LEGS
        dampValue(a, 'leftUpperLegX', 'leftUpperLegVelX', t.leftUpperLegX, tm.legs, dt);
        dampValue(a, 'leftUpperLegZ', 'leftUpperLegVelZ', t.leftUpperLegZ, tm.legs, dt);
        dampValue(a, 'rightUpperLegX', 'rightUpperLegVelX', t.rightUpperLegX, tm.legs, dt);
        dampValue(a, 'rightUpperLegZ', 'rightUpperLegVelZ', t.rightUpperLegZ, tm.legs, dt);
        dampValue(a, 'leftLowerLegX', 'leftLowerLegVelX', t.leftLowerLegX, tm.legs, dt);
        dampValue(a, 'rightLowerLegX', 'rightLowerLegVelX', t.rightLowerLegX, tm.legs, dt);

        // EYES (faster response)
        a.leftEyeX = expLerp(a.leftEyeX, t.leftEyeX, 0.05, dt);
        a.leftEyeY = expLerp(a.leftEyeY, t.leftEyeY, 0.05, dt);
        a.rightEyeX = expLerp(a.rightEyeX, t.rightEyeX, 0.05, dt);
        a.rightEyeY = expLerp(a.rightEyeY, t.rightEyeY, 0.05, dt);

        // EXPRESSIONS
        dampValue(a, 'expressionIntensity', 'expressionVel', this.expression.targetIntensity, tm.expression, dt);

        const talkTarget = this.isTalking ? 1 : 0;
        dampValue(a, 'talkIntensity', 'talkVel', talkTarget, tm.expression, dt);
    }

    // ============================================================
    // APPLY TO BONES
    // ============================================================

    applyToBones() {
        const b = this.bones;
        const a = this.anim;

        // HEAD
        if (b.head) {
            b.head.rotation.set(a.headX, a.headY, a.headZ);
        }

        // NECK
        if (b.neck) {
            b.neck.rotation.set(a.neckX, a.neckY, a.neckZ);
        }

        // HIPS
        if (b.hips) {
            b.hips.rotation.set(a.hipsX, a.hipsY, a.hipsZ);
        }

        // SPINE
        if (b.spine) {
            b.spine.rotation.set(a.spineX, a.spineY, a.spineZ);
        }

        // CHEST
        if (b.chest) {
            b.chest.rotation.set(a.chestX, a.chestY, a.chestZ);
        }

        // UPPER CHEST
        if (b.upperChest) {
            b.upperChest.rotation.set(a.upperChestX, a.upperChestY, 0);
        }

        // SHOULDERS
        if (b.leftShoulder) {
            b.leftShoulder.rotation.z = a.leftShoulderZ;
        }
        if (b.rightShoulder) {
            b.rightShoulder.rotation.z = a.rightShoulderZ;
        }

        // LEFT ARM
        if (b.leftUpperArm) {
            b.leftUpperArm.rotation.set(a.leftUpperArmX, a.leftUpperArmY, a.leftUpperArmZ);
        }
        if (b.leftLowerArm) {
            b.leftLowerArm.rotation.set(a.leftLowerArmX, a.leftLowerArmY, a.leftLowerArmZ);
        }
        if (b.leftHand) {
            b.leftHand.rotation.set(a.leftHandX, a.leftHandY, a.leftHandZ);
        }

        // RIGHT ARM
        if (b.rightUpperArm) {
            b.rightUpperArm.rotation.set(a.rightUpperArmX, a.rightUpperArmY, a.rightUpperArmZ);
        }
        if (b.rightLowerArm) {
            b.rightLowerArm.rotation.set(a.rightLowerArmX, a.rightLowerArmY, a.rightLowerArmZ);
        }
        if (b.rightHand) {
            b.rightHand.rotation.set(a.rightHandX, a.rightHandY, a.rightHandZ);
        }

        // LEGS
        if (b.leftUpperLeg) {
            b.leftUpperLeg.rotation.x = a.leftUpperLegX;
            b.leftUpperLeg.rotation.z = a.leftUpperLegZ;
        }
        if (b.rightUpperLeg) {
            b.rightUpperLeg.rotation.x = a.rightUpperLegX;
            b.rightUpperLeg.rotation.z = a.rightUpperLegZ;
        }
        if (b.leftLowerLeg) {
            b.leftLowerLeg.rotation.x = a.leftLowerLegX;
        }
        if (b.rightLowerLeg) {
            b.rightLowerLeg.rotation.x = a.rightLowerLegX;
        }

        // EYES
        if (b.leftEye) {
            b.leftEye.rotation.set(a.leftEyeX, a.leftEyeY, 0);
        }
        if (b.rightEye) {
            b.rightEye.rotation.set(a.rightEyeX, a.rightEyeY, 0);
        }

        // FINGERS
        this.applyFingerPose();
    }

    applyFingerPose() {
        const b = this.bones;
        const wave = organicNoise(this.idle.phase * 0.4, [1, 0.7], [0, 1.5]) * 0.02;

        // Relaxed finger curl values
        const curl = {
            proximal: 0.12,
            intermediate: 0.18,
            distal: 0.10
        };

        // Apply to each finger with slight variation
        const fingers = ['Index', 'Middle', 'Ring', 'Little'];

        fingers.forEach((finger, i) => {
            const offset = wave * (1 + i * 0.15);

            // Left hand
            const lp = b[`left${finger}Proximal`];
            const li = b[`left${finger}Intermediate`];
            const ld = b[`left${finger}Distal`];

            if (lp) lp.rotation.z = curl.proximal + offset;
            if (li) li.rotation.z = curl.intermediate + offset * 0.7;
            if (ld) ld.rotation.z = curl.distal + offset * 0.4;

            // Right hand (mirrored)
            const rp = b[`right${finger}Proximal`];
            const ri = b[`right${finger}Intermediate`];
            const rd = b[`right${finger}Distal`];

            if (rp) rp.rotation.z = -(curl.proximal + offset);
            if (ri) ri.rotation.z = -(curl.intermediate + offset * 0.7);
            if (rd) rd.rotation.z = -(curl.distal + offset * 0.4);
        });

        // Thumbs (different axis, relaxed position)
        if (b.leftThumbProximal) b.leftThumbProximal.rotation.z = 0.08;
        if (b.leftThumbIntermediate) b.leftThumbIntermediate.rotation.z = 0.12;
        if (b.leftThumbDistal) b.leftThumbDistal.rotation.z = 0.05;

        if (b.rightThumbProximal) b.rightThumbProximal.rotation.z = -0.08;
        if (b.rightThumbIntermediate) b.rightThumbIntermediate.rotation.z = -0.12;
        if (b.rightThumbDistal) b.rightThumbDistal.rotation.z = -0.05;
    }

    // ============================================================
    // EXPRESSIONS & BLINKING
    // ============================================================

    updateExpressions(dt) {
        if (!this.vrmLoader.vrm) return;

        // Reset expressions
        this.vrmLoader.resetExpressions();

        // Apply current expression
        const intensity = this.anim.expressionIntensity;
        switch (this.expression.current) {
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
                // Subtle smile for neutral
                this.vrmLoader.setHappy(intensity * 0.15);
        }

        // Blinking
        this.updateBlinking(dt);

        // Talking
        this.updateTalking(dt);

        // Flirty wink
        if (this.state === 'flirty') {
            const winkCycle = this.time % 4;
            if (winkCycle > 0.5 && winkCycle < 1.2) {
                this.vrmLoader.setWink(true);
            }
        }
    }

    updateBlinking(dt) {
        const blink = this.blink;
        blink.timer += dt;

        if (blink.isBlinking) {
            blink.progress += dt * blink.speed;

            if (blink.progress >= 1) {
                blink.isBlinking = false;
                blink.progress = 0;
                this.anim.blinkValue = 0;
                this.vrmLoader.setBlink(0);
            } else {
                // Asymmetric blink curve - fast close, slower open
                let value;
                if (blink.progress < blink.closeRatio) {
                    // Closing - fast
                    value = smootherstep(blink.progress / blink.closeRatio);
                } else {
                    // Opening - slower
                    const openProgress = (blink.progress - blink.closeRatio) / (1 - blink.closeRatio);
                    value = 1 - smootherstep(openProgress);
                }

                this.anim.blinkValue = value;
                this.vrmLoader.setBlink(value);
            }
        } else if (blink.timer >= blink.interval) {
            // Start new blink
            blink.timer = 0;
            blink.interval = 2.5 + Math.random() * 4; // Vary interval
            blink.isBlinking = true;
            blink.progress = 0;
        } else {
            // Ensure eyes are fully open
            if (this.anim.blinkValue > 0.01) {
                this.anim.blinkValue *= 0.85;
                this.vrmLoader.setBlink(this.anim.blinkValue);
            }
        }
    }

    updateTalking(dt) {
        if (!this.isTalking || this.anim.talkIntensity < 0.1) return;

        this.talkTime += dt;

        // Multi-layer speech pattern
        const t = this.talkTime;

        // Base mouth movement
        const base = Math.sin(t * 10) * 0.5 + 0.5;

        // Variation layers
        const mid = Math.sin(t * 6.3) * 0.3;
        const slow = Math.sin(t * 3.7) * 0.2;

        // Natural pauses
        const pausePattern = Math.sin(t * 1.8);
        const pause = pausePattern > 0.2 ? 1 : smoothstep((pausePattern + 1) * 0.5) * 0.3;

        // Combine
        const mouthOpen = (base * 0.35 + mid * 0.15 + slow * 0.1) * pause * this.anim.talkIntensity;

        this.vrmLoader.setMouthOpen(Math.max(0, Math.min(0.55, mouthOpen)));
    }

    triggerLaugh() {
        const startTime = performance.now();
        const duration = 1500;

        const animateLaugh = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                const decay = 1 - smoothstep(progress);
                const bounce = Math.sin(elapsed * 0.018) * 0.5 + 0.5;
                const shake = Math.sin(elapsed * 0.025) * 0.15;

                const mouthOpen = (bounce * 0.4 + 0.2 + shake) * decay;
                this.vrmLoader.setMouthOpen(Math.max(0, mouthOpen));

                requestAnimationFrame(animateLaugh);
            } else {
                this.vrmLoader.setMouthOpen(0);
                this.setExpression('neutral', 0.25);
            }
        };

        animateLaugh();
    }
}
