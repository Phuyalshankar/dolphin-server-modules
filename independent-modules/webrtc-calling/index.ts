import * as crypto from 'node:crypto';
import type { WebSocket } from 'ws';

/**
 * Generate ephemeral (time-limited) TURN credentials using HMAC-SHA1.
 * This matches Coturn's REST API credentials mechanism (use-secret-auth).
 * 
 * @param secret The static authentication secret configured in your Coturn TURN server.
 * @param username The client's unique username (e.g. user ID).
 * @param ttlSeconds Time-to-live for the credentials in seconds (default: 86400 / 24 hours).
 */
export function generateTurnCredentials(
  secret: string,
  username: string,
  ttlSeconds = 86400
): { username: string; credential: string; ttl: number } {
  const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const turnUsername = `${timestamp}:${username}`;
  
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(turnUsername);
  const credential = hmac.digest('base64');

  return {
    username: turnUsername,
    credential,
    ttl: ttlSeconds
  };
}

export interface SignalingMessage {
  type: 'join' | 'leave' | 'signal' | 'sub' | 'unsub' | 'pub' | 'HEARTBEAT' | 'HEARTBEAT_ACK';
  room?: string;
  to?: string; // target peer ID
  from?: string; // sender peer ID (injected by server)
  data?: any; // SDP offer/answer or ICE candidate
  topic?: string;
  payload?: any;
}

/**
 * A framework-agnostic WebRTC Signaling Orchestrator.
 * It manages peer routing, rooms, and forwards signaling payloads (SDP, ICE candidates).
 */
export class WebRTCSignalingOrchestrator {
  // Map of active connections: peerId -> WebSocket
  private peers = new Map<string, WebSocket>();
  // Map of rooms: roomId -> Set<peerId>
  private rooms = new Map<string, Set<string>>();
  // Reverse lookup: peerId -> roomId
  private peerRooms = new Map<string, string>();
  // Map of subscriptions: topic -> Set<peerId>
  private subscriptions = new Map<string, Set<string>>();

  /**
   * Handle an incoming connection from a peer.
   * 
   * @param peerId Unique identifier for the connecting peer/user.
   * @param ws The WebSocket connection instance.
   */
  handleConnection(peerId: string, ws: WebSocket): void {
    this.peers.set(peerId, ws);

    ws.on('message', (rawData: string) => {
      try {
        const msg: SignalingMessage = JSON.parse(rawData);
        this.processMessage(peerId, msg);
      } catch (err) {
        console.error(`[Signaling Error] Failed to parse message from peer ${peerId}:`, err);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid payload format' }));
      }
    });

    ws.on('close', () => {
      if (this.peers.get(peerId) === ws) {
        this.handleDisconnect(peerId);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Signaling Client Error] Peer ${peerId}:`, err);
      if (this.peers.get(peerId) === ws) {
        this.handleDisconnect(peerId);
      }
    });
  }

  private processMessage(senderId: string, msg: SignalingMessage) {
    switch (msg.type) {
      case 'HEARTBEAT':
        this.sendToPeer(senderId, { type: 'HEARTBEAT_ACK' });
        break;

      case 'join':
        if (!msg.room) {
          this.sendToPeer(senderId, { type: 'error', message: 'Room ID is required to join' });
          return;
        }
        this.joinRoom(senderId, msg.room);
        break;

      case 'leave':
        this.leaveRoom(senderId);
        break;

      case 'signal':
        if (!msg.to || !msg.data) {
          this.sendToPeer(senderId, { type: 'error', message: "Target peer 'to' and 'data' are required for signaling" });
          return;
        }
        // Forward SDP/ICE payload to the target peer, injecting the sender's ID
        this.sendToPeer(msg.to, {
          type: 'signal',
          from: senderId,
          data: msg.data
        });
        break;

      case 'sub':
        if (!msg.topic) {
          this.sendToPeer(senderId, { type: 'error', message: 'Topic is required to subscribe' });
          return;
        }
        this.subscribeTopic(senderId, msg.topic);
        break;

      case 'unsub':
        if (!msg.topic) {
          this.sendToPeer(senderId, { type: 'error', message: 'Topic is required to unsubscribe' });
          return;
        }
        this.unsubscribeTopic(senderId, msg.topic);
        break;

      case 'pub':
        if (!msg.topic) {
          this.sendToPeer(senderId, { type: 'error', message: 'Topic is required to publish' });
          return;
        }
        this.publishTopic(senderId, msg.topic, msg.payload);
        break;

      default:
        this.sendToPeer(senderId, { type: 'error', message: `Unknown signal type: ${msg.type}` });
    }
  }

  private subscribeTopic(peerId: string, topic: string) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(peerId);
  }

  private unsubscribeTopic(peerId: string, topic: string) {
    const subs = this.subscriptions.get(topic);
    if (subs) {
      subs.delete(peerId);
      if (subs.size === 0) {
        this.subscriptions.delete(topic);
      }
    }
  }

  private publishTopic(senderId: string, topic: string, payload: any) {
    const subs = this.subscriptions.get(topic);
    if (subs) {
      subs.forEach(peerId => {
        this.sendToPeer(peerId, {
          topic,
          payload
        });
      });
    }
  }

  private joinRoom(peerId: string, roomId: string) {
    // Leave previous room first if any
    this.leaveRoom(peerId);

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    const roomPeers = this.rooms.get(roomId)!;
    
    // Notify existing room members that a new peer joined
    roomPeers.forEach(existingPeerId => {
      this.sendToPeer(existingPeerId, {
        type: 'peer-joined',
        from: peerId
      });
    });

    roomPeers.add(peerId);
    this.peerRooms.set(peerId, roomId);

    // Send the current list of other peers in the room to the joining peer
    const otherPeers = Array.from(roomPeers).filter(id => id !== peerId);
    this.sendToPeer(peerId, {
      type: 'joined-room',
      room: roomId,
      peers: otherPeers
    });
  }

  private leaveRoom(peerId: string) {
    const roomId = this.peerRooms.get(peerId);
    if (!roomId) return;

    const roomPeers = this.rooms.get(roomId);
    if (roomPeers) {
      roomPeers.delete(peerId);
      // Notify other members that this peer left
      roomPeers.forEach(remainingPeerId => {
        this.sendToPeer(remainingPeerId, {
          type: 'peer-left',
          from: peerId
        });
      });

      if (roomPeers.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    this.peerRooms.delete(peerId);
  }

  private handleDisconnect(peerId: string) {
    this.leaveRoom(peerId);
    this.peers.delete(peerId);
    
    // Clean up all subscriptions for this peer
    this.subscriptions.forEach((subs, topic) => {
      if (subs.has(peerId)) {
        subs.delete(peerId);
        if (subs.size === 0) {
          this.subscriptions.delete(topic);
        }
      }
    });
  }

  private sendToPeer(peerId: string, payload: any) {
    const ws = this.peers.get(peerId);
    if (ws && ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(payload));
    }
  }
}
