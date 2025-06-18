#!/usr/bin/env ruby

require 'midilib/sequence'
require 'midilib/consts'
include MIDI

seq = Sequence.new()
File.open(ARGV[0], 'rb') { |file|
  seq.read(file) { |track, num_tracks, index|
    puts "Reading track #{index} of #{num_tracks}"
  }
}

puts "\nTrack summary:"
seq.tracks.each_with_index do |track, idx|
  note_count = 0
  channels = Hash.new(0)
  
  track.each do |event|
    if event.is_a?(NoteOn) && event.velocity > 0
      note_count += 1
      channels[event.channel] += 1
    end
  end
  
  puts "Track #{idx}: #{track.events.length} events, #{note_count} notes"
  channels.each do |ch, count|
    puts "  Channel #{ch}: #{count} notes"
  end
end

# Show what Ruby does with channel mapping
mapping = ARGV[1]||"5du-4du+-3du+,1p,2m"
sources_mix = mapping.split(",").map { |s| s.split("-").map {|x| (x.to_i-1).to_i} }
sources = sources_mix.flatten

puts "\nChannel mapping '#{mapping}':"
puts "sources_mix: #{sources_mix.inspect}"
puts "sources (flattened): #{sources.inspect}"