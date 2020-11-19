module.exports = ({ socket, io, midiQuiz }) => {
  socket.on("midiQuiz guess song", ({ songGuessed, username, socketId }) => {
    console.log("songGuessed: " + songGuessed);
    console.log(
      "midiQuiz.songs[midiQuiz.songPlaying]",
      midiQuiz.songs[midiQuiz.songPlaying]
    );
    if (
      midiQuiz.songs[midiQuiz.songPlaying].find(
        spellingVariant =>
          spellingVariant.toLowerCase() === songGuessed.toLowerCase()
      )
    ) {
      console.log(songGuessed + " is correct", "1 point to " + username);
      io.to(socketId).emit("midiQuiz correct song");
      if (username) {
        if (midiQuiz.scoreboard[username]) {
          midiQuiz.scoreboard[username]++;
        } else {
          midiQuiz.scoreboard[username] = 1;
        }
      }

      // Shuffle song
      const oldSong = midiQuiz.songPlaying;
      do {
        midiQuiz.songPlaying = Math.floor(
          Math.random() * Object.keys(midiQuiz.songs).length
        );
      } while (midiQuiz.songPlaying === oldSong);
      io.emit("midiQuiz current song", midiQuiz.songPlaying);
      io.emit("refresh midiQuiz scoreboard", midiQuiz.scoreboard);
    }
  });

  socket.on("get current song", socketId => {
    io.to(socketId).emit("midiQuiz current song", midiQuiz.songPlaying);
  });

  socket.on("change song", socketId => {
    io.emit("midiQuiz current song", midiQuiz.songPlaying);
  });
};
