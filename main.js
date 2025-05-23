import './style.css'

import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.setZ(30);

const renderer = new THREE.WebGLRenderer({ 
    canvas: document.querySelector('#bg'),
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const pointLight = new THREE.PointLight(0xffffff);
pointLight.position.set(20, 20, 20);
pointLight.intensity = 2;
const ambientLight = new THREE.AmbientLight(0xffffff);
ambientLight.intensity = 1;
scene.add(pointLight, ambientLight);

// Shader code
const vertexShader = `
    uniform float amplitude;
    uniform bool pushOutPhase;
    attribute vec3 customColor;
    attribute vec3 displacement;
    varying vec3 vNormal;
    varying vec3 vColor;
    void main() {
        vNormal = normal;
        vColor = customColor;
        // Multiply the push out direction by 3.0 for a further fall
        vec3 direction = pushOutPhase ? vec3(0.0, -15.0, 0.0) : normal;
        vec3 newPosition = position + direction * amplitude * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
    }
`;

const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vColor;
    void main() {
        const float ambient = 0.4;
        vec3 light = vec3( 1.0 );
        light = normalize( light );
        float directional = max( dot( vNormal, light ), 0.0 );
        gl_FragColor = vec4( ( directional + ambient ) * vColor, 1.0 );
    }
`;

const loader = new FontLoader();
loader.load(
    'https://cdn.jsdelivr.net/npm/three@0.157.0/examples/fonts/helvetiker_regular.typeface.json',
    function (font) {
        let geometry = new TextGeometry('Gavyn Page', {
            font: font,
            size: 6,
            depth: 1,
            curveSegments: 6,
            bevelEnabled: false,
        });
        geometry.center();


        // Tessellate
        const tessellateModifier = new TessellateModifier(8, 6);
        geometry = tessellateModifier.modify(geometry);

        // Add custom attributes
        const numFaces = geometry.attributes.position.count / 3;
        const colors = new Float32Array(numFaces * 3 * 3);
        const displacement = new Float32Array(numFaces * 3 * 3);
        const color = new THREE.Color();

        const palette = [0xe3c134, 0x829def, 0x2c2c5c];

        for (let f = 0; f < numFaces; f++) {
            const index = 9 * f;
            const h = 0.2 * Math.random();
            const s = 0.5 + 0.5 * Math.random();
            const l = 0.5 + 0.5 * Math.random();
            color.setHex(palette[Math.floor(Math.random() * palette.length)]);

            // One random Y displacement for the whole face
            const dispY = Math.random() * 10 + 2; // Y: 2 to 12 (random fall distance)

            for (let i = 0; i < 3; i++) {
                colors[index + (3 * i)] = color.r;
                colors[index + (3 * i) + 1] = color.g;
                colors[index + (3 * i) + 2] = color.b;
                displacement[index + (3 * i)] = 2 * (Math.random() - 0.5); // X: -1 to 1
                displacement[index + (3 * i) + 1] = dispY; // SAME Y for all 3 vertices of the face
                displacement[index + (3 * i) + 2] = 2 * (Math.random() - 0.5); // Z: -1 to 1
            }
        }
        geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('displacement', new THREE.BufferAttribute(displacement, 3));

        // Shader material
        const uniforms = {
            amplitude: { value: 0.0 },
            pushOutPhase: { value: true } // true = push out, false = pull in
        };
        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });

        const textMesh = new THREE.Mesh(geometry, shaderMaterial);
        scene.add(textMesh);

        let startTime = Date.now() * 0.001;
        const pushOutDuration = 5;   // seconds (faster)
        const pauseDuration = 2;   // seconds (pause between phases)
        const pullInDuration = 3;    // seconds (slower)
        const totalDuration = pushOutDuration + pauseDuration + pullInDuration + pauseDuration;

        function animate() {
            requestAnimationFrame(animate);

            const now = Date.now() * 0.001;
            let t = (now - startTime) % totalDuration;

            if (t < pushOutDuration) {
                // Push out: amplitude goes from 0 to 1 quickly, downward
                uniforms.amplitude.value = t / pushOutDuration;
                uniforms.pushOutPhase.value = true;
            } else if (t < pushOutDuration + pauseDuration) {
                // Pause after push out
                uniforms.amplitude.value = 1.0;
                uniforms.pushOutPhase.value = true;
            } else if (t < pushOutDuration + pauseDuration + pullInDuration) {
                // Pull in: amplitude goes from 1 to 0 slowly, along normal
                const pullT = t - (pushOutDuration + pauseDuration);
                uniforms.amplitude.value = 1 - (pullT / pullInDuration);
                uniforms.pushOutPhase.value = false;
            } else {
                // Pause after pull in
                uniforms.amplitude.value = 0.0;
                uniforms.pushOutPhase.value = false;
            }

            renderer.render(scene, camera);
        }
        animate();
    }
);