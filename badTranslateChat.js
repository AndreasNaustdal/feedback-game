module.exports = ({ socket, io, badTranslateChat }) => {
  socket.on("toggle badTranslateChat", () => {
    badTranslateChat.activated = !badTranslateChat.activated;
    console.log("set activated to: " + badTranslateChat.activated);
    io.emit("refresh badTranslateChat", badTranslateChat.activated);
  });

  socket.on("get badTranslateChat", socketId => {
    io.to(socketId).emit(
      "refresh badTranslateChat",
      badTranslateChat.activated
    );
  });
};
