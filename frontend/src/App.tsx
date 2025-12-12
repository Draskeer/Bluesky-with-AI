import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth.store";
import Login from "./pages/Login";
import Feed from "./pages/Feed";
import Discover from "./pages/Discover";
import Profile from "./pages/Profile";
import Thread from "./pages/Thread";
import Notifications from "./pages/Notifications";
import Chat from "./pages/Chat";
import Settings from "./pages/Settings";
import Feeds from "./pages/Feeds";
import Lists from "./pages/Lists";
import Saved from "./pages/Saved";
import Layout from "./components/Layout";

function App() {
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);
  const resumeSession = useAuthStore((state) => state.resumeSession);
  const isAuthenticated = session !== null;

  // Resume session on app load
  useEffect(() => {
    if (session) {
      resumeSession();
    }
  }, []); // Only run once on mount

  // Show loading while resuming session
  if (isLoading && session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-500">Connexion en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" /> : <Login />}
      />
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Layout>
              <Feed />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/discover"
        element={
          isAuthenticated ? (
            <Layout>
              <Discover />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/notifications"
        element={
          isAuthenticated ? (
            <Layout>
              <Notifications />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/chat"
        element={
          isAuthenticated ? (
            <Layout>
              <Chat />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/profile/:handle"
        element={
          isAuthenticated ? (
            <Layout>
              <Profile />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/post/*"
        element={
          isAuthenticated ? (
            <Layout>
              <Thread />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/settings"
        element={
          isAuthenticated ? (
            <Layout>
              <Settings />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/feeds"
        element={
          isAuthenticated ? (
            <Layout>
              <Feeds />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/lists"
        element={
          isAuthenticated ? (
            <Layout>
              <Lists />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/saved"
        element={
          isAuthenticated ? (
            <Layout>
              <Saved />
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

export default App;
