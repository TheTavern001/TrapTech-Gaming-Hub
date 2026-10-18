# Admin Operations Guide & Price Structure

**Updated:** October 18, 2026  
**Security:** Secret route (`/<ADMIN_PATH>/`), TOTP + backup codes, roles (moderator < admin < owner), CSRF, lockouts, no public `/admin`. Full unconstrained access to every Hub system.

## Access
- Real `ADMIN_PATH` lives only in Deplexo Environment (not in repo).
- Owner account seeded from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env until set in-app.
- Owner can create additional admin/moderator accounts.
- Truly private: IP considerations + MFA recommended for production; audit log on every override.

## Price & Fee Structure

| Item | Suggested Structure | Notes |
|------|---------------------|-------|
| Brand Sponsorship / Listing Fee | Flat fee or tier % of prize value per giveaway | Collected before campaign goes live |
| Hub Credit Bundles | Optional purchase (cosmetic only) | No cash value |
| Cosmetic Packs | Common / Rare / Legendary fixed Credit prices | Earn by playing or buy |
| Season Pass | Optional premium track | Cosmetic rewards only |

**Hub Credits Policy (updated):**
> Cosmetic only. Hub Credits can be earned by playing or optionally purchased. They unlock cosmetics only, have no cash value, cannot be sold, traded, transferred or withdrawn, and cannot buy giveaway entries or game advantages.  
> **Exception (opt-in):** Users may trade cosmetic items (skins, badges, frames) peer-to-peer. Credits themselves remain non-tradable. Sharing of showcase achievements/cosmetics (Xbox-style) can be toggled off in Privacy settings.

## Admin Action Checklist

### Brand & Giveaway Management
- [ ] Review & approve/deny incoming Giveaway Briefs
- [ ] Set start/end timestamps, entry rules, audiences (Open / Affiliated / Invite-only)
- [ ] Trigger automated random winner selection (verifiable seed)
- [ ] Send direct Potato Chat invite / notification to winner
- [ ] Blacklist brands that fail to fulfill
- [ ] Manage featured brands and affiliation rules

### Game Library & Cosmetics
- [ ] Swap/update game graphics, WebGL assets, mechanics, thumbnails
- [ ] Manage cosmetic items (create/edit/delete, set rarity, enable/disable trading)
- [ ] Toggle cosmetic sharing privacy defaults
- [ ] Approve new games into library (target ~500, AAA quality)

### User & System Security
- [ ] Review flagged accounts & bot detection logs
- [ ] Ban / shadow-ban / reset passwords
- [ ] Full audit trail of every admin action
- [ ] Backup management & restore drills

## Full Hub Access
Admins have unconstrained override rights on:
- Game configurations & library
- Cosmetic inventories & trading rules
- User accounts & affiliations
- Giveaway campaigns & draws
- Shop, achievements, quests, payments flags
- All private data and logs
