
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { NetworkMessage } from '../types.ts';

class PeerService {
  public peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private onMessageCallback: ((msg: NetworkMessage) => void) | null = null;
  private onConnectionCallback: ((id: string) => void) | null = null;
  private onDisconnectCallback: ((id: string) => void) | null = null;
  private onCallCallback: ((call: MediaConnection) => void) | null = null;

  async init(nickname: string, retryCount = 0): Promise<string> {
    // Принудительно уничтожаем старый Peer перед новой попыткой
    if (this.peer) {
      this.destroy();
      // Даем браузеру и серверу PeerJS чуть больше времени на закрытие соединений
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    return new Promise((resolve, reject) => {
      const sanitizedId = nickname.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const peerId = `MARTAM_${sanitizedId}`;
      
      console.log(`[PeerService] Initializing ${peerId} (Attempt ${retryCount + 1})`);

      this.peer = new Peer(peerId, {
        debug: 1,
        secure: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      const timeout = setTimeout(() => {
        if (this.peer && !this.peer.open) {
          this.destroy();
          reject(new Error("Сервер PeerJS не отвечает. Проверьте интернет."));
        }
      }, 12000);

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('[PeerService] Opened:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('call', (call) => {
        if (this.onCallCallback) this.onCallCallback(call);
      });

      this.peer.on('error', async (err) => {
        clearTimeout(timeout);
        console.error('[PeerService] Error:', err.type, err);

        if (err.type === 'unavailable-id') {
          this.destroy();
          if (retryCount < 1) {
            console.log("[PeerService] ID taken, retrying once...");
            await new Promise(res => setTimeout(res, 2000));
            try {
              const res = await this.init(nickname, retryCount + 1);
              resolve(res);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Ник ${nickname} всё ещё занят. Подождите 15 секунд или смените ник.`));
          }
        } else {
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
          console.log('[PeerService] Disconnected. Reconnecting...');
          this.peer.reconnect();
        }
      });
    });
  }

  destroy() {
    if (this.peer) {
      console.log("[PeerService] Destroying current instance...");
      // Сначала закрываем все активные соединения данных
      this.connections.forEach(conn => {
        try { if (conn.open) conn.close(); } catch(e) {}
      });
      this.connections.clear();
      
      // Отписываемся от всех событий, чтобы не было ложных срабатываний при пересоздании
      this.peer.off('open');
      this.peer.off('error');
      this.peer.off('connection');
      this.peer.off('call');
      this.peer.off('disconnected');

      try {
        this.peer.disconnect();
        this.peer.destroy();
      } catch (e) {
        console.warn("[PeerService] Error during destruction:", e);
      }
      this.peer = null;
    }
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      if (this.onConnectionCallback) this.onConnectionCallback(conn.peer);
    });

    conn.on('data', (data: any) => {
      if (this.onMessageCallback) this.onMessageCallback(data as NetworkMessage);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.onDisconnectCallback) this.onDisconnectCallback(conn.peer);
    });

    conn.on('error', (err) => {
      console.error('[PeerService] Conn error:', err);
      this.connections.delete(conn.peer);
    });
  }

  connectToPeer(targetId: string) {
    if (!this.peer || this.peer.destroyed) return;
    const target = targetId.toUpperCase();
    const fullId = target.startsWith('MARTAM_') ? target : `MARTAM_${target}`;
    
    if (this.connections.get(fullId)?.open) return;

    const conn = this.peer.connect(fullId, { reliable: true });
    this.setupConnection(conn);
  }

  callPeer(targetId: string, stream: MediaStream): MediaConnection | null {
    if (!this.peer || this.peer.destroyed) return null;
    const target = targetId.toUpperCase();
    const fullId = target.startsWith('MARTAM_') ? target : `MARTAM_${target}`;
    return this.peer.call(fullId, stream);
  }

  sendTo(targetId: string, message: NetworkMessage) {
    const target = targetId.toUpperCase();
    const fullId = target.startsWith('MARTAM_') ? target : `MARTAM_${target}`;
    let conn = this.connections.get(fullId);
    
    if (conn && conn.open) {
      conn.send(message);
    } else {
      this.connectToPeer(target);
      const retry = (count: number) => {
          if (count <= 0) return;
          const c = this.connections.get(fullId);
          if (c && c.open) c.send(message);
          else setTimeout(() => retry(count - 1), 1000);
      };
      retry(3);
    }
  }

  onMessage(cb: (msg: NetworkMessage) => void) { this.onMessageCallback = cb; }
  onConnection(cb: (id: string) => void) { this.onConnectionCallback = cb; }
  onDisconnect(cb: (id: string) => void) { this.onDisconnectCallback = cb; }
  onCall(cb: (call: MediaConnection) => void) { this.onCallCallback = cb; }

  getPeerId() { 
    if (!this.peer?.id) return null;
    return this.peer.id.replace('MARTAM_', '');
  }
}

export const peerService = new PeerService();
