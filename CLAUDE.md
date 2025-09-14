# CLAUDE.md

This file provides guidance to Claude Code when working with the Autosiril repository.

## 🎯 Project Overview

**Autosiril** - MIDI to VortexTracker converter for AY-3-8910/YM2149 sound chips
- Converts standard MIDI files to Vortex Tracker II module format
- Supports ZX Spectrum, Amstrad CPC, and other 8-bit platforms
- Zero-dependency Ruby implementation with Go port

## 🏗️ Architecture Overview

### Three Implementations
1. **autosiril.rb** - Original monolithic implementation (1,048 lines)
2. **autosiril_refactored.rb** - Clean OOP refactoring (1,185 lines)
3. **autosiril-go/** - Go port for performance and portability

### Core Components (Refactored Version)
- `AutosirilConstants` - Musical constants and lookup tables
- `MidiProcessor` - MIDI file parsing and processing
- `KeyProcessor` - Keyboard and envelope processing
- `PolyphonicProcessor` - Voice allocation and polyphony
- `OrnamentGenerator` - Ornament pattern generation
- `EchoProcessor` - Echo and delay effects
- `ChannelMixer` - Channel mixing and routing
- `VortexOutputGenerator` - VT2 module file generation

## ✅ Working Features

### Core Functionality
- **MIDI Import**: Standard MIDI file parsing with midilib
- **Channel Mapping**: Flexible channel-to-voice mapping syntax
- **Polyphonic Processing**: Up to 3 AY voices with smart allocation
- **Ornament Generation**: Automatic ornament creation from note patterns
- **Echo Effects**: Built-in echo/delay processing
- **Envelope Support**: Hardware envelope with frequency tables
- **Drum Mapping**: MIDI drums to AY noise/tone combinations

### Channel Mapping Syntax
```
1m-2p+3d         # Channel 1 melody, 2 polyphonic, 3 drums
2me[2f]          # Channel 2 melody with envelope, sample 2f
4m[uf]-5m[2]+    # Channels 4-5 mixed with samples
```

## 🧪 Testing Infrastructure

### Test Suite Location
```
test/                    # Ruby test scripts and MIDI files
autosiril-go/            # Go implementation tests
test_run/                # Test execution workspace
```

### Running Tests
```bash
# Ruby regression tests
cd test
./test_regression.sh

# Go implementation tests
cd autosiril-go
./test_go_implementation.sh

# Quick test
./test_quick.sh
```

### Test Coverage
- **6 test cases** with varying complexity
- **Diff-based validation** against golden outputs
- **Structural verification** for Go port

## 📊 Validation Status

### Equivalence Verification
- ✅ Both Ruby versions pass regression tests
- ✅ Identical constants and lookup tables
- ✅ Output files match golden references
- ⚠️ No direct comparison script between versions
- ⚠️ No unit tests for individual components

### Go Port Status
- ✅ Generates valid VT2 module files
- ✅ Structural validation passes (patterns, ornaments present)
- ⚠️ Minor differences in ornament generation (expected)
- ⚠️ Some byte-level differences from Ruby output

## 🛠️ Development Commands

### Build & Test
```bash
# Run Ruby version
ruby autosiril.rb input.mid "1m,2p,3d" 8 6 12 0 64 2 6

# Run refactored version
ruby autosiril_refactored.rb input.mid "1m,2p,3d" 8 6 12 0 64 2 6

# Build and run Go version
cd autosiril-go
go build
./autosiril-go input.mid "1m,2p,3d" 8 6 12 0 64 2 6
```

### Parameters
1. **input.mid** - Input MIDI file
2. **channel_mapping** - Channel assignment string
3. **speed** - Playback speed (default: 8)
4. **tempo** - Tempo value (default: 6)
5. **transpose** - Transpose semitones (default: 12)
6. **echo_delay** - Echo delay (default: 0)
7. **echo_volume** - Echo volume (default: 64)
8. **echo_decay** - Echo decay (default: 2)
9. **pattern_length** - Pattern length (default: 6)

## 📁 Project Structure

```
autosiril/
├── autosiril.rb              # Original implementation
├── autosiril_refactored.rb   # OOP refactoring
├── main.rb                   # Test version
├── module_template.rb        # VT2 module template
├── autosiril-go/            # Go port
│   ├── *.go                 # Go source files
│   └── test_*.sh            # Test scripts
├── test/                    # Test suite
│   ├── *.mid               # Test MIDI files
│   ├── *.sample.txt        # Golden outputs
│   └── test_*.sh           # Test scripts
└── test_run/               # Test workspace
```

## 🎯 Channel Mapping Modifiers

### Voice Types
- `m` - Melody (monophonic)
- `p` - Polyphonic
- `d` - Drums
- `u` - Unvoiced/muted

### Modifiers
- `e` - Enable envelope
- `w` - Wide stereo
- `+` - Mix with next channel
- `-` - Link to previous channel
- `[xy]` - Sample/ornament (x=sample, y=ornament)

## 📋 TODO / Known Issues

### High Priority
- [ ] Create direct comparison script between Ruby versions
- [ ] Add unit tests for core components
- [ ] Document all channel mapping syntax
- [ ] Improve error handling and messages

### Medium Priority
- [ ] Performance benchmarking between implementations
- [ ] Add CI/CD pipeline for automated testing
- [ ] Create user documentation
- [ ] Add more test cases

### Low Priority
- [ ] Optimize ornament generation algorithm
- [ ] Add visualization of conversion process
- [ ] Support for more MIDI features
- [ ] Create GUI frontend

## 🔧 Debug Commands

```bash
# Compare Ruby versions
diff <(ruby autosiril.rb test.mid "1m" 8 6 12 0 64 2 6) \
     <(ruby autosiril_refactored.rb test.mid "1m" 8 6 12 0 64 2 6)

# Debug Go implementation
cd autosiril-go
./debug_compare.sh

# Check for memory leaks (Go)
go test -memprofile mem.prof
go tool pprof mem.prof
```

## 📚 Technical Details

### AY-3-8910 Constraints
- 3 tone channels + 1 noise channel
- 16 volume levels per channel
- Hardware envelope generator
- Limited frequency range

### VortexTracker Format
- Pattern-based sequencing
- 32 samples max
- 16 ornaments max
- 256 patterns max
- Speed/tempo control

### Optimization Strategies
- Smart voice allocation for polyphony
- Automatic ornament detection
- Echo effect using volume envelopes
- Drum sound synthesis

## 🤝 Contributing Guidelines

1. **Test First**: Run regression tests before changes
2. **Maintain Compatibility**: Outputs must match golden files
3. **Document Changes**: Update this file for significant changes
4. **Cross-Validate**: Test changes in both Ruby versions
5. **Performance**: Consider Z80/8-bit constraints

---

*Autosiril: Bringing modern MIDI compositions to vintage 8-bit sound chips.*