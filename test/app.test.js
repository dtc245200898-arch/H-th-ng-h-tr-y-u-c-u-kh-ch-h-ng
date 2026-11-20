const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { JsonDatabase } = require("../src/db");

function tempDb() {
  return new JsonDatabase(fs.mkdtempSync(path.join(os.tmpdir(), "support-ticket-")));
}

test("database creates and updates a ticket", () => {
  const db = tempDb();
  const ticket = {
    id: "TKT-1", title: "Test", description: "Description", requester: "A",
    priority: "Medium", status: "New", assigneeId: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  db.createTicket(ticket);
  assert.equal(db.getTicket("TKT-1").title, "Test");
  db.assignTicket("TKT-1", "worker-1");
  db.updateTicket("TKT-1", { status: "InProgress" });
  assert.equal(db.getTicket("TKT-1").status, "InProgress");
  assert.equal(db.getTicket("TKT-1").assigneeId, "worker-1");
});

test("history is recorded per ticket", () => {
  const db = tempDb();
  db.addHistory({ id: "H1", ticketId: "TKT-1", action: "Created", detail: "Test", createdAt: new Date().toISOString() });
  db.addHistory({ id: "H2", ticketId: "TKT-2", action: "Created", detail: "Other", createdAt: new Date().toISOString() });
  assert.equal(db.getHistory("TKT-1").length, 1);
  assert.equal(db.getHistory("TKT-1")[0].id, "H1");
});
