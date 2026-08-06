# Label Print Template Design

## Overview

This document describes the design for a Label Print Template feature in the Signals Notebook Extension. Users can define custom label templates and批量 print labels for selected samples.

## User Flow

1. User navigates to a Samples Container in SNB
2. Extension injects a "Sample Tools" button in the toolbar
3. User clicks the button, opens SampleToolsModal
4. User selects multiple samples in the table
5. Below the table, user sees Print Settings card with template selector and Print button
6. User clicks "Print Labels" button
7. Extension generates HTML labels based on the selected template
8. Browser print dialog opens, user prints labels

## Feature Requirements

### Template Management

- Maximum 5 templates stored in Chrome Sync Storage
- Templates are ordered, first template is the default
- Template naming: `Template 1`, `Template 2`, etc. (sequential numbering)
- All samplesContainers share the same template list (cross-tenant compatible)

### Default Template

New templates are created with default content:
- Grid: 2 rows × 2 columns
- Element 1: Field (source=sample, fieldName=ID, row=0, col=0)
- Element 2: QR Code (contentTemplate="{ID}", row=0, col=1, rowSpan=2, colSpan=1)

### Label Configuration

| Property | Description |
|----------|-------------|
| Name | Template display name (`Template N`) |
| Width | Label width in mm (user-defined) |
| Height | Label height in mm (user-defined) |
| Grid Rows | Number of grid rows (user-defined) |
| Grid Columns | Number of grid columns (user-defined) |

### Data Sources

MVP supports two data sources:

| Source | Description | Available Fields |
|--------|-------------|------------------|
| `sample` | Sample properties from API | Dynamic (from Sample Properties API) |
| `user` | Current logged-in user | `name`, `email` |

Future extensibility: `experiment`, `materials` (not implemented in MVP)

### Element Types

| Type | Description | Configuration |
|------|-------------|---------------|
| Field | Binds to data source field | `source`, `fieldName` |
| QR Code | Scannable 2D barcode | Structured content parts (static text + dynamic fields) |
| Barcode | Code128 1D barcode | Structured content parts (static text + dynamic fields) |
| Static Text | Fixed text label | Plain text content |

### Grid Layout

- Grid is evenly divided (equal cell sizes)
- Elements can span multiple cells (`rowSpan`, `colSpan`)
- **In-template drag-and-drop**: Drag elements within the grid to reposition
- **Drag-resize**: Drag element corner to adjust rowSpan/colSpan
- **Real-time preview**: Canvas reflects width/height changes instantly

### Element Styles (MVP)

| Style | Values | Applies To |
|-------|--------|------------|
| fontSize | `small`, `medium`, `large` | Field, Static Text |
| bold | `true`, `false` | Field, Static Text |
| align | `left`, `center`, `right` | Field, Static Text |

QR Code and Barcode sizes are determined by grid spanning.

## Data Model

### Data Sources

```typescript
type DataSource = 'sample' | 'user';

// User fields are fixed
const USER_FIELDS = ['name', 'email'] as const;

// Sample fields are dynamic, fetched from API
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
  name: string;                  // Template display name (e.g., "Template 1")
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
  source: 'sample' | 'user';    // Data source
  fieldName: string;            // e.g., "ID" or "name"
}

// Content part for QR/Barcode elements
type ContentPart =
  | { type: 'staticText'; content: string }
  | { type: 'field'; source: DataSource; fieldName: string };

interface QRCodeElement extends BaseElement {
  type: 'qrCode';
  contentParts: ContentPart[];  // Structured content parts
}

interface BarcodeElement extends BaseElement {
  type: 'barcode';              // Always Code128 format
  contentParts: ContentPart[];   // Structured content parts
}

interface StaticTextElement extends BaseElement {
  type: 'staticText';
  content: string;              // Fixed text content
}
```

### Example Template (Default)

```json
{
  "id": "tpl-001",
  "name": "Template 1",
  "width": 50,
  "height": 25,
  "rows": 2,
  "cols": 2,
  "elements": [
    {
      "type": "field",
      "source": "sample",
      "fieldName": "ID",
      "row": 0,
      "col": 0,
      "rowSpan": 1,
      "colSpan": 1
    },
    {
      "type": "qrCode",
      "contentParts": [
        { "type": "field", "source": "sample", "fieldName": "ID" }
      ],
      "row": 0,
      "col": 1,
      "rowSpan": 2,
      "colSpan": 1
    }
  ]
}
```

### Example: URL with Multiple Parts

```json
{
  "type": "qrCode",
  "contentParts": [
    { "type": "staticText", "content": "http://yourdomain/" },
    { "type": "field", "source": "user", "fieldName": "email" },
    { "type": "staticText", "content": "/" },
    { "type": "field", "source": "sample", "fieldName": "ID" }
  ]
}
```

This resolves to: `http://yourdomain/user@example.com/S-12345`

## Cross-Tenant Compatibility

### Field Matching Strategy

When rendering a template, the extension:

1. Fetches current tenant's Sample Properties via API
2. For each FieldElement:
   - If source is `user`: Use fixed fields (name, email)
   - If source is `sample`: Find matching property by `fieldName`
     - First try matching by `name` (display name)
     - Then try matching by `key` (internal identifier)
3. If found, renders the field value
4. If not found, renders `[Unknown: {fieldName}]`

### QR/Barcode Content Resolution

Content is built from structured parts:

```json
{
  "contentParts": [
    { "type": "staticText", "content": "ID: " },
    { "type": "field", "source": "sample", "fieldName": "ID" },
    { "type": "staticText", "content": " by " },
    { "type": "field", "source": "user", "fieldName": "name" }
  ]
}
```

Resolution:
1. For each part, resolve the value
2. Concatenate all parts
3. Result: `ID: S-12345 by John Doe` (encoded as QR/Barcode)

## UI Design

### SampleToolsModal Layout

In Simple Mode, the modal is divided into two sections:

1. **Top Section**: Sample table with selection
2. **Bottom Section**: Print Settings Card (visually grouped)
   - Template selector (dropdown)
   - Template preview (optional)
   - "Edit Template" button
   - "Print Labels" button

### Template Editor (Full Screen Modal)

- **Top toolbar**: Template name input, Width/Height inputs, Grid Rows/Cols inputs
- **Left side**: Grid canvas (WYSIWYG editor)
- **Right side**: Property panel
  - When no element selected: "Add Element" buttons (+ Field, + QR, + Barcode, + Text)
  - When element selected: Element properties with "Add Element" button to switch back

### Drag-and-Drop Interaction (In-Template)

1. Click on an element to select it
2. Drag element to reposition within grid (snaps to grid cells)
3. Drag element's bottom-right corner to resize (adjusts rowSpan/colSpan)
4. Right panel updates with element properties

### Adding Elements

1. Click "Add Element" button in right panel
2. Select element type: Field, QR Code, Barcode, Static Text
3. For Field: Select data source (Sample/User), then select specific field
4. Element appears in first available grid cell
5. User drags to desired position

### Property Panel Layout

When an element is selected, the right panel shows:

- **Position**: Row, Col (number inputs)
- **Size**: Row Span, Col Span (number inputs)
- **Content** (for Field): Source dropdown, Field dropdown
- **Content** (for QR/Barcode): Dynamic content builder
  - Add "Text" button: Adds static text part
  - Add "Field" button: Adds field part (with Source and Field dropdowns)
  - List of parts with reorder handles and delete buttons
  - Live preview of resolved content
- **Content** (for Static Text): Text input
- **Style**: Font Size dropdown, Bold toggle, Align dropdown

Each property has a clear label on the left side.

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

### User Data

Current user info is obtained from SNB session or API. Available fields:
- `name`: User's display name
- `email`: User's email address

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

- Additional data sources: Experiment properties, Materials
- Custom fonts and colors
- Border and background styles
- Image/logo elements
- Per-samplesContainer template assignment
- Template import/export
- More barcode formats (EAN-13, Code39, etc.)
- Label templates for different label printers (ZPL, EPL)
