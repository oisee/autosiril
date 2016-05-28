#!/bin/sh
ruby ../main.rb ../js/test/tottoro_example.mid tottoro_example.midm.txt 1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+ 8 6 12 0 64 2 6 |
ruby ../main.rb ../js/test/tottoro_example.mid.json tottoro_example.midj.txt 1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+ 8 6 12 0 64 2 6 |
diff tottoro_example.midm.txt tottoro_example.midj.txt

ruby ../main.rb ../js/test/imrav.mid imrav.midm.txt 2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+ 8 6 12 0 64 2 24 |
ruby ../main.rb ../js/test/imrav.mid.json imrav.midj.txt 2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+ 8 6 12 0 64 2 24 |
diff imrav.midm.txt imrav.midj.txt

#ruby ../autosiril.rb chronos.mid 2me,1p,1m 8 6 12 0 64 2 6 |
#ruby ../main.rb chronos.mid chronos.mid.txt 2me,1p,1m 8 6 12 0 64 2 6 |
#diff chronos.mide.txt chronos.mide.sample.txt
#diff chronos.mid.txt chronos.mide.sample.txt