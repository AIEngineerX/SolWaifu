/**
 * Animation Controller - Expression and State Management Only
 * Body animation is handled by VRMA files via AnimationMixer
 * This controller handles: blinking, expressions, talking mouth
 */

export class AnimationController {
    constructor(vrmLoader) {
        this.vrmLoader = vrmLoader;
        this.time = 0;

        // State
        this.state = 'idle';
        this.isTalking = false;
        this.talkTime = 0;

        // Blinking
        this.blinkTimer = 0;
        this.blinkInterval = 3;
        this.isBlinking = false;
        this.blinkProgress = 0;

        // Expression
        this.currentExpression = 'neutral';
        this.expressionIntensity = 0.2;
    }

    setLookAtTarget(x, y, z) {
        // Could be used for head tracking if needed
    }

    setState(newState) {
        if (this.state === newState) return;
        this.state = newState;

        switch (newState) {
            case 'talking':
                this.isTalking = true;
                this.talkTime = 0;
                this.currentExpression = 'happy';
                this.expressionIntensity = 0.4;
                break;
            case 'thinking':
                this.isTalking = false;
                this.currentExpression = 'neutral';
                this.expressionIntensity = 0.3;
                break;
            case 'idle':
            default:
                this.isTalking = false;
                this.currentExpression = 'neutral';
                this.expressionIntensity = 0.2;
        }
    }

    setExpression(name, intensity = 0.5) {
        this.currentExpression = name;
        this.expressionIntensity = intensity;
    }

    stopTalking() {
        this.setState('idle');
    }

    playReaction(type) {
        switch (type) {
            case 'excited':
                this.setExpression('happy', 0.9);
                setTimeout(() => this.setExpression('neutral', 0.2), 1500);
                break;
            case 'confused':
                this.setExpression('surprised', 0.6);
                setTimeout(() => this.setExpression('neutral', 0.2), 1000);
                break;
            case 'flirty':
                this.setExpression('happy', 0.7);
                setTimeout(() => this.setExpression('neutral', 0.2), 2000);
                break;
            case 'thinking':
                this.setState('thinking');
                break;
            case 'shy':
                this.setExpression('happy', 0.5);
                setTimeout(() => this.setExpression('neutral', 0.2), 1200);
                break;
        }
    }

    update(deltaTime, elapsedTime) {
        if (!this.vrmLoader.vrm) return;

        const dt = Math.min(deltaTime, 0.1);
        this.time = elapsedTime;

        // Update expressions (body animation handled by VRMA)
        this.updateExpressions(dt);
    }

    updateExpressions(dt) {
        // Reset expressions first
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
                // Subtle smile for neutral
                this.vrmLoader.setHappy(0.1);
        }

        // Blinking
        this.updateBlinking(dt);

        // Talking
        this.updateTalking(dt);
    }

    updateBlinking(dt) {
        this.blinkTimer += dt;

        if (this.isBlinking) {
            this.blinkProgress += dt * 10;
            if (this.blinkProgress >= 1) {
                this.isBlinking = false;
                this.blinkProgress = 0;
                this.vrmLoader.setBlink(0);
            } else {
                // Asymmetric blink: fast close (30%), slow open (70%)
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
    }

    updateTalking(dt) {
        if (!this.isTalking) return;

        this.talkTime += dt;

        // Multi-frequency mouth movement for natural speech
        const base = Math.sin(this.talkTime * 10) * 0.5 + 0.5;
        const variation = Math.sin(this.talkTime * 6.3) * 0.2;
        const slow = Math.sin(this.talkTime * 3.7) * 0.15;

        // Natural pauses
        const pausePattern = Math.sin(this.talkTime * 1.8);
        const pause = pausePattern > 0.2 ? 1 : 0.3;

        const mouthOpen = (base * 0.35 + variation + slow) * pause;
        this.vrmLoader.setMouthOpen(Math.max(0, Math.min(0.5, mouthOpen)));
    }
}
