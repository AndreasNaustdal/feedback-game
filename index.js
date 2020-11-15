var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);

let numberOfUsers = 0;
// const suggestions = [{ suggestion: "Make quiz", score: 2 }];
const suggestions = [];

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
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
    io.emit("chat message", "a user disconnected");
    numberOfUsers--;
  });

  socket.on("chat message", ({ username, message }) => {
    console.log("message: " + message);
    io.emit("chat message", username + ": " + message);
  });

  socket.on("suggestion", ({ suggestion }) => {
    console.log("suggestion: " + suggestion);
    suggestions.push({ suggestion: suggestion, score: 0 });
    io.emit("refresh suggestions", suggestions);
  });
  
  socket.on("get suggestions", (socketId) => {
    io.to(socketId).emit("refresh suggestions", suggestions);
  })
  
  socket.on("vote for suggestion", ({ existingSuggestion }) => {
    console.log("vote for suggestion: " + existingSuggestion);
    const suggestionFound = suggestions.find(suggestion => suggestion.suggestion === existingSuggestion)
    if (!suggestionFound) {
      return;
    }
    
    suggestionFound.score++;
    suggestions.sort((a, b) => b.score - a.score);
    io.emit("refresh suggestions", suggestions);
  });
});
