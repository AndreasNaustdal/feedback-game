require("dotenv").config();
var express = require("express");
var app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
const { Client } = require("pg");
const schedule = require("node-schedule");
const translate = require("@vitalets/google-translate-api");

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
const badTranslateChatEvents = require("./badTranslateChat.js");
const gravityEvents = require("./gravity.js");
const characterEvents = require("./character.js");
const midiQuizEvents = require("./midiQuiz.js");

let numberOfUsers = 0;
// const suggestions = [{ suggestion: "Make quiz", score: 2 }];
const suggestions = [];
const physics = { gravity: false };
const character = { x: 0, y: 0 };
const midiQuiz = {
  songPlaying: 1,
  scoreboard: {},
  songs: {
    0: ["Easy livin", "Easy living", "Easy livin'"],
    1: ["Return to Fantasy"],
    2: ["Firefly"],
    3: ["Free me"],
    4: ["July morning"],
    5: ["Lady in black"],
    6: ["Look at yourself"],
    7: ["The park"],
    8: ["The wizard"],
    9: ["Wonderworld"],
    10: ["Circle of hands"],
    11: ["Sympathy"],
    12: ["The easy road"],
    13: ["A year or a day"],
    14: ["Sunrise"],
    15: ["Echoes in the dark"],
    16: ["Bird of prey"],
    17: ["Illusion"],
    18: [
      "The magicians birthday",
      "Magicians birthday",
      "The magician's birthday",
      "Magician's birthday"
    ]
  }
};
const badTranslateChat = {
  activated: false
};

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
app.get("/version/:version", (req, res) => {
  const version = req.params.version;
  res.sendFile(__dirname + "/versions/index" + req.params.version + ".html");
});
app.use(express.static("public"));

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
    const languages = [
      "es",
      "pt",
      "de",
      "it",
      "zh",
      "ja",
      "fr",
      "fi",
      "hi",
      "ru",
      "pa"
    ];
    const lang1 = languages[Math.floor(Math.random() * languages.length)];
    const lang2 = languages[Math.floor(Math.random() * languages.length)];
    console.log(lang1, lang2);
    if (badTranslateChat.activated) {
      translate(message, { to: lang1 })
        .then(res => {
          const originalLanguage = res.from.language.iso;
          translate(res.text, { to: lang2 })
            .then(res2 => {
              translate(res2.text, { to: originalLanguage })
                .then(res3 => {
                  io.emit("chat message", username + ": " + res3.text);
                })
                .catch(err => {
                  console.error(err);
                  io.emit(
                    "chat message",
                    username + ": " + message + " (not translated)"
                  );
                });
            })
            .catch(err => {
              console.error(err);
              io.emit(
                "chat message",
                username + ": " + message + " (not translated)"
              );
            });
        })
        .catch(err => {
          console.error(err);
          io.emit(
            "chat message",
            username + ": " + message + " (not translated)"
          );
        });
      return;
    }
    io.emit("chat message", username + ": " + message);
  });

  suggestionEvents({ socket, io, suggestions });
  badTranslateChatEvents({ socket, io, badTranslateChat });
  gravityEvents({ socket, io, physics });
  characterEvents({ socket, io, character });
  midiQuizEvents({ socket, io, midiQuiz });
});
