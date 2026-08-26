
(() => {
  "use strict";

  const cfg = window.LANGE_ADMIN_CONFIG || {};
  const configReady =
    cfg.supabaseUrl &&
    cfg.supabasePublishableKey &&
    !cfg.supabasePublishableKey.startsWith("PASTE_");

  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const loginButton = document.getElementById("loginButton");
  const signOutButton = document.getElementById("signOutButton");
  const signedInAs = document.getElementById("signedInAs");
  const refreshButton = document.getElementById("refreshButton");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const priorityFilter = document.getElementById("priorityFilter");
  const loadingState = document.getElementById("loadingState");
  const emptyState = document.getElementById("emptyState");
  const tableWrap = document.getElementById("enquiryTableWrap");
  const enquiryRows = document.getElementById("enquiryRows");
  const detailDrawer = document.getElementById("detailDrawer");
  const drawerBackdrop = document.getElementById("drawerBackdrop");
  const closeDrawerButton = document.getElementById("closeDrawerButton");
  const drawerReference = document.getElementById("drawerReference");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerContent = document.getElementById("drawerContent");
  const toast = document.getElementById("toast");

  let client = null;
  let currentUser = null;
  let currentAdmin = null;
  let enquiries = [];
  let selectedEnquiry = null;

  const statuses = [
    "New","In Review","Qualified","Sourcing","Quoted","Negotiating",
    "Won","Lost","Order Confirmed","In Progress","Shipped","Delivered","Closed"
  ];
  const priorities = ["Normal","High","Urgent","Low"];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2800);
  }

  function showLoginMessage(message) {
    loginMessage.textContent = message;
    loginMessage.className = "message error";
  }

  function clearLoginMessage() {
    loginMessage.textContent = "";
    loginMessage.className = "message hidden";
  }

  function formatDate(value, withTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const opts = withTime
      ? { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" }
      : { year:"numeric", month:"short", day:"numeric" };
    return new Intl.DateTimeFormat("en", opts).format(date);
  }

  function daysUntil(value) {
    if (!value) return null;
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    return Math.ceil((target - today) / 86400000);
  }

  function badgeClass(prefix, value) {
    return `badge ${prefix}-${String(value || "").replace(/\s+/g,"-")}`;
  }

  async function verifyAdmin() {
    const { data, error } = await client
      .from("admin_users")
      .select("user_id, full_name, role, is_active")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.is_active) {
      throw new Error("This account is authenticated but is not authorized for Lange administration.");
    }
    return data;
  }

  async function handleSession(session) {
    if (!session) {
      currentUser = null;
      currentAdmin = null;
      dashboardView.classList.add("hidden");
      loginView.classList.remove("hidden");
      signOutButton.classList.add("hidden");
      signedInAs.classList.add("hidden");
      return;
    }

    currentUser = session.user;

    try {
      currentAdmin = await verifyAdmin();
    } catch (error) {
      await client.auth.signOut();
      showLoginMessage(error.message || "This account is not authorized.");
      return;
    }

    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    signOutButton.classList.remove("hidden");
    signedInAs.textContent = `${currentAdmin.full_name || currentUser.email} · ${currentAdmin.role}`;
    signedInAs.classList.remove("hidden");

    await loadEnquiries();
  }

  async function loadEnquiries() {
    loadingState.classList.remove("hidden");
    emptyState.classList.add("hidden");
    tableWrap.classList.add("hidden");

    const { data, error } = await client
      .from("trade_enquiries")
      .select("*")
      .order("created_at", { ascending:false })
      .limit(1000);

    loadingState.classList.add("hidden");

    if (error) {
      showToast("Unable to load enquiries.");
      console.error(error);
      return;
    }

    enquiries = data || [];
    renderMetrics();
    renderRows();
  }

  function renderMetrics() {
    const activeStatuses = new Set([
      "In Review","Qualified","Sourcing","Quoted","Negotiating",
      "Order Confirmed","In Progress","Shipped"
    ]);

    const today = new Date();
    today.setHours(0,0,0,0);

    document.getElementById("metricTotal").textContent = enquiries.length;
    document.getElementById("metricNew").textContent =
      enquiries.filter(x => x.status === "New").length;
    document.getElementById("metricActive").textContent =
      enquiries.filter(x => activeStatuses.has(x.status)).length;
    document.getElementById("metricQuoted").textContent =
      enquiries.filter(x => x.status === "Quoted").length;
    document.getElementById("metricWon").textContent =
      enquiries.filter(x => x.status === "Won").length;
    document.getElementById("metricDue").textContent =
      enquiries.filter(x => x.next_follow_up_at && new Date(x.next_follow_up_at) <= today &&
        !["Won","Lost","Delivered","Closed"].includes(x.status)).length;
  }

  function getFilteredEnquiries() {
    const q = searchInput.value.trim().toLowerCase();
    const s = statusFilter.value;
    const p = priorityFilter.value;

    return enquiries.filter((row) => {
      const haystack = [
        row.reference,row.full_name,row.company,row.email,row.phone,
        row.country,row.destination,row.product,row.quantity,row.details
      ].filter(Boolean).join(" ").toLowerCase();

      return (!q || haystack.includes(q)) &&
             (!s || row.status === s) &&
             (!p || row.priority === p);
    });
  }

  function renderRows() {
    const rows = getFilteredEnquiries();

    if (!rows.length) {
      enquiryRows.innerHTML = "";
      tableWrap.classList.add("hidden");
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    tableWrap.classList.remove("hidden");

    enquiryRows.innerHTML = rows.map((row) => {
      const due = daysUntil(row.next_follow_up_at);
      const followup = due === null ? "" :
        due < 0 ? ` · Follow-up overdue` :
        due === 0 ? ` · Follow-up today` :
        due <= 3 ? ` · Follow-up in ${due}d` : "";

      return `
        <tr data-id="${escapeHtml(row.id)}" tabindex="0">
          <td><span class="reference">${escapeHtml(row.reference)}</span></td>
          <td class="customer">
            <strong>${escapeHtml(row.company || row.full_name)}</strong>
            <span>${escapeHtml(row.company ? row.full_name : row.email)}</span>
          </td>
          <td class="requirement">
            <strong>${escapeHtml(row.product)}</strong>
            <span>Qty: ${escapeHtml(row.quantity || "—")}</span>
          </td>
          <td>${escapeHtml(row.country || "—")}<br><span class="received">${escapeHtml(row.destination || "")}</span></td>
          <td><span class="${badgeClass("status", row.status)}">${escapeHtml(row.status)}</span></td>
          <td><span class="${badgeClass("priority", row.priority || "Normal")}">${escapeHtml(row.priority || "Normal")}</span></td>
          <td><span class="received">${formatDate(row.created_at)}${escapeHtml(followup)}</span></td>
        </tr>
      `;
    }).join("");

    enquiryRows.querySelectorAll("tr").forEach((tr) => {
      const open = () => openEnquiry(tr.dataset.id);
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  async function openEnquiry(id) {
    selectedEnquiry = enquiries.find((x) => x.id === id);
    if (!selectedEnquiry) return;

    drawerReference.textContent = selectedEnquiry.reference;
    drawerTitle.textContent = selectedEnquiry.company || selectedEnquiry.full_name;

    drawerBackdrop.classList.remove("hidden");
    detailDrawer.classList.add("open");
    detailDrawer.setAttribute("aria-hidden","false");
    document.body.style.overflow = "hidden";

    await renderDrawer();
  }

  function closeDrawer() {
    detailDrawer.classList.remove("open");
    detailDrawer.setAttribute("aria-hidden","true");
    drawerBackdrop.classList.add("hidden");
    document.body.style.overflow = "";
    selectedEnquiry = null;
  }

  async function getSignedAttachment(path) {
    if (!path) return null;
    const { data, error } = await client.storage
      .from("enquiry-attachments")
      .createSignedUrl(path, 300);
    if (error) {
      console.error(error);
      return null;
    }
    return data?.signedUrl || null;
  }

  async function loadNotes(enquiryId) {
    const { data, error } = await client
      .from("enquiry_notes")
      .select("id, note, created_at, author_id")
      .eq("enquiry_id", enquiryId)
      .order("created_at", { ascending:false });

    if (error) {
      console.error(error);
      return [];
    }
    return data || [];
  }

  async function loadHistory(enquiryId) {
    const { data, error } = await client
      .from("enquiry_status_history")
      .select("id, from_status, to_status, changed_at")
      .eq("enquiry_id", enquiryId)
      .order("changed_at", { ascending:false });

    if (error) {
      console.error(error);
      return [];
    }
    return data || [];
  }

  async function renderDrawer() {
    const row = selectedEnquiry;
    if (!row) return;

    drawerContent.innerHTML = `<div class="loading-state">Loading enquiry details…</div>`;

    const [notes, history, signedUrl] = await Promise.all([
      loadNotes(row.id),
      loadHistory(row.id),
      getSignedAttachment(row.attachment_path)
    ]);

    const statusOptions = statuses.map(s =>
      `<option${s === row.status ? " selected" : ""}>${escapeHtml(s)}</option>`
    ).join("");

    const priorityOptions = priorities.map(p =>
      `<option${p === (row.priority || "Normal") ? " selected" : ""}>${escapeHtml(p)}</option>`
    ).join("");

    const attachmentHtml = row.attachment_path
      ? `<div class="attachment-card">
          <div>
            <strong>Customer attachment</strong>
            <span>${escapeHtml(row.attachment_path.split("/").pop())}</span>
          </div>
          ${signedUrl
            ? `<a class="small-button" href="${escapeHtml(signedUrl)}" target="_blank" rel="noopener">Open securely</a>`
            : `<span>Unable to create access link</span>`}
        </div>`
      : `<p class="detail-text">No attachment was submitted.</p>`;

    const notesHtml = notes.length
      ? notes.map(n => `
          <div class="note">
            <p>${escapeHtml(n.note)}</p>
            <span>${formatDate(n.created_at, true)}</span>
          </div>`).join("")
      : `<p class="detail-text">No internal notes yet.</p>`;

    const historyHtml = history.length
      ? history.map(h => `
          <div class="history-item">
            <span class="history-dot"></span>
            <div>
              <strong>${escapeHtml(h.from_status || "Created")} → ${escapeHtml(h.to_status)}</strong>
              <span>${formatDate(h.changed_at, true)}</span>
            </div>
          </div>`).join("")
      : `<p class="detail-text">No status changes recorded yet.</p>`;

    drawerContent.innerHTML = `
      <section class="detail-section">
        <h3>Customer</h3>
        <div class="detail-grid">
          <div class="detail-item"><span>Contact name</span><strong>${escapeHtml(row.full_name)}</strong></div>
          <div class="detail-item"><span>Company</span><strong>${escapeHtml(row.company || "—")}</strong></div>
          <div class="detail-item"><span>Email</span><strong><a href="mailto:${encodeURIComponent(row.email)}">${escapeHtml(row.email)}</a></strong></div>
          <div class="detail-item"><span>Phone / WhatsApp</span><strong>${escapeHtml(row.phone)}</strong></div>
          <div class="detail-item"><span>Market</span><strong>${escapeHtml(row.country)}</strong></div>
          <div class="detail-item"><span>Destination</span><strong>${escapeHtml(row.destination)}</strong></div>
        </div>
      </section>

      <section class="detail-section">
        <h3>Commercial requirement</h3>
        <div class="detail-grid">
          <div class="detail-item"><span>Product</span><strong>${escapeHtml(row.product)}</strong></div>
          <div class="detail-item"><span>Quantity</span><strong>${escapeHtml(row.quantity)}</strong></div>
          <div class="detail-item"><span>Target timeline</span><strong>${escapeHtml(row.timeline || "—")}</strong></div>
          <div class="detail-item"><span>Budget / target price</span><strong>${escapeHtml(row.budget || "—")}</strong></div>
          <div class="detail-item"><span>Incoterm</span><strong>${escapeHtml(row.incoterm || "—")}</strong></div>
          <div class="detail-item"><span>Received</span><strong>${formatDate(row.created_at, true)}</strong></div>
        </div>
        <div style="margin-top:16px">
          <span class="field-label">Specifications / details</span>
          <div class="detail-text">${escapeHtml(row.details)}</div>
        </div>
      </section>

      <section class="detail-section">
        <h3>Attachment</h3>
        ${attachmentHtml}
      </section>

      <section class="detail-section">
        <h3>Management</h3>
        <div class="management-grid">
          <label>
            <span class="field-label">Status</span>
            <select id="drawerStatus">${statusOptions}</select>
          </label>
          <label>
            <span class="field-label">Priority</span>
            <select id="drawerPriority">${priorityOptions}</select>
          </label>
          <label>
            <span class="field-label">Next follow-up</span>
            <input id="drawerFollowUp" type="date" value="${escapeHtml(row.next_follow_up_at ? row.next_follow_up_at.slice(0,10) : "")}">
          </label>
          <label>
            <span class="field-label">Outcome / closing reason</span>
            <input id="drawerOutcome" type="text" maxlength="500" value="${escapeHtml(row.outcome_reason || "")}" placeholder="Optional">
          </label>
        </div>
        <div class="management-actions">
          <button id="saveManagementButton" class="primary-button" type="button">Save changes</button>
        </div>
      </section>

      <section class="detail-section">
        <h3>Internal notes</h3>
        <form id="noteForm" class="notes-form">
          <textarea id="noteText" maxlength="5000" placeholder="Record supplier contact, quotation progress, follow-up actions or other internal information." required></textarea>
          <button class="primary-button" type="submit">Add internal note</button>
        </form>
        <div class="notes-list">${notesHtml}</div>
      </section>

      <section class="detail-section">
        <h3>Status history</h3>
        <div class="history-list">${historyHtml}</div>
      </section>
    `;

    document.getElementById("saveManagementButton").addEventListener("click", saveManagement);
    document.getElementById("noteForm").addEventListener("submit", addNote);
  }

  async function saveManagement() {
    if (!selectedEnquiry) return;

    const status = document.getElementById("drawerStatus").value;
    const priority = document.getElementById("drawerPriority").value;
    const followUpValue = document.getElementById("drawerFollowUp").value;
    const outcome = document.getElementById("drawerOutcome").value.trim();

    const updates = {
      status,
      priority,
      next_follow_up_at: followUpValue ? `${followUpValue}T00:00:00Z` : null,
      outcome_reason: outcome || null
    };

    const { data, error } = await client
      .from("trade_enquiries")
      .update(updates)
      .eq("id", selectedEnquiry.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      showToast("Unable to save enquiry changes.");
      return;
    }

    selectedEnquiry = data;
    enquiries = enquiries.map(x => x.id === data.id ? data : x);
    renderMetrics();
    renderRows();
    showToast("Enquiry updated.");
    await renderDrawer();
  }

  async function addNote(event) {
    event.preventDefault();
    if (!selectedEnquiry) return;

    const noteInput = document.getElementById("noteText");
    const note = noteInput.value.trim();
    if (!note) return;

    const { error } = await client
      .from("enquiry_notes")
      .insert({
        enquiry_id: selectedEnquiry.id,
        note
      });

    if (error) {
      console.error(error);
      showToast("Unable to add note.");
      return;
    }

    showToast("Internal note added.");
    await renderDrawer();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearLoginMessage();

    if (!configReady) {
      showLoginMessage("Admin configuration is incomplete. Add the Supabase publishable key to admin/config.js.");
      return;
    }

    if (!loginForm.checkValidity()) {
      loginForm.reportValidity();
      return;
    }

    loginButton.disabled = true;
    const original = loginButton.innerHTML;
    loginButton.innerHTML = "<span>Signing in…</span><span>→</span>";

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const { error } = await client.auth.signInWithPassword({ email, password });

    loginButton.disabled = false;
    loginButton.innerHTML = original;

    if (error) {
      showLoginMessage(error.message || "Unable to sign in.");
    }
  });

  signOutButton.addEventListener("click", async () => {
    await client.auth.signOut();
  });

  refreshButton.addEventListener("click", loadEnquiries);
  searchInput.addEventListener("input", renderRows);
  statusFilter.addEventListener("change", renderRows);
  priorityFilter.addEventListener("change", renderRows);
  closeDrawerButton.addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && detailDrawer.classList.contains("open")) closeDrawer();
  });

  async function initialize() {
    if (!configReady) {
      showLoginMessage("Admin configuration is incomplete. Add the Supabase publishable key to admin/config.js.");
      return;
    }

    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);

    const { data } = await client.auth.getSession();
    await handleSession(data.session);

    client.auth.onAuthStateChange(async (_event, session) => {
      await handleSession(session);
    });
  }

  initialize().catch((error) => {
    console.error(error);
    showLoginMessage("Unable to initialize the administration portal.");
  });
})();
