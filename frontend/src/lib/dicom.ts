const IMPLICIT_LE = '1.2.840.10008.1.2';
const EXPLICIT_LE = '1.2.840.10008.1.2.1';
const EXPLICIT_BE = '1.2.840.10008.1.2.2';
const DEFLATED = '1.2.840.10008.1.2.1.99';
const JPEG_BASELINE = '1.2.840.10008.1.2.4.50';

const LONG_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'SV', 'UC', 'UN', 'UR', 'UT', 'UV']);
const UNDEFINED_LENGTH = 0xffffffff;

const TAGS = {
  transferSyntax: 0x00020010,
  sopInstanceUid: 0x00080018,
  studyInstanceUid: 0x0020000d,
  samplesPerPixel: 0x00280002,
  photometric: 0x00280004,
  planarConfiguration: 0x00280006,
  numberOfFrames: 0x00280008,
  rows: 0x00280010,
  columns: 0x00280011,
  bitsAllocated: 0x00280100,
  bitsStored: 0x00280101,
  pixelRepresentation: 0x00280103,
  windowCenter: 0x00281050,
  windowWidth: 0x00281051,
  rescaleIntercept: 0x00281052,
  rescaleSlope: 0x00281053,
  pixelData: 0x7fe00010,
} as const;

const WANTED = new Set<number>(Object.values(TAGS));

interface Header {
  tag: number;
  vr: string;
  length: number;
  valueOffset: number;
}

export type DecodedImage =
  | { kind: 'rgba'; data: Uint8ClampedArray }
  | { kind: 'jpeg'; data: Uint8Array };

export interface DecodedDicom {
  studyUid?: string;
  sopUid?: string;
  width: number;
  height: number;
  image?: DecodedImage;
  error?: string;
}

export class DicomFormatError extends Error {}

class Parser {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  readonly elements = new Map<number, Header>();
  encapsulatedPixelOffset: number | null = null;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  get size(): number {
    return this.bytes.length;
  }

  readHeader(offset: number, explicit: boolean): Header {
    if (offset + 8 > this.size) throw new DicomFormatError('Файл обрывается раньше времени.');

    const group = this.view.getUint16(offset, true);
    const element = this.view.getUint16(offset + 2, true);
    const tag = ((group << 16) | element) >>> 0;

    if (group === 0xfffe || !explicit) {
      return { tag, vr: '', length: this.view.getUint32(offset + 4, true), valueOffset: offset + 8 };
    }

    const vr = String.fromCharCode(this.bytes[offset + 4], this.bytes[offset + 5]);
    if (LONG_VRS.has(vr)) {
      if (offset + 12 > this.size) throw new DicomFormatError('Файл обрывается раньше времени.');
      return { tag, vr, length: this.view.getUint32(offset + 8, true), valueOffset: offset + 12 };
    }
    return { tag, vr, length: this.view.getUint16(offset + 6, true), valueOffset: offset + 8 };
  }

  parseElements(start: number, explicit: boolean, collect: boolean): number {
    let offset = start;

    while (offset + 8 <= this.size) {
      const header = this.readHeader(offset, explicit);

      if (header.tag === 0xfffee00d || header.tag === 0xfffee0dd) {
        return header.valueOffset;
      }

      if (header.length === UNDEFINED_LENGTH) {
        if (header.tag === TAGS.pixelData) {
          if (collect) {
            this.encapsulatedPixelOffset = header.valueOffset;
            this.elements.set(header.tag, header);
          }
          return this.size;
        }
        offset = this.skipSequence(header.valueOffset, explicit);
        continue;
      }

      if (collect && WANTED.has(header.tag)) {
        this.elements.set(header.tag, header);
      }
      offset = header.valueOffset + header.length;
    }

    return this.size;
  }

  skipSequence(start: number, explicit: boolean): number {
    let offset = start;

    while (offset + 8 <= this.size) {
      const item = this.readHeader(offset, false);

      if (item.tag === 0xfffee0dd) return item.valueOffset;
      if (item.tag !== 0xfffee000) {
        throw new DicomFormatError('Повреждена структура DICOM-файла.');
      }

      offset =
        item.length === UNDEFINED_LENGTH
          ? this.parseElements(item.valueOffset, explicit, false)
          : item.valueOffset + item.length;
    }

    return this.size;
  }

  string(tag: number): string | undefined {
    const header = this.elements.get(tag);
    if (!header || header.length === UNDEFINED_LENGTH) return undefined;
    const end = Math.min(header.valueOffset + header.length, this.size);
    let value = '';
    for (let i = header.valueOffset; i < end; i += 1) {
      value += String.fromCharCode(this.bytes[i]);
    }
    return value.replace(/[\0\s]+$/g, '').trim() || undefined;
  }

  number(tag: number): number | undefined {
    const value = this.string(tag);
    if (!value) return undefined;
    const n = parseFloat(value.split('\\')[0]);
    return Number.isFinite(n) ? n : undefined;
  }

  uint16(tag: number): number | undefined {
    const header = this.elements.get(tag);
    if (!header || header.length < 2) return undefined;
    return this.view.getUint16(header.valueOffset, true);
  }

  slice(start: number, length: number): Uint8Array {
    return this.bytes.subarray(start, Math.min(start + length, this.size));
  }

  pixelView(): DataView {
    return this.view;
  }

  fragments(): Uint8Array[] {
    if (this.encapsulatedPixelOffset === null) return [];
    const result: Uint8Array[] = [];
    let offset = this.encapsulatedPixelOffset;
    let first = true;

    while (offset + 8 <= this.size) {
      const item = this.readHeader(offset, false);
      if (item.tag === 0xfffee0dd) break;
      if (item.tag !== 0xfffee000 || item.length === UNDEFINED_LENGTH) break;
      if (!first) result.push(this.slice(item.valueOffset, item.length));
      first = false;
      offset = item.valueOffset + item.length;
    }

    return result;
  }
}

function looksExplicit(bytes: Uint8Array, offset: number): boolean {
  const a = bytes[offset + 4];
  const b = bytes[offset + 5];
  return a >= 65 && a <= 90 && b >= 65 && b <= 90;
}

function renderGrayscale(parser: Parser, width: number, height: number): Uint8ClampedArray {
  const header = parser.elements.get(TAGS.pixelData)!;
  const view = parser.pixelView();
  const bitsAllocated = parser.uint16(TAGS.bitsAllocated) ?? 16;
  const bitsStored = parser.uint16(TAGS.bitsStored) ?? bitsAllocated;
  const signed = parser.uint16(TAGS.pixelRepresentation) === 1;
  const slope = parser.number(TAGS.rescaleSlope) ?? 1;
  const intercept = parser.number(TAGS.rescaleIntercept) ?? 0;
  const photometric = parser.string(TAGS.photometric) ?? 'MONOCHROME2';

  if (bitsAllocated !== 8 && bitsAllocated !== 16) {
    throw new DicomFormatError(`Разрядность ${bitsAllocated} бит не поддерживается для предпросмотра.`);
  }

  const count = width * height;
  const bytesPerPixel = bitsAllocated / 8;
  if (header.length < count * bytesPerPixel) {
    throw new DicomFormatError('В файле меньше пикселей, чем указано в заголовке.');
  }

  const mask = bitsStored >= 32 ? 0xffffffff : (1 << bitsStored) - 1;
  const signBit = 1 << (bitsStored - 1);
  const values = new Float32Array(count);
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < count; i += 1) {
    const offset = header.valueOffset + i * bytesPerPixel;
    let raw = bytesPerPixel === 1 ? view.getUint8(offset) : view.getUint16(offset, true);
    raw &= mask;
    if (signed && raw & signBit) raw -= 1 << bitsStored;
    const value = raw * slope + intercept;
    values[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const center = parser.number(TAGS.windowCenter);
  const widthValue = parser.number(TAGS.windowWidth);
  let low = min;
  let high = max;
  if (center !== undefined && widthValue !== undefined && widthValue > 1) {
    low = center - widthValue / 2;
    high = center + widthValue / 2;
  }
  const range = high - low || 1;
  const invert = photometric === 'MONOCHROME1';
  const rgba = new Uint8ClampedArray(count * 4);

  for (let i = 0; i < count; i += 1) {
    let level = ((values[i] - low) / range) * 255;
    if (invert) level = 255 - level;
    const p = i * 4;
    rgba[p] = level;
    rgba[p + 1] = level;
    rgba[p + 2] = level;
    rgba[p + 3] = 255;
  }

  return rgba;
}

function renderColor(parser: Parser, width: number, height: number): Uint8ClampedArray {
  const header = parser.elements.get(TAGS.pixelData)!;
  const bitsAllocated = parser.uint16(TAGS.bitsAllocated) ?? 8;
  const planar = parser.uint16(TAGS.planarConfiguration) === 1;
  if (bitsAllocated !== 8) {
    throw new DicomFormatError('Цветные снимки с разрядностью больше 8 бит не поддерживаются.');
  }

  const count = width * height;
  const source = parser.slice(header.valueOffset, count * 3);
  if (source.length < count * 3) {
    throw new DicomFormatError('В файле меньше пикселей, чем указано в заголовке.');
  }

  const rgba = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i += 1) {
    const p = i * 4;
    if (planar) {
      rgba[p] = source[i];
      rgba[p + 1] = source[count + i];
      rgba[p + 2] = source[count * 2 + i];
    } else {
      rgba[p] = source[i * 3];
      rgba[p + 1] = source[i * 3 + 1];
      rgba[p + 2] = source[i * 3 + 2];
    }
    rgba[p + 3] = 255;
  }
  return rgba;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export interface DicomHeader {
  studyUid?: string;
  sopUid?: string;
}

function openDataset(buffer: ArrayBuffer): { parser: Parser; offset: number; transferSyntax: string } {
  const parser = new Parser(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  let transferSyntax = IMPLICIT_LE;

  const hasPreamble =
    bytes.length > 132 &&
    bytes[128] === 0x44 &&
    bytes[129] === 0x49 &&
    bytes[130] === 0x43 &&
    bytes[131] === 0x4d;

  if (hasPreamble) {
    offset = 132;
    while (offset + 8 <= bytes.length && parser.pixelView().getUint16(offset, true) === 0x0002) {
      const header = parser.readHeader(offset, true);
      if (header.tag === TAGS.transferSyntax) parser.elements.set(header.tag, header);
      offset = header.valueOffset + header.length;
    }
    transferSyntax = parser.string(TAGS.transferSyntax) ?? IMPLICIT_LE;
  } else {
    if (bytes.length < 8) throw new DicomFormatError('Файл не похож на DICOM.');
    transferSyntax = looksExplicit(bytes, 0) ? EXPLICIT_LE : IMPLICIT_LE;
  }

  if (transferSyntax === EXPLICIT_BE || transferSyntax === DEFLATED) {
    throw new DicomFormatError('Кодировка этого DICOM-файла не поддерживается для предпросмотра.');
  }

  parser.parseElements(offset, transferSyntax !== IMPLICIT_LE, true);
  return { parser, offset, transferSyntax };
}

export function readDicomHeader(buffer: ArrayBuffer): DicomHeader | null {
  try {
    const { parser } = openDataset(buffer);
    return {
      studyUid: parser.string(TAGS.studyInstanceUid),
      sopUid: parser.string(TAGS.sopInstanceUid),
    };
  } catch {
    return null;
  }
}

export function decodeDicom(buffer: ArrayBuffer): DecodedDicom {
  const { parser, transferSyntax } = openDataset(buffer);

  const decoded: DecodedDicom = {
    studyUid: parser.string(TAGS.studyInstanceUid),
    sopUid: parser.string(TAGS.sopInstanceUid),
    width: parser.uint16(TAGS.columns) ?? 0,
    height: parser.uint16(TAGS.rows) ?? 0,
  };

  if (!parser.elements.has(TAGS.pixelData) || !decoded.width || !decoded.height) {
    return { ...decoded, error: 'В файле нет изображения.' };
  }

  try {
    if (parser.encapsulatedPixelOffset !== null) {
      if (transferSyntax !== JPEG_BASELINE) {
        return { ...decoded, error: 'Формат сжатия снимка не поддерживается для предпросмотра.' };
      }
      const fragments = parser.fragments();
      const frames = parser.number(TAGS.numberOfFrames) ?? 1;
      const data = frames > 1 ? fragments[0] : concat(fragments);
      if (!data || data.length === 0) {
        return { ...decoded, error: 'Не удалось извлечь изображение из файла.' };
      }
      return { ...decoded, image: { kind: 'jpeg', data } };
    }

    const samples = parser.uint16(TAGS.samplesPerPixel) ?? 1;
    const data =
      samples === 3
        ? renderColor(parser, decoded.width, decoded.height)
        : renderGrayscale(parser, decoded.width, decoded.height);
    return { ...decoded, image: { kind: 'rgba', data } };
  } catch (error) {
    const message =
      error instanceof DicomFormatError ? error.message : 'Не удалось построить предпросмотр.';
    return { ...decoded, error: message };
  }
}
