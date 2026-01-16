import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuthContext } from "@/context/auth-context";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIChat() {
  const { user } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/chat", {
        message: userMessage,
        conversationHistory: messages.slice(-10),
        userId: user.id,
      });

      const data = await response.json() as { response: string };
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (error: unknown) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("# ")) {
        return <h2 key={i} className="text-lg font-bold mt-2 mb-1">{line.slice(2)}</h2>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={i} className="text-base font-semibold mt-2 mb-1">{line.slice(3)}</h3>;
      }
      if (line.startsWith("### ")) {
        return <h4 key={i} className="text-sm font-semibold mt-1 mb-1">{line.slice(4)}</h4>;
      }
      if (line.startsWith("- ")) {
        return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
      }
      if (line.match(/^\d+\.\s/)) {
        return <li key={i} className="ml-4 text-sm list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="font-semibold text-sm">{line.slice(2, -2)}</p>;
      }
      if (line.trim() === "") {
        return <br key={i} />;
      }
      return <p key={i} className="text-sm">{line}</p>;
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <>
      {!isOpen && (
        <Button
          data-testid="button-open-chat"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 rounded-full shadow-lg z-50"
          size="lg"
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          <span>Ask AI</span>
        </Button>
      )}

      {isOpen && (
        <Card 
          className="fixed bottom-6 right-6 w-[380px] h-[520px] flex flex-col shadow-2xl z-50 overflow-hidden"
          data-testid="chat-panel"
        >
          <div className="flex items-center justify-between gap-2 p-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-medium">AI Assistant</span>
            </div>
            <Button
              data-testid="button-close-chat"
              variant="ghost"
              size="icon"
              className="text-primary-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-2">Hi! I'm your AI assistant.</p>
                <p className="text-xs">Ask me how to use the app or questions about your routes, drivers, and schedules.</p>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-foreground">Try asking:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSuggestionClick("How do I generate routes?")}
                    className="w-full justify-start text-xs"
                    data-testid="button-suggestion-1"
                  >
                    "How do I generate routes?"
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSuggestionClick("How many stops are scheduled for each day?")}
                    className="w-full justify-start text-xs"
                    data-testid="button-suggestion-2"
                  >
                    "How many stops are scheduled for each day?"
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSuggestionClick("Who are my drivers?")}
                    className="w-full justify-start text-xs"
                    data-testid="button-suggestion-3"
                  >
                    "Who are my drivers?"
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`chat-message-${msg.role}-${idx}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={`max-w-[280px] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert">{formatMessage(msg.content)}</div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start" data-testid="chat-loading">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
                data-testid="button-send-message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
