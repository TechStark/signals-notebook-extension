import React, { useMemo } from 'react';
import type { LabelTemplate, TemplateElement, SampleProperty } from '@shared/printTypes';
import { FONT_SIZE_MAP } from '@shared/printTypes';
import { generateQRCode } from '@/utils/qrGenerator';
import { generateBarcodeDataURL } from '@/utils/barcodeGenerator';

interface LabelPreviewProps {
  template: LabelTemplate;
  sampleData: Record<string, unknown>;
  properties: SampleProperty[];
}

/**
 * Resolves a content template string with sample data.
 * E.g., "{Sample ID}" -> "S-12345"
 */
function resolveTemplate(
  template: string,
  sampleData: Record<string, unknown>,
  properties: SampleProperty[],
): string {
  return template.replace(/\{([^}]+)\}/g, (_, propName: string) => {
    const prop = properties.find((p) => p.name === propName);
    if (!prop) return `[Unknown: ${propName}]`;
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
): string {
  const prop = properties.find(
    (p) => p.name === element.propertyName && p.type === element.propertyType,
  );
  if (!prop) return `[Unknown: ${element.propertyName}]`;
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
}

const LabelElement: React.FC<LabelElementProps> = ({
  element,
  sampleData,
  properties,
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
          {getFieldDisplayValue(element, sampleData, properties)}
        </div>
      );

    case 'staticText':
      return <div style={style}>{element.content}</div>;

    case 'qrCode': {
      const content = resolveTemplate(element.contentTemplate, sampleData, properties);
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
      const content = resolveTemplate(element.contentTemplate, sampleData, properties);
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
