"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface HotspotProps {
  position: [number, number, number]
  urgency: "critical" | "high" | "moderate"
  isSelected: boolean
  onClick: () => void
  onPointerOver: () => void
  onPointerOut: () => void
}

const URGENCY_COLORS = {
  critical: "#ef4444",
  high: "#f59e0b",
  moderate: "#10b981",
}

export function Hotspot({ position, urgency, isSelected, onClick, onPointerOver, onPointerOut }: HotspotProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)
  const [isHovered, setIsHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.2
      meshRef.current.scale.setScalar(scale)
    }

    if (pulseRef.current) {
      const pulseScale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.5
      pulseRef.current.scale.setScalar(pulseScale)
      pulseRef.current.material.opacity = 0.3 - (pulseScale - 1) * 0.3
    }
  })

  const handlePointerOver = () => {
    setIsHovered(true)
    onPointerOver()
  }

  const handlePointerOut = () => {
    setIsHovered(false)
    onPointerOut()
  }

  return (
    <group position={position}>
      {/* Main Hotspot */}
      <mesh 
        ref={meshRef} 
        onClick={onClick} 
        onPointerOver={handlePointerOver} 
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={URGENCY_COLORS[urgency]} transparent opacity={isSelected ? 1 : 0.9} />
      </mesh>

      {/* Pulsing Ring */}
      <mesh ref={pulseRef}>
        <ringGeometry args={[0.1, 0.15, 32]} />
        <meshBasicMaterial color={URGENCY_COLORS[urgency]} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Glow Effect */}
      <pointLight color={URGENCY_COLORS[urgency]} intensity={isSelected ? 2 : 1} distance={1} />
    </group>
  )
}
