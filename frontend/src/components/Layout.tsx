import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";
import ComposePost from "./ComposePost";
import ProfileDashboard from "./ProfileDashboard";
import { api } from "../services/api";

interface LayoutProps {
  children: React.ReactNode;
}

type Mood = 'happy' | 'good' | 'neutral' | 'low' | 'sad';

export default function Layout({ children }: LayoutProps) {
  const { profile, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);

  // Detect profile page and resolve DID for the dashboard
  const profileMatch = location.pathname.match(/^\/profile\/(.+)$/);
  const profileHandle = profileMatch ? decodeURIComponent(profileMatch[1]) : null;
  const [profileDid, setProfileDid] = useState<string | null>(null);

  useEffect(() => {
    setProfileDid(null);
    if (!profileHandle) return;
    let cancelled = false;
    api.profiles.get(profileHandle).then(res => {
      if (cancelled) return;
      if (res.success && res.data) setProfileDid(res.data.did);
    });
    return () => { cancelled = true; };
  }, [profileHandle]);

  const moods: { value: Mood; emoji: string; label: string; color: string }[] = [
    { value: 'happy', emoji: '😊', label: 'Happy', color: 'hover:bg-green-500/20 hover:border-green-500' },
    { value: 'good', emoji: '🙂', label: 'Good', color: 'hover:bg-blue-500/20 hover:border-blue-500' },
    { value: 'neutral', emoji: '😐', label: 'Neutral', color: 'hover:bg-gray-500/20 hover:border-gray-500' },
    { value: 'low', emoji: '😔', label: 'Low', color: 'hover:bg-orange-500/20 hover:border-orange-500' },
    { value: 'sad', emoji: '😢', label: 'Sad', color: 'hover:bg-red-500/20 hover:border-red-500' }
  ];

  const handleLogout = () => {
    logout();
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/", label: "Home", icon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.1L1 12h3v9h7v-6h2v6h7v-9h3L12 2.1zm0 2.691l6 5.4V19h-3v-6H9v6H6v-8.809l6-5.4z"/>
      </svg>
    )},
    { path: "/discover", label: "Explore", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )},
    { path: "/notifications", label: "Notifications", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    )},
    { path: "/chat", label: "Chat", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )},
    { path: "/feeds", label: "Feeds", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    )},
    { path: "/lists", label: "Lists", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    )},
    { path: "/saved", label: "Saved", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    )},
    { path: profile ? `/profile/${profile.handle}` : "/profile", label: "Profile", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
    { path: "/settings", label: "Settings", icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-[#0a1627] dark:bg-[#0a1627]">
      {/* Container with max width and centered */}
      <div className="max-w-[1280px] mx-auto flex relative">
        {/* Left Sidebar - Navigation - Fixed position on xl */}
        <aside className="hidden md:flex flex-col w-[72px] xl:w-[275px] h-screen sticky top-0 p-2 xl:p-4 flex-shrink-0">
          {/* Logo */}
          <Link to="/" className="p-3 mb-2">
            <div className="w-12 h-12 bg-[#f3e85c] rounded-full flex items-center justify-center">
              <span className="text-[#0a1627] text-2xl font-bold">@</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-4 px-3 py-3 rounded-full transition-colors ${
                  isActive(item.path)
                    ? "text-white font-bold"
                    : "text-[#8899a6] hover:bg-[#1c2938] hover:text-white"
                }`}
              >
                {item.icon}
                <span className="hidden xl:block text-[17px]">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* New Post Button */}
          <button
            onClick={() => setShowComposeModal(true)}
            className="mt-4 bg-[#0085ff] hover:bg-[#0070db] text-white font-bold py-3 px-4 rounded-full transition flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="hidden xl:block">New Post</span>
          </button>

          {/* User profile at bottom */}
          {profile && (
            <div className="mt-4 pt-4 border-t border-[#2f3e4e]">
              <div className="flex items-center gap-3 p-2 rounded-full hover:bg-[#1c2938] transition cursor-pointer group relative">
                <img
                  src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.handle}`}
                  alt={profile.displayName || profile.handle}
                  className="w-10 h-10 rounded-full"
                />
                <div className="hidden xl:block flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{profile.displayName || profile.handle}</p>
                  <p className="text-[#8899a6] text-sm truncate">@{profile.handle}</p>
                </div>
                <svg className="w-5 h-5 text-[#8899a6] hidden xl:block" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
                
                {/* Dropdown menu */}
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1c2938] rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[#d9d9d9] hover:bg-[#2f3e4e] rounded-t-xl transition text-left"
                  >
                    {theme === "dark" ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    <span className="text-sm">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[#e0245e] hover:bg-[#2f3e4e] rounded-b-xl transition text-left"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-sm">Sign out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main Feed - centered with fixed width */}
        <main className="min-w-0 border-x border-[#2f3e4e] bg-[#0f1a2a] min-h-screen w-full md:w-[650px] lg:w-[700px] md:flex-shrink-0 pb-16 md:pb-0">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="hidden xl:block w-[350px] p-4 flex-shrink-0">
          {/* Profile Dashboard — shown when viewing a profile */}
          {profileHandle && profileDid ? (
            <div className="mb-4">
              <ProfileDashboard key={profileDid} did={profileDid} handle={profileHandle} />
            </div>
          ) : (
            <>
              {/* Today's Mood */}
              <div className="bg-[#1c2938] rounded-2xl p-3 border border-[#2f3e4e] mb-4">
                <h2 className="text-white font-bold text-sm mb-2">Today's mood</h2>
                <div className="flex justify-between gap-1.5">
                  {moods.map((mood) => (
                    <button
                      key={mood.value}
                      onClick={() => setSelectedMood(selectedMood === mood.value ? null : mood.value)}
                      className={`flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all ${
                        selectedMood === mood.value
                          ? 'border-[#1da1f2] bg-[#1da1f2]/10'
                          : `border-[#2f3e4e] ${mood.color}`
                      }`}
                      title={mood.label}
                    >
                      <span className="text-xl">{mood.emoji}</span>
                      <span className="text-[10px] text-[#8899a6] font-medium">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending */}
              <div className="bg-[#1c2938] rounded-2xl overflow-hidden mb-4">
                <div className="p-4 border-b border-[#2f3e4e]">
                  <h2 className="text-white font-extrabold text-xl">Trending</h2>
                </div>
                <div className="p-4 text-[#8899a6] text-sm">
                  Les tendances seront bientôt disponibles
                </div>
              </div>

              <div className="bg-[#1c2938] rounded-2xl overflow-hidden mb-4">
                <div className="p-4 border-b border-[#2f3e4e]">
                  <h2 className="text-white font-extrabold text-xl">Suggested follows</h2>
                </div>
                <div className="p-4 text-[#8899a6] text-sm">
                  Suggestions de comptes à suivre
                </div>
              </div>
            </>
          )}

          <div className="text-[#8899a6] text-xs p-4">
            <p>Terms · Privacy · Cookies</p>
            <p className="mt-1">© 2024 Bluesky Client</p>
          </div>
        </aside>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f1a2a] border-t border-[#2f3e4e] flex justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-50">
        <Link to="/" className={`p-3 ${isActive("/") ? "text-white" : "text-[#8899a6]"}`}>
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.1L1 12h3v9h7v-6h2v6h7v-9h3L12 2.1z"/>
          </svg>
        </Link>
        <Link to="/discover" className={`p-3 ${isActive("/discover") ? "text-white" : "text-[#8899a6]"}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </Link>
        <button onClick={() => setShowComposeModal(true)} className="p-3 text-[#0085ff]">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <Link to="/notifications" className={`p-3 ${isActive("/notifications") ? "text-white" : "text-[#8899a6]"}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </Link>
        <Link to={profile ? `/profile/${profile.handle}` : "/profile"} className={`p-3 ${location.pathname.startsWith("/profile") ? "text-white" : "text-[#8899a6]"}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </Link>
      </nav>

      {/* Compose Modal */}
      {showComposeModal && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-4 sm:pt-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowComposeModal(false);
          }}
        >
          <div className="bg-[#0f1a2a] sm:rounded-2xl w-full max-w-[600px] sm:mx-4 shadow-xl border-0 sm:border border-[#2f3e4e] min-h-screen sm:min-h-0">
            <div className="flex items-center justify-between p-4 border-b border-[#2f3e4e]">
              <button
                onClick={() => setShowComposeModal(false)}
                className="p-2 -ml-2 rounded-full hover:bg-[#1c2938] transition"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="font-bold text-white">New Post</span>
              <div className="w-9"></div>
            </div>
            <ComposePost 
              onPostCreated={() => setShowComposeModal(false)}
              onClose={() => setShowComposeModal(false)}
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}
