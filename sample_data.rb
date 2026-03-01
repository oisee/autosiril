# sample_data.rb — VT2 sample definitions parsed into Bitphase InstrumentRow format
# Parsed from module_template.rb sample definitions
# Each entry is {id:, name:, rows:[], loop:}
# Each row is {tone:, noise:, envelope:, toneAdd:, noiseAdd:, envelopeAdd:,
#              envelopeAccumulation:, volume:, loop:, amplitudeSliding:,
#              amplitudeSlideUp:, toneAccumulation:, noiseAccumulation:,
#              retriggerEnvelope:, alpha:}

def make_row(tone, noise, envelope, tone_add, noise_add, volume, opts = {})
  {
    tone: tone,
    noise: noise,
    envelope: envelope,
    toneAdd: tone_add,
    noiseAdd: noise_add,
    envelopeAdd: noise_add,
    envelopeAccumulation: opts[:noise_accum] || false,
    volume: volume,
    loop: opts[:loop] || false,
    amplitudeSliding: opts[:amp_slide] || false,
    amplitudeSlideUp: opts[:amp_slide_up] || false,
    toneAccumulation: opts[:tone_accum] || false,
    noiseAccumulation: opts[:noise_accum] || false,
    retriggerEnvelope: false,
    alpha: (volume > 0 || envelope) ? 15 : 0
  }
end

BITPHASE_INSTRUMENTS = [
  # Sample1
  { id: '01', name: 'Instrument 01', loop: 5, rows: [
    make_row(true, false, true,    0, 0, 15),
    make_row(true, false, true,    0, 0, 15),
    make_row(true, false, true,    0, 0, 15),
    make_row(true, false, true,    0, 0, 13),
    make_row(true, false, true,    0, 0, 11),
    make_row(true, false, true,    0, 0, 11, loop: true),
  ]},

  # Sample2
  { id: '02', name: 'Instrument 02', loop: 0, rows: [
    make_row(true, false, true,    0, 0, 15, loop: true),
  ]},

  # Sample3
  { id: '03', name: 'Instrument 03', loop: 4, rows: [
    make_row(true, false, true,    1, 0, 15),
    make_row(true, false, true,    2, 0, 15),
    make_row(true, false, true,    1, 0, 14),
    make_row(true, false, true,    2, 0, 14),
    make_row(true, false, true,    0, 0, 14, loop: true),
    make_row(true, false, true,   -1, 0, 14),
    make_row(true, false, true,   -2, 0, 14),
    make_row(true, false, true,   -1, 0, 14),
    make_row(true, false, true,    0, 0, 14),
    make_row(true, false, true,    1, 0, 14),
    make_row(true, false, true,    2, 0, 14),
    make_row(true, false, true,    1, 0, 14),
  ]},

  # Sample4
  { id: '04', name: 'Instrument 04', loop: 4, rows: [
    make_row(true, false, true,    2, 0, 13),
    make_row(true, false, true,    2, 0, 13),
    make_row(true, false, true,    2, 0, 12),
    make_row(true, false, true,    2, 0, 11),
    make_row(true, false, true,    2, 0, 10, loop: true),
    make_row(true, false, true,    2, 0, 10),
    make_row(true, false, true,    2, 0, 10),
    make_row(true, false, true,    2, 0, 10),
    make_row(true, false, true,    2, 0, 10),
    make_row(true, false, true,    2, 0, 10),
    make_row(true, false, true,    2, 0, 10),
    make_row(true, false, true,    2, 0, 10),
  ]},

  # Sample5
  { id: '05', name: 'Instrument 05', loop: 2, rows: [
    make_row(true, false, true,    0, 0, 15),
    make_row(true, false, true,    0, 0, 15),
    make_row(false, false, false,  0, 0,  0, loop: true),
  ]},

  # Sample6
  { id: '06', name: 'Instrument 06', loop: 0, rows: [
    make_row(true, false, true,   -1, 0, 15, loop: true),
  ]},

  # Sample7
  { id: '07', name: 'Instrument 07', loop: 0, rows: [
    make_row(true, false, true,    6, 0, 15, loop: true),
  ]},

  # Sample8
  { id: '08', name: 'Instrument 08', loop: 3, rows: [
    make_row(false, true, false,   0, 0, 15),
    make_row(false, true, false,   0, 0, 11),
    make_row(false, true, false,   0, 0,  7),
    make_row(false, true, false,   0, 0,  6, amp_slide: true, amp_slide_up: false, loop: true),
  ]},

  # Sample9
  { id: '09', name: 'Instrument 09', loop: 20, rows: [
    make_row(true, false, true, 0x080, 0, 15),
    make_row(true, false, true, 0x100, 0, 14),
    make_row(true, false, true, 0x180, 0, 14),
    make_row(true, false, true, 0x200, 0, 14),
    make_row(true, false, true, 0x240, 0, 13),
    make_row(true, false, true, 0x280, 0, 13),
    make_row(true, false, true, 0x2C0, 0, 13),
    make_row(true, false, true, 0x300, 0, 12),
    make_row(true, false, true, 0x300, 0, 12),
    make_row(true, false, true, 0x340, 0, 12),
    make_row(true, false, true, 0x340, 0, 12),
    make_row(true, false, true, 0x380, 0, 11),
    make_row(true, false, true, 0x380, 0, 11),
    make_row(true, false, true, 0x400, 0, 11),
    make_row(true, false, true, 0x400, 0, 11),
    make_row(true, false, true, 0x480, 0, 10),
    make_row(true, false, true, 0x500, 0,  9),
    make_row(true, false, true, 0x580, 0,  7),
    make_row(true, false, true, 0x600, 0,  4),
    make_row(true, false, true, 0x680, 0,  1),
    make_row(true, false, true,     0, 0,  0, loop: true),
  ]},

  # Sample10  (0x0A)
  { id: '0A', name: 'Instrument 0A', loop: 5, rows: [
    make_row(true, false, false, 0x1C0, 0, 15),
    make_row(true, false, false, 0x280, 0, 14),
    make_row(true, false, false, 0x380, 0, 12),
    make_row(true, false, false, 0x440, 0, 10),
    make_row(true, false, false, 0x480, 0,  8),
    make_row(true, false, true,      0, 0,  0, loop: true),
  ]},

  # Sample11  (0x0B)
  { id: '0B', name: 'Instrument 0B', loop: 3, rows: [
    make_row(true, true, false, 0x200, -0x0A, 15),
    make_row(false, true, false,    0,  0x0F, 10),
    make_row(true, true, false, 0x200, -0x07, 14),
    make_row(false, true, false,    0,  0x0E, 11, amp_slide: true, amp_slide_up: false, loop: true),
  ]},

  # Sample12  (0x0C)
  { id: '0C', name: 'Instrument 0C', loop: 3, rows: [
    make_row(true, true, true,  0x0A0, 0x05, 15),
    make_row(true, true, true,  0x140, 0x02, 13),
    make_row(true, true, true,  0x140, 0x02, 11),
    make_row(true, true, true,  0x100, 0x00, 10, loop: true),
    make_row(true, true, true,  0x140, 0x00, 10),
    make_row(true, true, true,  0x200, 0x00, 10, amp_slide: true, amp_slide_up: false),
  ]},

  # Sample13  (0x0D)
  { id: '0D', name: 'Instrument 0D', loop: 5, rows: [
    make_row(true, false, false, 0x200, 0, 15),
    make_row(true, false, false, 0x2C0, 0, 15),
    make_row(true, false, false, 0x380, 0, 14),
    make_row(true, false, false, 0x500, 0, 12),
    make_row(true, false, false, 0x520, 0,  9),
    make_row(false, false, false,    0, 0,  0, loop: true),
  ]},

  # Sample14  (0x0E)
  { id: '0E', name: 'Instrument 0E', loop: 4, rows: [
    make_row(true, true, true, -0x100, 0, 15),
    make_row(true, true, true, -0x100, 0, 13),
    make_row(true, true, true, -0x100, 0, 10),
    make_row(true, true, true, -0x100, 0,  5),
    make_row(false, false, false,   0, 0,  0, loop: true),
  ]},

  # Sample15  (0x0F)
  { id: '0F', name: 'Instrument 0F', loop: 4, rows: [
    make_row(true, true, true, -0x100, 0,  5),
    make_row(true, true, true, -0x100, 0,  8),
    make_row(true, true, true, -0x100, 0, 11),
    make_row(true, true, true, -0x100, 0, 15),
    make_row(true, true, false,-0x100, 0,  9, amp_slide: true, amp_slide_up: false, loop: true),
  ]},

  # Sample16  (0x10)
  { id: '0G', name: 'Instrument 0G', loop: 7, rows: [
    make_row(true, false, true,    0, 0, 12),
    make_row(true, false, true,    0, 0, 14),
    make_row(true, false, true,    0, 0, 15),
    make_row(true, false, true,    0, 0, 15),
    make_row(true, false, true,    0, 0, 14),
    make_row(true, false, true,    0, 0, 13),
    make_row(true, false, true,    0, 0, 12),
    make_row(true, false, true,    0, 0, 12, loop: true),
    make_row(true, false, true,    1, 0, 12),
    make_row(true, false, true,    2, 0, 12),
    make_row(true, false, true,    3, 0, 12),
    make_row(true, false, true,    1, 0, 12),
    make_row(true, false, true,    0, 0, 12),
    make_row(true, false, true,   -1, 0, 12),
    make_row(true, false, true,   -2, 0, 12),
    make_row(true, false, true,   -3, 0, 12),
    make_row(true, false, true,   -1, 0, 12),
    make_row(true, false, true,    0, 0, 12),
    make_row(true, false, true,    0, 0, 12),
  ]},

  # Sample17  (0x11)
  { id: '0H', name: 'Instrument 0H', loop: 3, rows: [
    make_row(true, false, false, 0x1C0, 0, 15),
    make_row(true, false, false, 0x280, 0, 13),
    make_row(true, false, false, 0x380, 0,  7),
    make_row(true, true, true,       0, 0,  0, loop: true),
  ]},

  # Sample18  (0x12)
  { id: '0I', name: 'Instrument 0I', loop: 0, rows: [
    make_row(true, false, true, -0x00C, 0, 0, loop: true),
  ]},

  # Sample19  (0x13)
  { id: '0J', name: 'Instrument 0J', loop: 3, rows: [
    make_row(true, true, false,    0, 0, 15),
    make_row(true, true, false,    0, 0, 12),
    make_row(true, true, false,    0, 0,  6),
    make_row(true, true, false,    0, 1, 10, amp_slide: true, amp_slide_up: false, loop: true),
  ]},

  # Sample20  (0x14)
  { id: '0K', name: 'Instrument 0K', loop: 1, rows: [
    make_row(true, true, true,  0x140, 0, 15),
    make_row(false, true, true,     0, 0, 11, amp_slide: true, amp_slide_up: false, loop: true),
  ]},

  # Sample21  (0x15)
  { id: '0L', name: 'Instrument 0L', loop: 3, rows: [
    make_row(false, true, true,     0, 0, 13),
    make_row(false, true, true,     0, 0,  8),
    make_row(false, true, true,     0, 0,  1),
    make_row(true, true, true,      0, 0,  0, loop: true),
  ]},

  # Sample22  (0x16)
  { id: '0M', name: 'Instrument 0M', loop: 0, rows: [
    make_row(true, false, true,     0, 0, 13, loop: true),
    make_row(true, false, true,     0, 0, 13),
    make_row(false, false, false,   0, 0,  9),
    make_row(false, false, false,   0, 0,  9),
    make_row(true, false, true,     0, 0, 13),
    make_row(true, false, true,     0, 0, 13),
    make_row(false, false, false,   0, 0,  9),
    make_row(false, false, false,   0, 0,  9),
    make_row(true, false, true,     0, 0, 13),
    make_row(true, false, true,     0, 0, 13),
    make_row(true, false, true,     0, 0, 13),
    make_row(true, false, true,     0, 0, 13),
    make_row(true, false, true,     0, 0, 13),
    make_row(true, false, true,     0, 0, 13),
    make_row(false, false, false,   0, 0,  9),
    make_row(false, false, false,   0, 0,  9),
  ]},

  # Sample23  (0x17)
  { id: '0N', name: 'Instrument 0N', loop: 0, rows: [
    make_row(true, false, true,      0,    0, 15, loop: true),
    make_row(true, false, true,  0x010, 0x01, 15),
    make_row(true, false, true,  0x010, 0x01, 15),
    make_row(true, false, true,  0x010, 0x01, 15),
    make_row(true, false, true,  0x010, 0x01, 15),
    make_row(true, false, true,      0,    0, 15),
    make_row(true, false, true,      0,    0, 15),
    make_row(true, false, true, -0x010,-0x01, 15),
    make_row(true, false, true, -0x010,-0x01, 15),
    make_row(true, false, true, -0x010,-0x01, 15),
    make_row(true, false, true, -0x010,-0x01, 15),
    make_row(true, false, true,      0,    0, 15),
  ]},

  # Sample24  (0x18)
  { id: '0O', name: 'Instrument 0O', loop: 12, rows: [
    make_row(true, true, false,     0, -0x01, 12),
    make_row(true, true, false,     0, -0x01, 13),
    make_row(true, true, false,     0, -0x01, 14),
    make_row(true, true, false,     0, -0x01, 15),
    make_row(true, true, false,     0, -0x01, 15),
    make_row(true, true, false,     0, -0x01, 15),
    make_row(true, true, false,     0, -0x01, 15),
    make_row(true, true, false,     0, -0x01, 15),
    make_row(true, true, false,     0, -0x01, 14),
    make_row(true, true, false,     0, -0x01, 14),
    make_row(true, true, false,     0, -0x01, 14),
    make_row(true, true, false,     0, -0x01, 15),
    make_row(true, true, false,     0, -0x01, 15, loop: true),
  ]},

  # Sample25  (0x19)
  { id: '0P', name: 'Instrument 0P', loop: 1, rows: [
    make_row(true, true, true,      0, 0, 15),
    make_row(true, true, true,      0, 0, 15, loop: true),
    make_row(true, true, true,      0, 0, 15),
    make_row(true, true, true,      0, 0, 15),
    make_row(true, true, true,      0, 0, 15, amp_slide: true, amp_slide_up: false),
  ]},

  # Sample26  (0x1A)
  { id: '0Q', name: 'Instrument 0Q', loop: 0, rows: [
    make_row(false, false, false,   0, 0,  0, loop: true),
  ]},

  # Sample27  (0x1B)
  { id: '0R', name: 'Instrument 0R', loop: 3, rows: [
    make_row(true, false, true,  0x100, 0x05, 15),
    make_row(true, false, true,  0x200, 0x02, 10),
    make_row(true, false, true,  0x300, 0x02,  7),
    make_row(true, true, true,   0x400, 0x00,  3, amp_slide: true, amp_slide_up: false, loop: true),
  ]},

  # Sample28  (0x1C)
  { id: '0S', name: 'Instrument 0S', loop: 0, rows: [
    make_row(false, false, false,   0, 0,  0, loop: true),
  ]},

  # Sample29  (0x1D)
  { id: '0T', name: 'Instrument 0T', loop: 0, rows: [
    make_row(false, false, true,    0, 0,  0, loop: true),
  ]},

  # Sample30  (0x1E)
  { id: '0U', name: 'Instrument 0U', loop: 0, rows: [
    make_row(true, true, true,      0, 0, 12, amp_slide: true, amp_slide_up: true, loop: true),
  ]},

  # Sample31  (0x1F)
  { id: '0V', name: 'Instrument 0V', loop: 5, rows: [
    make_row(true, true, false,  0x1C0, 0, 15),
    make_row(true, false, false, 0x280, 0, 14),
    make_row(true, false, false, 0x380, 0, 12),
    make_row(true, false, false, 0x440, 0, 10),
    make_row(true, false, false, 0x480, 0,  8),
    make_row(true, false, true,      0, 0,  0, loop: true),
  ]},
]
