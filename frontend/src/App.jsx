import { useEffect, useState } from "react";
import ProfileGate from "./pages/ProfileGate.jsx";
import Trains from "./pages/Trains.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import Wallet from "./pages/Wallet.jsx";
import TrainBackground from "./components/TrainBackground.jsx";
import { api } from "./api/client.js";

const STORAGE_KEY = "railyatra_user_id";
const TABS = [
  { id: "trains", label: "Departures" },
  { id: "bookings", label: "My Bookings" },
  { id: "wallet", label: "Wallet" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("trains");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (!savedId) {
      setCheckingSession(false);
      return;
    }
    api
      .getProfile(savedId)
      .then(setUser)
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setCheckingSession(false));
  }, []);

  function handleProfileReady(profile) {
    localStorage.setItem(STORAGE_KEY, profile.id);
    setUser(profile);
  }

  function handleBalanceChange(newBalance) {
    setUser((prev) => ({ ...prev, wallet_balance: newBalance }));
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setTab("trains");
  }

  if (checkingSession) {
    return <div className="min-h-screen bg-platform-950" />;
  }

  if (!user) {
    return <ProfileGate onProfileReady={handleProfileReady} />;
  }

  return (
    <div className="min-h-screen bg-platform-950 text-white relative">
      <TrainBackground />
      <div className="relative z-10">
        <header className="border-b border-white/10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-6">
              <div>
                <p className="font-display font-bold text-lg leading-none">RailYatra</p>
                <p className="text-white/30 text-xs font-mono-nums">Platform 1</p>
              </div>
              <nav className="flex gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 rounded-md text-sm ${
                      tab === t.id ? "bg-flap-amber text-platform-950 font-semibold" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white/40 text-xs">{user.name}</p>
                <p className="font-mono-nums text-flap-amber text-sm">
                  ${Number(user.wallet_balance).toFixed(2)}
                </p>
              </div>
              <button onClick={handleLogout} className="text-white/40 hover:text-white text-sm">
                Switch profile
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          {tab === "trains" && <Trains user={user} onBalanceChange={handleBalanceChange} />}
          {tab === "bookings" && <MyBookings user={user} onBalanceChange={handleBalanceChange} />}
          {tab === "wallet" && <Wallet user={user} onBalanceChange={handleBalanceChange} />}
        </main>
      </div>
    </div>
  );
}
