#!/bin/bash

# Test with simpler mappings to debug

echo "=== Test 1: Single channel mapping ==="
echo "Ruby output:"
cd ../test
ruby ../autosiril.rb flim.mid "2m" 8 6 12 0 0 2 24
head -30 flim.mide.txt
mv flim.mide.txt ruby_simple.txt

echo -e "\nGo output:"
cd ../autosiril-go
./autosiril-go ../test/flim.mid "2m" 8 6 12 0 0 2 24
head -30 flime.txt
mv flime.txt go_simple.txt

echo -e "\n=== Test 2: Just drums ==="
echo "Ruby output:"
cd ../test  
ruby ../autosiril.rb flim.mid "5d" 8 6 12 0 0 2 24
grep -A 10 "Pattern0" flim.mide.txt | head -10
mv flim.mide.txt ruby_drums.txt

echo -e "\nGo output:"
cd ../autosiril-go
./autosiril-go ../test/flim.mid "5d" 8 6 12 0 0 2 24
grep -A 10 "Pattern0" flime.txt | head -10