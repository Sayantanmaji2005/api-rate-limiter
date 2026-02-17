import { useEffect, useState } from "react";
import API from "../api/api";
import { getApiErrorMessage } from "../api/errors";

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [error, setError] = useState("");
  const [ipInput, setIpInput] = useState({});
  const [summary, setSummary] = useState({
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    avgLatencyMs: 0,
    impactedUsers: 0
  });

  const loadAdminData = async () => {
    try {
      setError("");
      const [usersRes, analyticsRes] = await Promise.all([
        API.get("/admin/users"),
        API.get("/admin/analytics"),
      ]);
      setUsers(usersRes.data || []);
      setAnalytics(analyticsRes.data || []);
      const summaryRes = await API.get("/admin/analytics/summary");
      setSummary(summaryRes.data || {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        avgLatencyMs: 0,
        impactedUsers: 0
      });
    } catch {
      setError("Admin access denied or server unavailable.");
      setUsers([]);
      setAnalytics([]);
      setSummary({
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        avgLatencyMs: 0,
        impactedUsers: 0
      });
    }
  };

  const updateTier = async (userId, tier) => {
    try {
      await API.put(`/admin/upgrade/${userId}`, { tier });
      await loadAdminData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update user tier."));
    }
  };

  const updateAlgorithm = async (userId, algorithm) => {
    try {
      await API.put(`/admin/users/${userId}/algorithm`, { algorithm });
      await loadAdminData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update algorithm."));
    }
  };

  const updateIpPolicy = async (userId, field, action) => {
    const ip = ipInput[userId];
    if (!ip) {
      setError("Enter an IP before updating whitelist/blacklist.");
      return;
    }

    try {
      await API.put(`/admin/users/${userId}/${field}`, { ip, action });
      setIpInput((prev) => ({ ...prev, [userId]: "" }));
      await loadAdminData();
    } catch (err) {
      setError(getApiErrorMessage(err, `Failed to update ${field}.`));
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  return (
    <section className="admin reveal">
      <div className="panel">
        <h2>Admin Control Center</h2>
        <p className="muted">Manage plans and audit request behavior across users.</p>
        {error && <p className="error">{error}</p>}
        <div className="stats-grid">
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
          <article className="stat-card">
            <h4>Impacted Users</h4>
            <p>{summary.impactedUsers}</p>
          </article>
        </div>

        <h3>Users</h3>
        {users.length === 0 ? (
          <p className="muted">No users found.</p>
        ) : (
          <div className="table-wrap">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Tier</th>
                  <th>Algorithm</th>
                  <th>Update Tier</th>
                  <th>IP Policy</th>
                  <th>Current Lists</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.tier}</td>
                    <td>{user.rateLimitAlgorithm || "TOKEN_BUCKET"}</td>
                    <td>
                      <div className="form-grid">
                        <select
                          value={user.tier}
                          onChange={(e) => updateTier(user._id, e.target.value)}
                        >
                          <option value="FREE">FREE</option>
                          <option value="PRO">PRO</option>
                          <option value="ENTERPRISE">ENTERPRISE</option>
                        </select>
                        <select
                          value={user.rateLimitAlgorithm || "TOKEN_BUCKET"}
                          onChange={(e) => updateAlgorithm(user._id, e.target.value)}
                        >
                          <option value="TOKEN_BUCKET">TOKEN_BUCKET</option>
                          <option value="SLIDING_WINDOW">SLIDING_WINDOW</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="form-grid">
                        <input
                          placeholder="IP (e.g. ::1)"
                          value={ipInput[user._id] || ""}
                          onChange={(e) =>
                            setIpInput((prev) => ({ ...prev, [user._id]: e.target.value }))
                          }
                        />
                        <div className="actions">
                          <button
                            className="btn btn-outline"
                            onClick={() => updateIpPolicy(user._id, "whitelist", "add")}
                          >
                            +Whitelist
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => updateIpPolicy(user._id, "blacklist", "add")}
                          >
                            +Blacklist
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => updateIpPolicy(user._id, "whitelist", "remove")}
                          >
                            -Whitelist
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => updateIpPolicy(user._id, "blacklist", "remove")}
                          >
                            -Blacklist
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="muted">
                        W: {(user.whitelist || []).join(", ") || "-"}
                      </div>
                      <div className="muted">
                        B: {(user.blacklist || []).join(", ") || "-"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Recent Analytics</h3>
        {analytics.length === 0 ? (
          <p className="muted">No logs available.</p>
        ) : (
          <ul className="log-list">
            {analytics.map((entry) => (
              <li key={entry._id}>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
                <strong>{entry.method}</strong>
                <code>{entry.endpoint}</code> <span>({entry.algorithm || "N/A"}, cost {entry.cost || 1})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default Admin;
