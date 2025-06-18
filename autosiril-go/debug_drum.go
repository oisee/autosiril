package main

import "fmt"

func DebugDrumMapping() {
	note := 42
	if note < len(Note2DrumNote) {
		fmt.Printf("MIDI note %d (F#2) maps to drum note %d (%s%d)\n", 
			note, Note2DrumNote[note], 
			Pitches[Note2DrumNote[note]%12],
			Note2DrumNote[note]/12-1)
		fmt.Printf("With sample: %d\n", Note2DrumSample[note])
	}
	
	// Show a few more drum mappings
	for i := 36; i <= 48 && i < len(Note2DrumNote); i++ {
		fmt.Printf("Note %d -> %d (sample %d)\n", i, Note2DrumNote[i], Note2DrumSample[i])
	}
}