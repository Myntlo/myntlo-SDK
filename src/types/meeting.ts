import type { ActionItem } from './actionItem';
import type { Decision } from './decision';

export type Meeting = {
  id: string;
  orgId: string;
  title: string;
  status: string;
  duration: number;
  createdAt: string;
  uploadedBy: string;
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
