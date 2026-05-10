// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  User,
  Clock,
  Mail,
  Phone,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BranchMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageText, setMessageText] = useState("");

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
    enabled: !!selectedConversation && !selectedConversation.isNew,
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { conversationId?: string; messageText: string }) =>
      apiClient.sendMessage(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
      setMessageText("");
      
      // If it was a new conversation, update to the created conversation
      if (selectedConversation?.isNew && response?.message?.conversation_id) {
        queryClient.invalidateQueries({ queryKey: ["messages", response.message.conversation_id] });
        // Refresh conversations and select the new one
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: ["conversations"] }).then((result: any) => {
            const conversations = result[0]?.data?.conversations || [];
            if (conversations.length > 0) {
              setSelectedConversation(conversations[0]);
            }
          });
        }, 500);
      } else {
        queryClient.invalidateQueries({ queryKey: ["messages", selectedConversation?.id] });
      }
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

    if (!selectedConversation) {
      toast({
        title: "Error",
        description: "No conversation selected",
        variant: "destructive",
      });
      return;
    }

    // If it's a new conversation (no ID), we need to send without conversationId
    // The backend will create the conversation automatically
    if (selectedConversation.isNew) {
      sendMessageMutation.mutate({
        conversationId: undefined,
        messageText: messageText.trim(),
      });
    } else {
      sendMessageMutation.mutate({
        conversationId: selectedConversation.id,
        messageText: messageText.trim(),
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
      <AdminLayout userRole="branch">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Loading messages...</div>
        </div>
      </AdminLayout>
    );
  }

  // Show conversation list
  if (!selectedConversation) {
    return (
      <AdminLayout userRole="branch">
        <div className="container max-w-6xl mx-auto space-y-6 pb-20 md:pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Messages</h1>
              <p className="text-sm sm:text-base text-slate-600 mt-1">
                Customer inquiries and admin communications
              </p>
            </div>
          </div>

          {conversations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No messages yet
                </h3>
                <p className="text-slate-600">
                  Messages from customers and admin will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv: any) => {
                const isAdminConversation = !conv.customer_id || conv.customer_name === "Admin";
                const hasUnread = conv.branch_unread_count > 0;
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
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative ${
                            isAdminConversation ? "bg-gold-100" : "bg-blue-100"
                          }`}>
                            <User className={`w-6 h-6 ${
                              isAdminConversation ? "text-gold-600" : "text-blue-600"
                            }`} />
                            {hasUnread && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-slate-900 truncate ${
                                hasUnread ? "font-bold" : "font-semibold"
                              }`}>
                                {isAdminConversation ? "System Administrator" : conv.customer_name}
                              </h3>
                              {hasUnread && (
                                <Badge className="bg-blue-500 text-white">
                                  {conv.branch_unread_count}
                                </Badge>
                              )}
                            </div>
                            {!isAdminConversation && (
                              <>
                                <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                                  <Mail className="w-3 h-3" />
                                  {conv.customer_email}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                                  <Phone className="w-3 h-3" />
                                  {conv.customer_phone}
                                </div>
                              </>
                            )}
                            {isAdminConversation && (
                              <p className="text-xs text-slate-600 mb-2">Super Admin</p>
                            )}
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
                            const otherParty = isAdminConversation ? "Admin" : conv.customer_name;
                            if (confirm(`Delete conversation with ${otherParty} for you? (${otherParty} will still see it)`)) {
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
      </AdminLayout>
    );
  }

  // Show conversation messages
  const isAdminConversation = !selectedConversation.customer_id || selectedConversation.customer_name === "Admin" || selectedConversation.isNew;
  
  return (
    <AdminLayout userRole="branch">
      <div className="container max-w-6xl mx-auto pb-20 md:pb-6">
        <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedConversation(null);
                setMessageText("");
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isAdminConversation ? "bg-gold-100" : "bg-blue-100"
              }`}>
                <User className={`w-5 h-5 ${
                  isAdminConversation ? "text-gold-600" : "text-blue-600"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-slate-900 truncate">
                  {isAdminConversation ? "System Administrator" : selectedConversation.customer_name}
                </h2>
                {isAdminConversation ? (
                  <p className="text-xs text-slate-600">Super Admin</p>
                ) : (
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{selectedConversation.customer_email}</span>
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <Phone className="w-3 h-3" />
                      {selectedConversation.customer_phone}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {!selectedConversation.isNew && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const otherParty = isAdminConversation ? "Admin" : selectedConversation.customer_name;
                  if (confirm(`Delete conversation with ${otherParty} for you? (${otherParty} will still see it)`)) {
                    deleteConversationMutation.mutate(selectedConversation.id);
                  }
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                title="Delete for me"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <Card className="flex-1 flex flex-col">
            <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedConversation.isNew ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-600">Start a conversation with the admin</p>
                  </div>
                </div>
              ) : messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-sm text-slate-600">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-600">No messages yet</p>
                  </div>
                </div>
              ) : (
                messages.map((msg: any) => {
                  const isOwnMessage = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} group`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 relative ${
                          isOwnMessage
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        {!isOwnMessage && (
                          <p className="text-xs font-semibold mb-1 opacity-75">
                            {msg.sender_name}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words pr-6">{msg.message_text}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p
                            className={`text-xs ${
                              isOwnMessage ? "text-white/70" : "text-slate-500"
                            }`}
                          >
                            {formatMessageTime(msg.created_at)}
                          </p>
                          {isOwnMessage && (
                            <button
                              onClick={() => {
                                const otherParty = isAdminConversation ? "Admin" : selectedConversation.customer_name;
                                if (confirm(`Delete this message for you? (${otherParty} will still see it)`)) {
                                  deleteMessageMutation.mutate(msg.id);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded"
                              title="Delete for me"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-slate-200 p-4">
              <div className="flex gap-2">
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
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Press Enter to send</p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
