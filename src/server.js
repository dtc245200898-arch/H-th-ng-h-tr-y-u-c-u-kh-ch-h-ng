const path = require("node:path");
const { JsonDatabase } = require("./db");
const { TicketQueue } = require("./queue");
const { createApp } = require("./app");

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");

const db = new JsonDatabase(dataDir);

if (!db.getUsers().length) {
  db.upsertUser({ id: "worker-1", name: "Nguyen Van An", role: "Worker" });
  db.upsertUser({ id: "worker-2", name: "Tran Thi Binh", role: "Worker" });
}

const queue = new TicketQueue(db);
const { app, publish } = createApp(db, queue);

queue.start((ticket, assignee) => {
  publish({
    type: "ticket.assigned",
    ticket,
    assignee
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Ticket system running at http://localhost:${port}`);
});
