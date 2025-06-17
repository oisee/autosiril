# Autosiril - MIDI to VortexTracker Converter

Autosiril is a Ruby tool that converts MIDI files to text format for Vortex Tracker Improved (VTI), enabling the creation of chiptune music for the AY-3-8910 sound chip.

## Files Overview

- **`autosiril.rb`** - Main working converter script (stable version - **USE THIS**)
- **`main.rb`** - Refactored version (work in progress, reverted due to issues)
- **`module_template.rb`** - VTI module header template with predefined samples
- **`test/`** - Test MIDI files and shell scripts for testing conversions

> ⚠️ **Important**: Always use `autosiril.rb` - it's the stable, working version. The `main.rb` file is a refactoring attempt that was reverted due to functionality issues.

## Requirements

- Ruby with `midilib` gem
- MIDI files in SMF1 format

## Installation

```bash
gem install midilib
```

## Usage

### Basic Syntax

```bash
ruby autosiril.rb [INPUT_FILE] [CHANNEL_MAPPING] [PER_BEAT] [PER_DELAY] [PER_DELAY2] [PATTERN_SIZE] [SKIP_LINES] [ORN_REPEAT] [MAX_OFFSET] [DIATONIC_TRANSPOSE] [REAL_KEY]
```

### Quick Examples

```bash
# Simple conversion with defaults
ruby autosiril.rb song.mid

# Complex example with channel mapping
ruby autosiril.rb imrav.mid "2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+" 8 6 12 0 64 2 24

# Drums, bass, and melody
ruby autosiril.rb track.mid "1du-2me,3p,4m" 4 3 6 64 0 1 12
```

## Parameters Reference

### 1. INPUT_FILE (ARGV[0])
- **Default**: `./test/tottoro_example.mid`
- **Description**: Path to input MIDI file (SMF1 format)

### 2. CHANNEL_MAPPING (ARGV[1])
- **Default**: `"1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+"`
- **Description**: Complex mapping of MIDI channels to AY-3-8910 channels

#### Channel Mapping Syntax

Format: `[MIDI_CHANNEL][TYPE][MODIFIERS][SAMPLES]-[NEXT_CHANNEL],[NEXT_AY_CHANNEL]`

**Instrument Types:**
- `m` - Monophonic (takes highest note from chords)
- `p` - Polyphonic (converts chords to ornaments) 
- `d` - Drums (maps to drum samples)

**Subtypes:**
- `e` - Envelope (use with `m`: `me` for bass sounds)

**Modifiers:**
- `u` - Mute echo (no delay effects)
- `w` - Double echo (extended delay effects)

**Sample/Ornament Assignment `[SO]`:**
- Format: `[sample][ornament]` using character codes
- Characters: `. 1 2 3 4 5 6 7 8 9 A B C D E F G H I J K L M N O P Q R S T U V`
- Example: `[2f]` = sample 2, ornament 15 (f=15)

**Mixing Options:**
- `+` - Priority mixing (lower priority muted when higher plays)
- `-` - Sequential mixing (lower priority plays after higher ends)

**Channel Grouping:**
- `,` - Separates AY channels (max 3)
- `-` - Separates instruments within same AY channel
- Priority decreases left-to-right within each group

#### Common Patterns

```bash
"1d,2me,3p"           # Simple: drums on ch1, bass on ch2, chords on ch3
"1du-2me,3p,4m"       # Drums+bass mixed, no echo on drums
"2me[2f]-6p[3]+"      # Bass with envelope + polyphonic with priority mixing
```

### 3. PER_BEAT (ARGV[2])
- **Default**: `4`
- **Description**: Lines per beat (quarter note) - time resolution
- **Common values**: `4` (normal), `8` (fine), `12` (very fine)

### 4. PER_DELAY (ARGV[3]) 
- **Default**: `3`
- **Description**: Primary echo delay in lines

### 5. PER_DELAY2 (ARGV[4])
- **Default**: `6` 
- **Description**: Secondary echo delay in lines

### 6. PATTERN_SIZE (ARGV[5])
- **Default**: Auto-calculated (`per_beat * 64`, optimized to ≤127)
- **Description**: Lines per pattern (max 127)

### 7. SKIP_LINES (ARGV[6])
- **Default**: `0`
- **Description**: Lines to skip at start (for MIDI files with initial silence)

### 8. ORN_REPEAT (ARGV[7])
- **Default**: `1`
- **Description**: Frames per chord note in ornaments

### 9. MAX_OFFSET (ARGV[8])
- **Default**: `12`
- **Description**: Maximum semitone range for chord ornaments

### 10. DIATONIC_TRANSPOSE (ARGV[9])
- **Default**: `0`
- **Description**: Scale-based transposition (positive=up, negative=down)

### 11. REAL_KEY (ARGV[10])
- **Default**: `13`
- **Description**: Force musical key (0-11) or auto-detect (>12)
- **Key mapping**: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B

## Output

The tool generates `.txt` files compatible with VortexTracker Improved:
- **Format**: `[input_name][transpose_suffix]e.txt`
- **Example**: `song.mid` → `song.mide.txt`
- **With transpose**: `song.mid` + transpose=2 → `song.midd2e.txt`

## Testing

Run the provided test scripts to verify functionality:

```bash
cd test

# Individual tests
./test_flim.sh
./test_imrav_hard.sh
./test_imrav_medium.sh
./test_imrav_simple.sh
./test_tottoro.sh

# Regression test (compares both versions)
./test_regression.sh
```

## Conversion Tips

### General Recommendations

- **Drums and bass** should have highest priority in channels
- **Disable echo on drums** for better sound: `1du`
- **Use envelope for bass**: `2me` 
- **Mix drums and bass** in one channel: `1du-2me`
- **Add harmony** to same channel: `1du-2me-3p`
- **Multiple envelope tracks** can be used simultaneously - conflicts are resolved automatically

### BPM Guidelines

- **~125 BPM**: Try `4 3 6` or `4 6 12` for timing parameters
- **Higher/Lower BPM**: Try `8 6 12` or `8 12 24` with tempo 3 in VortexTracker
- **3/4 time signature**: Try `6 0 0` or `12 0 0` for timing parameters
- **3/4 pattern length**: Use 48 or 96 lines for pattern size

### Troubleshooting

- **Module won't load in VTI**: Too many patterns or ornaments (>15 limit)
  - Reduce chord "width" by decreasing `MAX_OFFSET` parameter
  - Optimize chords in your sequencer
  - Manually remove excess ornaments from generated module text
- **Syncopated rhythms**: Try 12 lines per quarter note: `12 0 0`
- **Initial silence**: Use `SKIP_LINES` parameter to skip empty measures

## Character Code Reference

For `[SO]` sample/ornament assignments:

```
. = 0   1 = 1   2 = 2   3 = 3   4 = 4   5 = 5   6 = 6   7 = 7   8 = 8   9 = 9
A = 10  B = 11  C = 12  D = 13  E = 14  F = 15  G = 16  H = 17  I = 18  J = 19
K = 20  L = 21  M = 22  N = 23  O = 24  P = 25  Q = 26  R = 27  S = 28  T = 29
U = 30  V = 31
```

## License

Check the original repository for license information.