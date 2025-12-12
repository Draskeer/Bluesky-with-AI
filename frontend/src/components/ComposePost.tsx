import { useState } from "react";
import { useAuthStore } from "../store/auth.store";
import { api } from "../services/api";
import type { BlueskyPost } from "../types";

interface ComposePostProps {
  onPostCreated?: () => void;
  replyTo?: BlueskyPost;
  onClose?: () => void;
  autoFocus?: boolean;
}

export default function ComposePost({ onPostCreated, replyTo, onClose, autoFocus }: ComposePostProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { profile } = useAuthStore();

  const maxLength = 300;
  const remaining = maxLength - text.length;
  const progress = (text.length / maxLength) * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await api.feed.createPost(text.trim(), replyTo ? {
        uri: replyTo.uri,
        cid: replyTo.cid,
        rootUri: (replyTo.record as any)?.reply?.root?.uri || replyTo.uri,
        rootCid: (replyTo.record as any)?.reply?.root?.cid || replyTo.cid,
      } : undefined);

      if (!response.success) {
        throw new Error(response.error || "Erreur lors de la publication");
      }

      setText("");
      onPostCreated?.();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`px-4 py-3 ${!replyTo ? 'border-b border-[#e6ecf0] dark:border-[#38444d]' : ''} bg-white dark:bg-[#15202b]`}>
      {/* Reply context */}
      {replyTo && (
        <div className="mb-3 pb-3 border-b border-[#e6ecf0] dark:border-[#38444d]">
          <div className="flex gap-3">
            <img
              src={replyTo.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${replyTo.author.handle}`}
              alt={replyTo.author.displayName || replyTo.author.handle}
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[14px]">
                <span className="font-bold text-[#14171a] dark:text-[#d9d9d9] truncate">
                  {replyTo.author.displayName || replyTo.author.handle}
                </span>
                <span className="text-[#657786] dark:text-[#8899a6] truncate">
                  @{replyTo.author.handle}
                </span>
              </div>
              <p className="text-[14px] text-[#14171a] dark:text-[#d9d9d9] line-clamp-2">
                {replyTo.record.text}
              </p>
            </div>
          </div>
          <p className="text-[13px] text-[#657786] dark:text-[#8899a6] mt-2 ml-[52px]">
            En réponse à <span className="text-[#1da1f2]">@{replyTo.author.handle}</span>
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <img
            src={profile?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.handle || "user"}`}
            alt="Votre avatar"
            className="w-12 h-12 rounded-full"
          />

          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyTo ? "Tweeter votre réponse" : "Quoi de neuf ?"}
              className="w-full resize-none border-0 focus:ring-0 text-[19px] text-[#14171a] dark:text-[#d9d9d9] placeholder:text-[#657786] dark:placeholder:text-[#8899a6] outline-none leading-6 py-2 bg-transparent"
              rows={replyTo ? 3 : 2}
              maxLength={maxLength}
              autoFocus={autoFocus}
            />

            {error && (
              <div className="text-[#e0245e] text-sm mb-2">{error}</div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#e6ecf0] dark:border-[#38444d]">
              {/* Actions icons */}
              <div className="flex items-center gap-1 text-[#1da1f2]">
                <button type="button" className="p-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.75 2H4.25C3.01 2 2 3.01 2 4.25v15.5C2 20.99 3.01 22 4.25 22h15.5c1.24 0 2.25-1.01 2.25-2.25V4.25C22 3.01 20.99 2 19.75 2zM4.25 3.5h15.5c.413 0 .75.337.75.75v9.676l-3.858-3.858c-.14-.14-.33-.22-.53-.22h-.003c-.2 0-.393.08-.532.224l-4.317 4.384-1.813-1.806c-.14-.14-.33-.22-.53-.22-.193-.03-.395.08-.535.227L3.5 17.642V4.25c0-.413.337-.75.75-.75zm-.744 16.28l5.418-5.534 6.282 6.254H4.25c-.402 0-.727-.322-.744-.72zm16.244.72h-2.42l-5.007-4.987 3.792-3.85 4.385 4.384v3.703c0 .413-.337.75-.75.75z"/>
                    <circle cx="8.868" cy="8.309" r="1.542"/>
                  </svg>
                </button>
                <button type="button" className="p-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 10.5V8.8h-4.4v6.4h1.7v-2h2v-1.7h-2v-1H19zm-7.3-1.7h1.7v6.4h-1.7V8.8zm-3.6 1.6c.4 0 .9.2 1.2.5l1.2-1C9.9 9.2 9 8.8 8.1 8.8c-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2c1 0 1.8-.4 2.4-1.1v-2.5H7.7v1.2h1.2v.6c-.2.1-.5.2-.8.2-.9 0-1.6-.7-1.6-1.6 0-.8.7-1.6 1.6-1.6z"/>
                  </svg>
                </button>
                <button type="button" className="p-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 22.75C6.072 22.75 1.25 17.928 1.25 12S6.072 1.25 12 1.25 22.75 6.072 22.75 12 17.928 22.75 12 22.75zm0-20C6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25s9.25-4.15 9.25-9.25S17.1 2.75 12 2.75z"/>
                    <path d="M12 17.115c-1.892 0-3.633-.95-4.656-2.544-.224-.348-.123-.81.226-1.035.348-.226.812-.124 1.036.226.747 1.162 2.016 1.855 3.395 1.855s2.648-.693 3.396-1.854c.224-.35.688-.45 1.036-.225.35.224.45.688.226 1.036-1.025 1.594-2.766 2.545-4.658 2.545z"/>
                    <circle cx="14.738" cy="9.458" r="1.478"/>
                    <circle cx="9.262" cy="9.458" r="1.478"/>
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Character counter */}
                {text.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5">
                      <svg className="w-5 h-5 -rotate-90">
                        <circle
                          cx="10"
                          cy="10"
                          r="8"
                          fill="none"
                          className="stroke-[#e6ecf0] dark:stroke-[#38444d]"
                          strokeWidth="2"
                        />
                        <circle
                          cx="10"
                          cy="10"
                          r="8"
                          fill="none"
                          stroke={remaining < 20 ? (remaining < 0 ? "#e0245e" : "#ffad1f") : "#1da1f2"}
                          strokeWidth="2"
                          strokeDasharray={`${progress * 0.502} 100`}
                        />
                      </svg>
                    </div>
                    {remaining <= 20 && (
                      <span className={`text-sm ${remaining < 0 ? "text-[#e0245e]" : "text-[#657786]"}`}>
                        {remaining}
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!text.trim() || loading || remaining < 0}
                  className="bg-[#1da1f2] hover:bg-[#1a91da] text-white font-bold px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed text-[15px]"
                >
                  {loading ? "Envoi..." : replyTo ? "Répondre" : "Tweeter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
