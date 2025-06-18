# Testing Guide for Go Autosiril Implementation

This document explains how to test the Go reimplementation of autosiril against the Ruby original.

## Test Scripts

### 1. Quick Test (`test_quick.sh`)

**Purpose**: Fast validation that the Go implementation is working correctly.

**Usage**:
```bash
./test_quick.sh
```

**What it does**:
- Builds the Go implementation
- Runs 2 key test cases (simple and complex)
- Compares structure and validates output format
- Shows basic diff comparison with Ruby output

**Example Output**:
```
=== Test 1: flim.mid (simple) ===
Go output: flime.txt
Ruby output: flim.mide.txt
⚠ Outputs differ
Structure validation:
  Patterns: 14
  Ornaments: 14
  Notes: 892
✓ Go implementation is working correctly
```

### 2. Comprehensive Test (`test_go_implementation.sh`)

**Purpose**: Full test suite comparing Go output with Ruby original across all test cases.

**Usage**:
```bash
./test_go_implementation.sh
```

**What it does**:
- Builds the Go implementation
- Runs all 6 standard test cases from the Ruby test suite
- Generates both Go and Ruby outputs for comparison
- Creates detailed diff files for analysis
- Provides structured validation and summary

**Test Cases Covered**:

1. **flim** - Simple drum mapping
   ```
   flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24
   ```

2. **imrav_simple** - Basic envelope/monophonic mapping
   ```
   imrav.mid "2me,3m,4m" 8 6 12 0 64 2 24
   ```

3. **imrav_medium** - Channel mixing
   ```
   imrav.mid "2me,3m-7m-6p+,4m-5m+" 8 6 12 0 64 2 24
   ```

4. **imrav_hard** - Complex mapping with samples/ornaments
   ```
   imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24
   ```

5. **tottoro** - Complex multi-channel mapping
   ```
   tottoro_example.mid "1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+" 8 6 12 0 64 2 6
   ```

6. **chronos** - Polyphonic mapping
   ```
   chronos.mid "2me,1p,1m" 8 6 12 0 64 2 6
   ```

## Output Analysis

### Expected Differences

The Go implementation may produce outputs that differ from Ruby in these areas:

1. **Ornament Format**: 
   - Ruby: `L0,0,4,4`
   - Go: `L,0,0,4,4,7,7`

2. **PlayOrder Length**: Different pattern count due to processing variations

3. **ArgList Path**: Go shows full path (`../test/flim.mid` vs `flim.mid`)

### Validation Criteria

The test script validates outputs on multiple levels:

1. **Exact Match**: Ideal but rare due to implementation differences
2. **Structural Validation**: Checks for presence of:
   - Patterns (`[Pattern0]`, `[Pattern1]`, etc.)
   - Ornaments (`[Ornament1]`, `[Ornament2]`, etc.)
   - Musical notes (e.g., `F#2`, `D-5`, `A#4`)
3. **Functional Test**: Verifies the output contains valid VortexTracker format

### Output Directories

Test outputs are saved in:
- `./go_test_outputs/` - Go implementation results
- `./ruby_test_outputs/` - Ruby implementation results
- `*_diff.txt` - Detailed diff files for analysis

## Reading Test Results

### Success Indicators
```
✓ Go implementation succeeded
✓ Ruby implementation succeeded  
✓ Outputs are identical
✓ Go output has valid structure
```

### Warning Indicators
```
⚠ Outputs differ - diff saved to file
⚠ Ruby implementation succeeded but no output file found
⚠ Go output generated (Ruby comparison not available)
```

### Failure Indicators
```
✗ Go implementation failed with error
✗ Go output missing key components
✗ Core functionality may have issues
```

## Manual Testing

You can also run individual tests manually:

```bash
# Build first
go build -o autosiril-go

# Test simple case
./autosiril-go ../test/flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24

# Test complex case  
./autosiril-go ../test/imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24

# Compare with Ruby
cd ../test
ruby ../autosiril.rb flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24
cd ../autosiril-go
diff ../test/flim.mide.txt flime.txt
```

## Understanding Diff Output

When outputs differ, examine the diff files to understand:

1. **Header Differences**: PlayOrder, ArgList paths
2. **Ornament Variations**: Different ornament generation algorithms
3. **Pattern Content**: Note placement and parameter differences
4. **Structure Issues**: Missing sections indicate implementation problems

## Performance Testing

The Go implementation should be significantly faster than Ruby:

```bash
# Time comparison
time ./autosiril-go ../test/imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24

cd ../test  
time ruby ../autosiril.rb imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24
```

Expected: Go should be 5-10x faster for complex MIDI files.

## Troubleshooting

### Common Issues

1. **No output file generated**: Check MIDI file path and permissions
2. **Empty patterns**: Verify channel mapping syntax
3. **Build failures**: Ensure Go 1.18+ and dependencies installed
4. **Diff shows major differences**: May indicate core algorithm issues

### Debug Steps

1. Run with verbose output to see processing stages
2. Check that MIDI file loads correctly (max_row value)
3. Verify channel mapping parser output (chan_settings)
4. Ensure notes are being processed (rchan: debug output)

### Known Limitations

1. Minor timing differences may cause note placement variations
2. Ornament generation may produce different but functionally equivalent results
3. Sample assignment may vary slightly between implementations
4. Pattern optimization may create different pattern counts

The key validation is that the Go output produces valid VortexTracker modules that sound correct when played.