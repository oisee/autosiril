package main

import "fmt"

// ChannelMixer handles multi-channel mixing to AY channels
type ChannelMixer struct {
	config *AutosirilConfig
}

func NewChannelMixer(config *AutosirilConfig) *ChannelMixer {
	return &ChannelMixer{config: config}
}

// MixChannels mixes virtual channels into 3 AY sound chip channels
func (cm *ChannelMixer) MixChannels(timelines [][]*TimelineNote, channelSettings [][]ChannelSettings) [][]*VortexNote {
	fmt.Println("--- mixing channels ---")
	
	// Create 3 AY channels
	ayChannels := make([][]*VortexNote, 3)
	
	// Calculate timeline length
	maxLen := 0
	for _, timeline := range timelines {
		if len(timeline) > maxLen {
			maxLen = len(timeline)
		}
	}
	
	// Initialize AY channels
	for i := range ayChannels {
		ayChannels[i] = make([]*VortexNote, maxLen)
		for j := range ayChannels[i] {
			emptyNote := NewVortexNote(NewTimelineNote(0, 0, "."))
			ayChannels[i][j] = emptyNote
		}
	}
	
	// Mix virtual channels into AY channels based on channel settings
	virtualChannelIndex := 0
	for ayIdx, ayChannelSettings := range channelSettings {
		if ayIdx >= 3 {
			break // Only 3 AY channels available
		}
		
		for _, setting := range ayChannelSettings {
			if virtualChannelIndex < len(timelines) {
				timeline := timelines[virtualChannelIndex]
				
				for pos, timelineNote := range timeline {
					if pos < len(ayChannels[ayIdx]) && timelineNote.Type != "." {
						// Convert timeline note to vortex note
						vortexNote := NewVortexNote(timelineNote)
						vortexNote.InstrumentKind = setting.InstrumentType
						
						// Apply sample and ornament assignments based on instrument type
						cm.applyInstrumentSettings(vortexNote, &setting)
						
						// Priority mixing - only replace if slot is empty or lower priority
						if ayChannels[ayIdx][pos].Type == "." || timelineNote.Volume > ayChannels[ayIdx][pos].Volume {
							ayChannels[ayIdx][pos] = vortexNote
						}
					}
				}
				virtualChannelIndex++
			}
		}
	}
	
	return ayChannels
}

func (cm *ChannelMixer) applyInstrumentSettings(note *VortexNote, setting *ChannelSettings) {
	switch setting.InstrumentType {
	case "d": // Drums
		if note.Note < len(Note2DrumSample) {
			note.Sample = Note2DrumSample[note.Note]
			note.Note = Note2DrumNote[note.Note]
			
			// Recalculate pitch and octave based on new drum note (Ruby-compatible)
			note.Pitch = note.Note % 12
			note.Octave = note.Note / 12  // Ruby appears to use direct MIDI octave for drums
			if note.Octave > 8 {
				note.Octave = 8
			}
			
		}
		note.Envelope = 15
		
	case "m": // Monophonic
		note.Sample = setting.Sample
		note.Ornament = setting.Ornament
		note.Envelope = 15
		
	case "p": // Polyphonic
		note.Sample = setting.Sample
		note.Ornament = setting.Ornament
		note.Envelope = 15
		
	case "e": // Envelope
		note.Sample = setting.Sample
		note.Ornament = setting.Ornament
		// Envelope form already set in VortexNote constructor
	}
}