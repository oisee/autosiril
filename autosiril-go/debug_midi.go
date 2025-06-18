package main

import (
	"fmt"
	"os"
	"gitlab.com/gomidi/midi/v2/smf"
)

// DebugMIDI prints detailed information about MIDI file structure
func DebugMIDI(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	smfFile, err := smf.ReadFrom(file)
	if err != nil {
		return err
	}

	fmt.Printf("MIDI File: %s\n", filename)
	fmt.Printf("Format: %d\n", smfFile.Format)
	fmt.Printf("Number of tracks: %d\n", len(smfFile.Tracks))
	fmt.Printf("Time format: %v\n", smfFile.TimeFormat)

	for trackIdx, track := range smfFile.Tracks {
		noteCount := 0
		channels := make(map[uint8]int)
		
		for _, event := range track {
			var channel, key, velocity uint8
			if event.Message.GetNoteOn(&channel, &key, &velocity) && velocity > 0 {
				noteCount++
				channels[channel]++
			}
		}
		
		fmt.Printf("\nTrack %d: %d events, %d notes\n", trackIdx, len(track), noteCount)
		for ch, count := range channels {
			fmt.Printf("  Channel %d: %d notes\n", ch, count)
		}
	}
	
	return nil
}