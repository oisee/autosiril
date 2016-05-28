var MIDI2JSON = require("../midi2json.js");
var rb = require("../lib/readBinary.js").readBinary;
var fs = require('fs');

var infile = process.argv[2] || "./test/simple_midi.mid";
var outfile = process.argv[3] || process.argv[2]+".js.json";
var mid = rb(infile);

var mod_json = MIDI2JSON(mid);

//console.log(mod_json);
fs.writeFileSync(outfile, mod_json);