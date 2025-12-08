export const PLACEHOLDER_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export function isDataUrl(src: string | null | undefined): boolean {
  return !!src && /^data:/i.test(src);
}

export function isBlobUrl(src: string | null | undefined): boolean {
  return !!src && src.startsWith('blob:');
}
