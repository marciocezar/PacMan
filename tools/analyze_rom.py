#!/usr/bin/env python3
"""Disassembler 6502 com mapa do TIA para a ROM de 4 KB do Pac-Man (Atari 2600).

O REA (Ghidra) decodifica 6502, mas não conhece os registradores de vídeo e
áudio do TIA. Este script faz as duas coisas: segue o fluxo a partir do vetor
de reset e anota cada escrita em $00–$2C.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROM_NAME = "Pac-Man (1981) (Atari).a26"
ROM_PATH = next(
    (path for path in (ROOT / ROM_NAME, ROOT / "_room" / ROM_NAME) if path.is_file()),
    ROOT / ROM_NAME,
)
OUT_DIR = ROOT / "docs" / "reverse-engineering"

# Cartucho de 4 KB mapeado em $F000–$FFFF (vetor de reset em $FFFC).
LOAD = 0xF000

TIA = {
    0x00: "VSYNC",
    0x01: "VBLANK",
    0x02: "WSYNC",
    0x03: "RSYNC",
    0x04: "NUSIZ0",
    0x05: "NUSIZ1",
    0x06: "COLUP0",
    0x07: "COLUP1",
    0x08: "COLUPF",
    0x09: "COLUBK",
    0x0A: "CTRLPF",
    0x0B: "REFP0",
    0x0C: "REFP1",
    0x0D: "PF0",
    0x0E: "PF1",
    0x0F: "PF2",
    0x10: "RESP0",
    0x11: "RESP1",
    0x12: "RESM0",
    0x13: "RESM1",
    0x14: "RESBL",
    0x15: "AUDC0",
    0x16: "AUDC1",
    0x17: "AUDF0",
    0x18: "AUDF1",
    0x19: "AUDV0",
    0x1A: "AUDV1",
    0x1B: "GRP0",
    0x1C: "GRP1",
    0x1D: "ENAM0",
    0x1E: "ENAM1",
    0x1F: "ENABL",
    0x20: "HMP0",
    0x21: "HMP1",
    0x22: "HMM0",
    0x23: "HMM1",
    0x24: "HMBL",
    0x25: "VDELP0",
    0x26: "VDELP1",
    0x27: "VDELBL",
    0x28: "RESMP0",
    0x29: "RESMP1",
    0x2A: "HMOVE",
    0x2B: "HMCLR",
    0x2C: "CXCLR",
}

# (mnemonic, mode, size). mode: imp acc imm zp zpx zpy izx izy abs abx aby ind rel
OP: dict[int, tuple[str, str, int]] = {}


def add(ops: list[int], mnemonic: str, mode: str, size: int) -> None:
    for op in ops:
        OP[op] = (mnemonic, mode, size)


add([0x00], "BRK", "imp", 2)
add([0x01, 0x05, 0x09, 0x0D, 0x11, 0x15, 0x19, 0x1D], "ORA", "x", 0)
add([0x21, 0x25, 0x29, 0x2D, 0x31, 0x35, 0x39, 0x3D], "AND", "x", 0)
add([0x41, 0x45, 0x49, 0x4D, 0x51, 0x55, 0x59, 0x5D], "EOR", "x", 0)
add([0x61, 0x65, 0x69, 0x6D, 0x71, 0x75, 0x79, 0x7D], "ADC", "x", 0)
add([0x81, 0x85, 0x8D, 0x91, 0x95, 0x99, 0x9D], "STA", "x", 0)
add([0xA1, 0xA5, 0xA9, 0xAD, 0xB1, 0xB5, 0xB9, 0xBD], "LDA", "x", 0)
add([0xC1, 0xC5, 0xC9, 0xCD, 0xD1, 0xD5, 0xD9, 0xDD], "CMP", "x", 0)
add([0xE1, 0xE5, 0xE9, 0xED, 0xF1, 0xF5, 0xF9, 0xFD], "SBC", "x", 0)
add([0x06, 0x0A, 0x0E, 0x16, 0x1E], "ASL", "s", 0)
add([0x26, 0x2A, 0x2E, 0x36, 0x3E], "ROL", "s", 0)
add([0x46, 0x4A, 0x4E, 0x56, 0x5E], "LSR", "s", 0)
add([0x66, 0x6A, 0x6E, 0x76, 0x7E], "ROR", "s", 0)
add([0x24, 0x2C], "BIT", "b", 0)
add([0x84, 0x8C, 0x94], "STY", "y", 0)
add([0x86, 0x8E, 0x96], "STX", "xst", 0)
add([0xA0, 0xA4, 0xAC, 0xB4, 0xBC], "LDY", "y", 0)
add([0xA2, 0xA6, 0xAE, 0xB6, 0xBE], "LDX", "xld", 0)
add([0xC0, 0xC4, 0xCC], "CPY", "y", 0)
add([0xE0, 0xE4, 0xEC], "CPX", "xld", 0)
add([0xC6, 0xCE, 0xD6, 0xDE], "DEC", "d", 0)
add([0xE6, 0xEE, 0xF6, 0xFE], "INC", "d", 0)
add([0x10], "BPL", "rel", 2)
add([0x30], "BMI", "rel", 2)
add([0x50], "BVC", "rel", 2)
add([0x70], "BVS", "rel", 2)
add([0x90], "BCC", "rel", 2)
add([0xB0], "BCS", "rel", 2)
add([0xD0], "BNE", "rel", 2)
add([0xF0], "BEQ", "rel", 2)
add([0x18], "CLC", "imp", 1)
add([0x38], "SEC", "imp", 1)
add([0x58], "CLI", "imp", 1)
add([0x78], "SEI", "imp", 1)
add([0xD8], "CLD", "imp", 1)
add([0xF8], "SED", "imp", 1)
add([0xB8], "CLV", "imp", 1)
add([0xEA], "NOP", "imp", 1)
add([0xAA], "TAX", "imp", 1)
add([0x8A], "TXA", "imp", 1)
add([0xA8], "TAY", "imp", 1)
add([0x98], "TYA", "imp", 1)
add([0xBA], "TSX", "imp", 1)
add([0x9A], "TXS", "imp", 1)
add([0xCA], "DEX", "imp", 1)
add([0xE8], "INX", "imp", 1)
add([0x88], "DEY", "imp", 1)
add([0xC8], "INY", "imp", 1)
add([0x48], "PHA", "imp", 1)
add([0x68], "PLA", "imp", 1)
add([0x08], "PHP", "imp", 1)
add([0x28], "PLP", "imp", 1)
add([0x40], "RTI", "imp", 1)
add([0x60], "RTS", "imp", 1)
add([0x20], "JSR", "abs", 3)
add([0x4C], "JMP", "abs", 3)
add([0x6C], "JMP", "ind", 3)

# Fill size/mode for the grouped families. The placeholder mode is replaced.
ALU_MODES = {
    0x01: ("izx", 2),
    0x05: ("zp", 2),
    0x09: ("imm", 2),
    0x0D: ("abs", 3),
    0x11: ("izy", 2),
    0x15: ("zpx", 2),
    0x19: ("aby", 3),
    0x1D: ("abx", 3),
}
SHIFT_MODES = {
    0x06: ("zp", 2),
    0x0A: ("acc", 1),
    0x0E: ("abs", 3),
    0x16: ("zpx", 2),
    0x1E: ("abx", 3),
}
for base_mn, bases in (
    ("ORA", [0x00]),
    ("AND", [0x20]),
    ("EOR", [0x40]),
    ("ADC", [0x60]),
    ("STA", [0x80]),
    ("LDA", [0xA0]),
    ("CMP", [0xC0]),
    ("SBC", [0xE0]),
):
    for delta, (mode, size) in ALU_MODES.items():
        opcode = bases[0] + delta
        if opcode in OP and OP[opcode][0] == base_mn:
            # STA has no immediate.
            if base_mn == "STA" and mode == "imm":
                continue
            OP[opcode] = (base_mn, mode, size)

for base_mn, bases in (("ASL", [0x00]), ("ROL", [0x20]), ("LSR", [0x40]), ("ROR", [0x60])):
    for delta, (mode, size) in SHIFT_MODES.items():
        opcode = bases[0] + delta
        if opcode in OP and OP[opcode][0] == base_mn:
            OP[opcode] = (base_mn, mode, size)

OP[0x24] = ("BIT", "zp", 2)
OP[0x2C] = ("BIT", "abs", 3)
OP[0x84] = ("STY", "zp", 2)
OP[0x8C] = ("STY", "abs", 3)
OP[0x94] = ("STY", "zpx", 2)
OP[0x86] = ("STX", "zp", 2)
OP[0x8E] = ("STX", "abs", 3)
OP[0x96] = ("STX", "zpy", 2)
OP[0xA0] = ("LDY", "imm", 2)
OP[0xA4] = ("LDY", "zp", 2)
OP[0xAC] = ("LDY", "abs", 3)
OP[0xB4] = ("LDY", "zpx", 2)
OP[0xBC] = ("LDY", "abx", 3)
OP[0xA2] = ("LDX", "imm", 2)
OP[0xA6] = ("LDX", "zp", 2)
OP[0xAE] = ("LDX", "abs", 3)
OP[0xB6] = ("LDX", "zpy", 2)
OP[0xBE] = ("LDX", "aby", 3)
OP[0xC0] = ("CPY", "imm", 2)
OP[0xC4] = ("CPY", "zp", 2)
OP[0xCC] = ("CPY", "abs", 3)
OP[0xE0] = ("CPX", "imm", 2)
OP[0xE4] = ("CPX", "zp", 2)
OP[0xEC] = ("CPX", "abs", 3)
OP[0xC6] = ("DEC", "zp", 2)
OP[0xCE] = ("DEC", "abs", 3)
OP[0xD6] = ("DEC", "zpx", 2)
OP[0xDE] = ("DEC", "abx", 3)
OP[0xE6] = ("INC", "zp", 2)
OP[0xEE] = ("INC", "abs", 3)
OP[0xF6] = ("INC", "zpx", 2)
OP[0xFE] = ("INC", "abx", 3)


def fmt_operand(mode: str, raw: bytes, pc: int) -> tuple[str, int | None]:
    if mode in ("imp", "acc"):
        return ("A" if mode == "acc" else "", None)
    if mode == "imm":
        return (f"#${raw[1]:02X}", raw[1])
    if mode == "zp":
        return (f"${raw[1]:02X}", raw[1])
    if mode == "zpx":
        return (f"${raw[1]:02X},X", raw[1])
    if mode == "zpy":
        return (f"${raw[1]:02X},Y", raw[1])
    if mode == "izx":
        return (f"(${raw[1]:02X},X)", raw[1])
    if mode == "izy":
        return (f"(${raw[1]:02X}),Y", raw[1])
    if mode == "abs":
        addr = raw[1] | (raw[2] << 8)
        return (f"${addr:04X}", addr)
    if mode == "abx":
        addr = raw[1] | (raw[2] << 8)
        return (f"${addr:04X},X", addr)
    if mode == "aby":
        addr = raw[1] | (raw[2] << 8)
        return (f"${addr:04X},Y", addr)
    if mode == "ind":
        addr = raw[1] | (raw[2] << 8)
        return (f"(${addr:04X})", addr)
    if mode == "rel":
        offset = raw[1] if raw[1] < 128 else raw[1] - 256
        target = (pc + 2 + offset) & 0xFFFF
        return (f"${target:04X}", target)
    return ("?", None)


def main() -> None:
    rom = ROM_PATH.read_bytes()
    assert len(rom) == 4096, len(rom)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    def at(addr: int) -> int:
        return rom[addr - LOAD]

    reset = at(0xFFFC) | (at(0xFFFD) << 8)
    nmi = at(0xFFFA) | (at(0xFFFB) << 8)
    irq = at(0xFFFE) | (at(0xFFFF) << 8)

    code: dict[int, tuple[str, str, str, int | None]] = {}
    leaders = [reset]
    seen: set[int] = set()
    while leaders:
        pc = leaders.pop()
        while LOAD <= pc <= 0xFFFF and pc not in seen:
            seen.add(pc)
            opcode = at(pc)
            info = OP.get(opcode)
            if info is None:
                break
            mnemonic, mode, size = info
            raw = rom[pc - LOAD : pc - LOAD + size]
            if len(raw) < size:
                break
            operand, value = fmt_operand(mode, raw, pc)
            code[pc] = (mnemonic, operand, mode, value)
            next_pc = pc + size
            if mnemonic in ("JMP", "RTS", "RTI", "BRK"):
                if mnemonic == "JMP" and mode == "abs" and value is not None:
                    leaders.append(value)
                break
            if mnemonic == "JSR" and value is not None:
                leaders.append(value)
            if mnemonic in ("BPL", "BMI", "BVC", "BVS", "BCC", "BCS", "BNE", "BEQ") and value is not None:
                leaders.append(value)
            pc = next_pc

    lines: list[str] = []
    lines.append(f"; ROM {ROM_PATH.name}  {len(rom)} bytes  load ${LOAD:04X}")
    lines.append(f"; RESET ${reset:04X}  NMI ${nmi:04X}  IRQ ${irq:04X}")
    lines.append(f"; instructions traced: {len(code)}")
    tia_hits: list[dict[str, object]] = []
    audio_hits: list[dict[str, object]] = []

    pc = LOAD
    while pc <= 0xFFFF:
        if pc in code:
            mnemonic, operand, mode, value = code[pc]
            note = ""
            if mnemonic in ("STA", "STX", "STY") and mode == "zp" and value is not None and value in TIA:
                name = TIA[value]
                note = f"  ; {name}"
                window = []
                look = pc
                # Up to 4 previous traced instructions.
                prev = [a for a in code if a < pc]
                for addr in prev[-4:]:
                    m, o, _, v = code[addr]
                    window.append({"addr": f"${addr:04X}", "op": f"{m} {o}".strip(), "imm": v if m in ("LDA", "LDX", "LDY") and code[addr][2] == "imm" else None})
                hit = {
                    "addr": f"${pc:04X}",
                    "store": f"{mnemonic} {operand}",
                    "register": name,
                    "prev": window,
                }
                tia_hits.append(hit)
                if name.startswith("AUD"):
                    audio_hits.append(hit)
            size = OP[at(pc)][2]
            raw = rom[pc - LOAD : pc - LOAD + size]
            byte_str = " ".join(f"{b:02X}" for b in raw)
            text = f"{mnemonic} {operand}".strip()
            lines.append(f"${pc:04X}:  {byte_str:<8}  {text}{note}")
            pc += size
        else:
            lines.append(f"${pc:04X}:  {at(pc):02X}        .byte ${at(pc):02X}")
            pc += 1

    (OUT_DIR / "pacman.disasm.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Group audio writes by the immediate loaded just before, when obvious.
    def immediate_before(hit: dict[str, object]) -> int | None:
        prev = hit["prev"]
        assert isinstance(prev, list)
        for item in reversed(prev):
            if item["imm"] is not None:
                return int(item["imm"])
        return None

    audio_summary: dict[str, list[dict[str, object]]] = {}
    for hit in audio_hits:
        reg = str(hit["register"])
        audio_summary.setdefault(reg, []).append(
            {
                "at": hit["addr"],
                "immediate": immediate_before(hit),
                "prev": [p["op"] for p in hit["prev"]],  # type: ignore[index]
            }
        )

    gfx_regs = {"PF0", "PF1", "PF2", "GRP0", "GRP1", "COLUP0", "COLUP1", "COLUPF", "COLUBK", "CTRLPF", "ENABL", "ENAM0", "ENAM1", "NUSIZ0", "NUSIZ1"}
    gfx_summary: dict[str, list[dict[str, object]]] = {}
    for hit in tia_hits:
        reg = str(hit["register"])
        if reg not in gfx_regs:
            continue
        gfx_summary.setdefault(reg, []).append(
            {
                "at": hit["addr"],
                "immediate": immediate_before(hit),
                "prev": [p["op"] for p in hit["prev"]],  # type: ignore[index]
            }
        )

    # Subroutines: targets of JSR.
    jsrs: dict[str, list[str]] = {}
    for addr, (mnemonic, operand, mode, value) in code.items():
        if mnemonic == "JSR" and value is not None:
            jsrs.setdefault(f"${value:04X}", []).append(f"${addr:04X}")

    report = {
        "rom": ROM_PATH.name,
        "size": len(rom),
        "load": f"${LOAD:04X}",
        "reset": f"${reset:04X}",
        "nmi": f"${nmi:04X}",
        "irq": f"${irq:04X}",
        "instructions": len(code),
        "tia_writes": len(tia_hits),
        "subroutines": {k: v for k, v in sorted(jsrs.items())},
        "audio": audio_summary,
        "graphics": gfx_summary,
    }
    (OUT_DIR / "tia_map.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"reset ${reset:04X}  instructions {len(code)}  tia {len(tia_hits)}  audio {len(audio_hits)}")
    print("subroutines:")
    for target, callers in sorted(jsrs.items()):
        print(f"  {target}  from {', '.join(callers)}")
    print("audio writes:")
    for reg, hits in audio_summary.items():
        values = [h["immediate"] for h in hits]
        print(f"  {reg:6} x{len(hits):2}  immediates={values}")
    print("graphics writes:")
    for reg, hits in gfx_summary.items():
        values = [h["immediate"] for h in hits]
        print(f"  {reg:6} x{len(hits):2}  immediates={values}")


if __name__ == "__main__":
    main()
