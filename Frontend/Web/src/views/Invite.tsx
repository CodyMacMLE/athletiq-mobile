import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const APP_SCHEME = "athletiq";

export function Invite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Try to open the app via deep link
    const deepLink = `${APP_SCHEME}://accept-invite?token=${token}`;
    window.location.href = deepLink;

    // If still here after a short delay, the app isn't installed
    const timeout = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timeout);
  }, [token]);

  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ ...styles.iconCircle, ...styles.errorCircle }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h1 style={styles.heading}>Invalid Invite Link</h1>
          <p style={styles.message}>This invite link is missing a token. Please check the link and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {!showFallback ? (
          <>
            <div style={styles.spinner} />
            <h1 style={styles.heading}>Opening Athletiq...</h1>
            <p style={styles.message}>You should be redirected to the app momentarily.</p>
          </>
        ) : (
          <>
            <div style={styles.logoContainer}>
              <h1 style={styles.logo}>Athletiq</h1>
            </div>
            <h2 style={styles.heading}>Get the Athletiq App</h2>
            <p style={styles.message}>
              You've been invited to join an organization on Athletiq. Download the app to accept your invitation.
            </p>
            <div style={styles.buttonGroup}>
              <a href={`${APP_SCHEME}://accept-invite?token=${token}`} style={styles.primaryButton}>
                Open in App
              </a>
            </div>
            <p style={styles.footnote}>
              If you already have the app installed, tap "Open in App" above.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #302b6f 0%, #4d2a69 50%, #302b6f 100%)",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    padding: "48px 32px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
  },
  logoContainer: {
    marginBottom: "24px",
  },
  logo: {
    color: "white",
    fontSize: "32px",
    fontWeight: "800",
    margin: 0,
  },
  heading: {
    color: "white",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 8px",
  },
  message: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "12px 0 0",
  },
  iconCircle: {
    width: "72px",
    height: "72px",
    borderRadius: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
  },
  errorCircle: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  buttonGroup: {
    marginTop: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  primaryButton: {
    display: "block",
    padding: "14px 24px",
    background: "linear-gradient(135deg, #6c5ce7, #a855f7)",
    color: "white",
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    borderRadius: "12px",
    textAlign: "center",
  },
  footnote: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: "13px",
    marginTop: "20px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(255,255,255,0.1)",
    borderTopColor: "#a855f7",
    borderRadius: "50%",
    margin: "0 auto 24px",
    animation: "spin 0.8s linear infinite",
  },
};

// Inject spinner animation
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleEl);
}
