#!/bin/bash

# Debug comparison script to understand the differences

echo "=== Running Ruby version on simple test ==="
cd ../test
ruby ../autosiril.rb flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24 > ruby_debug.log 2>&1
mv flim.mide.txt ruby_flim_output.txt
cd ../autosiril-go

echo "=== Running Go version on simple test ==="
./autosiril-go ../test/flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24 > go_debug.log 2>&1
mv flime.txt go_flim_output.txt

echo "=== Comparing debug output ==="
echo "Ruby channel mapping:"
grep -E "chan_settings|vchan:|track:" ../test/ruby_debug.log | head -20

echo -e "\nGo channel mapping:"
grep -E "chan_settings|vchan:|track|rchan:" go_debug.log | head -20

echo -e "\n=== Comparing first pattern ==="
echo "Ruby first pattern:"
grep -A 20 "\[Pattern0\]" ../test/ruby_flim_output.txt | head -10

echo -e "\nGo first pattern:"
grep -A 20 "\[Pattern0\]" go_flim_output.txt | head -10