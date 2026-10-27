# Changelog

## 1.0.3

### Added

- An opt-in admin setting to prevent disappearing or overwritten terminal input by disabling SSH Terminal predictive local echo; restores the original bundle when turned off

## 1.0.2

### Added

- Status style: show host status as a colored name, a dot left of the name, or both

### Changed

- The sidebar status setting is now called Show host status in the sidebar

## 1.0.1

### Fixed

- Host names now change color with the Simple preset and any other layout that hides the status stripe
- With the white flash fix on, a theme from a plugin (like Dracula or Nord) no longer turns white after a reload, and changing theme works again

## 1.0.0

### Added

- Hide host IP addresses in the dashboard's Host Status list and pinned hosts
- Sidebar host names turn green when online and red when offline, with your own colors
- An optional boot script that stops the white flash before your theme on reload
- An interface size between Normal and Large
