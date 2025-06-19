package main

import (
	"fmt"
	"strings"
)

// VortexOutputGenerator handles VortexTracker format generation
type VortexOutputGenerator struct {
	config *AutosirilConfig
}

func NewVortexOutputGenerator(config *AutosirilConfig) *VortexOutputGenerator {
	return &VortexOutputGenerator{config: config}
}

// GenerateOutput creates the final VortexTracker module text
func (vog *VortexOutputGenerator) GenerateOutput(channels [][]*VortexNote, ornaments []Ornament, channelSettings [][]ChannelSettings, detectedKey int) string {
	var output strings.Builder
	
	
	// Module header
	vog.writeModuleHeader(&output, channelSettings)
	
	// Ornaments
	vog.writeOrnaments(&output, ornaments)
	
	// Samples (using predefined template)
	vog.writeSamples(&output)
	
	// Patterns
	patterns, playOrder := vog.generatePatterns(channels)
	vog.writePatterns(&output, patterns, playOrder)
	
	return output.String()
}

func (vog *VortexOutputGenerator) writeModuleHeader(output *strings.Builder, channelSettings [][]ChannelSettings) {
	output.WriteString("[Module]\n")
	output.WriteString("VortexTrackerII=0\n")
	output.WriteString("Version=3.5\n")
	output.WriteString(fmt.Sprintf("Title=%s\n", vog.config.ChannelMapping))
	output.WriteString(fmt.Sprintf("Author=oisee/siril^4d %s\n", GetCurrentTimestamp()))
	output.WriteString("NoteTable=4\n")
	output.WriteString("ChipFreq=1750000\n")
	output.WriteString("Speed=4\n")
	
	// PlayOrder will be filled in by writePatterns
	output.WriteString("PlayOrder=")
	
	// ArgList
	args := fmt.Sprintf("%s %s %d %d %d %d %d %d %d",
		vog.config.InputFile,
		vog.config.ChannelMapping,
		vog.config.PerBeat,
		vog.config.PerDelay,
		vog.config.PerDelay2,
		vog.config.SkipLines,
		vog.config.PatternSize,
		vog.config.OrnRepeat,
		vog.config.MaxOffset)
	
	output.WriteString(fmt.Sprintf("ArgList=%s\n\n\n", args))
}

func (vog *VortexOutputGenerator) writeOrnaments(output *strings.Builder, ornaments []Ornament) {
	for _, ornament := range ornaments {
		output.WriteString(fmt.Sprintf("[Ornament%d]\n", ornament.ID))
		output.WriteString("L")
		for _, value := range ornament.Pattern {
			output.WriteString(fmt.Sprintf(",%d", value))
		}
		output.WriteString("\n\n")
	}
}

func (vog *VortexOutputGenerator) writeSamples(output *strings.Builder) {
	// Use predefined samples that match the expected output
	samples := []string{
		"[Sample1]\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ D_\nTnE +000_ +00_ B_\nTnE +000_ +00_ B_ L\n",
		"[Sample2]\nTnE +000_ +00_ F_ L\n",
		"[Sample3]\nTnE +001_ +00_ F_\nTnE +002_ +00_ F_\nTnE +001_ +00_ E_\nTnE +002_ +00_ E_\nTnE +000_ +00_ E_ L\nTnE -001_ +00_ E_\nTnE -002_ +00_ E_\nTnE -001_ +00_ E_\nTnE +000_ +00_ E_\nTnE +001_ +00_ E_\nTnE +002_ +00_ E_\nTnE +001_ +00_ E_\n",
	}
	
	for _, sample := range samples {
		output.WriteString(sample)
		output.WriteString("\n")
	}
	
	// Write remaining samples (simplified)
	for i := 4; i <= 31; i++ {
		output.WriteString(fmt.Sprintf("[Sample%d]\nTnE +000_ +00_ F_ L\n\n", i))
	}
}

func (vog *VortexOutputGenerator) generatePatterns(channels [][]*VortexNote) ([]string, string) {
	if len(channels) == 0 || len(channels[0]) == 0 {
		return []string{}, ""
	}
	
	// Calculate pattern size
	patternSize := vog.config.PatternSize
	if patternSize == 0 {
		patternSize = vog.config.PerBeat * 64
		if patternSize > 127 {
			patternSize = 127
		}
	}
	
	totalRows := len(channels[0])
	numPatterns := (totalRows + patternSize - 1) / patternSize
	
	var patterns []string
	var playOrderParts []string
	
	playOrderParts = append(playOrderParts, "L0")
	
	for patternNum := 0; patternNum < numPatterns; patternNum++ {
		pattern := vog.generateSinglePattern(channels, patternNum, patternSize)
		patterns = append(patterns, pattern)
		
		if patternNum > 0 {
			playOrderParts = append(playOrderParts, fmt.Sprintf("%d", patternNum))
		}
	}
	
	playOrder := strings.Join(playOrderParts, ",")
	return patterns, playOrder
}

func (vog *VortexOutputGenerator) generateSinglePattern(channels [][]*VortexNote, patternNum, patternSize int) string {
	var pattern strings.Builder
	pattern.WriteString(fmt.Sprintf("[Pattern%d]\n", patternNum))
	
	startRow := patternNum * patternSize
	endRow := startRow + patternSize
	if endRow > len(channels[0]) {
		endRow = len(channels[0])
	}
	
	// Find current envelope note for this pattern
	var currentEnvelope *VortexNote
	
	for row := startRow; row < endRow; row++ {
		// Find envelope note from any channel
		for _, channel := range channels {
			if row < len(channel) && channel[row].EnvelopeActive() {
				if currentEnvelope == nil || channel[row].Volume > currentEnvelope.Volume {
					currentEnvelope = channel[row]
				}
			}
		}
		
		// Format line
		envDisplay := vog.formatEnvelopeDisplay(currentEnvelope)
		
		var noteDisplays []string
		for chIdx := 0; chIdx < 3; chIdx++ {
			if chIdx < len(channels) && row < len(channels[chIdx]) {
				noteDisplays = append(noteDisplays, vog.formatNoteDisplay(channels[chIdx][row]))
			} else {
				noteDisplays = append(noteDisplays, "--- .... ....")
			}
		}
		
		pattern.WriteString(fmt.Sprintf("%s|..|%s\n", envDisplay, strings.Join(noteDisplays, "|")))
	}
	
	pattern.WriteString("\n")
	return pattern.String()
}

func (vog *VortexOutputGenerator) formatEnvelopeDisplay(envelope *VortexNote) string {
	if envelope != nil && envelope.EnvelopeActive() {
		return envelope.EnvelopeNoteDisplay()
	}
	return "...."
}

func (vog *VortexOutputGenerator) formatNoteDisplay(note *VortexNote) string {
	if note.Type == "." && note.Envelope != 0 {
		return "--- .F.. ...."
	}
	if note.Type == "r" {
		return "R-- .... ...."
	}
	if note.Type == "." {
		return "--- .... ...."
	}
	
	// Active note display
	volume := clamp(note.Volume, 1, 15)
	
	switch note.InstrumentKind {
	case "p", "d", "m":
		note.Envelope = 15
	}
	
	sampleChar := "."
	if note.Sample < len(Params) {
		sampleChar = Params[note.Sample]
	}
	
	envelopeChar := "."
	if note.Envelope%16 < len(Params) {
		envelopeChar = Params[note.Envelope%16]
	}
	
	ornamentChar := "."
	if note.Ornament%16 < len(Params) {
		ornamentChar = Params[note.Ornament%16]
	}
	
	volumeChar := "."
	if volume < len(Params) {
		volumeChar = Params[volume]
	}
	
	return fmt.Sprintf("%s %s%s%s%s ....", note.String(), sampleChar, envelopeChar, ornamentChar, volumeChar)
}

func (vog *VortexOutputGenerator) writePatterns(output *strings.Builder, patterns []string, playOrder string) {
	// Update PlayOrder in the already written header
	content := output.String()
	content = strings.Replace(content, "PlayOrder=", fmt.Sprintf("PlayOrder=%s\n", playOrder), 1)
	
	// Clear and rewrite
	output.Reset()
	output.WriteString(content)
	
	// Write patterns
	for _, pattern := range patterns {
		output.WriteString(pattern)
	}
}