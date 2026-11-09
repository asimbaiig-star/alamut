// image.ts — shrink an uploaded image in the browser before it's stored.
//
// Shared by the brand logo and the creator's photo. Fits the image into a
// max×max box (aspect kept), and encodes PNG when the source may carry
// transparency (logos), JPEG otherwise.

export async function downscaleToDataUrl(file: File, maxDim = 256): Promise<string> {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: file.type });
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const wantsAlpha = /png|webp|svg/i.test(file.type);
  if (!wantsAlpha) {
    // White behind, so JPEG's lack of transparency doesn't go black.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL(wantsAlpha ? 'image/png' : 'image/jpeg', 0.85);
}

/** A data URL back into a File, for a Storage upload. */
export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type });
}
