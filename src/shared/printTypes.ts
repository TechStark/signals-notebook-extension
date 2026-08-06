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
  fontSize?: 'small' | 'medium' | 'large';
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Data field bound to a data source. */
export interface FieldElement extends BaseElement {
  type: 'field';
  source: DataSource;
  fieldName: string;
  fieldType: string;
}

/** QR Code element with configurable content. */
export interface QRCodeElement extends BaseElement {
  type: 'qrCode';
  contentTemplate: string;
}

/** Code128 barcode element. */
export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  contentTemplate: string;
}

/** Static text label. */
export interface StaticTextElement extends BaseElement {
  type: 'staticText';
  content: string;
}

/** Font size to CSS mapping. */
export const FONT_SIZE_MAP: Record<'small' | 'medium' | 'large', string> = {
  small: '10px',
  medium: '14px',
  large: '18px',
};

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
      fieldType: 'text',
      row: 0,
      col: 0,
      rowSpan: 1,
      colSpan: 1,
    },
    {
      type: 'qrCode',
      contentTemplate: '{ID}',
      row: 0,
      col: 1,
      rowSpan: 2,
      colSpan: 1,
    },
  ];
}
