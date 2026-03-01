#!/bin/sh
# Test BTP output for tottoro — the most complex test case (9 virtual channels)
# Validates: BTP generation, VT regression, BTP structure

set -e

echo "=== BTP Tottoro Test ==="

# Step 1: Generate both VT and BTP outputs
echo "--- Generating VT + BTP output ---"
ruby ../autooisee.rb tottoro_example.mid \
  "1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+" \
  8 6 12 0 64 2 6 \
  --format both 2>/dev/null

# Step 2: VT regression — compare against monolithic
echo "--- VT regression check ---"
cp tottoro_example.mide.txt /tmp/tottoro_layered_vt.txt
ruby ../autosiril.rb tottoro_example.mid \
  "1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+" \
  8 6 12 0 64 2 6 2>/dev/null
if diff tottoro_example.mide.txt /tmp/tottoro_layered_vt.txt > /dev/null 2>&1; then
  echo "PASS: VT output matches monolithic"
else
  echo "FAIL: VT output differs from monolithic"
  diff tottoro_example.mide.txt /tmp/tottoro_layered_vt.txt | head -20
  exit 1
fi

# Step 3: BTP structure validation
echo "--- BTP structure validation ---"
if [ ! -f tottoro_example.btp ]; then
  echo "FAIL: tottoro_example.btp not found"
  exit 1
fi

python3 -c "
import sys, json, gzip

with gzip.open('tottoro_example.btp', 'rt') as f:
    d = json.load(f)

errors = []

# Check top-level structure
if 'songs' not in d: errors.append('missing songs')
if 'patternOrder' not in d: errors.append('missing patternOrder')
if 'tables' not in d: errors.append('missing tables')
if 'instruments' not in d: errors.append('missing instruments')

# Check song structure
s = d['songs'][0]
if s.get('chipType') != 'ay': errors.append(f'chipType={s.get(\"chipType\")} expected ay')
if s.get('chipFrequency') != 1750000: errors.append(f'chipFrequency={s.get(\"chipFrequency\")}')

# Check virtualChannelMap
vcm = s.get('virtualChannelMap', {})
# Convert string keys to int for comparison
vcm_int = {int(k): v for k, v in vcm.items()}
expected_vcm = {0: 3, 1: 2, 2: 4}
if vcm_int != expected_vcm: errors.append(f'virtualChannelMap={vcm_int} expected {expected_vcm}')

# Check total virtual channels = 9
total_vchans = sum(vcm_int.values())
if total_vchans != 9: errors.append(f'total vchans={total_vchans} expected 9')

# Check patterns have 9 channels each
for i, p in enumerate(s['patterns']):
    if len(p['channels']) != 9:
        errors.append(f'pattern {p[\"id\"]} has {len(p[\"channels\"])} channels, expected 9')
        break

# Check channel labels
p0 = s['patterns'][0]
labels = [ch['label'] for ch in p0['channels']]
expected_labels = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4']
if labels != expected_labels: errors.append(f'labels={labels} expected {expected_labels}')

# Check ornaments/tables
if len(d['tables']) != 15: errors.append(f'tables count={len(d[\"tables\"])} expected 15')

# Check instruments
if len(d['instruments']) != 31: errors.append(f'instruments count={len(d[\"instruments\"])} expected 31')

# Check pattern count and order
if len(d['patternOrder']) < 50: errors.append(f'patternOrder too short: {len(d[\"patternOrder\"])}')

# Check that there are actual notes in the data
has_notes = False
for p in s['patterns']:
    for ch in p['channels']:
        for r in ch['rows']:
            if r['note']['name'] > 1:
                has_notes = True
                break
        if has_notes: break
    if has_notes: break
if not has_notes: errors.append('no actual notes found in any pattern')

if errors:
    print('FAIL: BTP structure errors:')
    for e in errors:
        print(f'  - {e}')
    sys.exit(1)
else:
    print('PASS: BTP structure valid')
    print(f'  {len(s[\"patterns\"])} patterns, {len(d[\"patternOrder\"])} in play order')
    print(f'  {total_vchans} virtual channels: {labels}')
    print(f'  {len(d[\"tables\"])} tables, {len(d[\"instruments\"])} instruments')
"

# Clean up
rm -f /tmp/tottoro_layered_vt.txt

echo "=== All tottoro BTP tests PASSED ==="
