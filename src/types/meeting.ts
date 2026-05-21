import type { ActionItem } from './actionItem';
import type { Decision } from './decision';

export type MeetingStatus = 'pending' | 'processing' | 'done' | 'failed';

export type ProcessingStage =
  | 'queued'
  | 'transcribing'
  | 'extracting_insights'
  | 'done'
  | 'failed';

export type MeetingExportFormat = 'pdf' | 'docx' | 'txt' | 'json';

export type Meeting = {
  id: string;
  orgId: string;
  title: string;
  status: MeetingStatus;
  duration: number;
  createdAt: string;
  uploadedBy: string;
};

export type MeetingStatusResponse = {
  meetingId: string;
  status: MeetingStatus;
  stage?: ProcessingStage;
};

export type MeetingTranscript = {
  meetingId: string;
  transcript: string;
};

export type MeetingExtractions = {
  meetingId: string;
  summary: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  openQuestions: string[];
};

export type MeetingExtraction = MeetingExtractions;
