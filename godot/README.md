# Trap Tech Gaming Hub — Godot Rebuild

This is the new Godot 4 starting point. Open it locally, test, and give feedback. I will keep adding scenes, UI, and games on this branch.

## Open it today
1. Install Godot 4.3+ (standard build is fine).
2. Clone or pull this repo.
3. In Godot: Project → Import → select the `godot/project.godot` file.
4. Press F5 to run. You should see the dark hub with the title and a Play button.

## What is here right now
- Main hub scene (`scenes/hub.tscn`)
- Simple controller (`scripts/hub.gd`)
- Mobile-friendly viewport settings

## Next (I will add these as we go)
- Real game scenes (starting with the strongest core titles)
- Hub navigation, game grid, and account shell
- Score submission hook (can talk to the existing backend or a new one)
- HTML5 export so it can replace the Deplexo web build

The old Node/Deplexo code stays on `main` for reference. This branch is the new direction.
