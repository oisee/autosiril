#!/bin/sh
ruby ../autosiril.rb tottoro_example.mid 1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+ 8 6 12 0 64 2 6 |
ruby ../main.rb tottoro_example.mid tottoro_example.mid.txt 1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+ 8 6 12 0 64 2 6 | 
diff tottoro_example.mide.txt tottoro_example.mide.sample.txt
diff tottoro_example.mid.txt tottoro_example.mide.sample.txt

ruby ../autosiril.rb imrav.mid 2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+ 8 6 12 0 64 2 24 |
ruby ../main.rb imrav.mid imrav.mid.txt 2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+ 8 6 12 0 64 2 24 | 
diff imrav.mide.txt imrav.mide.sample.txt
diff imrav.mid.txt imrav.mide.sample.txt

ruby ../autosiril.rb chronos.mid 2me,1p,1m 8 6 12 0 64 2 6 |
ruby ../main.rb chronos.mid chronos.mid.txt 2me,1p,1m 8 6 12 0 64 2 6 | 
diff chronos.mide.txt chronos.mide.sample.txt
diff chronos.mid.txt chronos.mide.sample.txt