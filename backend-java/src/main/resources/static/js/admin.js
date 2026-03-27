function setAdminError(message) {
  const error = document.getElementById("adminError");
  if (!message) {
    error.classList.add("hidden");
    error.textContent = "";
    return;
  }
  error.textContent = message;
  error.classList.remove("hidden");
}

function applyAdminSummary(summary) {
  document.getElementById("totalRequestsStat").textContent = summary.totalRequests ?? 0;
  document.getElementById("blockedRequestsStat").textContent = summary.blockedRequests ?? 0;
  document.getElementById("avgLatencyStat").textContent = `${summary.avgLatencyMs ?? 0} ms`;
  document.getElementById("impactedUsersStat").textContent = summary.impactedUsers ?? 0;
}

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  const emptyState = document.getElementById("usersEmpty");
  tbody.innerHTML = "";

  if (!Array.isArray(users) || users.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  users.forEach((user) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${user.email || "-"}</td>
      <td>${user.role || "-"}</td>
      <td>${user.tier || "-"}</td>
      <td>${user.rateLimitAlgorithm || "TOKEN_BUCKET"}</td>
      <td>
        <div class="form-grid">
          <select class="tier-select" data-user-id="${user._id}">
            <option value="FREE" ${user.tier === "FREE" ? "selected" : ""}>FREE</option>
            <option value="PRO" ${user.tier === "PRO" ? "selected" : ""}>PRO</option>
            <option value="ENTERPRISE" ${user.tier === "ENTERPRISE" ? "selected" : ""}>ENTERPRISE</option>
          </select>
          <select class="algo-select" data-user-id="${user._id}">
            <option value="TOKEN_BUCKET" ${user.rateLimitAlgorithm === "TOKEN_BUCKET" ? "selected" : ""}>TOKEN_BUCKET</option>
            <option value="SLIDING_WINDOW" ${user.rateLimitAlgorithm === "SLIDING_WINDOW" ? "selected" : ""}>SLIDING_WINDOW</option>
          </select>
        </div>
      </td>
      <td>
        <div class="form-grid">
          <input id="ip-${user._id}" placeholder="IP (e.g. ::1)" />
          <div class="actions">
            <button type="button" class="btn btn-outline ip-action" data-user-id="${user._id}" data-field="whitelist" data-action="add">+Whitelist</button>
            <button type="button" class="btn btn-outline ip-action" data-user-id="${user._id}" data-field="blacklist" data-action="add">+Blacklist</button>
            <button type="button" class="btn btn-outline ip-action" data-user-id="${user._id}" data-field="whitelist" data-action="remove">-Whitelist</button>
            <button type="button" class="btn btn-outline ip-action" data-user-id="${user._id}" data-field="blacklist" data-action="remove">-Blacklist</button>
          </div>
        </div>
      </td>
      <td>
        <div class="muted">W: ${(user.whitelist || []).join(", ") || "-"}</div>
        <div class="muted">B: ${(user.blacklist || []).join(", ") || "-"}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  attachUserActionHandlers();
}

function renderAnalytics(analytics) {
  const list = document.getElementById("analyticsList");
  const emptyState = document.getElementById("analyticsEmpty");
  list.innerHTML = "";
  if (!Array.isArray(analytics) || analytics.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  analytics.forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML =
      `<span>${new Date(entry.timestamp).toLocaleString()}</span>` +
      `<strong>${entry.method || "-"}</strong>` +
      `<code>${entry.endpoint || "-"}</code>` +
      `<span>(${entry.algorithm || "N/A"}, cost ${entry.cost || 1})</span>`;
    list.appendChild(li);
  });
}

async function loadAdminData() {
  try {
    setAdminError("");
    const [usersRes, analyticsRes, summaryRes] = await Promise.all([
      apiRequest("/admin/users"),
      apiRequest("/admin/analytics"),
      apiRequest("/admin/analytics/summary")
    ]);

    renderUsers(usersRes.data || []);
    renderAnalytics(analyticsRes.data || []);
    applyAdminSummary(summaryRes.data || {});
  } catch {
    setAdminError("Admin access denied or server unavailable.");
    renderUsers([]);
    renderAnalytics([]);
    applyAdminSummary({
      totalRequests: 0,
      blockedRequests: 0,
      avgLatencyMs: 0,
      impactedUsers: 0
    });
  }
}

async function updateTier(userId, tier) {
  try {
    await apiRequest(`/admin/upgrade/${userId}`, {
      method: "PUT",
      body: { tier }
    });
    await loadAdminData();
  } catch (error) {
    setAdminError(getApiErrorMessage(error, "Failed to update user tier."));
  }
}

async function updateAlgorithm(userId, algorithm) {
  try {
    await apiRequest(`/admin/users/${userId}/algorithm`, {
      method: "PUT",
      body: { algorithm }
    });
    await loadAdminData();
  } catch (error) {
    setAdminError(getApiErrorMessage(error, "Failed to update algorithm."));
  }
}

async function updateIpPolicy(userId, field, action) {
  const ipInput = document.getElementById(`ip-${userId}`);
  const ip = ipInput?.value?.trim();
  if (!ip) {
    setAdminError("Enter an IP before updating whitelist/blacklist.");
    return;
  }

  try {
    await apiRequest(`/admin/users/${userId}/${field}`, {
      method: "PUT",
      body: { ip, action }
    });
    await loadAdminData();
  } catch (error) {
    setAdminError(getApiErrorMessage(error, `Failed to update ${field}.`));
  }
}

function attachUserActionHandlers() {
  document.querySelectorAll(".tier-select").forEach((select) => {
    select.addEventListener("change", async (event) => {
      const userId = event.target.dataset.userId;
      await updateTier(userId, event.target.value);
    });
  });

  document.querySelectorAll(".algo-select").forEach((select) => {
    select.addEventListener("change", async (event) => {
      const userId = event.target.dataset.userId;
      await updateAlgorithm(userId, event.target.value);
    });
  });

  document.querySelectorAll(".ip-action").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const userId = event.target.dataset.userId;
      const field = event.target.dataset.field;
      const action = event.target.dataset.action;
      await updateIpPolicy(userId, field, action);
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const me = await requireUser({ adminOnly: true });
  if (!me) {
    return;
  }
  await loadAdminData();
});
