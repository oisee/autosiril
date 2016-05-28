var rb = require("./lib/readBinary.js").readBinary;
var infile = process.argv[2] || "./test/simple_midi.mid";
var mid = rb(infile);

//dependencies
var MIDIFile = require('midifile');
var MIDIEvents = require('midievents');

var MIDI2JSON = function (mid) {
    //mid expected to be an UInt8Array


    //parse MIDIFile
    var midiFile = new MIDIFile(mid.buffer);

    // // Time division
    // if(midiFile.header.getTimeDivision() === MIDIFile.Header.TICKS_PER_BEAT) {
    //     console.log(midiFile.header.getTicksPerBeat());
    // } else {
    //     console.log(midiFile.header.getSMPTEFrames());
    //     console.log(midiFile.header.getTicksPerFrame());
    // }

    //tracked note
    var TNote = function (eve) {
        return {
            track: eve.track,
            note: eve.param1,
            time_from_start: eve.playTime,
            channel: eve.channel
        }
    }
    //just note
    var Note = function (tnote) {
        return {
            note: tnote.note,
            time_from_start: tnote.time_from_start,
            off_time_from_start: tnote.off_time_from_start,
            duration: tnote.duration,
            channel: tnote.channel
        }
    }
    //module
    var Mod = function (ppqn, tracks, format) {
        var mod = {
            ppqn: ppqn,
            //format: format,
            seq: Array(tracks)
        };
        for (var i = 0; i < tracks; i++) {
            mod.seq[i] = [];
        }
        return mod;
    }

    // get eventrs from all tracks
    var events = midiFile.getMidiEvents();
    //init state
    var state = {};
    //for (var i = 0; i < 128; i++) {
    //     state[i] = [];
    //}

    var tnotes = [];
    for (var i = 0; i < events.length; i++) {
        var eve = events[i];
        if (eve.type == MIDIEvents.EVENT_MIDI) {
            //console.log(eve.track, eve.index, eve.type, eve.subtype, eve.playTime, eve.param1, eve.param2 );
            if (eve.subtype == MIDIEvents.EVENT_MIDI_NOTE_ON) {
                var note = new TNote(eve);
                if (typeof state[""+note.note+"/"+note.track+"/"+note.channel] == 'undefined'){
                    state[""+note.note+"/"+note.track+"/"+note.channel] = [];
                }
                state[""+note.note+"/"+note.track+"/"+note.channel].push(note);
            } else if (eve.subtype == MIDIEvents.EVENT_MIDI_NOTE_OFF) {
                var offnote = new TNote(eve);
                var note = state[""+offnote.note+"/"+offnote.track+"/"+offnote.channel].shift();
                //note.off = offnote;
                note.off_time_from_start = offnote.time_from_start
                note.duration = note.off_time_from_start - note.time_from_start;
                tnotes.push(note);
            }
        }
    }

    //create module
    var mod = new Mod(
        midiFile.header.getTicksPerBeat(),
        midiFile.header.getTracksCount(),
        midiFile.header.getFormat()
    );

    for (var i = 0; i < tnotes.length; i++) {
        var tnote = tnotes[i];
        var note = new Note(tnote)
        mod.seq[tnote.track].push(note);
    }

    var compareNotes = function (a, b) {  
        return (a.time_from_start - b.time_from_start)==0 ? a.note - b.note : a.time_from_start - b.time_from_start;
    }

    var seq = [];
    for (var i = 0; i < mod.seq.length; i++) {
        var track = mod.seq[i];
        if (track.length != 0) {
            var newtrack = track.sort(compareNotes);
            seq.push(newtrack);
        }
    }
    mod.seq = seq;   

    // console.log("--------------------------");
    // for (var i = 0; i < mod.seq.length; i++) {
    //     var track = mod.seq[i];
    //     for (var f = 0; f < track.length; f++) {
    //         var note = track[f];
    //         console.log(i, note.note, note.time_from_start, note.off.time_from_start, note.duration);
    //     }
    // }
    //var mod_json = JSON.stringify(mod, null, '  ');
    var mod_json = JSON.stringify(mod);
    return mod_json;
}

module.exports = MIDI2JSON;

// console.log("--------------------------");
// for (var i = 0; i < tnotes.length; i++) {
//     var note = tnotes[i];
//     console.log(note.track, note.note, note.time_from_start, note.off.time_from_start, note.duration );
// }

