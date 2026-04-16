# macOS VM on Proxmox — Setup Guide

## Which macOS to Use

**Use: macOS Sonoma 14**
- Best supported by OSX-KVM / OpenCore
- Chrome, Zoom, BlackHole all fully compatible
- Most recent = evaluators see current platform

---

## Method: OSX-KVM (fastest, free)

### Step 1 — On your Windows machine, fetch macOS installer

Use the OSX-KVM fetch script. Run in WSL or upload via Proxmox shell:

```bash
# On Proxmox host shell (SSH to 192.168.1.111)
apt-get install -y git python3
git clone --depth 1 https://github.com/kholia/OSX-KVM.git /root/OSX-KVM
cd /root/OSX-KVM
python3 fetch-macOS-v2.py
# Select: Sonoma (14) when prompted
# Downloads: BaseSystem.dmg (~700MB)
```

### Step 2 — Convert to usable format

```bash
cd /root/OSX-KVM
dmg2img -i BaseSystem.dmg BaseSystem.img
# If dmg2img not installed:
apt-get install -y dmg2img
```

### Step 3 — Upload OpenCore ISO to Proxmox

```bash
# Still on Proxmox host
cp /root/OSX-KVM/OpenCore/OpenCore.iso /var/lib/vz/template/iso/OpenCore.iso
# Move BaseSystem.img to storage
mv BaseSystem.img /var/lib/vz/images/  # or wherever your VM disks live
```

### Step 4 — Create VM in Proxmox UI

Settings (exact):
| Field | Value |
|-------|-------|
| VM ID | 102 |
| Name | macos-callwhisper |
| OS Type | Other |
| BIOS | OVMF (UEFI) |
| Machine | q35 |
| CPU | 2 cores, type: Penryn |
| RAM | 4096 MB |
| Disk | 50GB, VirtIO SCSI |
| Network | vmbr0, model: vmxnet3 |
| Display | VMware compatible (vmware) |

Add two CD-ROM drives:
- IDE2: OpenCore.iso (bootable)
- IDE0: BaseSystem.img (as disk image)

### Step 5 — Boot and Install

1. Start VM, open Console in Proxmox UI
2. OpenCore bootloader appears → select "macOS Base System"
3. Disk Utility → Erase the 50GB VirtIO disk → APFS → name "Macintosh HD"
4. Install macOS → ~45 min, reboots several times
5. Complete setup wizard (skip Apple ID, use local account)

### Step 6 — Post-install

```bash
# In macOS VM terminal
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install blackhole-2ch
```

Then:
- Download Chrome from google.com/chrome
- Download Zoom from zoom.us/download
- System Settings → Sound → Output → select BlackHole 2ch (test audio routes through it)

### Step 7 — Configure Zoom Audio

Zoom → Settings → Audio:
- Speaker: BlackHole 2ch
- Microphone: Built-in Microphone (or VM mic)

This makes Zoom output (prospect audio) go through BlackHole → Chrome can capture it as input device.

---

## Audio in Proxmox VM — Key Config

macOS VM audio requires `ich9-intel-hda` or `ac97` in QEMU args.
Add to VM config (`/etc/pve/qemu-server/102.conf`):

```
args: -device ich9-intel-hda -device hda-duplex
```

Or via Proxmox UI: Hardware → Add → Audio Device → ich9-Intel HDA.

---

## Verify Everything Works

Before touching any code:

1. Open Chrome on macOS VM
2. Open `scripts/test-audio.html` (served from LXC 100 or local file)
3. Should list: "Built-in Microphone" and "BlackHole 2ch" as separate input devices
4. Click "Start Both" → console shows two active streams
5. Speak → mic stream active
6. Play Zoom audio → BlackHole stream active

**This is Phase 0 gate. Do not proceed to code until this passes.**

---

## Troubleshooting

**BlackHole not appearing in Chrome:**
- Restart Chrome
- Check System Settings → Privacy → Microphone → Chrome allowed
- Run: `sudo launchctl stop com.apple.audio.coreaudiod && sudo launchctl start com.apple.audio.coreaudiod`

**No sound in VM:**
- Check Proxmox VM hardware has Audio Device added
- Check macOS System Settings → Sound → Output is not muted

**OSX-KVM install stuck:**
- Normal — macOS install takes 45-60 min with multiple reboots
- Don't interrupt it

**Slow VM:**
- Add CPU flag: in VM config add `cpu: Penryn,kvm=on,vendor=GenuineIntel`
