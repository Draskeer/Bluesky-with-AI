import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import PostCard from "../components/PostCard";
import { api } from "../services/api";
import type { BlueskyProfile, FeedViewPost } from "../types";

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const [profile, setProfile] = useState<BlueskyProfile | null>(null);
  const [posts, setPosts] = useState<FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!handle) return;

      try {
        setLoading(true);
        setError("");
        
        // Fetch profile
        const profileRes = await api.profiles.get(handle);
        
        if (!profileRes.success || !profileRes.data) {
          throw new Error(profileRes.error || "Profil introuvable");
        }
        
        setProfile(profileRes.data);

        // Fetch posts
        const postsRes = await api.feed.getAuthorFeed(handle, { limit: 50 });
        
        if (postsRes.success && postsRes.data) {
          setPosts(postsRes.data.items || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [handle]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1da1f2]"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[#e0245e] mb-4">{error || "Profil introuvable"}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header du profil */}
      <div className="border-b border-[#e6ecf0] dark:border-[#38444d]">
        {/* Banner */}
        <div className="h-[200px] bg-[#1da1f2]">
          {profile.banner && (
            <img
              src={profile.banner}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="px-4 pb-4 bg-white dark:bg-[#15202b]">
          <div className="flex justify-between items-start">
            <div className="-mt-[75px]">
              <img
                src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.handle}`}
                alt={profile.displayName || profile.handle}
                className="w-[134px] h-[134px] rounded-full border-4 border-white dark:border-[#15202b] bg-white dark:bg-[#15202b]"
              />
            </div>
            <div className="mt-3">
              <button className="px-4 py-2 border border-[#1da1f2] text-[#1da1f2] rounded-full font-bold text-[15px] hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition">
                Suivre
              </button>
            </div>
          </div>

          <div className="mt-3">
            <h1 className="text-[20px] font-extrabold text-[#14171a] dark:text-[#d9d9d9]">
              {profile.displayName || profile.handle}
            </h1>
            <p className="text-[15px] text-[#657786] dark:text-[#8899a6]">@{profile.handle}</p>
          </div>

          {profile.description && (
            <p className="mt-3 text-[15px] text-[#14171a] dark:text-[#d9d9d9] whitespace-pre-wrap">
              {profile.description}
            </p>
          )}

          <div className="flex gap-5 mt-3 text-[15px]">
            <span className="hover:underline cursor-pointer">
              <strong className="text-[#14171a] dark:text-[#d9d9d9]">{profile.followingCount || profile.followsCount || 0}</strong>{" "}
              <span className="text-[#657786] dark:text-[#8899a6]">abonnements</span>
            </span>
            <span className="hover:underline cursor-pointer">
              <strong className="text-[#14171a] dark:text-[#d9d9d9]">{profile.followersCount || 0}</strong>{" "}
              <span className="text-[#657786] dark:text-[#8899a6]">abonnés</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#e6ecf0] dark:border-[#38444d] bg-white dark:bg-[#15202b]">
          <button className="flex-1 py-4 text-[15px] font-bold text-[#1da1f2] border-b-2 border-[#1da1f2] hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition">
            Tweets
          </button>
          <button className="flex-1 py-4 text-[15px] font-bold text-[#657786] dark:text-[#8899a6] border-b-2 border-transparent hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 hover:text-[#1da1f2] transition">
            Réponses
          </button>
          <button className="flex-1 py-4 text-[15px] font-bold text-[#657786] dark:text-[#8899a6] border-b-2 border-transparent hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 hover:text-[#1da1f2] transition">
            Médias
          </button>
          <button className="flex-1 py-4 text-[15px] font-bold text-[#657786] dark:text-[#8899a6] border-b-2 border-transparent hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 hover:text-[#1da1f2] transition">
            J'aime
          </button>
        </div>
      </div>

      {/* Posts */}
      <div>
        {posts.length === 0 ? (
          <div className="px-4 py-12 text-center text-[#657786] dark:text-[#8899a6]">
            <p className="text-lg">Aucun tweet</p>
            <p className="mt-2">Ce compte n'a pas encore tweeté.</p>
          </div>
        ) : (
          posts.map((feedItem) => (
            <PostCard key={feedItem.post.uri} post={feedItem.post} reason={feedItem.reason} />
          ))
        )}
      </div>
    </div>
  );
}
