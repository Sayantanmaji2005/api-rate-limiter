let currentUser = null;
let currentApiKey = null;

function setDashboardMessage(text, isError = false) {
  const messageBox = document.getElementById("dashboardMessage");
  messageBox.textContent = text;
  messageBox.classList.remove("hidden");
  if (isError) {
    messageBox.classList.add("error");
    messageBox.classList.remove("message");
  } else {
    messageBox.classList.remove("error");
    messageBox.classList.add("message");
  }
}

function applySummary(summary) {
  document.getElementById("totalRequestsStat").textContent = summary.totalRequests ?? 0;
  document.getElementById("blockedRequestsStat").textContent = summary.blockedRequests ?? 0;
  document.getElementById("avgLatencyStat").textContent = `${summary.avgLatencyMs ?? 0} ms`;
}

function applyUserInfo(user, apiKey) {
  currentUser = user;
  currentApiKey = apiKey;

  document.getElementById("emailStat").textContent = user?.email || "N/A";
  document.getElementById("roleStat").textContent = user?.role || "N/A";
  document.getElementById("tierStat").textContent = user?.tier || "N/A";
  document.getElementById("algorithmStat").textContent =
    user?.rateLimitAlgorithm || "TOKEN_BUCKET";
  document.getElementById("algorithmSelect").value =
    user?.rateLimitAlgorithm || "TOKEN_BUCKET";
  document.getElementById("apiKeyCode").textContent = apiKey || "Unavailable";
}

function renderAnalytics(logs) {
  const list = document.getElementById("analyticsList");
  const state = document.getElementById("analyticsState");
  list.innerHTML = "";

  if (!Array.isArray(logs) || logs.length === 0) {
    state.textContent = "No request logs yet.";
    state.classList.remove("hidden");
    return;
  }

  state.classList.add("hidden");
  logs.forEach((item) => {
    const li = document.createElement("li");
    const date = new Date(item.timestamp).toLocaleString();
    li.innerHTML =
      `<span>${date}</span>` +
      `<strong>${item.method || "GET"}</strong>` +
      `<code>${item.endpoint || "-"}</code>` +
      `<span>(${item.algorithm || "N/A"}, cost ${item.cost || 1}, ${item.allowed ? "allowed" : "blocked"})</span>`;
    list.appendChild(li);
  });
}

async function refreshUserAndNav() {
  const me = await requireUser();
  if (!me) {
    return null;
  }
  applyUserInfo(me.user, me.apiKey);
  return me;
}

async function loadAnalytics() {
  try {
    const response = await apiRequest("/api/analytics");
    renderAnalytics(response.data || []);
  } catch {
    renderAnalytics([]);
  }
}

async function loadSummary() {
  try {
    const response = await apiRequest("/api/analytics/summary");
    applySummary(response.data || {});
  } catch {
    applySummary({
      totalRequests: 0,
      blockedRequests: 0,
      avgLatencyMs: 0
    });
  }
}

async function loadLimiterStatus() {
  const element = document.getElementById("limiterStatus");
  try {
    const response = await apiRequest("/api/limiter-status");
    const status = response.data?.circuitBreaker || null;
    if (!status) {
      element.textContent = "Circuit Breaker: Unknown";
      return;
    }
    element.textContent = `Circuit Breaker: ${status.state} | Failures: ${status.failureCount}`;
  } catch {
    element.textContent = "Circuit Breaker: Unavailable";
  }
}

async function callProtected(path, loadingButton, defaultError) {
  loadingButton.disabled = true;
  const originalLabel = loadingButton.textContent;
  loadingButton.textContent = "Calling...";
  try {
    const response = await apiRequest(path);
    const remaining = response.data?.rateLimit?.remaining;
    if (path === "/api/data") {
      setDashboardMessage(
        `${response.data?.message || "Protected API Access Granted"}${
          Number.isFinite(remaining) ? ` (remaining: ${remaining})` : ""
        }`
      );
    } else {
      setDashboardMessage(response.data?.message || "Heavy endpoint served");
    }
    await loadAnalytics();
    await loadSummary();
  } catch (error) {
    if (error?.response?.status === 429) {
      const retryAfter = error?.response?.headers?.get("retry-after");
      if (path === "/api/heavy-data") {
        setDashboardMessage(
          `Heavy endpoint blocked by rate limit${retryAfter ? `. Retry in ~${retryAfter}s.` : "."}`,
          true
        );
      } else {
        setDashboardMessage(
          `Rate limit exceeded${retryAfter ? `. Retry in ~${retryAfter}s.` : "."}`,
          true
        );
      }
    } else {
      setDashboardMessage(getApiErrorMessage(error, defaultError), true);
    }
  } finally {
    loadingButton.disabled = false;
    loadingButton.textContent = originalLabel;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const me = await refreshUserAndNav();
  if (!me) {
    return;
  }

  await Promise.all([loadAnalytics(), loadSummary(), loadLimiterStatus()]);

  document.getElementById("callProtectedBtn").addEventListener("click", async () => {
    await callProtected(
      "/api/data",
      document.getElementById("callProtectedBtn"),
      "Error calling protected API."
    );
  });

  document.getElementById("callHeavyBtn").addEventListener("click", async () => {
    await callProtected(
      "/api/heavy-data",
      document.getElementById("callHeavyBtn"),
      "Error calling heavy endpoint."
    );
  });

  document.getElementById("refreshAnalyticsBtn").addEventListener("click", loadAnalytics);
  document.getElementById("refreshSummaryBtn").addEventListener("click", loadSummary);
  document.getElementById("refreshCircuitBtn").addEventListener("click", loadLimiterStatus);

  document.getElementById("algorithmSelect").addEventListener("change", async (event) => {
    try {
      await apiRequest("/api/settings/algorithm", {
        method: "PUT",
        body: { algorithm: event.target.value }
      });
      await refreshUserAndNav();
      setDashboardMessage(`Algorithm switched to ${event.target.value}`);
    } catch (error) {
      setDashboardMessage(getApiErrorMessage(error, "Failed to update algorithm."), true);
    }
  });

  document.getElementById("saveRuleBtn").addEventListener("click", async () => {
    const endpoint = document.getElementById("ruleEndpointInput").value;
    const cost = Number(document.getElementById("ruleCostInput").value);
    try {
      await apiRequest("/api/settings/rules", {
        method: "PUT",
        body: {
          endpoint,
          method: "GET",
          cost
        }
      });
      await refreshUserAndNav();
      setDashboardMessage(`Rule updated: GET ${endpoint}, cost=${cost}`);
    } catch (error) {
      setDashboardMessage(getApiErrorMessage(error, "Failed to save rule."), true);
    }
  });

  document.getElementById("rotateApiKeyBtn").addEventListener("click", async () => {
    try {
      await apiRequest("/auth/rotate-api-key", { method: "POST" });
      await refreshUserAndNav();
      setDashboardMessage("API key rotated successfully.");
    } catch (error) {
      setDashboardMessage(getApiErrorMessage(error, "Failed to rotate API key."), true);
    }
  });

  document.getElementById("copyApiKeyBtn").addEventListener("click", async () => {
    if (!currentApiKey) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentApiKey);
      setDashboardMessage("API key copied to clipboard.");
    } catch {
      setDashboardMessage("Could not copy API key. Copy it manually.", true);
    }
  });
});
