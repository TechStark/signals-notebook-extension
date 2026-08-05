import JsBarcode from 'jsbarcode';

/**
 * Generates a Code128 barcode as a data URL.
 */
export function generateBarcodeDataURL(content: string): string {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, content, {
    format: 'CODE128',
    margin: 1,
    width: 2,
    height: 50,
    displayValue: false,
  });
  return canvas.toDataURL();
}

/**
 * Generates a Code128 barcode as a canvas element.
 */
export function generateBarcodeCanvas(content: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, content, {
    format: 'CODE128',
    margin: 1,
    width: 2,
    height: 50,
    displayValue: false,
  });
  return canvas;
}

/**
 * Generates a Code128 barcode as an SVG string.
 */
export function generateBarcodeSVG(content: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, content, {
    format: 'CODE128',
    margin: 1,
    width: 2,
    height: 50,
    displayValue: false,
  });
  return svg.outerHTML;
}
