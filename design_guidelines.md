# Grizzly Mats Driver Management App - Design Guidelines

## Design Approach

**Selected Framework**: Light Glass UI (Glassmorphism)
**Rationale**: A modern, premium aesthetic featuring frosted transparency, subtle blur effects, and luminous overlays. This creates depth and elegance while maintaining excellent usability for a professional driver management application.

**Core Principles**:
- **Layered Depth**: Transparent surfaces with backdrop blur create visual hierarchy
- **Luminous Accents**: Purple-to-cyan gradients provide energetic, modern highlights
- **Ethereal Elegance**: Soft glows and subtle animations enhance the premium feel
- **Light Foundation**: Clean, bright backgrounds ensure readability and professionalism

---

## Color System

### Primary Palette

**Background Colors**:
- `--background`: Light lavender-tinted white (hsl 240 20% 98%)
- `--card`: Pure white with glass effect
- `--sidebar`: Soft frosted panel (hsl 240 20% 97%)

**Accent Gradient Spectrum**:
- **Primary Purple**: hsl(262, 83%, 58%) - #8b5cf6
- **Accent Cyan**: hsl(186, 80%, 45%) - #06b6d4
- **Accent Pink**: hsl(330, 80%, 60%) - #ec4899
- **Accent Blue**: hsl(220, 80%, 55%) - #3b82f6

**Text Colors**:
- **Primary Text**: hsl(240, 10%, 10%) - Near black with blue undertone
- **Secondary Text**: hsl(240, 5%, 45%) - Muted gray
- **On Primary**: Pure white

### Glass Effects

```css
/* Standard glass surface */
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

/* Strong glass (cards, modals) */
.glass-strong {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.9);
}
```

### Gradient Utilities

- **gradient-primary**: Purple to blue (135deg)
- **gradient-accent**: Purple to cyan (135deg)
- **gradient-hero**: Subtle purple/cyan/pink overlay for hero sections
- **text-gradient**: Purple to cyan gradient text for emphasis

---

## Typography System

**Font Family**: Inter, -apple-system, BlinkMacSystemFont, SF Pro Display

**Hierarchy**:
- **Page Headers**: 32px/2rem, weight 700, tracking -0.02em
- **Section Headers**: 24px/1.5rem, weight 600
- **Card Titles**: 20px/1.25rem, weight 600
- **Body Large**: 17px/1.0625rem, weight 400
- **Body**: 15px/0.9375rem, weight 400
- **Caption**: 13px/0.8125rem, weight 400, muted-foreground

**Gradient Text**:
Use `.text-gradient` class for important headings or CTAs to add visual emphasis.

---

## Layout & Spacing System

**Spacing Scale**: 2, 4, 6, 8, 12, 16, 24 (Tailwind units)

**Container Padding**:
- Mobile: px-4 (16px horizontal)
- Desktop: px-6 (24px horizontal)
- Cards: p-6 internal padding

**Border Radius**:
- Small elements: rounded-md (8px)
- Cards/Buttons: rounded-lg (12px)
- Large containers: rounded-xl (16px)
- Extra large: rounded-2xl (20px)

---

## Component Library

### Buttons

**Primary Button**:
- Background: gradient-primary (purple to blue)
- Text: white
- Border radius: rounded-lg (12px)
- Shadow: subtle purple glow on hover
- Height: min-h-9 (default), min-h-10 (lg)

**Secondary Button**:
- Background: glass effect
- Border: subtle white/transparent
- Backdrop blur for glass effect

**Ghost Button**:
- Transparent background
- Hover: subtle purple tint elevation

**Icon Button**:
- Size: 36x36px (size="icon")
- Use for toolbar actions, close buttons

### Cards

**Standard Card**:
- Background: white with glass-strong effect
- Border: 1px solid card-border (subtle)
- Border radius: rounded-xl (16px)
- Shadow: subtle purple-tinted shadow
- Backdrop blur for glass effect

**Hover State**:
- Subtle lift animation
- Enhanced shadow with glow

### Sidebar

**Glass Sidebar**:
- Background: frosted panel with backdrop blur
- Border right: subtle separator
- Active item: purple accent background with left border highlight

**Menu Items**:
- Height: 40px
- Hover: subtle accent background
- Active: stronger accent with left border indicator

### Form Inputs

**Text Input**:
- Background: glass subtle effect
- Border: 1px solid input border
- Border radius: rounded-lg (12px)
- Focus: purple ring with glow
- Height: h-9 (36px)

**Select/Dropdown**:
- Same glass styling as inputs
- Dropdown menu: glass-strong with shadow

### Badges

**Default Badge**:
- Background: gradient-primary
- Text: white
- Border radius: rounded-md

**Secondary Badge**:
- Background: secondary (muted)
- Text: secondary-foreground

**Outline Badge**:
- Transparent with subtle border
- Glass effect background

---

## Shadow & Glow System

**Base Shadows** (purple-tinted):
- shadow-sm: 0 2px 8px rgba(139, 92, 246, 0.08)
- shadow: 0 4px 12px rgba(139, 92, 246, 0.1)
- shadow-md: 0 6px 20px rgba(139, 92, 246, 0.12)
- shadow-lg: 0 8px 30px rgba(139, 92, 246, 0.15)

**Glow Effects**:
- glow-sm: 0 0 15px purple accent
- glow-md: 0 0 25px purple accent
- glow-lg: 0 0 40px purple accent

**Hover Glow**:
Apply `.hover-glow` class for interactive elements that should glow on hover.

---

## Animation System

**Transition Defaults**:
- Duration: 200-300ms
- Easing: ease-out

**Available Animations**:
- `animate-fade-in`: Fade in with subtle upward movement
- `animate-slide-in-right`: Slide in from right
- `animate-scale-in`: Scale up from 95%
- `animate-float`: Gentle floating motion
- `animate-pulse-glow`: Pulsing glow effect
- `animate-shimmer`: Loading shimmer effect

**Interaction States**:
- Hover: Use elevation system (hover-elevate)
- Active: Scale 98% with enhanced elevation
- Focus: Purple ring with offset

---

## Responsive Breakpoints

- **Mobile**: < 768px (base)
- **Tablet**: 768px - 1024px (md:)
- **Desktop**: > 1024px (lg:)

**Mobile Considerations**:
- Touch targets: minimum 48px height
- Full-width buttons on mobile
- Bottom navigation for drivers
- Collapsible sidebar on tablet

---

## Accessibility

- WCAG 2.1 AA compliance
- Focus indicators: 2px purple ring with 2px offset
- Minimum contrast ratios maintained
- All interactive elements have visible focus states
- Form labels always visible

---

## Dark Mode Support

The design system includes full dark mode support:

**Dark Mode Colors**:
- Background: Deep blue-black (hsl 240 20% 6%)
- Cards: Dark glass with subtle transparency
- Text: Off-white (hsl 0 0% 98%)
- Accents: Brighter purple/cyan for visibility

**Dark Glass Effects**:
```css
.dark .glass {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

---

## Usage Notes

1. **Always use glass effects on surfaces** that overlay content or backgrounds
2. **Apply gradient-hero** to hero sections for the signature ethereal look
3. **Use text-gradient** sparingly for important headings only
4. **Maintain consistent border-radius** throughout the application
5. **Purple accent** is primary, cyan is secondary - use gradient between them for CTAs
6. **Glow effects** should be subtle - don't overuse
7. **Animations** should be purposeful and enhance UX, not distract
