import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth.store";

interface ConvoMember {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface Convo {
  id: string;
  rev: string;
  members: ConvoMember[];
  lastMessage?: {
    id: string;
    rev: string;
    text: string;
    sender: { did: string };
    sentAt: string;
  };
  unreadCount: number;
  muted: boolean;
}

interface Message {
  id: string;
  rev: string;
  text: string;
  sender: { did: string };
  sentAt: string;
}

export default function Chat() {
  const { profile } = useAuthStore();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConvos();
  }, []);

  useEffect(() => {
    if (selectedConvo) {
      fetchMessages(selectedConvo.id);
    }
  }, [selectedConvo?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConvos = async () => {
    try {
      setLoading(true);
      const response = await api.chat.listConvos({ limit: 50 });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load conversations");
      }

      setConvos(response.data.convos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convoId: string) => {
    try {
      setLoadingMessages(true);
      const response = await api.chat.getMessages(convoId, { limit: 100 });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load messages");
      }

      // Messages come in reverse order, so reverse them
      setMessages((response.data.messages || []).reverse());
      
      // Mark as read
      api.chat.markRead(convoId);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo || sending) return;

    try {
      setSending(true);
      const response = await api.chat.sendMessage(selectedConvo.id, newMessage.trim());

      if (!response.success) {
        throw new Error(response.error || "Failed to send message");
      }

      setNewMessage("");
      // Refresh messages
      fetchMessages(selectedConvo.id);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const getOtherMember = (convo: Convo): ConvoMember | undefined => {
    return convo.members.find(m => m.did !== profile?.did);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen">
      {/* Conversations list */}
      <div className={`${selectedConvo ? "hidden md:flex" : "flex"} flex-col w-full md:w-[320px] border-r border-[#2f3e4e]`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2f3e4e] bg-[#0f1a2a] sticky top-0 z-10">
          <h1 className="text-[19px] font-extrabold text-white">Chat</h1>
        </div>

        {/* Convos list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[#e0245e] mb-4">{error}</p>
            <button onClick={fetchConvos} className="text-[#0085ff] hover:underline font-bold">
              Try again
            </button>
          </div>
        ) : convos.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-[#2f3e4e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-[#8899a6] text-lg">No conversations yet</p>
            <p className="text-[#8899a6] text-sm mt-1">Start a chat from someone's profile</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {convos.map((convo) => {
              const other = getOtherMember(convo);
              if (!other) return null;

              return (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1c2938] transition-colors text-left ${
                    selectedConvo?.id === convo.id ? "bg-[#1c2938]" : ""
                  }`}
                >
                  <img
                    src={other.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${other.handle}`}
                    alt={other.displayName || other.handle}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate">
                        {other.displayName || other.handle}
                      </span>
                      {convo.lastMessage && (
                        <span className="text-xs text-[#8899a6]">
                          {formatDate(convo.lastMessage.sentAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[#8899a6] truncate flex-1">
                        {convo.lastMessage?.text || "No messages yet"}
                      </p>
                      {convo.unreadCount > 0 && (
                        <span className="bg-[#0085ff] text-white text-xs px-2 py-0.5 rounded-full">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Messages view */}
      <div className={`${selectedConvo ? "flex" : "hidden md:flex"} flex-col flex-1 bg-[#0a1627]`}>
        {selectedConvo ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-[#2f3e4e] bg-[#0f1a2a] flex items-center gap-3">
              <button
                onClick={() => setSelectedConvo(null)}
                className="md:hidden p-2 -ml-2 rounded-full hover:bg-[#1c2938] transition"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {(() => {
                const other = getOtherMember(selectedConvo);
                if (!other) return null;
                return (
                  <Link to={`/profile/${other.handle}`} className="flex items-center gap-3 hover:opacity-80 transition">
                    <img
                      src={other.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${other.handle}`}
                      alt={other.displayName || other.handle}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="font-bold text-white">{other.displayName || other.handle}</p>
                      <p className="text-sm text-[#8899a6]">@{other.handle}</p>
                    </div>
                  </Link>
                );
              })()}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-[#8899a6]">
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMe = message.sender.did === profile?.did;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                          isMe
                            ? "bg-[#0085ff] text-white rounded-br-md"
                            : "bg-[#1c2938] text-white rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.text}</p>
                        <p className={`text-xs mt-1 ${isMe ? "text-white/70" : "text-[#8899a6]"}`}>
                          {formatDate(message.sentAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-[#2f3e4e] bg-[#0f1a2a]">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write a message..."
                  className="flex-1 bg-[#1c2938] text-white placeholder-[#8899a6] px-4 py-3 rounded-full border border-[#2f3e4e] focus:border-[#0085ff] focus:outline-none transition"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-[#0085ff] hover:bg-[#0070db] text-white p-3 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#8899a6]">
            <div className="text-center">
              <svg className="w-20 h-20 mx-auto mb-4 text-[#2f3e4e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg">Select a conversation</p>
              <p className="text-sm mt-1">Choose from your existing conversations</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
