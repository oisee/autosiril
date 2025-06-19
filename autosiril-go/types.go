package main

import (
	"fmt"
	"math"
)

// VirtualNote represents a MIDI note event with tracker timing
type VirtualNote struct {
	Note     int
	Volume   int
	Start    int
	Off      int
	Length   int
	Channel  int
	Settings string
}

// String returns note display format
func (v *VirtualNote) String() string {
	pitch := v.Note % 12
	octave := v.noteToOctave()
	return fmt.Sprintf("%s%d", Pitches[pitch], octave)
}

func (v *VirtualNote) noteToOctave() int {
	oct := (v.Note / 12) - 1
	if oct < 1 {
		oct = v.Note / 12
	} else {
		oct = (v.Note / 12) - 1
	}
	// Clamp to valid octave range 0-8
	if oct > 8 {
		oct = 8
	}
	if oct < 0 {
		oct = 0
	}
	return oct
}

// TimelineNote represents a note in the timeline grid with state information
type TimelineNote struct {
	Note           int
	Volume         int
	Type           string // 's'=start, 'r'=release, 'c'=continue, '.'=empty
	Pitch          int
	Octave         int
	InstrumentKind string
	Channel        int
	Settings       string
	ChordNotes     []int // For polyphonic: all simultaneous notes for ornament generation
}

func NewTimelineNote(note, volume int, noteType string) *TimelineNote {
	tn := &TimelineNote{
		Note:   note,
		Volume: volume,
		Type:   noteType,
	}
	tn.calculatePitchOctave()
	return tn
}

func (tn *TimelineNote) calculatePitchOctave() {
	tn.Pitch = tn.Note % 12
	oct := (tn.Note / 12) - 1
	if oct < 1 {
		tn.Octave = tn.Note / 12
	} else {
		tn.Octave = (tn.Note / 12) - 1
	}
	// Clamp to valid octave range 0-8
	if tn.Octave > 8 {
		tn.Octave = 8
	}
	if tn.Octave < 0 {
		tn.Octave = 0
	}
}

func (tn *TimelineNote) String() string {
	switch tn.Type {
	case "r":
		return "R--"
	case ".":
		return "---"
	default:
		return fmt.Sprintf("%s%d", Pitches[tn.Pitch], tn.Octave)
	}
}

// VortexNote represents the final note with all VortexTracker parameters
type VortexNote struct {
	Note            int
	Volume          int
	Type            string // 's'=start, 'r'=release, 'c'=continue, '.'=empty
	Pitch           int
	Octave          int
	InstrumentKind  string
	Sample          int
	Envelope        int
	Ornament        int
	EnvelopePitch   int
	EnvelopeOctave  int
	Channel         int
	Settings        string
}

func NewVortexNote(timelineNote *TimelineNote) *VortexNote {
	vn := &VortexNote{
		Note:           timelineNote.Note,
		Volume:         timelineNote.Volume,
		Type:           timelineNote.Type,
		Pitch:          timelineNote.Pitch,
		Octave:         timelineNote.Octave,
		InstrumentKind: timelineNote.InstrumentKind,
		Channel:        timelineNote.Channel,
		Settings:       timelineNote.Settings,
		Sample:         2, // Default sample is 2 to match Ruby
		Envelope:       0,
		Ornament:       0,
	}
	
	// Calculate envelope pitch and octave only for actual notes (not empty notes)
	if vn.Type != "." && vn.Note >= 0 && vn.Note < len(EnvOffsets) {
		envelopeNote := vn.Note + EnvOffsets[vn.Note]
		vn.EnvelopePitch = envelopeNote % 12
		vn.EnvelopeOctave = vn.noteToOctave(envelopeNote)
		
		if vn.Note < len(EnvForms) {
			vn.Envelope = EnvForms[vn.Note]
		}
	}
	
	return vn
}

func (vn *VortexNote) noteToOctave(note int) int {
	oct := (note / 12) - 1
	if oct < 1 {
		oct = note / 12
	} else {
		oct = (note / 12) - 1
	}
	// Clamp to valid octave range 0-8
	if oct > 8 {
		oct = 8
	}
	if oct < 0 {
		oct = 0
	}
	return oct
}

func (vn *VortexNote) String() string {
	switch vn.Type {
	case "r":
		return "R--"
	case ".":
		return "---"
	default:
		return fmt.Sprintf("%s%d", Pitches[vn.Pitch], vn.Octave)
	}
}

func (vn *VortexNote) EnvelopeNoteDisplay() string {
	if !vn.EnvelopeActive() {
		return "...."
	}
	return fmt.Sprintf(" %s%d", Pitches[vn.EnvelopePitch], vn.EnvelopeOctave)
}

func (vn *VortexNote) EnvelopeActive() bool {
	return vn.InstrumentKind == "e" && vn.Type != "r" && vn.Type != "." && vn.Envelope >= 1 && vn.Envelope <= 14
}

// ChannelSettings represents parsed channel configuration
type ChannelSettings struct {
	MIDIChannel    int
	InstrumentType string // m, p, d, e
	Modifiers      string // u, w
	Sample         int
	Ornament       int
	MixOption      string // +, -
}

// AutosirilConfig holds all configuration parameters
type AutosirilConfig struct {
	InputFile           string
	ChannelMapping      string
	PerBeat             int
	PerDelay            int
	PerDelay2           int
	PatternSize         int
	SkipLines           int
	OrnRepeat           int
	MaxOffset           int
	DiatonicTranspose   int
	RealKey             int
	ParsedChannels      [][]ChannelSettings
}

func NewAutosirilConfig(args []string) *AutosirilConfig {
	config := &AutosirilConfig{
		InputFile:         "./test/tottoro_example.mid",
		ChannelMapping:    "1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+",
		PerBeat:           4,
		PerDelay:          3,
		PerDelay2:         6,
		PatternSize:       0, // Auto-calculated
		SkipLines:         0,
		OrnRepeat:         1,
		MaxOffset:         12,
		DiatonicTranspose: 0,
		RealKey:           13,
	}
	
	// Parse command line arguments
	if len(args) > 0 {
		config.InputFile = args[0]
	}
	if len(args) > 1 {
		config.ChannelMapping = args[1]
	}
	if len(args) > 2 {
		config.PerBeat = parseInt(args[2], config.PerBeat)
	}
	if len(args) > 3 {
		config.PerDelay = parseInt(args[3], config.PerDelay)
	}
	if len(args) > 4 {
		config.PerDelay2 = parseInt(args[4], config.PerDelay2)
	}
	if len(args) > 5 {
		config.PatternSize = parseInt(args[5], config.PatternSize)
	}
	if len(args) > 6 {
		config.SkipLines = parseInt(args[6], config.SkipLines)
	}
	if len(args) > 7 {
		config.OrnRepeat = parseInt(args[7], config.OrnRepeat)
	}
	if len(args) > 8 {
		config.MaxOffset = parseInt(args[8], config.MaxOffset)
	}
	if len(args) > 9 {
		config.DiatonicTranspose = parseInt(args[9], config.DiatonicTranspose)
	}
	if len(args) > 10 {
		config.RealKey = parseInt(args[10], config.RealKey)
	}
	
	return config
}

func parseInt(s string, defaultVal int) int {
	var val int
	if _, err := fmt.Sscanf(s, "%d", &val); err != nil {
		return defaultVal
	}
	return val
}

// Clamp utility function
func clamp(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// Float clamp utility
func clampFloat(value, min, max float64) float64 {
	return math.Max(min, math.Min(max, value))
}