require 'json'
require 'zlib'
require_relative './sample_data'

# BitphaseOutputGenerator — converts per-virtual-channel LNote data
# into Bitphase .btp format (gzipped JSON).
#
# Called after apply_delays, before downmix — each virtual channel
# retains its full LNote data (note, sample, envelope, ornament, volume, type, kind).

class BitphaseOutputGenerator
  # PT3 Tone Table #4 (Natural) — matches NoteTable=4 in VT header
  TUNING_TABLE = [
    2880, 2700, 2560, 2400, 2304, 2160, 2025, 1920, 1800, 1728, 1620, 1536,
    1440, 1350, 1280, 1200, 1152, 1080, 1013,  960,  900,  864,  810,  768,
     720,  675,  640,  600,  576,  540,  506,  480,  450,  432,  405,  384,
     360,  338,  320,  300,  288,  270,  253,  240,  225,  216,  203,  192,
     180,  169,  160,  150,  144,  135,  127,  120,  113,  108,  101,   96,
      90,   84,   80,   75,   72,   68,   63,   60,   56,   54,   51,   48,
      45,   42,   40,   38,   36,   34,   32,   30,   28,   27,   25,   24,
      23,   21,   20,   19,   18,   17,   16,   15,   14,   14,   13,   12
  ]

  # NoteName enum values (matching Bitphase song.ts)
  NOTE_NONE = 0
  NOTE_OFF  = 1
  NOTE_C    = 2  # C=2, C#=3, D=4, ..., B=13

  def initialize(lmod, ornaments_hash, setup)
    @lmod = lmod              # Array of virtual channels, each an array of LNote|nil
    @ornaments = ornaments_hash # {"L0,0"=>0, "L0,0,4,4,7,7"=>1, ...}
    @set = setup
  end

  def write(filename)
    project = build_project
    Zlib::GzipWriter.open(filename) { |gz| gz.write(JSON.generate(project)) }
    puts "BTP written: #{filename}"
  end

  private

  def build_project
    {
      name: ARGV[1].to_s,
      author: "oisee/siril^4d #{Time.new.strftime('%Y.%m.%d')} (converted by autooisee)",
      songs: [build_song],
      loopPointId: 0,
      patternOrder: nil,  # filled below
      tables: build_tables,
      patternOrderColors: {},
      instruments: build_instruments
    }.tap do |proj|
      song = proj[:songs][0]
      # Pattern order: split lmod rows into pattern_size chunks, deduplicate
      play_order, patterns = build_patterns_and_order(song)
      proj[:patternOrder] = play_order
      song[:patterns] = patterns
    end
  end

  def build_song
    vchan_map = build_virtual_channel_map
    {
      patterns: [],  # filled by build_patterns_and_order
      tuningTable: TUNING_TABLE,
      initialSpeed: 4,
      chipType: 'ay',
      chipVariant: 'AY',
      chipFrequency: 1750000,
      interruptFrequency: 50,
      tuningTableIndex: 4,
      a4TuningHz: 440,
      virtualChannelMap: vchan_map,
      stereoLayout: 'ABC'
    }
  end

  # Build virtualChannelMap from sources_mix
  # sources_mix = [[0,1,2],[3,4],[5,6,7,8]] → {0=>3, 1=>2, 2=>4}
  def build_virtual_channel_map
    map = {}
    @set.sources_mix.each_with_index do |group, hw_i|
      map[hw_i] = group.size
    end
    map
  end

  # Compute effective channel labels: A1,A2,A3,B1,B2,C1,C2,C3,C4
  def effective_channel_labels
    hw_labels = ['A', 'B', 'C']
    labels = []
    @set.sources_mix.each_with_index do |group, hw_i|
      if group.size <= 1
        labels << hw_labels[hw_i]
      else
        group.size.times { |v| labels << "#{hw_labels[hw_i]}#{v + 1}" }
      end
    end
    labels
  end

  def total_vchan_count
    @set.sources_mix.sum { |g| g.size }
  end

  # Convert ornaments hash to Bitphase Table array
  # Also creates empty tables for any indices referenced by notes but not in the ornaments hash
  def build_tables
    inverted = @ornaments.invert  # {0=>"L0,0", 1=>"L0,0,4,4,7,7", ...}

    # Find max table index referenced by any note
    max_table = inverted.keys.max || 0
    @lmod.each do |lchan|
      lchan.each do |lnote|
        next if lnote.nil?
        next if lnote.type == '.' || lnote.type == 'r'
        next if lnote.kind == 'd'  # drums use table 0
        orn_val = lnote.ornament % 16
        max_table = orn_val if orn_val > max_table
      end
    end

    # Build tables 0..max_table, filling gaps with empty [0,0]
    (0..max_table).map do |id|
      if inverted[id]
        rows = parse_ornament_string(inverted[id])
      else
        rows = [0, 0]
      end
      {
        id: id,
        rows: rows,
        loop: 0,
        name: id == 0 ? 'Empty' : "Table #{(id + 1).to_s(36).upcase}"
      }
    end
  end

  # "L0,0,4,4,7,7" → [0,0,4,4,7,7]
  def parse_ornament_string(str)
    str.sub(/^L/, '').split(',').map(&:to_i)
  end

  # Build instruments from sample_data.rb constants
  def build_instruments
    BITPHASE_INSTRUMENTS.map do |inst|
      {
        id: inst[:id],
        name: inst[:name],
        rows: inst[:rows],
        loop: inst[:loop]
      }
    end
  end

  # Convert LNote to Bitphase Row hash
  def lnote_to_row(lnote)
    if lnote.nil? || lnote.type == '.'
      # Empty row — envelopeShape=0 means "no envelope" in Bitphase
      {
        note: { name: NOTE_NONE, octave: 0 },
        effects: [nil],
        instrument: 0,
        envelopeShape: 0,
        table: 0,
        volume: 0
      }
    elsif lnote.type == 'r'
      # Release/note off
      {
        note: { name: NOTE_OFF, octave: 0 },
        effects: [nil],
        instrument: 0,
        envelopeShape: 0,
        table: 0,
        volume: 0
      }
    else
      # Real note
      lnote_clone = lnote.clone
      lnote_clone.volume = 15 if lnote_clone.volume < 1 || lnote_clone.volume > 15

      # Bitphase: envelopeShape=0 means "no envelope"
      # Only envelope notes (kind='e') should have a non-zero envelopeShape
      case lnote_clone.kind
      when 'e'
        env_shape = lnote_clone.envelope % 16
        env_shape = 10 if env_shape == 0  # default envelope shape if unset
      else
        env_shape = 0  # no hardware envelope for p/m/d notes
      end

      # Drums don't use ornaments — force table to 0
      table_val = lnote_clone.kind == 'd' ? 0 : (lnote_clone.ornament % 16)

      note_val = lnote_clone.note
      note_name = (note_val % 12) + 2  # C=2, C#=3, ..., B=13
      octave = ((note_val / 12) - 1)
      octave = (note_val / 12) if octave < 1
      octave = 8 if octave > 8

      vol = lnote_clone.volume.to_i
      vol = 15 if vol > 15
      vol = 0  if vol < 0

      {
        note: { name: note_name, octave: octave },
        effects: [nil],
        instrument: lnote_clone.sample,
        envelopeShape: env_shape,
        table: table_val,
        volume: vol
      }
    end
  end

  # Compute envelope value for a row across all virtual channels
  # Same logic as render_into_text: highest envelope note across all channels
  def compute_envelope_value(row_i)
    best_enote = nil
    @lmod.each do |lchan|
      lnote = lchan[row_i]
      next if lnote.nil?
      if enote_is_real(lnote)
        if best_enote.nil? || lnote > best_enote
          best_enote = lnote
        end
      end
    end
    if best_enote && enote_is_real(best_enote)
      # Convert envelope note to period using tuning table
      enote_val = best_enote.enote
      if enote_val >= 0 && enote_val < 96
        TUNING_TABLE[enote_val]
      else
        0
      end
    else
      0
    end
  end

  # Build patterns and play order from lmod virtual channels
  # Returns [play_order_array, patterns_array]
  def build_patterns_and_order(song)
    labels = effective_channel_labels
    n_vchans = total_vchan_count
    max_row = @set.max_row
    pat_size = @set.pattern_size
    skip = @set.skip_lines

    # Number of patterns
    n_patterns = (max_row % pat_size) == 0 ? (max_row / pat_size + 1) : (max_row / pat_size)

    # Build all pattern data
    all_patterns = []
    hashed = {}
    play_order = []
    use_pattern = {}

    n_patterns.times do |pat_i|
      start_row = skip + pat_i * pat_size
      pat_length = [pat_size, max_row - start_row].min
      pat_length = pat_size if pat_length <= 0

      # Build channels for this pattern
      channels = []
      n_vchans.times do |vc_i|
        rows = []
        pat_size.times do |r|
          abs_row = start_row + r
          lnote = (abs_row < @lmod[vc_i].size) ? @lmod[vc_i][abs_row] : nil
          rows << lnote_to_row(lnote)
        end
        channels << { label: labels[vc_i], rows: rows }
      end

      # Build patternRows (global envelope + noise)
      pattern_rows = []
      pat_size.times do |r|
        abs_row = start_row + r
        env_val = (abs_row < max_row) ? compute_envelope_value(abs_row) : 0
        pattern_rows << { envelopeValue: env_val, noiseValue: -1 }
      end

      # Create pattern hash for deduplication
      pat_key = channels.map { |ch| ch[:rows].map(&:inspect).join }.join('|')

      if hashed[pat_key].nil?
        use_pattern[pat_i] = true
        hashed[pat_key] = pat_i
        play_order << pat_i
      else
        use_pattern[pat_i] = false
        play_order << hashed[pat_key]
      end

      all_patterns << {
        id: pat_i,
        length: pat_size,
        channels: channels,
        patternRows: pattern_rows
      }
    end

    # Only include used patterns in the song
    used_patterns = all_patterns.select.with_index { |_, i| use_pattern[i] }

    [play_order, used_patterns]
  end
end
