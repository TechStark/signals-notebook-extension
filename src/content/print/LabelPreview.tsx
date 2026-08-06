import React, { useMemo } from 'react';
import type { LabelTemplate, TemplateElement, SampleProperty, ContentPart } from '@shared/printTypes';
import { FONT_SIZE_MAP } from '@shared/printTypes';
import { generateQRCode } from '@/utils/qrGenerator';
import { generateBarcodeDataURL } from '@/utils/barcodeGenerator';
import dayjs from 'dayjs';

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

interface LabelPreviewProps {
  template: LabelTemplate;
  sampleData: Record<string, unknown>;
  properties: SampleProperty[];
  userData?: { name: string; email: string };
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
 * Renders a preview of a single label based on template and sample data.
 */
export const LabelPreview: React.FC<LabelPreviewProps> = ({
  template,
  sampleData,
  properties,
  userData,
}) => {
  return (
    <div
      className="label-preview"
      style={{
        width: `${template.width}mm`,
        height: `${template.height}mm`,
        border: '1px solid #ccc',
        boxSizing: 'border-box',
        position: 'relative',
        fontSize: '12px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
          gridTemplateRows: `repeat(${template.rows}, 1fr)`,
          height: '100%',
          gap: '1px',
        }}
      >
        {template.elements.map((element, index) => (
          <LabelElement
            key={index}
            element={element}
            sampleData={sampleData}
            properties={properties}
            userData={userData}
          />
        ))}
      </div>
    </div>
  );
};

interface LabelElementProps {
  element: TemplateElement;
  sampleData: Record<string, unknown>;
  properties: SampleProperty[];
  userData?: { name: string; email: string };
}

const LabelElement: React.FC<LabelElementProps> = ({
  element,
  sampleData,
  properties,
  userData,
}) => {
  const style: React.CSSProperties = {
    gridColumn: `${element.col + 1} / span ${element.colSpan}`,
    gridRow: `${element.row + 1} / span ${element.rowSpan}`,
    fontSize: element.fontSize ? FONT_SIZE_MAP[element.fontSize] : '12px',
    fontWeight: element.bold ? 'bold' : 'normal',
    textAlign: element.align || 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: element.align === 'center' ? 'center' : element.align === 'right' ? 'flex-end' : 'flex-start',
    padding: '2px',
    overflow: 'hidden',
  };

  switch (element.type) {
    case 'field':
      return (
        <div style={style}>
          {getFieldDisplayValue(element, sampleData, properties, userData)}
        </div>
      );

    case 'staticText':
      return <div style={style}>{element.content}</div>;

    case 'qrCode': {
      const content = resolveContentParts(element.contentParts, sampleData, properties, userData);
      const [qrDataUrl, setQrDataUrl] = React.useState<string>('');
      React.useEffect(() => {
        generateQRCode(content).then(setQrDataUrl);
      }, [content]);
      return (
        <div style={{ ...style, justifyContent: 'center' }}>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          )}
        </div>
      );
    }

    case 'barcode': {
      const content = resolveContentParts(element.contentParts, sampleData, properties, userData);
      const barcodeDataUrl = useMemo(
        () => generateBarcodeDataURL(content),
        [content],
      );
      return (
        <div style={{ ...style, justifyContent: 'center' }}>
          <img
            src={barcodeDataUrl}
            alt="Barcode"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      );
    }

    default:
      return null;
  }
};
