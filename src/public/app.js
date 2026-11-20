const form = document.querySelector("#ticketForm");
const list = document.querySelector("#ticketList");
const filter = document.querySelector("#statusFilter");
const dialog = document.querySelector("#detailDialog");

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadTickets() {
  const query = filter.value ? `?status=${encodeURIComponent(filter.value)}` : "";
  const tickets = await api(`/api/tickets${query}`);
  list.innerHTML = tickets.length ? tickets.map((ticket) => `
    <article class="ticket" data-id="${ticket.id}">
      <div class="ticket-icon"><i data-lucide="circle-help"></i></div>
      <div><h3>${escapeHtml(ticket.title)}</h3><p><i data-lucide="user-round"></i> ${escapeHtml(ticket.requester)} · <span class="priority">${ticket.priority}</span> · ${new Date(ticket.createdAt).toLocaleString("vi-VN")}</p></div>
      <div class="badges"><span class="badge ${ticket.status.toLowerCase()}">${ticket.status}</span></div>
      <i data-lucide="chevron-right"></i>
    </article>`).join("") : '<div class="empty"><strong>Không có yêu cầu nào khác</strong><span>Hãy tạo một yêu cầu mới nếu bạn cần hỗ trợ nhé!</span></div>';
  if (window.lucide) window.lucide.createIcons();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

form.querySelectorAll("input, textarea").forEach((field) => {
  if (!field.hasAttribute("maxlength")) return;
  field.addEventListener("input", () => {
    field.parentElement.querySelector(".char-count").textContent = `${field.value.length}/${field.maxLength}`;
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  try {
    await api("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    form.reset();
    form.querySelectorAll(".char-count").forEach((counter, index) => {
      counter.textContent = index === 0 ? "0/100" : "0/500";
    });
    showToast("Yêu cầu đã được gửi thành công");
    await loadTickets();
  } catch (error) {
    alert(error.message);
  }
});

filter.addEventListener("change", loadTickets);

list.addEventListener("click", async (event) => {
  const card = event.target.closest(".ticket");
  if (!card) return;
  const ticket = await api(`/api/tickets/${card.dataset.id}`);
  const history = await api(`/api/tickets/${card.dataset.id}/history`);

  document.querySelector("#dialogContent").innerHTML = `
    <p class="dialog-eyebrow">${ticket.id}</p>
    <h2>${escapeHtml(ticket.title)}</h2>
    <p>${escapeHtml(ticket.description)}</p>
    <div class="detail-grid">
      <div><strong>Người gửi</strong><br>${escapeHtml(ticket.requester)}</div>
      <div><strong>Trạng thái</strong><br>${ticket.status}</div>
      <div><strong>Ưu tiên</strong><br>${ticket.priority}</div>
      <div><strong>Nhân viên xử lý</strong><br>${ticket.assigneeId || "Chưa phân công"}</div>
    </div>
    <div class="detail-actions">
      ${["InProgress", "Resolved", "Closed"].map((status) => `<button data-status="${status}" ${ticket.status === status ? "disabled" : ""}>${status}</button>`).join("")}
    </div>
    <div class="history"><strong>Lịch sử thay đổi</strong>${history.map((item) => `<div class="history-item"><b>${item.action}</b>: ${escapeHtml(item.detail)}<br><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></div>`).join("")}</div>`;
  dialog.showModal();
});

document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());

dialog.addEventListener("click", async (event) => {
  if (!event.target.dataset.status) return;
  const eyebrow = document.querySelector("#dialogContent .dialog-eyebrow");
  await api(`/api/tickets/${eyebrow.textContent}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: event.target.dataset.status }) });
  dialog.close();
  await loadTickets();
});

const events = new EventSource("/api/events");
events.onopen = () => { document.querySelector(".live-status").classList.add("online"); document.querySelector("#connectionText").textContent = "Realtime đang hoạt động"; };
events.onmessage = (event) => {
  loadTickets();
  const payload = JSON.parse(event.data);
  const settings = JSON.parse(localStorage.getItem("supportSettings") || '{"realtime":true,"sound":false,"compact":false}');
  if (!settings.realtime) return;
  if (payload.type === "ticket.created") addNotification("Yêu cầu mới", `${payload.ticket.title} vừa được tạo.`);
  if (payload.type === "ticket.assigned") addNotification("Đã phân công", `${payload.ticket.title} đã được phân công cho nhân viên.`);
  if (payload.type === "ticket.updated") addNotification("Cập nhật trạng thái", `${payload.ticket.title}: ${payload.ticket.status}.`);
};
events.onerror = () => { document.querySelector(".live-status").classList.remove("online"); document.querySelector("#connectionText").textContent = "Mất kết nối realtime"; };

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
    item.classList.add("active");
    if (item.dataset.nav === "home") {
      filter.value = "";
      loadTickets();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (item.dataset.nav === "tickets") document.querySelector(".queue-panel").scrollIntoView({ behavior: "smooth" });
    if (item.dataset.nav === "notifications") openNotifications();
    if (item.dataset.nav === "settings") openSettings();
  });
});

const utilityDialog = document.querySelector("#utilityDialog");
const utilityContent = document.querySelector("#utilityContent");
let notifications = JSON.parse(localStorage.getItem("supportNotifications") || "[]");

function saveNotifications() {
  localStorage.setItem("supportNotifications", JSON.stringify(notifications));
  updateNotificationCount();
}

function updateNotificationCount() {
  const unread = notifications.filter((item) => !item.read).length;
  const badge = document.querySelector("#notificationCount");
  badge.textContent = unread;
  badge.style.display = unread ? "grid" : "none";
}

function addNotification(title, message) {
  notifications.unshift({ id: Date.now(), title, message, read: false, time: new Date().toISOString() });
  notifications = notifications.slice(0, 30);
  saveNotifications();
}

function openNotifications() {
  utilityContent.innerHTML = `
    <div class="utility-heading"><div><p class="dialog-eyebrow">TRUNG TÂM CẬP NHẬT</p><h2>Thông báo</h2></div><button id="markAllRead" class="text-button" type="button">Đánh dấu đã đọc</button></div>
    <div class="notification-list">
      ${notifications.length ? notifications.map((item) => `
        <article class="notification-item ${item.read ? "read" : "unread"}" data-notification-id="${item.id}">
          <button class="notification-mark" type="button" aria-label="Đánh dấu đã đọc"><i data-lucide="${item.read ? "circle-check" : "circle-dot"}"></i></button>
          <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${new Date(item.time).toLocaleString("vi-VN")}</small></div>
        </article>`).join("") : `<div class="utility-empty"><i data-lucide="bell-off"></i><strong>Chưa có thông báo</strong><span>Các hoạt động mới sẽ xuất hiện tại đây.</span></div>`}
    </div>
    ${notifications.length ? `<button id="clearNotifications" class="danger-button" type="button"><i data-lucide="trash-2"></i>Xóa tất cả</button>` : ""}`;
  utilityDialog.showModal();
  if (window.lucide) window.lucide.createIcons();
}

function openSettings() {
  const settings = JSON.parse(localStorage.getItem("supportSettings") || '{"realtime":true,"sound":false,"compact":false}');
  utilityContent.innerHTML = `
    <div class="utility-heading"><div><p class="dialog-eyebrow">TÙY CHỈNH</p><h2>Cài đặt</h2></div></div>
    <div class="settings-list">
      <label class="setting-row"><div><strong>Thông báo realtime</strong><span>Nhận cập nhật khi ticket thay đổi</span></div><input id="settingRealtime" type="checkbox" ${settings.realtime ? "checked" : ""}></label>
      <label class="setting-row"><div><strong>Âm thanh thông báo</strong><span>Phát âm thanh khi có cập nhật mới</span></div><input id="settingSound" type="checkbox" ${settings.sound ? "checked" : ""}></label>
      <label class="setting-row"><div><strong>Chế độ danh sách gọn</strong><span>Hiển thị nhiều ticket hơn trong một màn hình</span></div><input id="settingCompact" type="checkbox" ${settings.compact ? "checked" : ""}></label>
    </div>
    <button id="saveSettings" class="submit-button utility-save" type="button"><i data-lucide="save"></i>Lưu cài đặt</button>`;
  utilityDialog.showModal();
  if (window.lucide) window.lucide.createIcons();
}

function applySettings() {
  const settings = JSON.parse(localStorage.getItem("supportSettings") || '{"realtime":true,"sound":false,"compact":false}');
  document.body.classList.toggle("compact-mode", settings.compact);
}

utilityDialog.querySelector(".utility-close").addEventListener("click", () => utilityDialog.close());
utilityDialog.addEventListener("click", (event) => {
  if (event.target === utilityDialog) utilityDialog.close();

  if (event.target.closest("#markAllRead")) {
    notifications.forEach((item) => { item.read = true; });
    saveNotifications();
    openNotifications();
  }
  if (event.target.closest("#clearNotifications")) {
    notifications = [];
    saveNotifications();
    openNotifications();
  }
  if (event.target.closest(".notification-mark")) {
    const itemElement = event.target.closest(".notification-item");
    const item = notifications.find((entry) => entry.id === Number(itemElement.dataset.notificationId));
    if (item) item.read = true;
    saveNotifications();
    openNotifications();
  }
  if (event.target.closest("#saveSettings")) {
    const settings = {
      realtime: document.querySelector("#settingRealtime").checked,
      sound: document.querySelector("#settingSound").checked,
      compact: document.querySelector("#settingCompact").checked
    };
    localStorage.setItem("supportSettings", JSON.stringify(settings));
    applySettings();
    utilityDialog.close();
    showToast("Đã lưu cài đặt");
  }
});

document.querySelector("#chatButton").addEventListener("click", () => {
  form.querySelector("[name=title]").focus();
});

window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();
});

applySettings();
updateNotificationCount();
loadTickets();
