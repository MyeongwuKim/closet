import type { ClothingCategory } from '@closet/types'
import type { ReactNode } from 'react'
import { Footprints, Shirt, Tags, Watch } from 'lucide-react'

interface ClothingCategoryIconProps {
  category: ClothingCategory | string
  size?: number
  strokeWidth?: number
  className?: string
}

interface CustomCategoryIconProps {
  size: number
  strokeWidth: number
  className?: string
}

function CustomCategoryIcon({
  size,
  strokeWidth,
  className,
  children,
}: CustomCategoryIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function ClothingCategoryIcon({
  category,
  size = 24,
  strokeWidth = 1.7,
  className,
}: ClothingCategoryIconProps) {
  const customIconProps = { size, strokeWidth, className }

  if (category === 'bottom') {
    return (
      <CustomCategoryIcon {...customIconProps}>
        <path d="M6 3h12l1 18h-6l-1-10-1 10H5L6 3Z" />
        <path d="M6 6h12M12 3v5M6 6l3 3M18 6l-3 3" />
      </CustomCategoryIcon>
    )
  }

  if (category === 'outer') {
    return (
      <CustomCategoryIcon {...customIconProps}>
        <path d="m8 3-4 2-2 8 4 2 1-4v10h10V11l1 4 4-2-2-8-4-2" />
        <path d="m8 3 4 4 4-4M8 3v6l4-2 4 2V3M12 7v14M8.5 15h2M13.5 15h2" />
      </CustomCategoryIcon>
    )
  }

  if (category === 'midlayer') {
    return (
      <CustomCategoryIcon {...customIconProps}>
        <path d="m8 3-4 2-2 8 4 2 1-4v10h10V11l1 4 4-2-2-8-4-2" />
        <path d="m8 3 4 5 4-5M12 8v13M14.5 11h.01M14.5 14h.01M14.5 17h.01" />
      </CustomCategoryIcon>
    )
  }

  if (category === 'dress') {
    return (
      <CustomCategoryIcon {...customIconProps}>
        <path d="M9 3c.5 2 1.5 3 3 3s2.5-1 3-3l2 1-1 6 4 11H4l4-11-1-6 2-1Z" />
        <path d="M8 10h8" />
      </CustomCategoryIcon>
    )
  }

  const Icon =
    category === 'top'
      ? Shirt
      : category === 'shoes'
        ? Footprints
        : category === 'accessory'
          ? Watch
          : Tags

  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  )
}
