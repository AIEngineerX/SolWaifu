import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Scene {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();

        // Create gradient background
        const bgColor1 = new THREE.Color(0x0a0a0f);
        const bgColor2 = new THREE.Color(0x1a0a20);
        this.scene.background = bgColor1;

        // Create camera - positioned to frame upper body of character
        this.camera = new THREE.PerspectiveCamera(
            30, // Lower FOV for portrait framing
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(0.5, 1.4, 2.5);
        this.camera.lookAt(0, 1.2, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Setup lighting
        this.setupLighting();

        // Setup controls (optional camera movement)
        this.setupControls();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Add subtle background particles
        this.createParticles();
    }

    setupLighting() {
        // Ambient light - soft overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Main key light - warm, from front-right
        const keyLight = new THREE.DirectionalLight(0xfff0e6, 1.2);
        keyLight.position.set(2, 2, 3);
        this.scene.add(keyLight);

        // Fill light - cooler, from left
        const fillLight = new THREE.DirectionalLight(0xe6f0ff, 0.5);
        fillLight.position.set(-2, 1, 2);
        this.scene.add(fillLight);

        // Rim/back light - neon purple accent
        const rimLight = new THREE.DirectionalLight(0x9d4edd, 0.8);
        rimLight.position.set(0, 2, -2);
        this.scene.add(rimLight);

        // Bottom accent light - subtle pink
        const bottomLight = new THREE.PointLight(0xff2d95, 0.3, 5);
        bottomLight.position.set(0, 0, 1);
        this.scene.add(bottomLight);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 4;
        this.controls.minPolarAngle = Math.PI / 4;
        this.controls.maxPolarAngle = Math.PI / 1.8;
        this.controls.target.set(0, 1.2, 0);
    }

    createParticles() {
        const particleCount = 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 10;
            positions[i + 1] = (Math.random() - 0.5) * 10;
            positions[i + 2] = (Math.random() - 0.5) * 10 - 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x9d4edd,
            size: 0.03,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    update(deltaTime) {
        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        // Animate particles
        if (this.particles) {
            this.particles.rotation.y += deltaTime * 0.02;
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    getDeltaTime() {
        return this.clock.getDelta();
    }

    getElapsedTime() {
        return this.clock.getElapsedTime();
    }
}
