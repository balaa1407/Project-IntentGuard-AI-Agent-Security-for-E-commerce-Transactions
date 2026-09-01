import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Text } from '@react-three/drei';
import * as THREE from 'three';

// Particle field around gateway
function ParticleField({ count = 200, color = "#38BDF8" }) {
  const points = useMemo(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 2.5 + Math.random() * 2.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      coords[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      coords[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      coords[i * 3 + 2] = radius * Math.cos(phi);
    }
    return coords;
  }, [count]);

  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[points, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color={color}
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Gateway Core Shield
function GatewayCore({ decision, onNodeClick }) {
  const coreRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();

  // Color mapping based on backend decision
  const themeColor = useMemo(() => {
    if (decision === 'APPROVE') return '#10B981'; // Emerald
    if (decision === 'BLOCK') return '#EF4444';   // Crimson
    if (decision === 'REQUIRE_CONFIRMATION') return '#F59E0B'; // Amber
    return '#38BDF8'; // Electric blue default
  }, [decision]);

  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.25;
      coreRef.current.rotation.x += delta * 0.15;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 0.4;
      ring1Ref.current.rotation.x += delta * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= delta * 0.3;
      ring2Ref.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group>
      {/* Central Holographic Geodesic Core */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh 
          ref={coreRef} 
          onClick={() => onNodeClick && onNodeClick('GATEWAY_CORE')}
          cursor="pointer"
        >
          <icosahedronGeometry args={[1.0, 1]} />
          <meshStandardMaterial
            color={themeColor}
            wireframe
            emissive={themeColor}
            emissiveIntensity={0.8}
            transparent
            opacity={0.85}
          />
        </mesh>
      </Float>

      {/* Orbiting Security Shield Ring 1 */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.6, 0.02, 16, 100]} />
        <meshBasicMaterial color={themeColor} transparent opacity={0.6} />
      </mesh>

      {/* Orbiting Security Shield Ring 2 */}
      <mesh ref={ring2Ref}>
        <torusGeometry args={[2.0, 0.015, 16, 100]} />
        <meshBasicMaterial color="#14B8A6" transparent opacity={0.4} />
      </mesh>

      {/* Dynamic Status Text */}
      <Text
        position={[0, -1.8, 0]}
        fontSize={0.16}
        color={themeColor}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
      >
        {`TRUST BOUNDARY: ${decision || 'ARMED'}`}
      </Text>
    </group>
  );
}

// 2D SVG Fallback if WebGL is unavailable or reduced motion is enabled
function GatewayFallback({ decision, onNodeClick }) {
  const color = decision === 'APPROVE' ? '#10B981' : decision === 'BLOCK' ? '#EF4444' : decision === 'REQUIRE_CONFIRMATION' ? '#F59E0B' : '#38BDF8';
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '24px' }}>
      <svg width="180" height="180" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="1" strokeDasharray="4 2" opacity="0.4" />
        <circle cx="50" cy="50" r="35" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
        <polygon points="50,22 75,37 75,63 50,78 25,63 25,37" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="50" cy="50" r="8" fill={color} opacity="0.9" />
      </svg>
      <div style={{ marginTop: '16px', color, fontWeight: 700, fontSize: '0.9rem', letterSpacing: '1px' }}>
        TRUST BOUNDARY: {decision || 'ARMED'}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
        Deterministic Policy Gate Active
      </div>
    </div>
  );
}

export default function ThreeGateway({ decision = 'APPROVE', selectedNode, onNodeSelect, height = '280px' }) {
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setHasWebGL(false);
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  if (!hasWebGL) {
    return <GatewayFallback decision={decision} onNodeClick={onNodeSelect} />;
  }

  return (
    <div style={{ height, width: '100%', position: 'relative', borderRadius: '12px', overflow: 'hidden', background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.8) 0%, rgba(11, 15, 23, 0.95) 100%)' }}>
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-5, -5, -5]} color="#0284C7" intensity={0.8} />

        <GatewayCore decision={decision} onNodeClick={onNodeSelect} />
        <ParticleField 
          count={150} 
          color={decision === 'BLOCK' ? '#EF4444' : decision === 'REQUIRE_CONFIRMATION' ? '#F59E0B' : '#38BDF8'} 
        />

        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          autoRotate 
          autoRotateSpeed={0.8}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>

      {/* Corner Tag */}
      <div style={{ position: 'absolute', top: '12px', left: '16px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', pointerEvents: 'none' }}>
        3D Policy Gateway Core
      </div>
    </div>
  );
}
