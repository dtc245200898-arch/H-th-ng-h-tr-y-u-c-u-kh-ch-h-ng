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
      <div><h3>${escapeHtml(ticket.title)}</h3><p>${escapeHtml(ticket.requester)} · ${ticket.priority} · ${new Date(ticket.createdAt).toLocaleString("vi-VN")}</p></div>
      <div class="badges"><span class="badge ${ticket.status.toLowerCase()}">${ticket.status}</span></div>
    </article>`).join("") : '<div class="empty">Chưa có yêu cầu phù hợp.</div>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  try {
    await api("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    form.reset();
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
    <p class="eyebrow">${ticket.id}</p>
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
  const eyebrow = document.querySelector("#dialogContent .eyebrow");
  await api(`/api/tickets/${eyebrow.textContent}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: event.target.dataset.status }) });
  dialog.close();
  await loadTickets();
});

const events = new EventSource("/api/events");
events.onopen = () => { document.querySelector(".live-status").classList.add("online"); document.querySelector("#connectionText").textContent = "Realtime đang hoạt động"; };
events.onmessage = () => loadTickets();
events.onerror = () => { document.querySelector(".live-status").classList.remove("online"); document.querySelector("#connectionText").textContent = "Mất kết nối realtime"; };

loadTickets();
