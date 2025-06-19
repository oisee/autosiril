package main

import (
	"fmt"
	"sort"
)

// PolyphonicProcessor handles note flattening and channel assignment
type PolyphonicProcessor struct {
	config *AutosirilConfig
}

func NewPolyphonicProcessor(config *AutosirilConfig) *PolyphonicProcessor {
	return &PolyphonicProcessor{config: config}
}

// FlattenNotes converts virtual notes to timeline grid representation
func (pp *PolyphonicProcessor) FlattenNotes(virtualNotes []*VirtualNote, maxRow int, channelSettings [][]ChannelSettings) ([][]*TimelineNote, *OrnamentGenerator, error) {
	fmt.Println("--- flattening polynotes ---")
	
	// Create ornament generator for polyphonic processing
	ornamentGen := NewOrnamentGenerator(pp.config)
	
	// Calculate total number of virtual channels (each channel setting gets its own virtual channel)
	numVirtualChannels := 0
	for _, ayChannel := range channelSettings {
		numVirtualChannels += len(ayChannel)
	}
	
	timelines := make([][]*TimelineNote, numVirtualChannels)
	for i := range timelines {
		timelines[i] = make([]*TimelineNote, maxRow+pp.config.SkipLines+1)
		// Initialize with empty notes
		for j := range timelines[i] {
			timelines[i][j] = NewTimelineNote(0, 0, ".")
		}
	}
	
	// Create mapping from channel settings to virtual channel index (like Ruby's abs_index)
	vChanIndex := 0
	
	for ayIdx, ayChannel := range channelSettings {
		fmt.Printf("vchan:%d\n", ayIdx)
		for range ayChannel {
			// Each channel setting gets its own virtual channel, even if it references the same MIDI track
			vChanIndex++
		}
	}
	
	// Process notes for each unique MIDI track first, then duplicate to virtual channels
	trackTimelines := make(map[int][]*TimelineNote)
	
	// Get unique MIDI tracks that are referenced
	uniqueTracks := make(map[int]ChannelSettings)
	for _, ayChannel := range channelSettings {
		for _, chanSetting := range ayChannel {
			if _, exists := uniqueTracks[chanSetting.MIDIChannel]; !exists {
				uniqueTracks[chanSetting.MIDIChannel] = chanSetting
			}
		}
	}
	
	// Process each unique track once
	for midiTrack, setting := range uniqueTracks {
		// Create timeline for this track
		timeline := make([]*TimelineNote, maxRow+pp.config.SkipLines+1)
		for j := range timeline {
			timeline[j] = NewTimelineNote(0, 0, ".")
		}
		
		// Process all virtual notes that match this MIDI track
		noteCount := 0
		for _, vNote := range virtualNotes {
			if vNote.Channel != midiTrack {
				continue // Skip notes not from this MIDI track
			}
			
			start := vNote.Start + pp.config.SkipLines
			end := vNote.Off + pp.config.SkipLines
			
			if start < 0 || start >= len(timeline) {
				fmt.Printf("  Note %d: skipped (start=%d, end=%d, timeline_len=%d)\n", noteCount, start, end, len(timeline))
				continue
			}
			
			noteCount++
			
			switch setting.InstrumentType {
			case "m", "d", "e": // Monophonic
				pp.processMonophonicNote(timeline, vNote, start, end, &setting)
			case "p": // Polyphonic  
				pp.processPolyphonicNote(timeline, vNote, start, end, &setting)
			}
		}
		fmt.Printf("Track %d processed %d notes\n", midiTrack, noteCount)
		
		trackTimelines[midiTrack] = timeline
	}
	
	// Now assign processed track data to virtual channels
	vChanIndex = 0
	for _, ayChannel := range channelSettings {
		for _, chanSetting := range ayChannel {
	// Copy the processed timeline for this track
			if sourceTimeline, exists := trackTimelines[chanSetting.MIDIChannel]; exists {
				
				for i, note := range sourceTimeline {
					if i < len(timelines[vChanIndex]) {
						// Create a copy of the note with the correct instrument type
						copyNote := &TimelineNote{
							Note:           note.Note,
							Volume:         note.Volume,
							Type:           note.Type,
							Pitch:          note.Pitch,
							Octave:         note.Octave,
							InstrumentKind: chanSetting.InstrumentType,
							Channel:        note.Channel,
							Settings:       note.Settings,
							ChordNotes:     note.ChordNotes, // Copy chord data for ornament generation
						}
						
						// Generate ornaments for polyphonic channels
						if chanSetting.InstrumentType == "p" && copyNote.Type == "s" && len(copyNote.ChordNotes) > 1 {
							baseNote, ornamentNum := ornamentGen.ProcessChordNotes(copyNote.ChordNotes)
							copyNote.Note = baseNote
							copyNote.Pitch = baseNote % 12
							copyNote.Octave = baseNote / 12
							if copyNote.Octave > 0 {
								copyNote.Octave--
							}
							// Store ornament number for later use in VortexNote
							copyNote.Settings = fmt.Sprintf("ornament:%d", ornamentNum)
						}
						
						timelines[vChanIndex][i] = copyNote
					}
				}
			}
			vChanIndex++
		}
	}
	
	return timelines, ornamentGen, nil
}

func (pp *PolyphonicProcessor) getChannelSetting(midiChannel int, channelSettings [][]ChannelSettings) *ChannelSettings {
	for _, ayChannel := range channelSettings {
		for _, setting := range ayChannel {
			if setting.MIDIChannel == midiChannel {
				return &setting
			}
		}
	}
	return nil
}

func (pp *PolyphonicProcessor) processMonophonicNote(timeline []*TimelineNote, vNote *VirtualNote, start, end int, setting *ChannelSettings) {
	// Ruby-compatible monophonic processing: collect all notes per time slot, then apply flat_cell_mono logic
	for pos := start; pos < end && pos < len(timeline); pos++ {
		if pos == start {
			// Note start - compete with existing notes for this slot
			if timeline[pos].Type == "." {
				// Empty slot - place our note
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "s")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			} else if timeline[pos].Type == "s" && vNote.Note > timeline[pos].Note {
				// Existing start note - take highest note (Ruby's cell.max behavior)
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "s")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
}
			// If there's already a higher note, don't place this one
		} else if pos == end-1 {
			// Note release - only place if slot is empty (Ruby logic)
			if timeline[pos].Type == "." {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "r")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
}
		} else {
			// Note continue - Ruby shows NOTHING for continues in monophonic mode
			// Don't place continue notes - leave as empty ("." type)
			// This matches Ruby's flat_cell_mono logic where 'c' returns []
		}
	}
}

func (pp *PolyphonicProcessor) processPolyphonicNote(timeline []*TimelineNote, vNote *VirtualNote, start, end int, setting *ChannelSettings) {
	// Ruby-compatible polyphonic processing: collect multiple simultaneous notes per cell
	for pos := start; pos < end && pos < len(timeline); pos++ {
		if pos == start {
			// Note start - collect all simultaneous notes (Ruby's flat_cell_poly keeps all notes)
			if timeline[pos].Type == "." {
				// Empty slot - place our note
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "s")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
				// Mark this note as part of a chord for ornament generation
				timeline[pos].ChordNotes = []int{vNote.Note}
			} else if timeline[pos].Type == "s" {
				// Existing start note - add to chord (polyphonic behavior)
				if timeline[pos].ChordNotes == nil {
					timeline[pos].ChordNotes = []int{timeline[pos].Note}
				}
				timeline[pos].ChordNotes = append(timeline[pos].ChordNotes, vNote.Note)
				// Keep the lowest note as base note (Ruby uses pcell.min)
				if vNote.Note < timeline[pos].Note {
					timeline[pos].Note = vNote.Note
					timeline[pos].Pitch = vNote.Note % 12
					timeline[pos].Octave = vNote.Note / 12
					if timeline[pos].Octave > 0 {
						timeline[pos].Octave--
					}
				}
			}
		} else if pos == end-1 {
			// Note release - only place if slot is empty
			if timeline[pos].Type == "." {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "r")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			}
		} else {
			// Note continue - for polyphonic, keep continues (unlike monophonic)
			if timeline[pos].Type == "." {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "c")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			}
		}
	}
}

// SortNotesByPriority sorts notes by priority for channel mixing
func (pp *PolyphonicProcessor) SortNotesByPriority(notes []*TimelineNote) {
	sort.Slice(notes, func(i, j int) bool {
		// Higher volume = higher priority
		if notes[i].Volume != notes[j].Volume {
			return notes[i].Volume > notes[j].Volume
		}
		// Higher pitch = higher priority
		return notes[i].Note > notes[j].Note
	})
}