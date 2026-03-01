# Multi-Virtual-Channel Bitphase Output

**Date**: 2026-03-01
**Author**: oisee
**Status**: Implemented (Phase 1)
**Branch**: `feature/multi-vchan-output`

## Motivation

Autosiril converts MIDI to VortexTracker II format — locked to 3 hardware AY channels. This is a fundamental limitation:

1. **Channel stacking is lossy.** When 6+ MIDI channels are mixed down to 3 AY channels, musical information is permanently lost. You can't undo mixing decisions or try different mappings without re-running the entire pipeline.

2. **Virtual channels exist now.** Bitphase (the target tracker) supports unlimited virtual channels with alpha-mask priority via `virtualChannelMap`. There's no reason to collapse to 3 channels at the autosiril stage — the tracker itself handles downmix.

3. **Echo as separate channels.** In the VT path, echo/delay is mixed into the same channel. With virtual channels, echo copies become their own channels — separately editable, separately mixable.

## What Was Implemented

### Phase 1: Native Bitphase `.btp` Output (Complete)

Instead of an intermediate JSON format, we output Bitphase's native `.btp` format directly (gzipped JSON). This is immediately loadable in Bitphase — no import step needed.

#### New Files

| File | Purpose |
|------|---------|
| `autooisee.rb` | Fresh refactoring from monolithic `autosiril.rb` — preserves exact algorithmic behavior while making virtual channel data accessible for BTP output |
| `bitphase_output.rb` | `BitphaseOutputGenerator` class — converts per-virtual-channel LNote data into Bitphase `.btp` format |
| `sample_data.rb` | All 31 VT2 instrument/sample definitions as Ruby constants, verified identical to `module_template.rb` |

#### Pipeline Architecture

```
MIDI --> seq2vmod --> vmod2rmod --> detect_key --> rmod2pmod --> pmod2lmod
                                                                    |
                                                        ============|============
                                                        |                       |
                                                   [BTP PATH]             [VT PATH]
                                                   build_btp_lmod         apply_delays
                                                   _with_delays           (mixed into channel)
                                                        |                       |
                                                   BitphaseOutput          downmix (3 ch)
                                                   Generator               --> render
                                                        |                       |
                                                     .btp file             .mide.txt file
```

**Key design decision**: The pipeline branches BEFORE `apply_delays`. For the BTP path, original and echo are kept as separate interleaved virtual channels `[orig, echo, orig, echo, ...]`. For the VT path, delays are mixed into channels as before, then downmixed to 3.

#### Usage

```bash
# VT output only (default, backward compatible)
ruby autooisee.rb input.mid "1d-2me,3p,4m" 8 6 12 0 64 2 6

# BTP output only
ruby autooisee.rb input.mid "1d-2me,3p,4m" 8 6 12 0 64 2 6 --format btp

# Both outputs
ruby autooisee.rb input.mid "1d-2me,3p,4m" 8 6 12 0 64 2 6 --format both
```

#### Virtual Channel Mapping

The channel mapping string determines how MIDI channels map to AY hardware channels and virtual channels:

```
# tottoro: 9 virtual channels -> 18 with echo
"1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+"

sources_mix = [[0,1,2], [3,4], [5,6,7,8]]
  -> Hardware channel A: 3 vchans (drums, melody+envelope, polyphonic)
  -> Hardware channel B: 2 vchans (melody unvoiced, melody overlay)
  -> Hardware channel C: 4 vchans (melody, melody+env, polyphonic, melody+echo+wide)

With delay channels (BTP output):
  virtualChannelMap = {0: 6, 1: 4, 2: 8}  (each doubled for echo)
  labels = [A1, A1e, A2, A2e, A3, A3e, B1, B1e, B2, B2e, C1, C1e, C2, C2e, C3, C3e, C4, C4e]
```

Unvoiced channels (`u` modifier) get empty echo channels (no delay applied). This is correct — drums and effects don't need echo.

#### BTP Format Mapping

| LNote field | Bitphase field | Conversion |
|-------------|---------------|------------|
| `note` | `note.name`, `note.octave` | `name = (note % 12) + 2`, `octave = note / 12` (clamped 1-8) |
| `sample` | `instrument` | Direct (sample index) |
| `envelope` (kind='e') | `envelopeShape` | Direct (1-15); `envelopeShape=0` means "no envelope" |
| `ornament` | `table` | Direct (ornament index); drums forced to table 0 |
| `volume` | `volume` | Direct (0-15) |
| `type == 'r'` | `note.name = 1` | Release -> NoteName.Off |
| `type == '.'` | `note.name = 0` | Empty -> NoteName.None |

**Instruments** (`sample_data.rb`): All 31 VT2 samples parsed from `module_template.rb` into Bitphase `InstrumentRow` format. Verified identical via automated comparison script.

**Tables** (ornaments): Converted from `"L0,0,4,4,7,7"` format to `{id, rows: [0,0,4,4,7,7], loop: 0}`. Gap-filled for any indices referenced by notes but not in the ornaments hash.

**Envelope value**: Per-pattern-row global value — highest envelope note across all virtual channels on that row (same logic as VT path).

#### Echo/Delay Virtual Channels

The `build_btp_lmod_with_delays` function creates interleaved channel pairs:

- **Original channel**: Clean note data from the MIDI source (no delay mixed in)
- **Echo channel**: Time-shifted copies at `per_delay` and `per_delay2` offsets with 0.7x volume reduction per bounce

Echo placement rules match `apply_delays` exactly:
- `w` (wide stereo) modifier doubles delay offsets
- `u` (unvoiced) modifier suppresses echo entirely
- Second echo placed first (lower priority), first echo overwrites on collision
- Only overwrites empty slots or release notes

#### Verified Test Cases

| Test Case | Orig Vchans | With Echo | Channel Map |
|-----------|------------|-----------|-------------|
| **tottoro** | 9 | 18 | `{0:6, 1:4, 2:8}` |
| **chronos** | 3 | 6 | `{0:2, 1:2, 2:2}` |
| **flim** | 5 | 10 | `{0:6, 1:2, 2:2}` (A drums have empty echo - correct) |
| **imrav_simple** | 3 | 6 | `{0:2, 1:2, 2:2}` |
| **imrav_medium** | 6 | 12 | `{0:2, 1:6, 2:4}` |
| **imrav_hard** | 9 | 18 | `{0:4, 1:8, 2:6}` |

All VT outputs are byte-identical with the monolithic `autosiril.rb` (regression verified).

## Bugs Found and Fixed

1. **`envelopeShape=15` for all notes** — Was incorrectly setting hardware envelope shape on every note. Fixed: `envelopeShape=0` for non-envelope notes (p/m/d kinds), computed value only for 'e' kind.

2. **Missing table 15** — 880 drum notes from `4m[uf]` referenced ornament F=15 but only tables 0-14 existed. Fixed: gap-fill `build_tables` to create empty tables for all referenced indices; drums forced to `table=0`.

3. **Sample 19 row 2 `noiseAdd`** — Was 1, should be 0 per VT2 source. Fixed in `sample_data.rb`.

4. **`alpha` field hardcoded to 15** — Should be `(volume > 0 || envelope) ? 15 : 0` (matches Bitphase's own VT converter behavior). Fixed.

## Future Work

### Phase 2: JavaScript/TypeScript Standalone Port

Port autosiril algorithms to JS/TS (`autosiril-js/`) for in-browser conversion:
- Use `@tonejs/midi` for MIDI parsing
- Port algorithm by algorithm with tests against Ruby golden references
- Publish as npm package

### Phase 3: Bitphase Integration

- Direct MIDI import in Bitphase (runs autosiril-js in-browser)
- Interactive wizard for channel classification
- Preview and audition before committing

## Reference

### Source of Truth
- `autosiril.rb` — monolithic original (golden reference for VT output)
- `autooisee.rb` — fresh refactoring with BTP output support
- `bitphase_output.rb` — BTP generator
- `sample_data.rb` — instrument data (verified against `module_template.rb`)
- `test/` — regression test suite

### External
- Bitphase tracker — https://github.com/paator/bitphase
