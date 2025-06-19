package main

// AutosirilConstants contains all lookup tables and constants
type AutosirilConstants struct{}

// Musical note names
var Pitches = []string{"C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"}

// VortexTracker parameter encoding (hexadecimal equivalents)
var Params = []string{".", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"}

// Character to numeric mapping for sample/ornament assignments
var ParamMap map[string]int

func init() {
	ParamMap = make(map[string]int)
	for i, p := range Params {
		ParamMap[p] = i
	}
}

// Envelope frequency offsets by MIDI note number (12 octaves * 12 semitones)
var EnvOffsets = []int{
	// Octave -1: +24 semitones offset
	24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
	// Octave 0: +24 semitones offset  
	24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
	// Octave 1: +24 semitones offset
	24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
	// Octave 2: Mixed offsets for hardware envelope tuning
	24, 24, 24, 24, 24, 24, 24, 24, 24, 12, 12, 24,
	// Octave 3: Transition to optimal range
	0, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 12,
	// Octave 4: Optimal envelope range
	-12, 0, 0, 0, 0, 0, -12, 0, 0, -12, -12, 0,
	// Octave 5: Lower frequency range
	-24, -12, -12, -12, -12, -12, -24, -12, -12, -24, -24, -12,
	// Octave 6: Much lower frequencies
	-36, -24, -24, -24, -24, -24, -36, -24, -24, -24, -48, -24,
	// Octave 7: Very low frequencies
	-48, -36, -36, -36, -36, -36, -48, -36, -36, -36, -52, -36,
	// Octave 8: Extremely low frequencies
	-52, -48, -48, -48, -48, -48, -52, -48, -48, -48, -60, -48,
	// Octave 9: Ultra-low frequencies
	-60, -52, -52, -52, -52, -52, -60, -52, -52, -52, -72, -52,
	// Octave 10: Lowest usable frequencies
	-72, -60, -60, -60, -60, -60, -72, -60, -60, -60, -84, -60,
}

// Envelope forms by MIDI note number
var EnvForms = []int{
	// Octaves -1, 0, 1: Default envelope form 10
	10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, // -1
	10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, // 0
	10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, // 1
	// Octave 2: Mixed forms for transition
	10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 12, 10,
	// Octaves 3-10: Enhanced envelope form 12
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 3
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 4
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 5
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 6
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 7
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 8
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 9
	12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, // 10
}

// Drum sample mappings
var DrumSamples = map[string]int{
	"hihat1": ParamMap["8"], // H1
	"hihat2": ParamMap["L"], // H2
	"kick1":  ParamMap["9"], // K1
	"kick2":  ParamMap["A"], // K2
	"kick3":  ParamMap["D"], // K3
	"kick4":  ParamMap["H"], // K4
	"kick5":  ParamMap["R"], // K5
	"clap":   ParamMap["B"], // CL
	"snare1": ParamMap["C"], // S1
	"snare2": ParamMap["K"], // S2
	"snare3": ParamMap["V"], // S3
	"perc1":  ParamMap["E"], // P1
	"perc2":  ParamMap["F"], // P2
	"tom":    ParamMap["J"], // TM
	"noise1": ParamMap["O"], // N1
	"noise2": ParamMap["P"], // N2
	"noise3": ParamMap["U"], // N3
}

// MIDI note to drum sample mapping (12 octaves * 12 semitones)
var Note2DrumSample = []int{
	// Octaves -1, 0, 1: Default to kick2
	10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, // -1
	10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, // 0
	10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, // 1
	// Octave 2: Full drum kit mapping (adjusted to match Ruby output)
	10, 27, 12, 11, 31, 9, 10, 9, 21, 9, 27, 9, // 2
	// Octave 3: Hihat-focused mapping
	21, 21, 21, 21, 21, 21, 21, 21, 21, 19, 21, 21, // 3
	// Octaves 4-10: Default to hihat2
	21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 4
	21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 5
	21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 6
	21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 7
	21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 8
	21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 9
	21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, // 10
}

// MIDI note to drum note mapping  
var Note2DrumNote = []int{
	// Octaves -1, 0, 1: Default to 60 (C-5)
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // -1
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 0
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 1
	// Octave 2: Specific drum note mappings (adjusted to match Ruby output)
	60, 60, 60, 60, 78, 48, 48, 60, 60, 60, 48, 63, // 2
	// Octave 3: Hihat focused
	60, 60, 60, 60, 60, 60, 60, 60, 60, 119, 60, 60, // 3
	// Octaves 4-10: Default to 60
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 4
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 5
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 6
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 7
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 8
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 9
	60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, // 10
}

// Major scale penalty pattern for key detection
var MajorScalePenalty = []int{0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0}

// Diatonic transposition patterns
var DiatomicTransposeUp = []int{2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1}
var DiatomicTransposeDown = []int{-1, -2, -2, -2, -2, -1, -2, -2, -2, -2, -2, -2}