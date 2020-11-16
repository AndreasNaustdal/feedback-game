const fs = require('fs');

const version = '1-1';

const source = 'index.html';
const destination = 'versions/index' + version + '.html';

fs.copyFile(source, destination, (err) => {
  if (err) throw err;
  console.log(source + ' was copied to ' + destination);
});