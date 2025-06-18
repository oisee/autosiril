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
func (pp *PolyphonicProcessor) FlattenNotes(virtualNotes []*VirtualNote, maxRow int, channelSettings [][]ChannelSettings) ([][]*TimelineNote, error) {
	fmt.Println("--- flattening polynotes ---")
	
	// Initialize timeline grids for each virtual channel
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
	
	// Group notes by virtual channel based on MIDI channel mapping
	virtualChannelMap := make(map[int]int) // MIDI channel -> virtual channel index
	vChanIndex := 0
	
	for ayIdx, ayChannel := range channelSettings {
		fmt.Printf("vchan:%d\n", ayIdx)
		for _, chanSetting := range ayChannel {
			virtualChannelMap[chanSetting.MIDIChannel] = vChanIndex
			vChanIndex++
		}
	}
	
	// Process each virtual note
	for _, vNote := range virtualNotes {
		virtualChannel, exists := virtualChannelMap[vNote.Channel]
		if !exists {
			continue // Skip unmapped channels
		}
		
		fmt.Printf("rchan:%d note:%d->%s%d\n", virtualChannel, vNote.Note, Pitches[vNote.Note%12], vNote.Note/12-1)
		
		start := vNote.Start + pp.config.SkipLines
		end := vNote.Off + pp.config.SkipLines
		
		if start < 0 || start >= len(timelines[virtualChannel]) {
			continue
		}
		
		// Handle monophonic vs polyphonic processing
		channelSetting := pp.getChannelSetting(vNote.Channel, channelSettings)
		if channelSetting == nil {
			continue
		}
		
		switch channelSetting.InstrumentType {
		case "m", "d", "e": // Monophonic
			pp.processMonophonicNote(timelines[virtualChannel], vNote, start, end, channelSetting)
		case "p": // Polyphonic  
			pp.processPolyphonicNote(timelines[virtualChannel], vNote, start, end, channelSetting)
		}
	}
	
	return timelines, nil
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
	// For monophonic, take highest note if there's a conflict
	for pos := start; pos < end && pos < len(timeline); pos++ {
		if pos == start {
			// Note start
			if timeline[pos].Type == "." || vNote.Note > timeline[pos].Note {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "s")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			}
		} else if pos == end-1 {
			// Note release
			if timeline[pos].Type == "." {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "r")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			}
		} else {
			// Note continue
			if timeline[pos].Type == "." {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "c")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			}
		}
	}
}

func (pp *PolyphonicProcessor) processPolyphonicNote(timeline []*TimelineNote, vNote *VirtualNote, start, end int, setting *ChannelSettings) {
	// For polyphonic, collect chords and process them
	// This is a simplified version - the full polyphonic processing
	// would need to collect simultaneous notes and create ornaments
	
	for pos := start; pos < end && pos < len(timeline); pos++ {
		if pos == start {
			// Note start - for now, just store like monophonic
			// In full implementation, this would collect chord members
			if timeline[pos].Type == "." {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "s")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			}
		} else if pos == end-1 {
			// Note release
			if timeline[pos].Type == "." {
				timeline[pos] = NewTimelineNote(vNote.Note, vNote.Volume, "r")
				timeline[pos].InstrumentKind = setting.InstrumentType
				timeline[pos].Channel = vNote.Channel
				timeline[pos].Settings = vNote.Settings
			}
		} else {
			// Note continue
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