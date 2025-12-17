
export interface PlayerProfile {
  nickname: string;
  avatar?: string;
  joinedAt: number;
  blocked?: boolean;
  online?: boolean;
}

export type MessageType = 'SYNC_PROFILE' | 'CHAT' | 'IMAGE' | 'VOICE' | 'CALL_LOG' | 'READ_RECEIPT' | 'HEARTBEAT';

export interface NetworkMessage {
  type: MessageType;
  payload: any;
  senderId: string;
  senderNickname: string;
  messageId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  callDuration?: string;
  time: string;
  isMe: boolean;
  isRead?: boolean;
  type?: MessageType;
}

export interface AppSettings {
  audioInputId?: string;
  videoInputId?: string;
  isMicMuted?: boolean;
  isCamOff?: boolean;
}
