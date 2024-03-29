require 'midilib'
require_relative "./module_template.rb"

PITCHES = %w(C- C# D- D# E- F- F# G- G# A- A# B-)
PARAMS = %w(. 1 2 3 4 5 6 7 8 9 A B C D E F G H I J K L M N O P Q R S T U V)
i=0
S = PARAMS.inject({}){|result, p| 
	result[p.to_s]=i
	i+=1
	result
}

#  c   c#  d   d#  e   f   f#  g   g#  a   a#  b
ENV_OFFSETS = [
	24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, #-1
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, #0
  24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, #1               
  24, 24, 24, 24, 24, 24, 24, 24, 24, 12, 12, 24, #2
  00, 12, 12, 12, 12, 12, 12, 12, 12, 00, 00, 12, #3
 -12, 00, 00, 00, 00, 00,-12, 00, 00,-12,-12, 00, #4
 -24,-12,-12,-12,-12,-12,-24,-12,-12,-24,-24,-12, #5
 -36,-24,-24,-24,-24,-24,-36,-24,-24,-24,-48,-24, #6 
 -48,-36,-36,-36,-36,-36,-48,-36,-36,-36,-52,-36, #7
 -52,-48,-48,-48,-48,-48,-52,-48,-48,-48,-60,-48, #8
 -60,-52,-52,-52,-52,-52,-60,-52,-52,-52,-72,-52, #9    
 -72,-60,-60,-60,-60,-60,-72,-60,-60,-60,-84,-60, #10
]

ENV_FORMS = [
	10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, #-1
  10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, #0
  10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, #1
  10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 12, 10, #2
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #3
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #4
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #5
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #6
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #7
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #8
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #9
  12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, #10
] 

#intstruments for drum channel
H1 = S['8']
H2 = S['L']

K1 = S['9']
K2 = S['A']
K3 = S['D']
K4 = S['H']
K5 = S['R']

CL = S['B']

S1 = S['C']
S2 = S['K']
S3 = S['V']

P1 = S['E']
P2 = S['F']

TM = S['J']

N1 = S['O']
N2 = S['P']
N3 = S['U']

NOTE2DRUM_SAMPLE=[
	K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, #-1
	K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, #0	
	K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, K2, #1
	
#	K2, K5, S1, CL, S3, K1, TM, K1, H2, K1, K5, K1, #2
	K2, K5, S1, CL, S3, K1, TM, K1, H2, K1, K5, K1, #2
	H2, H2, H2, H2, H2, H2, H2, H2, H2, TM, H2, H2, #3
	H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, #4		

	H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, #5
	H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, #6
	H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, #7
	
	H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, #8
	H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, #9
	H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, H2, #10

]
NOTE2DRUM_NOTE =[
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #-1
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #0
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #1
	
	12*5, 12*5, 12*5, 12*5, 12*6, 12*4, 12*9+11, 12*5, 12*5, 12*5, 12*4, 12*5+3, #2
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*9+11, 12*5, 12*5, #3
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #4

	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #5
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #6
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #7
	
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #8
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #9
	12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, 12*5, #10
]
              # c   d   e f   g   a   b
SCALE_PENALTY= [0,1,0,1,0,0,1,0,1,0,1,0] 
  
#DEFAULT_MIDI_TEST_FILE = './test/envelope0.mid'
#DEFAULT_MIDI_TEST_FILE = './test/am_dpmpmm0.mid'
#DEFAULT_MIDI_TEST_FILE = './test/melancholy_hill.mid'
DEFAULT_MIDI_TEST_FILE = './test/tottoro_example.mid'

class Setup 
  # attr_accessor :note, :start, :len, :volume, :sample
  attr_reader :in_file, :out_file, :sources_mix, :samples, :ornaments, :sources,
  :per_beat, :per_delay, :per_delay2,
  :pattern_size, :skip_lines,
  
  :real_key,
  :sequence,
  :clocks_per_row, :cpr,
  
  :chan_settings,
  :mix_options,

  :orn_repeat,

  :max_offset,

	:cool_envelope,           # true
  :envelope_changes_volume, # @cool_envelope? false : true
    
	:envelope_sample,         # @cool_envelope?2 : 29 #T
	:envelope_dsample         # @@envelope_change_volume?2 : 18 #I
  
  attr_accessor :max_row

  def initialize
    @max_row = 0
    @in_file = ARGV[0]||DEFAULT_MIDI_TEST_FILE
    @out_file =ARGV[1]|| "" << @in_file << de_text << "e.txt"

    #source_vtracks_txt = ARGV[1]||"0,1,2"
    #@sources = source_vtracks_txt.split(",").map { |s| s.to_i }
    
    source_mapping = ARGV[2]||"1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+"
#   source_mapping = ARGV[2]||"1me,3mep,4-2p"
    @sources_mix = source_mapping.split(",").map { |s| s.split("-").map {|x| (x.to_i-1).to_i} }
    #@chan_settings = source_mapping.split(",").map { |s| s.split("-").map {|x| x.delete!('0-9[]+'); x.to_s == "" ? "m" :x.to_s} }.flatten
    @chan_settings = source_mapping.split(",").map { |s| s.split("-").map {|x|
        if x[/\[(.+)\]/] != nil then
          x[/\[(.+)\]/] = ''
        end
          
        x.delete!('0-9[]+')
        x.to_s == "" ? "m" : x.to_s
      }
    }.flatten
    @mix_options = source_mapping.split(",").map { |s| s.split("-").map {|x| x.delete!('0-9a-zA-Z[]'); x.to_s == "" ? "-" : x.to_s} }.flatten
    @sources = @sources_mix.flatten
    
    @samples = source_mapping.split(",").map { |s| s.split("-").map {|x| 
      t = x[/\[(.+)\]/]
      t = nil == t ? nil : t.delete!('[]').to_s.upcase[0..0]
      r = S[t] == nil ? 2 : S[t]
      } 
    }.flatten
    
    puts "chan_settings: #{@chan_settings.inspect}"
    
    @ornaments = source_mapping.split(",").map { |s| s.split("-").map {|x| 
      t = x[/\[(.+)\]/]
      t = nil == t ? nil : t.delete!('[]').to_s.upcase[1..1]
      r = S[t] == nil ? 0 : S[t]
      } 
    }.flatten

    @per_beat   = (ARGV[3]||4).to_i
    @per_delay  = (ARGV[4]||3).to_i
    @per_delay2 = (ARGV[5]||6).to_i

    pattern_size0 = per_beat * 64
    while pattern_size0 > 127 && pattern_size0 % 2 == 0
      pattern_size0 = pattern_size0 / 2
    end
    @pattern_size = (ARGV[6]||pattern_size0).to_i
    @pattern_size = (pattern_size == 0)? pattern_size0 : pattern_size

    @skip_lines = (ARGV[7]||0).to_i

    @orn_repeat = (ARGV[8]||1).to_i

    @max_offset = (ARGV[9]||12).to_i
      
    @real_key = (ARGV[10]||13).to_i
    
    @cool_envelope    = true
    @envelope_changes_volume = false # @cool_envelope ? false : true
    
		@envelope_sample  = @cool_envelope ? 2 : 29 #T
		@envelope_dsample = @envelope_changes_volume ? 18 : 2 #I
		
  end

  def load_sequence
    @sequence = MIDI::Sequence.new()

    # Read the contents of a MIDI file into the sequence.
    File.open(@in_file, 'rb') { | file |
      @sequence.read(file) { |track, num_tracks, index|
        puts "track #{track}, num_tracks #{num_tracks}, index #{index}"
      }
    }

    @clocks_per_row = sequence.ppqn.to_f / per_beat.to_f
    @cpr = @clocks_per_row
  end
end

#Virtual module
class VModule
  attr_accessor :vchannels
  def initialize
    @vchannels = []
  end
end
#Virtual channel
class VChannel
  attr_accessor :cells
  def initialize
    @cells = []
  end
end

#Virtual note
class VNote 
  attr_accessor :note, :volume,
  :start, :off, :len

  def initialize(note, start, off, volume)
    cpr = $set.cpr
    @note   = note
    @start  = (start.to_f / cpr + 0.5).to_i
    @off    = (off.to_f / cpr + 0.5).to_i
    @len    = @off - @start
    @volume = volume
    #   @sample = sample
  end

  def to_s
    pch = note % 12
    oct = (((note / 12) - 1) < 1)?((note / 12)): ((note / 12) - 1)
    return "#{PITCHES[pch]}#{oct} "
  end
end #VNote

#fracted note
class FNote 
  attr_accessor :note, :volume, :type
  attr_reader :pitch, :oct

  def initialize(note, volume, type)
    @note   = note
    @volume = volume
    @type   = type
    
    repitch
    
  end
  
  def repitch
    @pitch = @note % 12
    @oct = (((@note / 12) - 1) < 1)?((@note / 12)): ((@note / 12) - 1)
    @oct = (((@note / 12) - 1) > 8)? 8 : @oct        
  end
  def note=(newval)
  	@note = newval
  	repitch
  end

  def to_s
    if @type == 'r'
      return "R-- "
    else
      return "#{PITCHES[@pitch]}#{@oct} #{@type} "
    end
  end

  include Comparable
  def <=>(another)
    @note <=> another.note
  end
end #FNote

#last note =)
class LNote 
  attr_accessor :note, :enote, :sample, :envelope, :ornament, :volume, :type, :kind
  
  attr_reader :pitch, :oct, :epitch, :eoct,
  :notetxt, :enotetxt

  def initialize(note, sample, envelope, ornament, volume, type, kind)
    @note   = note
    @pnote  = note
    @sample = sample
    @envelope = envelope
    @ornament = ornament
    @volume = volume
    @type   = type
    @kind   = kind
    repitch
    note2enote
    erepitch
	end
	
	def renew
	  repitch
    note2enote
    erepitch
	end
	
	def note2enote
  	if @kind == 'e' then
  		if @volume >= 15 then       #delayed note or not
  	  	@envelope = ENV_FORMS[note]
  	    #note.sample = $set.envelope_changes_volume ? $set.envelope_sample : 0
  	    @sample = $set.envelope_sample
  	  else
  			@envelope = $set.envelope_changes_volume ? ENV_FORMS[note]: 15
  	    #note.sample = $set.envelope_changes_volume ? $set.envelope_dsample : 0
  			@sample = $set.envelope_dsample
  			@pnote  = $set.envelope_changes_volume ? 119 : note
  		end		
  	  @enote = $set.cool_envelope ? @note + ENV_OFFSETS[@note] : @note
  	  #puts "#{@enote}|#{@note}|#{@envelope}|#{@volume}"
    else
    	@enote = -1
    end
	end
	
	def repitch
    @pitch = @note % 12
    @oct = (((@note / 12) - 1) < 1)?((@note / 12)): ((@note / 12) - 1)
    @oct = (((@note / 12) - 1) > 8)? 8 : @oct
	end
	
	def erepitch
    @epitch = @enote % 12
    @eoct = (((@enote / 12) - 1) < 1)?((@enote / 12)): ((@enote / 12) - 1)
    @eoct = (((@enote / 12) - 1) > 8)? 8 : @eoct
	end
	
  def note=(newval)
  	@note = newval
  	repitch
  	note2enote
  	erepitch
  end
  
  def kind=(newval)
  	@kind = newval
  	repitch
  	note2enote
  	erepitch
  end
  
  def volume=(newval)
  	@volume = newval
  	repitch
  	note2enote
  	erepitch
  end
  
  def envelope=(newval)
  	@envelope = newval
  	repitch
  	note2enote
  	erepitch
  end
  def to_s
	  if    @type == 'r'
      return "R--"
    elsif @type == '.'
    	return "---"
    else
      return "#{PITCHES[@pitch]}#{@oct}"
	  end	  	
  end

  include Comparable
  def <=>(another)
    @note <=> another.note
  end
end # LNote

#helper-functions
def note2txt(note)
	text = "#{note.to_s} #{PARAMS[note.sample]}#{PARAMS[note.envelope%16]}#{PARAMS[note.ornament%16]}#{PARAMS[note.volume]} ...."
end

def note_is_real(note)
  return (nil != note && note.type != 'r' && note.type != '.')
end

def note_is_stop(note)
  return (nil != note && note.type == 'r')
end

def note_is_empty(note)
  return (nil == note || note.type == '.')
end

def print_note(note)
  if note_is_empty(note) then
    text = "--- .#{PARAMS[note.envelope%16]}.. ...."
  elsif note_is_stop(note)
    text = "R-- .... ...."
  elsif note_is_real(note)  
  	note = note.clone
    note.volume = (((note.volume < 1) || (note.volume > 15)))? 15: note.volume
    
    if    note.kind == 'p' then
      note.envelope = 15
      #note.sample   = 2
      text = note2txt(note)
    elsif note.kind == 'e'
    	text = note2txt(note)
    elsif note.kind == 'd'
    	note.envelope = 15
    	text = note2txt(note)
    elsif note.kind == 'm'
    	note.envelope = 15
    	#note.sample = 2
			text = note2txt(note)
		else
			text = note2txt(note)				
    end
  end
  return text
end

def enote_is_real(note)
  return (nil != note && note.kind == 'e' && note.type != 'r' && note.type != '.' && (1..14) === note.envelope)
end

def print_enote(note)
  if enote_is_real(note) then
    text =" #{PITCHES[note.epitch]}#{note.eoct}"
  else
    text = "...."
  end
end

def flat_cell_poly(cell)
  event = cell.map {|note| note.type }.uniq.sort.join
  #print "event #{event}"
  ncell = []
  case event
  when 'c'
    ncell = []
  when 'r'
    fnote = cell.min.clone
    fnote.type = "r"
    ncell = [fnote]
  when 's'
    ncell = cell
  when 'cr'
    ncell = cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}
  when 'cs'
    ncell = cell.each {|fnote| fnote.type = 's'}
  when 'rs'
    ncell = cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}
  when 'crs'
    ncell = cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}      
  end
  return ncell 
end

def flat_cell_mono(cell)
  event = cell.map {|note| note.type }.uniq.sort.join
  #print "event #{event} \n"
  ncell = []
  case event
  when 'c'
    ncell = []
  when 'r'
    fnote = cell.min.clone
    fnote.type = "r"
    ncell = [fnote]
  when 's'
    ncell = [] << cell.max
  when 'cr'
    ncell = [] << (cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}).max
  when 'cs'
    ncell = [] << (cell.each {|fnote| fnote.type = 's'}).max
  when 'rs'
    ncell = [] << (cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}).max
  when 'crs'
    ncell = [] << (cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}).max
  end
  return ncell
end

def flat_cell_drum(cell)
  event = cell.map {|note| note.type }.uniq.sort.join
  #puts "event: #{event}"
  ncell = []
  case event
  when 'c'
    ncell = []
  when 'r'
    fnote = cell.min.clone
    fnote.type = "r"
    ncell = [fnote]
  when 's'
    ncell = [] << cell.min
  when 'cr'
    ncell = [] << (cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}).min
  when 'cs'
    ncell = [] << (cell.each {|fnote| fnote.type = 's'}).min
  when 'rs'
    ncell = [] << (cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}).min
  when 'crs'
    ncell = [] << (cell.delete_if {|fnote| fnote.type == 'r'}.each {|fnote| fnote.type = 's'}).min
  end
  return ncell
end

def squize_ornament(base_note, orn)
  sorted = orn.sort
  mid = orn.size/2
  mediana = sorted[mid]

  orn.delete_if {|offset| (offset-mediana).abs > $set.max_offset}

  min_offset = orn.min
  new_base_note = base_note + min_offset
  new_orn = orn.map{|x| x - min_offset}

  orn_txt = "L"
  new_orn.each {|x|
    $set.orn_repeat.times {
      orn_txt <<	x.to_s << ","
    }
  }
  orn_txt[-1] =""
  return new_base_note, orn_txt
end

def note2drum(note)
	note.sample = NOTE2DRUM_SAMPLE[note.note]
	note.note   = NOTE2DRUM_NOTE[note.note]
	return note
end

def detect_key(rmod, chan_settings, real_key)
  puts "--- detecting base note (for major)---"
                # twice for up-sliding
  penalties = [0,0,0,0,0,0, 0,0,0,0,0,0]
  statistic = [0,0,0,0,0,0, 0,0,0,0,0,0]

  key_notes = []
  rmod.each_with_index{|vchan,vchan_i|
    puts "vchan:#{vchan_i}"
    puts "#{chan_settings[vchan_i]}"
    vchan.each_with_index {|vcell, vcell_i|
      if    (nil != chan_settings[vchan_i]['s'] ) then
        vcell.each {|vnote|
          if (nil !=vnote && vnote.type == 's') then
            key_notes << vnote.note
          end
        }
      end
    }
  }
  #puts "key notes: ---{"
  #puts "#{scale_notes}"
  #puts "key notes: ---}"
  #----------------------
  # get statistic
  key_notes.each {|pitch|
    statistic[pitch % 12] += 1
  }
  puts "statistic: ---{"
  statistic.each {|count|
    print "#{count} "
    }
  puts "\nstatistic: ---}"
  #----------
  12.times {|key_i|
    statistic.each_with_index {|count,pitch|
      penalties [key_i] += count*SCALE_PENALTY[(pitch-key_i)%12]
    }
  }

  # show penalties
  puts "penalties: ---{"
  penalties.each {|count|
    print "#{count} "
    }
  puts "\penalties: ---}"

  if (real_key > 12) then
    good_key = penalties.index(penalties.min)  
  else
    good_key = real_key % 12
  end
  puts "good_key:#{good_key}"
  return good_key
end
def create_ornaments(orn_repeat)
  ornaments = {}
  #ornaments ["L0"] = 1
  #make "zero" ornament
  orn = "L"
  orn_repeat.times {
    orn <<	0.to_s << ","
  }
  orn[-1] =""
  ornaments[orn] = 0
  return ornaments
end

#-----------------------------------------------------------
# main process
def seq2vmod(seq, set)
  vmod = []
    seq.each {|track|
    puts "   track:#{track}"
    vchan = []
    track.each{ |eve|
      if ((defined? eve.note) && (defined? eve.off)) then
        #      puts eve.note.to_i
        vnote = VNote.new(eve.note, eve.time_from_start, eve.off.time_from_start, 15)  
        vchan << vnote
        #setting maximum row
        set.max_row = [set.max_row , vnote.off, vnote.off+set.per_delay, vnote.off+set.per_delay2].max
      end
    }
    if ([] != vchan ) then
      #	  channels << notes
      vmod << vchan
      #puts "#{vchan.inspect}"
    end
  }
  return vmod
end

def vmod2rmod(vmod, sources)
  rmod = []
  sources.each {|vchan_index|
    puts "vchan:#{vchan_index}"

    #fill all "real channel with []"
    #rchan = Array.new($set.max_row+1){[]}
    rchan = Array.new($set.max_row){[]
    vmod[vchan_index].each {|vnote|
      rchan[vnote.start] << FNote.new(vnote.note, vnote.volume, "s")
      rchan[vnote.off] << FNote.new(vnote.note, vnote.volume, "r")
      #puts "(vnote.start+1...vnote.off)#{(vnote.start+1...vnote.off).inspect}"
      (vnote.start+1...vnote.off).each{|i|
        rchan[i] << FNote.new(vnote.note, vnote.volume, "c")
      }
    }
    rmod << rchan
  }
  return rmod
end

#flatting polynotes
def rmod2pmod(rmod, chan_settings)
  pmod = []
  rmod.each_with_index{|rchan,rchan_i|
    puts "rchan:#{rchan_i}"
    pchan = []
    rchan.each_with_index {|rcell, rcell_i|
      if    (nil != chan_settings[rchan_i]['p'] ) then
        pcell = flat_cell_poly(rcell)
      elsif (nil != chan_settings[rchan_i]['m'] ) then
        pcell = flat_cell_mono(rcell)
      elsif (nil != chan_settings[rchan_i]['d'] ) then
        pcell = flat_cell_drum(rcell)   	
      end
      pchan << pcell
      #puts "#{pcell.sort}"
    }
    pmod << pchan
  }
  return pmod
end

def pmod2lmod(pmod, chan_settings, samples, ornaments, orns)
  
  ornament_counter = 1
  lmod = []
  pmod.each_with_index{|pchan,pchan_i|
    puts "pchan:#{pchan_i}"
    lchan = []
    # puts "#{pchan.inspect}"
    pchan.each_with_index {|pcell, pcell_i|
      #puts "#{pcell.sort}"
      if [] != pcell then
        min_note  = pcell.min
        base_note = pcell.min.note
        proto_orn = pcell.uniq.sort.map{|fnote| fnote.note - base_note}.uniq

        base_note, orn = squize_ornament(base_note, proto_orn)
  #     puts "orn: #{orn}"

        #add ornament to hash
        if (nil == orns[orn]) then
          #puts "new ornament #{ornament_counter}: #{orn} "
          orns[orn] = ornament_counter
          ornament_counter = ornament_counter + 1
        else
          #puts "ornament #{orn} is equal to #{orns[orn]}"
        end

        #      lnote = LNote.new(base_note,0,0,orns[orn],15,min_note.type)      
        if    (nil != chan_settings[pchan_i]['p'] ) then
          base_note = ((base_note >= (12 * 6 )) && orns[orn] != 0)?base_note-12 : base_note
          base_note = ((base_note <= (12 * 4 )) && orns[orn] != 0)?base_note+12 : base_note
          #lnote = LNote.new(base_note,0,0,orns[orn],15,min_note.type, 'p')
          lnote = LNote.new(base_note,samples[pchan_i],0,orns[orn],15,min_note.type, 'p')
          #puts "lnote: #{lnote.inspect}"
        elsif (nil != chan_settings[pchan_i]['m'] ) then
          lnote = LNote.new(base_note,samples[pchan_i],0,ornaments[pchan_i],15,min_note.type, 'm')
        elsif (nil != chan_settings[pchan_i]['d'] ) then
          lnote = note2drum(LNote.new(base_note,0,0,0,15,min_note.type, 'd'))
        end

        if    (nil != chan_settings[pchan_i]['e'] ) then
          lnote.kind = 'e'
        end

      else
        lnote = nil
      end
      lchan << lnote
    }
    lmod << lchan
  }
  return lmod
end

def apply_delays(lmod, chan_settings, per_delay, per_delay2)
  dmod = [] #delayed lmod
  lmod.each_with_index{|lchan,lchan_i|
    puts "lchan:#{lchan_i}"
    dchan = lchan.clone
    lchan.each_with_index {|lnote, lnote_i|
      if (nil != lnote) && (nil == chan_settings[lchan_i]['u']) && (nil == chan_settings[lchan_i]['w']) then
        dnote = lnote.clone
        dnote.volume = dnote.volume * 0.7

        dnote2 = dnote.clone
        dnote2.volume = dnote.volume * 0.7
        #  end
        #puts "lnote: #{lnote.inspect}"
        if (nil == dchan[lnote_i+per_delay2] ||
          'r' == dchan[lnote_i+per_delay2].type) then
          dchan[lnote_i+per_delay2] = dnote2
        end
        if (nil == dchan[lnote_i+per_delay] ||
          'r' == dchan[lnote_i+per_delay].type) then
  #      if (nil == dchan[lnote_i+per_delay]) then
          dchan[lnote_i+per_delay] = dnote
        end
      elsif (nil != lnote) && (nil == chan_settings[lchan_i]['u']) && (nil != chan_settings[lchan_i]['w']) then
              dnote = lnote.clone
              dnote.volume = dnote.volume * 0.7

              dnote2 = dnote.clone
              dnote2.volume = dnote.volume * 0.7
              #  end
              #puts "lnote: #{lnote.inspect}"
              if (nil == dchan[lnote_i+per_delay2*2] ||
                'r' == dchan[lnote_i+per_delay2*2].type) then
                dchan[lnote_i+per_delay2*2] = dnote2
              end
              if (nil == dchan[lnote_i+per_delay*2] ||
                'r' == dchan[lnote_i+per_delay*2].type) then
        #      if (nil == dchan[lnote_i+per_delay]) then
                dchan[lnote_i+per_delay*2] = dnote
              end      
      end
    }
    dmod << dchan
  }
  return dmod
end

def downmix(lmod, sources_mix, mix_options)
  mmod = [] #downmixed lmod
  abs_index = 0
  sources_mix.each_with_index {|s, s_i|
    puts "#{abs_index}"
    mchan = []
    s.each_with_index{|lc,lc_i|
      lchan = lmod[abs_index]
      lchan_i = abs_index
      puts "mixing lchan:#{lchan_i} into #{s_i}"
      
        lchan.each_with_index {|lnote, lnote_i|
          if mix_options[lchan_i] == '-'  then
            if nil != lnote then
              mnote = lnote.clone  
              if     (nil == mchan[lnote_i] || 'r' == mchan[lnote_i].type || mchan[lnote_i].volume < lnote.volume) then
                mchan[lnote_i] = mnote
              elsif  (nil == mchan[lnote_i+1] || 'r' == mchan[lnote_i+1].type || mchan[lnote_i].volume < lnote.volume)
                mchan[lnote_i+1] = mnote		      
              elsif  (nil == mchan[lnote_i+2] || 'r' == mchan[lnote_i+2].type || mchan[lnote_i].volume < lnote.volume)
                mchan[lnote_i+2] = mnote		      
              elsif  (nil == mchan[lnote_i+3] || 'r' == mchan[lnote_i+3].type || mchan[lnote_i].volume < lnote.volume)
                mchan[lnote_i+3] = mnote		      
              end

            end
          elsif mix_options[lchan_i] == '+'
            if nil != lnote then
              mnote = lnote.clone
              if     (nil == mchan[lnote_i] || 'r' == mchan[lnote_i].type || mchan[lnote_i].volume < lnote.volume) then
                mchan[lnote_i] = mnote
              end
            end
          end
        }
      abs_index += 1
    }
    mmod[s_i] = mchan
  }
  return mmod
end

def render_into_text(lmod, max_row)
  text_lines = []

  empty_note = LNote.new(-1, 0, 0, 0, 0, '.' , '' )

  pforms = [15,15,15] #previous envelope forms
  penote = empty_note #previous envelope note
  max_row.times {|row_i|

    cnotes = []
    (0..2).each {|i|
      cnotes  << lmod[i][row_i]
    }

    #replace nils to empty notes
    cnotes = cnotes.map{|x|
      #x = x != nil ? x : empty_note.clone
      x = nil != x ? x : empty_note.clone
    }
  #  cnotes[0] = cnotes[0] != nil ? cnotes[0] : empty_note
  #  cnotes[1] = cnotes[1] != nil ? cnotes[1] : empty_note
  #  cnotes[2] = cnotes[2] != nil ? cnotes[2] : empty_note

  #set current envelope note to empty
    cenote = empty_note.clone
    cforms = pforms.clone
    
    cnotes.each_with_index {|x,cn_i|
      if enote_is_real(x) then
        cenote = x > cenote ? x : cenote
      end    
      if note_is_real(x) then
        cforms[cn_i] = x.envelope
      end
    }
    
    (0..2).each {|i|
      if    enote_is_real(cnotes[i]) && enote_is_real(cenote) && cnotes[i].epitch != cenote.epitch then
      # одновременно две разные огибающие, выигрывает та, что выше
        cnotes[i].kind = 'm'
      elsif enote_is_real(cnotes[i]) && enote_is_real(cenote) && cnotes[i].epitch == cenote.epitch
      # одновременно две огибающие, с одинаковой нотой, но в разных октавах - подтягиваем низшую ноту      
        if (cenote.oct - cnotes[i].oct) >= 1 then
          cnotes[i].note = cnotes[i].note + 12
        end
      end
      if enote_is_real(cenote) && cenote.volume == 15 then
        if note_is_empty(cnotes[i]) && (1..14) === pforms[i] && penote.epitch != cenote.epitch then
  #       puts "pforms[#{i}]:#{pforms[i]}"
          cnotes[i].envelope = 15
  #       puts "empty & env conflict?"
        end
      end
    }
      
    #..16|..|C-4 DF.F ....|C-4 DF.F ....|C-4 DF.F ....
    
    noteA = print_note(cnotes[0])
    noteB = print_note(cnotes[1])  
    noteC = print_note(cnotes[2])

    env = print_enote(cenote)
    
    text_line = "#{env}|..|#{noteA}|#{noteB}|#{noteC}"
    text_lines << text_line

    #{previous values
    if enote_is_real(cenote) then
      penote = cenote
    end
    pforms = cforms
    #}previous values
  }
  return text_lines
end
def split_into_patterns(text_lines, max_row, pattern_size, skip_lines)
  max_patterns = (max_row % pattern_size) == 0? (max_row / pattern_size):(max_row / pattern_size) + 1

  hashed_patterns = {}
  patterns = []
  used_patterns = {}

  play_order =[]

  max_patterns.times {|i|
    pattern_text = ""
    txt = text_lines.slice(skip_lines+i*pattern_size,pattern_size)
    if nil != txt then
      txt.each {|text_line|
        #txt_file.puts text_line
        pattern_text << text_line << "\n"
      }
    end
    #pattern_text is full pattern text

    puts "===pattern: #{i}"

    if (nil == hashed_patterns[pattern_text]) then
      used_patterns[i] = true

      puts "new pattern: #{i}"
      hashed_patterns[pattern_text] = i
      patterns << pattern_text
      play_order << i
    else
      used_patterns[i] = false

      puts "pattern #{i} is equal to #{hashed_patterns[pattern_text]}"
      patterns << pattern_text

      play_order << hashed_patterns[pattern_text]
    end
  }
  play_order_txt = play_order2txt(play_order)  
  return patterns, used_patterns, play_order_txt
end
def play_order2txt (play_order)
    play_order_txt = "L"
    play_order.each {|pattern_num|
      play_order_txt << pattern_num.to_s << ","
    }
    play_order_txt[-1] = ''
    return play_order_txt
end

def ornaments2txt(orns)
  orns_txt = ""
  puts "orns.inspect: #{orns.inspect}"
  orns = orns.invert
  puts "orns.inspect: #{orns.inspect}"
  #orns.each_pair {|k,v|
  orns.sort.map {|v,k|
    if v != 0 then
      orns_txt << "\n[Ornament#{v}]\n"
      orns_txt << k.to_s << "\n"
    end
  }
  return orns_txt
end

def save_file( out_file, patterns, used_patterns, play_order_txt, orns_txt, arguments ) 
  txt_file = File.open(out_file,"w")
  txt_file.puts( module_header(arguments, play_order_txt, orns_txt) )

  patterns.each_with_index {|pattern_text,i|
    if (used_patterns[i] && "" != pattern_text )
      txt_file.puts "\n[Pattern#{i}]"
      txt_file.puts pattern_text
    end
  }
end

#------------------------------------------------------------------------------------------------------------
#start!

$set = Setup.new    #parse all arguments
$set.load_sequence  #load midi

#transform midi-sequence into vmod
vmod = seq2vmod($set.sequence, $set) #puts "max_row:#{$set.max_row}"

#transform vmod into rmod (module filled with empty and not empty notes)
rmod = vmod2rmod(vmod, $set.sources)
pmod = rmod2pmod(rmod, $set.chan_settings) #flatting polynotes

#detect_key(rmod, $set.chan_settings, $set.real_key)

orns = create_ornaments($set.orn_repeat)                                        #making ornaments
lmod = pmod2lmod(pmod, $set.chan_settings, $set.samples, $set.ornaments, orns)  #
lmod = apply_delays(lmod, $set.chan_settings, $set.per_delay, $set.per_delay2)  #apply delays
lmod = downmix(lmod, $set.sources_mix, $set.mix_options )                       #downmix channels

#render
text_lines = render_into_text(lmod, $set.max_row)                               #render lmod into plain text
patterns, used_patterns, play_order_txt = split_into_patterns(text_lines, $set.max_row, $set.pattern_size, $set.skip_lines) #split into unique patterns
orns_txt = ornaments2txt(orns)

#save file:
save_file( $set.out_file, patterns, used_patterns, play_order_txt, orns_txt, ARGV[2].to_s)