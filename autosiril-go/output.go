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
		output.WriteString("L0")
		for _, value := range ornament.Pattern {
			output.WriteString(fmt.Sprintf(",%d", value))
		}
		output.WriteString("\n\n")
	}
}

func (vog *VortexOutputGenerator) writeSamples(output *strings.Builder) {
	// Use complete sample definitions that match Ruby module_template.rb exactly
	samples := []string{
		"[Sample1]\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ D_\nTnE +000_ +00_ B_\nTnE +000_ +00_ B_ L\n",
		"[Sample2]\nTnE +000_ +00_ F_ L\n",
		"[Sample3]\nTnE +001_ +00_ F_\nTnE +002_ +00_ F_\nTnE +001_ +00_ E_\nTnE +002_ +00_ E_\nTnE +000_ +00_ E_ L\nTnE -001_ +00_ E_\nTnE -002_ +00_ E_\nTnE -001_ +00_ E_\nTnE +000_ +00_ E_\nTnE +001_ +00_ E_\nTnE +002_ +00_ E_\nTnE +001_ +00_ E_\n",
		"[Sample4]\nTnE +002_ +00_ D_\nTnE +002_ +00_ D_\nTnE +002_ +00_ C_\nTnE +002_ +00_ B_\nTnE +002_ +00_ A_ L\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\n",
		"[Sample5]\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\ntne +000_ +00_ 0_ L\n",
		"[Sample6]\nTnE -001_ +00_ F_ L\n",
		"[Sample7]\nTnE +006_ +00_ F_ L\n",
		"[Sample8]\ntNe +000_ +00_ F_\ntNe +000_ +00_ B_\ntNe +000_ +00_ 7_\ntNe +000_ +00_ 6- L\n",
		"[Sample9]\nTnE +080_ +00_ F_\nTnE +100_ +00_ E_\nTnE +180_ +00_ E_\nTnE +200_ +00_ E_\nTnE +240_ +00_ D_\nTnE +280_ +00_ D_\nTnE +2C0_ +00_ D_\nTnE +300_ +00_ C_\nTnE +300_ +00_ C_\nTnE +340_ +00_ C_\nTnE +340_ +00_ C_\nTnE +380_ +00_ B_\nTnE +380_ +00_ B_\nTnE +400_ +00_ B_\nTnE +400_ +00_ B_\nTnE +480_ +00_ A_\nTnE +500_ +00_ 9_\nTnE +580_ +00_ 7_\nTnE +600_ +00_ 4_\nTnE +680_ +00_ 1_\nTnE +000_ +00_ 0_ L\n",
		"[Sample10]\nTne +1C0_ +00_ F_\nTne +280_ +00_ E_\nTne +380_ +00_ C_\nTne +440_ +00_ A_\nTne +480_ +00_ 8_\nTnE +000_ +00_ 0_ L\n",
		"[Sample11]\nTNe +200_ -0A_ F_\ntNe +000_ +0F_ A_\nTNe +200_ -07_ E_\ntNe +000_ +0E_ B- L\n",
		"[Sample12]\nTNE +0A0_ +05_ F_\nTNE +140_ +02_ D_\nTNE +140_ +02_ B_\nTNE +100_ +00_ A_ L\nTNE +140_ +00_ A_\nTNE +200_ +00_ A-\n",
		"[Sample13]\nTne +200_ +00_ F_\nTne +2C0_ +00_ F_\nTne +380_ +00_ E_\nTne +500_ +00_ C_\nTne +520_ +00_ 9_\ntne +000_ +00_ 0_ L\n",
		"[Sample14]\nTNE -100_ +00_ F_\nTNE -100_ +00_ D_\nTNE -100_ +00_ A_\nTNE -100_ +00_ 5_\ntne +000_ +00_ 0_ L\n",
		"[Sample15]\nTNE -100_ +00_ 5_\nTNE -100_ +00_ 8_\nTNE -100_ +00_ B_\nTNE -100_ +00_ F_\nTNe -100_ +00_ 9- L\n",
		"[Sample16]\nTnE +000_ +00_ C_\nTnE +000_ +00_ E_\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ E_\nTnE +000_ +00_ D_\nTnE +000_ +00_ C_\nTnE +000_ +00_ C_ L\nTnE +001_ +00_ C_\nTnE +002_ +00_ C_\nTnE +003_ +00_ C_\nTnE +001_ +00_ C_\nTnE +000_ +00_ C_\nTnE -001_ +00_ C_\nTnE -002_ +00_ C_\nTnE -003_ +00_ C_\nTnE -001_ +00_ C_\nTnE +000_ +00_ C_\nTnE +000_ +00_ C_\n",
		"[Sample17]\nTne +1C0_ +00_ F_\nTne +280_ +00_ D_\nTne +380_ +00_ 7_\nTNE +000_ +00_ 0_ L\n",
		"[Sample18]\nTnE -00C_ +00_ 0_ L\n",
		"[Sample19]\nTNe +000_ +00_ F_\nTNe +000_ +00_ C_\nTNe +000_ +00_ 6_\nTNe +000_ +01_ A- L\n",
		"[Sample20]\nTNE +140_ +00_ F_\ntNE +000_ +00_ B- L\n",
		"[Sample21]\ntNE +000_ +00_ D_\ntNE +000_ +00_ 8_\ntNE +000_ +00_ 1_\nTNE +000_ +00_ 0_ L\n",
		"[Sample22]\nTnE +000_ +00_ D_ L\nTnE +000_ +00_ D_\ntne +000_ +00_ 9_\ntne +000_ +00_ 9_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\ntne +000_ +00_ 9_\ntne +000_ +00_ 9_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\ntne +000_ +00_ 9_\ntne +000_ +00_ 9_\n",
		"[Sample23]\nTnE +000_ +00_ F_ L\nTnE +010_ +01_ F_\nTnE +010_ +01_ F_\nTnE +010_ +01_ F_\nTnE +010_ +01_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE -010_ -01_ F_\nTnE -010_ -01_ F_\nTnE -010_ -01_ F_\nTnE -010_ -01_ F_\nTnE +000_ +00_ F_\n",
		"[Sample24]\nTNe +000_ -01_ C_\nTNe +000_ -01_ D_\nTNe +000_ -01_ E_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ E_\nTNe +000_ -01_ E_\nTNe +000_ -01_ E_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_ L\n",
		"[Sample25]\nTNE +000_ +00_ F_\nTNE +000_ +00_ F_ L\nTNE +000_ +00_ F_\nTNE +000_ +00_ F_\nTNE +000_ +00_ F-\n",
		"[Sample26]\ntne +000_ +00_ 0_ L\n",
		"[Sample27]\nTnE +100_ +05_ F_\nTnE +200_ +02_ A_\nTnE +300_ +02_ 7_\nTNE +400_ +00_ 3- L\n",
		"[Sample28]\ntne +000_ +00_ 0_ L\n",
		"[Sample29]\ntnE +000_ +00_ 0_ L\n",
		"[Sample30]\nTNE +000_ +00_ C+ L\n",
		"[Sample31]\nTNe +1C0_ +00_ F_\nTne +280_ +00_ E_\nTne +380_ +00_ C_\nTne +440_ +00_ A_\nTne +480_ +00_ 8_\nTnE +000_ +00_ 0_ L\n",
	}
	
	for _, sample := range samples {
		output.WriteString(sample)
		output.WriteString("\n")
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