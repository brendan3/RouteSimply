import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, Plus, Search, UserPlus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuthContext } from "@/context/auth-context";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_PERSISTED_MESSAGES = 50;

export function AIChat() {
  const { user } = useAuthContext();
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("ai-chat-open");
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("ai-chat-messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.slice(-MAX_PERSISTED_MESSAGES) : [];
      }
    } catch {
      return [];
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("ai-chat-open", String(isOpen));
    } catch {
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const toStore = messages.slice(-MAX_PERSISTED_MESSAGES);
      localStorage.setItem("ai-chat-messages", JSON.stringify(toStore));
    } catch {
    }
  }, [messages]);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

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
      const data = await apiRequest<{ response: string }>("POST", "/api/chat", {
        message: userMessage,
        conversationHistory: messages.slice(-10),
      });

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

  const parseInlineElements = (text: string, keyPrefix: string): (string | JSX.Element)[] => {
    const parts: (string | JSX.Element)[] = [];
    const inlineRegex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    let partIndex = 0;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      if (match[1] && match[2]) {
        parts.push(
          <a
            key={`${keyPrefix}-link-${partIndex++}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline break-all font-medium"
          >
            {match[1]}
          </a>
        );
      } else if (match[3]) {
        parts.push(
          <strong key={`${keyPrefix}-bold-${partIndex++}`} className="font-semibold">
            {match[3]}
          </strong>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  const formatMessage = (content: string) => {
    const lines = content.split("\n");
    const elements: JSX.Element[] = [];
    let currentList: { type: "ul" | "ol"; items: JSX.Element[] } | null = null;
    
    const flushList = () => {
      if (currentList) {
        const ListTag = currentList.type === "ul" ? "ul" : "ol";
        elements.push(
          <ListTag key={`list-${elements.length}`} className={`ml-4 text-sm ${currentList.type === "ul" ? "list-disc" : "list-decimal"} space-y-0.5`}>
            {currentList.items}
          </ListTag>
        );
        currentList = null;
      }
    };
    
    lines.forEach((line, i) => {
      if (line.startsWith("# ")) {
        flushList();
        elements.push(<h2 key={i} className="text-lg font-bold mt-2 mb-1">{parseInlineElements(line.slice(2), `h2-${i}`)}</h2>);
      } else if (line.startsWith("## ")) {
        flushList();
        elements.push(<h3 key={i} className="text-base font-semibold mt-2 mb-1">{parseInlineElements(line.slice(3), `h3-${i}`)}</h3>);
      } else if (line.startsWith("### ")) {
        flushList();
        elements.push(<h4 key={i} className="text-sm font-semibold mt-1 mb-1">{parseInlineElements(line.slice(4), `h4-${i}`)}</h4>);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        if (!currentList || currentList.type !== "ul") {
          flushList();
          currentList = { type: "ul", items: [] };
        }
        const bulletText = line.slice(2);
        currentList.items.push(<li key={i}>{parseInlineElements(bulletText, `li-${i}`)}</li>);
      } else if (line.match(/^\d+\.\s/)) {
        if (!currentList || currentList.type !== "ol") {
          flushList();
          currentList = { type: "ol", items: [] };
        }
        currentList.items.push(<li key={i}>{parseInlineElements(line.replace(/^\d+\.\s/, ""), `ol-${i}`)}</li>);
      } else if (line.trim() === "") {
        flushList();
        elements.push(<br key={i} />);
      } else {
        flushList();
        elements.push(<p key={i} className="text-sm">{parseInlineElements(line, `p-${i}`)}</p>);
      }
    });
    
    flushList();
    return elements;
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem("ai-chat-messages");
  };

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <Button
            data-testid="button-open-chat"
            onClick={() => setIsOpen(true)}
            className="rounded-full shadow-lg gap-2"
          >
            <Sparkles className="h-5 w-5" />
            <span className="font-medium">Ask AI</span>
          </Button>
        </div>
      )}

      {isOpen && (
        <Card 
          className="fixed bottom-6 right-6 w-[400px] h-[560px] flex flex-col shadow-2xl z-50 overflow-visible border-0 backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 rounded-2xl animate-scale-in"
          style={{ 
            boxShadow: "0 25px 50px -12px rgba(139, 92, 246, 0.25), 0 0 0 1px rgba(255,255,255,0.1)" 
          }}
          data-testid="chat-panel"
        >
          <div className="flex items-center justify-between gap-2 p-4 border-b border-white/10 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-semibold text-white block text-sm">AI Assistant</span>
                <span className="text-white/70 text-xs">Ask me anything or take actions</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearHistory}
                  title="Clear chat history"
                  data-testid="button-clear-chat"
                >
                  <Trash2 className="h-4 w-4 text-white/80" />
                </Button>
              )}
              <Button
                data-testid="button-close-chat"
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && (
              <div className="text-center py-6 animate-fade-in">
                <div className="h-16 w-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-purple-500" />
                </div>
                <p className="text-base font-medium mb-1 text-foreground">Hi! I'm your AI assistant.</p>
                <p className="text-sm text-muted-foreground mb-6">I can answer questions and help you manage customers and drivers.</p>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick("Add a new customer named ")}
                      className="justify-start text-xs"
                      data-testid="button-suggestion-add-customer"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                      Add Customer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick("Search for customer ")}
                      className="justify-start text-xs"
                      data-testid="button-suggestion-search"
                    >
                      <Search className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                      Find Customer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick("Add a new driver named ")}
                      className="justify-start text-xs"
                      data-testid="button-suggestion-add-driver"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1.5 text-cyan-500" />
                      Add Driver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick("How do I generate routes?")}
                      className="justify-start text-xs"
                      data-testid="button-suggestion-help"
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                      Get Help
                    </Button>
                  </div>
                  
                  <div className="pt-4 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Example Questions</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuggestionClick("How many stops are scheduled for each day?")}
                      className="w-full justify-start text-xs text-muted-foreground"
                      data-testid="button-suggestion-2"
                    >
                      "How many stops are scheduled for each day?"
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuggestionClick("Who are my drivers?")}
                      className="w-full justify-start text-xs text-muted-foreground"
                      data-testid="button-suggestion-3"
                    >
                      "Who are my drivers?"
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                  data-testid={`chat-message-${msg.role}-${idx}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-sm">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[280px] rounded-2xl p-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border rounded-bl-md"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-headings:my-1">{formatMessage(msg.content)}</div>
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
                <div className="flex gap-2.5 justify-start animate-fade-in" data-testid="chat-loading">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-sm">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-bl-md p-3 shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollEndRef} />
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border bg-muted/50 backdrop-blur-sm rounded-b-2xl">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or give a command..."
                disabled={isLoading}
                className="flex-1 rounded-xl"
                data-testid="input-chat-message"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="rounded-xl"
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
