package main

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Ornament represents a VortexTracker ornament
type Ornament struct {
	ID      int
	Pattern []int
}

// OrnamentGenerator handles ornament creation from polyphonic chord data
type OrnamentGenerator struct {
	config         *AutosirilConfig
	ornaments      map[string]int // ornament pattern -> ornament number
	ornamentCounter int
}

func NewOrnamentGenerator(config *AutosirilConfig) *OrnamentGenerator {
	og := &OrnamentGenerator{
		config:          config,
		ornaments:       make(map[string]int),
		ornamentCounter: 1,
	}
	
	// Create "zero" ornament (Ruby's default ornament)
	zeroOrn := og.createOrnamentString([]int{0})
	og.ornaments[zeroOrn] = 0
	
	return og
}

// ProcessChordNotes generates ornaments from chord notes and returns base note and ornament number
func (og *OrnamentGenerator) ProcessChordNotes(chordNotes []int) (int, int) {
	if len(chordNotes) == 0 {
		return 0, 0
	}
	
	if len(chordNotes) == 1 {
		// Single note - use default ornament
		return chordNotes[0], 0
	}
	
	// Sort notes to find base note (minimum)
	sort.Ints(chordNotes)
	baseNote := chordNotes[0]
	
	// Calculate relative offsets from base note (Ruby's proto_orn logic)
	var offsets []int
	for _, note := range chordNotes {
		offset := note - baseNote
		// Add only unique offsets
		found := false
		for _, existing := range offsets {
			if existing == offset {
				found = true
				break
			}
		}
		if !found {
			offsets = append(offsets, offset)
		}
	}
	
	// Apply Ruby's squize_ornament logic
	optimizedBaseNote, optimizedOffsets := og.squizeOrnament(baseNote, offsets)
	
	// Create ornament string
	ornamentString := og.createOrnamentString(optimizedOffsets)
	
	// Check if this ornament already exists
	if ornNum, exists := og.ornaments[ornamentString]; exists {
		return optimizedBaseNote, ornNum
	}
	
	// Add new ornament
	og.ornaments[ornamentString] = og.ornamentCounter
	fmt.Printf("Created ornament %d: %s\n", og.ornamentCounter, ornamentString)
	ornNum := og.ornamentCounter
	og.ornamentCounter++
	
	return optimizedBaseNote, ornNum
}

// squizeOrnament implements Ruby's ornament optimization logic
func (og *OrnamentGenerator) squizeOrnament(baseNote int, offsets []int) (int, []int) {
	if len(offsets) <= 1 {
		return baseNote, offsets
	}
	
	// Sort offsets and find median
	sorted := make([]int, len(offsets))
	copy(sorted, offsets)
	sort.Ints(sorted)
	
	mid := len(sorted) / 2
	median := sorted[mid]
	
	// Filter offsets that are too far from median (Ruby's max_offset logic)
	var filtered []int
	for _, offset := range offsets {
		if abs(offset-median) <= og.config.MaxOffset {
			filtered = append(filtered, offset)
		}
	}
	
	if len(filtered) == 0 {
		filtered = []int{0} // Fallback to zero ornament
	}
	
	// Find minimum offset and adjust base note
	minOffset := filtered[0]
	for _, offset := range filtered {
		if offset < minOffset {
			minOffset = offset
		}
	}
	
	newBaseNote := baseNote + minOffset
	
	// Adjust all offsets relative to minimum
	var newOffsets []int
	for _, offset := range filtered {
		newOffsets = append(newOffsets, offset-minOffset)
	}
	
	return newBaseNote, newOffsets
}

// createOrnamentString creates VTI format ornament string (Ruby's orn_txt logic)
func (og *OrnamentGenerator) createOrnamentString(offsets []int) string {
	var parts []string
	for _, offset := range offsets {
		for i := 0; i < og.config.OrnRepeat; i++ {
			parts = append(parts, fmt.Sprintf("%d", offset))
		}
	}
	return "L" + strings.Join(parts, ",")
}

// GetOrnaments returns all generated ornaments for output
func (og *OrnamentGenerator) GetOrnaments() map[string]int {
	return og.ornaments
}

// GenerateOrnaments creates ornaments from polyphonic channels (for output compatibility)
func (og *OrnamentGenerator) GenerateOrnaments(timelines [][]*TimelineNote) []Ornament {
	fmt.Println("--- making ornaments ---")
	
	var ornaments []Ornament
	
	for i := range timelines {
		fmt.Printf("pchan:%d\n", i)
	}
	
	// Convert internal ornament map to Ornament struct format
	for ornStr, ornID := range og.ornaments {
		if ornID == 0 {
			continue // Skip the zero ornament
		}
		
		// Parse ornament string to extract pattern
		// Format: "L0,0,4,4,7,7" -> [0,0,4,4,7,7]
		var pattern []int
		if strings.HasPrefix(ornStr, "L") {
			parts := strings.Split(ornStr[1:], ",")
			for _, part := range parts {
				if val, err := strconv.Atoi(part); err == nil {
					pattern = append(pattern, val)
				}
			}
		}
		
		ornaments = append(ornaments, Ornament{ID: ornID, Pattern: pattern})
	}
	
	// Sort ornaments by ID for consistent output
	sort.Slice(ornaments, func(i, j int) bool {
		return ornaments[i].ID < ornaments[j].ID
	})
	
	return ornaments
}

// Helper function
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}