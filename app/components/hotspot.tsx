"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import * as THREE from "three"
import { Billboard } from "@react-three/drei"

interface HotspotProps {
  position: [number, number, number]
  color: string
  // Critically endangered markers pulse; the rest hold still so the red ones stand out
  critical?: boolean
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

export function Hotspot({ position, color, critical = false, isSelected, onClick, onPointerOver, onPointerOut }: HotspotProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null)
  const [isHovered, setIsHovered] = useState(false)
  const isTouch = useIsTouchDevice()
  const markerScale = isTouch ? 1.75 : 1
  const hitRadius = isTouch ? 0.3 : 0.12

  useFrame((state) => {
    if (!critical) return
    const t = state.clock.elapsedTime
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.15)
    }
    if (pulseRef.current) {
      // Ring expands outward and fades, like a sonar ping
      const phase = (t * 0.7) % 1
      pulseRef.current.scale.setScalar(1 + phase * 1.6)
      pulseRef.current.material.opacity = 0.6 * (1 - phase)
    }
  })

  // Hover preview is mouse/pen only: on touch, a tap opens the profile, and a fake
  // "hover" from the tap would leave the card stuck on screen
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === "touch") return
    setIsHovered(true)
    onPointerOver()
  }

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === "touch") return
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

      {/* Pulsing ring on critical markers; a white ring marks the selected one */}
      <Billboard>
      {critical && (
        <mesh ref={pulseRef}>
          <ringGeometry args={[0.1 * markerScale, 0.13 * markerScale, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {(isSelected || isHovered) && (
        <mesh>
          <ringGeometry args={[0.12 * markerScale, 0.145 * markerScale, 32]} />
          <meshBasicMaterial color="#e6eef0" side={THREE.DoubleSide} />
        </mesh>
      )}
      </Billboard>

      {/* Glow Effect */}
      <pointLight color={color} intensity={isSelected ? 0.8 : 0.3} distance={0.6} />
    </group>
  )
}
