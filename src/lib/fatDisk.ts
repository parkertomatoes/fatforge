import { FatFsDisk, FatFsFormat } from 'fatfs-wasm';
import type { DiskKind, DiskMeta, DiskUsage, EntryType, FsEntry } from '../types';
import { basename, dirname, isChildPath, joinFatPath, normalizeFatPath } from '../utils/path';

interface ActiveDisk {
  disk: FatFsDisk;
  bytes: Uint8Array;
}

interface CreateImageOptions {
  label: string;
  sizeBytes: number;
  kind: DiskKind;
  name: string;
}

let activeDisk: ActiveDisk | null = null;

export function hasActiveDisk(): boolean {
  return activeDisk !== null;
}

export function closeActiveDisk(): void {
  activeDisk = null;
}

export async function createFormattedImage(options: CreateImageOptions): Promise<DiskMeta> {
  const bytes = new Uint8Array(options.sizeBytes);
  const disk = await FatFsDisk.create(bytes);
  disk.mkfs({
    fmt: chooseFormat(options.sizeBytes, options.kind),
    nFat: 2,
  });
  disk.mount();
  const label = sanitizeLabel(options.label);
  if (label) {
    disk.setLabel(label);
  }
  activeDisk = { disk, bytes };
  return {
    label,
    name: options.name,
    kind: options.kind,
    sizeBytes: options.sizeBytes,
    createdAt: new Date().toISOString(),
  };
}

export async function mountImage(bytes: Uint8Array, name = 'Opened image'): Promise<DiskMeta> {
  const image = new Uint8Array(bytes);
  const disk = await FatFsDisk.create(image);
  disk.mount();
  activeDisk = { disk, bytes: image };
  let label = '';
  try {
    label = disk.getLabel()[0];
  } catch {
    label = '';
  }
  return {
    label,
    name,
    kind: 'opened',
    sizeBytes: image.byteLength,
    createdAt: new Date().toISOString(),
  };
}

export async function restoreImage(bytes: Uint8Array): Promise<void> {
  const image = new Uint8Array(bytes);
  const disk = await FatFsDisk.create(image);
  disk.mount();
  activeDisk = { disk, bytes: image };
}

export function getImageSnapshot(): Uint8Array {
  const current = requireDisk();
  return new Uint8Array(current.bytes);
}

export function getDiskUsage(): DiskUsage {
  const current = requireDisk();
  const { freeClusters, totalClusters, clusterSizeBytes } = readFatAllocation(current.bytes);
  const freeBytes = freeClusters * clusterSizeBytes;
  const totalBytes = totalClusters * clusterSizeBytes;
  return {
    freeBytes,
    totalBytes,
    usedBytes: Math.max(0, totalBytes - freeBytes),
  };
}

export function listTree(): FsEntry[] {
  return readDirectory('');
}

export function readFile(path: string): Uint8Array {
  return requireDisk().disk.readFile(normalizeFatPath(path));
}

export function writeFile(path: string, data: Uint8Array): void {
  requireDisk().disk.writeFile(normalizeFatPath(path), data);
}

export function writeTextFile(path: string, text: string): void {
  writeFile(path, new TextEncoder().encode(text));
}

export function createTextFile(parentPath: string, name: string): string {
  const cleanName = sanitizeName(name);
  const path = joinFatPath(parentPath, cleanName);
  writeTextFile(path, '');
  return path;
}

export function deleteEntry(path: string): void {
  const cleanPath = normalizeFatPath(path);
  const info = stat(cleanPath);
  if (info.type === 'folder') {
    for (const child of readDirectory(cleanPath)) {
      deleteEntry(child.path);
    }
  }
  requireDisk().disk.unlink(cleanPath);
}

export function renameEntry(oldPath: string, newName: string): string {
  const cleanOldPath = normalizeFatPath(oldPath);
  const parent = dirname(cleanOldPath);
  const newPath = joinFatPath(parent, sanitizeName(newName));
  requireDisk().disk.rename(cleanOldPath, newPath);
  return newPath;
}

export function moveEntry(sourcePath: string, targetFolderPath: string): string {
  const cleanSource = normalizeFatPath(sourcePath);
  const cleanTargetFolder = normalizeFatPath(targetFolderPath);
  if (cleanSource === cleanTargetFolder || isChildPath(cleanTargetFolder, cleanSource)) {
    throw new Error('Cannot move a folder into itself');
  }
  const destination = uniquePath(cleanTargetFolder, basename(cleanSource));
  requireDisk().disk.rename(cleanSource, destination);
  return destination;
}

export function copyEntry(sourcePath: string, targetFolderPath: string): string {
  const cleanSource = normalizeFatPath(sourcePath);
  const sourceName = basename(cleanSource);
  const destination = uniquePath(targetFolderPath, sourceName);
  copyRecursive(cleanSource, destination);
  return destination;
}

export function getEntryInfo(path: string): FsEntry {
  return stat(normalizeFatPath(path));
}

export function entryExists(path: string): boolean {
  try {
    requireDisk().disk.stat(normalizeFatPath(path));
    return true;
  } catch {
    return false;
  }
}

function readFatAllocation(bytes: Uint8Array): {
  freeClusters: number;
  totalClusters: number;
  clusterSizeBytes: number;
} {
  const bootOffset = findBootSectorOffset(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset + bootOffset, bytes.byteLength - bootOffset);
  const bytesPerSector = view.getUint16(11, true);
  const sectorsPerCluster = view.getUint8(13);
  const reservedSectors = view.getUint16(14, true);
  const fatCount = view.getUint8(16);
  const rootEntryCount = view.getUint16(17, true);
  const totalSectors16 = view.getUint16(19, true);
  const totalSectors32 = view.getUint32(32, true);
  const fatSectors16 = view.getUint16(22, true);
  const fatSectors32 = view.getUint32(36, true);
  const totalSectors = totalSectors16 || totalSectors32;
  const fatSectors = fatSectors16 || fatSectors32;
  const rootDirSectors = Math.ceil((rootEntryCount * 32) / bytesPerSector);
  const firstDataSector = reservedSectors + fatCount * fatSectors + rootDirSectors;
  const dataSectors = Math.max(0, totalSectors - firstDataSector);
  const totalClusters = Math.floor(dataSectors / sectorsPerCluster);
  const fatType = totalClusters < 4085 ? 12 : totalClusters < 65525 ? 16 : 32;
  const fatOffset = bootOffset + reservedSectors * bytesPerSector;
  let freeClusters = 0;

  for (let cluster = 2; cluster < totalClusters + 2; cluster += 1) {
    if (readFatEntry(bytes, fatOffset, cluster, fatType) === 0) {
      freeClusters += 1;
    }
  }

  return {
    freeClusters,
    totalClusters,
    clusterSizeBytes: sectorsPerCluster * bytesPerSector,
  };
}

function readFatEntry(bytes: Uint8Array, fatOffset: number, cluster: number, fatType: 12 | 16 | 32): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (fatType === 12) {
    const entryOffset = fatOffset + Math.floor((cluster * 3) / 2);
    const word = view.getUint16(entryOffset, true);
    return cluster % 2 === 0 ? word & 0x0fff : word >> 4;
  }
  if (fatType === 16) {
    return view.getUint16(fatOffset + cluster * 2, true);
  }
  return view.getUint32(fatOffset + cluster * 4, true) & 0x0fffffff;
}

function findBootSectorOffset(bytes: Uint8Array): number {
  if (isValidBootSector(bytes, 0)) {
    return 0;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength >= 512 && view.getUint16(510, true) === 0xaa55) {
    for (let index = 0; index < 4; index += 1) {
      const partitionOffset = 446 + index * 16;
      const partitionType = view.getUint8(partitionOffset + 4);
      const lbaStart = view.getUint32(partitionOffset + 8, true);
      const candidate = lbaStart * 512;
      if (partitionType !== 0 && isValidBootSector(bytes, candidate)) {
        return candidate;
      }
    }
  }

  throw new Error('Unable to read FAT allocation table');
}

function isValidBootSector(bytes: Uint8Array, offset: number): boolean {
  if (offset < 0 || offset + 512 > bytes.byteLength) {
    return false;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
  const bytesPerSector = view.getUint16(11, true);
  const sectorsPerCluster = view.getUint8(13);
  const reservedSectors = view.getUint16(14, true);
  const fatCount = view.getUint8(16);
  const totalSectors = view.getUint16(19, true) || view.getUint32(32, true);
  const fatSectors = view.getUint16(22, true) || view.getUint32(36, true);
  const signature = view.getUint16(510, true);
  const imageSectorCount = Math.floor((bytes.byteLength - offset) / bytesPerSector);
  return (
    signature === 0xaa55 &&
    bytesPerSector >= 512 &&
    bytesPerSector <= 4096 &&
    (bytesPerSector & (bytesPerSector - 1)) === 0 &&
    sectorsPerCluster > 0 &&
    (sectorsPerCluster & (sectorsPerCluster - 1)) === 0 &&
    reservedSectors > 0 &&
    fatCount > 0 &&
    totalSectors > 0 &&
    totalSectors <= imageSectorCount &&
    fatSectors > 0
  );
}

function copyRecursive(sourcePath: string, destinationPath: string): void {
  const info = stat(sourcePath);
  const disk = requireDisk().disk;
  if (info.type === 'folder') {
    disk.mkdir(destinationPath);
    for (const child of readDirectory(sourcePath)) {
      copyRecursive(child.path, joinFatPath(destinationPath, child.name));
    }
    return;
  }
  disk.writeFile(destinationPath, disk.readFile(sourcePath));
}

function readDirectory(path: string): FsEntry[] {
  const disk = requireDisk().disk;
  const dir = disk.openDir(path);
  const entries: FsEntry[] = [];
  try {
    for (const item of dir) {
      if (!item.name || item.name === '.' || item.name === '..') {
        continue;
      }
      const childPath = joinFatPath(path, item.name);
      const type: EntryType = item.isDirectory ? 'folder' : 'file';
      entries.push({
        id: childPath,
        name: item.name,
        path: childPath,
        type,
        size: item.size,
        modified: item.date.toISOString(),
        attrib: item.attrib,
        children: type === 'folder' ? readDirectory(childPath) : undefined,
      });
    }
  } finally {
    dir.close();
  }
  return entries.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'folder' ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function stat(path: string): FsEntry {
  const info = requireDisk().disk.stat(path);
  return {
    id: path,
    name: basename(path),
    path,
    type: info.isDirectory ? 'folder' : 'file',
    size: info.size,
    modified: info.date.toISOString(),
    attrib: info.attrib,
  };
}

function uniquePath(parentPath: string, name: string): string {
  const cleanParent = normalizeFatPath(parentPath);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = joinFatPath(cleanParent, name);
  let index = 2;
  while (entryExists(candidate)) {
    candidate = joinFatPath(cleanParent, `${stem}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

function chooseFormat(sizeBytes: number, kind: DiskKind): FatFsFormat {
  if (kind === 'hard-disk' && sizeBytes >= 33 * 1024 * 1024) {
    return FatFsFormat.FAT32;
  }
  return FatFsFormat.FAT;
}

function sanitizeLabel(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .slice(0, 11);
}

function sanitizeName(name: string): string {
  const clean = name.trim().replace(/[\\/:*?"<>|]/g, '_');
  if (!clean) {
    throw new Error('Name cannot be empty');
  }
  return clean;
}

function requireDisk(): ActiveDisk {
  if (!activeDisk) {
    throw new Error('No FAT image is loaded');
  }
  return activeDisk;
}
