var fs = require('fs');

// var writeBinary = function(path, ab) {
//   var buff = Buffer.from(ab.buffer);
//   fs.writeFileSync(path, buff);
// }

var writeBinary8 = function(path, a) {
  var ab = new Uint8Array(a);
  var buff = Buffer.from(ab.buffer);
  fs.writeFileSync(path, buff);
}

var writeBinary16 = function(path, a) {
  var ab = new Uint16Array(a);
  var buff = Buffer.from(ab.buffer);
  fs.writeFileSync(path, buff);
}

module.exports = {
  writeBinary: writeBinary8,
  writeBinary8: writeBinary8,
  writeBinary16: writeBinary16
};
