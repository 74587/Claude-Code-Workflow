# Component Library

## One-Liner
**A comprehensive collection of reusable UI components built with Radix UI primitives and Tailwind CSS, following shadcn/ui patterns for consistent, accessible, and customizable interfaces.**

---

## Overview

**Location**: `ccw/frontend/src/components/ui/`

**Purpose**: Provides a consistent set of UI components for building the CCW frontend application.

**Technology Stack**:
- **Radix UI**: Unstyled, accessible component primitives
- **Tailwind CSS**: Utility-first styling with custom theme
- **class-variance-authority (CVA)**: Type-safe variant prop management
- **Lucide React**: Consistent iconography

---

## Live Demo: Component Gallery

:::demo ComponentGallery
# component-gallery.tsx
/**
 * Component Gallery Demo
 * Interactive showcase of all UI components
 */
export function ComponentGallery() {
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [buttonVariant, setButtonVariant] = React.useState('default')
  const [switchState, setSwitchState] = React.useState(false)
  const [checkboxState, setCheckboxState] = React.useState(false)
  const [selectedTab, setSelectedTab] = React.useState('variants')

  const categories = [
    { id: 'all', label: 'All Components' },
    { id: 'buttons', label: 'Buttons' },
    { id: 'forms', label: 'Forms' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'navigation', label: 'Navigation' },
    { id: 'overlays', label: 'Overlays' },
  ]

  const components = {
    buttons: [
      { name: 'Button', variants: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'gradient'] },
    ],
    forms: [
      { name: 'Input', type: 'text' },
      { name: 'Textarea', type: 'textarea' },
      { name: 'Select', type: 'select' },
      { name: 'Checkbox', type: 'checkbox' },
      { name: 'Switch', type: 'switch' },
    ],
    feedback: [
      { name: 'Badge', variants: ['default', 'secondary', 'success', 'warning', 'destructive'] },
      { name: 'Progress', type: 'progress' },
      { name: 'Alert', type: 'alert' },
    ],
    navigation: [
      { name: 'Tabs', type: 'tabs' },
      { name: 'Breadcrumb', type: 'breadcrumb' },
    ],
    overlays: [
      { name: 'Dialog', type: 'dialog' },
      { name: 'Drawer', type: 'drawer' },
      { name: 'Dropdown', type: 'dropdown' },
    ],
  }

  const buttonVariants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']

  return (
    <div className="p-6 bg-background space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">UI Component Library</h1>
        <p className="text-muted-foreground">Interactive showcase of all available UI components</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-accent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Buttons Section */}
      {(selectedCategory === 'all' || selectedCategory === 'buttons') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Buttons</h2>
          <div className="space-y-6">
            {/* Variant Selector */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Variant</label>
              <div className="flex flex-wrap gap-2">
                {buttonVariants.map((variant) => (
                  <button
                    key={variant}
                    onClick={() => setButtonVariant(variant)}
                    className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${
                      buttonVariant === variant
                        ? 'bg-primary text-primary-foreground ring-2 ring-ring'
                        : 'border hover:bg-accent'
                    }`}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            </div>

            {/* Button Sizes */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Sizes</label>
              <div className="flex items-center gap-3 flex-wrap">
                <button className={`h-8 rounded-md px-3 text-sm ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  Small
                </button>
                <button className={`h-10 px-4 py-2 rounded-md text-sm ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  Default
                </button>
                <button className={`h-11 rounded-md px-8 text-sm ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  Large
                </button>
                <button className={`h-10 w-10 rounded-md flex items-center justify-center ${buttonVariant === 'default' ? 'bg-primary text-primary-foreground' : 'border'}`}>
                  ⚙
                </button>
              </div>
            </div>

            {/* All Button Variants */}
            <div className="space-y-3">
              <label className="text-sm font-medium">All Variants</label>
              <div className="flex flex-wrap gap-3 p-4 border rounded-lg bg-muted/20">
                <button className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90">Default</button>
                <button className="px-4 py-2 rounded-md text-sm bg-destructive text-destructive-foreground hover:opacity-90">Destructive</button>
                <button className="px-4 py-2 rounded-md text-sm border bg-background hover:bg-accent">Outline</button>
                <button className="px-4 py-2 rounded-md text-sm bg-secondary text-secondary-foreground hover:opacity-80">Secondary</button>
                <button className="px-4 py-2 rounded-md text-sm hover:bg-accent">Ghost</button>
                <button className="px-4 py-2 rounded-md text-sm text-primary underline-offset-4 hover:underline">Link</button>
                <button className="px-4 py-2 rounded-md text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90">Gradient</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Forms Section */}
      {(selectedCategory === 'all' || selectedCategory === 'forms') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Form Components</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Input */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Input</label>
              <input
                type="text"
                placeholder="Enter text..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                placeholder="Error state"
                className="flex h-10 w-full rounded-md border border-destructive bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </div>

            {/* Textarea */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Textarea</label>
              <textarea
                placeholder="Enter multi-line text..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Checkbox */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Checkbox</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded border border-primary" checked={checkboxState} onChange={(e) => setCheckboxState(e.target.checked)} />
                  <span>Accept terms and conditions</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer opacity-50">
                  <input type="checkbox" className="h-4 w-4 rounded border border-primary" />
                  <span>Subscribe to newsletter</span>
                </label>
              </div>
            </div>

            {/* Switch */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Switch</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={switchState} onChange={(e) => setSwitchState(e.target.checked)} />
                    <div className="w-9 h-5 bg-input rounded-full peer peer-focus:ring-2 peer-focus:ring-ring peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                  </div>
                  <span className="text-sm">Enable notifications {switchState ? '(on)' : '(off)'}</span>
                </label>
              </div>
            </div>

            {/* Select */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Select</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Choose an option</option>
                <option value="1">Option 1</option>
                <option value="2">Option 2</option>
                <option value="3">Option 3</option>
              </select>
            </div>

            {/* Form Actions */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Form Actions</label>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90">Submit</button>
                <button className="px-4 py-2 rounded-md text-sm border hover:bg-accent">Cancel</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Feedback Section */}
      {(selectedCategory === 'all' || selectedCategory === 'feedback') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Feedback Components</h2>

          {/* Badges */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Badges</label>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">Default</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">Secondary</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-destructive text-destructive-foreground">Destructive</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-success text-white">Success</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-warning text-white">Warning</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-info text-white">Info</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">Outline</span>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Progress Bars</label>
            <div className="space-y-3 max-w-md">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Processing...</span>
                  <span>65%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: '65%' }}/>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Uploading...</span>
                  <span>30%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: '30%' }}/>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Alerts</label>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 border rounded-lg bg-destructive/10 border-destructive/20 text-destructive">
                <span className="text-lg">⚠</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">Error occurred</div>
                  <div className="text-xs mt-1 opacity-80">Something went wrong. Please try again.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 border rounded-lg bg-success/10 border-success/20 text-success">
                <span className="text-lg">✓</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">Success!</div>
                  <div className="text-xs mt-1 opacity-80">Your changes have been saved.</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Navigation Section */}
      {(selectedCategory === 'all' || selectedCategory === 'navigation') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Navigation Components</h2>

          {/* Tabs */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Tabs</label>
            <div className="border-b">
              <div className="flex gap-4">
                {['Overview', 'Documentation', 'API Reference', 'Examples'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedTab(tab.toLowerCase().replace(' ', '-'))}
                    className={`pb-3 px-1 text-sm border-b-2 transition-colors ${
                      selectedTab === tab.toLowerCase().replace(' ', '-')
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Breadcrumb</label>
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground">Home</a>
              <span>/</span>
              <a href="#" className="hover:text-foreground">Components</a>
              <span>/</span>
              <span className="text-foreground">Library</span>
            </nav>
          </div>
        </section>
      )}

      {/* Overlays Section */}
      {(selectedCategory === 'all' || selectedCategory === 'overlays') && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Overlay Components</h2>

          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Dialog</h3>
              <p className="text-muted-foreground text-xs">Modal dialogs for focused user interactions.</p>
              <button className="mt-3 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded">Open Dialog</button>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Drawer</h3>
              <p className="text-muted-foreground text-xs">Side panels that slide in from screen edges.</p>
              <button className="mt-3 px-3 py-1.5 text-xs border rounded hover:bg-accent">Open Drawer</button>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Dropdown Menu</h3>
              <p className="text-muted-foreground text-xs">Context menus and action lists.</p>
              <button className="mt-3 px-3 py-1.5 text-xs border rounded hover:bg-accent">▼ Open Menu</button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
:::

---

## Available Components

### Form Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Button](/components/ui/button) | Clickable action buttons with variants and sizes | `variant`, `size`, `asChild` |
| [Input](/components/ui/input) | Text input field | `error` |
| [Textarea](/components/ui/textarea) | Multi-line text input | `error` |
| [Select](/components/ui/select) | Dropdown selection (Radix) | Select components |
| [Checkbox](/components/ui/checkbox) | Boolean checkbox (Radix) | `checked`, `onCheckedChange` |
| [Switch](/components/ui/switch) | Toggle switch | `checked`, `onCheckedChange` |

### Layout Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Card](/components/ui/card) | Content container with header/footer | Nested components |
| [Separator](/components/ui/separator) | Visual divider | `orientation` |
| [ScrollArea](/components/ui/scroll-area) | Custom scrollbar container | - |

### Feedback Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Badge](/components/ui/badge) | Status indicator label | `variant` |
| [Progress](/components/ui/progress) | Progress bar | `value` |
| [Alert](/components/ui/alert) | Notification message | `variant` |
| [Toast](/components/ui/toast) | Temporary notification (Radix) | Toast components |

### Navigation Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Tabs](/components/ui/tabs) | Tab navigation (Radix) | Tabs components |
| [TabsNavigation](/components/ui/tabs-navigation) | Custom tab bar | `tabs`, `value`, `onValueChange` |
| [Breadcrumb](/components/ui/breadcrumb) | Navigation breadcrumb | Breadcrumb components |

### Overlay Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Dialog](/components/ui/dialog) | Modal dialog (Radix) | `open`, `onOpenChange` |
| [Drawer](/components/ui/drawer) | Side panel (Radix) | `open`, `onOpenChange` |
| [Dropdown Menu](/components/ui/dropdown) | Context menu (Radix) | Dropdown components |
| [Popover](/components/ui/popover) | Floating content (Radix) | `open`, `onOpenChange` |
| [Tooltip](/components/ui/tooltip) | Hover tooltip (Radix) | `content` |
| [AlertDialog](/components/ui/alert-dialog) | Confirmation dialog (Radix) | Dialog components |

### Disclosure Components

| Component | Description | Props |
|-----------|-------------|-------|
| [Collapsible](/components/ui/collapsible) | Expand/collapse content (Radix) | `open`, `onOpenChange` |
| [Accordion](/components/ui/accordion) | Collapsible sections (Radix) | Accordion components |

---

## Button Variants

The Button component supports 8 variants via CVA (class-variance-authority):

| Variant | Use Case | Preview |
|---------|----------|--------|
| `default` | Primary action | <span className="inline-block px-3 py-1 rounded bg-primary text-primary-foreground text-xs">Default</span> |
| `destructive` | Dangerous actions | <span className="inline-block px-3 py-1 rounded bg-destructive text-destructive-foreground text-xs">Destructive</span> |
| `outline` | Secondary action | <span className="inline-block px-3 py-1 rounded border text-xs">Outline</span> |
| `secondary` | Less emphasis | <span className="inline-block px-3 py-1 rounded bg-secondary text-secondary-foreground text-xs">Secondary</span> |
| `ghost` | Subtle action | <span className="inline-block px-3 py-1 rounded text-xs">Ghost</span> |
| `link` | Text link | <span className="inline-block px-3 py-1 underline text-primary text-xs">Link</span> |
| `gradient` | Featured action | <span className="inline-block px-3 py-1 rounded bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs">Gradient</span> |
| `gradientPrimary` | Primary gradient | <span className="inline-block px-3 py-1 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">Primary</span> |

### Button Sizes

| Size | Height | Padding |
|------|--------|---------|
| `sm` | 36px | 12px horizontal |
| `default` | 40px | 16px horizontal |
| `lg` | 44px | 32px horizontal |
| `icon` | 40px | Square (icon only) |

---

## Badge Variants

The Badge component supports 9 variants for different status types:

| Variant | Use Case | Color |
|---------|----------|-------|
| `default` | General info | Primary theme |
| `secondary` | Less emphasis | Secondary theme |
| `destructive` | Error/Danger | Destructive theme |
| `outline` | Subtle | Text color only |
| `success` | Success state | Green |
| `warning` | Warning state | Amber |
| `info` | Information | Blue |
| `review` | Review status | Purple |
| `gradient` | Featured | Brand gradient |

---

## Usage Examples

### Button

```tsx
import { Button } from '@/components/ui/Button'

<Button variant="default" onClick={handleClick}>
  Click me
</Button>

<Button variant="destructive" size="sm">
  Delete
</Button>

<Button variant="ghost" size="icon">
  <SettingsIcon />
</Button>
```

### Input with Error State

```tsx
import { Input } from '@/components/ui/Input'

<Input
  type="text"
  error={hasError}
  placeholder="Enter your name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

### Checkbox

```tsx
import { Checkbox } from '@/components/ui/Checkbox'

<Checkbox
  checked={accepted}
  onCheckedChange={setAccepted}
/>
<label>Accept terms</label>
```

### Switch

```tsx
import { Switch } from '@/components/ui/Switch'

<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
/>
<span>Enable feature</span>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Brief description here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Main content goes here.</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Badge

```tsx
import { Badge, badgeVariants } from '@/components/ui/Badge'

<Badge variant="success">Completed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Failed</Badge>
```

---

## Accessibility

All components follow Radix UI's accessibility standards:

- **Keyboard Navigation**: All interactive components are fully keyboard accessible
- **ARIA Attributes**: Proper roles, states, and properties
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Focus Management**: Visible focus indicators and logical tab order
- **Color Contrast**: WCAG AA compliant color combinations

### Keyboard Shortcuts

| Component | Keys |
|-----------|-------|
| Button | <kbd>Enter</kbd>, <kbd>Space</kbd> |
| Checkbox/Switch | <kbd>Space</kbd> to toggle |
| Select | <kbd>Arrow</kbd> keys, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to close |
| Dialog | <kbd>Esc</kbd> to close |
| Tabs | <kbd>Arrow</kbd> keys to navigate |
| Dropdown | <kbd>Arrow</kbd> keys, <kbd>Enter</kbd> to select |

---

## Related Links

- [Radix UI Primitives](https://www.radix-ui.com/) - Headless UI component library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Component patterns reference
- [CVA Documentation](https://cva.style/) - Class Variance Authority
