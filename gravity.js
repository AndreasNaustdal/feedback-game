module.exports = ({ socket, io, physics }) => {
  socket.on("toggle gravity", () => {
    physics.gravity = !physics.gravity;
    console.log("set gravity to: " + physics.gravity);
    io.emit("refresh gravity", physics.gravity);
  });

  socket.on("get gravity", socketId => {
    io.to(socketId).emit("refresh gravity", physics.gravity);
  });
};
