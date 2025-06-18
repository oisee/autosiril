package main

import (
	"fmt"
	"os"
	"time"

	"gitlab.com/gomidi/midi/v2/smf"
)

// MidiProcessor handles MIDI file loading and note extraction
type MidiProcessor struct {
	config *AutosirilConfig
}

func NewMidiProcessor(config *AutosirilConfig) *MidiProcessor {
	return &MidiProcessor{config: config}
}

// LoadMIDI loads and processes MIDI file, returns virtual notes and max timeline row
func (mp *MidiProcessor) LoadMIDI() ([]*VirtualNote, int, error) {
	file, err := os.Open(mp.config.InputFile)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to open MIDI file: %v", err)
	}
	defer file.Close()

	smfFile, err := smf.ReadFrom(file)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read MIDI file: %v", err)
	}

	var virtualNotes []*VirtualNote
	var maxRow int

	// Calculate clocks per row for timing conversion
	ticksPerQuarter := int(smfFile.TimeFormat.(smf.MetricTicks))
	clocksPerRow := ticksPerQuarter / mp.config.PerBeat

	// Process each track
	for trackIdx, track := range smfFile.Tracks {
		fmt.Printf("track , num_tracks %d, index %d\n", len(smfFile.Tracks), trackIdx)
		
		// Track active notes for note-off events
		activeNotes := make(map[int]*VirtualNote) // key: note number
		currentTime := 0

		// Process messages in track
		for _, event := range track {
			// Update current time based on delta
			currentTime += int(event.Delta)

			var channel, key, velocity uint8
			
			// Handle note on messages
			if event.Message.GetNoteOn(&channel, &key, &velocity) {
				if velocity > 0 {
					// Note on
					trackerRow := (currentTime/clocksPerRow + 1/2) // Round to nearest
					note := &VirtualNote{
						Note:    int(key),
						Volume:  int(velocity),
						Start:   trackerRow,
						Channel: trackIdx, // Use track index as channel
					}
					activeNotes[int(key)] = note
				} else {
					// Note on with velocity 0 = note off
					if activeNote, exists := activeNotes[int(key)]; exists {
						trackerRow := (currentTime/clocksPerRow + 1/2)
						activeNote.Off = trackerRow
						activeNote.Length = activeNote.Off - activeNote.Start
						if activeNote.Length > 0 {
							virtualNotes = append(virtualNotes, activeNote)
							if activeNote.Off > maxRow {
								maxRow = activeNote.Off
							}
						}
						delete(activeNotes, int(key))
					}
				}
			} else if event.Message.GetNoteOff(&channel, &key, &velocity) {
				// Note off
				if activeNote, exists := activeNotes[int(key)]; exists {
					trackerRow := (currentTime/clocksPerRow + 1/2)
					activeNote.Off = trackerRow
					activeNote.Length = activeNote.Off - activeNote.Start
					if activeNote.Length > 0 {
						virtualNotes = append(virtualNotes, activeNote)
						if activeNote.Off > maxRow {
							maxRow = activeNote.Off
						}
					}
					delete(activeNotes, int(key))
				}
			}
		}

		// Handle any remaining active notes at end of track
		for _, activeNote := range activeNotes {
			activeNote.Off = currentTime / clocksPerRow
			activeNote.Length = activeNote.Off - activeNote.Start
			if activeNote.Length > 0 {
				virtualNotes = append(virtualNotes, activeNote)
				if activeNote.Off > maxRow {
					maxRow = activeNote.Off
				}
			}
		}
	}

	fmt.Printf("max_row:%d\n", maxRow)
	return virtualNotes, maxRow, nil
}

// GetCurrentTimestamp returns current timestamp in the format used by original
func GetCurrentTimestamp() string {
	now := time.Now()
	return now.Format("2006.01.02")
}