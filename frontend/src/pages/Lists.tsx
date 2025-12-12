import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

interface ListView {
  uri: string;
  cid: string;
  name: string;
  purpose: string;
  description?: string;
  avatar?: string;
  creator: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  indexedAt: string;
  listItemCount?: number;
}

interface ListItem {
  uri: string;
  subject: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    description?: string;
  };
}

export default function Lists() {
  const [lists, setLists] = useState<ListView[]>([]);
  const [selectedList, setSelectedList] = useState<ListView | null>(null);
  const [listMembers, setListMembers] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"my-lists" | "subscribed">("my-lists");

  useEffect(() => {
    fetchLists();
  }, [activeTab]);

  useEffect(() => {
    if (selectedList) {
      fetchListMembers(selectedList.uri);
    }
  }, [selectedList?.uri]);

  const fetchLists = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.lists.getLists(activeTab === "my-lists" ? "curate" : "modlist");
      if (response.success && response.data) {
        setLists(response.data.lists || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const fetchListMembers = async (listUri: string) => {
    try {
      setLoadingMembers(true);
      const response = await api.lists.getList(listUri);
      if (response.success && response.data) {
        setListMembers(response.data.items || []);
      }
    } catch (err) {
      console.error("Error loading list members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case "app.bsky.graph.defs#curatelist":
        return "Liste de curation";
      case "app.bsky.graph.defs#modlist":
        return "Liste de modération";
      default:
        return "Liste";
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1a2a]/80 backdrop-blur-md border-b border-[#2f3e4e]">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Listes</h1>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-[#2f3e4e]">
          <button
            onClick={() => {
              setActiveTab("my-lists");
              setSelectedList(null);
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "my-lists"
                ? "text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Mes Listes
            {activeTab === "my-lists" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#0085ff] rounded-full" />
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("subscribed");
              setSelectedList(null);
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "subscribed"
                ? "text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Abonnements
            {activeTab === "subscribed" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-[#0085ff] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex">
        {/* Lists sidebar */}
        <div className={`${selectedList ? 'hidden md:block md:w-80 lg:w-96' : 'w-full'} border-r border-[#2f3e4e]`}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-400">{error}</div>
          ) : lists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 bg-[#1c2938] rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-400 text-center">
                {activeTab === "my-lists" 
                  ? "Vous n'avez pas encore créé de liste"
                  : "Vous n'êtes abonné à aucune liste"}
              </p>
              <p className="text-gray-500 text-sm mt-2 text-center">
                {activeTab === "my-lists"
                  ? "Créez des listes pour organiser les comptes que vous suivez"
                  : "Abonnez-vous à des listes pour découvrir du contenu"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#2f3e4e]">
              {lists.map((list) => (
                <button
                  key={list.uri}
                  onClick={() => setSelectedList(list)}
                  className={`w-full p-4 text-left hover:bg-[#1c2938] transition-colors ${
                    selectedList?.uri === list.uri ? "bg-[#1c2938]" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {list.avatar ? (
                      <img
                        src={list.avatar}
                        alt={list.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-[#0085ff] to-[#00c2ff] rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{list.name}</h3>
                      <p className="text-xs text-gray-500">{getPurposeLabel(list.purpose)}</p>
                      {list.description && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{list.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>par @{list.creator.handle}</span>
                        {list.listItemCount !== undefined && (
                          <>
                            <span>•</span>
                            <span>{list.listItemCount} membre{list.listItemCount !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List detail */}
        {selectedList && (
          <div className="flex-1 min-w-0">
            {/* List header */}
            <div className="p-4 border-b border-[#2f3e4e]">
              <button
                onClick={() => setSelectedList(null)}
                className="md:hidden flex items-center gap-2 text-[#0085ff] mb-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Retour
              </button>
              
              <div className="flex items-start gap-4">
                {selectedList.avatar ? (
                  <img
                    src={selectedList.avatar}
                    alt={selectedList.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-[#0085ff] to-[#00c2ff] rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">{selectedList.name}</h2>
                  <p className="text-sm text-gray-500">{getPurposeLabel(selectedList.purpose)}</p>
                  {selectedList.description && (
                    <p className="text-gray-400 mt-2">{selectedList.description}</p>
                  )}
                  <Link
                    to={`/profile/${selectedList.creator.handle}`}
                    className="text-sm text-[#0085ff] hover:underline mt-2 inline-block"
                  >
                    par @{selectedList.creator.handle}
                  </Link>
                </div>
              </div>
            </div>

            {/* List members */}
            <div>
              <h3 className="px-4 py-3 text-sm font-semibold text-gray-400 border-b border-[#2f3e4e]">
                Membres ({listMembers.length})
              </h3>
              
              {loadingMembers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0085ff]"></div>
                </div>
              ) : listMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-12 h-12 bg-[#1c2938] rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-400">Cette liste est vide</p>
                </div>
              ) : (
                <div className="divide-y divide-[#2f3e4e]">
                  {listMembers.map((item) => (
                    <Link
                      key={item.uri}
                      to={`/profile/${item.subject.handle}`}
                      className="flex items-center gap-3 p-4 hover:bg-[#1c2938] transition-colors"
                    >
                      {item.subject.avatar ? (
                        <img
                          src={item.subject.avatar}
                          alt={item.subject.handle}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-[#0085ff] to-[#00c2ff] rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {(item.subject.displayName || item.subject.handle)?.[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">
                          {item.subject.displayName || item.subject.handle}
                        </p>
                        <p className="text-sm text-gray-500 truncate">@{item.subject.handle}</p>
                        {item.subject.description && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.subject.description}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
