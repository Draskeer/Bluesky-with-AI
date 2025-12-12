import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";

interface SettingsItem {
  label: string;
  description: string;
  icon: React.ReactNode;
  action?: () => void;
  external?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

export default function Settings() {
  const navigate = useNavigate();
  const { profile, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const settingsSections: SettingsSection[] = [
    {
      title: "Compte",
      items: [
        {
          label: "Informations du compte",
          description: `Connecté en tant que @${profile?.handle || "..."}`,
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          action: () => navigate(`/profile/${profile?.handle}`),
        },
        {
          label: "Modifier le profil",
          description: "Photo, nom, bio",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
          action: () => window.open("https://bsky.app/settings/profile", "_blank"),
          external: true,
        },
      ],
    },
    {
      title: "Apparence",
      items: [
        {
          label: "Thème",
          description: theme === "dark" ? "Mode sombre activé" : "Mode clair activé",
          icon: theme === "dark" ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          action: toggleTheme,
          toggle: true,
          toggleValue: theme === "dark",
        },
      ],
    },
    {
      title: "Confidentialité et sécurité",
      items: [
        {
          label: "Mots de passe d'application",
          description: "Gérer vos App Passwords",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          ),
          action: () => window.open("https://bsky.app/settings/app-passwords", "_blank"),
          external: true,
        },
        {
          label: "Comptes bloqués",
          description: "Gérer les utilisateurs bloqués",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          ),
          action: () => window.open("https://bsky.app/settings/moderation", "_blank"),
          external: true,
        },
        {
          label: "Comptes mutés",
          description: "Gérer les utilisateurs masqués",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ),
          action: () => window.open("https://bsky.app/settings/moderation", "_blank"),
          external: true,
        },
      ],
    },
    {
      title: "À propos",
      items: [
        {
          label: "Bluesky",
          description: "Ouvrir bsky.app",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          ),
          action: () => window.open("https://bsky.app", "_blank"),
          external: true,
        },
        {
          label: "Code source",
          description: "GitHub - Bluesky-with-AI",
          icon: (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          ),
          action: () => window.open("https://github.com/Draskeer/Bluesky-with-AI", "_blank"),
          external: true,
        },
        {
          label: "Version",
          description: "1.0.0",
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1a2a] border-b border-[#2f3e4e]">
        <div className="px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-[#1c2938] transition"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[19px] font-extrabold text-white">Settings</h1>
        </div>
      </div>

      {/* Profile card */}
      {profile && (
        <div className="p-4 border-b border-[#2f3e4e]">
          <div className="flex items-center gap-4">
            <img
              src={profile.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.handle}`}
              alt={profile.displayName || profile.handle}
              className="w-16 h-16 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-lg truncate">
                {profile.displayName || profile.handle}
              </p>
              <p className="text-[#8899a6] truncate">@{profile.handle}</p>
            </div>
          </div>
        </div>
      )}

      {/* Settings sections */}
      <div className="divide-y divide-[#2f3e4e]">
        {settingsSections.map((section) => (
          <div key={section.title} className="py-2">
            <h2 className="px-4 py-2 text-xs font-bold text-[#8899a6] uppercase tracking-wider">
              {section.title}
            </h2>
            <div>
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  disabled={!item.action}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#1c2938] transition text-left disabled:hover:bg-transparent disabled:cursor-default"
                >
                  <div className="text-[#8899a6]">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{item.label}</p>
                      {item.external && (
                        <svg className="w-4 h-4 text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      )}
                    </div>
                    <p className="text-[#8899a6] text-sm truncate">{item.description}</p>
                  </div>
                  {item.toggle !== undefined && (
                    <div
                      className={`w-12 h-7 rounded-full p-1 transition ${
                        item.toggleValue ? "bg-[#0085ff]" : "bg-[#2f3e4e]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          item.toggleValue ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  )}
                  {!item.toggle && item.action && (
                    <svg className="w-5 h-5 text-[#8899a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Logout button */}
      <div className="p-4 mt-4">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full py-3 px-4 bg-transparent border border-[#e0245e] text-[#e0245e] font-bold rounded-full hover:bg-[#e0245e]/10 transition"
        >
          Se déconnecter
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-8 text-center text-[#8899a6] text-sm">
        <p>Bluesky Client with AI</p>
      </div>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-[#0f1a2a] rounded-2xl w-full max-w-[320px] p-6 border border-[#2f3e4e]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-2">Se déconnecter ?</h3>
            <p className="text-[#8899a6] mb-6">
              Vous pouvez toujours vous reconnecter à tout moment.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-[#e0245e] text-white font-bold rounded-full hover:bg-[#c9203f] transition"
              >
                Se déconnecter
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-3 bg-transparent border border-[#2f3e4e] text-white font-bold rounded-full hover:bg-[#1c2938] transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
