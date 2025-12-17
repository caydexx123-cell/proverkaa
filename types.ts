
export interface PlayerProfile {
  nickname: string;
  avatar?: string;
  joinedAt: number;
  blocked?: boolean;
}

export type MessageType = 'PLAYER_JOINED' | 'PLAYER_LEFT' | 'SYNC_PROFILE' | 'CHAT' | 'IMAGE' | 'PING' | 'PONG';

export interface NetworkMessage {
  type: MessageType;
  payload: any;
  senderId: string;
  senderNickname: string;
  senderAvatar?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  imageUrl?: string;
  time: string;
  isMe: boolean;
}

export interface AppSettings {
  audioInputId?: string;
  audioOutputId?: string;
  videoInputId?: string;
}
