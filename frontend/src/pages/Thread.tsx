import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import type { BlueskyPost } from "../types";

interface ThreadPost {
  post: BlueskyPost;
  parent?: ThreadPost;
  replies?: ThreadPost[];
}

export default function Thread() {
  const { "*": uriPath } = useParams();
  const uri = uriPath ? decodeURIComponent(uriPath) : null;
  const [thread, setThread] = useState<ThreadPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchThread = async () => {
      if (!uri) return;

      try {
        setLoading(true);
        setError("");
        
        const response = await api.feed.getThread(uri);
        
        if (!response.success || !response.data) {
          throw new Error(response.error || "Thread introuvable");
        }
        
        setThread(response.data.thread);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [uri]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Render a single reply
  const renderReply = (reply: ThreadPost, depth: number = 0) => {
    const post = reply.post;
    if (!post) return null;

    return (
      <div key={post.uri} className={depth > 0 ? "ml-12 border-l-2 border-[#e6ecf0] dark:border-[#38444d]" : ""}>
        <article className="px-4 py-3 border-b border-[#e6ecf0] dark:border-[#38444d] hover:bg-[#f5f8fa] dark:hover:bg-[#192734] transition-colors">
          <div className="flex gap-3">
            <Link to={`/profile/${post.author.handle}`} className="flex-shrink-0">
              <img
                src={post.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.handle}`}
                alt={post.author.displayName || post.author.handle}
                className="w-12 h-12 rounded-full hover:opacity-90 transition"
              />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[15px]">
                <Link
                  to={`/profile/${post.author.handle}`}
                  className="font-bold text-[#14171a] dark:text-[#d9d9d9] hover:underline truncate"
                >
                  {post.author.displayName || post.author.handle}
                </Link>
                <span className="text-[#657786] dark:text-[#8899a6] truncate">@{post.author.handle}</span>
              </div>

              <p className="mt-1 text-[15px] text-[#14171a] dark:text-[#d9d9d9] whitespace-pre-wrap break-words">
                {post.record.text}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-8 mt-3 text-[#657786] dark:text-[#8899a6]">
                <span className="flex items-center gap-2 text-[13px]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {post.replyCount || 0}
                </span>
                <span className="flex items-center gap-2 text-[13px]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {post.repostCount || 0}
                </span>
                <span className="flex items-center gap-2 text-[13px]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {post.likeCount || 0}
                </span>
              </div>
            </div>
          </div>
        </article>

        {/* Nested replies */}
        {reply.replies && reply.replies.length > 0 && (
          <div>
            {reply.replies.map((r) => renderReply(r, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1da1f2]"></div>
      </div>
    );
  }

  if (error || !thread || !thread.post) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[#e0245e] mb-4">{error || "Thread introuvable"}</p>
        <Link to="/" className="text-[#1da1f2] hover:underline font-bold">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const mainPost = thread.post;

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2f3e4e] bg-[#0f1a2a] sticky top-0 z-10 flex items-center gap-4">
        <Link to="/" className="p-2 rounded-full hover:bg-[#1c2938] transition">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-[19px] font-extrabold text-white">Post</h1>
      </div>

      {/* Parent posts (if replying to something) */}
      {thread.parent && thread.parent.post && (
        <div className="border-b border-[#e6ecf0] dark:border-[#38444d]">
          {renderParentChain(thread.parent)}
        </div>
      )}

      {/* Main Post - Expanded view */}
      <article className="px-4 py-3 border-b border-[#e6ecf0] dark:border-[#38444d]">
        <div className="flex gap-3">
          <Link to={`/profile/${mainPost.author.handle}`}>
            <img
              src={mainPost.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${mainPost.author.handle}`}
              alt={mainPost.author.displayName || mainPost.author.handle}
              className="w-12 h-12 rounded-full hover:opacity-90 transition"
            />
          </Link>

          <div className="flex-1">
            <Link to={`/profile/${mainPost.author.handle}`} className="block">
              <span className="font-bold text-[15px] text-[#14171a] dark:text-[#d9d9d9] hover:underline">
                {mainPost.author.displayName || mainPost.author.handle}
              </span>
              <span className="block text-[15px] text-[#657786] dark:text-[#8899a6]">@{mainPost.author.handle}</span>
            </Link>
          </div>
        </div>

        {/* Main post content - larger */}
        <p className="mt-3 text-[23px] text-[#14171a] dark:text-[#d9d9d9] whitespace-pre-wrap break-words leading-7">
          {mainPost.record.text}
        </p>

        {/* Images */}
        {mainPost.embed?.images && mainPost.embed.images.length > 0 && (
          <div className={`mt-3 rounded-2xl overflow-hidden border border-[#e6ecf0] dark:border-[#38444d] ${
            mainPost.embed.images.length > 1 ? "grid grid-cols-2 gap-0.5" : ""
          }`}>
            {mainPost.embed.images.map((img: any, idx: number) => (
              <img
                key={idx}
                src={img.thumb || img.fullsize}
                alt={img.alt || "Image"}
                className="w-full object-cover max-h-[400px]"
              />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-4 text-[15px] text-[#657786] dark:text-[#8899a6] border-b border-[#e6ecf0] dark:border-[#38444d] pb-3">
          {formatDate(mainPost.record.createdAt)}
        </div>

        {/* Stats */}
        <div className="py-3 border-b border-[#e6ecf0] dark:border-[#38444d] flex gap-5 text-[15px]">
          <span>
            <strong className="text-[#14171a] dark:text-[#d9d9d9]">{mainPost.repostCount || 0}</strong>{" "}
            <span className="text-[#657786] dark:text-[#8899a6]">Retweets</span>
          </span>
          <span>
            <strong className="text-[#14171a] dark:text-[#d9d9d9]">{mainPost.likeCount || 0}</strong>{" "}
            <span className="text-[#657786] dark:text-[#8899a6]">J'aime</span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="py-2 flex justify-around text-[#657786] dark:text-[#8899a6]">
          <button className="p-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 hover:text-[#1da1f2] transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button className="p-2 rounded-full hover:bg-[#e6f7ed] dark:hover:bg-[#17bf63]/10 hover:text-[#17bf63] transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button className="p-2 rounded-full hover:bg-[#fce8ef] dark:hover:bg-[#e0245e]/10 hover:text-[#e0245e] transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <button className="p-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 hover:text-[#1da1f2] transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
        </div>
      </article>

      {/* Replies */}
      {thread.replies && thread.replies.length > 0 && (
        <div>
          <div className="px-4 py-3 border-b border-[#e6ecf0] dark:border-[#38444d]">
            <span className="text-[15px] font-bold text-[#14171a] dark:text-[#d9d9d9]">
              {thread.replies.length} réponse{thread.replies.length > 1 ? "s" : ""}
            </span>
          </div>
          {thread.replies.map((reply) => renderReply(reply))}
        </div>
      )}

      {/* No replies */}
      {(!thread.replies || thread.replies.length === 0) && (
        <div className="px-4 py-12 text-center text-[#657786] dark:text-[#8899a6]">
          <p>Aucune réponse pour le moment</p>
          <p className="mt-1 text-sm">Soyez le premier à répondre !</p>
        </div>
      )}
    </div>
  );
}

// Helper to render parent chain
function renderParentChain(parent: ThreadPost): JSX.Element | null {
  if (!parent || !parent.post) return null;

  const post = parent.post;

  return (
    <>
      {parent.parent && renderParentChain(parent.parent)}
      <article className="px-4 py-3 hover:bg-[#f5f8fa] dark:hover:bg-[#192734] transition-colors">
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <Link to={`/profile/${post.author.handle}`}>
              <img
                src={post.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.handle}`}
                alt={post.author.displayName || post.author.handle}
                className="w-12 h-12 rounded-full hover:opacity-90 transition"
              />
            </Link>
            <div className="w-0.5 flex-1 bg-[#ccd6dd] dark:bg-[#38444d] mt-2"></div>
          </div>

          <div className="flex-1 min-w-0 pb-3">
            <div className="flex items-center gap-1 text-[15px]">
              <Link
                to={`/profile/${post.author.handle}`}
                className="font-bold text-[#14171a] dark:text-[#d9d9d9] hover:underline truncate"
              >
                {post.author.displayName || post.author.handle}
              </Link>
              <span className="text-[#657786] dark:text-[#8899a6] truncate">@{post.author.handle}</span>
            </div>

            <p className="mt-1 text-[15px] text-[#14171a] dark:text-[#d9d9d9] whitespace-pre-wrap break-words">
              {post.record.text}
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
