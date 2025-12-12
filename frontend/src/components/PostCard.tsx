import { useState, useRef, useEffect } from "react";
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

export default function PostCard({ post, reason, showReplyTo, onReplyPosted }: PostCardProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(!!post.viewer?.like);
  const [likeUri, setLikeUri] = useState(post.viewer?.like || "");
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [reposted, setReposted] = useState(!!post.viewer?.repost);
  const [repostUri, setRepostUri] = useState(post.viewer?.repost || "");
  const [repostCount, setRepostCount] = useState(post.repostCount || 0);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyCount, setReplyCount] = useState(post.replyCount || 0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const isRepost = reason?.$type === "app.bsky.feed.defs#reasonRepost";
  const repostBy = isRepost ? reason?.by : null;

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check if post is saved
  useEffect(() => {
    const checkSaved = async () => {
      try {
        const response = await api.saved.checkSaved(post.uri);
        if (response.success && response.data) {
          setSaved(response.data.saved);
        }
      } catch (err) {
        // Ignore
      }
    };
    checkSaved();
  }, [post.uri]);

  const showNotification = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handlePostClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button") || target.closest("[data-menu]")) {
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

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (saved) {
        await api.saved.unsavePost(post.uri);
        setSaved(false);
        showNotification("Retiré des enregistrements");
      } else {
        await api.saved.savePost(post.uri);
        setSaved(true);
        showNotification("Ajouté aux enregistrements");
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const getBskyUrl = () => {
    const uriParts = post.uri.split("/");
    const handle = post.author.handle;
    const rkey = uriParts[uriParts.length - 1];
    return `https://bsky.app/profile/${handle}/post/${rkey}`;
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(getBskyUrl());
      showNotification("Lien copié !");
      setShowShareMenu(false);
    } catch (err) {
      console.error("Copy error:", err);
    }
  };

  const handleShareNative = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post de @${post.author.handle}`,
          text: post.record.text?.substring(0, 100) || "",
          url: getBskyUrl(),
        });
      } catch (err) {
        // User cancelled
      }
    }
    setShowShareMenu(false);
  };

  const handleCopyText = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(post.record.text || "");
      showNotification("Texte copié !");
      setShowMoreMenu(false);
    } catch (err) {
      console.error("Copy text error:", err);
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
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Get images from post or quote
  const getPostImages = () => {
    // Direct images
    if (post.embed?.images && post.embed.images.length > 0) {
      return post.embed.images;
    }
    // Images from recordWithMedia (quote tweet with images)
    if (post.embed?.media?.images && post.embed.media.images.length > 0) {
      return post.embed.media.images;
    }
    return [];
  };

  // Render quote tweet embed
  const renderQuoteEmbed = () => {
    const quotedPost = post.embed?.record?.record || post.embed?.record;
    if (!quotedPost?.author) return null;

    // Get images from the quoted post - check multiple possible locations
    let quotedImages: any[] = [];
    
    // Check embeds array (most common for record#view)
    if (quotedPost.embeds && quotedPost.embeds.length > 0) {
      const firstEmbed = quotedPost.embeds[0];
      if (firstEmbed?.images) {
        quotedImages = firstEmbed.images;
      } else if (firstEmbed?.media?.images) {
        quotedImages = firstEmbed.media.images;
      }
    }
    
    // Check direct embed property
    if (quotedImages.length === 0 && quotedPost.embed?.images) {
      quotedImages = quotedPost.embed.images;
    }
    
    // Check value.embed for older format
    if (quotedImages.length === 0 && quotedPost.value?.embed?.images) {
      quotedImages = quotedPost.value.embed.images;
    }

    return (
      <div 
        className="mt-3 border border-[#2f3e4e] rounded-xl overflow-hidden hover:bg-[#1c2938]/50 transition cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          if (quotedPost.uri) {
            navigate(`/post/${encodeURIComponent(quotedPost.uri)}`);
          }
        }}
      >
        {/* Quoted post images - displayed at top if present */}
        {quotedImages.length > 0 && (
          <div className={`${quotedImages.length > 1 ? "grid grid-cols-2 gap-0.5" : ""}`}>
            {quotedImages.map((img: any, idx: number) => (
              <img
                key={idx}
                src={img.thumb || img.fullsize}
                alt={img.alt || "Image"}
                className="w-full object-cover max-h-[200px]"
              />
            ))}
          </div>
        )}
        
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <img
              src={quotedPost.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${quotedPost.author.handle}`}
              alt={quotedPost.author.displayName || quotedPost.author.handle}
              className="w-5 h-5 rounded-full"
            />
            <span className="font-semibold text-[13px] text-white truncate">
              {quotedPost.author.displayName || quotedPost.author.handle}
            </span>
            <span className="text-gray-500 text-[13px] truncate">
              @{quotedPost.author.handle}
            </span>
          </div>
          {(quotedPost.value?.text || quotedPost.text) && (
            <p className="text-[14px] text-gray-200 whitespace-pre-wrap break-words">
              {quotedPost.value?.text || quotedPost.text}
            </p>
          )}
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
        className="mt-3 border border-[#2f3e4e] rounded-xl overflow-hidden block hover:bg-[#1c2938]/50 transition"
        onClick={(e) => e.stopPropagation()}
      >
        {external.thumb && (
          <img
            src={external.thumb}
            alt={external.title}
            className="w-full h-[180px] object-cover"
          />
        )}
        <div className="p-3">
          <p className="text-gray-500 text-xs truncate">{new URL(external.uri).hostname}</p>
          <p className="font-semibold text-[14px] text-white mt-0.5 line-clamp-2">{external.title}</p>
          {external.description && (
            <p className="text-gray-400 text-[13px] mt-1 line-clamp-2">{external.description}</p>
          )}
        </div>
      </a>
    );
  };

  const images = getPostImages();
  const hasQuoteEmbed = post.embed?.$type === "app.bsky.embed.record#view" || 
                        post.embed?.$type === "app.bsky.embed.recordWithMedia#view";
  const hasExternalEmbed = post.embed?.$type === "app.bsky.embed.external#view";

  // Image gallery modal
  const ImageModal = () => {
    if (!showImageModal || images.length === 0) return null;
    
    return (
      <div 
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
        onClick={() => setShowImageModal(false)}
      >
        <button
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition"
          onClick={() => setShowImageModal(false)}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {images.length > 1 && (
          <>
            <button
              className="absolute left-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((i) => (i > 0 ? i - 1 : images.length - 1));
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              className="absolute right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex((i) => (i < images.length - 1 ? i + 1 : 0));
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        
        <img
          src={images[selectedImageIndex]?.fullsize || images[selectedImageIndex]?.thumb}
          alt={images[selectedImageIndex]?.alt || "Image"}
          className="max-w-[90vw] max-h-[90vh] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        
          {images.length > 1 && (
          <div className="absolute bottom-4 flex gap-2">
            {images.map((_: any, idx: number) => (
              <button
                key={idx}
                className={`w-2 h-2 rounded-full transition ${
                  idx === selectedImageIndex ? "bg-white" : "bg-white/40"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex(idx);
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // More menu component
  const MoreMenu = () => (
    <div 
      data-menu
      className="absolute right-0 top-8 w-72 bg-[#0f1a2a] border border-[#2f3e4e] rounded-xl shadow-xl z-20 overflow-hidden"
    >
      <button
        onClick={handleCopyText}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1c2938] transition text-left"
      >
        <span className="text-white text-[15px]">Copier le texte</span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
      
      <div className="border-t border-[#2f3e4e]" />
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          showNotification("Fonctionnalité à venir");
          setShowMoreMenu(false);
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1c2938] transition text-left"
      >
        <span className="text-white text-[15px]">Traduire</span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      </button>
      
      <div className="border-t border-[#2f3e4e]" />
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          showNotification("Fonctionnalité à venir");
          setShowMoreMenu(false);
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1c2938] transition text-left"
      >
        <span className="text-white text-[15px]">Masquer ce post</span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      </button>
      
      <div className="border-t border-[#2f3e4e]" />
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          showNotification("Fonctionnalité à venir");
          setShowMoreMenu(false);
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1c2938] transition text-left"
      >
        <span className="text-white text-[15px]">Mute @{post.author.handle}</span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      </button>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          showNotification("Fonctionnalité à venir");
          setShowMoreMenu(false);
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1c2938] transition text-left"
      >
        <span className="text-white text-[15px]">Bloquer @{post.author.handle}</span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </button>
      
      <div className="border-t border-[#2f3e4e]" />
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          showNotification("Fonctionnalité à venir");
          setShowMoreMenu(false);
        }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1c2938] transition text-left"
      >
        <span className="text-red-400 text-[15px]">Signaler le post</span>
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </button>
    </div>
  );

  // Share menu component
  const ShareMenu = () => (
    <div 
      data-menu
      className="absolute right-0 bottom-10 w-56 bg-[#0f1a2a] border border-[#2f3e4e] rounded-xl shadow-xl z-20 overflow-hidden"
    >
      <button
        onClick={handleCopyLink}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#1c2938] transition text-left"
      >
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-white text-[15px]">Copier le lien</span>
      </button>
      
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={handleShareNative}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#1c2938] transition text-left border-t border-[#2f3e4e]"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-white text-[15px]">Partager via...</span>
        </button>
      )}
    </div>
  );

  // Toast notification
  const Toast = () => {
    if (!showToast) return null;
    return (
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#0085ff] text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg z-50 animate-fade-in">
        {toastMessage}
      </div>
    );
  };

  // Action buttons component
  const ActionButtons = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center ${compact ? "justify-around" : "justify-between max-w-[400px]"} text-gray-500`}>
      {/* Reply */}
      <button className="flex items-center gap-1.5 group" onClick={handleReply}>
        <div className="p-2 rounded-full group-hover:bg-[#0085ff]/10 group-hover:text-[#0085ff] transition">
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        {replyCount > 0 && <span className="text-[13px] group-hover:text-[#0085ff]">{formatNumber(replyCount)}</span>}
      </button>

      {/* Repost */}
      <button
        onClick={handleRepost}
        className={`flex items-center gap-1.5 group ${reposted ? "text-[#00ba7c]" : ""}`}
      >
        <div className={`p-2 rounded-full transition ${
          reposted ? "text-[#00ba7c]" : "group-hover:bg-[#00ba7c]/10 group-hover:text-[#00ba7c]"
        }`}>
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        {repostCount > 0 && (
          <span className={`text-[13px] ${reposted ? "text-[#00ba7c]" : "group-hover:text-[#00ba7c]"}`}>
            {formatNumber(repostCount)}
          </span>
        )}
      </button>

      {/* Like */}
      <button
        onClick={handleLike}
        className={`flex items-center gap-1.5 group ${liked ? "text-[#f91880]" : ""}`}
      >
        <div className={`p-2 rounded-full transition ${
          liked ? "text-[#f91880]" : "group-hover:bg-[#f91880]/10 group-hover:text-[#f91880]"
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
        {likeCount > 0 && (
          <span className={`text-[13px] ${liked ? "text-[#f91880]" : "group-hover:text-[#f91880]"}`}>
            {formatNumber(likeCount)}
          </span>
        )}
      </button>

      {/* Save */}
      <button
        onClick={handleSave}
        className={`flex items-center group ${saved ? "text-[#0085ff]" : ""}`}
      >
        <div className={`p-2 rounded-full transition ${
          saved ? "text-[#0085ff]" : "group-hover:bg-[#0085ff]/10 group-hover:text-[#0085ff]"
        }`}>
          <svg
            className="w-[18px] h-[18px]"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </div>
      </button>

      {/* Share */}
      <div className="relative" ref={shareMenuRef}>
        <button 
          className="flex items-center group"
          onClick={(e) => {
            e.stopPropagation();
            setShowShareMenu(!showShareMenu);
          }}
        >
          <div className="p-2 rounded-full group-hover:bg-[#0085ff]/10 group-hover:text-[#0085ff] transition">
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
        </button>
        {showShareMenu && <ShareMenu />}
      </div>
    </div>
  );

  // Render images grid
  const renderImages = (imageList: any[], maxHeight = "285px") => {
    if (imageList.length === 0) return null;

    const gridClass = imageList.length === 1 
      ? "" 
      : imageList.length === 2 
        ? "grid grid-cols-2 gap-0.5" 
        : imageList.length === 3 
          ? "grid grid-cols-2 gap-0.5"
          : "grid grid-cols-2 gap-0.5";

    return (
      <div className={`mt-3 rounded-xl overflow-hidden border border-[#2f3e4e] ${gridClass}`}>
        {imageList.map((img: any, idx: number) => (
          <div 
            key={idx} 
            className={`relative overflow-hidden ${
              imageList.length === 3 && idx === 0 ? "row-span-2" : ""
            }`}
          >
            <img
              src={img.thumb || img.fullsize}
              alt={img.alt || "Image"}
              className={`w-full object-cover cursor-pointer hover:opacity-90 transition`}
              style={{ maxHeight: imageList.length === 1 ? maxHeight : "200px", minHeight: imageList.length > 1 ? "100px" : undefined }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(idx);
                setShowImageModal(true);
              }}
            />
            {img.alt && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                ALT
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Reply Modal Component
  const ReplyModal = () => {
    if (!showReplyModal) return null;
    
    return (
      <div 
        className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-16 px-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowReplyModal(false);
        }}
      >
        <div className="bg-[#0f1a2a] rounded-2xl w-full max-w-[600px] shadow-2xl border border-[#2f3e4e]">
          <div className="flex items-center justify-between p-4 border-b border-[#2f3e4e]">
            <button
              onClick={() => setShowReplyModal(false)}
              className="p-2 -ml-2 rounded-full hover:bg-[#1c2938] transition"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="font-bold text-white">Répondre</span>
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
    );
  };

  // For retweets, render the original post embedded below
  if (isRepost && repostBy) {
    return (
      <article 
        onClick={handlePostClick}
        className="px-4 py-3 border-b border-[#2f3e4e] bg-[#0f1a2a] hover:bg-[#0f1a2a]/80 transition-colors cursor-pointer"
      >
        {/* Repost header */}
        <div className="flex items-center gap-2 mb-2 ml-12">
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <Link 
            to={`/profile/${repostBy.handle}`}
            className="text-[13px] text-gray-500 hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            Reposté par {repostBy.displayName || repostBy.handle}
          </Link>
        </div>

        <div className="flex gap-3">
          {/* Avatar */}
          <Link to={`/profile/${post.author.handle}`} className="flex-shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
            <img
              src={post.author.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.handle}`}
              alt={post.author.displayName || post.author.handle}
              className="w-11 h-11 rounded-full hover:opacity-90 transition"
            />
          </Link>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[15px] flex-wrap min-w-0">
                <Link
                  to={`/profile/${post.author.handle}`}
                  className="font-bold text-white hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {post.author.displayName || post.author.handle}
                </Link>
                <span className="text-gray-500 truncate">@{post.author.handle}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-500 hover:underline text-sm">
                  {formatDate(post.record.createdAt)}
                </span>
              </div>
              
              {/* More menu */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreMenu(!showMoreMenu);
                  }}
                  className="p-2 rounded-full hover:bg-[#1c2938] text-gray-500 hover:text-[#0085ff] transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                  </svg>
                </button>
                {showMoreMenu && <MoreMenu />}
              </div>
            </div>

            {/* Content */}
            <p className="mt-1 text-[15px] text-white whitespace-pre-wrap break-words leading-relaxed">
              {post.record.text}
            </p>

            {/* Images */}
            {renderImages(images, "250px")}

            {/* Quote embed */}
            {hasQuoteEmbed && renderQuoteEmbed()}

            {/* External link embed */}
            {hasExternalEmbed && renderExternalEmbed()}

            {/* Actions */}
            <div className="mt-3">
              <ActionButtons />
            </div>
          </div>
        </div>

        <ReplyModal />
        <ImageModal />
        <Toast />
      </article>
    );
  }

  // Regular post (not a retweet)
  return (
    <article 
      onClick={handlePostClick}
      className="px-4 py-3 border-b border-[#2f3e4e] bg-[#0f1a2a] hover:bg-[#0f1a2a]/80 transition-colors cursor-pointer"
    >
      {/* Reply indicator */}
      {showReplyTo && (
        <div className="flex items-center gap-2 mb-2 ml-12">
          <span className="text-[13px] text-gray-500">
            En réponse à{" "}
            <Link
              to={`/profile/${showReplyTo.author.handle}`}
              className="text-[#0085ff] hover:underline"
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
            className="w-11 h-11 rounded-full hover:opacity-90 transition"
          />
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[15px] flex-wrap min-w-0">
              <Link
                to={`/profile/${post.author.handle}`}
                className="font-bold text-white hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {post.author.displayName || post.author.handle}
              </Link>
              <span className="text-gray-500 truncate">@{post.author.handle}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500 hover:underline text-sm">
                {formatDate(post.record.createdAt)}
              </span>
            </div>
            
            {/* More menu */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreMenu(!showMoreMenu);
                }}
                className="p-2 rounded-full hover:bg-[#1c2938] text-gray-500 hover:text-[#0085ff] transition"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
              {showMoreMenu && <MoreMenu />}
            </div>
          </div>

          {/* Reply context in header */}
          {post.record.reply && !showReplyTo && (
            <p className="text-[13px] text-gray-500 mt-0.5">
              En réponse à un post
            </p>
          )}

          {/* Content */}
          <p className="mt-1 text-[15px] text-white whitespace-pre-wrap break-words leading-relaxed">
            {post.record.text}
          </p>

          {/* Images */}
          {renderImages(images)}

          {/* Quote embed */}
          {hasQuoteEmbed && renderQuoteEmbed()}

          {/* External link embed */}
          {hasExternalEmbed && renderExternalEmbed()}

          {/* Actions */}
          <div className="mt-3">
            <ActionButtons />
          </div>
        </div>
      </div>

      <ReplyModal />
      <ImageModal />
      <Toast />
    </article>
  );
}
