// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/lib/authContext";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MessageNotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch unread message count
  const { data: unreadData } = useQuery({
    queryKey: ["unreadCount"],
    queryFn: () => apiClient.getUnreadMessageCount(),
    refetchInterval: 5000, // Check every 5 seconds
    enabled: !!user,
  });

  const unreadCount = unreadData?.unreadCount || 0;

  const handleClick = () => {
    if (user?.role === "customer") {
      navigate("/customer/messages");
    } else if (user?.role === "branch_admin") {
      navigate("/branch/messages");
    } else if (user?.role === "admin") {
      navigate("/admin/messages");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative hover:bg-white/10"
      onClick={handleClick}
      title="Messages"
    >
      <MessageCircle className="w-5 h-5 text-gold-400 hover:text-gold-300" />
      {unreadCount > 0 && (
        <Badge
          className={cn(
            "absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center p-0 text-xs font-bold",
            "bg-blue-500 text-white animate-pulse shadow-lg"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
