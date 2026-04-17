# macOS VM on Proxmox — Setup Guide

## ✅ COMPLETED — VM 102 Running macOS Sonoma 14.8.5

**Status:** macOS Sonoma installed and desktop accessible as of 2026-04-17.

### Working VM Config (`/etc/pve/qemu-server/102.conf`)

```
agent: 0
balloon: 0
bios: ovmf
boot: order=ide0;virtio0;ide2;net0
cores: 4
cpu: host
efidisk0: local:102/vm-102-disk-0.qcow2,efitype=4m,size=528K
ide0: local:102/vm-102-disk-3.raw,cache=unsafe
ide2: local:102/vm-102-disk-2.raw,cache=unsafe
machine: q35
memory: 8192
name: macos-sonoma
net0: virtio=BC:24:11:03:D8:94,bridge=vmbr0
numa: 0
ostype: other
scsihw: virtio-scsi-single
smbios1: uuid=5b6b4135-f2aa-4858-9398-98d3a6d26217
sockets: 1
tablet: 0
vga: vmware
virtio0: local:102/vm-102-disk-1.qcow2,discard=on,iothread=1,size=64G
vmgenid: 39a269d4-5548-4a22-af7f-37517973a963
args: -device isa-applesmc,osk="ourhardworkbythesewordsguardedpleasedontsteal(c)AppleComputerInc" -smbios type=2 -cpu Skylake-Client-v4,vendor=GenuineIntel,+invtsc,+hypervisor,kvm=on,vmware-cpuid-freq=on -device qemu-xhci,id=xhci -device usb-kbd,bus=xhci.0 -device usb-tablet,bus=xhci.0 -global nec-usb-xhci.msi=off -global ICH9-LPC.acpi-pci-hotplug-with-bridge-support=off
```

### Disk Layout
| File | Role |
|------|------|
| `vm-102-disk-0.qcow2` | EFI disk (528K) |
| `vm-102-disk-1.qcow2` | macOS main disk (64GB, Macintosh HD APFS) |
| `vm-102-disk-2.raw` | macOS BaseSystem installer (3GB, keep for recovery) |
| `vm-102-disk-3.raw` | OpenCore-custom bootloader (150MB, copied from ISO store) |

### macOS Account
| Field | Value |
|-------|-------|
| Full name | macpc |
| Account name | macpc |
| Password | 1234 |

### Key Fixes Applied (vs original broken config)
1. **OSK missing** → added `-device isa-applesmc,osk="ourhardwork..."` to args
2. **`-smbios type=2` missing** → added to args
3. **OpenCore mounted as `media=cdrom`** → changed to `cache=unsafe`, moved from ISO store to VM images dir (Proxmox rejects ISO-store files without `media=cdrom`)
4. **`cpu: kvm64`** → changed to `host`

### Boot Procedure (each VM start)
OpenCore picker appears → select:
- **macOS Installer** — if install still in progress
- **Macintosh HD** — normal boot to desktop

### Completed Setup (Session 5)
- ✅ SSH key auth: `ssh macpc@192.168.1.110` (no password, key at `~/.ssh/id_ed25519`)
- ✅ Homebrew installed at `/usr/local/bin/brew` (Intel path)
- ✅ Sudoers: `macpc ALL=(ALL) NOPASSWD: ALL` (required for brew cask installs)
- ✅ BlackHole-2ch 0.6.1 installed
- ✅ Chrome installed (via `googlechrome.pkg`)
- ✅ Zoom Workplace installed (via `ZoomInstallerIT.pkg`)
- ✅ Phase 0 audio test PASSED — two simultaneous streams confirmed in Chrome

### Audio Device Fix
VM 102 had no audio device by default. Added via PVE shell:
```bash
qm set 102 -audio0 device=ich9-intel-hda,driver=none
```
**Note:** `driver=spice` fails — VM uses `vga: vmware`, not SPICE display.

### SSH from Windows to macOS VM
```bash
ssh macpc@192.168.1.110   # key auth, no password prompt
```

### Brew Install Notes
- Intel macOS VM → Homebrew at `/usr/local/bin/brew` (NOT `/opt/homebrew`)
- Brew cask installs need passwordless sudo — added to `/etc/sudoers`
- Run brew as user (macpc), NOT root

### Phase 0 Test (PASSED)
Served from VM itself:
```bash
ssh macpc@192.168.1.110 'cd /tmp && python3 -m http.server 8080 &'
# Then in Chrome on VM: http://localhost:8080/test-audio.html
```
Result: mic + BlackHole 2ch both listed, audio level detected on BlackHole stream.

---

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
