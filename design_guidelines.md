# Promo Code Bulk Delete UI - Design Guidelines

## Design Approach
**System:** shadcn/ui Design System (Radix UI primitives)
**Rationale:** Utility-focused data management interface requiring consistent, accessible components with strong interaction patterns for bulk operations and confirmations.

## Core Design Principles
1. **Clarity in Bulk Actions** - Make selection state and action consequences immediately visible
2. **Defensive Design** - Multiple confirmation layers prevent accidental deletion
3. **Information Density** - Maximize data visibility while maintaining scanability
4. **Progressive Disclosure** - Show filters and advanced options on demand

---

## Typography System
- **Headlines:** 24px semi-bold for page title
- **Section Labels:** 14px medium weight for filter headers, table columns
- **Body Text:** 14px regular for table cells, descriptions
- **Helper Text:** 12px regular for counts, validation messages
- **Code Elements:** Monospace font for promo codes and campaign IDs

---

## Layout & Spacing System
**Spacing Scale:** Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-6
- Section gaps: gap-6
- Card spacing: p-4
- Button spacing: px-4 py-2
- Table cell padding: p-4

**Layout Structure:**
```
┌─────────────────────────────────────┐
│ Header: Title + Action Buttons      │ py-6
├─────────────────────────────────────┤
│ Filter Panel (Collapsible)          │ p-6, gap-4
│ - Campaign Name Search              │
│ - Status Multi-Select               │
│ - Discount Range Sliders            │
│ - Applied Filters Pills             │
├─────────────────────────────────────┤
│ Selection Bar (Sticky)              │ px-6 py-4
│ "X items selected" + Bulk Actions   │
├─────────────────────────────────────┤
│ Data Table                          │
│ - Checkbox Column (48px)            │
│ - Code, Campaign, Status, Discount  │
│ - Actions Column (right-aligned)    │
├─────────────────────────────────────┤
│ Pagination Footer                   │ py-4
└─────────────────────────────────────┘
```

---

## Component Library

### Data Table
- **Row Height:** 56px for comfortable scanning
- **Checkbox Column:** Fixed 48px width, left-aligned
- **Status Badges:** Pill-shaped (rounded-full), px-2 py-1, 12px text
- **Hover State:** Subtle row background shift
- **Selected State:** Persistent background treatment
- **Sticky Header:** Position sticky, z-10

### Filter Panel
- **Layout:** Grid with 3 columns on desktop (grid-cols-3), single column mobile
- **Search Input:** Full-width with search icon prefix, 40px height
- **Multi-Select Dropdowns:** shadcn/ui Select with checkboxes, max-height scroll
- **Range Sliders:** shadcn/ui Slider dual handles for min/max discount
- **Clear Filters:** Text button positioned top-right of panel

### Selection Controls
- **Select All Checkbox:** Header position with indeterminate state support
- **Selection Counter:** Bold count + total (e.g., "24 of 156 selected")
- **Bulk Action Button:** Destructive variant, positioned right of counter
- **Clear Selection:** Ghost button for quick deselect

### Modal Dialogs
**Confirmation Modal Structure:**
- **Overlay:** Semi-transparent backdrop
- **Dialog:** Centered, max-w-md, p-6
- **Icon:** Warning icon (48px) at top center
- **Title:** 20px semi-bold, danger context
- **Description:** 14px, includes affected count
- **Action Summary:** Bordered card (p-4) listing items to delete
- **Button Layout:** Two-column grid, gap-3
  - Cancel: Secondary/outline variant (left)
  - Confirm Delete: Destructive variant (right)

### Status Indicators
- **Active:** Rounded badge, success treatment
- **Expired:** Rounded badge, muted treatment  
- **Scheduled:** Rounded badge, info treatment
- **Draft:** Rounded badge, neutral treatment

---

## Interaction Patterns

**Bulk Selection Flow:**
1. Checkbox reveals → Selection bar slides in from bottom
2. Counter updates in real-time
3. Bulk delete button appears with item count badge

**Deletion Confirmation:**
1. Primary modal shows summary + warning
2. Type-to-confirm input for large batches (>10 items)
3. Secondary confirmation toast after successful delete with undo option (5s timeout)

**Filter Application:**
1. Filters apply on change (debounced search)
2. Applied filters show as dismissible pills below panel
3. Count updates: "Showing X of Y promo codes"

---

## Responsive Behavior
- **Desktop (lg+):** 3-column filter grid, full table visible
- **Tablet (md):** 2-column filter grid, scrollable table
- **Mobile:** Stacked filters, card-based list view instead of table

---

## Images
**No hero images required** - This is a data-focused utility interface where screen real estate is dedicated to information density and functional controls.