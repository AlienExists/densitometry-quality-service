import * as XLSX from 'xlsx';
import { readDicomHeader } from './dicom';
import { baseName } from './files';
import type { PredictionResult } from '@/types/api';

interface ArchiveEntry {
  path: string;
  bytes: Uint8Array;
  sopUid?: string;
}

interface CfbEntry {
  type: number;
  content?: ArrayLike<number>;
}

interface CfbContainer {
  FileIndex: CfbEntry[];
  FullPaths: string[];
}

const ROOT_PREFIX = /^Root Entry\//;
const utf8 = new TextDecoder('utf-8', { fatal: true });

function decodeName(raw: string): string {
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code > 0xff) return raw;
    bytes[i] = code;
  }
  try {
    return utf8.decode(bytes);
  } catch {
    return raw;
  }
}

function isServiceFile(path: string): boolean {
  const name = baseName(path);
  return (
    path.startsWith('__MACOSX/') ||
    name.startsWith('._') ||
    name === '.DS_Store' ||
    name.charCodeAt(0) === 1
  );
}

function toBytes(content: ArrayLike<number>): Uint8Array {
  return content instanceof Uint8Array ? content : Uint8Array.from(content);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export async function readArchive(file: File): Promise<ArchiveEntry[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const container = XLSX.CFB.read(data, { type: 'array' }) as CfbContainer;
  const entries: ArchiveEntry[] = [];

  container.FileIndex.forEach((entry, index) => {
    if (entry.type !== 2 || !entry.content || entry.content.length === 0) return;
    const path = decodeName(container.FullPaths[index].replace(ROOT_PREFIX, ''));
    if (!path || path.endsWith('/') || isServiceFile(path)) return;

    const bytes = toBytes(entry.content);
    const header = readDicomHeader(toArrayBuffer(bytes));
    if (!header) return;
    entries.push({ path, bytes, sopUid: header.sopUid });
  });

  return entries;
}

const normalize = (path: string) => path.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();

export function matchArchiveFiles(
  results: PredictionResult[],
  entries: ArchiveEntry[],
): (File | null)[] {
  const byUid = new Map<string, ArchiveEntry>();
  const byPath = new Map<string, ArchiveEntry>();
  const byName = new Map<string, ArchiveEntry[]>();

  for (const entry of entries) {
    if (entry.sopUid) byUid.set(entry.sopUid, entry);
    byPath.set(normalize(entry.path), entry);
    const name = baseName(entry.path).toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), entry]);
  }

  return results.map((result) => {
    const path = normalize(result.path_to_study);
    const sameName = byName.get(baseName(path));

    const entry =
      (result.image_uid && byUid.get(result.image_uid)) ||
      byPath.get(path) ||
      entries.find((item) => normalize(item.path).endsWith(`/${path}`)) ||
      (sameName && sameName.length === 1 ? sameName[0] : undefined);

    if (!entry) return null;
    return new File([toArrayBuffer(entry.bytes)], baseName(entry.path), {
      type: 'application/dicom',
    });
  });
}
