export type OperationChatUser = {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
};

export type OperationChatGroup = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  memberCount?: number;
  lastMessageAt?: string | null;
  lastMessage?: OperationChatMessage | null;
  lastMessageContent?: string;
  unreadCount?: number;
};

export type OperationChatMessage = {
  id: string;
  groupId: string;
  sender?: OperationChatUser;
  senderRole?: string;
  content: string | {
    content?: string;
    message?: string;
    text?: string;
  };
  sentAt?: string;
  isRead?: boolean;
  readBy?: Array<{
    userId?: string;
    readAt?: string;
  }>;
};

export type OperationChatGroupsPayload = {
  groups: OperationChatGroup[];
  count: number;
};

export type OperationChatMessagesPayload = {
  messages: OperationChatMessage[];
  count: number;
};

export type OperationChatMessagePayload = {
  message: OperationChatMessage;
};
