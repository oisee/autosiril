#!/bin/bash

echo "=== Testing simple channel mappings ==="

echo "1. Testing 2m,2m,2m (same track, all monophonic)"
echo "Ruby output:"
cd ../test
ruby ../autosiril.rb flim.mid "2m,2m,2m" 8 6 12 0 0 2 24 > /dev/null 2>&1
grep -A 5 "Pattern0" flim.mide.txt | head -6

echo -e "\nGo output:"
cd ../autosiril-go
./autosiril-go ../test/flim.mid "2m,2m,2m" 8 6 12 0 0 2 24 > /dev/null 2>&1
grep -A 5 "Pattern0" flime.txt | head -6

echo -e "\n\n2. Testing 1p,1p,1p (same track, all polyphonic)"
echo "Ruby output:"
cd ../test
ruby ../autosiril.rb flim.mid "1p,1p,1p" 8 6 12 0 0 2 24 > /dev/null 2>&1
grep -A 5 "Pattern0" flim.mide.txt | head -6

echo -e "\nGo output:"
cd ../autosiril-go
./autosiril-go ../test/flim.mid "1p,1p,1p" 8 6 12 0 0 2 24 > /dev/null 2>&1
grep -A 5 "Pattern0" flime.txt | head -6

echo -e "\n\n3. Testing 5d,5d,5d (same track, all drums)"
echo "Ruby output:"
cd ../test
ruby ../autosiril.rb flim.mid "5d,5d,5d" 8 6 12 0 0 2 24 > /dev/null 2>&1
grep -A 5 "Pattern0" flim.mide.txt | head -6

echo -e "\nGo output:"
cd ../autosiril-go
./autosiril-go ../test/flim.mid "5d,5d,5d" 8 6 12 0 0 2 24 > /dev/null 2>&1
grep -A 5 "Pattern0" flime.txt | head -6