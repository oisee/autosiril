package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	args := os.Args[1:]
	config := NewAutosirilConfig(args)
	
	fmt.Printf("chan_settings: %v\n", strings.Split(config.ChannelMapping, ","))
	fmt.Println("Starting MIDI to VortexTracker conversion...")
	
	// Debug MIDI structure
	if err := DebugMIDI(config.InputFile); err != nil {
		fmt.Printf("Debug error: %v\n", err)
	}
	
	// Parse channel mapping
	channelSettings, err := parseChannelMapping(config.ChannelMapping)
	if err != nil {
		fmt.Printf("Error parsing channel mapping: %v\n", err)
		os.Exit(1)
	}
	
	
	// Load MIDI
	midiProcessor := NewMidiProcessor(config)
	virtualNotes, maxRow, err := midiProcessor.LoadMIDI()
	if err != nil {
		fmt.Printf("Error loading MIDI: %v\n", err)
		os.Exit(1)
	}
	
	// Detect key and transpose
	keyProcessor := NewKeyProcessor(config)
	detectedKey := keyProcessor.DetectKey(virtualNotes)
	keyProcessor.TransposeNotes(virtualNotes, detectedKey)
	
	// Flatten notes to timeline
	polyphonicProcessor := NewPolyphonicProcessor(config)
	timelines, ornamentGenerator, err := polyphonicProcessor.FlattenNotes(virtualNotes, maxRow, channelSettings)
	if err != nil {
		fmt.Printf("Error flattening notes: %v\n", err)
		os.Exit(1)
	}
	
	// Generate ornaments
	ornaments := ornamentGenerator.GenerateOrnaments(timelines)
	
	// Apply echo effects
	echoProcessor := NewEchoProcessor(config)
	timelines = echoProcessor.ApplyEcho(timelines, channelSettings)
	
	// Mix channels
	channelMixer := NewChannelMixer(config)
	finalChannels := channelMixer.MixChannels(timelines, channelSettings)
	
	// Generate output
	outputGenerator := NewVortexOutputGenerator(config)
	output := outputGenerator.GenerateOutput(finalChannels, ornaments, channelSettings, detectedKey)
	
	// Write output file
	outputFilename := generateOutputFilename(config.InputFile, config.DiatonicTranspose)
	err = writeOutputFile(outputFilename, output)
	if err != nil {
		fmt.Printf("Error writing output: %v\n", err)
		os.Exit(1)
	}
	
	fmt.Printf("Conversion complete: %s\n", outputFilename)
}

func generateOutputFilename(inputFile string, transpose int) string {
	base := strings.TrimSuffix(filepath.Base(inputFile), filepath.Ext(inputFile))
	if transpose != 0 {
		return fmt.Sprintf("%sd%de.txt", base, transpose)
	}
	return fmt.Sprintf("%se.txt", base)
}

func writeOutputFile(filename, content string) error {
	return os.WriteFile(filename, []byte(content), 0644)
}

// Simplified channel mapping parser
func parseChannelMapping(mapping string) ([][]ChannelSettings, error) {
	ayChannels := strings.Split(mapping, ",")
	result := make([][]ChannelSettings, len(ayChannels))
	
	for ayIdx, ayChannel := range ayChannels {
		midiChannels := strings.Split(ayChannel, "-")
		result[ayIdx] = make([]ChannelSettings, len(midiChannels))
		
		for midiIdx, midiChannel := range midiChannels {
			setting, err := parseChannelSetting(midiChannel)
			if err != nil {
				return nil, err
			}
			result[ayIdx][midiIdx] = setting
		}
	}
	
	return result, nil
}

func parseChannelSetting(setting string) (ChannelSettings, error) {
	// Parse channel mapping syntax: channel[type][modifiers][samples/ornaments][mix_option]
	// Examples: 2me, 3m-7m-6p+, 2me[2f]-6p[3]+, 1d-2me-3p, 4m[uf]-5m[2]+
	
	result := ChannelSettings{
		Sample:   2, // Default sample is 2 in Ruby
		Ornament: 0,
		MixOption: "-", // Default mix option
	}
	
	// Remove any '+' at the end and save it
	if strings.HasSuffix(setting, "+") {
		result.MixOption = "+"
		setting = strings.TrimSuffix(setting, "+")
	}
	
	// Extract channel number (convert to 0-based like Ruby)
	i := 0
	for i < len(setting) && setting[i] >= '0' && setting[i] <= '9' {
		result.MIDIChannel = result.MIDIChannel*10 + int(setting[i]-'0')
		i++
	}
	result.MIDIChannel-- // Convert to 0-based indexing
	
	// Extract instrument type and modifiers
	if i < len(setting) {
		switch setting[i] {
		case 'd':
			result.InstrumentType = "d"
			i++
		case 'm':
			result.InstrumentType = "m"
			i++
			// Check for 'e' after 'm'
			if i < len(setting) && setting[i] == 'e' {
				result.InstrumentType = "e"
				i++
			}
			// Check for 'u' or 'w' modifiers
			for i < len(setting) && (setting[i] == 'u' || setting[i] == 'w') {
				result.Modifiers += string(setting[i])
				i++
			}
		case 'p':
			result.InstrumentType = "p"
			i++
		case 'e':
			result.InstrumentType = "e"
			i++
		}
	}
	
	// Extract sample/ornament if present in [SO] format
	if i < len(setting) && setting[i] == '[' {
		i++ // Skip '['
		
		// Parse sample (first hex digit)
		if i < len(setting) {
			if val, ok := parseHexChar(setting[i]); ok {
				result.Sample = val
				i++
			}
		}
		
		// Parse ornament (second hex digit)
		if i < len(setting) && setting[i] != ']' {
			if val, ok := parseHexChar(setting[i]); ok {
				result.Ornament = val
				i++
			}
		}
		
		// Skip closing bracket
		if i < len(setting) && setting[i] == ']' {
			i++
		}
	}
	
	return result, nil
}

func parseHexChar(ch byte) (int, bool) {
	if ch >= '0' && ch <= '9' {
		return int(ch - '0'), true
	}
	if ch >= 'a' && ch <= 'f' {
		return int(ch - 'a' + 10), true
	}
	if ch >= 'A' && ch <= 'F' {
		return int(ch - 'A' + 10), true
	}
	return 0, false
}