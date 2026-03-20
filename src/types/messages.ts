// FeelingWise - Extension message types

export type MessageType =
  | 'POST_DETECTED' | 'ANALYSIS_COMPLETE' | 'NEUTRALIZATION_COMPLETE'
  | 'OPEN_SIDE_PANEL' | 'MODE_CHANGED' | 'SETTINGS_UPDATED'
  | 'FORENSIC_EXPORT_REQUEST' | 'STATS_REQUEST' | 'STATS_RESPONSE';

export interface ExtensionMessage {
  type: MessageType;
  payload: unknown;
  timestamp: string;
}
