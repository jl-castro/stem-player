/**
 * Metadatos de un stem local; la fuente binaria se resolverá vía `storedAssetKey` al persistir.
 * `volume` es ganancia lineal 0–1 (UI puede mapear a dB más adelante).
 */
export interface StemTrack {
  id: string;
  fileName: string;
  displayName: string;
  /** Color en UI (hex, hsl o token de tema). */
  color: string;
  order: number;
  durationMs: number;
  volume: number;
  muted: boolean;
  solo: boolean;
  mimeType: string;
  sizeBytes: number;
  /**
   * Clave opaca en el almacén local del proyecto (p. ej. IDB) para el blob del archivo.
   * `null` si el stem aún no se ha persistido.
   */
  storedAssetKey: string | null;
}
