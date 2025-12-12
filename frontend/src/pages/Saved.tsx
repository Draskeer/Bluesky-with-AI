import { useState, useEffect } from "react";
import PostCard from "../components/PostCard";
import { api } from "../services/api";
import type { BlueskyPost } from "../types";

interface SavedPost {
  post: BlueskyPost;
}

export default function Saved() {
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSavedPosts();
  }, []);

  const fetchSavedPosts = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.saved.getSavedPosts();
      if (response.success && response.data) {
        setPosts(response.data.posts || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (uri: string) => {
    try {
      await api.saved.unsavePost(uri);
      setPosts(posts.filter(p => p.post.uri !== uri));
    } catch (err) {
      console.error("Error unsaving post:", err);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1a2a]/80 backdrop-blur-md border-b border-[#2f3e4e]">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Enregistrements</h1>
          <p className="text-sm text-gray-500">Vos posts sauvegardés</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-400">{error}</div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-20 h-20 bg-[#1c2938] rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Aucun contenu pour le moment</h2>
          <p className="text-gray-400 text-center max-w-sm">
            Sauvegardez des posts pour les retrouver facilement ici. Appuyez sur l'icône de signet sur n'importe quel post pour le sauvegarder.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#2f3e4e]">
          {posts.map((item, index) => (
            <div key={item.post.uri || index} className="relative">
              <PostCard post={item.post} />
              <button
                onClick={() => handleUnsave(item.post.uri)}
                className="absolute top-4 right-4 p-2 text-[#0085ff] hover:bg-[#0085ff]/10 rounded-full transition-colors"
                title="Retirer des enregistrements"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
