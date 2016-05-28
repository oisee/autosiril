var fs = require('fs');
var infile = process.argv[2] || "./test/simple_midi.mid";
var outfile = process.argv[3] || process.argv[2];

var json = fs.readFileSync(infile);

var oJson = JSON.parse(json);
var bJson = JSON.stringify(oJson, null, '  ');

fs.writeFileSync(outfile, bJson);