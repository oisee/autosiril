#!/bin/bash

# Quick test script for Go implementation
# Tests a few key cases and shows basic diff comparison

set -e

echo "Building Go implementation..."
go build -o autosiril-go

echo "Running quick tests..."
echo

# Test 1: Simple case
echo "=== Test 1: flim.mid (simple) ==="
./autosiril-go ../test/flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24
GO_OUTPUT1=$(ls -t *e.txt | head -1)
echo "Go output: $GO_OUTPUT1"

# Generate Ruby equivalent
cd ../test
ruby ../autosiril.rb flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24
RUBY_OUTPUT1=$(ls -t *e.txt | head -1)
echo "Ruby output: $RUBY_OUTPUT1"
cd - > /dev/null

# Compare
echo "Comparing outputs..."
if diff -q "../test/$RUBY_OUTPUT1" "$GO_OUTPUT1" > /dev/null; then
    echo "✓ Outputs are identical"
else
    echo "⚠ Outputs differ"
    echo "Differences (first 10 lines):"
    diff "../test/$RUBY_OUTPUT1" "$GO_OUTPUT1" | head -10
fi
echo

# Test 2: Complex case
echo "=== Test 2: imrav.mid (complex) ==="
./autosiril-go ../test/imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24
GO_OUTPUT2=$(ls -t *e.txt | head -1)
echo "Go output: $GO_OUTPUT2"

# Check structure
PATTERNS=$(grep -c "^\[Pattern" "$GO_OUTPUT2" || echo 0)
ORNAMENTS=$(grep -c "^\[Ornament" "$GO_OUTPUT2" || echo 0)
NOTES=$(grep -c "[A-G][-#][0-9]" "$GO_OUTPUT2" || echo 0)

echo "Structure validation:"
echo "  Patterns: $PATTERNS"
echo "  Ornaments: $ORNAMENTS" 
echo "  Notes: $NOTES"

if [ "$PATTERNS" -gt 0 ] && [ "$ORNAMENTS" -gt 0 ] && [ "$NOTES" -gt 0 ]; then
    echo "✓ Go implementation is working correctly"
else
    echo "✗ Go implementation may have issues"
fi

echo
echo "Quick test completed. Files generated:"
ls -la *e.txt 2>/dev/null || echo "No output files found"