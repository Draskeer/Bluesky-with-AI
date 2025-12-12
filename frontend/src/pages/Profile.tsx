import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import PostCard from "../components/PostCard";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth.store";
import type { BlueskyProfile, FeedViewPost } from "../types";

export default function Profile() {
  const { handle } = useParams<{ handle: string }>();
  const { profile: myProfile } = useAuthStore();
  const [profile, setProfile] = useState<BlueskyProfile | null>(null);
  const [posts, setPosts] = useState<FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followUri, setFollowUri] = useState<string | undefined>(undefined);

  const isOwnProfile = myProfile?.handle === handle || myProfile?.did === handle;

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
        setIsFollowing(!!profileRes.data.viewer?.following);
        setFollowUri(profileRes.data.viewer?.following);

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

  const handleFollow = async () => {
    if (!profile || followLoading) return;

    try {
      setFollowLoading(true);

      if (isFollowing && followUri) {
        // Unfollow
        const res = await api.profiles.unfollow(followUri);
        if (res.success) {
          setIsFollowing(false);
          setFollowUri(undefined);
          setProfile(prev => prev ? {
            ...prev,
            followersCount: Math.max(0, prev.followersCount - 1)
          } : null);
        }
      } else {
        // Follow
        const res = await api.profiles.follow(profile.did);
        if (res.success && res.data) {
          setIsFollowing(true);
          setFollowUri(res.data.uri);
          setProfile(prev => prev ? {
            ...prev,
            followersCount: prev.followersCount + 1
          } : null);
        }
      }
    } catch (err) {
      console.error("Follow error:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12 bg-[#0a1627] min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="px-4 py-8 text-center bg-[#0a1627] min-h-screen">
        <p className="text-red-400 mb-4">{error || "Profil introuvable"}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0a1627] min-h-screen">
      {/* Header du profil */}
      <div className="border-b border-[#2f3e4e]">
        {/* Banner */}
        <div className="h-[180px] bg-gradient-to-r from-[#0085ff]/30 to-[#0066cc]/30">
          {profile.banner && (
            <img
              src={profile.banner}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="px-4 pb-4 bg-[#0a1627]">
          <div className="flex justify-between items-start">
            <div className="-mt-[60px]">
              <img
                src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.handle}`}
                alt={profile.displayName || profile.handle}
                className="w-[120px] h-[120px] rounded-full border-4 border-[#0a1627] bg-[#1c2938]"
              />
            </div>
            <div className="mt-3 flex gap-2">
              {!isOwnProfile && (
                <button 
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-5 py-2 rounded-full font-bold text-[15px] transition flex items-center gap-2 ${
                    isFollowing 
                      ? "bg-transparent border border-[#2f3e4e] text-white hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 group"
                      : "bg-[#0085ff] text-white hover:bg-[#0066cc]"
                  } ${followLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {followLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  ) : isFollowing ? (
                    <>
                      <span className="group-hover:hidden">Abonné</span>
                      <span className="hidden group-hover:inline">Se désabonner</span>
                    </>
                  ) : (
                    "Suivre"
                  )}
                </button>
              )}
              {isOwnProfile && (
                <button className="px-5 py-2 rounded-full font-bold text-[15px] bg-transparent border border-[#2f3e4e] text-white hover:bg-[#1c2938] transition">
                  Modifier le profil
                </button>
              )}
            </div>
          </div>

          <div className="mt-3">
            <h1 className="text-[22px] font-extrabold text-white">
              {profile.displayName || profile.handle}
            </h1>
            <p className="text-[15px] text-gray-400">@{profile.handle}</p>
            
            {/* Follows you badge */}
            {profile.viewer?.followedBy && !isOwnProfile && (
              <span className="inline-block mt-1 px-2 py-0.5 bg-[#1c2938] text-gray-400 text-xs rounded">
                Vous suit
              </span>
            )}
          </div>

          {profile.description && (
            <p className="mt-3 text-[15px] text-gray-200 whitespace-pre-wrap">
              {profile.description}
            </p>
          )}

          <div className="flex gap-5 mt-3 text-[15px]">
            <span className="hover:underline cursor-pointer">
              <strong className="text-white">{profile.followsCount || 0}</strong>{" "}
              <span className="text-gray-500">abonnements</span>
            </span>
            <span className="hover:underline cursor-pointer">
              <strong className="text-white">{profile.followersCount || 0}</strong>{" "}
              <span className="text-gray-500">abonnés</span>
            </span>
            <span>
              <strong className="text-white">{profile.postsCount || 0}</strong>{" "}
              <span className="text-gray-500">posts</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2f3e4e] bg-[#0a1627]">
          <button className="flex-1 py-4 text-[15px] font-bold text-[#0085ff] border-b-2 border-[#0085ff] hover:bg-[#1c2938]/50 transition">
            Posts
          </button>
          <button className="flex-1 py-4 text-[15px] font-bold text-gray-500 border-b-2 border-transparent hover:bg-[#1c2938]/50 hover:text-gray-300 transition">
            Réponses
          </button>
          <button className="flex-1 py-4 text-[15px] font-bold text-gray-500 border-b-2 border-transparent hover:bg-[#1c2938]/50 hover:text-gray-300 transition">
            Médias
          </button>
          <button className="flex-1 py-4 text-[15px] font-bold text-gray-500 border-b-2 border-transparent hover:bg-[#1c2938]/50 hover:text-gray-300 transition">
            J'aime
          </button>
        </div>
      </div>

      {/* Posts */}
      <div>
        {posts.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <p className="text-lg font-semibold">Aucun post</p>
            <p className="mt-1 text-sm">Ce compte n'a pas encore posté.</p>
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
