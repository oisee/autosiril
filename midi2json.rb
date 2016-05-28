
require 'midilib'
require 'json'

def load_sequence(infile)
  sequence = MIDI::Sequence.new()

  # Read the contents of a MIDI file into the sequence.
  File.open(infile, 'rb') { | file |
    sequence.read(file) { |track, num_tracks, index|
      puts "track #{track}, num_tracks #{num_tracks}, index #{index}"
    }
  }
  return sequence
  #@clocks_per_row = sequence.ppqn.to_f / per_beat.to_f
  #@cpr = @clocks_per_row
end
  
def load_sequence_json
  sequence = {}
  # Read the contents of a JSON file into the sequence.
  seq_json = File.read(@in_file)
  seq = JSON.parse(seq_json)
  @sequence = seq 
  ppqn = sequence["ppqn"]
  puts "PPQN=#{ppqn}\n"
  @clocks_per_row = ppqn.to_f / per_beat.to_f
  @cpr = @clocks_per_row
end

def save_file( outfile , txt ) 
  txt_file = File.open(outfile,"w")
  txt_file.print( txt )
end

def seq2vmod(seq, set)
  vmod = []
  seq.each {|track|
    #puts "   track:#{track}"
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

def convert_sequence2mod(seq)
  mod = {}
  mod["ppqn"] = seq.ppqn
  mod["seq"] = []
  seq.each {|track|
    newtrack = []
    track.each{ |eve|
      if ((defined? eve.note) && (defined? eve.off)) then
        note = {
          "note" => eve.note,
          "time_from_start" => eve.time_from_start,
          "off_time_from_start" => eve.off.time_from_start,
          "duration" => eve.off.time_from_start - eve.time_from_start,
          "channel"  => eve.channel
        } 
        newtrack << note
      end
    }
    if ([] != newtrack ) then
      newtrack = newtrack.sort_by{|k| [k["time_from_start"], k["note"] ] }
      mod["seq"] << newtrack
    end
  }
  return mod
end

#------------------------------------------------------------------------------------------------------------
#start!
infile = ARGV[0] ||"./js/test/simple_midi.mid"
outfile = ARGV[1] || infile + ".rb.json" 


puts infile
puts outfile

seq = load_sequence(infile)
mod = convert_sequence2mod(seq)
mod_json = JSON.generate(mod)

#save file:
save_file( outfile, mod_json)