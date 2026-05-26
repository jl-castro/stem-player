import {
  LucideArrowLeft,
  LucideGripVertical,
  LucidePause,
  LucidePencil,
  LucidePlay,
  LucideRotateCcw,
  LucideSquare,
  LucideTrash2,
  LucideVolume2,
  provideLucideIcons,
} from '@lucide/angular';

/** Icons used across the app (tree-shaken per import site when used as components). */
export const APP_LUCIDE_ICONS = [
  LucideArrowLeft,
  LucidePlay,
  LucidePause,
  LucideSquare,
  LucideRotateCcw,
  LucideVolume2,
  LucideGripVertical,
  LucidePencil,
  LucideTrash2,
] as const;

export function provideAppLucideIcons() {
  return provideLucideIcons(...APP_LUCIDE_ICONS);
}

export {
  LucideArrowLeft,
  LucideGripVertical,
  LucidePause,
  LucidePencil,
  LucidePlay,
  LucideRotateCcw,
  LucideSquare,
  LucideTrash2,
  LucideVolume2,
};
