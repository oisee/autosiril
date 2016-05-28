#!/bin/sh
ruby ../midi2json.rb ../js/test/simple_midi.mid 
node ../js/test/test_midi2json ../js/test/simple_midi.mid
node ../js/test/beautify_json.js ../js/test/simple_midi.mid.rb.json   
node ../js/test/beautify_json.js ../js/test/simple_midi.mid.js.json
diff ../js/test/simple_midi.mid.rb.json ../js/test/simple_midi.mid.js.json

ruby ../midi2json.rb $1 
node ../js/test/test_midi2json $1
node ../js/test/beautify_json.js $1.rb.json   
node ../js/test/beautify_json.js $1.js.json
diff $1.rb.json $1.js.json

echo convert mid to midm.txt
ruby ../main.rb $1 $1m.txt 1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+ 8 6 12 0 64 2 6 |
echo convert mid.js.json to midj.txt
ruby ../main.rb $1.js.json $1j.txt 1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+ 8 6 12 0 64 2 6 |
echo convert mid.rb.json to midr.txt
ruby ../main.rb $1.rb.json $1r.txt 1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+ 8 6 12 0 64 2 6 |
diff $1m.txt $1j.txt
diff $1j.txt $1r.txt

#ruby ../main.rb ../js/test/imrav.mid imrav.midm.txt 2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+ 8 6 12 0 64 2 24 |
#ruby ../main.rb ../js/test/imrav.mid.js.json imrav.midj.txt 2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+ 8 6 12 0 64 2 24 |
#diff imrav.midm.txt imrav.midj.txt

#ruby ../autosiril.rb chronos.mid 2me,1p,1m 8 6 12 0 64 2 6 |
#ruby ../main.rb chronos.mid chronos.mid.txt 2me,1p,1m 8 6 12 0 64 2 6 |
#diff chronos.mide.txt chronos.mide.sample.txt
#diff chronos.mid.txt chronos.mide.sample.txt