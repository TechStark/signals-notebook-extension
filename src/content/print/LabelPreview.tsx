import React, { useMemo } from 'react';
import type { LabelTemplate, TemplateElement, SampleProperty } from '@shared/printTypes';
import { FONT_SIZE_MAP } from '@shared/printTypes';
import { generateQRCode } from '@/utils/qrGenerator';
import { generateBarcodeDataURL } from '@/utils/barcodeGenerator';

interface LabelPreviewProps {
  template: LabelTemplate;
  sampleData: Record<string, unknown>;
  properties: SampleProperty[];
  userData?: { name: string; email: string };
}

/**
 * Resolves a content template string with data from multiple sources.
 */
function resolveTemplate(
  template: string,
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
  userData?: { name: string; email: string },
): string {
  return template.replace(/\{([^}]+)\}/g, (_, fieldName: string) => {
    // First check user fields
    if (fieldName === 'name' && userData) return userData.name;
    if (fieldName === 'email' && userData) return userData.email;

    // Then check sample properties
    const prop = properties.find((p) => p.name === fieldName);
    if (!prop) return `[Unknown: ${fieldName}]`;
    const value = sampleData[prop.key];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object' && 'auto' in (value as object)) {
      return (value as { auto?: string }).auto || '-';
    }
    return String(value);
  });
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

  // sample source
  const prop = properties.find(
    (p) => p.name === element.fieldName && p.type === element.fieldType,
  );
  if (!prop) return `[Unknown: ${element.fieldName}]`;
  const value = sampleData[prop.key];
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object' && 'auto' in (value as object)) {
    return (value as { auto?: string }).auto || '-';
  }
  return String(value);
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
      const content = resolveTemplate(element.contentTemplate, sampleData, properties, userData);
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
      const content = resolveTemplate(element.contentTemplate, sampleData, properties, userData);
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
