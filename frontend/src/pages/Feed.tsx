import { useState, useEffect, useRef, useCallback } from "react";
import PostCard from "../components/PostCard";
import ComposePost from "../components/ComposePost";
import type { FeedViewPost } from "../types";
import { api } from "../services/api";

export default function Feed() {
  const [posts, setPosts] = useState<FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPosts([]);
        setCursor(undefined);
      }
      
      const response = await api.feed.getTimeline({ limit: 25 });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Erreur lors du chargement");
      }

      setPosts(response.data.items || []);
      setCursor(response.data.cursor);
      setHasMore(!!response.data.cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;

    try {
      setLoadingMore(true);
      const response = await api.feed.getTimeline({ limit: 25, cursor });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Erreur lors du chargement");
      }

      setPosts(prev => [...prev, ...(response.data.items || [])]);
      setCursor(response.data.cursor);
      setHasMore(!!response.data.cursor);
    } catch (err) {
      console.error("Erreur lors du chargement de plus de posts:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore]);

  useEffect(() => {
    fetchFeed(true);
  }, []);

  // Intersection Observer pour le scroll infini
  useEffect(() => {
    if (loading || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, hasMore, loading, loadingMore]);

  const handlePostCreated = () => {
    fetchFeed(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2f3e4e] bg-[#0f1a2a] sticky top-0 z-10">
        <h1 className="text-[19px] font-extrabold text-white">Home</h1>
      </div>

      {/* Compose */}
      <ComposePost onPostCreated={handlePostCreated} />

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1da1f2]"></div>
        </div>
      ) : error ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[#e0245e] mb-4">{error}</p>
          <button
            onClick={() => fetchFeed(true)}
            className="text-[#1da1f2] hover:underline font-bold"
          >
            Réessayer
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="px-4 py-12 text-center text-[#657786] dark:text-[#8899a6]">
          <p className="text-lg">Bienvenue sur votre timeline !</p>
          <p className="mt-2">Suivez des comptes pour voir leurs tweets ici.</p>
        </div>
      ) : (
        <div>
          {posts.map((feedItem) => (
            <PostCard
              key={`${feedItem.post.uri}-${feedItem.reason?.indexedAt || ''}`}
              post={feedItem.post}
              reason={feedItem.reason}
              showReplyTo={feedItem.reply?.parent}
            />
          ))}
          
          {/* Sentinel pour le scroll infini */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              {loadingMore && (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1da1f2]"></div>
              )}
            </div>
          )}
          
          {!hasMore && posts.length > 0 && (
            <div className="px-4 py-8 text-center text-[#8899a6]">
              <p className="text-sm">Vous avez tout vu ! 🎉</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
