import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send, User, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface ChatSummary {
  customerId: number;
  customerName: string;
  lastMessage: {
    id: number;
    message: string;
    senderType: string;
    createdAt: string;
  };
  unreadCount: number;
}

interface ChatMessage {
  id: number;
  customerId: number;
  senderType: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function AdminChat() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-page-title">Live Chat Support</h2>
        <p className="text-muted-foreground text-sm mt-1">Respond to customer messages</p>
      </div>

      {selectedCustomerId ? (
        <ChatConversation
          customerId={selectedCustomerId}
          customerName={selectedCustomerName}
          onBack={() => { setSelectedCustomerId(null); setSelectedCustomerName(""); }}
        />
      ) : (
        <ChatList
          onSelectChat={(id, name) => { setSelectedCustomerId(id); setSelectedCustomerName(name); }}
        />
      )}
    </div>
  );
}

function ChatList({ onSelectChat }: { onSelectChat: (id: number, name: string) => void }) {
  const { data: chats, isLoading } = useQuery<ChatSummary[]>({
    queryKey: ["/api/admin/chats"],
    refetchInterval: 3000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!chats?.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No chat conversations yet</p>
          <p className="text-sm text-muted-foreground mt-1">Customer messages will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {chats.map((chat) => (
        <Card
          key={chat.customerId}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelectChat(chat.customerId, chat.customerName)}
          data-testid={`card-chat-${chat.customerId}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm" data-testid={`text-chat-name-${chat.customerId}`}>{chat.customerName}</p>
                    {chat.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0" data-testid={`badge-unread-${chat.customerId}`}>
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                    {chat.lastMessage.senderType === "admin" ? "You: " : ""}{chat.lastMessage.message}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(chat.lastMessage.createdAt), "MMM d, h:mm a")}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChatConversation({ customerId, customerName, onBack }: { customerId: number; customerName: string; onBack: () => void }) {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/admin/chats", customerId],
    refetchInterval: 2000,
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => apiRequest("POST", `/api/admin/chats/${customerId}`, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chats", customerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chats"] });
      setNewMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col" style={{ height: "calc(100vh - 200px)" }}>
      <CardHeader className="py-3 px-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-chats">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-sm" data-testid="text-chat-customer-name">{customerName}</CardTitle>
            <p className="text-xs text-muted-foreground">Customer Support Chat</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {!messages?.length ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderType === "admin" ? "justify-end" : "justify-start"}`}
              data-testid={`message-${msg.id}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                  msg.senderType === "admin"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <p className={`text-[10px] mt-1 ${msg.senderType === "admin" ? "text-indigo-200" : "text-muted-foreground"}`}>
                  {format(new Date(msg.createdAt), "h:mm a")}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-3 flex gap-2 shrink-0">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          data-testid="input-admin-chat-message"
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sendMutation.isPending || !newMessage.trim()} data-testid="button-send-admin-message">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
