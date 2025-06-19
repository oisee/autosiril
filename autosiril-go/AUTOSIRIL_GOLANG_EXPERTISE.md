# Autosiril Go Reimplementation - Technical Expertise

## Project Overview

This document captures the expertise gained during the Go reimplementation of Autosiril, a Ruby tool that converts MIDI files to VortexTracker format for AY-3-8910 sound chip music production.

## Architecture & Data Flow

The conversion process follows these key stages:

1. **MIDI Loading** → Parse MIDI file, extract notes per track/channel
2. **Virtual Note Creation** → Convert MIDI events to internal VirtualNote format  
3. **Track Timeline Processing** → Flatten notes into grid-based timeline representation
4. **Channel Mapping & Duplication** → Map MIDI tracks to AY channels (3 max)
5. **Ornament Generation** → Create ornaments from polyphonic chord analysis
6. **Echo/Delay Effects** → Apply echo based on channel modifiers  
7. **Channel Mixing** → Combine virtual channels into final 3 AY channels
8. **Output Generation** → Render to VortexTracker text format

## Key Technical Discoveries

### 1. MIDI Track vs Channel Confusion ⚠️

**Issue**: Initial implementation used MIDI channel numbers instead of track indices.

**Root Cause**: Ruby uses track-based processing while MIDI events contain channel information.

**Solution**: 
```go
// Wrong: Using MIDI channel from events
Channel: int(channel)

// Correct: Using track index  
Channel: trackIdx
```

**Ruby Reference**: `@sources_mix = source_mapping.split(",").map { |s| s.split("-").map {|x| (x.to_i-1).to_i} }`

### 2. Track Duplication Pattern 🔁

**Issue**: When same track referenced multiple times (e.g., "2m,2m,2m"), Go processed each reference independently, leading to different note sequences per channel.

**Root Cause**: Ruby processes each unique track once, then duplicates the result. Go was processing the same track data multiple times in sequence.

**Solution**: Process unique tracks first, then copy results to virtual channels:

```go
// Process each unique MIDI track once
trackTimelines := make(map[int][]*TimelineNote)
uniqueTracks := make(map[int]ChannelSettings)

// Process unique tracks
for midiTrack, setting := range uniqueTracks {
    // Process all notes for this track once
    timeline := processTrackNotes(midiTrack, virtualNotes, setting)
    trackTimelines[midiTrack] = timeline
}

// Duplicate to virtual channels
for _, chanSetting := range channelSettings {
    if sourceTimeline, exists := trackTimelines[chanSetting.MIDIChannel]; exists {
        // Copy processed timeline data
        copyTimelineData(sourceTimeline, virtualChannel)
    }
}
```

### 3. Sample Assignment Defaults 🎵

**Issue**: Go defaulted to sample 1, Ruby uses sample 2.

**Root Cause**: Different default values in constructor vs Ruby's parameter system.

**Solution**:
```go
// In parseChannelSetting
result := ChannelSettings{
    Sample: 2, // Default sample is 2 in Ruby
    // ...
}

// In NewVortexNote  
vn := &VortexNote{
    Sample: 2, // Default sample is 2 to match Ruby
    // ...
}
```

**Ruby Reference**: `r = S[t] == nil ? 2 : S[t]` (line 165)

### 4. Channel Mapping Syntax 📝

**Format**: `channel[type][modifiers][samples/ornaments][mix_option]`

**Examples**: 
- `2m` = Track 2, monophonic
- `3me[2f]` = Track 3, monophonic with envelope, sample 2, ornament f
- `4m[uf]-5m[2]+` = Multiple tracks with different settings

**Parser Implementation**:
```go
func parseChannelSetting(setting string) (ChannelSettings, error) {
    // Extract channel number (convert to 0-based)
    result.MIDIChannel = extractChannelNumber(setting) - 1
    
    // Extract instrument type (d/m/p/e)
    result.InstrumentType = extractInstrumentType(setting)
    
    // Extract modifiers (u/w)
    result.Modifiers = extractModifiers(setting)
    
    // Extract sample/ornament from [SO] format
    result.Sample, result.Ornament = extractSampleOrnament(setting)
    
    // Extract mix option (+/-)
    result.MixOption = extractMixOption(setting)
}
```

### 5. Timing & Speed Calculations ⏱️

**Issue**: Note timing didn't align between Ruby and Go.

**Root Cause**: Different rounding behavior in timing calculations.

**Solution**: Match Ruby's floating-point rounding:
```go
// Go: Match Ruby's rounding behavior
trackerRow := int(float64(currentTime)/float64(clocksPerRow) + 0.5)

// Ruby equivalent behavior
clocks_per_row = 120 / per_beat / song_speed * dt
```

### 6. Volume/Velocity Handling 🔊

**Issue**: Go was using MIDI velocity values, Ruby ignores them.

**Solution**: Always use volume 15:
```go
note := &VirtualNote{
    Note:   int(key),
    Volume: 15, // Ruby always uses 15, ignoring velocity  
    // ...
}
```

## Drum Mapping System 🥁

### Ruby Drum Constants
```ruby
K1 = S['9']  # Sample 9
K2 = S['A']  # Sample 10 (most common)
K5 = S['R']  # Sample 27
S1 = S['C']  # Sample 12
CL = S['B']  # Sample 11
S3 = S['V']  # Sample 31
TM = S['J']  # Sample 19
H2 = S['L']  # Sample 21
```

### Ruby Mapping Pattern
- **Notes**: Most map to `12*5 = 60` (C-5, rendered as C-4)
- **Samples**: Most default to `K2 = 10` (sample A)

### Current Issues
- Go: `F#2 JF.F` (F#2 with sample J)  
- Ruby: `C-4 AF.F` (C-4 with sample A)
- Need to align drum mapping tables exactly

## File Structure & Organization 📁

```
autosiril-go/
├── main.go              # Entry point, argument parsing, pipeline orchestration
├── types.go             # Core data structures (VirtualNote, TimelineNote, VortexNote)
├── constants.go         # Lookup tables (drum mapping, envelopes, pitch tables)
├── midi.go              # MIDI file parsing and note extraction
├── polyphonic.go        # Note timeline processing and channel flattening
├── mixer.go             # Channel mixing and instrument settings
├── echo.go              # Echo/delay effect processing
├── ornament.go          # Ornament generation from polyphonic analysis
├── output.go            # VortexTracker text format generation
├── key.go               # Key detection and transposition
└── GO_CONTEXT.md        # Project documentation and ADRs
```

## Testing Strategy 🧪

### Simple Channel Mapping Tests
```bash
# Test track duplication
./autosiril-go flim.mid "2m,2m,2m" 8 6 12 0 0 2 24

# Test polyphonic processing  
./autosiril-go flim.mid "1p,1p,1p" 8 6 12 0 0 2 24

# Test drum mapping
./autosiril-go flim.mid "5d,5d,5d" 8 6 12 0 0 2 24
```

### Regression Testing Approach
1. Run Ruby version with known parameters
2. Run Go version with identical parameters  
3. Compare Pattern0 output line-by-line
4. Focus on note accuracy, sample assignment, timing

## Current Status ✅

### ✅ Completed
- MIDI track to channel mapping alignment
- Track duplication for multiple channel references
- Sample assignment (default sample 2)
- Timing/speed calculations  
- Volume handling (always 15)
- Channel mapping syntax parser
- Basic polyphonic processing

### 🔄 In Progress  
- Drum mapping table alignment (Ruby vs Go)
- Polyphonic note generation optimization

### 📋 Pending
- Full polyphonic chord collection and ornament generation
- Advanced echo/delay effects
- Pattern optimization and compression

## Performance Considerations 🚀

### Memory Usage
- Pre-allocate timeline arrays based on `maxRow`
- Reuse note structures where possible
- Use maps for efficient track->channel lookups

### Processing Efficiency  
- Process unique tracks only once, then duplicate
- Batch channel mixing operations
- Minimize string allocations in output generation

## Ruby Compatibility Notes 🔗

### Key Behavioral Differences to Maintain
1. **Track indexing**: Ruby uses 1-based input, 0-based internal
2. **Sample defaults**: Always 2, not 1
3. **Volume handling**: Ignore MIDI velocity, use 15
4. **Timing rounding**: Use floating-point addition for rounding
5. **Drum mapping**: Match exact NOTE2DRUM_* table values

### Critical Ruby Functions to Reference
- `Setup.load_sequence` - MIDI track processing
- `seq2vmod` - Virtual note creation  
- `rmod2pmod` - Timeline flattening
- `downmix` - Channel mixing (sources_mix iteration)
- `render_into_text` - Output generation

## Debugging Techniques 🔍

### Track Processing Debug
```go
fmt.Printf("Processing track %d: %d notes\n", trackIdx, noteCount)
fmt.Printf("Virtual channel %d: note %s at row %d\n", vChan, noteName, row)
```

### Channel Mapping Debug
```go
fmt.Printf("AY[%d][%d]: MIDI=%d, Type=%s, Sample=%d\n", 
    ayIdx, settingIdx, setting.MIDIChannel, setting.InstrumentType, setting.Sample)
```

### Output Comparison
```bash
# Ruby
ruby autosiril.rb file.mid "2m,2m,2m" 8 6 12 0 0 2 24
grep -A 5 "Pattern0" file.mide.txt

# Go  
./autosiril-go file.mid "2m,2m,2m" 8 6 12 0 0 2 24
grep -A 5 "Pattern0" file.txt
```

---

*This expertise document reflects the technical discoveries and solutions developed during the Go reimplementation of Autosiril. It serves as both documentation and reference for future development.*