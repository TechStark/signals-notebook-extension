/**
 * Type definitions for Label Print Template feature.
 */

/** Data source types. */
export type DataSource = 'sample' | 'user';

/** User fields are fixed. */
export const USER_FIELDS = ['name', 'email'] as const;
export type UserField = (typeof USER_FIELDS)[number];

/** Sample Property from API. */
export interface SampleProperty {
  key: string;
  name: string;
  type: string;
  options?: string[];
}

/** Storage container for all label templates. */
export interface LabelTemplates {
  templates: LabelTemplate[];
}

/** Single label template definition. */
export interface LabelTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  rows: number;
  cols: number;
  elements: TemplateElement[];
}

/** Union type for all template element types. */
export type TemplateElement = FieldElement | QRCodeElement | BarcodeElement | StaticTextElement;

/** Element type discriminator. */
export type ElementType = 'field' | 'qrCode' | 'barcode' | 'staticText';

/** Base properties shared by all element types. */
export interface BaseElement {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  fontSize?: string;  // Font size with unit, e.g., '12px', '14pt'
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Data field bound to a data source. */
export interface FieldElement extends BaseElement {
  type: 'field';
  source: DataSource;
  fieldName: string;
  dateFormat?: string;  // dayjs format string for date fields, e.g., 'YYYY-MM-DD'
}

/** Content part for QR/Barcode elements. */
export type ContentPart =
  | { type: 'staticText'; content: string }
  | { type: 'field'; source: DataSource; fieldName: string; dateFormat?: string };

/** QR Code element with configurable content. */
export interface QRCodeElement extends BaseElement {
  type: 'qrCode';
  contentParts: ContentPart[];
}

/** Code128 barcode element. */
export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  contentParts: ContentPart[];
}

/** Static text label. */
export interface StaticTextElement extends BaseElement {
  type: 'staticText';
  content: string;
}

/** Default font size. */
export const DEFAULT_FONT_SIZE = '12px';

/** Default template configuration (2x2 grid with ID + QR). */
export const DEFAULT_TEMPLATE: Omit<LabelTemplate, 'id' | 'name'> = {
  width: 50,
  height: 25,
  rows: 2,
  cols: 2,
  elements: [],
};

/** Generate a unique ID for templates. */
export function generateTemplateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate sequential template name. */
export function generateTemplateName(existingCount: number): string {
  return `Template ${existingCount + 1}`;
}

/** Create default elements for a new template. */
export function createDefaultElements(): TemplateElement[] {
  return [
    {
      type: 'field',
      source: 'sample',
      fieldName: 'ID',
      row: 0,
      col: 0,
      rowSpan: 1,
      colSpan: 1,
    },
    {
      type: 'qrCode',
      contentParts: [
        { type: 'field', source: 'sample', fieldName: 'ID' },
      ],
      row: 0,
      col: 1,
      rowSpan: 2,
      colSpan: 1,
    },
  ];
}
