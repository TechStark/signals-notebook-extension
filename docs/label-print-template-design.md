# Label Print Template Design

## Overview

This document describes the design for a Label Print Template feature in the Signals Notebook Extension. Users can define custom label templates and批量 print labels for selected samples.

## User Flow

1. User navigates to a Samples Container in SNB
2. Extension injects a "Sample Tools" button in the toolbar
3. User clicks the button, opens SampleToolsModal
4. User selects multiple samples in the table
5. User clicks "Print Labels" button
6. Extension generates HTML labels based on the selected template
7. Browser print dialog opens, user prints labels

## Feature Requirements

### Template Management

- Maximum 5 templates stored in Chrome Sync Storage
- Templates are ordered, first template is the default
- All samplesContainers share the same template list (cross-tenant compatible)

### Label Configuration

| Property | Description |
|----------|-------------|
| Name | Template display name |
| Width | Label width in mm (user-defined) |
| Height | Label height in mm (user-defined) |
| Grid Rows | Number of grid rows (user-defined) |
| Grid Columns | Number of grid columns (user-defined) |

### Element Types

| Type | Description | Configuration |
|------|-------------|---------------|
| Field | Binds to Sample Property | `name + type` (for cross-tenant compatibility) |
| QR Code | Scannable 2D barcode | Content template with `{fieldName}` placeholders |
| Barcode | Code128 1D barcode | Content template with `{fieldName}` placeholders |
| Static Text | Fixed text label | Plain text content |

### Grid Layout

- Grid is evenly divided (equal cell sizes)
- Elements can span multiple cells (`rowSpan`, `colSpan`)
- Drag-and-drop UI for positioning elements
- WYSIWYG preview while editing

### Element Styles (MVP)

| Style | Values | Applies To |
|-------|--------|------------|
| fontSize | `small`, `medium`, `large` | Field, Static Text |
| bold | `true`, `false` | Field, Static Text |
| align | `left`, `center`, `right` | Field, Static Text |

QR Code and Barcode sizes are determined by grid spanning.

## Data Model

### Sample Property

```typescript
interface SampleProperty {
  key: string;        // System-internal identifier (varies by tenant)
  name: string;       // User-visible display name (stable across tenants)
  type: string;       // Property type: "text", "number", "date", "enum", etc.
}
```

### Template Storage

```typescript
interface LabelTemplates {
  templates: LabelTemplate[];
  // First template in array is the default
}

interface LabelTemplate {
  id: string;                    // UUID
  name: string;                  // Template display name
  width: number;                 // Label width in mm
  height: number;                // Label height in mm
  rows: number;                  // Grid rows count
  cols: number;                  // Grid columns count
  elements: TemplateElement[];
}

type TemplateElement =
  | FieldElement
  | QRCodeElement
  | BarcodeElement
  | StaticTextElement;

interface BaseElement {
  row: number;                   // Start row (0-indexed)
  col: number;                   // Start column (0-indexed)
  rowSpan: number;               // Span rows (default: 1)
  colSpan: number;               // Span columns (default: 1)
  fontSize?: 'small' | 'medium' | 'large';
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface FieldElement extends BaseElement {
  type: 'field';
  propertyName: string;          // Match by name (not key) for cross-tenant compatibility
  propertyType: string;          // Property type for matching
}

interface QRCodeElement extends BaseElement {
  type: 'qrCode';
  contentTemplate: string;       // e.g., "{Sample ID}" or "ID: {Sample ID}"
}

interface BarcodeElement extends BaseElement {
  type: 'barcode';               // Always Code128 format
  contentTemplate: string;       // e.g., "{Sample ID}"
}

interface StaticTextElement extends BaseElement {
  type: 'staticText';
  content: string;               // Fixed text content
}
```

### Example Template

```json
{
  "id": "tpl-001",
  "name": "Standard Sample Label",
  "width": 50,
  "height": 25,
  "rows": 4,
  "cols": 3,
  "elements": [
    {
      "type": "field",
      "propertyName": "Sample ID",
      "propertyType": "text",
      "row": 0,
      "col": 0,
      "colSpan": 2,
      "fontSize": "large",
      "bold": true
    },
    {
      "type": "qrCode",
      "contentTemplate": "{Sample ID}",
      "row": 0,
      "col": 2,
      "rowSpan": 4
    },
    {
      "type": "field",
      "propertyName": "Status",
      "propertyType": "enum",
      "row": 1,
      "col": 0,
      "colSpan": 2
    },
    {
      "type": "staticText",
      "content": "CAUTION",
      "row": 2,
      "col": 0,
      "colSpan": 2,
      "fontSize": "small",
      "align": "center"
    },
    {
      "type": "barcode",
      "contentTemplate": "{Sample ID}",
      "row": 3,
      "col": 0,
      "colSpan": 2
    }
  ]
}
```

## Cross-Tenant Compatibility

### Field Matching Strategy

When rendering a template, the extension:

1. Fetches current tenant's Sample Properties via API
2. For each FieldElement, finds matching property by `propertyName + propertyType`
3. If found, renders the field value
4. If not found, renders `[Unknown: {propertyName}]`

Example rendering output when property not found:
```
Sample ID: S-12345
Status: [Unknown: Approval Status]
```

### QR/Barcode Content Resolution

Content templates use property names (not keys):

```
Template: "{Sample ID}"
Resolution: Find property with name="Sample ID", get value from sample data
Output: "S-12345" (encoded as QR/Barcode)
```

## UI Design

### SampleToolsModal Modes

#### Simple Mode (Default)

- Template selector dropdown (first template pre-selected)
- Preview area showing selected template with placeholder data
- "Edit Template" button (opens Edit Mode)
- "Print Labels" button (prints selected samples)

#### Edit Mode (Full Screen Modal)

- Left panel: Sample Properties list (draggable)
- Center: Canvas with grid (WYSIWYG editor)
- Right panel: Element properties (when element selected)
- Top toolbar: Template name, dimensions, grid settings
- Bottom: Save/Cancel buttons

### Drag-and-Drop Interaction

1. User drags property from left panel onto canvas grid
2. Element snaps to nearest grid cell
3. User can resize element by dragging corners (adjusts rowSpan/colSpan)
4. User can drag element to reposition
5. Right panel shows element properties (fontSize, bold, align, content template)

### Template Management

- "Templates" dropdown in Simple Mode header
- Dropdown shows all templates with "New Template" option
- Each template has "Rename", "Duplicate", "Delete" actions
- Deleting default template makes next one default (auto reorder)

## API Integration

### Sample Properties API

```
GET /api/v1.0/samples/{samplesContainerEid}/properties
```

Response:
```json
{
  "properties": [
    {
      "key": "prop-001",
      "name": "Sample ID",
      "type": "text"
    },
    {
      "key": "prop-002",
      "name": "Created Date",
      "type": "date"
    },
    {
      "key": "prop-003",
      "name": "Status",
      "type": "enum",
      "options": ["Active", "Closed", "Cancelled"]
    }
  ]
}
```

### Sample Data API

(Reuses existing API from SampleToolsModal)

```
GET /api/v1.0/entities/{samplesContainerEid}
GET {contentLink}
```

Returns sample rows with property values keyed by property key.

## Print Output

### HTML Generation

For each selected sample, generate a label div:

```html
<div class="label" style="width: 50mm; height: 25mm;">
  <div class="grid" style="display: grid; grid-template-columns: repeat(3, 1fr);">
    <div class="element field" style="grid-row: 1; grid-column: 1 / 3; font-size: large; font-weight: bold;">
      S-12345
    </div>
    <div class="element qr-code" style="grid-row: 1 / 5; grid-column: 3;">
      <img src="generated-qr.png" alt="QR">
    </div>
    <!-- ... more elements -->
  </div>
</div>
```

### Print Page Layout

- User configures paper size and margins in browser print dialog
- Labels flow left-to-right, top-to-bottom
- Page break handled automatically by CSS
- User can adjust scaling in browser print dialog

### CSS Print Styles

```css
@media print {
  .label {
    page-break-inside: avoid;
    margin: 2mm;
    border: 1px dashed #ccc;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    height: 100%;
  }

  .element {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

## Storage Estimation

Chrome Sync Storage limits:
- Single key: 8KB
- Total: 100KB

Estimated per-template size: ~500 bytes - 1KB
- 5 templates: ~5KB
- Plus existing config (snbHosts): ~1KB
- **Total: ~6KB** (well within limits)

## Implementation Notes

### Libraries

- **QR Code**: `qrcode` (npm) - generate QR codes from content template
- **Barcode**: `jsbarcode` (npm) - generate Code128 barcodes
- **Drag-and-Drop**: `dnd-kit` (npm) - React drag-and-drop for grid layout

### Component Structure

```
src/
├── content/
│   ├── SampleToolsModal.tsx      # Add Print tab or mode toggle
│   └── print/
│       ├── PrintTemplateEditor.tsx    # Full-screen edit mode
│       ├── PrintTemplateCanvas.tsx    # Grid canvas with drag-drop
│       ├── PrintPreview.tsx           # Label preview
│       ├── PrintGenerator.tsx         # HTML generation
│       └── components/
│           ├── DraggableProperty.tsx
│           ├── GridElement.tsx
│           └── PropertyPanel.tsx
├── shared/
│   ├── config.ts                  # Add getPrintTemplates()
│   └── printTypes.ts              # Template type definitions
└── utils/
    ├── qrGenerator.ts             # QR code generation
    └── barcodeGenerator.ts        # Barcode generation
```

## Future Enhancements (Out of Scope for MVP)

- Custom fonts and colors
- Border and background styles
- Image/logo elements
- Per-samplesContainer template assignment
- Template import/export
- More barcode formats (EAN-13, Code39, etc.)
- Label templates for different label printers (ZPL, EPL)
