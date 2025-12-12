import { useState } from "react";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(identifier, password);
  };

  return (
    <div className="min-h-screen bg-[#1da1f2] dark:bg-[#15202b] flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative">
        <svg viewBox="0 0 24 24" className="w-96 h-96 text-white dark:text-[#1da1f2] fill-current opacity-90">
          <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/>
        </svg>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#192734] p-8 relative">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition text-[#657786] dark:text-[#8899a6] hover:text-[#1da1f2]"
          title={theme === "dark" ? "Mode clair" : "Mode sombre"}
        >
          {theme === "dark" ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <div className="w-full max-w-[400px]">
          {/* Twitter bird icon for mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <svg viewBox="0 0 24 24" className="w-12 h-12 text-[#1da1f2] fill-current">
              <path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/>
            </svg>
          </div>

          <h1 className="text-[31px] font-bold text-[#14171a] dark:text-[#d9d9d9] leading-tight mb-3">
            Découvrez ce qui se passe
          </h1>
          <p className="text-[15px] text-[#657786] dark:text-[#8899a6] mb-8">
            Connectez-vous avec votre compte Bluesky
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Handle ou email"
                className="w-full px-3 py-3 border border-[#ccd6dd] dark:border-[#38444d] rounded text-[15px] text-[#14171a] dark:text-[#d9d9d9] bg-white dark:bg-[#15202b] placeholder:text-[#657786] dark:placeholder:text-[#8899a6] focus:outline-none focus:border-[#1da1f2] focus:ring-1 focus:ring-[#1da1f2] transition"
                required
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe d'application"
                className="w-full px-3 py-3 border border-[#ccd6dd] dark:border-[#38444d] rounded text-[15px] text-[#14171a] dark:text-[#d9d9d9] bg-white dark:bg-[#15202b] placeholder:text-[#657786] dark:placeholder:text-[#8899a6] focus:outline-none focus:border-[#1da1f2] focus:ring-1 focus:ring-[#1da1f2] transition"
                required
              />
            </div>

            {error && (
              <div className="bg-[#fce8ef] dark:bg-[#e0245e]/20 text-[#e0245e] px-4 py-3 rounded text-[14px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1da1f2] hover:bg-[#1a91da] text-white font-bold py-3 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed text-[15px]"
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[13px] text-[#657786] dark:text-[#8899a6]">
              Mot de passe d'application requis.{" "}
              <a
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1da1f2] hover:underline"
              >
                Créer un mot de passe
              </a>
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-[#e6ecf0] dark:border-[#38444d]">
            <p className="text-[15px] font-bold text-[#14171a] dark:text-[#d9d9d9] mb-3">
              Nouveau sur Bluesky ?
            </p>
            <a
              href="https://bsky.app"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-white dark:bg-transparent text-[#1da1f2] font-bold py-3 rounded-full border border-[#1da1f2] hover:bg-[#e8f5fe] dark:hover:bg-[#1da1f2]/10 transition text-[15px]"
            >
              S'inscrire
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
