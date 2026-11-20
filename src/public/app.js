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
events.onmessage = () => loadTickets();
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
    if (item.dataset.nav === "notifications") {
      document.querySelector("#notificationCount").style.display = "none";
      showToast("Bạn đã xem tất cả thông báo");
    }
    if (item.dataset.nav === "settings") showToast("Chế độ cài đặt đang được chuẩn bị");
  });
});

document.querySelector("#chatButton").addEventListener("click", () => {
  form.querySelector("[name=title]").focus();
});

window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();
});

loadTickets();
