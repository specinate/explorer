"use client"

import Image from "next/image"

interface SpecinateLoaderProps {
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
}

export function SpecinateLoader({ 
  size = "md", 
  text = "Loading...", 
  className = "" 
}: SpecinateLoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className={`${sizeClasses[size]} animate-bounce`}>
        <Image
          src="/logo/specinate.svg"
          alt="Specinate Logo"
          width={size === "sm" ? 24 : size === "md" ? 32 : 48}
          height={size === "sm" ? 24 : size === "md" ? 32 : 48}
          className="w-full h-full"
        />
      </div>
      {text && (
        <span className={`${textSizeClasses[size]} text-gray-600 text-center`}>
          {text}
        </span>
      )}
    </div>
  )
}
