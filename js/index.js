var rb = require("./lib/readBinary.js").readBinary;
//var wb = require("../lib/writeBinary.js").writeBinary;
var MIDIFile = require('midifile');
var MIDIEvents = require('midievents');

var infile = process.argv[2]||"./test/simple_midi.mid";
var mid = rb(infile);
var midiFile = new MIDIFile(mid.buffer);

var TNote = function(eve) {
    return {
        track: eve.track, 
        note: eve.param1,
        time_from_start: eve.playTime
    }
}

// Reading headers

midiFile.header.getFormat(); // 0, 1 or 2
var tracks = midiFile.header.getTracksCount(); // n
console.log("tracks:", tracks);
// Time division
if(midiFile.header.getTimeDivision() === MIDIFile.Header.TICKS_PER_BEAT) {
    console.log(midiFile.header.getTicksPerBeat());
} else {
    console.log(midiFile.header.getSMPTEFrames());
    console.log(midiFile.header.getTicksPerFrame());
}

var events = midiFile.getMidiEvents();
//init state
var state = {};
for (var i = 0; i < 128; i++) {
    state[i]=[];
}
var tnotes = [];
for (var i = 0; i < events.length; i++) {
    var eve = events[i];
    if(eve.type == MIDIEvents.EVENT_MIDI) { 
        //console.log(eve.track, eve.index, eve.type, eve.subtype, eve.playTime, eve.param1, eve.param2 );
        if(eve.subtype == MIDIEvents.EVENT_MIDI_NOTE_ON){
            var note = new TNote(eve);
            state[note.note].push(note);
        }else if (eve.subtype == MIDIEvents.EVENT_MIDI_NOTE_OFF){
            var offnote = new TNote(eve);
            var note = state[offnote.note].shift();
            note.off = offnote;
            note.duration = note.off.time_from_start - note.time_from_start;
            tnotes.push(note);
        }
    }
}

console.log("--------------------------");
for (var i = 0; i < tnotes.length; i++) {
    var note = tnotes[i];
    console.log(note.track, note.note, note.time_from_start, note.off.time_from_start, note.duration );
}