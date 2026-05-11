export type ActionItemStatus = 'pending' | 'done';

export type ActionItem = {
  id: string;
  meetingId: string;
  orgId: string;
  assignedToName: string;
  task: string;
  dueDate: string | null;
  status: ActionItemStatus;
  createdAt: string;
};
