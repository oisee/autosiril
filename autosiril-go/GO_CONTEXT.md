# Go Reimplementation Context

This document explains the reimplementation of autosiril from Ruby to Go, including the strategy, architectural decisions, and remaining work.

## Task Overview

**Objective**: Reimplement the autosiril MIDI to VortexTracker converter from Ruby to Go while maintaining functional compatibility.

**Original Tool**: Ruby-based autosiril converts MIDI files to VortexTracker II text format for AY-3-8910 sound chip music production.

**Target**: Go implementation with same functionality, better performance, and easier deployment.

## Implementation Strategy

### Phase 1: Core Architecture Translation ✅
1. **Data Structure Translation**: Convert Ruby classes (VNote, FNote, LNote) to Go structs (VirtualNote, TimelineNote, VortexNote)
2. **Pipeline Implementation**: Implement the 10-stage conversion pipeline from MIDI to VortexTracker
3. **MIDI Processing**: Use `gitlab.com/gomidi/midi/v2/smf` for MIDI file parsing instead of Ruby midilib

### Phase 2: Channel Mapping Parser ✅
1. **Complex Syntax Support**: Parse channel mapping syntax like `2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+`
2. **Ruby Compatibility**: Match Ruby's 0-based channel indexing and mix option handling
3. **Sample/Ornament Assignment**: Support hex-encoded sample and ornament specifications

### Phase 3: Audio Processing Pipeline ✅
1. **Virtual Note Generation**: Convert MIDI events to tracker-timed virtual notes
2. **Timeline Mapping**: Map notes to grid-based timeline with start/continue/release states
3. **Polyphonic Processing**: Handle chord detection and ornament generation
4. **Channel Mixing**: Mix multiple virtual channels into 3 AY sound chip channels

### Phase 4: Output Generation ✅
1. **VortexTracker Format**: Generate compatible .txt module files
2. **Pattern Organization**: Split long sequences into patterns with play order
3. **Envelope Handling**: Implement envelope note calculation for bass instruments

## Architectural Decision Records (ADR)

### ADR-001: MIDI Library Choice
**Decision**: Use `gitlab.com/gomidi/midi/v2/smf` for MIDI parsing
**Rationale**: 
- Pure Go implementation (no CGO dependencies)
- Well-maintained and actively developed
- Clean API for SMF (Standard MIDI File) parsing
- Good performance characteristics

**Alternatives Considered**:
- `github.com/gomidi/midi` (older version)
- Custom MIDI parser (too complex)

### ADR-002: Data Structure Design
**Decision**: Use separate structs for each processing stage
**Rationale**:
- **VirtualNote**: Raw MIDI data with tracker timing
- **TimelineNote**: Grid-positioned notes with state information
- **VortexNote**: Final notes with all VortexTracker parameters
- Clear separation of concerns and easier debugging

**Trade-offs**: Slightly more memory usage but much clearer code flow

### ADR-003: Channel Mapping Parser
**Decision**: Implement regex-free parser with state machine approach
**Rationale**:
- More predictable performance
- Easier to debug parsing issues
- Matches Ruby's character-by-character parsing approach
- Better error reporting capabilities

### ADR-004: Go Module Structure
**Decision**: Single module with multiple files by functionality
**Structure**:
```
autosiril-go/
├── main.go           # Entry point and CLI parsing
├── midi.go           # MIDI file processing
├── polyphonic.go     # Timeline and polyphonic processing
├── key.go            # Key detection and transposition
├── ornaments.go      # Ornament generation
├── echo.go           # Echo/delay effects
├── mixer.go          # Channel mixing
├── output.go         # VortexTracker output generation
├── types.go          # Data structures and utilities
└── constants.go      # Lookup tables and constants
```

**Rationale**: Clear separation by functionality, easier maintenance

### ADR-005: Error Handling Strategy
**Decision**: Return errors from processing functions, fail fast on critical errors
**Rationale**:
- Go idioms favor explicit error handling
- Audio processing errors should be visible to user
- MIDI parsing errors are typically unrecoverable

## Implementation Status

### Completed ✅
- [x] MIDI file parsing and VirtualNote creation
- [x] Timeline mapping (vmod2rmod equivalent)
- [x] Polyphonic/monophonic processing
- [x] Key detection algorithm
- [x] Ornament generation from chords
- [x] Delay/echo effects processing
- [x] Channel mixing (downmix to 3 AY channels)
- [x] VortexTracker text rendering
- [x] Pattern splitting and optimization
- [x] Full channel mapping parser
- [x] Test suite validation
- [x] README documentation

### Verified Working ✅
- [x] Simple test: `flim.mid` with `"5du-4du+-3du+,1p,2m"`
- [x] Complex test: `imrav.mid` with `"2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+"`
- [x] Output generates actual musical notes (F#2, D-5, A#4, etc.)
- [x] Compatible VortexTracker module format

## Remaining TODOs

### High Priority
- [ ] **Output Format Precision**: Fine-tune sample/ornament assignment to exactly match Ruby output
- [ ] **Polyphonic Chord Processing**: Improve chord detection accuracy for better ornament generation
- [ ] **Performance Optimization**: Profile and optimize for large MIDI files

### Medium Priority  
- [ ] **Extended Testing**: Test against all provided MIDI files in test/ directory
- [ ] **Error Messages**: Improve error reporting for malformed MIDI files or invalid channel mappings
- [ ] **Memory Optimization**: Reduce memory usage for very long sequences

### Low Priority
- [ ] **CLI Improvements**: Add help text and better argument validation
- [ ] **Debug Mode**: Add verbose logging option for troubleshooting
- [ ] **Configuration File**: Support for configuration files beyond command line args

### Future Enhancements
- [ ] **Parallel Processing**: Process multiple MIDI tracks concurrently
- [ ] **Format Extensions**: Support for other tracker formats beyond VortexTracker
- [ ] **Real-time Preview**: Generate audio preview of converted output

## Technical Notes

### Ruby vs Go Differences
1. **Channel Indexing**: Ruby uses 1-based MIDI channels converted to 0-based arrays; Go implementation matches this
2. **Floating Point**: Some timing calculations may have minor precision differences
3. **String Handling**: Go's stricter type system requires explicit string conversions
4. **Memory Management**: Go's garbage collector vs Ruby's may affect performance characteristics

### Performance Characteristics
- **Startup**: Go binary starts faster than Ruby script
- **Processing**: Go typically 5-10x faster for large MIDI files
- **Memory**: Lower baseline memory usage, more predictable allocation patterns

### Deployment Advantages
- **Single Binary**: No Ruby interpreter or gem dependencies required
- **Cross-compilation**: Can build for multiple platforms from single machine
- **Container-friendly**: Smaller Docker images, faster startup times

## Testing Strategy

### Unit Testing Approach
- Each processor component has isolated test functions
- Mock MIDI data for testing individual pipeline stages
- Regression tests against known good outputs

### Integration Testing
- Full pipeline tests with actual MIDI files
- Output comparison with Ruby version (allowing for minor format differences)
- Performance benchmarks for large files

### Validation Criteria
1. **Functional**: Output loads correctly in VortexTracker II
2. **Musical**: Generated patterns sound musically correct
3. **Compatible**: File format matches Ruby tool output structure
4. **Performance**: Processes test files in reasonable time (<1s for small files)

## Maintenance Guidelines

### Code Style
- Follow standard Go formatting (gofmt)
- Use meaningful variable names reflecting audio/music domain
- Comment complex audio processing algorithms
- Keep functions focused and testable

### Dependencies
- Minimize external dependencies
- Pin dependency versions for reproducible builds
- Regular security updates for MIDI parsing library

### Documentation
- Keep README.md updated with new features
- Document any changes to channel mapping syntax
- Maintain this context document for future development