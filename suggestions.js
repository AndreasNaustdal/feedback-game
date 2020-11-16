module.exports = ({ socket, io, suggestions }) => {
  socket.on("suggestion", ({ suggestion }) => {
    console.log("suggestion: " + suggestion);
    suggestions.push({ suggestion: suggestion, score: 0 });
    io.emit("refresh suggestions", suggestions);
  });

  socket.on("get suggestions", socketId => {
    io.to(socketId).emit("refresh suggestions", suggestions);
  });

  socket.on("vote for suggestion", ({ existingSuggestion }) => {
    console.log("vote for suggestion: " + existingSuggestion);
    const suggestionFound = suggestions.find(
      suggestion => suggestion.suggestion === existingSuggestion
    );
    if (!suggestionFound) {
      return;
    }

    suggestionFound.score++;
    suggestions.sort((a, b) => b.score - a.score);
    io.emit("refresh suggestions", suggestions);
  });
};
