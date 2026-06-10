export interface ChatMessage {
  id: number;
  tripId: number;
  senderId: number;
  senderName: string;
  content: string;
  sentAt: string;
}
