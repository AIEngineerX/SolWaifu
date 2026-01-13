/**
 * Mixamo Animation Loader for VRM
 * Converts Mixamo FBX animations to work with VRM humanoid bones
 * Based on official three-vrm example: https://github.com/pixiv/three-vrm
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Mixamo bone name -> VRM humanoid bone name mapping
const mixamoVRMRigMap = {
    'mixamorigHips': 'hips',
    'mixamorigSpine': 'spine',
    'mixamorigSpine1': 'chest',
    'mixamorigSpine2': 'upperChest',
    'mixamorigNeck': 'neck',
    'mixamorigHead': 'head',
    'mixamorigLeftShoulder': 'leftShoulder',
    'mixamorigLeftArm': 'leftUpperArm',
    'mixamorigLeftForeArm': 'leftLowerArm',
    'mixamorigLeftHand': 'leftHand',
    'mixamorigLeftHandThumb1': 'leftThumbMetacarpal',
    'mixamorigLeftHandThumb2': 'leftThumbProximal',
    'mixamorigLeftHandThumb3': 'leftThumbDistal',
    'mixamorigLeftHandIndex1': 'leftIndexProximal',
    'mixamorigLeftHandIndex2': 'leftIndexIntermediate',
    'mixamorigLeftHandIndex3': 'leftIndexDistal',
    'mixamorigLeftHandMiddle1': 'leftMiddleProximal',
    'mixamorigLeftHandMiddle2': 'leftMiddleIntermediate',
    'mixamorigLeftHandMiddle3': 'leftMiddleDistal',
    'mixamorigLeftHandRing1': 'leftRingProximal',
    'mixamorigLeftHandRing2': 'leftRingIntermediate',
    'mixamorigLeftHandRing3': 'leftRingDistal',
    'mixamorigLeftHandPinky1': 'leftLittleProximal',
    'mixamorigLeftHandPinky2': 'leftLittleIntermediate',
    'mixamorigLeftHandPinky3': 'leftLittleDistal',
    'mixamorigRightShoulder': 'rightShoulder',
    'mixamorigRightArm': 'rightUpperArm',
    'mixamorigRightForeArm': 'rightLowerArm',
    'mixamorigRightHand': 'rightHand',
    'mixamorigRightHandThumb1': 'rightThumbMetacarpal',
    'mixamorigRightHandThumb2': 'rightThumbProximal',
    'mixamorigRightHandThumb3': 'rightThumbDistal',
    'mixamorigRightHandIndex1': 'rightIndexProximal',
    'mixamorigRightHandIndex2': 'rightIndexIntermediate',
    'mixamorigRightHandIndex3': 'rightIndexDistal',
    'mixamorigRightHandMiddle1': 'rightMiddleProximal',
    'mixamorigRightHandMiddle2': 'rightMiddleIntermediate',
    'mixamorigRightHandMiddle3': 'rightMiddleDistal',
    'mixamorigRightHandRing1': 'rightRingProximal',
    'mixamorigRightHandRing2': 'rightRingIntermediate',
    'mixamorigRightHandRing3': 'rightRingDistal',
    'mixamorigRightHandPinky1': 'rightLittleProximal',
    'mixamorigRightHandPinky2': 'rightLittleIntermediate',
    'mixamorigRightHandPinky3': 'rightLittleDistal',
    'mixamorigLeftUpLeg': 'leftUpperLeg',
    'mixamorigLeftLeg': 'leftLowerLeg',
    'mixamorigLeftFoot': 'leftFoot',
    'mixamorigLeftToeBase': 'leftToes',
    'mixamorigRightUpLeg': 'rightUpperLeg',
    'mixamorigRightLeg': 'rightLowerLeg',
    'mixamorigRightFoot': 'rightFoot',
    'mixamorigRightToeBase': 'rightToes',
};

/**
 * Load a Mixamo FBX animation and convert it to work with a VRM model
 * @param {string} url - URL to the Mixamo FBX file
 * @param {VRM} vrm - The loaded VRM model
 * @returns {Promise<THREE.AnimationClip>} - Animation clip ready for THREE.AnimationMixer
 */
export async function loadMixamoAnimation(url, vrm) {
    const loader = new FBXLoader();

    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (asset) => {
                // Find the animation clip
                const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com')
                    || asset.animations[0];

                if (!clip) {
                    reject(new Error('No animation found in FBX file'));
                    return;
                }

                const tracks = [];
                const restRotationInverse = new THREE.Quaternion();
                const parentRestWorldRotation = new THREE.Quaternion();
                const _quatA = new THREE.Quaternion();
                const _vec3 = new THREE.Vector3();

                // Get hip heights for scaling
                const motionHipsNode = asset.getObjectByName('mixamorigHips');
                const vrmHipsNode = vrm.humanoid.getNormalizedBoneNode('hips');

                const motionHipsHeight = motionHipsNode ? motionHipsNode.position.y : 1;
                const vrmHipsY = vrm.humanoid.normalizedRestPose?.hips?.position?.[1] ?? 1;
                const hipsPositionScale = vrmHipsY / motionHipsHeight;

                clip.tracks.forEach((track) => {
                    const trackSplitted = track.name.split('.');
                    const mixamoRigName = trackSplitted[0];
                    const vrmBoneName = mixamoVRMRigMap[mixamoRigName];

                    if (!vrmBoneName) return;

                    const vrmNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);
                    if (!vrmNode) return;

                    const vrmNodeName = vrmNode.name;
                    const mixamoRigNode = asset.getObjectByName(mixamoRigName);
                    if (!mixamoRigNode) return;

                    const propertyName = trackSplitted[1];

                    // Get rest rotations for conversion
                    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
                    if (mixamoRigNode.parent) {
                        mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);
                    } else {
                        parentRestWorldRotation.identity();
                    }

                    if (track instanceof THREE.QuaternionKeyframeTrack) {
                        // Convert quaternion tracks
                        const newValues = new Float32Array(track.values.length);

                        for (let i = 0; i < track.values.length; i += 4) {
                            _quatA.fromArray(track.values, i);
                            _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
                            _quatA.toArray(newValues, i);
                        }

                        tracks.push(
                            new THREE.QuaternionKeyframeTrack(
                                `${vrmNodeName}.quaternion`,
                                track.times,
                                newValues
                            )
                        );
                    } else if (track instanceof THREE.VectorKeyframeTrack) {
                        // Convert position tracks (mainly for hips)
                        const newValues = new Float32Array(track.values.length);

                        for (let i = 0; i < track.values.length; i += 3) {
                            newValues[i] = track.values[i] * hipsPositionScale;
                            newValues[i + 1] = track.values[i + 1] * hipsPositionScale;
                            newValues[i + 2] = track.values[i + 2] * hipsPositionScale;
                        }

                        tracks.push(
                            new THREE.VectorKeyframeTrack(
                                `${vrmNodeName}.position`,
                                track.times,
                                newValues
                            )
                        );
                    }
                });

                const vrmClip = new THREE.AnimationClip('mixamoAnimation', clip.duration, tracks);
                console.log(`Loaded Mixamo animation: ${tracks.length} tracks, ${clip.duration.toFixed(2)}s duration`);
                resolve(vrmClip);
            },
            (progress) => {
                // Progress callback
            },
            (error) => {
                reject(error);
            }
        );
    });
}

/**
 * Create a lively procedural idle animation for VRM
 * More movement and personality - like a character waiting and looking around
 */
export function createProceduralIdleClip(vrm, duration = 8) {
    const tracks = [];
    const fps = 30;
    const numFrames = duration * fps;
    const times = [];

    for (let i = 0; i <= numFrames; i++) {
        times.push(i / fps);
    }

    // Helper to create values with multiple overlapping waves for organic feel
    const createOrganicMotion = (baseAmp, freq1, freq2 = 0, freq3 = 0, offset = 0) => {
        const values = [];
        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            let val = Math.sin(t * Math.PI * 2 * freq1 + offset) * baseAmp;
            if (freq2) val += Math.sin(t * Math.PI * 2 * freq2 + offset * 1.3) * baseAmp * 0.5;
            if (freq3) val += Math.sin(t * Math.PI * 2 * freq3 + offset * 0.7) * baseAmp * 0.25;
            values.push(val);
        }
        return values;
    };

    // Hips - weight shifting side to side (very visible movement)
    const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
    if (hipsNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            // Slow weight shift
            const yRot = Math.sin(t * Math.PI * 2 * 0.15) * 0.06;
            const zRot = Math.sin(t * Math.PI * 2 * 0.12) * 0.04;
            // Subtle forward/back
            const xRot = Math.sin(t * Math.PI * 2 * 0.2) * 0.02;

            euler.set(xRot, yRot, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${hipsNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Spine - follows hips but counter-rotates slightly
    const spineNode = vrm.humanoid.getNormalizedBoneNode('spine');
    if (spineNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            // Breathing + counter-rotation
            const xRot = Math.sin(t * Math.PI * 2 * 0.25) * 0.03; // Breathing
            const yRot = -Math.sin(t * Math.PI * 2 * 0.15) * 0.03; // Counter hip rotation
            const zRot = -Math.sin(t * Math.PI * 2 * 0.12) * 0.02;

            euler.set(xRot, yRot, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${spineNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Chest - breathing motion (most visible)
    const chestNode = vrm.humanoid.getNormalizedBoneNode('chest');
    if (chestNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            // Pronounced breathing
            const xRot = Math.sin(t * Math.PI * 2 * 0.25) * 0.04;

            euler.set(xRot, 0, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${chestNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Upper chest
    const upperChestNode = vrm.humanoid.getNormalizedBoneNode('upperChest');
    if (upperChestNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = Math.sin(t * Math.PI * 2 * 0.25 + 0.3) * 0.025;

            euler.set(xRot, 0, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${upperChestNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Neck
    const neckNode = vrm.humanoid.getNormalizedBoneNode('neck');
    if (neckNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            // Look around slowly
            const xRot = Math.sin(t * Math.PI * 2 * 0.18) * 0.03;
            const yRot = Math.sin(t * Math.PI * 2 * 0.1) * 0.05;

            euler.set(xRot, yRot, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${neckNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Head - looking around with personality
    const headNode = vrm.humanoid.getNormalizedBoneNode('head');
    if (headNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            // Look around - multiple frequencies for organic feel
            const xRot = Math.sin(t * Math.PI * 2 * 0.12) * 0.04 +
                         Math.sin(t * Math.PI * 2 * 0.31) * 0.02;
            const yRot = Math.sin(t * Math.PI * 2 * 0.08) * 0.08 +
                         Math.sin(t * Math.PI * 2 * 0.19) * 0.03;
            const zRot = Math.sin(t * Math.PI * 2 * 0.14) * 0.02; // Slight tilt

            euler.set(xRot, yRot, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${headNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Left Upper Arm - lowered with sway
    const leftArmNode = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    if (leftArmNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.15 + Math.sin(t * Math.PI * 2 * 0.2) * 0.03;
            const yRot = 0.1 + Math.sin(t * Math.PI * 2 * 0.15) * 0.02;
            const zRot = 1.1 + Math.sin(t * Math.PI * 2 * 0.18) * 0.06; // Arm sway

            euler.set(xRot, yRot, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${leftArmNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Right Upper Arm
    const rightArmNode = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    if (rightArmNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.15 + Math.sin(t * Math.PI * 2 * 0.2 + 0.5) * 0.03;
            const yRot = -0.1 + Math.sin(t * Math.PI * 2 * 0.15 + 0.5) * 0.02;
            const zRot = -1.1 + Math.sin(t * Math.PI * 2 * 0.18 + Math.PI) * 0.06;

            euler.set(xRot, yRot, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${rightArmNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Left Lower Arm - bent with movement
    const leftForearmNode = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
    if (leftForearmNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const yRot = -0.4 + Math.sin(t * Math.PI * 2 * 0.22) * 0.08;

            euler.set(0, yRot, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${leftForearmNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Right Lower Arm
    const rightForearmNode = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
    if (rightForearmNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const yRot = 0.4 + Math.sin(t * Math.PI * 2 * 0.22 + Math.PI) * 0.08;

            euler.set(0, yRot, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${rightForearmNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Left Hand - relaxed with subtle movement
    const leftHandNode = vrm.humanoid.getNormalizedBoneNode('leftHand');
    if (leftHandNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.1 + Math.sin(t * Math.PI * 2 * 0.3) * 0.05;
            const zRot = Math.sin(t * Math.PI * 2 * 0.25) * 0.04;

            euler.set(xRot, 0, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${leftHandNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Right Hand
    const rightHandNode = vrm.humanoid.getNormalizedBoneNode('rightHand');
    if (rightHandNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.1 + Math.sin(t * Math.PI * 2 * 0.3 + 0.5) * 0.05;
            const zRot = Math.sin(t * Math.PI * 2 * 0.25 + 0.5) * 0.04;

            euler.set(xRot, 0, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${rightHandNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Left Upper Leg - weight shift
    const leftLegNode = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
    if (leftLegNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = Math.sin(t * Math.PI * 2 * 0.12) * 0.02;
            const zRot = -0.02 + Math.sin(t * Math.PI * 2 * 0.12) * 0.015;

            euler.set(xRot, 0, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${leftLegNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Right Upper Leg
    const rightLegNode = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
    if (rightLegNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = Math.sin(t * Math.PI * 2 * 0.12 + Math.PI) * 0.02;
            const zRot = 0.02 + Math.sin(t * Math.PI * 2 * 0.12 + Math.PI) * 0.015;

            euler.set(xRot, 0, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${rightLegNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    // Lower legs - slight bend
    const leftLowerLegNode = vrm.humanoid.getNormalizedBoneNode('leftLowerLeg');
    if (leftLowerLegNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.03 + Math.sin(t * Math.PI * 2 * 0.12) * 0.02;

            euler.set(xRot, 0, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${leftLowerLegNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    const rightLowerLegNode = vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
    if (rightLowerLegNode) {
        const quaternions = [];
        const euler = new THREE.Euler();
        const quat = new THREE.Quaternion();

        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.03 + Math.sin(t * Math.PI * 2 * 0.12 + Math.PI) * 0.02;

            euler.set(xRot, 0, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }

        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${rightLowerLegNode.name}.quaternion`,
            times,
            quaternions
        ));
    }

    console.log(`Created procedural idle animation: ${tracks.length} bone tracks, ${duration}s loop`);
    return new THREE.AnimationClip('proceduralIdle', duration, tracks);
}
