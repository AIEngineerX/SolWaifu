/**
 * Animation Controller - Uses THREE.AnimationMixer for smooth VRM animations
 * Supports both procedural idle clips and Mixamo FBX animations
 * Adds secondary procedural arm layer for more expressive movement
 */

import * as THREE from 'three';
import { loadMixamoAnimation, createProceduralIdleClip } from './mixamo-loader.js';

export class AnimationController {
    constructor(vrmLoader) {
        this.vrmLoader = vrmLoader;
        this.mixer = null;
        this.currentAction = null;
        this.idleAction = null;
        this.state = 'idle';
        this.initialized = false;
        this.time = 0;

        // Secondary arm animation (procedural layer on top of mixer)
        this.armTime = 0;
        this.armBones = {};

        // Expression state
        this.currentExpression = 'neutral';
        this.expressionIntensity = 0.25;
        this.targetExpressionIntensity = 0.25;

        // Blinking
        this.blinkTimer = 0;
        this.blinkInterval = 3;
        this.isBlinking = false;
        this.blinkProgress = 0;

        // Talking
        this.isTalking = false;
        this.talkTime = 0;
    }

    async initialize() {
        if (this.initialized || !this.vrmLoader.vrm) return;

        const vrm = this.vrmLoader.vrm;

        // Create animation mixer on the VRM scene
        this.mixer = new THREE.AnimationMixer(vrm.scene);

        console.log('Creating procedural idle animation...');

        // Create and play procedural idle animation
        const idleClip = createProceduralIdleClip(vrm, 8); // 8 second loop
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat);
        this.idleAction.play();

        // Cache arm bones for secondary procedural animation
        this.armBones = {
            leftUpperArm: vrm.humanoid.getNormalizedBoneNode('leftUpperArm'),
            rightUpperArm: vrm.humanoid.getNormalizedBoneNode('rightUpperArm'),
            leftLowerArm: vrm.humanoid.getNormalizedBoneNode('leftLowerArm'),
            rightLowerArm: vrm.humanoid.getNormalizedBoneNode('rightLowerArm'),
            leftHand: vrm.humanoid.getNormalizedBoneNode('leftHand'),
            rightHand: vrm.humanoid.getNormalizedBoneNode('rightHand'),
            leftShoulder: vrm.humanoid.getNormalizedBoneNode('leftShoulder'),
            rightShoulder: vrm.humanoid.getNormalizedBoneNode('rightShoulder')
        };

        console.log('Animation mixer initialized with idle animation');
        this.initialized = true;

        // Try to load Mixamo animation if available
        this.tryLoadMixamoAnimation();
    }

    async tryLoadMixamoAnimation() {
        // Check if there's a Mixamo FBX file in the animations folder
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

                    // Crossfade from procedural to Mixamo
                    const mixamoAction = this.mixer.clipAction(clip);
                    mixamoAction.setLoop(THREE.LoopRepeat);

                    // Smooth transition
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
                this.currentExpression = 'happy';
                this.targetExpressionIntensity = 0.5;
                break;
            case 'thinking':
                this.isTalking = false;
                this.currentExpression = 'neutral';
                this.targetExpressionIntensity = 0.2;
                break;
            case 'flirty':
                this.isTalking = false;
                this.currentExpression = 'happy';
                this.targetExpressionIntensity = 0.7;
                break;
            default:
                this.isTalking = false;
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

        // Clamp deltaTime to prevent jumps
        const dt = Math.min(deltaTime, 0.1);
        this.time = elapsedTime;
        this.armTime += dt;

        // Update animation mixer - THIS IS THE KEY FOR SMOOTH ANIMATION
        if (this.mixer) {
            this.mixer.update(dt);
        }

        // Apply secondary procedural arm animation ON TOP of mixer animation
        // This adds extra life to the arms that Mixamo's subtle idles don't have
        this.updateArms();

        // Update expressions (blinking, talking mouth, etc.)
        this.updateExpressions(dt);
    }

    // Secondary procedural arm animation - sets absolute rotation values
    // Called AFTER mixer.update() so we override with our values
    updateArms() {
        const t = this.armTime;
        const bones = this.armBones;

        // Left upper arm - lowered position with sway
        if (bones.leftUpperArm) {
            const baseZ = 1.1; // Arm lowered from T-pose
            bones.leftUpperArm.rotation.x = 0.15 + Math.sin(t * 0.7) * 0.04;
            bones.leftUpperArm.rotation.y = 0.1 + Math.sin(t * 0.9) * 0.03;
            bones.leftUpperArm.rotation.z = baseZ + Math.sin(t * 0.8) * 0.1 + Math.sin(t * 1.3) * 0.05;
        }

        // Right upper arm - mirrored
        if (bones.rightUpperArm) {
            const baseZ = -1.1; // Negative for right side
            bones.rightUpperArm.rotation.x = 0.15 + Math.sin(t * 0.7 + 0.5) * 0.04;
            bones.rightUpperArm.rotation.y = -0.1 + Math.sin(t * 0.9 + 0.5) * 0.03;
            bones.rightUpperArm.rotation.z = baseZ + Math.sin(t * 0.8 + Math.PI) * 0.1 + Math.sin(t * 1.3 + Math.PI) * 0.05;
        }

        // Lower arms (forearms) - elbow bend
        if (bones.leftLowerArm) {
            bones.leftLowerArm.rotation.y = -0.4 + Math.sin(t * 1.1) * 0.08;
            bones.leftLowerArm.rotation.z = Math.sin(t * 0.6) * 0.04;
        }

        if (bones.rightLowerArm) {
            bones.rightLowerArm.rotation.y = 0.4 + Math.sin(t * 1.1 + Math.PI) * 0.08;
            bones.rightLowerArm.rotation.z = Math.sin(t * 0.6 + Math.PI) * 0.04;
        }

        // Hands - wrist movement
        if (bones.leftHand) {
            bones.leftHand.rotation.x = 0.1 + Math.sin(t * 1.5) * 0.06;
            bones.leftHand.rotation.z = Math.sin(t * 0.8) * 0.05;
        }

        if (bones.rightHand) {
            bones.rightHand.rotation.x = 0.1 + Math.sin(t * 1.5 + 0.3) * 0.06;
            bones.rightHand.rotation.z = Math.sin(t * 0.8 + 0.3) * 0.05;
        }

        // Shoulders - subtle movement
        if (bones.leftShoulder) {
            bones.leftShoulder.rotation.z = Math.sin(t * 0.4) * 0.03;
        }

        if (bones.rightShoulder) {
            bones.rightShoulder.rotation.z = Math.sin(t * 0.4 + 0.2) * 0.03;
        }
    }

    updateExpressions(deltaTime) {
        if (!this.vrmLoader.vrm) return;

        // Smooth expression intensity
        this.expressionIntensity += (this.targetExpressionIntensity - this.expressionIntensity) * 0.1;

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
                this.vrmLoader.setHappy(this.expressionIntensity * 0.25);
        }

        // Blinking
        this.updateBlinking(deltaTime);

        // Talking mouth movement
        if (this.isTalking) {
            this.talkTime += deltaTime;
            const mouthOpen = Math.abs(Math.sin(this.talkTime * 12)) * 0.4 +
                Math.abs(Math.sin(this.talkTime * 7.3)) * 0.2;
            // Add natural pauses
            const pause = Math.sin(this.talkTime * 2.1) > 0.6 ? 0.3 : 1;
            this.vrmLoader.setMouthOpen(mouthOpen * pause * 0.6);
        }

        // Flirty wink
        if (this.state === 'flirty') {
            const stateTime = this.time;
            if (stateTime % 3 > 0.3 && stateTime % 3 < 0.8) {
                this.vrmLoader.setWink(true);
            }
        }
    }

    updateBlinking(deltaTime) {
        this.blinkTimer += deltaTime;

        if (this.isBlinking) {
            this.blinkProgress += deltaTime * 10;
            if (this.blinkProgress >= 1) {
                this.isBlinking = false;
                this.blinkProgress = 0;
            } else {
                // Blink curve: quick close, slower open
                let blinkVal = this.blinkProgress < 0.4
                    ? this.blinkProgress * 2.5
                    : 1 - (this.blinkProgress - 0.4) * 1.67;
                this.vrmLoader.setBlink(Math.max(0, blinkVal));
            }
        } else if (this.blinkTimer >= this.blinkInterval) {
            this.blinkTimer = 0;
            this.blinkInterval = 2 + Math.random() * 3;
            this.isBlinking = true;
            this.blinkProgress = 0;
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
                this.vrmLoader.setMouthOpen((Math.sin(t * 18) * 0.25 + 0.45) * decay);
                requestAnimationFrame(laugh);
            } else {
                this.vrmLoader.setMouthOpen(0);
                this.setExpression('neutral', 0.25);
            }
        };
        laugh();
    }
}
