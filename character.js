module.exports = ({ socket, io, character }) => {
  const speed = 4;

  socket.on("character move left", () => {
    character.x = character.x - speed;
    io.emit("refresh character x", character.x);
  });
  socket.on("character move right", () => {
    character.x = character.x + speed;
    io.emit("refresh character x", character.x);
  });
  socket.on("character move up", () => {
    character.y = character.y - speed;
    io.emit("refresh character y", character.y);
  });
  socket.on("character move down", () => {
    character.y = character.y + speed;
    io.emit("refresh character y", character.y);
  });

  socket.on("get character x", socketId => {
    io.to(socketId).emit("refresh character x", character.x);
  });
  socket.on("get character y", socketId => {
    io.to(socketId).emit("refresh character y", character.y);
  });
};
