#!/usr/bin/env python3
"""
Rilegge un .flp generato dall'app usando PyFLP e ne verifica la struttura.

Uso:  python3 scripts/validate-flp.py file.flp [--expect-json atteso.json]

PyFLP e' la libreria che la community usa per leggere i progetti FL Studio:
se lei interpreta correttamente il file, la struttura e' coerente con il formato.
Non sostituisce la prova in FL Studio, ma la rende molto piu' probabile.
"""
import json
import sys

try:
    import pyflp
    import pyflp._events as _ev
except ImportError:
    print("PyFLP non installato: pip install pyflp", file=sys.stderr)
    sys.exit(2)


def _patch_event_enum():
    """PyFLP 2.2.1 su Python 3.11+ non riesce a costruire EventEnum dagli id.

    Dipende da 'fastenum', che la libreria stessa disabilita da Python 3.11 in poi.
    Qui rimettiamo il comportamento atteso: id noto -> membro dell'enum,
    id sconosciuto -> intero con attributo .value. Non tocca la lettura del file.
    """

    class RawId(int):
        @property
        def value(self):
            return int(self)

    meta = type(_ev.EventEnum)
    original = meta.__call__

    def call(cls, value=None, *args, **kwargs):
        if cls is _ev.EventEnum and isinstance(value, int) and not args and not kwargs:
            for subclass in _ev.EventEnum.__subclasses__():
                try:
                    return original(subclass, value)
                except ValueError:
                    continue
            return RawId(value)
        return original(cls, value, *args, **kwargs)

    meta.__call__ = call


try:
    _ev.EventEnum(0)
except TypeError:
    _patch_event_enum()

path = sys.argv[1]
expected = None
if "--expect-json" in sys.argv:
    with open(sys.argv[sys.argv.index("--expect-json") + 1], encoding="utf-8") as handle:
        expected = json.load(handle)

errors = []


def check(condition, message):
    if not condition:
        errors.append(message)


project = pyflp.parse(path)
print(f"file        : {path}")
print(f"versione    : {project.version}")
print(f"formato     : {project.format.name}, ppq {project.ppq}")
print(f"tempo       : {project.tempo} BPM")
print(f"titolo      : {project.title}")

channels = list(project.channels)
print(f"canali      : {len(channels)} -> {', '.join(c.name or '?' for c in channels)}")

patterns = list(project.patterns)
total_notes = 0
for pattern in patterns:
    notes = list(pattern.notes)
    total_notes += len(notes)
print(f"pattern     : {len(patterns)} -> {', '.join(p.name or '?' for p in patterns)}")
print(f"note totali : {total_notes}")

arrangements = list(project.arrangements)
items = 0
used_tracks = 0
for arrangement in arrangements:
    for track in arrangement.tracks:
        count = len(track)
        if count:
            used_tracks += 1
            items += count
            for item in track:
                name = getattr(getattr(item, "pattern", None), "name", "?")
                print(f"  playlist: '{name}' @ {item.position} lungo {item.length} su traccia {track.iid}")
print(f"arrangiamenti: {len(arrangements)}, tracce usate: {used_tracks}, elementi in playlist: {items}")

if patterns:
    first = patterns[0]
    notes = list(first.notes)[:3]
    for note in notes:
        print(f"  esempio nota: key={note.key} pos={note.position} len={note.length} "
              f"vel={note.velocity} ch={note.rack_channel}")

if expected:
    check(round(project.tempo) == expected["bpm"], f"tempo {project.tempo} != {expected['bpm']}")
    check(project.ppq == expected["ppq"], f"ppq {project.ppq} != {expected['ppq']}")
    check(len(channels) == expected["channels"], f"canali {len(channels)} != {expected['channels']}")
    check(len(patterns) == expected["patterns"], f"pattern {len(patterns)} != {expected['patterns']}")
    check(total_notes == expected["notes"], f"note {total_notes} != {expected['notes']}")
    check(items == expected["playlistItems"], f"playlist {items} != {expected['playlistItems']}")
    check(project.title == expected["title"], f"titolo '{project.title}' != '{expected['title']}'")
    names = [c.name for c in channels]
    check(names == expected["channelNames"], f"nomi canali {names} != {expected['channelNames']}")
    pnames = [p.name for p in patterns]
    check(pnames == expected["patternNames"], f"nomi pattern {pnames} != {expected['patternNames']}")

for error in errors:
    print("  ERRORE:", error)

print("OK: il progetto e' leggibile e coerente" if not errors else f"{len(errors)} problemi")
sys.exit(1 if errors else 0)
