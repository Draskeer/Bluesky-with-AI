import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PostCard from "../components/PostCard";
import { api } from "../services/api";
import type { FeedViewPost } from "../types";

interface FeedGenerator {
  uri: string;
  cid: string;
  did: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  displayName: string;
  description?: string;
  avatar?: string;
  likeCount?: number;
  indexedAt: string;
}

export default function Feeds() {
  const [feeds, setFeeds] = useState<FeedGenerator[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<FeedGenerator | null>(null);
  const [feedPosts, setFeedPosts] = useState<FeedViewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FeedGenerator[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"saved" | "popular">("saved");

  useEffect(() => {
    if (activeTab === "saved") {
      fetchSavedFeeds();
    } else {
      fetchPopularFeeds();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedFeed) {
      fetchFeedPosts(selectedFeed.uri);
    }
  }, [selectedFeed?.uri]);

  const fetchSavedFeeds = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.feeds.getSavedFeeds();
      if (response.success && response.data) {
        setFeeds(response.data.feeds || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading feeds");
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularFeeds = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.feeds.getPopularFeeds({ limit: 30 });
      if (response.success && response.data) {
        setFeeds(response.data.feeds || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading feeds");
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedPosts = async (feedUri: string) => {
    try {
      setLoadingPosts(true);
      const response = await api.feeds.getFeed(feedUri, { limit: 30 });
      if (response.success && response.data) {
        setFeedPosts(response.data.feed || []);
      }
    } catch (err) {
      console.error("Error loading feed posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const searchFeeds = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.feeds.searchFeeds(query, { limit: 20 });
      if (response.success && response.data) {
        setSearchResults(response.data.feeds || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) {
        searchFeeds(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSaveFeed = async (feed: FeedGenerator) => {
    try {
      const response = await api.feeds.saveFeed(feed.uri);
      if (response.success) {
        // Refresh saved feeds if on that tab
        if (activeTab === "saved") {
          fetchSavedFeeds();
        }
      }
    } catch (err) {
      console.error("Save feed error:", err);
    }
  };

  const handleUnsaveFeed = async (feedUri: string) => {
    try {
      const response = await api.feeds.unsaveFeed(feedUri);
      if (response.success) {
        setFeeds(prev => prev.filter(f => f.uri !== feedUri));
        if (selectedFeed?.uri === feedUri) {
          setSelectedFeed(null);
          setFeedPosts([]);
        }
      }
    } catch (err) {
      console.error("Unsave feed error:", err);
    }
  };

  // If a feed is selected, show its posts
  if (selectedFeed) {
    return (
      <div>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0f1a2a] border-b border-[#2f3e4e]">
          <div className="px-4 py-3 flex items-center gap-4">
            <button
              onClick={() => {
                setSelectedFeed(null);
                setFeedPosts([]);
              }}
              className="p-2 -ml-2 rounded-full hover:bg-[#1c2938] transition"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[17px] font-bold text-white truncate">{selectedFeed.displayName}</h1>
              <p className="text-sm text-[#8899a6] truncate">by @{selectedFeed.creator.handle}</p>
            </div>
          </div>
        </div>

        {/* Feed info */}
        <div className="p-4 border-b border-[#2f3e4e]">
          <div className="flex items-start gap-4">
            {selectedFeed.avatar ? (
              <img
                src={selectedFeed.avatar}
                alt={selectedFeed.displayName}
                className="w-16 h-16 rounded-lg"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-[#1c2938] flex items-center justify-center">
                <svg className="w-8 h-8 text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
            )}
            <div className="flex-1">
              {selectedFeed.description && (
                <p className="text-[#d9d9d9] text-sm mb-2">{selectedFeed.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-[#8899a6]">
                {selectedFeed.likeCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {selectedFeed.likeCount.toLocaleString()}
                  </span>
                )}
                <Link
                  to={`/profile/${selectedFeed.creator.handle}`}
                  className="hover:underline"
                >
                  Created by @{selectedFeed.creator.handle}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        {loadingPosts ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="px-4 py-12 text-center text-[#8899a6]">
            <p>No posts in this feed yet</p>
          </div>
        ) : (
          <div>
            {feedPosts.map((item) => (
              <PostCard key={item.post.uri} post={item.post} reason={item.reason} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1a2a] border-b border-[#2f3e4e]">
        <div className="px-4 py-3">
          <h1 className="text-[19px] font-extrabold text-white">Feeds</h1>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search feeds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1c2938] text-white placeholder-[#8899a6] pl-10 pr-4 py-2.5 rounded-full border border-[#2f3e4e] focus:border-[#0085ff] focus:outline-none transition text-sm"
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

        {/* Tabs */}
        {!searchQuery && (
          <div className="flex">
            <button
              onClick={() => setActiveTab("saved")}
              className={`flex-1 py-3 text-[15px] font-bold text-center border-b-2 transition ${
                activeTab === "saved"
                  ? "text-[#0085ff] border-[#0085ff]"
                  : "text-[#8899a6] border-transparent hover:bg-[#1c2938] hover:text-white"
              }`}
            >
              My Feeds
            </button>
            <button
              onClick={() => setActiveTab("popular")}
              className={`flex-1 py-3 text-[15px] font-bold text-center border-b-2 transition ${
                activeTab === "popular"
                  ? "text-[#0085ff] border-[#0085ff]"
                  : "text-[#8899a6] border-transparent hover:bg-[#1c2938] hover:text-white"
              }`}
            >
              Discover
            </button>
          </div>
        )}
      </div>

      {/* Search results */}
      {searchQuery && (
        <div>
          {isSearching ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
            </div>
          ) : searchResults.length > 0 ? (
            <div>
              <div className="px-4 py-2 text-sm text-[#8899a6]">
                {searchResults.length} results for "{searchQuery}"
              </div>
              {searchResults.map((feed) => (
                <FeedCard
                  key={feed.uri}
                  feed={feed}
                  onSelect={() => setSelectedFeed(feed)}
                  onSave={() => handleSaveFeed(feed)}
                  showSaveButton
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-[#8899a6]">
              <p>No feeds found for "{searchQuery}"</p>
            </div>
          )}
        </div>
      )}

      {/* Feed list */}
      {!searchQuery && (
        <>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[#e0245e] mb-4">{error}</p>
              <button
                onClick={() => activeTab === "saved" ? fetchSavedFeeds() : fetchPopularFeeds()}
                className="text-[#0085ff] hover:underline font-bold"
              >
                Try again
              </button>
            </div>
          ) : feeds.length === 0 ? (
            <div className="px-4 py-12 text-center text-[#8899a6]">
              <svg className="w-16 h-16 mx-auto mb-4 text-[#2f3e4e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              {activeTab === "saved" ? (
                <>
                  <p className="text-lg">No saved feeds yet</p>
                  <p className="mt-2 text-sm">Discover and save feeds to see them here</p>
                  <button
                    onClick={() => setActiveTab("popular")}
                    className="mt-4 px-4 py-2 bg-[#0085ff] text-white font-bold rounded-full hover:bg-[#0070db] transition"
                  >
                    Discover Feeds
                  </button>
                </>
              ) : (
                <>
                  <p className="text-lg">No feeds available</p>
                  <p className="mt-2 text-sm">Check back later for new feeds</p>
                </>
              )}
            </div>
          ) : (
            <div>
              {feeds.map((feed) => (
                <FeedCard
                  key={feed.uri}
                  feed={feed}
                  onSelect={() => setSelectedFeed(feed)}
                  onUnsave={activeTab === "saved" ? () => handleUnsaveFeed(feed.uri) : undefined}
                  onSave={activeTab === "popular" ? () => handleSaveFeed(feed) : undefined}
                  showSaveButton={activeTab === "popular"}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Feed card component
interface FeedCardProps {
  feed: FeedGenerator;
  onSelect: () => void;
  onSave?: () => void;
  onUnsave?: () => void;
  showSaveButton?: boolean;
}

function FeedCard({ feed, onSelect, onSave, onUnsave, showSaveButton }: FeedCardProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#1c2938] transition border-b border-[#2f3e4e]">
      <button onClick={onSelect} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        {feed.avatar ? (
          <img
            src={feed.avatar}
            alt={feed.displayName}
            className="w-12 h-12 rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-[#1c2938] flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{feed.displayName}</p>
          <p className="text-[#8899a6] text-sm truncate">by @{feed.creator.handle}</p>
          {feed.description && (
            <p className="text-[#8899a6] text-sm line-clamp-1 mt-0.5">{feed.description}</p>
          )}
          {feed.likeCount !== undefined && feed.likeCount > 0 && (
            <p className="text-[#8899a6] text-xs mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {feed.likeCount.toLocaleString()} likes
            </p>
          )}
        </div>
      </button>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        {showSaveButton && onSave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="px-3 py-1.5 bg-white text-black font-bold rounded-full text-sm hover:bg-gray-200 transition"
          >
            Save
          </button>
        )}
        {onUnsave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnsave();
            }}
            className="p-2 text-[#8899a6] hover:text-[#e0245e] hover:bg-[#e0245e]/10 rounded-full transition"
            title="Remove from saved"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
