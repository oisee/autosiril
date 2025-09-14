#!/bin/bash

# Test script to verify equivalence between autosiril.rb and autosiril_refactored.rb
# Runs both versions on the same inputs and compares outputs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Create test output directories
mkdir -p test_outputs/original
mkdir -p test_outputs/refactored
mkdir -p test_outputs/diffs

echo -e "${BLUE}=== Autosiril Version Equivalence Test ===${NC}"
echo -e "${BLUE}Comparing autosiril.rb vs autosiril_refactored.rb${NC}"
echo

# Function to run a single equivalence test
run_equivalence_test() {
    local test_name="$1"
    local midi_file="$2"
    local channel_mapping="$3"
    shift 3
    local args="$@"

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Test: $test_name${NC}"
    echo "  MIDI: $midi_file"
    echo "  Mapping: $channel_mapping"
    echo "  Args: $args"
    echo

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # Run original version
    echo -e "${YELLOW}Running original (autosiril.rb)...${NC}"
    cd test
    if ruby ../autosiril.rb "$midi_file" "$channel_mapping" $args > /dev/null 2>&1; then
        # Find generated file
        local original_output=$(find . -name "*e.txt" -newer ../autosiril.rb | head -1)
        if [ -n "$original_output" ]; then
            mv "$original_output" "../test_outputs/original/${test_name}_original.txt"
            echo -e "${GREEN}✓ Original version succeeded${NC}"
        else
            echo -e "${RED}✗ Original version failed - no output file${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            cd ..
            return 1
        fi
    else
        echo -e "${RED}✗ Original version failed with error${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        cd ..
        return 1
    fi
    cd ..

    # Run refactored version
    echo -e "${YELLOW}Running refactored (autosiril_refactored.rb)...${NC}"
    cd test
    if ruby ../autosiril_refactored.rb "$midi_file" "$channel_mapping" $args > /dev/null 2>&1; then
        # Find generated file
        local refactored_output=$(find . -name "*e.txt" -newer ../autosiril_refactored.rb | head -1)
        if [ -n "$refactored_output" ]; then
            mv "$refactored_output" "../test_outputs/refactored/${test_name}_refactored.txt"
            echo -e "${GREEN}✓ Refactored version succeeded${NC}"
        else
            echo -e "${RED}✗ Refactored version failed - no output file${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            cd ..
            return 1
        fi
    else
        echo -e "${RED}✗ Refactored version failed with error${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        cd ..
        return 1
    fi
    cd ..

    # Compare outputs
    echo -e "${YELLOW}Comparing outputs...${NC}"
    local orig_file="test_outputs/original/${test_name}_original.txt"
    local ref_file="test_outputs/refactored/${test_name}_refactored.txt"
    local diff_file="test_outputs/diffs/${test_name}_diff.txt"

    if [ -f "$orig_file" ] && [ -f "$ref_file" ]; then
        if diff -u "$orig_file" "$ref_file" > "$diff_file" 2>&1; then
            echo -e "${GREEN}✓ OUTPUTS ARE IDENTICAL${NC}"
            rm "$diff_file"  # Remove empty diff file
            PASSED_TESTS=$((PASSED_TESTS + 1))

            # Show file statistics
            local orig_lines=$(wc -l < "$orig_file")
            local orig_size=$(wc -c < "$orig_file")
            echo -e "${GREEN}  File stats: $orig_lines lines, $orig_size bytes${NC}"

            # Check for key components
            local patterns=$(grep -c "^\[Pattern" "$orig_file" 2>/dev/null || echo 0)
            local ornaments=$(grep -c "^\[Ornament" "$orig_file" 2>/dev/null || echo 0)
            local samples=$(grep -c "^\[Sample" "$orig_file" 2>/dev/null || echo 0)
            echo -e "${GREEN}  Components: $patterns patterns, $ornaments ornaments, $samples samples${NC}"
        else
            echo -e "${RED}✗ OUTPUTS DIFFER${NC}"
            echo -e "${YELLOW}  Diff saved to: $diff_file${NC}"

            # Show diff statistics
            local additions=$(grep -c "^+" "$diff_file" 2>/dev/null || echo 0)
            local deletions=$(grep -c "^-" "$diff_file" 2>/dev/null || echo 0)
            echo -e "${YELLOW}  Differences: +$additions lines, -$deletions lines${NC}"

            # Show first few differences
            echo -e "${YELLOW}  First differences:${NC}"
            head -20 "$diff_file" | sed 's/^/    /'

            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}✗ Missing output files for comparison${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    echo
}

# Clean up any previous test outputs
echo -e "${YELLOW}Cleaning previous test outputs...${NC}"
rm -f test/*.txt test/*e.txt 2>/dev/null || true
echo

# Run all test cases
echo -e "${BLUE}=== Running Test Suite ===${NC}"
echo

# Test 1: Simple drum mapping
run_equivalence_test "flim_drums" \
    "flim.mid" \
    "5du-4du+-3du+,1p,2m" \
    8 6 12 0 0 2 24

# Test 2: Simple melody
run_equivalence_test "imrav_simple" \
    "imrav.mid" \
    "2me,3m,4m" \
    8 6 12 0 64 2 24

# Test 3: Medium complexity
run_equivalence_test "imrav_medium" \
    "imrav.mid" \
    "2me,3m-7m-6p+,4m-5m+" \
    8 6 12 0 64 2 24

# Test 4: Complex with samples/ornaments
run_equivalence_test "imrav_complex" \
    "imrav.mid" \
    "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" \
    8 6 12 0 64 2 24

# Test 5: Tottoro with complex mapping
run_equivalence_test "tottoro" \
    "tottoro_example.mid" \
    "1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+" \
    8 6 12 0 64 2 6

# Test 6: Polyphonic test
run_equivalence_test "chronos" \
    "chronos.mid" \
    "2me,1p,1m" \
    8 6 12 0 64 2 6

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}=== TEST SUMMARY ===${NC}"
echo -e "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS: All tests passed!${NC}"
    echo -e "${GREEN}The refactored version produces identical output to the original.${NC}"
    exit 0
else
    echo -e "${RED}⚠️ FAILURE: Some tests failed${NC}"
    echo -e "${YELLOW}Check the diff files in test_outputs/diffs/ for details${NC}"
    exit 1
fi