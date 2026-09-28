import ChatScreen from "./components/ChatScreen";
import LoginScreen from "./components/LoginScreen";
import { useCredentials } from "./hooks/useCredentials";

export default function App() {
  const { credentials, login, logout } = useCredentials();

  if (!credentials) {
    return <LoginScreen onLogin={login} />;
  }

  // ChatScreen (and the chat store hooks) mounts only while logged in,
  // so the Rules of Hooks are never violated across login/logout.
  return <ChatScreen credentials={credentials} onLogout={logout} />;
}
