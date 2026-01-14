import { Scene } from './scene.js';
import { VRMLoader } from './vrm-loader.js';
import { AnimationController } from './animations.js';
import { ChatController } from './chat.js';
import { VoiceController } from './voice.js';

// Sexy floating particles background
function createParticles() {
    const particleContainer = document.createElement('div');
    particleContainer.id = 'particles-container';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
    `;
    document.body.prepend(particleContainer);

    const colors = ['#ff2e97', '#8b5cf6', '#c084fc', '#38bdf8', '#ff6b9d'];
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 4 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const duration = Math.random() * 20 + 15;
        const delay = Math.random() * -20;
        const startX = Math.random() * 100;

        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            left: ${startX}%;
            bottom: -10px;
            opacity: ${Math.random() * 0.5 + 0.2};
            box-shadow: 0 0 ${size * 2}px ${color};
            animation: floatUp ${duration}s linear ${delay}s infinite;
        `;
        particleContainer.appendChild(particle);
    }

    // Add the keyframe animation
    if (!document.getElementById('particle-styles')) {
        const style = document.createElement('style');
        style.id = 'particle-styles';
        style.textContent = `
            @keyframes floatUp {
                0% {
                    transform: translateY(0) translateX(0) scale(1);
                    opacity: 0;
                }
                10% {
                    opacity: 0.6;
                }
                90% {
                    opacity: 0.3;
                }
                100% {
                    transform: translateY(-100vh) translateX(${Math.random() > 0.5 ? '' : '-'}50px) scale(0.5);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

class DegenWaifuApp {
    constructor() {
        this.scene = null;
        this.vrmLoader = null;
        this.animationController = null;
        this.chatController = null;
        this.voiceController = null;
        this.isRunning = false;

        // Mouse tracking for look-at
        this.mouseX = 0;
        this.mouseY = 0;

        this.init();
    }

    async init() {
        console.log('🌸 Initializing Sol...');

        // Create sexy background particles
        createParticles();

        // Get canvas element
        const canvas = document.getElementById('vrm-canvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }

        // Initialize Three.js scene
        this.scene = new Scene(canvas);
        console.log('✨ Scene initialized');

        // Initialize VRM loader
        this.vrmLoader = new VRMLoader(this.scene.scene);
        console.log('💜 VRM loader ready');

        // Initialize animation controller (will be connected to VRM after load)
        this.animationController = new AnimationController(this.vrmLoader);
        console.log('🎬 Animation controller ready');

        // Initialize voice controller
        this.voiceController = new VoiceController();
        console.log('🎤 Voice controller ready');

        // Initialize chat controller with voice
        this.chatController = new ChatController(this.animationController, this.voiceController);
        console.log('💬 Chat controller ready');

        // Try to load VRM model
        await this.loadModel();

        // Setup mouse tracking for look-at
        this.setupMouseTracking();

        // Start render loop
        this.isRunning = true;
        this.animate();

        console.log('🚀 Sol is ready! wagmi~');
    }

    setupMouseTracking() {
        // Track mouse position for character to look at
        document.addEventListener('mousemove', (e) => {
            // Convert mouse position to normalized coordinates (-1 to 1)
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Also track touch for mobile
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
                this.mouseY = -(touch.clientY / window.innerHeight) * 2 + 1;
            }
        });
    }

    async loadModel() {
        // Show loading indicator
        this.showLoadingIndicator();

        // Model path - supports custom filename
        const modelPath = './models/1713137135966801258.vrm';

        try {
            await this.vrmLoader.load(modelPath, (progress) => {
                this.updateLoadingProgress(progress);
            });

            console.log('✅ VRM model loaded successfully');
            this.hideLoadingIndicator();

            // Set initial expression
            this.animationController.setExpression('happy');

        } catch (error) {
            console.warn('⚠️ Could not load VRM model:', error.message);
            this.showModelInstructions();
        }
    }

    showLoadingIndicator() {
        // Remove existing loading indicator if any
        this.hideLoadingIndicator();

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-model';
        loadingDiv.id = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Loading Sol...</p>
        `;
        document.getElementById('app-container').appendChild(loadingDiv);
    }

    updateLoadingProgress(percent) {
        const loadingP = document.querySelector('#loading-indicator p');
        if (loadingP) {
            loadingP.textContent = `Loading Sol... ${Math.round(percent)}%`;
        }
    }

    hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.remove();
    }

    showModelInstructions() {
        this.hideLoadingIndicator();

        const instructionsDiv = document.createElement('div');
        instructionsDiv.className = 'loading-model';
        instructionsDiv.id = 'model-instructions';
        instructionsDiv.innerHTML = `
            <div style="
                background: rgba(15, 10, 25, 0.95);
                border: 1px solid #8b5cf680;
                border-radius: 16px;
                padding: 30px;
                max-width: 400px;
                text-align: center;
            ">
                <h3 style="
                    background: linear-gradient(135deg, #ff2e97, #8b5cf6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 15px;
                    font-size: 1.3rem;
                ">No Model Found 👀</h3>
                <p style="color: #c4b5fd; margin-bottom: 20px; line-height: 1.6;">
                    Download a VRM model and place it at:<br>
                    <code style="
                        background: rgba(139, 92, 246, 0.2);
                        padding: 4px 8px;
                        border-radius: 4px;
                        color: #ff6b9d;
                    ">models/model.vrm</code>
                </p>
                <p style="color: #7c6f9c; font-size: 0.9rem;">
                    Get free VRM models from:<br>
                    <a href="https://hub.vroid.com" target="_blank" style="color: #38bdf8;">VRoid Hub</a> or
                    <a href="https://booth.pm" target="_blank" style="color: #38bdf8;">Booth.pm</a>
                </p>
            </div>
        `;
        document.getElementById('app-container').appendChild(instructionsDiv);
    }

    animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(() => this.animate());

        const deltaTime = this.scene.getDeltaTime();
        const elapsedTime = this.scene.getElapsedTime();

        // Update scene (controls, particles)
        this.scene.update(deltaTime);

        // Update look-at target based on mouse position
        // Convert 2D mouse to 3D world position in front of character
        if (this.animationController) {
            const lookX = this.mouseX * 1.5; // Scale for natural range
            const lookY = 1.4 + this.mouseY * 0.5; // Center at head height
            const lookZ = 2; // Distance in front
            this.animationController.setLookAtTarget(lookX, lookY, lookZ);
        }

        // 1. Update animations FIRST (includes AnimationMixer + procedural layers)
        this.animationController.update(deltaTime, elapsedTime);

        // 2. Update VRM AFTER animations - syncs bones + SpringBone physics
        this.vrmLoader.update(deltaTime);

        // 3. Render
        this.scene.render();
    }

    // Cleanup
    dispose() {
        this.isRunning = false;
        this.vrmLoader.dispose();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.degenWaifu = new DegenWaifuApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.degenWaifu) {
        window.degenWaifu.dispose();
    }
});
