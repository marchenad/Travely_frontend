import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IMessage } from '@stomp/stompjs';

import { environment } from '../../../../environments/environment';
import { ChatMessage } from '../../../shared/models/chat-message.model';
import { TrackingService } from './tracking.service';

@Injectable()
export class ChatService {
  private readonly http        = inject(HttpClient);
  private readonly trackingSvc = inject(TrackingService);

  readonly messages    = signal<ChatMessage[]>([]);
  readonly unreadCount = signal(0);

  private tripId: number | null = null;
  private stopped = true;
  private stompSub?: { unsubscribe(): void };

  start(tripId: number): void {
    this.stop();
    this.stopped = false;
    this.tripId = tripId;
    this.messages.set([]);
    this.unreadCount.set(0);

    this.http.get<ChatMessage[]>(`${environment.apiUrl}/trips/${tripId}/chat`)
      .subscribe({ next: (msgs) => this.messages.set(msgs), error: () => {} });

    this.waitForStompAndSubscribe(tripId);
  }

  stop(): void {
    this.stopped = true;
    this.stompSub?.unsubscribe();
    this.stompSub = undefined;
    this.tripId = null;
    this.messages.set([]);
    this.unreadCount.set(0);
  }

  send(senderId: number, content: string): void {
    const trimmed = content.trim();
    if (!trimmed || this.tripId === null) return;
    const client = this.trackingSvc.stompClient;
    if (!client?.connected) return;
    client.publish({
      destination: `/app/trips/${this.tripId}/chat`,
      body: JSON.stringify({ senderId, content: trimmed }),
    });
  }

  markRead(): void { this.unreadCount.set(0); }

  private waitForStompAndSubscribe(tripId: number): void {
    const trySubscribe = () => {
      if (this.stopped) return;
      const client = this.trackingSvc.stompClient;
      if (client?.connected) {
        this.stompSub = client.subscribe(
          `/topic/trips/${tripId}/chat`,
          (msg: IMessage) => {
            if (this.stopped) return;
            const chatMsg: ChatMessage = JSON.parse(msg.body);
            this.messages.update((prev) => [...prev, chatMsg]);
            this.unreadCount.update((n) => n + 1);
          },
        );
      } else {
        setTimeout(trySubscribe, 500);
      }
    };
    trySubscribe();
  }
}
