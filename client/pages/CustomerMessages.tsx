// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CustomerLayout } from "@/components/CustomerLayout";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Building2,
  Clock,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CustomerMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.getBranches(),
  });

  // Fetch conversations
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiClient.getConversations(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", selectedConversation?.id],
    queryFn: async () => {
      const result = await apiClient.getMessages(selectedConversation.id);
      // After fetching messages (which marks them as read), refresh conversations
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      return result;
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { conversationId?: string; branchId?: string; messageText: string }) =>
      apiClient.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      setMessageText("");
      setShowNewMessage(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => apiClient.deleteMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => apiClient.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      setSelectedConversation(null);
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  const branches = branchesData?.branches || [];
  const conversations = conversationsData?.conversations || [];
  const messages = messagesData?.messages || [];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    if (selectedConversation) {
      sendMessageMutation.mutate({
        conversationId: selectedConversation.id,
        messageText: messageText.trim(),
      });
    } else if (selectedBranch) {
      sendMessageMutation.mutate({
        branchId: selectedBranch,
        messageText: messageText.trim(),
      });
    } else {
      toast({
        title: "Error",
        description: "Please select a branch",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (conversationsLoading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading messages...</div>
        </div>
      </CustomerLayout>
    );
  }

  // Show conversation list or new message form
  if (!selectedConversation && !showNewMessage) {
    return (
      <CustomerLayout>
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 sm:pb-8 md:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Messages</h1>
              <p className="text-sm sm:text-base text-slate-600 mt-1">
                Chat with branch administrators
              </p>
            </div>
            <Button
              onClick={() => setShowNewMessage(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">New Message</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>

          {conversations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No conversations yet
                </h3>
                <p className="text-slate-600 mb-6">
                  Start a conversation with a branch to get help or ask questions
                </p>
                <Button
                  onClick={() => setShowNewMessage(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Start Conversation
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv: any) => {
                const hasUnread = conv.customer_unread_count > 0;
                return (
                  <Card
                    key={conv.id}
                    className={`hover:shadow-md transition-shadow ${
                      hasUnread ? "border-l-4 border-l-blue-500 bg-blue-50/50" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div 
                          className="flex items-start gap-3 flex-1 cursor-pointer"
                          onClick={() => setSelectedConversation(conv)}
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 relative">
                            <Building2 className="w-6 h-6 text-primary" />
                            {hasUnread && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-slate-900 truncate ${
                                hasUnread ? "font-bold" : "font-semibold"
                              }`}>
                                {conv.branch_name}
                              </h3>
                              {hasUnread && (
                                <Badge className="bg-blue-500 text-white">
                                  {conv.customer_unread_count}
                                </Badge>
                              )}
                            </div>
                            <p className={`text-sm text-slate-600 truncate mb-1 ${
                              hasUnread ? "font-semibold" : ""
                            }`}>
                              {conv.last_message || "No messages yet"}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {formatTime(conv.last_message_at)}
                            </div>
                          </div>
                        </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete conversation with ${conv.branch_name} for you? (Branch will still see it)`)) {
                            deleteConversationMutation.mutate(conv.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        title="Delete for me"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      </CustomerLayout>
    );
  }

  // Show new message form
  if (showNewMessage) {
    return (
      <CustomerLayout>
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 sm:pb-8 md:pb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewMessage(false);
                setSelectedBranch("");
                setMessageText("");
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">New Message</h1>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="branch">Select Branch *</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch: any) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name} - {branch.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message *</Label>
                <textarea
                  id="message"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full min-h-[120px] p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <p className="text-xs text-slate-500">Press Enter to send, Shift+Enter for new line</p>
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={!selectedBranch || !messageText.trim() || sendMessageMutation.isPending}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </CustomerLayout>
    );
  }

  // Show conversation messages
  return (
    <CustomerLayout>
      <div className="w-full max-w-3xl mx-auto flex flex-col bg-slate-50 min-h-[calc(100dvh-64px)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 sm:px-4 py-2 border-b border-slate-200 flex-shrink-0 bg-white/95 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
            onClick={() => {
              setSelectedConversation(null);
              setMessageText("");
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs sm:text-sm">Chats</span>
          </Button>

          <div className="text-center min-w-0 px-1">
            <h2 className="font-semibold text-sm sm:text-base text-slate-900 truncate">
              {selectedConversation.branch_name}
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-500 truncate">
              {selectedConversation.branch_location}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
            onClick={() => {
              if (confirm(`Delete conversation with ${selectedConversation.branch_name} for you? (Branch will still see it)`)) {
                deleteConversationMutation.mutate(selectedConversation.id);
              }
            }}
            title="Delete for me"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages area - scrollable with proper overflow */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 sm:px-4 py-3 space-y-2 sm:space-y-3">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
              <div className="text-xs sm:text-sm text-slate-600">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs sm:text-sm text-slate-600">No messages yet</p>
                  </div>
                </div>
              ) : (
                messages.map((msg: any) => {
                  const isOwnMessage = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} group px-0.5`}
                    >
                      <div className={`flex items-end gap-2 max-w-[92%] sm:max-w-[80%] ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${isOwnMessage ? "bg-primary/20 text-[hsl(var(--primary))]" : "bg-slate-300 text-slate-700"}`}>
                          {isOwnMessage
                            ? (user?.name?.charAt(0).toUpperCase() || "Y")
                            : (msg.sender_name?.charAt(0).toUpperCase() || "A")}
                        </div>

                        <div
                          className={`rounded-2xl px-3 py-2.5 relative ${
                            isOwnMessage
                              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                              : "bg-slate-200 text-slate-900"
                          }`}
                        >
                          {!isOwnMessage && (
                            <p className="text-[10px] font-semibold mb-1 opacity-70">
                              {msg.sender_name}
                            </p>
                          )}
                          <p className="text-[13px] sm:text-sm leading-snug whitespace-pre-wrap break-words">
                            {msg.message_text}
                          </p>
                          <div className={`mt-1 flex items-center gap-1 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                            <p className={`text-[10px] ${isOwnMessage ? "text-white/70" : "text-slate-500"}`}>
                              {formatMessageTime(msg.created_at)}
                            </p>
                            {isOwnMessage && (
                              <button
                                onClick={() => {
                                  if (confirm("Delete this message for you? (Other person will still see it)")) {
                                    deleteMessageMutation.mutate(msg.id);
                                  }
                                }}
                                className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded"
                                title="Delete for me"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <div className="sticky bottom-0 z-20 border-t border-slate-200 px-2 sm:px-4 py-2 bg-white/95 backdrop-blur-sm flex-shrink-0 message-input-area">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 text-sm h-9 border-0 shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-[hsl(var(--primary-foreground))] h-8 w-8 rounded-full p-0 flex-shrink-0"
              size="sm"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
