import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

interface Notification {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  reason: "like" | "repost" | "follow" | "mention" | "reply" | "quote";
  reasonSubject?: string;
  record?: {
    text?: string;
    createdAt?: string;
  };
  isRead: boolean;
  indexedAt: string;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.notifications.list({ limit: 50 });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load notifications");
      }

      setNotifications(response.data.notifications || []);
      
      // Mark notifications as read
      api.notifications.markRead();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return "now";
    }
  };

  const getNotificationIcon = (reason: string) => {
    switch (reason) {
      case "like":
        return (
          <div className="w-8 h-8 rounded-full bg-[#e0245e]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#e0245e]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
        );
      case "repost":
        return (
          <div className="w-8 h-8 rounded-full bg-[#17bf63]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#17bf63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        );
      case "follow":
        return (
          <div className="w-8 h-8 rounded-full bg-[#0085ff]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#0085ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
        );
      case "mention":
      case "reply":
        return (
          <div className="w-8 h-8 rounded-full bg-[#0085ff]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#0085ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case "quote":
        return (
          <div className="w-8 h-8 rounded-full bg-[#794bc4]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#794bc4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[#8899a6]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.reason) {
      case "like":
        return "liked your post";
      case "repost":
        return "reposted your post";
      case "follow":
        return "followed you";
      case "mention":
        return "mentioned you";
      case "reply":
        return "replied to your post";
      case "quote":
        return "quoted your post";
      default:
        return "interacted with you";
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.reason === "follow") {
      return `/profile/${notification.author.handle}`;
    }
    if (notification.reasonSubject) {
      return `/post/${encodeURIComponent(notification.reasonSubject)}`;
    }
    if (notification.uri) {
      return `/post/${encodeURIComponent(notification.uri)}`;
    }
    return `/profile/${notification.author.handle}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2f3e4e] bg-[#0f1a2a] sticky top-0 z-10">
        <h1 className="text-[19px] font-extrabold text-white">Notifications</h1>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
        </div>
      ) : error ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[#e0245e] mb-4">{error}</p>
          <button
            onClick={fetchNotifications}
            className="text-[#0085ff] hover:underline font-bold"
          >
            Try again
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-[#2f3e4e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-[#8899a6] text-lg">No notifications yet</p>
          <p className="text-[#8899a6] text-sm mt-1">When someone interacts with you, you'll see it here</p>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => (
            <Link
              key={notification.uri + notification.indexedAt}
              to={getNotificationLink(notification)}
              className={`flex gap-3 px-4 py-3 border-b border-[#2f3e4e] hover:bg-[#1c2938] transition-colors ${
                !notification.isRead ? "bg-[#0085ff]/5" : ""
              }`}
            >
              {/* Icon */}
              {getNotificationIcon(notification.reason)}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <img
                    src={notification.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${notification.author.handle}`}
                    alt={notification.author.displayName || notification.author.handle}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white">
                      <span className="font-bold hover:underline">
                        {notification.author.displayName || notification.author.handle}
                      </span>{" "}
                      <span className="text-[#8899a6]">{getNotificationText(notification)}</span>
                    </p>
                    
                    {/* Show post text for replies/mentions/quotes */}
                    {notification.record?.text && (
                      <p className="text-[#8899a6] text-sm mt-1 line-clamp-2">
                        {notification.record.text}
                      </p>
                    )}
                  </div>
                  
                  <span className="text-[#8899a6] text-sm flex-shrink-0">
                    {formatDate(notification.indexedAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
