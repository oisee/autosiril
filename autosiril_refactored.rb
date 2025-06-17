#!/usr/bin/env ruby
# frozen_string_literal: true

# Autosiril Refactored - MIDI to VortexTracker Converter
# A clean, modular refactoring of the original autosiril.rb
# Maintains 100% compatibility with original output while improving code structure

require 'midilib'
require_relative './module_template.rb'

# ============================================================================
# CONSTANTS AND LOOKUP TABLES
# ============================================================================

module AutosirilConstants
  # Musical note names
  PITCHES = %w[C- C# D- D# E- F- F# G- G# A- A# B-].freeze
  
  # VortexTracker parameter encoding (hexadecimal equivalents)
  PARAMS = %w[. 1 2 3 4 5 6 7 8 9 A B C D E F G H I J K L M N O P Q R S T U V].freeze
  
  # Character to numeric mapping for sample/ornament assignments
  PARAM_MAP = PARAMS.each_with_index.to_h.freeze
  
  # Envelope frequency offsets by MIDI note number (12 octaves * 12 semitones)
  ENV_OFFSETS = [
    # Octave -1: +24 semitones offset
    [24] * 12,
    # Octave 0: +24 semitones offset  
    [24] * 12,
    # Octave 1: +24 semitones offset
    [24] * 12,
    # Octave 2: Mixed offsets for hardware envelope tuning
    [24, 24, 24, 24, 24, 24, 24, 24, 24, 12, 12, 24],
    # Octave 3: Transition to optimal range
    [0, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 12],
    # Octave 4: Optimal envelope range
    [-12, 0, 0, 0, 0, 0, -12, 0, 0, -12, -12, 0],
    # Octave 5: Lower frequency range
    [-24, -12, -12, -12, -12, -12, -24, -12, -12, -24, -24, -12],
    # Octave 6: Much lower frequencies
    [-36, -24, -24, -24, -24, -24, -36, -24, -24, -24, -48, -24],
    # Octave 7: Very low frequencies
    [-48, -36, -36, -36, -36, -36, -48, -36, -36, -36, -52, -36],
    # Octave 8: Extremely low frequencies
    [-52, -48, -48, -48, -48, -48, -52, -48, -48, -48, -60, -48],
    # Octave 9: Ultra-low frequencies
    [-60, -52, -52, -52, -52, -52, -60, -52, -52, -52, -72, -52],
    # Octave 10: Lowest usable frequencies
    [-72, -60, -60, -60, -60, -60, -72, -60, -60, -60, -84, -60]
  ].flatten.freeze

  # Envelope forms by MIDI note number
  ENV_FORMS = [
    # Octaves -1, 0, 1: Default envelope form 10
    ([10] * 12) * 3,
    # Octave 2: Mixed forms for transition
    [10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 12, 10],
    # Octaves 3-10: Enhanced envelope form 12
    ([12] * 12) * 8
  ].flatten.freeze

  # Drum sample mappings by MIDI note number
  DRUM_SAMPLES = {
    hihat1: PARAM_MAP['8'],    # H1
    hihat2: PARAM_MAP['L'],    # H2
    kick1:  PARAM_MAP['9'],    # K1
    kick2:  PARAM_MAP['A'],    # K2
    kick3:  PARAM_MAP['D'],    # K3
    kick4:  PARAM_MAP['H'],    # K4
    kick5:  PARAM_MAP['R'],    # K5
    clap:   PARAM_MAP['B'],    # CL
    snare1: PARAM_MAP['C'],    # S1
    snare2: PARAM_MAP['K'],    # S2
    snare3: PARAM_MAP['V'],    # S3
    perc1:  PARAM_MAP['E'],    # P1
    perc2:  PARAM_MAP['F'],    # P2
    tom:    PARAM_MAP['J'],    # TM
    noise1: PARAM_MAP['O'],    # N1
    noise2: PARAM_MAP['P'],    # N2
    noise3: PARAM_MAP['U']     # N3
  }.freeze

  # MIDI note to drum sample mapping (12 octaves * 12 semitones)
  NOTE2DRUM_SAMPLE = [
    # Octaves -1, 0, 1: Default to kick2
    ([DRUM_SAMPLES[:kick2]] * 12) * 3,
    # Octave 2: Full drum kit mapping
    [DRUM_SAMPLES[:kick2], DRUM_SAMPLES[:kick5], DRUM_SAMPLES[:snare1], 
     DRUM_SAMPLES[:clap], DRUM_SAMPLES[:snare3], DRUM_SAMPLES[:kick1], 
     DRUM_SAMPLES[:tom], DRUM_SAMPLES[:kick1], DRUM_SAMPLES[:hihat2], 
     DRUM_SAMPLES[:kick1], DRUM_SAMPLES[:kick5], DRUM_SAMPLES[:kick1]],
    # Octave 3: Hihat-focused mapping
    [DRUM_SAMPLES[:hihat2], DRUM_SAMPLES[:hihat2], DRUM_SAMPLES[:hihat2], 
     DRUM_SAMPLES[:hihat2], DRUM_SAMPLES[:hihat2], DRUM_SAMPLES[:hihat2], 
     DRUM_SAMPLES[:hihat2], DRUM_SAMPLES[:hihat2], DRUM_SAMPLES[:hihat2], 
     DRUM_SAMPLES[:tom], DRUM_SAMPLES[:hihat2], DRUM_SAMPLES[:hihat2]],
    # Octaves 4-10: Default to hihat2
    ([DRUM_SAMPLES[:hihat2]] * 12) * 7
  ].flatten.freeze

  # MIDI note to drum frequency mapping
  NOTE2DRUM_NOTE = [
    # Octaves -1, 0, 1: Default frequency (C-5)
    ([12 * 5] * 12) * 3,
    # Octave 2: Drum frequency mapping
    [12 * 5, 12 * 5, 12 * 5, 12 * 5, 12 * 6, 12 * 4, 
     12 * 9 + 11, 12 * 5, 12 * 5, 12 * 5, 12 * 4, 12 * 5 + 3],
    # Octave 3: Higher frequency range
    [12 * 5, 12 * 5, 12 * 5, 12 * 5, 12 * 5, 12 * 5, 
     12 * 5, 12 * 5, 12 * 5, 12 * 9 + 11, 12 * 5, 12 * 5],
    # Octaves 4-10: Default frequency
    ([12 * 5] * 12) * 7
  ].flatten.freeze

  # Major scale penalty pattern for key detection
  # 0 = scale note (C major: C D E F G A B), 1 = non-scale note
  MAJOR_SCALE_PENALTY = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0].freeze

  # Diatonic transposition intervals
  DIATONIC_UP = [2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1].freeze    # Semitones up by scale degree
  DIATONIC_DOWN = [-1, -2, -2, -2, -2, -1, -2, -2, -2, -2, -2, -2].freeze  # Semitones down
end

# ============================================================================
# DATA STRUCTURES
# ============================================================================

# Represents a virtual MIDI note with tracker timing
class VirtualNote
  attr_accessor :note, :volume, :start_row, :end_row, :length

  def initialize(midi_note, start_time, end_time, velocity, clocks_per_row)
    @note = midi_note
    @volume = velocity
    @start_row = (start_time.to_f / clocks_per_row + 0.5).to_i
    @end_row = (end_time.to_f / clocks_per_row + 0.5).to_i
    @length = @end_row - @start_row
  end

  def to_s
    pitch = note % 12
    octave = note_to_octave(note)
    "#{AutosirilConstants::PITCHES[pitch]}#{octave}"
  end

  private

  def note_to_octave(note)
    oct = ((note / 12) - 1) < 1 ? (note / 12) : ((note / 12) - 1)
    [[oct, 8].min, 0].max  # Clamp to valid octave range 0-8
  end
end

# Represents a note in the timeline grid with state information
class TimelineNote
  attr_accessor :note, :volume, :type
  attr_reader :pitch, :octave

  # Note types: 's' = start, 'r' = release, 'c' = continue
  def initialize(note, volume, type)
    @note = note
    @volume = volume
    @type = type
    calculate_pitch_octave
  end

  def note=(new_note)
    @note = new_note
    calculate_pitch_octave
  end

  def to_s
    case @type
    when 'r' then 'R--'
    when '.' then '---'
    else "#{AutosirilConstants::PITCHES[@pitch]}#{@octave}"
    end
  end

  include Comparable
  def <=>(other)
    @note <=> other.note
  end

  private

  def calculate_pitch_octave
    @pitch = @note % 12
    @octave = ((@note / 12) - 1) < 1 ? (@note / 12) : ((@note / 12) - 1)
    @octave = [[@octave, 8].min, 0].max  # Clamp to valid range
  end
end

# Represents a final VortexTracker note with all parameters
class VortexNote
  attr_accessor :note, :envelope_note, :sample, :envelope, :ornament, :volume, :type, :instrument_kind
  attr_reader :pitch, :octave, :envelope_pitch, :envelope_octave

  def initialize(note, sample, envelope, ornament, volume, type, instrument_kind, config)
    @note = note
    @sample = sample
    @envelope = envelope
    @ornament = ornament
    @volume = volume
    @type = type
    @instrument_kind = instrument_kind
    @config = config
    
    calculate_pitch_octave
    calculate_envelope_note
    calculate_envelope_pitch_octave
  end

  def note=(new_note)
    @note = new_note
    calculate_pitch_octave
    calculate_envelope_note
    calculate_envelope_pitch_octave
  end

  def instrument_kind=(new_kind)
    @instrument_kind = new_kind
    calculate_envelope_note
    calculate_envelope_pitch_octave
  end

  def volume=(new_volume)
    @volume = new_volume
    calculate_envelope_note
    calculate_envelope_pitch_octave
  end

  def to_s
    case @type
    when 'r' then 'R--'
    when '.' then '---'
    else "#{AutosirilConstants::PITCHES[@pitch]}#{@octave}"
    end
  end

  def envelope_note_display
    return '....' unless envelope_active?
    " #{AutosirilConstants::PITCHES[@envelope_pitch]}#{@envelope_octave}"
  end

  def envelope_active?
    @instrument_kind == 'e' && @type != 'r' && @type != '.' && (1..14).include?(@envelope)
  end

  include Comparable
  def <=>(other)
    @note <=> other.note
  end

  private

  def calculate_pitch_octave
    @pitch = @note % 12
    @octave = ((@note / 12) - 1) < 1 ? (@note / 12) : ((@note / 12) - 1)
    @octave = [[@octave, 8].min, 0].max
  end

  def calculate_envelope_note
    if @instrument_kind == 'e'
      if @volume >= 15  # Full volume note
        @envelope = AutosirilConstants::ENV_FORMS[@note] if @note < AutosirilConstants::ENV_FORMS.length
        @sample = @config.envelope_sample
      else  # Delayed/quiet note
        @envelope = @config.envelope_changes_volume ? AutosirilConstants::ENV_FORMS[@note] : 15
        @sample = @config.envelope_dsample
      end
      
      @envelope_note = @config.cool_envelope ? @note + AutosirilConstants::ENV_OFFSETS[@note] : @note
    else
      @envelope_note = -1
    end
  end

  def calculate_envelope_pitch_octave
    return unless @envelope_note > 0
    
    @envelope_pitch = @envelope_note % 12
    @envelope_octave = ((@envelope_note / 12) - 1) < 1 ? (@envelope_note / 12) : ((@envelope_note / 12) - 1)
    @envelope_octave = [[@envelope_octave, 8].min, 0].max
  end
end

# ============================================================================
# CONFIGURATION AND SETUP
# ============================================================================

class AutosirilConfig
  attr_reader :input_file, :output_file, :channel_mappings, :sample_assignments, :ornament_assignments,
              :midi_channels, :per_beat, :per_delay, :per_delay2, :pattern_size, :skip_lines,
              :ornament_repeat, :max_offset, :diatonic_transpose, :real_key, :clocks_per_row,
              :channel_settings, :mix_options, :cool_envelope, :envelope_changes_volume,
              :envelope_sample, :envelope_dsample

  attr_accessor :max_row

  DEFAULT_TEST_FILE = './test/tottoro_example.mid'
  DEFAULT_CHANNEL_MAPPING = '1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+'

  def initialize(args = ARGV)
    @max_row = 0
    parse_arguments(args)
    setup_envelope_config
  end

  def load_midi_sequence
    @sequence = MIDI::Sequence.new
    
    File.open(@input_file, 'rb') do |file|
      @sequence.read(file) do |track, num_tracks, index|
        puts "track #{track}, num_tracks #{num_tracks}, index #{index}" if ENV['DEBUG']
      end
    end

    @clocks_per_row = @sequence.ppqn.to_f / @per_beat.to_f
    @sequence
  end

  private

  def parse_arguments(args)
    @input_file = args[0] || DEFAULT_TEST_FILE
    channel_mapping = args[1] || DEFAULT_CHANNEL_MAPPING
    
    @per_beat = (args[2] || 4).to_i
    @per_delay = (args[3] || 3).to_i
    @per_delay2 = (args[4] || 6).to_i
    
    # Calculate optimal pattern size
    pattern_size_base = @per_beat * 64
    while pattern_size_base > 127 && pattern_size_base.even?
      pattern_size_base /= 2
    end
    @pattern_size = (args[5] || pattern_size_base).to_i
    @pattern_size = pattern_size_base if @pattern_size == 0

    @skip_lines = (args[6] || 0).to_i
    @ornament_repeat = (args[7] || 1).to_i
    @max_offset = (args[8] || 12).to_i
    @diatonic_transpose = (args[9] || 0).to_i
    @real_key = (args[10] || 13).to_i

    parse_channel_mapping(channel_mapping)
    generate_output_filename
  end

  def parse_channel_mapping(mapping_string)
    # Parse complex channel mapping: "1d-2me-3p,4m[uf]-5m[2]+"
    @channel_mappings = mapping_string.split(',').map { |group| group.split('-') }
    @midi_channels = @channel_mappings.flatten.map { |ch| extract_channel_number(ch) }
    
    @channel_settings = @channel_mappings.flatten.map { |ch| extract_instrument_settings(ch) }
    @mix_options = @channel_mappings.flatten.map { |ch| extract_mix_option(ch) }
    @sample_assignments = @channel_mappings.flatten.map { |ch| extract_sample_assignment(ch) }
    @ornament_assignments = @channel_mappings.flatten.map { |ch| extract_ornament_assignment(ch) }

    puts "chan_settings: #{@channel_settings.inspect}" if ENV['DEBUG']
  end

  def extract_channel_number(channel_spec)
    channel_spec.match(/^(\d+)/)[1].to_i - 1  # Convert to 0-based index
  end

  def extract_instrument_settings(channel_spec)
    # Remove sample/ornament assignments and mix options for clean parsing
    clean_spec = channel_spec.gsub(/\[[^\]]*\]/, '').gsub(/[+-]$/, '')
    clean_spec.gsub(/^\d+/, '')  # Remove channel number
  end

  def extract_mix_option(channel_spec)
    return '+' if channel_spec.end_with?('+')
    return '-'  # Default mixing option
  end

  def extract_sample_assignment(channel_spec)
    match = channel_spec.match(/\[([^\]]*)\]/)
    return 2 unless match  # Default sample
    
    sample_char = match[1][0]
    AutosirilConstants::PARAM_MAP[sample_char.upcase] || 2
  end

  def extract_ornament_assignment(channel_spec)
    match = channel_spec.match(/\[([^\]]*)\]/)
    return 0 unless match  # Default ornament
    
    ornament_char = match[1][1]
    return 0 unless ornament_char
    
    AutosirilConstants::PARAM_MAP[ornament_char.upcase] || 0
  end

  def generate_output_filename
    transpose_suffix = @diatonic_transpose != 0 ? "d#{@diatonic_transpose}" : ''
    @output_file = "#{@input_file}#{transpose_suffix}e.txt"
  end

  def setup_envelope_config
    @cool_envelope = true
    @envelope_changes_volume = false
    @envelope_sample = @cool_envelope ? 2 : 29
    @envelope_dsample = @envelope_changes_volume ? 18 : 2
  end
end

# ============================================================================
# MIDI PROCESSING
# ============================================================================

class MidiProcessor
  def initialize(config)
    @config = config
  end

  def extract_virtual_notes(sequence)
    virtual_channels = []
    
    sequence.each do |track|
      puts "   track:#{track}" if ENV['DEBUG']
      channel_notes = []
      
      track.each do |event|
        next unless event.respond_to?(:note) && event.respond_to?(:off)
        
        virtual_note = VirtualNote.new(
          event.note, 
          event.time_from_start, 
          event.off.time_from_start, 
          15,  # Default velocity
          @config.clocks_per_row
        )
        
        channel_notes << virtual_note
        @config.max_row = [@config.max_row, virtual_note.end_row, 
                          virtual_note.end_row + @config.per_delay, 
                          virtual_note.end_row + @config.per_delay2].max
      end
      
      virtual_channels << channel_notes unless channel_notes.empty?
    end

    puts "max_row:#{@config.max_row}" if ENV['DEBUG']
    virtual_channels
  end

  def create_timeline_grid(virtual_channels)
    timeline_channels = []
    
    @config.midi_channels.each do |channel_index|
      puts "vchan:#{channel_index}" if ENV['DEBUG']
      
      timeline = Array.new(@config.max_row) { [] }
      
      virtual_channels[channel_index].each do |virtual_note|
        # Add start event
        timeline[virtual_note.start_row] << TimelineNote.new(virtual_note.note, virtual_note.volume, 's')
        
        # Add release event
        timeline[virtual_note.end_row] << TimelineNote.new(virtual_note.note, virtual_note.volume, 'r')
        
        # Add continue events
        (virtual_note.start_row + 1...virtual_note.end_row).each do |row|
          timeline[row] << TimelineNote.new(virtual_note.note, virtual_note.volume, 'c')
        end
      end
      
      timeline_channels << timeline
    end
    
    timeline_channels
  end
end

# ============================================================================
# KEY DETECTION AND TRANSPOSITION
# ============================================================================

class KeyProcessor
  def initialize(config)
    @config = config
  end

  def detect_key(timeline_channels)
    puts '--- detecting base note (for major)---' if ENV['DEBUG']
    
    note_statistics = [0] * 12
    
    # Collect notes from channels that have scale information
    timeline_channels.each_with_index do |timeline, channel_index|
      settings = @config.channel_settings[channel_index]
      next unless settings.include?('s')  # Only analyze scale-relevant channels
      
      timeline.each do |cell|
        cell.each do |note|
          note_statistics[note.note % 12] += 1 if note.type == 's'
        end
      end
    end

    return calculate_best_key(note_statistics)
  end

  def apply_diatonic_transpose(timeline_channels, detected_key)
    return timeline_channels if @config.diatonic_transpose == 0

    puts "Applying diatonic transposition: #{@config.diatonic_transpose}" if ENV['DEBUG']
    
    transpose_steps = @config.diatonic_transpose.abs
    intervals = @config.diatonic_transpose > 0 ? 
                AutosirilConstants::DIATONIC_UP : 
                AutosirilConstants::DIATONIC_DOWN

    timeline_channels.each do |timeline|
      timeline.each do |cell|
        cell.each do |note|
          transpose_steps.times do
            scale_degree = (note.note - detected_key) % 12
            note.note += intervals[scale_degree]
          end
        end
      end
    end

    timeline_channels
  end

  private

  def calculate_best_key(note_statistics)
    penalties = Array.new(12, 0)
    
    12.times do |key|
      note_statistics.each_with_index do |count, pitch|
        scale_position = (pitch - key) % 12
        penalties[key] += count * AutosirilConstants::MAJOR_SCALE_PENALTY[scale_position]
      end
    end

    if @config.real_key > 12
      best_key = penalties.index(penalties.min)
    else
      best_key = @config.real_key % 12
    end

    puts "detected key: #{best_key} (#{AutosirilConstants::PITCHES[best_key]} major)" if ENV['DEBUG']
    best_key
  end
end

# ============================================================================
# POLYPHONIC PROCESSING
# ============================================================================

class PolyphonicProcessor
  def initialize(config)
    @config = config
  end

  def flatten_polyphony(timeline_channels)
    puts '--- flattening polynotes ---' if ENV['DEBUG']
    
    flattened_channels = []
    
    timeline_channels.each_with_index do |timeline, channel_index|
      puts "rchan:#{channel_index}" if ENV['DEBUG']
      
      flattened_timeline = []
      instrument_type = @config.channel_settings[channel_index]
      
      timeline.each do |cell|
        flattened_cell = case instrument_type
                        when /p/ then flatten_polyphonic_cell(cell)
                        when /m/ then flatten_monophonic_cell(cell)
                        when /d/ then flatten_drum_cell(cell)
                        else flatten_monophonic_cell(cell)  # Default
                        end
        
        flattened_timeline << flattened_cell
      end
      
      flattened_channels << flattened_timeline
    end
    
    flattened_channels
  end

  private

  def flatten_polyphonic_cell(cell)
    # Polyphonic: keep all notes for ornament generation
    event_types = cell.map(&:type).uniq.sort.join
    
    case event_types
    when 'c' then []  # Continue only - no output
    when 'r' 
      note = cell.min.dup
      note.type = 'r'
      [note]
    when 's' then cell  # Start - keep all notes
    when 'cr', 'cs' then cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
    when 'rs' then cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
    when 'crs' then cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
    else []
    end
  end

  def flatten_monophonic_cell(cell)
    # Monophonic: take highest note only
    event_types = cell.map(&:type).uniq.sort.join
    
    case event_types
    when 'c' then []
    when 'r'
      note = cell.min.dup
      note.type = 'r'
      [note]
    when 's' then [cell.max]  # Take highest note
    when 'cr', 'cs'
      filtered = cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
      [filtered.max]
    when 'rs'
      filtered = cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
      [filtered.max]
    when 'crs'
      filtered = cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
      [filtered.max]
    else []
    end
  end

  def flatten_drum_cell(cell)
    # Drums: take lowest note (bass drum priority)
    event_types = cell.map(&:type).uniq.sort.join
    
    case event_types
    when 'c' then []
    when 'r'
      note = cell.min.dup
      note.type = 'r'
      [note]
    when 's' then [cell.min]  # Take lowest note
    when 'cr', 'cs'
      filtered = cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
      [filtered.min]
    when 'rs'
      filtered = cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
      [filtered.min]
    when 'crs'
      filtered = cell.reject { |n| n.type == 'r' }.each { |n| n.type = 's' }
      [filtered.min]
    else []
    end
  end
end

# ============================================================================
# ORNAMENT GENERATION
# ============================================================================

class OrnamentGenerator
  def initialize(config)
    @config = config
    @ornaments = create_base_ornaments
    @ornament_counter = 1
  end

  attr_reader :ornaments

  def process_ornaments(flattened_channels)
    puts '--- making ornaments ---' if ENV['DEBUG']
    
    vortex_channels = []
    
    flattened_channels.each_with_index do |timeline, channel_index|
      puts "pchan:#{channel_index}" if ENV['DEBUG']
      
      vortex_timeline = []
      instrument_type = @config.channel_settings[channel_index]
      
      timeline.each do |cell|
        vortex_note = if cell.empty?
                       nil
                     else
                       create_vortex_note(cell, channel_index, instrument_type)
                     end
        
        vortex_timeline << vortex_note
      end
      
      vortex_channels << vortex_timeline
    end
    
    vortex_channels
  end

  def generate_ornament_text
    ornament_text = ''
    sorted_ornaments = @ornaments.invert.sort
    
    sorted_ornaments.each do |number, definition|
      next if number == 0  # Skip base ornament
      
      ornament_text += "\n[Ornament#{number}]\n#{definition}\n"
    end
    
    ornament_text
  end

  private

  def create_base_ornaments
    # Create the fundamental "zero" ornament
    base_ornament = 'L' + (['0'] * @config.ornament_repeat).join(',')
    { base_ornament => 0 }
  end

  def create_vortex_note(cell, channel_index, instrument_type)
    base_note = cell.min.note
    chord_offsets = cell.uniq.sort.map { |note| note.note - base_note }.uniq
    
    # Generate or find ornament for this chord
    final_base_note, ornament_number = if instrument_type.include?('p')
                                        generate_ornament_for_chord(base_note, chord_offsets)
                                      else
                                        [base_note, @config.ornament_assignments[channel_index]]
                                      end
    
    # Create VortexNote with appropriate settings
    vortex_note = VortexNote.new(
      final_base_note,
      @config.sample_assignments[channel_index],
      0,  # Default envelope
      ornament_number,
      15,  # Default volume
      cell.min.type,
      determine_instrument_kind(instrument_type),
      @config
    )
    
    # Apply drum mapping if needed
    if instrument_type.include?('d')
      apply_drum_mapping(vortex_note)
    end
    
    # Apply envelope settings if needed
    if instrument_type.include?('e')
      vortex_note.instrument_kind = 'e'
    end
    
    vortex_note
  end

  def generate_ornament_for_chord(base_note, chord_offsets)
    # Optimize ornament by filtering extreme offsets
    median_offset = chord_offsets.sort[chord_offsets.length / 2]
    filtered_offsets = chord_offsets.select { |offset| (offset - median_offset).abs <= @config.max_offset }
    
    # Normalize to lowest note
    min_offset = filtered_offsets.min
    new_base_note = base_note + min_offset
    normalized_offsets = filtered_offsets.map { |offset| offset - min_offset }
    
    # Generate ornament definition string
    ornament_def = 'L' + (normalized_offsets.flat_map { |offset| [offset.to_s] * @config.ornament_repeat }).join(',')
    
    # Find or create ornament
    unless @ornaments.key?(ornament_def)
      @ornaments[ornament_def] = @ornament_counter
      @ornament_counter += 1
    end
    
    # Adjust base note octave for better playback
    if @ornaments[ornament_def] != 0
      new_base_note -= 12 if new_base_note >= (12 * 6)  # Lower if too high
      new_base_note += 12 if new_base_note <= (12 * 4)  # Raise if too low
    end
    
    [new_base_note, @ornaments[ornament_def]]
  end

  def determine_instrument_kind(instrument_type)
    return 'p' if instrument_type.include?('p')
    return 'd' if instrument_type.include?('d')
    return 'e' if instrument_type.include?('e')
    'm'  # Default monophonic
  end

  def apply_drum_mapping(vortex_note)
    note_index = [vortex_note.note, AutosirilConstants::NOTE2DRUM_SAMPLE.length - 1].min
    note_index = [note_index, 0].max
    
    vortex_note.sample = AutosirilConstants::NOTE2DRUM_SAMPLE[note_index]
    vortex_note.note = AutosirilConstants::NOTE2DRUM_NOTE[note_index]
  end
end

# ============================================================================
# ECHO AND DELAY PROCESSING
# ============================================================================

class EchoProcessor
  def initialize(config)
    @config = config
  end

  def apply_delays(vortex_channels)
    puts '--- applying delays ---' if ENV['DEBUG']
    
    delayed_channels = []
    
    vortex_channels.each_with_index do |timeline, channel_index|
      puts "lchan:#{channel_index}" if ENV['DEBUG']
      
      delayed_timeline = timeline.dup
      channel_settings = @config.channel_settings[channel_index]
      
      timeline.each_with_index do |note, row_index|
        next unless note && should_apply_delay?(note, channel_settings)
        
        delay_multiplier = channel_settings.include?('w') ? 2 : 1
        primary_delay = @config.per_delay * delay_multiplier
        secondary_delay = @config.per_delay2 * delay_multiplier
        
        # Apply primary delay
        apply_delay_at_position(delayed_timeline, note, row_index + primary_delay, 0.7)
        
        # Apply secondary delay
        apply_delay_at_position(delayed_timeline, note, row_index + secondary_delay, 0.49)  # 0.7²
      end
      
      delayed_channels << delayed_timeline
    end
    
    delayed_channels
  end

  private

  def should_apply_delay?(note, channel_settings)
    !channel_settings.include?('u')  # No delay if 'u' (mute) modifier present
  end

  def apply_delay_at_position(timeline, original_note, position, volume_factor)
    return if position >= timeline.length
    return if timeline[position] && timeline[position].type != 'r'  # Don't override existing notes
    
    delayed_note = original_note.dup
    delayed_note.volume = (delayed_note.volume * volume_factor).to_i
    timeline[position] = delayed_note
  end
end

# ============================================================================
# CHANNEL MIXING
# ============================================================================

class ChannelMixer
  def initialize(config)
    @config = config
  end

  def mix_channels(delayed_channels)
    puts '--- mixing channels ---' if ENV['DEBUG']
    
    mixed_channels = []
    channel_index = 0
    
    @config.channel_mappings.each_with_index do |channel_group, group_index|
      puts "mixing group #{group_index}" if ENV['DEBUG']
      
      mixed_timeline = Array.new(@config.max_row)
      
      channel_group.each do |_|
        source_timeline = delayed_channels[channel_index]
        mix_option = @config.mix_options[channel_index]
        
        puts "mixing lchan:#{channel_index} into #{group_index}" if ENV['DEBUG']
        
        source_timeline.each_with_index do |note, row_index|
          next unless note
          
          mixed_note = note.dup
          
          if mix_option == '+'  # Priority mixing
            mixed_timeline[row_index] = mixed_note if can_place_priority(mixed_timeline, row_index, mixed_note)
          else  # Sequential mixing (default)
            place_sequential(mixed_timeline, row_index, mixed_note)
          end
        end
        
        channel_index += 1
      end
      
      mixed_channels << mixed_timeline
    end
    
    mixed_channels
  end

  private

  def can_place_priority(timeline, row_index, note)
    existing = timeline[row_index]
    !existing || existing.type == 'r' || existing.volume < note.volume
  end

  def place_sequential(timeline, start_row, note)
    # Try to place note, with small delays if position is occupied
    (0..3).each do |offset|
      row = start_row + offset
      next if row >= timeline.length
      
      existing = timeline[row]
      if !existing || existing.type == 'r' || existing.volume < note.volume
        timeline[row] = note
        break
      end
    end
  end
end

# ============================================================================
# VORTEX TRACKER OUTPUT GENERATION
# ============================================================================

class VortexOutputGenerator
  def initialize(config, ornaments)
    @config = config
    @ornaments = ornaments
  end

  def generate_patterns(mixed_channels)
    puts '--- generating patterns ---' if ENV['DEBUG']
    
    text_lines = render_to_text(mixed_channels)
    patterns, used_patterns, play_order = split_into_patterns(text_lines)
    
    { patterns: patterns, used_patterns: used_patterns, play_order: play_order }
  end

  def save_module(pattern_data, ornament_text, args_string)
    patterns = pattern_data[:patterns]
    used_patterns = pattern_data[:used_patterns]
    play_order = pattern_data[:play_order]
    
    File.open(@config.output_file, 'w') do |file|
      file.puts module_header(args_string, play_order, ornament_text)
      
      patterns.each_with_index do |pattern_text, index|
        if used_patterns[index] && !pattern_text.empty?
          file.puts "\n[Pattern#{index}]"
          file.puts pattern_text
        end
      end
    end
  end

  private

  def render_to_text(mixed_channels)
    text_lines = []
    empty_note = create_empty_note
    
    # Envelope management
    previous_envelope_forms = [15, 15, 15]
    previous_envelope_note = empty_note
    
    @config.max_row.times do |row|
      # Get notes for all three AY channels
      channel_notes = (0..2).map do |ch_index|
        mixed_channels[ch_index] ? mixed_channels[ch_index][row] : nil
      end
      
      # Replace nil with empty notes
      channel_notes.map! { |note| note || empty_note.dup }
      
      # Handle envelope conflicts and selection
      current_envelope_note = select_envelope_note(channel_notes)
      current_envelope_forms = update_envelope_forms(channel_notes, previous_envelope_forms)
      
      resolve_envelope_conflicts(channel_notes, current_envelope_note, previous_envelope_forms, previous_envelope_note)
      
      # Format output line
      envelope_display = format_envelope_display(current_envelope_note)
      note_displays = channel_notes.map { |note| format_note_display(note) }
      
      text_line = "#{envelope_display}|..|#{note_displays.join('|')}"
      text_lines << text_line
      
      # Update previous values
      previous_envelope_note = current_envelope_note if current_envelope_note.envelope_active?
      previous_envelope_forms = current_envelope_forms
    end
    
    text_lines
  end

  def create_empty_note
    VortexNote.new(-1, 0, 0, 0, 0, '.', '', @config)
  end

  def select_envelope_note(channel_notes)
    envelope_candidates = channel_notes.select(&:envelope_active?)
    return create_empty_note if envelope_candidates.empty?
    
    envelope_candidates.max  # Highest envelope note wins
  end

  def update_envelope_forms(channel_notes, previous_forms)
    current_forms = previous_forms.dup
    
    channel_notes.each_with_index do |note, index|
      if note.type != '.' && note.type != 'r'
        current_forms[index] = note.envelope
      end
    end
    
    current_forms
  end

  def resolve_envelope_conflicts(channel_notes, current_envelope_note, previous_forms, previous_envelope_note)
    return unless current_envelope_note.envelope_active?
    
    channel_notes.each_with_index do |note, index|
      # Handle simultaneous different envelopes
      if note.envelope_active? && note.envelope_pitch != current_envelope_note.envelope_pitch
        note.instrument_kind = 'm'  # Convert to monophonic
      # Handle same pitch but different octaves
      elsif note.envelope_active? && note.envelope_pitch == current_envelope_note.envelope_pitch
        if (current_envelope_note.envelope_octave - note.envelope_octave) >= 1
          note.note += 12  # Raise lower octave note
        end
      end
      
      # Handle envelope conflicts with empty notes
      if current_envelope_note.volume == 15 && note.type == '.' && 
         (1..14).include?(previous_forms[index]) && 
         previous_envelope_note.envelope_pitch != current_envelope_note.envelope_pitch
        note.envelope = 15
      end
    end
  end

  def format_envelope_display(envelope_note)
    envelope_note.envelope_active? ? envelope_note.envelope_note_display : '....'
  end

  def format_note_display(note)
    return '--- .F.. ....' if note.type == '.' && note.envelope != 0
    return 'R-- .... ....' if note.type == 'r'
    return '--- .... ....' if note.type == '.'
    
    # Active note display
    volume = note.volume.clamp(1, 15)
    
    case note.instrument_kind
    when 'p'
      note.envelope = 15
      format_note_parameters(note, volume)
    when 'e'
      format_note_parameters(note, volume)
    when 'd'
      note.envelope = 15
      format_note_parameters(note, volume)
    when 'm'
      note.envelope = 15
      format_note_parameters(note, volume)
    else
      format_note_parameters(note, volume)
    end
  end

  def format_note_parameters(note, volume)
    sample_char = AutosirilConstants::PARAMS[note.sample] || '.'
    envelope_char = AutosirilConstants::PARAMS[note.envelope % 16] || '.'
    ornament_char = AutosirilConstants::PARAMS[note.ornament % 16] || '.'
    volume_char = AutosirilConstants::PARAMS[volume] || '.'
    
    "#{note} #{sample_char}#{envelope_char}#{ornament_char}#{volume_char} ...."
  end

  def split_into_patterns(text_lines)
    pattern_count = (@config.max_row.to_f / @config.pattern_size).ceil
    pattern_hash = {}
    patterns = []
    used_patterns = {}
    play_order = []
    
    pattern_count.times do |pattern_index|
      start_line = @config.skip_lines + pattern_index * @config.pattern_size
      pattern_lines = text_lines[start_line, @config.pattern_size] || []
      pattern_text = pattern_lines.join("\n")
      
      puts "===pattern: #{pattern_index}" if ENV['DEBUG']
      
      if pattern_hash.key?(pattern_text)
        # Duplicate pattern found
        used_patterns[pattern_index] = false
        existing_pattern_index = pattern_hash[pattern_text]
        play_order << existing_pattern_index
        puts "pattern #{pattern_index} is equal to #{existing_pattern_index}" if ENV['DEBUG']
      else
        # New unique pattern
        used_patterns[pattern_index] = true
        pattern_hash[pattern_text] = pattern_index
        play_order << pattern_index
        puts "new pattern: #{pattern_index}" if ENV['DEBUG']
      end
      
      patterns << pattern_text
    end
    
    play_order_string = 'L' + play_order.join(',')
    [patterns, used_patterns, play_order_string]
  end
end

# ============================================================================
# MAIN ORCHESTRATOR
# ============================================================================

class AutosirilConverter
  def initialize(args = ARGV)
    @config = AutosirilConfig.new(args)
  end

  def convert
    puts "Starting MIDI to VortexTracker conversion..." if ENV['DEBUG']
    
    # Load and parse MIDI
    sequence = @config.load_midi_sequence
    
    # Extract virtual notes from MIDI
    midi_processor = MidiProcessor.new(@config)
    virtual_channels = midi_processor.extract_virtual_notes(sequence)
    timeline_channels = midi_processor.create_timeline_grid(virtual_channels)
    
    # Key detection and transposition
    key_processor = KeyProcessor.new(@config)
    detected_key = key_processor.detect_key(timeline_channels)
    timeline_channels = key_processor.apply_diatonic_transpose(timeline_channels, detected_key)
    
    # Polyphonic processing
    poly_processor = PolyphonicProcessor.new(@config)
    flattened_channels = poly_processor.flatten_polyphony(timeline_channels)
    
    # Ornament generation
    ornament_generator = OrnamentGenerator.new(@config)
    vortex_channels = ornament_generator.process_ornaments(flattened_channels)
    
    # Apply delays and echo
    echo_processor = EchoProcessor.new(@config)
    delayed_channels = echo_processor.apply_delays(vortex_channels)
    
    # Mix channels to AY channels
    channel_mixer = ChannelMixer.new(@config)
    mixed_channels = channel_mixer.mix_channels(delayed_channels)
    
    # Generate VortexTracker output
    output_generator = VortexOutputGenerator.new(@config, ornament_generator.ornaments)
    pattern_data = output_generator.generate_patterns(mixed_channels)
    ornament_text = ornament_generator.generate_ornament_text
    
    # Save final module
    args_string = ARGV[1].to_s  # Channel mapping string for metadata
    output_generator.save_module(pattern_data, ornament_text, args_string)
    
    puts "Conversion completed: #{@config.output_file}" if ENV['DEBUG']
    puts "Patterns: #{pattern_data[:used_patterns].values.count(true)}" if ENV['DEBUG']
    puts "Ornaments: #{ornament_generator.ornaments.length}" if ENV['DEBUG']
  end
end

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __FILE__ == $0
  converter = AutosirilConverter.new(ARGV)
  converter.convert
end