# Autosiril Go Implementation

A Go reimplementation of the autosiril MIDI to VortexTracker converter.

## Overview

This is a Go port of the Ruby autosiril tool that converts MIDI files to text format for Vortex Tracker Improved (VTI), a music tracker for AY-3-8910 sound chip. The tool processes MIDI tracks and channels, converting them into patterns with ornaments, envelopes, and samples suitable for chiptune music production.

## Building

```bash
go build
```

## Usage

```bash
./autosiril-go [INPUT_FILE] [CHANNEL_MAPPING] [PER_BEAT] [PER_DELAY] [PER_DELAY2] [PATTERN_SIZE] [SKIP_LINES] [ORN_REPEAT] [MAX_OFFSET] [DIATONIC_TRANSPOSE] [REAL_KEY]
```

### Parameters

- **INPUT_FILE**: Path to MIDI file to convert
- **CHANNEL_MAPPING**: Complex channel mapping syntax (see below)
- **PER_BEAT**: Number of tracker rows per beat (default: 4)
- **PER_DELAY**: Primary delay amount (default: 3)
- **PER_DELAY2**: Secondary delay amount (default: 6)
- **PATTERN_SIZE**: Pattern size in rows (0 = auto-calculate, default: 0)
- **SKIP_LINES**: Lines to skip at beginning (default: 0)
- **ORN_REPEAT**: Ornament repetition count (default: 1)
- **MAX_OFFSET**: Maximum ornament offset (default: 12)
- **DIATONIC_TRANSPOSE**: Diatonic transposition amount (default: 0)
- **REAL_KEY**: Real key setting (default: 13)

### Channel Mapping Syntax

The channel mapping uses the format: `channel[type][modifiers][samples/ornaments][mix_option]`

**Types:**
- `d` - Drums
- `m` - Monophonic
- `p` - Polyphonic  
- `e` - Envelope (bass)

**Modifiers:**
- `u` - Mute echo
- `w` - Double echo

**Sample/Ornament Assignment:**
- `[SO]` - S=sample (hex), O=ornament (hex)

**Mix Options:**
- `+` - Priority mixing
- `-` - Default mixing (default)

**Examples:**
- `2me` - Channel 2, monophonic with envelope
- `3m-7m-6p+` - Channels 3 and 7 monophonic, channel 6 polyphonic with priority
- `2me[2f]-6p[3]+` - Channel 2 envelope with sample 2 and ornament f, channel 6 polyphonic with ornament 3, priority mixing

## Examples

### Simple Example
```bash
./autosiril-go flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24
```

### Complex Example  
```bash
./autosiril-go imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24
```

## Architecture

The Go implementation follows the same conversion pipeline as the Ruby original:

1. **MIDI Loading** - Parse MIDI file and extract note events
2. **Virtual Module Creation** - Convert MIDI events to virtual notes with tracker timing
3. **Timeline Mapping** - Map virtual notes onto timeline grid with note states
4. **Polyphonic Processing** - Handle polyphonic vs monophonic instruments
5. **Key Detection** - Analyze notes to detect musical key
6. **Ornament Generation** - Create ornaments from chord progressions
7. **Echo/Delay Effects** - Apply echo based on channel modifiers
8. **Channel Mixing** - Mix multiple MIDI channels into 3 AY channels
9. **VortexTracker Output** - Generate final VTI text format
10. **Pattern Organization** - Split into unique patterns with play order

## Key Components

- **main.go** - Entry point and command-line parsing
- **midi.go** - MIDI file loading and note extraction
- **polyphonic.go** - Note timeline processing and channel assignment
- **key.go** - Musical key detection and transposition
- **ornaments.go** - Ornament generation from chord analysis
- **echo.go** - Echo and delay effect processing
- **mixer.go** - Multi-channel mixing to AY channels
- **output.go** - VortexTracker text format generation
- **types.go** - Core data structures and utilities
- **constants.go** - Tables for pitches, samples, envelopes, etc.

## Dependencies

- `gitlab.com/gomidi/midi/v2/smf` - MIDI file parsing

## Output Format

The tool generates VortexTracker II module files (.txt) containing:
- Module header with metadata
- Ornament definitions from chord analysis
- Predefined sample library
- Pattern data with 3-channel AY-3-8910 output
- Play order sequence

## Compatibility

This Go implementation aims for compatibility with the original Ruby autosiril tool. Output should be functionally equivalent, though some minor differences in ornament generation and sample assignment may occur due to implementation details.

## Testing

Run tests using the provided test MIDI files:

```bash
# Test simple drum mapping
./autosiril-go ../test/flim.mid "5du-4du+-3du+,1p,2m" 8 6 12 0 0 2 24

# Test complex polyphonic mapping  
./autosiril-go ../test/imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24
```

Expected output files should have the `.txt` extension and be compatible with VortexTracker II.