class TicketQueue {
  constructor(db) {
    this.db = db;
    this.items = [];
  }

  enqueue(ticket) {
    this.items.push(ticket);
  }

  start(onAssigned) {
    this.timer = setInterval(() => {
      if (!this.items.length) return;
      const ticket = this.items.shift();
      const users = this.db.getUsers();
      if (!users.length) return;

      const eligible = users.filter((user) => user.role === "Worker");
      const pool = eligible.length ? eligible : users;
      const assignee = pool[Math.floor(Math.random() * pool.length)];

      this.db.assignTicket(ticket.id, assignee.id);
      this.db.updateTicket(ticket.id, { status: "Assigned" });
      this.db.addHistory({
        id: `HIS-${Date.now().toString(36).toUpperCase()}-worker`,
        ticketId: ticket.id,
        action: "Assigned",
        detail: `Assignment Worker assigned ticket to ${assignee.name}`,
        createdAt: new Date().toISOString()
      });
      onAssigned(this.db.getTicket(ticket.id), assignee);
    }, 1000);
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { TicketQueue };
