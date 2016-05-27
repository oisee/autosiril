var fs = require('fs');

var readBinary8 = function(path) {
  var buff = fs.readFileSync(path);
  var ba = new Uint8Array(buff);
  return ba;
}

var readBinary16 = function(path) {
  var buff = fs.readFileSync(path);
  var ba = new Uint16Array(buff);
  return ba;
}

module.exports = {
  readBinary: readBinary8,
  readBinary8: readBinary8,
  readBinary16: readBinary16
};
