const express = require("express");
const path = require("node:path");

function createApp(db, queue) {
  const app = express();
  const clients = new Set();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  function publish(event) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(payload);
  }

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  app.get("/api/users", (req, res) => res.json(db.getUsers()));

  app.post("/api/users", (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: "id and name are required" });
    db.upsertUser({ id, name });
    res.status(201).json(db.getUser(id));
  });

  app.post("/api/tickets", (req, res) => {
    const { title, description, requester, priority = "Medium" } = req.body;
    if (!title || !description || !requester) {
      return res.status(400).json({ error: "title, description and requester are required" });
    }

    const now = new Date().toISOString();
    const ticket = {
      id: `TKT-${Date.now().toString(36).toUpperCase()}`,
      title,
      description,
      requester,
      priority,
      status: "New",
      assigneeId: null,
      createdAt: now,
      updatedAt: now
    };

    db.createTicket(ticket);
    db.addHistory({
      id: `HIS-${Date.now().toString(36).toUpperCase()}-created`,
      ticketId: ticket.id,
      action: "Created",
      detail: `Ticket created by ${requester}`,
      createdAt: now
    });

    queue.enqueue(ticket);
    publish({ type: "ticket.created", ticket });
    res.status(201).json(ticket);
  });

  app.get("/api/tickets", (req, res) => {
    const { status, assignee } = req.query;
    let tickets = db.allTickets();
    if (status) tickets = tickets.filter((ticket) => ticket.status === status);
    if (assignee) tickets = tickets.filter((ticket) => ticket.assigneeId === assignee);
    res.json(tickets);
  });

  app.get("/api/tickets/:id", (req, res) => {
    const ticket = db.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket);
  });

  app.patch("/api/tickets/:id/status", (req, res) => {
    const { status } = req.body;
    if (!["New", "Assigned", "InProgress", "Resolved", "Closed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const ticket = db.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    const previousStatus = ticket.status;
    db.updateTicket(ticket.id, { status });

    db.addHistory({
      id: `HIS-${Date.now().toString(36).toUpperCase()}-status`,
      ticketId: ticket.id,
      action: "Status changed",
      detail: `${previousStatus} -> ${status}`,
      createdAt: new Date().toISOString()
    });

    publish({ type: "ticket.updated", ticket });
    res.json(ticket);
  });

  app.patch("/api/tickets/:id/assign", (req, res) => {
    const { assigneeId } = req.body;
    const ticket = db.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (!assigneeId || !db.getUser(assigneeId)) {
      return res.status(400).json({ error: "Valid assigneeId is required" });
    }

    db.assignTicket(ticket.id, assigneeId);
    db.updateTicket(ticket.id, { status: "Assigned" });
    db.addHistory({
      id: `HIS-${Date.now().toString(36).toUpperCase()}-assign`,
      ticketId: ticket.id,
      action: "Assigned",
      detail: `Assigned to ${assigneeId}`,
      createdAt: new Date().toISOString()
    });

    publish({ type: "ticket.assigned", ticket });
    res.json(ticket);
  });

  app.get("/api/users/:userId/tickets", (req, res) => {
    const tickets = db.allTickets().filter((ticket) => ticket.assigneeId === req.params.userId);
    res.json(tickets);
  });

  app.get("/api/tickets/:id/history", (req, res) => {
    const ticket = db.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    res.json(db.getHistory(ticket.id));
  });

  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write("data: {\"type\":\"connected\"}\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
  });

  app.use((req, res) => res.status(404).json({ error: "Route not found" }));

  return { app, publish };
}

module.exports = { createApp };
