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
 * Create a minimal procedural idle animation for VRM
 * Only animates legs - arms/head/body are handled by animations.js for smooth control
 */
export function createProceduralIdleClip(vrm, duration = 8) {
    const tracks = [];
    const fps = 30;
    const numFrames = duration * fps;
    const times = [];

    for (let i = 0; i <= numFrames; i++) {
        times.push(i / fps);
    }

    const euler = new THREE.Euler();
    const quat = new THREE.Quaternion();

    // Only animate LEGS here - everything else is handled procedurally in animations.js
    // This prevents conflicts between mixer animation and procedural overrides

    // Left Upper Leg - subtle weight shift
    const leftLegNode = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
    if (leftLegNode) {
        const quaternions = [];
        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = Math.sin(t * Math.PI * 2 * 0.12) * 0.015;
            const zRot = -0.01 + Math.sin(t * Math.PI * 2 * 0.12) * 0.01;
            euler.set(xRot, 0, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${leftLegNode.name}.quaternion`, times, quaternions
        ));
    }

    // Right Upper Leg
    const rightLegNode = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
    if (rightLegNode) {
        const quaternions = [];
        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = Math.sin(t * Math.PI * 2 * 0.12 + Math.PI) * 0.015;
            const zRot = 0.01 + Math.sin(t * Math.PI * 2 * 0.12 + Math.PI) * 0.01;
            euler.set(xRot, 0, zRot);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${rightLegNode.name}.quaternion`, times, quaternions
        ));
    }

    // Left Lower Leg - slight knee bend
    const leftLowerLegNode = vrm.humanoid.getNormalizedBoneNode('leftLowerLeg');
    if (leftLowerLegNode) {
        const quaternions = [];
        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.02 + Math.sin(t * Math.PI * 2 * 0.12) * 0.015;
            euler.set(xRot, 0, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${leftLowerLegNode.name}.quaternion`, times, quaternions
        ));
    }

    // Right Lower Leg
    const rightLowerLegNode = vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
    if (rightLowerLegNode) {
        const quaternions = [];
        for (let i = 0; i <= numFrames; i++) {
            const t = i / fps;
            const xRot = 0.02 + Math.sin(t * Math.PI * 2 * 0.12 + Math.PI) * 0.015;
            euler.set(xRot, 0, 0);
            quat.setFromEuler(euler);
            quaternions.push(quat.x, quat.y, quat.z, quat.w);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(
            `${rightLowerLegNode.name}.quaternion`, times, quaternions
        ));
    }

    console.log(`Created minimal procedural idle: ${tracks.length} leg tracks, ${duration}s loop`);
    return new THREE.AnimationClip('proceduralIdle', duration, tracks);
}
