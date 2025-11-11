"use client"

import * as LucideIcons from "lucide-react"
import { LucideIcon } from "lucide-react"

/**
 * 아이콘 이름으로 Lucide 아이콘 컴포넌트를 반환합니다.
 * @param iconName - Lucide 아이콘 이름 (예: "CheckSquare", "check-square", "Calendar", "Heart")
 * @returns Lucide 아이콘 컴포넌트 또는 null
 */
export function getLucideIcon(iconName?: string): LucideIcon | null {
  if (!iconName) return null
  
  // 이미 PascalCase인 경우 그대로 사용, 그렇지 않으면 변환
  let pascalCaseName: string
  if (/^[A-Z][a-zA-Z0-9]*$/.test(iconName)) {
    // 이미 PascalCase 형식
    pascalCaseName = iconName
  } else {
    // kebab-case나 snake_case를 PascalCase로 변환 (예: "check-square" -> "CheckSquare")
    pascalCaseName = iconName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("")
  }
  
  // Lucide 아이콘 객체에서 해당 아이콘 찾기 (대소문자 구분)
  const IconComponent = (LucideIcons as unknown as Record<string, LucideIcon>)[pascalCaseName]
  
  return IconComponent || null
}

