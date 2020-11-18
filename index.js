require("dotenv").config();
var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
const { Client } = require("pg");
const schedule = require("node-schedule");

function createConnection() {
  console.log("isProdDB:", isProdDB(process.env.DATABASE_URL));
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: isProdDB(process.env.DATABASE_URL)
      ? {
          rejectUnauthorized: false
        }
      : false
  });
}

function isProdDB(url) {
  return !["127.0.0.1", "localhost"].find(val => url.includes(val));
}

async function setupSuggestionTable(client) {
  const query = `
  create table if not exists suggestions
  (
    id serial primary key,
    data json
  );
  `;
  await client.query(query);
}

async function saveSuggestions({ suggestions = [] }) {
  if (suggestions.length === 0) {
    console.log("no suggestions to save");
    return;
  }

  const client = createConnection();
  await client.connect();
  await setupSuggestionTable(client);
  try {
    await client.query(`BEGIN`);
    await client.query(`truncate table suggestions`);
    const params = suggestions
      .map(
        suggestion => `('${JSON.stringify(suggestion).replace(/'/gi, "''")}')`
      )
      .join(",");
    await client.query(`
    insert into suggestions (data) VALUES ${params}
    `);
    await client.query(`COMMIT`);
  } catch (err) {
    console.log("Failed to save suggestions, rolling back. Error was: ", err);
    await client.query(`ROLLBACK`);
  } finally {
    await client.end();
  }
}

// Save suggestions every 10th minute
const saveSuggestionsSchedule = schedule.scheduleJob(
  "*/10 * * * *",
  function() {
    saveSuggestions({ suggestions });
  }
);

async function loadSuggestions({ items }) {
  const client = createConnection();
  await client.connect();
  let result;
  try {
    const [totalSuggestions, suggestions] = await Promise.all([
      client
        .query(
          `
        select count(*) from suggestions
      `
        )
        .then(({ rows = [] }) => {
          const { count } = rows[0] || {};
          return parseInt(count, 10);
        }),
      client
        .query(
          `
        select data
        from suggestions
        limit $1
      `,
          [items]
        )
        .then(({ rows = [] }) => rows.map(({ data }) => data))
    ]);
    result = { totalSuggestions, suggestions };
  } catch (err) {
    console.log("Failed to load suggestions. Error was:", err);
  } finally {
    await client.end();
  }
  return result;
}

const suggestionEvents = require("./suggestions.js");
const gravityEvents = require("./gravity.js");
const characterEvents = require("./character.js");

let numberOfUsers = 0;
// const suggestions = [{ suggestion: "Make quiz", score: 2 }];
const suggestions = [];
const physics = { gravity: false };
const character = { x: 0, y: 0 };

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
app.get("/version/:version", (req, res) => {
  const version = req.params.version;
  res.sendFile(__dirname + "/versions/index" + req.params.version + ".html");
});

http.listen(process.env.PORT || 3000, () => {
  console.log("listening on *:" + process.env.PORT || 3000);
});

io.on("connection", socket => {
  if (numberOfUsers === 0) {
    console.log("First user connected, loading suggestions");
    loadSuggestions({ items: 20 })
      .then(loadedSuggestions => {
        if (loadedSuggestions.suggestions) {
          // Replace suggestions with all suggestions loaded from db
          suggestions.length = 0;
          loadedSuggestions.suggestions.forEach(suggestion => {
            suggestions.push(suggestion);
          });
          console.log("loaded " + suggestions.length + " suggestions");
        }
        io.emit("refresh suggestions", suggestions);
      })
      .catch(error => console.error(error));
  }

  numberOfUsers++;
  console.log("a user connected. Current number of users: " + numberOfUsers);
  io.emit(
    "chat message",
    "a user connected. Current number of users: " + numberOfUsers
  );

  socket.on("disconnect", () => {
    console.log("user disconnected");
    numberOfUsers--;
    if (numberOfUsers === 0) {
      console.log(
        "All users disconnected, saving " + suggestions.length + " suggestions"
      );
      saveSuggestions({ suggestions });
    }
    io.emit("chat message", "a user disconnected");
  });

  socket.on("chat message", ({ username, message }) => {
    console.log("message: " + message);
    io.emit("chat message", username + ": " + message);
  });

  suggestionEvents({ socket, io, suggestions });
  gravityEvents({ socket, io, physics });
  characterEvents({ socket, io, character });
});
