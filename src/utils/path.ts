export function normalizeFatPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function joinFatPath(parent: string, name: string): string {
  const cleanParent = normalizeFatPath(parent);
  const cleanName = normalizeFatPath(name);
  return cleanParent ? `${cleanParent}/${cleanName}` : cleanName;
}

export function basename(path: string): string {
  const clean = normalizeFatPath(path);
  return clean.split('/').filter(Boolean).pop() ?? '';
}

export function dirname(path: string): string {
  const clean = normalizeFatPath(path);
  const parts = clean.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

export function extension(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf('.');
  return index > -1 ? name.slice(index + 1).toLowerCase() : '';
}

export function isChildPath(candidate: string, parent: string): boolean {
  const cleanCandidate = normalizeFatPath(candidate);
  const cleanParent = normalizeFatPath(parent);
  return cleanParent !== '' && cleanCandidate.startsWith(`${cleanParent}/`);
}
