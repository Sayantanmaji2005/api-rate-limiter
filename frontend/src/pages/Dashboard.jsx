import { useContext, useEffect, useState } from "react";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";
import { getApiErrorMessage } from "../api/errors";

const Dashboard = () => {
  const { user, apiKey, refreshUser } = useContext(AuthContext);
  const [message, setMessage] = useState("");
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [algorithm, setAlgorithm] = useState("TOKEN_BUCKET");
  const [limiterStatus, setLimiterStatus] = useState(null);
  const [ruleEndpoint, setRuleEndpoint] = useState("/api/heavy-data");
  const [ruleCost, setRuleCost] = useState(5);
  const [summary, setSummary] = useState({
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    avgLatencyMs: 0,
    totalCost: 0,
    topEndpoint: null
  });
  const [callingApi, setCallingApi] = useState(false);

  const callProtectedAPI = async () => {
    try {
      setCallingApi(true);
      const res = await API.get("/api/data");
      const remaining = res.data?.rateLimit?.remaining;
      setMessage(
        `${res.data.message}${Number.isFinite(remaining) ? ` (remaining: ${remaining})` : ""}`
      );
      await loadAnalytics();
      await loadSummary();
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers?.["retry-after"];
        setMessage(
          `Rate limit exceeded${retryAfter ? `. Retry in ~${retryAfter}s.` : "."}`
        );
      } else {
        setMessage(getApiErrorMessage(error, "Error calling protected API."));
      }
    } finally {
      setCallingApi(false);
    }
  };

  const callHeavyAPI = async () => {
    try {
      setCallingApi(true);
      const res = await API.get("/api/heavy-data");
      setMessage(res.data.message);
      await loadAnalytics();
      await loadSummary();
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response?.headers?.["retry-after"];
        setMessage(
          `Heavy endpoint blocked by rate limit${retryAfter ? `. Retry in ~${retryAfter}s.` : "."}`
        );
      } else {
        setMessage(getApiErrorMessage(error, "Error calling heavy endpoint."));
      }
    } finally {
      setCallingApi(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await API.get("/api/analytics");
      setAnalytics(res.data || []);
    } catch {
      setAnalytics([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLimiterStatus = async () => {
    try {
      const res = await API.get("/api/limiter-status");
      setLimiterStatus(res.data?.circuitBreaker || null);
    } catch {
      setLimiterStatus(null);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await API.get("/api/analytics/summary");
      setSummary(
        res.data || {
          totalRequests: 0,
          allowedRequests: 0,
          blockedRequests: 0,
          avgLatencyMs: 0,
          totalCost: 0,
          topEndpoint: null
        }
      );
    } catch {
      setSummary({
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        avgLatencyMs: 0,
        totalCost: 0,
        topEndpoint: null
      });
    }
  };

  const updateAlgorithm = async (nextAlgorithm) => {
    try {
      await API.put("/api/settings/algorithm", { algorithm: nextAlgorithm });
      setAlgorithm(nextAlgorithm);
      await refreshUser();
      setMessage(`Algorithm switched to ${nextAlgorithm}`);
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to update algorithm."));
    }
  };

  const upsertRule = async () => {
    try {
      await API.put("/api/settings/rules", {
        endpoint: ruleEndpoint,
        method: "GET",
        cost: Number(ruleCost)
      });
      setMessage(`Rule updated: GET ${ruleEndpoint}, cost=${ruleCost}`);
      await refreshUser();
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to save rule."));
    }
  };

  const rotateApiKey = async () => {
    try {
      await API.post("/auth/rotate-api-key");
      await refreshUser();
      setMessage("API key rotated successfully.");
    } catch (error) {
      setMessage(getApiErrorMessage(error, "Failed to rotate API key."));
    }
  };

  const copyApiKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setMessage("API key copied to clipboard.");
    } catch {
      setMessage("Could not copy API key. Copy it manually.");
    }
  };

  useEffect(() => {
    refreshUser();
    loadAnalytics();
    loadSummary();
    loadLimiterStatus();
  }, []);

  useEffect(() => {
    if (user?.rateLimitAlgorithm) {
      setAlgorithm(user.rateLimitAlgorithm);
    }
  }, [user]);

  return (
    <section className="dashboard reveal">
      <div className="panel">
        <h2>API Dashboard</h2>
        <p className="muted">Live controls for algorithm, costs, and protected endpoints.</p>
        <div className="stats-grid">
          <article className="stat-card">
            <h4>Email</h4>
            <p>{user?.email || "N/A"}</p>
          </article>
          <article className="stat-card">
            <h4>Role</h4>
            <p>{user?.role || "N/A"}</p>
          </article>
          <article className="stat-card">
            <h4>Tier</h4>
            <p>{user?.tier || "N/A"}</p>
          </article>
          <article className="stat-card">
            <h4>Algorithm</h4>
            <p>{user?.rateLimitAlgorithm || "TOKEN_BUCKET"}</p>
          </article>
          <article className="stat-card">
            <h4>Total Requests</h4>
            <p>{summary.totalRequests}</p>
          </article>
          <article className="stat-card">
            <h4>Blocked</h4>
            <p>{summary.blockedRequests}</p>
          </article>
          <article className="stat-card">
            <h4>Avg Latency</h4>
            <p>{summary.avgLatencyMs} ms</p>
          </article>
        </div>
        <div className="callout">
          <p>API key</p>
          <code>{apiKey || "Unavailable"}</code>
          <div className="actions">
            <button className="btn btn-outline" onClick={copyApiKey}>
              Copy API Key
            </button>
            <button className="btn btn-outline" onClick={rotateApiKey}>
              Rotate API Key
            </button>
          </div>
        </div>
        <div className="actions">
          <select value={algorithm} onChange={(e) => updateAlgorithm(e.target.value)}>
            <option value="TOKEN_BUCKET">TOKEN_BUCKET</option>
            <option value="SLIDING_WINDOW">SLIDING_WINDOW</option>
          </select>
          <button className="btn btn-outline" onClick={loadLimiterStatus}>
            Refresh Circuit Status
          </button>
        </div>
        {limiterStatus && (
          <p className="muted">
            Circuit Breaker: <strong>{limiterStatus.state}</strong> | Failures:{" "}
            {limiterStatus.failureCount}
          </p>
        )}
        <div className="actions">
          <button className="btn btn-primary" onClick={callProtectedAPI}>
            {callingApi ? "Calling..." : "Call Protected API"}
          </button>
          <button className="btn btn-primary" onClick={callHeavyAPI}>
            {callingApi ? "Calling..." : "Call Heavy API (cost-based)"}
          </button>
          <button className="btn btn-outline" onClick={loadAnalytics}>
            Refresh Analytics
          </button>
          <button className="btn btn-outline" onClick={loadSummary}>
            Refresh Summary
          </button>
        </div>
        <div className="actions">
          <input
            value={ruleEndpoint}
            onChange={(e) => setRuleEndpoint(e.target.value)}
            placeholder="/api/your-endpoint"
          />
          <input
            type="number"
            min="1"
            max="20"
            value={ruleCost}
            onChange={(e) => setRuleCost(e.target.value)}
            placeholder="cost"
          />
          <button className="btn btn-outline" onClick={upsertRule}>
            Save Custom Rule
          </button>
        </div>
        {message && <p className="message">{message}</p>}
      </div>

      <div className="panel">
        <h3>Recent Requests</h3>
        {loading ? (
          <p className="muted">Loading analytics...</p>
        ) : analytics.length === 0 ? (
          <p className="muted">No request logs yet.</p>
        ) : (
          <ul className="log-list">
            {analytics.map((item) => (
              <li key={item._id}>
                <span>{new Date(item.timestamp).toLocaleString()}</span>
                <strong>{item.method}</strong>
                <code>{item.endpoint}</code>{" "}
                <span>
                  ({item.algorithm || "N/A"}, cost {item.cost || 1}, {item.allowed ? "allowed" : "blocked"})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default Dashboard;
