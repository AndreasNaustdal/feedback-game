var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
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
  numberOfUsers++;
  console.log("a user connected. Current number of users: " + numberOfUsers);
  io.emit(
    "chat message",
    "a user connected. Current number of users: " + numberOfUsers
  );

  socket.on("disconnect", () => {
    console.log("user disconnected");
    if (numberOfUsers <= 1) {
      console.log("Current suggestions:", JSON.stringify(suggestions));
    }
    io.emit("chat message", "a user disconnected");
    numberOfUsers--;
  });

  socket.on("chat message", ({ username, message }) => {
    console.log("message: " + message);
    io.emit("chat message", username + ": " + message);
  });

  suggestionEvents({ socket, io, suggestions });
  gravityEvents({ socket, io, physics });
  characterEvents({ socket, io, character });
});
