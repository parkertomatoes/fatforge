import { extension } from './path';
import type { DocumentKind } from '../types';

const textExtensions = new Set([
  'asm',
  'bas',
  'bat',
  'c',
  'cfg',
  'conf',
  'cpp',
  'css',
  'csv',
  'h',
  'hpp',
  'html',
  'ini',
  'js',
  'json',
  'log',
  'md',
  'nfo',
  'pas',
  'txt',
  'tsx',
  'ts',
  'xml',
  'yaml',
  'yml',
]);

const imageExtensions = new Set(['bmp', 'png', 'jpg', 'jpeg', 'pcx', 'tga']);

export function detectDocumentKind(path: string, data: Uint8Array): DocumentKind {
  const ext = extension(path);
  if (imageExtensions.has(ext)) {
    return 'image';
  }
  if (textExtensions.has(ext) || looksLikeText(data)) {
    return 'text';
  }
  return 'hex';
}

export function languageForPath(path: string): string {
  switch (extension(path)) {
    case 'asm':
      return 'asm';
    case 'bat':
      return 'bat';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
      return 'cpp';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'ini':
    case 'cfg':
    case 'conf':
      return 'ini';
    case 'js':
      return 'javascript';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}

export function mimeForPath(path: string): string {
  switch (extension(path)) {
    case 'bmp':
      return 'image/bmp';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'tga':
      return 'image/x-tga';
    case 'pcx':
      return 'image/x-pcx';
    default:
      return 'application/octet-stream';
  }
}

function looksLikeText(data: Uint8Array): boolean {
  if (data.length === 0) {
    return true;
  }
  const sample = data.slice(0, Math.min(data.length, 4096));
  let control = 0;
  for (const byte of sample) {
    if (byte === 0) {
      return false;
    }
    if (byte < 9 || (byte > 13 && byte < 32)) {
      control += 1;
    }
  }
  return control / sample.length < 0.03;
}
