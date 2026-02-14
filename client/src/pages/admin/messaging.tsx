import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { EmptyState } from "@/components/common/empty-state";
import { useAuthContext } from "@/context/auth-context";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle, User as UserIcon, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { User, Message } from "@shared/schema";

interface ConversationPreview {
  user: { id: string; name: string; role: string; color: string | null };
  lastMessage: Message;
  unreadCount: number;
}

interface MessageWithSender extends Message {
  sender?: { id: string; name: string; role: string };
}

export default function AdminMessagingPage() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch drivers for conversation list
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const driverUsers = users.filter(u => u.role === "driver");

  // Fetch conversations
  const { data: conversations = [] } = useQuery<ConversationPreview[]>({
    queryKey: ["/api/messages/conversations"],
    refetchInterval: 15000,
  });

  // Fetch messages with selected user
  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/messages", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const res = await fetch(`/api/messages?withUser=${selectedUserId}&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedUserId,
    refetchInterval: 5000,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (data: { recipientId: string; content: string }) => {
      return apiRequest<Message>("POST", "/api/messages", data);
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Subscribe to new messages via WebSocket
  useEffect(() => {
    const unsub = subscribe("message_new", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Sorted messages (oldest first for display)
  const sortedMessages = [...messages].reverse();

  // Build conversation list from drivers + existing conversations
  const conversationMap = new Map(conversations.map(c => [c.user?.id, c]));
  const allDriverConversations = driverUsers.map(driver => {
    const existing = conversationMap.get(driver.id);
    return {
      user: { id: driver.id, name: driver.name, role: driver.role, color: driver.color },
      lastMessage: existing?.lastMessage || null,
      unreadCount: existing?.unreadCount || 0,
    };
  });

  const handleSend = () => {
    if (!messageText.trim() || !selectedUserId) return;
    sendMutation.mutate({
      recipientId: selectedUserId,
      content: messageText.trim(),
    });
  };

  const selectedDriver = driverUsers.find(d => d.id === selectedUserId);

  return (
    <AdminLayout title="Messages" subtitle="Team communication">
      <div className="flex h-[calc(100vh-200px)] gap-4">
        {/* Conversation list */}
        <Card className={cn(
          "w-full md:w-80 flex-shrink-0 flex flex-col overflow-hidden",
          selectedUserId && "hidden md:flex",
        )}>
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">Conversations</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {allDriverConversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No drivers to message yet.
              </div>
            ) : (
              allDriverConversations.map(conv => (
                <button
                  key={conv.user.id}
                  onClick={() => setSelectedUserId(conv.user.id)}
                  className={cn(
                    "w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50",
                    selectedUserId === conv.user.id && "bg-muted/50",
                  )}
                >
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                    style={{ backgroundColor: conv.user.color || "#3b82f6" }}
                  >
                    {conv.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{conv.user.name}</p>
                      {conv.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center text-xs">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat area */}
        <Card className={cn(
          "flex-1 flex flex-col overflow-hidden",
          !selectedUserId && "hidden md:flex",
        )}>
          {selectedUserId ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setSelectedUserId(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  style={{ backgroundColor: selectedDriver?.color || "#3b82f6" }}
                >
                  {selectedDriver?.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-medium text-sm">{selectedDriver?.name || "Driver"}</p>
                  <p className="text-xs text-muted-foreground">Driver</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <LoadingSpinner text="Loading messages..." />
                ) : sortedMessages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  sortedMessages.map(msg => {
                    const isMine = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex", isMine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2",
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted rounded-bl-sm",
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            isMine ? "text-primary-foreground/60" : "text-muted-foreground/60",
                          )}>
                            {msg.createdAt && format(new Date(msg.createdAt), "h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!messageText.trim() || sendMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={MessageCircle}
                title="Select a conversation"
                description="Choose a driver from the list to start messaging."
              />
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
