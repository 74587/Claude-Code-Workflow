import React from 'react'
import { Button } from '@/components/ui/Button'

/**
 * Button Variants Demo
 * Shows all 8 visual variants and 4 sizes of the Button component
 *
 * Variants include:
 * - default: Primary brand color button
 * - destructive: Red danger button
 * - outline: Bordered light button
 * - secondary: Gray secondary button
 * - ghost: Transparent hover button
 * - link: Link-style button
 * - gradient: Brand gradient button
 * - gradientPrimary: Primary gradient button
 *
 * Sizes include:
 * - default: Standard size (h-10)
 * - sm: Small size (h-9)
 * - lg: Large size (h-11)
 * - icon: Square icon size (h-10 w-10)
 */
export default function ButtonVariants() {
  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Variants Section */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Variants</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="gradient">Gradient</Button>
          <Button variant="gradientPrimary">Gradient Primary</Button>
        </div>
      </div>

      {/* Sizes Section */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Sizes</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">🔍</Button>
        </div>
      </div>
    </div>
  )
}
