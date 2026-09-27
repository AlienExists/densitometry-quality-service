import { decodeDicom, DicomFormatError, type DecodedImage } from './dicom';
import type { DicomPreview } from '@/types/study';

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty canvas'))), 'image/png');
  });
}

async function imageToUrl(image: DecodedImage, width: number, height: number): Promise<string> {
  if (image.kind === 'jpeg') {
    const copy = new Uint8Array(image.data.length);
    copy.set(image.data);
    return URL.createObjectURL(new Blob([copy], { type: 'image/jpeg' }));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');

  const imageData = context.createImageData(width, height);
  imageData.data.set(image.data);
  context.putImageData(imageData, 0, 0);

  return URL.createObjectURL(await toBlob(canvas));
}

export async function createPreview(file: File): Promise<DicomPreview> {
  try {
    const decoded = decodeDicom(await file.arrayBuffer());
    const preview: DicomPreview = {
      studyUid: decoded.studyUid,
      sopUid: decoded.sopUid,
      width: decoded.width,
      height: decoded.height,
    };

    if (!decoded.image) {
      return { ...preview, error: decoded.error ?? 'В файле нет изображения.' };
    }

    return { ...preview, url: await imageToUrl(decoded.image, decoded.width, decoded.height) };
  } catch (error) {
    const message =
      error instanceof DicomFormatError ? error.message : 'Не удалось построить предпросмотр.';
    return { error: message };
  }
}
