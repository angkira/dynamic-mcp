import { io, Socket } from 'socket.io-client';
import { reactive } from 'vue';

class SocketService {
  public socket: Socket | null = null;
  public state = reactive({
    isConnected: false,
  });

  connect() {
    if (this.socket?.connected) return;

    // Use dedicated socket URL or fallback to API URL without /api suffix
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 
                     (import.meta.env.VITE_API_URL?.replace('/api', '')) || 
                     "http://localhost:3000";

    this.socket = io(socketUrl);

    this.socket.on('connect', () => {
      this.state.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      this.state.isConnected = false;
    });
  }

  disconnect() {
    this.socket?.disconnect();
  }

  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }
}

export const socketService = new SocketService();