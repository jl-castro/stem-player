/** SHA-256 del blob en hex (integridad de assets en IndexedDB). */
export async function sha256HexFromBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return sha256HexFromBuffer(buffer);
}

export async function sha256HexFromBuffer(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
