import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { WSEventType } from "@shared/schema";
import { verifyToken, type JWTPayload } from "./auth";

interface AuthenticatedClient {
  ws: WebSocket;
  user: JWTPayload;
  isAlive: boolean;
}

// Track connected clients by userId
const clients = new Map<string, AuthenticatedClient>();
// Track which admins are connected (they get all broadcasts)
const adminClients = new Set<string>();

let wss: WebSocketServer;

export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, userId) => {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(userId);
        adminClients.delete(userId);
        broadcastToAdmins("driver_disconnected", { driverId: userId });
        return;
      }
      client.isAlive = false;
      client.ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  wss.on("connection", (ws, req) => {
    // Authenticate via token in query string
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }

    let user: JWTPayload;
    try {
      user = verifyToken(token);
    } catch {
      ws.close(4001, "Invalid token");
      return;
    }

    // Register client
    const client: AuthenticatedClient = { ws, user, isAlive: true };
    clients.set(user.userId, client);

    if (user.role === "admin") {
      adminClients.add(user.userId);
    }

    ws.on("pong", () => {
      client.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(user, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(user.userId);
      adminClients.delete(user.userId);
      if (user.role === "driver") {
        broadcastToAdmins("driver_disconnected", { 
          driverId: user.userId,
          driverName: user.username,
        });
      }
    });

    // Notify admins a driver connected
    if (user.role === "driver") {
      broadcastToAdmins("driver_connected", {
        driverId: user.userId,
        driverName: user.username,
      });
    }

    // Send initial ack
    sendToClient(user.userId, "driver_connected", { 
      message: "Connected",
      userId: user.userId,
    });
  });

  return wss;
}

function handleClientMessage(user: JWTPayload, msg: any) {
  switch (msg.type) {
    case "driver_location":
      // Driver sending their GPS location
      if (user.role === "driver") {
        broadcastToAdmins("driver_location", {
          driverId: user.userId,
          driverName: user.username,
          lat: msg.payload?.lat,
          lng: msg.payload?.lng,
          heading: msg.payload?.heading,
          speed: msg.payload?.speed,
          timestamp: new Date().toISOString(),
        });
      }
      break;
    case "message_read":
      // Mark messages as read
      const senderId = msg.payload?.senderId;
      if (senderId) {
        sendToClient(senderId, "message_read", {
          readBy: user.userId,
          readAt: new Date().toISOString(),
        });
      }
      break;
  }
}

/**
 * Send a message to a specific client by userId.
 */
export function sendToClient(userId: string, type: WSEventType, payload: unknown) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    }));
  }
}

/**
 * Broadcast a message to all connected admin clients.
 */
export function broadcastToAdmins(type: WSEventType, payload: unknown) {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });

  adminClients.forEach((adminId) => {
    const client = clients.get(adminId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

/**
 * Broadcast to a specific driver.
 */
export function sendToDriver(driverId: string, type: WSEventType, payload: unknown) {
  sendToClient(driverId, type, payload);
}

/**
 * Broadcast to all connected clients.
 */
export function broadcastToAll(type: WSEventType, payload: unknown) {
  const message = JSON.stringify({
    type,
    payload,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

/**
 * Get count of connected clients.
 */
export function getConnectedClients(): { total: number; drivers: number; admins: number } {
  let drivers = 0;
  let admins = 0;
  clients.forEach((client) => {
    if (client.user.role === "driver") drivers++;
    else if (client.user.role === "admin") admins++;
  });
  return { total: clients.size, drivers, admins };
}

/**
 * Check if a specific user is connected.
 */
export function isClientConnected(userId: string): boolean {
  const client = clients.get(userId);
  return !!client && client.ws.readyState === WebSocket.OPEN;
}
