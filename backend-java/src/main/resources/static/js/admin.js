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
    // Role Badge
    let roleBadge = `<span style="padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; display: inline-block;">USER</span>`;
    if (user.role === "ADMIN") {
      roleBadge = `<span style="padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; display: inline-block;">ADMIN</span>`;
    }

    // Tier Badge
    let tierBadge = `<span style="padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; display: inline-block;">FREE</span>`;
    if (user.tier === "PRO") {
      tierBadge = `<span style="padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; background: #fae8ff; color: #a21caf; border: 1px solid #f5d0fe; display: inline-block;">PRO</span>`;
    } else if (user.tier === "ENTERPRISE") {
      tierBadge = `<span style="padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-block;">ENTERPRISE</span>`;
    }

    // Algorithm Badge
    let algoBadge = `<span style="padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-block; white-space: nowrap;">TOKEN BUCKET</span>`;
    if (user.rateLimitAlgorithm === "SLIDING_WINDOW") {
      algoBadge = `<span style="padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; background: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; display: inline-block; white-space: nowrap;">SLIDING WINDOW</span>`;
    }

    // Usage Statistics
    const total = user.totalRequests ?? 0;
    const allowed = user.allowedRequests ?? 0;
    const blocked = user.blockedRequests ?? 0;
    const allowedPercentage = total > 0 ? Math.round((allowed / total) * 100) : 100;
    const blockedPercentage = total > 0 ? Math.round((blocked / total) * 100) : 0;

    // IP Whitelist/Blacklist Badges
    const whitelistTags = (user.whitelist || []).map(ip => `<span style="display: inline-block; padding: 2px 6px; background: #e6fcf5; color: #0ca678; border-radius: 4px; font-size: 0.68rem; font-weight: 600; border: 1px solid #c3fae8; margin-right: 4px; margin-bottom: 4px; white-space: nowrap;">${ip}</span>`).join("") || `<span style="color: var(--muted); font-size: 0.72rem; font-style: italic;">None</span>`;
    const blacklistTags = (user.blacklist || []).map(ip => `<span style="display: inline-block; padding: 2px 6px; background: #fff5f5; color: #fa5252; border-radius: 4px; font-size: 0.68rem; font-weight: 600; border: 1px solid #ffe3e3; margin-right: 4px; margin-bottom: 4px; white-space: nowrap;">${ip}</span>`).join("") || `<span style="color: var(--muted); font-size: 0.72rem; font-style: italic;">None</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--text); font-size: 0.85rem; vertical-align: middle;">${user.email || "-"}</td>
      <td style="vertical-align: middle;">${roleBadge}</td>
      <td style="vertical-align: middle;">${tierBadge}</td>
      <td style="vertical-align: middle;">${algoBadge}</td>
      <td style="vertical-align: middle;">
        <div style="font-size: 0.78rem; font-weight: 500; color: var(--text); margin-bottom: 4px; display: flex; justify-content: space-between; gap: 8px;">
          <span>Allowed: <span style="color: #0ca678; font-weight: bold;">${allowed}</span></span>
          <span>Blocked: <span style="color: #fa5252; font-weight: bold;">${blocked}</span></span>
        </div>
        <div style="height: 6px; width: 100%; min-width: 140px; background: rgba(0,0,0,0.06); border-radius: 99px; overflow: hidden; display: flex;">
          <div style="width: ${allowedPercentage}%; background: #0ca678; height: 100%; transition: width 0.3s ease;"></div>
          <div style="width: ${blockedPercentage}%; background: #fa5252; height: 100%; transition: width 0.3s ease;"></div>
        </div>
        <div style="font-size: 0.7rem; color: var(--muted); margin-top: 4px; display: flex; justify-content: space-between;">
          <span>Total: ${total}</span>
          <span>Success: ${allowedPercentage}%</span>
        </div>
      </td>
      <td style="vertical-align: middle;">
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 130px;">
          <select class="tier-select" data-user-id="${user._id}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line); font-size: 0.75rem; background: white; font-weight: 500; cursor: pointer;">
            <option value="FREE" ${user.tier === "FREE" ? "selected" : ""}>FREE</option>
            <option value="PRO" ${user.tier === "PRO" ? "selected" : ""}>PRO</option>
            <option value="ENTERPRISE" ${user.tier === "ENTERPRISE" ? "selected" : ""}>ENTERPRISE</option>
          </select>
          <select class="algo-select" data-user-id="${user._id}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line); font-size: 0.75rem; background: white; font-weight: 500; cursor: pointer;">
            <option value="TOKEN_BUCKET" ${user.rateLimitAlgorithm === "TOKEN_BUCKET" ? "selected" : ""}>TOKEN_BUCKET</option>
            <option value="SLIDING_WINDOW" ${user.rateLimitAlgorithm === "SLIDING_WINDOW" ? "selected" : ""}>SLIDING_WINDOW</option>
          </select>
        </div>
      </td>
      <td style="vertical-align: middle;">
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 150px;">
          <input id="ip-${user._id}" placeholder="e.g. 127.0.0.1" style="padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line); font-size: 0.75rem;" />
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <button type="button" class="ip-action" data-user-id="${user._id}" data-field="whitelist" data-action="add" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; background: #e6fcf5; color: #0ca678; border: 1px solid #c3fae8; cursor: pointer; text-align: center; white-space: nowrap;">+ White</button>
            <button type="button" class="ip-action" data-user-id="${user._id}" data-field="blacklist" data-action="add" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; background: #fff5f5; color: #fa5252; border: 1px solid #ffe3e3; cursor: pointer; text-align: center; white-space: nowrap;">+ Black</button>
          </div>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <button type="button" class="ip-action" data-user-id="${user._id}" data-field="whitelist" data-action="remove" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 500; background: #f8f9fa; color: #495057; border: 1px solid #dee2e6; cursor: pointer; text-align: center; white-space: nowrap;">- White</button>
            <button type="button" class="ip-action" data-user-id="${user._id}" data-field="blacklist" data-action="remove" style="flex: 1; padding: 3px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 500; background: #f8f9fa; color: #495057; border: 1px solid #dee2e6; cursor: pointer; text-align: center; white-space: nowrap;">- Black</button>
          </div>
        </div>
      </td>
      <td style="vertical-align: middle;">
        <div style="margin-bottom: 6px; min-width: 120px;">
          <div style="font-size: 0.68rem; font-weight: 600; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; letter-spacing: 0.03em;">Whitelist</div>
          <div style="display: flex; flex-wrap: wrap; gap: 2px;">${whitelistTags}</div>
        </div>
        <div>
          <div style="font-size: 0.68rem; font-weight: 600; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; letter-spacing: 0.03em;">Blacklist</div>
          <div style="display: flex; flex-wrap: wrap; gap: 2px;">${blacklistTags}</div>
        </div>
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
