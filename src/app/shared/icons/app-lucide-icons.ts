import {
  LucideArrowLeft,
  LucideCheck,
  LucideGripVertical,
  LucideList,
  LucidePause,
  LucidePencil,
  LucidePlay,
  LucideRotateCcw,
  LucideSquare,
  LucideTrash2,
  LucideUpload,
  LucideVolume2,
  LucideX,
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
  LucideList,
  LucidePencil,
  LucideTrash2,
  LucideUpload,
  LucideCheck,
  LucideX,
] as const;

export function provideAppLucideIcons() {
  return provideLucideIcons(...APP_LUCIDE_ICONS);
}

export {
  LucideArrowLeft,
  LucideCheck,
  LucideGripVertical,
  LucideList,
  LucidePause,
  LucidePencil,
  LucidePlay,
  LucideRotateCcw,
  LucideSquare,
  LucideTrash2,
  LucideUpload,
  LucideVolume2,
  LucideX,
};
