import QRCode from 'qrcode';

/**
 * Generates a QR code data URL from content.
 */
export async function generateQRCode(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    margin: 1,
    width: 200,
  });
}

/**
 * Generates QR code as a canvas element.
 */
export async function generateQRCodeCanvas(content: string): Promise<HTMLCanvasElement> {
  return QRCode.toCanvas(content, {
    margin: 1,
    width: 200,
  });
}
