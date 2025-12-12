import { useState, useEffect } from "react";
import PostCard from "../components/PostCard";
import ComposePost from "../components/ComposePost";
import type { FeedViewPost } from "../types";
import { api } from "../services/api";

export default function Feed() {
  const [posts, setPosts] = useState<FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const response = await api.feed.getTimeline({ limit: 50 });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Erreur lors du chargement");
      }

      setPosts(response.data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handlePostCreated = () => {
    fetchFeed();
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
            onClick={fetchFeed}
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
        </div>
      )}
    </div>
  );
}
