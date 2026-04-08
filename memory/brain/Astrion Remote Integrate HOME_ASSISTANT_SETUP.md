# Astrion Remote + Home Assistant Setup

## Requirements

- Running Home Assistant
- Local network access
- Astrion powered on

---

## Device Discovery

1. Open Home Assistant
2. Go to Settings
3. Devices & Services
4. Click Add Integration

Astrion should auto-discover.

---

## Entity Assignment

Recommended entities:

- Lights
- Covers
- Climate
- Media Players
- Scripts
- Scenes

---

## Scene Control Example

Example:

Morning Scene:
- Lights ON
- Curtains OPEN
- AC ON
- Music START

Assign scene to Astrion button.

---

## Dashboard Mode

Astrion can operate as:

- Scene remote
- Room controller
- Full dashboard viewer

---

## Best Practices

- Keep automations local
- Avoid cloud-only devices
- Use grouped entities