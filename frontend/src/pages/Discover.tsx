import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import PostCard from "../components/PostCard";
import type { FeedViewPost, BlueskyProfile } from "../types";
import { api } from "../services/api";

type FeedType = "foryou" | "trending";

export default function Discover() {
  const [posts, setPosts] = useState<FeedViewPost[]>([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState<BlueskyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<FeedType>("foryou");
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BlueskyProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchFeed = async (feedType: FeedType, loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPosts([]);
      }

      const fetchFn = feedType === "trending" ? api.feed.getPopular : api.feed.getDiscover;
      const response = await fetchFn({ 
        limit: 50, 
        cursor: loadMore ? cursor : undefined 
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Erreur lors du chargement");
      }

      if (loadMore) {
        setPosts(prev => [...prev, ...response.data!.items]);
      } else {
        setPosts(response.data.items || []);
      }
      
      setCursor(response.data.cursor);
      setHasMore(!!response.data.cursor);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchSuggestedProfiles = async () => {
    try {
      const response = await api.profiles.getSuggestions({ limit: 5 });
      if (response.success && response.data) {
        setSuggestedProfiles(response.data.actors || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    }
  };

  const searchProfiles = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.profiles.search(query, { limit: 10 });
      if (response.success && response.data) {
        setSearchResults(response.data.actors || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    fetchFeed(activeTab);
    if (activeTab === "foryou") {
      fetchSuggestedProfiles();
    }
  }, [activeTab]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchProfiles(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleTabChange = (tab: FeedType) => {
    setActiveTab(tab);
    setCursor(undefined);
    setHasMore(true);
  };

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !cursor) return;
    
    try {
      setLoadingMore(true);
      const fetchFn = activeTab === "trending" ? api.feed.getPopular : api.feed.getDiscover;
      const response = await fetchFn({ limit: 50, cursor });

      if (response.success && response.data) {
        setPosts(prev => [...prev, ...response.data!.items]);
        setCursor(response.data.cursor);
        setHasMore(!!response.data.cursor);
      }
    } catch (err) {
      console.error("Erreur lors du chargement:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loading, loadingMore, activeTab]);

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

  const handleFollow = async (did: string) => {
    try {
      const response = await api.profiles.follow(did);
      if (response.success) {
        setSuggestedProfiles(prev => prev.filter(p => p.did !== did));
      }
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  return (
    <div>
      {/* Header with search */}
      <div className="sticky top-0 z-10 bg-[#0f1a2a] border-b border-[#2f3e4e]">
        <div className="px-4 py-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Rechercher des personnes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearch(true)}
              className="w-full bg-[#1c2938] text-white placeholder-[#8899a6] pl-10 pr-4 py-3 rounded-full border border-[#2f3e4e] focus:border-[#0085ff] focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="w-5 h-5 text-[#8899a6] hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Search results dropdown */}
        {showSearch && (searchQuery || searchResults.length > 0) && (
          <div className="absolute left-0 right-0 bg-[#0f1a2a] border-b border-[#2f3e4e] shadow-lg max-h-[400px] overflow-y-auto">
            {isSearching ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0085ff]"></div>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((profile) => (
                <Link
                  key={profile.did}
                  to={`/profile/${profile.handle}`}
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#1c2938] transition"
                >
                  <img
                    src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.handle}`}
                    alt={profile.displayName || profile.handle}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{profile.displayName || profile.handle}</p>
                    <p className="text-[#8899a6] text-sm truncate">@{profile.handle}</p>
                    {profile.description && (
                      <p className="text-[#8899a6] text-sm line-clamp-1 mt-0.5">{profile.description}</p>
                    )}
                  </div>
                </Link>
              ))
            ) : searchQuery ? (
              <div className="px-4 py-6 text-center text-[#8899a6]">
                Aucun résultat pour "{searchQuery}"
              </div>
            ) : null}
          </div>
        )}
        
        {/* Tabs */}
        <div className="flex">
          <button
            onClick={() => handleTabChange("foryou")}
            className={`flex-1 py-4 text-[15px] font-bold text-center border-b-2 transition ${
              activeTab === "foryou"
                ? "text-[#0085ff] border-[#0085ff]"
                : "text-[#8899a6] border-transparent hover:bg-[#1c2938] hover:text-white"
            }`}
          >
            For You
          </button>
          <button
            onClick={() => handleTabChange("trending")}
            className={`flex-1 py-4 text-[15px] font-bold text-center border-b-2 transition ${
              activeTab === "trending"
                ? "text-[#0085ff] border-[#0085ff]"
                : "text-[#8899a6] border-transparent hover:bg-[#1c2938] hover:text-white"
            }`}
          >
            Trending
          </button>
        </div>
      </div>

      {/* Click outside to close search */}
      {showSearch && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowSearch(false)}
        />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
        </div>
      ) : error ? (
        <div className="px-4 py-8 text-center">
          <p className="text-[#e0245e] mb-4">{error}</p>
          <button
            onClick={() => fetchFeed(activeTab)}
            className="text-[#0085ff] hover:underline font-bold"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div>
          {/* Suggested profiles section (only for "For You" tab) */}
          {activeTab === "foryou" && suggestedProfiles.length > 0 && (
            <div className="border-b border-[#2f3e4e]">
              <div className="px-4 py-3">
                <h2 className="text-[17px] font-extrabold text-white">Who to follow</h2>
              </div>
              <div className="flex overflow-x-auto gap-3 px-4 pb-4 scrollbar-hide">
                {suggestedProfiles.map((profile) => (
                  <div
                    key={profile.did}
                    className="flex-shrink-0 w-[160px] bg-[#1c2938] rounded-2xl p-4 text-center"
                  >
                    <Link to={`/profile/${profile.handle}`}>
                      <img
                        src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.handle}`}
                        alt={profile.displayName || profile.handle}
                        className="w-16 h-16 rounded-full mx-auto mb-2"
                      />
                      <p className="font-bold text-white text-sm truncate">
                        {profile.displayName || profile.handle}
                      </p>
                      <p className="text-[#8899a6] text-xs truncate">@{profile.handle}</p>
                    </Link>
                    <button
                      onClick={() => handleFollow(profile.did)}
                      className="mt-3 w-full bg-white text-black font-bold py-1.5 px-4 rounded-full text-sm hover:bg-gray-200 transition"
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posts */}
          {posts.length === 0 ? (
            <div className="px-4 py-12 text-center text-[#8899a6]">
              <svg className="w-16 h-16 mx-auto mb-4 text-[#2f3e4e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <p className="text-lg">Aucun post à afficher</p>
              <p className="mt-2 text-sm">Revenez plus tard pour découvrir du contenu.</p>
            </div>
          ) : (
            <>
              {posts.map((feedItem) => (
                <PostCard key={feedItem.post.uri} post={feedItem.post} reason={feedItem.reason} />
              ))}
              
              {/* Sentinel pour le scroll infini */}
              {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-8">
                  {loadingMore && (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
                  )}
                </div>
              )}
              
              {!hasMore && posts.length > 0 && (
                <div className="px-4 py-8 text-center text-[#8899a6]">
                  <p className="text-sm">Vous avez tout vu ! 🎉</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
