import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/context/auth-context";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Message, User } from "@shared/schema";

interface MessageWithSender extends Message {
  sender?: { id: string; name: string; role: string };
}

export function DriverMessagesView() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all admin users to find who to message
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const admins = users.filter(u => u.role === "admin");
  const adminId = admins[0]?.id; // Default to first admin

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/messages", adminId],
    queryFn: async () => {
      if (!adminId) return [];
      const res = await fetch(`/api/messages?withUser=${adminId}&limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("routesimply_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!adminId,
    refetchInterval: 5000,
  });

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest<Message>("POST", "/api/messages", {
        recipientId: adminId,
        content,
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Subscribe to new messages
  useEffect(() => {
    const unsub = subscribe("message_new", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    });
    return unsub;
  }, [subscribe, queryClient]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sortedMessages = [...messages].reverse();

  const handleSend = () => {
    if (!messageText.trim() || !adminId) return;
    sendMutation.mutate(messageText.trim());
  };

  return (
    <div className="flex flex-col h-[calc(100vh-240px)]">
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sortedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No messages yet. Send a message to your admin!
              </p>
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
                      "max-w-[80%] rounded-2xl px-4 py-2",
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm",
                    )}
                  >
                    {!isMine && msg.sender && (
                      <p className="text-xs font-medium mb-0.5 opacity-70">
                        {msg.sender.name}
                      </p>
                    )}
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
        <div className="p-3 border-t border-border">
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
      </Card>
    </div>
  );
}
