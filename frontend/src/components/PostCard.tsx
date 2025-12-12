import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import ComposePost from "./ComposePost";
import type { BlueskyPost, BlueskyProfile } from "../types";

interface PostCardProps {
  post: BlueskyPost;
  reason?: {
    $type: string;
    by?: BlueskyProfile;
    indexedAt?: string;
  };
  isReply?: boolean;
  showReplyTo?: BlueskyPost;
  onReplyPosted?: () => void;
}

export default function PostCard({ post, reason, isReply, showReplyTo, onReplyPosted }: PostCardProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(!!post.viewer?.like);
  const [likeUri, setLikeUri] = useState(post.viewer?.like || "");
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [reposted, setReposted] = useState(!!post.viewer?.repost);
  const [repostUri, setRepostUri] = useState(post.viewer?.repost || "");
  const [repostCount, setRepostCount] = useState(post.repostCount || 0);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyCount, setReplyCount] = useState(post.replyCount || 0);

  const isRepost = reason?.$type === "app.bsky.feed.defs#reasonRepost";
  const repostBy = isRepost ? reason?.by : null;

  const handlePostClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) {
      return;
    }
    navigate(`/post/${encodeURIComponent(post.uri)}`);
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowReplyModal(true);
  };

  const handleReplyPosted = () => {
    setReplyCount((c) => c + 1);
    setShowReplyModal(false);
    onReplyPosted?.();
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (liked && likeUri) {
        const response = await api.feed.unlike(likeUri);
        if (response.success) {
          setLiked(false);
          setLikeUri("");
          setLikeCount((c) => c - 1);
        }
      } else {
        const response = await api.feed.like(post.uri, post.cid);
        if (response.success && response.data) {
          setLiked(true);
          setLikeUri(response.data.uri);
          setLikeCount((c) => c + 1);
        }
      }
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (reposted && repostUri) {
        const response = await api.feed.unrepost(repostUri);
        if (response.success) {
          setReposted(false);
          setRepostUri("");
          setRepostCount((c) => c - 1);
        }
      } else {
        const response = await api.feed.repost(post.uri, post.cid);
        if (response.success && response.data) {
          setReposted(true);
          setRepostUri(response.data.uri);
          setRepostCount((c) => c + 1);
        }
      }
    } catch (err) {
      console.error("Repost error:", err);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Construct Bluesky URL from URI
    const uriParts = post.uri.split("/");
    const handle = post.author.handle;
    const rkey = uriParts[uriParts.length - 1];
    const bskyUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;
    
    try {
      await navigator.clipboard.writeText(bskyUrl);
      // Could add a toast notification here
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "à l'instant";
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  // Render quote tweet embed
  const renderQuoteEmbed = () => {
    const quotedPost = post.embed?.record?.record || post.embed?.record;
    if (!quotedPost?.author) return null;

    return (
      <div 
        className="mt-3 border border-[#e6ecf0] dark:border-[#38444d] rounded-2xl overflow-hidden hover:bg-[#f5f8fa] dark:hover:bg-[#192734] transition cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          if (quotedPost.uri) {
            navigate(`/post/${encodeURIComponent(quotedPost.uri)}`);
          }
        }}
      >
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <img
              src={quotedPost.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${quotedPost.author.handle}`}
              alt={quotedPost.author.displayName || quotedPost.author.handle}
              className="w-5 h-5 rounded-full"
            />
            <span className="font-bold text-[13px] text-[#14171a] dark:text-[#d9d9d9]">
              {quotedPost.author.displayName || quotedPost.author.handle}
            </span>
            <span className="text-[#657786] dark:text-[#8899a6] text-[13px]">
              @{quotedPost.author.handle}
            </span>
          </div>
          <p className="text-[14px] text-[#14171a] dark:text-[#d9d9d9]">
            {quotedPost.value?.text || quotedPost.text || ""}
          </p>
        </div>
      </div>
    );
  };

  // Render external link embed
  const renderExternalEmbed = () => {
    const external = post.embed?.external;
    if (!external) return null;

    return (
      <a
        href={external.uri}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 border border-[#e6ecf0] dark:border-[#38444d] rounded-2xl overflow-hidden block hover:bg-[#f5f8fa] dark:hover:bg-[#192734] transition"
        onClick={(e) => e.stopPropagation()}
      >
        {external.thumb && (
          <img
            src={external.thumb}
            alt={external.title}
            className="w-full h-[200px] object-cover"
          />
        )}
        <div className="p-3">
          <p className="text-[#657786] dark:text-[#8899a6] text-[13px] truncate">{new URL(external.uri).hostname}</p>
          <p className="font-bold text-[15px] text-[#14171a] dark:text-[#d9d9d9] mt-1">{external.title}</p>
          {external.description && (
            <p className="text-[#657786] dark:text-[#8899a6] text-[14px] mt-1 line-clamp-2">{external.description}</p>
          )}
        </div>
      </a>
    );
  };

  const hasQuoteEmbed = post.embed?.$type === "app.bsky.embed.record#view" || 
                        post.embed?.$type === "app.bsky.embed.recordWithMedia#view";
  const hasExternalEmbed = post.embed?.$type === "app.bsky.embed.external#view";

  // For retweets, render the original post embedded below
  if (isRepost && repostBy) {
    return (
      <article 
        onClick={handlePostClick}
        className="px-4 py-3 border-b border-[#e6ecf0] dark:border-[#38444d] bg-white dark:bg-[#15202b] hover:bg-[#f5f8fa] dark:hover:bg-[#192734] transition-colors cursor-pointer"
      >
        {/* Repost header */}
        <div className="flex items-center gap-3 mb-3 ml-6">
          <svg className="w-4 h-4 text-[#657786] dark:text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <Link 
            to={`/profile/${repostBy.handle}`}
            className="text-[13px] text-[#657786] dark:text-[#8899a6] hover:underline font-bold flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={repostBy.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${repostBy.handle}`}
              alt={repostBy.displayName || repostBy.handle}
              className="w-4 h-4 rounded-full"
            />
            {repostBy.displayName || repostBy.handle} a retweeté
          </Link>
        </div>

        {/* Original post as embedded card */}
        <div className="border border-[#e6ecf0] dark:border-[#38444d] rounded-2xl overflow-hidden">
          <div className="p-3">
            <div className="flex gap-3">
              {/* Avatar */}
              <Link to={`/profile/${post.author.handle}`} className="flex-shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
                <img
                  src={post.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.handle}`}
                  alt={post.author.displayName || post.author.handle}
                  className="w-10 h-10 rounded-full hover:opacity-90 transition"
                />
              </Link>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-1 text-[14px] flex-wrap">
                  <Link
                    to={`/profile/${post.author.handle}`}
                    className="font-bold text-[#14171a] dark:text-[#d9d9d9] hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {post.author.displayName || post.author.handle}
                  </Link>
                  <span className="text-[#657786] dark:text-[#8899a6] truncate">
                    @{post.author.handle}
                  </span>
                  <span className="text-[#657786] dark:text-[#8899a6]">·</span>
                  <span className="text-[#657786] dark:text-[#8899a6]">
                    {formatDate(post.record.createdAt)}
                  </span>
                </div>

                {/* Content */}
                <p className="mt-1 text-[15px] text-[#14171a] dark:text-[#d9d9d9] whitespace-pre-wrap break-words leading-5">
                  {post.record.text}
                </p>

                {/* Images */}
                {post.embed?.images && post.embed.images.length > 0 && (
                  <div className={`mt-3 rounded-xl overflow-hidden border border-[#e6ecf0] dark:border-[#38444d] ${
                    post.embed.images.length > 1 ? "grid grid-cols-2 gap-0.5" : ""
                  }`}>
                    {post.embed.images.map((img: any, idx: number) => (
                      <img
                        key={idx}
                        src={img.thumb || img.fullsize}
                        alt={img.alt || "Image"}
                        className="w-full object-cover max-h-[200px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(img.fullsize || img.thumb, "_blank");
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Quote embed */}
                {hasQuoteEmbed && renderQuoteEmbed()}

                {/* External link embed */}
                {hasExternalEmbed && renderExternalEmbed()}
              </div>
            </div>
          </div>

          {/* Actions inside the card */}
          <div className="flex items-center justify-around px-3 py-2 border-t border-[#e6ecf0] dark:border-[#38444d] text-[#657786] dark:text-[#8899a6]">
            {/* Reply */}
            <button className="flex items-center gap-2 group" onClick={handleReply}>
              <div className="p-2 rounded-full group-hover:bg-[#e8f5fe] dark:group-hover:bg-[#1da1f2]/10 group-hover:text-[#1da1f2] transition">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-[13px] group-hover:text-[#1da1f2]">{replyCount || ""}</span>
            </button>

            {/* Retweet */}
            <button
              onClick={handleRepost}
              className={`flex items-center gap-2 group ${reposted ? "text-[#17bf63]" : ""}`}
            >
              <div className={`p-2 rounded-full transition ${
                reposted ? "text-[#17bf63]" : "group-hover:bg-[#e6f7ed] dark:group-hover:bg-[#17bf63]/10 group-hover:text-[#17bf63]"
              }`}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className={`text-[13px] ${reposted ? "text-[#17bf63]" : "group-hover:text-[#17bf63]"}`}>
                {repostCount || ""}
              </span>
            </button>

            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 group ${liked ? "text-[#e0245e]" : ""}`}
            >
              <div className={`p-2 rounded-full transition ${
                liked ? "text-[#e0245e]" : "group-hover:bg-[#fce8ef] dark:group-hover:bg-[#e0245e]/10 group-hover:text-[#e0245e]"
              }`}>
                <svg
                  className="w-[18px] h-[18px]"
                  fill={liked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className={`text-[13px] ${liked ? "text-[#e0245e]" : "group-hover:text-[#e0245e]"}`}>
                {likeCount || ""}
              </span>
            </button>

            {/* Share */}
            <button className="flex items-center group" onClick={handleShare}>
              <div className="p-2 rounded-full group-hover:bg-[#e8f5fe] dark:group-hover:bg-[#1da1f2]/10 group-hover:text-[#1da1f2] transition">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        {/* Reply Modal for repost card */}
        {showReplyModal && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowReplyModal(false);
            }}
          >
            <div className="bg-white dark:bg-[#15202b] rounded-2xl w-full max-w-[600px] mx-4 shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-[#e6ecf0] dark:border-[#38444d]">
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="p-2 -ml-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition"
                >
                  <svg className="w-5 h-5 text-[#1da1f2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <span className="font-bold text-[#14171a] dark:text-[#d9d9d9]">Répondre</span>
                <div className="w-9"></div>
              </div>
              <ComposePost 
                replyTo={post} 
                onPostCreated={handleReplyPosted}
                onClose={() => setShowReplyModal(false)}
                autoFocus
              />
            </div>
          </div>
        )}
      </article>
    );
  }

  // Regular post (not a retweet)
  return (
    <article 
      onClick={handlePostClick}
      className="px-4 py-3 border-b border-[#e6ecf0] dark:border-[#38444d] bg-white dark:bg-[#15202b] hover:bg-[#f5f8fa] dark:hover:bg-[#192734] transition-colors cursor-pointer"
    >
      {/* Reply indicator */}
      {showReplyTo && (
        <div className="flex items-center gap-2 mb-2 ml-6">
          <span className="text-[13px] text-[#657786] dark:text-[#8899a6]">
            En réponse à{" "}
            <Link
              to={`/profile/${showReplyTo.author.handle}`}
              className="text-[#1da1f2] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              @{showReplyTo.author.handle}
            </Link>
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <Link to={`/profile/${post.author.handle}`} className="flex-shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
          <img
            src={post.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.handle}`}
            alt={post.author.displayName || post.author.handle}
            className="w-12 h-12 rounded-full hover:opacity-90 transition"
          />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-1 text-[15px] flex-wrap">
            <Link
              to={`/profile/${post.author.handle}`}
              className="font-bold text-[#14171a] dark:text-[#d9d9d9] hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {post.author.displayName || post.author.handle}
            </Link>
            <span className="text-[#657786] dark:text-[#8899a6] truncate">
              @{post.author.handle}
            </span>
            <span className="text-[#657786] dark:text-[#8899a6]">·</span>
            <span className="text-[#657786] dark:text-[#8899a6] hover:underline">
              {formatDate(post.record.createdAt)}
            </span>
          </div>

          {/* Reply context in header */}
          {post.record.reply && !showReplyTo && (
            <p className="text-[13px] text-[#657786] dark:text-[#8899a6] mt-0.5">
              En réponse à un tweet
            </p>
          )}

          {/* Content */}
          <p className="mt-1 text-[15px] text-[#14171a] dark:text-[#d9d9d9] whitespace-pre-wrap break-words leading-5">
            {post.record.text}
          </p>

          {/* Images */}
          {post.embed?.images && post.embed.images.length > 0 && (
            <div className={`mt-3 rounded-2xl overflow-hidden border border-[#e6ecf0] dark:border-[#38444d] ${
              post.embed.images.length > 1 ? "grid grid-cols-2 gap-0.5" : ""
            }`}>
              {post.embed.images.map((img: any, idx: number) => (
                <img
                  key={idx}
                  src={img.thumb || img.fullsize}
                  alt={img.alt || "Image"}
                  className="w-full object-cover max-h-[285px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(img.fullsize || img.thumb, "_blank");
                  }}
                />
              ))}
            </div>
          )}

          {/* Quote embed */}
          {hasQuoteEmbed && renderQuoteEmbed()}

          {/* External link embed */}
          {hasExternalEmbed && renderExternalEmbed()}

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 max-w-[425px] text-[#657786] dark:text-[#8899a6]">
            {/* Reply */}
            <button className="flex items-center gap-2 group" onClick={handleReply}>
              <div className="p-2 rounded-full group-hover:bg-[#e8f5fe] dark:group-hover:bg-[#1da1f2]/10 group-hover:text-[#1da1f2] transition">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="text-[13px] group-hover:text-[#1da1f2]">{replyCount || ""}</span>
            </button>

            {/* Retweet */}
            <button
              onClick={handleRepost}
              className={`flex items-center gap-2 group ${reposted ? "text-[#17bf63]" : ""}`}
            >
              <div className={`p-2 rounded-full transition ${
                reposted ? "text-[#17bf63]" : "group-hover:bg-[#e6f7ed] dark:group-hover:bg-[#17bf63]/10 group-hover:text-[#17bf63]"
              }`}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className={`text-[13px] ${reposted ? "text-[#17bf63]" : "group-hover:text-[#17bf63]"}`}>
                {repostCount || ""}
              </span>
            </button>

            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 group ${liked ? "text-[#e0245e]" : ""}`}
            >
              <div className={`p-2 rounded-full transition ${
                liked ? "text-[#e0245e]" : "group-hover:bg-[#fce8ef] dark:group-hover:bg-[#e0245e]/10 group-hover:text-[#e0245e]"
              }`}>
                <svg
                  className="w-[18px] h-[18px]"
                  fill={liked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className={`text-[13px] ${liked ? "text-[#e0245e]" : "group-hover:text-[#e0245e]"}`}>
                {likeCount || ""}
              </span>
            </button>

            {/* Share */}
            <button className="flex items-center group" onClick={handleShare}>
              <div className="p-2 rounded-full group-hover:bg-[#e8f5fe] dark:group-hover:bg-[#1da1f2]/10 group-hover:text-[#1da1f2] transition">
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Reply Modal */}
      {showReplyModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReplyModal(false);
          }}
        >
          <div className="bg-white dark:bg-[#15202b] rounded-2xl w-full max-w-[600px] mx-4 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-[#e6ecf0] dark:border-[#38444d]">
              <button
                onClick={() => setShowReplyModal(false)}
                className="p-2 -ml-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition"
              >
                <svg className="w-5 h-5 text-[#1da1f2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="font-bold text-[#14171a] dark:text-[#d9d9d9]">Répondre</span>
              <div className="w-9"></div>
            </div>
            <ComposePost 
              replyTo={post} 
              onPostCreated={handleReplyPosted}
              onClose={() => setShowReplyModal(false)}
              autoFocus
            />
          </div>
        </div>
      )}
    </article>
  );
}
