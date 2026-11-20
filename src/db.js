const fs = require("node:fs");
const path = require("node:path");

class JsonDatabase {
  constructor(dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.file = path.join(this.dataDir, "tickets.json");
    this.data = this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return { users: [], tickets: [], history: [] };
    return JSON.parse(fs.readFileSync(this.file, "utf8"));
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  allTickets() {
    return [...this.data.tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getTicket(id) {
    return this.data.tickets.find((ticket) => ticket.id === id);
  }

  createTicket(ticket) {
    this.data.tickets.push(ticket);
    this.save();
    return ticket;
  }

  updateTicket(id, changes) {
    const ticket = this.getTicket(id);
    if (!ticket) return null;
    Object.assign(ticket, changes, { updatedAt: new Date().toISOString() });
    this.save();
    return ticket;
  }

  assignTicket(id, assigneeId) {
    return this.updateTicket(id, { assigneeId });
  }

  getUser(id) {
    return this.data.users.find((user) => user.id === id);
  }

  getUsers() {
    return [...this.data.users];
  }

  upsertUser(user) {
    const index = this.data.users.findIndex((item) => item.id === user.id);
    if (index === -1) this.data.users.push(user);
    else this.data.users[index] = user;
    this.save();
  }

  addHistory(entry) {
    this.data.history.push(entry);
    this.save();
  }

  getHistory(ticketId) {
    return this.data.history
      .filter((entry) => entry.ticketId === ticketId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

module.exports = { JsonDatabase };
