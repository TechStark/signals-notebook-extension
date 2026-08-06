import type { LabelTemplate, TemplateElement, SampleProperty, ContentPart } from '@shared/printTypes';
import { FONT_SIZE_MAP } from '@shared/printTypes';
import { generateQRCode } from '@/utils/qrGenerator';
import { generateBarcodeDataURL } from '@/utils/barcodeGenerator';
import dayjs from 'dayjs';

interface PrintContext {
  template: LabelTemplate;
  samples: Record<string, unknown>[];
  properties: SampleProperty[];
  userData?: { name: string; email: string };
}

/** Default date format for date/datetime fields. */
const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/** Checks if a property type is a date type. */
function isDateType(type: string): boolean {
  return type === 'date' || type === 'datetime';
}

/** Formats a value based on property type and format string. */
function formatValue(
  value: unknown,
  prop: SampleProperty | undefined,
  dateFormat?: string,
): string {
  if (value === null || value === undefined) return '-';
  
  // Handle object values with 'auto' property
  if (typeof value === 'object' && 'auto' in (value as object)) {
    value = (value as { auto?: string }).auto;
    if (!value) return '-';
  }
  
  // Format date values
  if (prop && isDateType(prop.type)) {
    const format = dateFormat || DEFAULT_DATE_FORMAT;
    return dayjs(String(value)).format(format);
  }
  
  return String(value);
}

/**
 * Resolves content parts to a string.
 */
function resolveContentParts(
  parts: ContentPart[],
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
  userData?: { name: string; email: string },
): string {
  return parts.map((part) => {
    if (part.type === 'staticText') {
      return part.content;
    }
    // field type
    if (part.source === 'user') {
      if (part.fieldName === 'name' && userData) return userData.name;
      if (part.fieldName === 'email' && userData) return userData.email;
      return `[Unknown: ${part.fieldName}]`;
    }
    // sample source
    let prop = properties.find((p) => p.name === part.fieldName);
    if (!prop) {
      prop = properties.find((p) => p.key === part.fieldName);
    }
    if (!prop) return `[Unknown: ${part.fieldName}]`;
    const value = sampleData[prop.key];
    return formatValue(value, prop, part.dateFormat);
  }).join('');
}

/**
 * Gets the display value for a field element.
 */
function getFieldDisplayValue(
  element: TemplateElement & { type: 'field' },
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
  userData?: { name: string; email: string },
): string {
  if (element.source === 'user') {
    if (element.fieldName === 'name' && userData) return userData.name;
    if (element.fieldName === 'email' && userData) return userData.email;
    return `[Unknown: ${element.fieldName}]`;
  }

  let prop = properties.find((p) => p.name === element.fieldName);
  if (!prop) {
    prop = properties.find((p) => p.key === element.fieldName);
  }
  if (!prop) return `[Unknown: ${element.fieldName}]`;
  const value = sampleData[prop.key];
  return formatValue(value, prop, element.dateFormat);
}

/**
 * Generates an HTML element for a template element.
 */
async function generateElementHTML(
  element: TemplateElement,
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
  userData?: { name: string; email: string },
): Promise<string> {
  const style = `
    grid-column: ${element.col + 1} / span ${element.colSpan};
    grid-row: ${element.row + 1} / span ${element.rowSpan};
    font-size: ${element.fontSize ? FONT_SIZE_MAP[element.fontSize] : '12px'};
    font-weight: ${element.bold ? 'bold' : 'normal'};
    text-align: ${element.align || 'left'};
    display: flex;
    align-items: center;
    justify-content: ${element.align === 'center' ? 'center' : element.align === 'right' ? 'flex-end' : 'flex-start'};
    padding: 2px;
    overflow: hidden;
  `;

  switch (element.type) {
    case 'field':
      return `<div style="${style}">${getFieldDisplayValue(element, sampleData, properties, userData)}</div>`;

    case 'staticText':
      return `<div style="${style}">${element.content}</div>`;

    case 'qrCode': {
      const content = resolveContentParts(element.contentParts, sampleData, properties, userData);
      const qrDataUrl = await generateQRCode(content);
      return `<div style="${style} justify-content: center;">
        <img src="${qrDataUrl}" alt="QR" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
      </div>`;
    }

    case 'barcode': {
      const content = resolveContentParts(element.contentParts, sampleData, properties, userData);
      const barcodeDataUrl = generateBarcodeDataURL(content);
      return `<div style="${style} justify-content: center;">
        <img src="${barcodeDataUrl}" alt="Barcode" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
      </div>`;
    }

    default:
      return '';
  }
}

/**
 * Generates a single label HTML.
 */
async function generateLabelHTML(
  template: LabelTemplate,
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
  userData?: { name: string; email: string },
): Promise<string> {
  const elementsHTML = await Promise.all(
    template.elements.map((el) => generateElementHTML(el, sampleData, properties, userData)),
  );

  return `
    <div class="label" style="width: ${template.width}mm; height: ${template.height}mm; border: 1px solid #ccc; box-sizing: border-box; page-break-inside: avoid; margin: 2mm;">
      <div style="display: grid; grid-template-columns: repeat(${template.cols}, 1fr); grid-template-rows: repeat(${template.rows}, 1fr); height: 100%; gap: 1px;">
        ${elementsHTML.join('\n')}
      </div>
    </div>
  `;
}

/**
 * Generates a full HTML document for printing labels.
 */
export async function generatePrintHTML(context: PrintContext): Promise<string> {
  const { template, samples, properties, userData } = context;

  const labelsHTML = await Promise.all(
    samples.map((sample) => generateLabelHTML(template, sample, properties, userData)),
  );

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Print Labels</title>
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          .label { page-break-inside: avoid; }
          .labels-container {
            display: flex;
            flex-wrap: wrap;
            gap: 0;
          }
        }
        @media screen {
          body { font-family: sans-serif; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="labels-container">
        ${labelsHTML.join('\n')}
      </div>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `;
}

/**
 * Opens print window with generated labels.
 */
export async function printLabels(context: PrintContext): Promise<void> {
  const html = await generatePrintHTML(context);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.focus();
  }
}
