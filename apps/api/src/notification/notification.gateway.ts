import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { resolveJwtSecret } from '../auth/jwt-secret.util';

const MAX_SOCKETS_PER_USER = 10;

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (process.env.NODE_ENV === 'development' || !origin) {
        callback(null, true);
        return;
      }
      const allowed = (process.env.APP_URL || 'http://localhost:3000')
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      callback(null, allowed.includes(origin));
    },
    credentials: true,
  },
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets = new Map<string, Set<string>>();
  private sessionSockets = new Map<string, Set<string>>();
  private socketUsers = new Map<string, string>();
  private socketSessions = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret = resolveJwtSecret(
        this.configService,
        'JWT_SECRET',
        'owoc-dev-jwt-secret-change-in-prod',
      );
      const payload = this.jwtService.verify<{
        sub: string;
        sid?: string;
        tokenType?: 'access' | 'refresh';
        iat?: number;
      }>(token, { secret });

      const userId = payload.sub;
      const sid = payload.sid;
      if (!userId || !sid || payload.tokenType === 'refresh') {
        client.disconnect(true);
        return;
      }

      const [isBlacklisted, pwdChangedRaw, user] = await Promise.all([
        this.redis.exists(`blacklist:session:${sid}`),
        this.redis.get<string>(`pwdChangedAt:${userId}`),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, isBanned: true, bannedUntil: true, deletedAt: true },
        }),
      ]);

      if (isBlacklisted) {
        client.disconnect(true);
        return;
      }

      if (pwdChangedRaw && payload.iat && payload.iat * 1000 < Number(pwdChangedRaw)) {
        client.disconnect(true);
        return;
      }

      if (!user || user.deletedAt) {
        client.disconnect(true);
        return;
      }

      if (user.isBanned) {
        if (user.bannedUntil && user.bannedUntil <= new Date()) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { isBanned: false, bannedReason: null, bannedUntil: null },
          });
        } else {
          client.disconnect(true);
          return;
        }
      }

      const existing = this.userSockets.get(userId);
      if (existing && existing.size >= MAX_SOCKETS_PER_USER) {
        client.disconnect(true);
        return;
      }

      if (!existing) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.socketUsers.set(client.id, userId);

      if (!this.sessionSockets.has(sid)) {
        this.sessionSockets.set(sid, new Set());
      }
      this.sessionSockets.get(sid)!.add(client.id);
      this.socketSessions.set(client.id, sid);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.removeSocketTracking(client.id);
  }

  private removeSocketTracking(socketId: string) {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
      this.socketUsers.delete(socketId);
    }

    const sid = this.socketSessions.get(socketId);
    if (sid) {
      const sSockets = this.sessionSockets.get(sid);
      if (sSockets) {
        sSockets.delete(socketId);
        if (sSockets.size === 0) this.sessionSockets.delete(sid);
      }
      this.socketSessions.delete(socketId);
    }
  }

  disconnectUser(userId: string) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || !this.server) return;
    for (const socketId of Array.from(sockets)) {
      this.server.sockets.sockets.get(socketId)?.disconnect(true);
      this.removeSocketTracking(socketId);
    }
  }

  disconnectSession(sid: string) {
    const sockets = this.sessionSockets.get(sid);
    if (!sockets || !this.server) return;
    for (const socketId of Array.from(sockets)) {
      this.server.sockets.sockets.get(socketId)?.disconnect(true);
      this.removeSocketTracking(socketId);
    }
  }

  sendToUser(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (sockets && this.server) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  sendToUsers(userIds: string[], event: string, data: unknown) {
    for (const userId of userIds) {
      this.sendToUser(userId, event, data);
    }
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }
}
