"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface HotspotProps {
  position: [number, number, number]
  color: string
  isSelected: boolean
  onClick: () => void
  onPointerOver: () => void
  onPointerOut: () => void
}

// Touch devices get larger markers plus an invisible hit area sized for fingers
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)")
    setIsTouch(query.matches)
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return isTouch
}

export function Hotspot({ position, color, isSelected, onClick, onPointerOver, onPointerOut }: HotspotProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null)
  const [isHovered, setIsHovered] = useState(false)
  const isTouch = useIsTouchDevice()
  const markerScale = isTouch ? 1.75 : 1
  const hitRadius = isTouch ? 0.3 : 0.12

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
      {/* Hit Area - invisible, larger than the marker so it's easy to tap */}
      <mesh
        onClick={onClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[hitRadius, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Main Hotspot */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.08 * markerScale, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 1 : 0.9} />
      </mesh>

      {/* Pulsing Ring */}
      <mesh ref={pulseRef}>
        <ringGeometry args={[0.1 * markerScale, 0.15 * markerScale, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Glow Effect */}
      <pointLight color={color} intensity={isSelected ? 2 : 1} distance={1} />
    </group>
  )
}
