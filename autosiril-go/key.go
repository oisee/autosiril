package main

import "fmt"

// KeyProcessor handles musical key detection and transposition
type KeyProcessor struct {
	config *AutosirilConfig
}

func NewKeyProcessor(config *AutosirilConfig) *KeyProcessor {
	return &KeyProcessor{config: config}
}

// DetectKey detects the musical key from virtual notes
func (kp *KeyProcessor) DetectKey(notes []*VirtualNote) int {
	if kp.config.RealKey <= 12 {
		fmt.Printf("detected key: %d (%s major)\n", kp.config.RealKey, Pitches[kp.config.RealKey])
		return kp.config.RealKey
	}
	
	fmt.Println("--- detecting base note (for major)---")
	
	// Count note occurrences by pitch class
	pitchCounts := make([]int, 12)
	for _, note := range notes {
		pitchCounts[note.Note%12]++
	}
	
	// Test all 12 possible keys
	minPenalty := int(^uint(0) >> 1) // Max int
	bestKey := 0
	
	for key := 0; key < 12; key++ {
		penalty := 0
		for pitch, count := range pitchCounts {
			scalePosition := (pitch - key + 12) % 12
			penalty += count * MajorScalePenalty[scalePosition]
		}
		
		if penalty < minPenalty {
			minPenalty = penalty
			bestKey = key
		}
	}
	
	fmt.Printf("detected key: %d (%s major)\n", bestKey, Pitches[bestKey])
	return bestKey
}

// TransposeNotes applies diatonic transposition to notes
func (kp *KeyProcessor) TransposeNotes(notes []*VirtualNote, detectedKey int) {
	if kp.config.DiatonicTranspose == 0 {
		return
	}
	
	steps := kp.config.DiatonicTranspose
	var transposePattern []int
	
	if steps > 0 {
		transposePattern = DiatomicTransposeUp
	} else {
		transposePattern = DiatomicTransposeDown
		steps = -steps
	}
	
	for _, note := range notes {
		originalNote := note.Note
		currentNote := note.Note
		
		for i := 0; i < steps; i++ {
			pitch := currentNote % 12
			adjustedPitch := (pitch - detectedKey + 12) % 12
			currentNote += transposePattern[adjustedPitch]
		}
		
		note.Note = currentNote
		fmt.Printf("Transposed note %d -> %d\n", originalNote, currentNote)
	}
}