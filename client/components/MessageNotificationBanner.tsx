// @ts-nocheck
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function MessageNotificationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [lastUnreadCount, setLastUnreadCount] = useState(0);

  // Fetch unread message count
  const { data: unreadData } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: () => apiClient.getUnreadMessageCount(),
    refetchInterval: 5000, // Check every 5 seconds
    enabled: !!user,
  });

  const unreadCount = unreadData?.unreadCount || 0;

  // Show toast notification when new messages arrive
  useEffect(() => {
    if (unreadCount > lastUnreadCount && lastUnreadCount > 0) {
      const newMessages = unreadCount - lastUnreadCount;
      toast({
        title: "New Message",
        description: `You have ${newMessages} new message${newMessages > 1 ? 's' : ''}`,
        duration: 5000,
      });
      
      // Play notification sound (optional)
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Ignore if audio fails to play
        });
      } catch (error) {
        // Ignore audio errors
      }
    }
    setLastUnreadCount(unreadCount);
  }, [unreadCount, lastUnreadCount, toast]);

  // Don't show banner if no unread messages, dismissed, or on messages page
  const isOnMessagesPage = location.pathname.includes('/messages');
  if (unreadCount === 0 || dismissed || isOnMessagesPage) {
    return null;
  }

  const handleClick = () => {
    if (user?.role === "customer") {
      navigate("/customer/messages");
    } else if (user?.role === "branch_admin") {
      navigate("/branch/messages");
    } else if (user?.role === "admin") {
      navigate("/admin/messages");
    }
    setDismissed(true);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "fixed top-16 left-0 right-0 z-40 mx-auto max-w-2xl px-4",
        "animate-in slide-in-from-top duration-300"
      )}
    >
      <div
        onClick={handleClick}
        className={cn(
          "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg",
          "p-4 cursor-pointer hover:shadow-xl transition-all",
          "flex items-center justify-between gap-4"
        )}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-white/20 p-2 rounded-full">
            <MessageCircle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm sm:text-base">
              New Message{unreadCount > 1 ? 's' : ''}
            </h3>
            <p className="text-xs sm:text-sm text-blue-100">
              You have {unreadCount} unread message{unreadCount > 1 ? 's' : ''}. Click to view.
            </p>
          </div>
          <Badge className="bg-white text-blue-600 hover:bg-white/90 font-bold">
            {unreadCount}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="text-white hover:bg-white/20 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
