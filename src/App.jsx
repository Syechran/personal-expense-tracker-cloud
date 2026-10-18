import { useEffect, useState } from "react";
import { Plus, Home as HomeIcon, BarChart2 } from "lucide-react";
import Home from "./pages/Home";
import Overview from "./pages/Overview";
import AddTransaction from "./pages/AddTransaction";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import { apiFetch } from "./api";
import "./App.css";

function App() {
  const [activeScreen, setActiveScreen] = useState("home");
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    apiFetch("/api/auth/me")
      .then((result) => {
        if (!isCancelled) setUser(result.data);
      })
      .catch(() => {
        if (!isCancelled) setUser(null);
      })
      .finally(() => {
        if (!isCancelled) setIsCheckingAuth(false);
      });

    const handleExpired = () => {
      setUser(null);
      setActiveScreen("home");
    };

    window.addEventListener("auth:expired", handleExpired);

    return () => {
      isCancelled = true;
      window.removeEventListener("auth:expired", handleExpired);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Sesi lokal tetap dibersihkan meskipun request logout gagal.
    }

    setUser(null);
    setActiveScreen("home");
  };

  if (isCheckingAuth) {
    return (
      <div className="app-container">
        <div className="auth-loading">Memuat...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-container">
        <Auth onAuth={setUser} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* AREA HALAMAN */}
      <div className="main-content">
        {activeScreen === "home" && (
          <Home
            user={user}
            onOpenProfile={() => setActiveScreen("profile")}
          />
        )}
        {activeScreen === "overview" && <Overview />}
        {activeScreen === "profile" && (
          <Profile
            user={user}
            onUserUpdate={setUser}
            onLogout={handleLogout}
            onBack={() => setActiveScreen("home")}
          />
        )}

        {/* Pass parameter onClose agar form bisa kembali ke home */}
        {activeScreen === "add" && (
          <AddTransaction
            user={user}
            onClose={() => setActiveScreen("home")}
          />
        )}
      </div>

      {/* BOTTOM NAVIGATION (Disembunyikan saat activeScreen === 'add') */}
      {activeScreen !== "add" && (
        <nav className="bottom-nav">
          <div className="nav-container">
            <div
              className="nav-item"
              onClick={() => setActiveScreen("home")}
              style={{
                backgroundColor:
                  activeScreen === "home" ? "white" : "transparent",
                color: activeScreen === "home" ? "black" : "white",
              }}
            >
              <HomeIcon size={28} />
            </div>
            <div
              className="nav-item"
              onClick={() => setActiveScreen("add")}
              style={{
                backgroundColor:
                  activeScreen === "add" ? "white" : "transparent",
                color: activeScreen === "add" ? "black" : "white",
              }}
            >
              <Plus size={32} />
            </div>
            <div
              className="nav-item"
              onClick={() => setActiveScreen("overview")}
              style={{
                backgroundColor:
                  activeScreen === "overview" ? "white" : "transparent",
                color: activeScreen === "overview" ? "black" : "white",
              }}
            >
              <BarChart2 size={28} />
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}

export default App;
