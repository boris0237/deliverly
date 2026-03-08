import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as NetServer } from 'http';
import type { Socket as NetSocket } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { getSocketServer, setSocketServer } from '@/lib/realtime/socket-server';

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NetSocket & {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(_: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket?.server) {
    res.status(500).json({ error: 'Socket server unavailable' });
    return;
  }

  if (!res.socket.server.io) {
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket_io',
      addTrailingSlash: false,
    });
    res.socket.server.io = io;
    setSocketServer(io);
  } else if (!getSocketServer()) {
    setSocketServer(res.socket.server.io);
  }

  res.status(200).json({ ok: true });
}

