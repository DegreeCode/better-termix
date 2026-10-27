Better Termix adds small interface fixes and an optional terminal input workaround to Termix. Settings are saved to your account, so they follow you to every PC, phone and tablet you sign in from.

## Turn it on

1. In Settings, General, turn on Plugin developer mode.
2. In Plugins, choose Install from file and pick `better-termix-1.0.3.tmxplug`.
3. Enable Better Termix, then reload the page.
4. Change the options in Settings, under Better Termix.

## Hide host IP addresses

On by default. The IP next to each host in the dashboard's Host Status list, and the address next to pinned hosts, is hidden. Only the display changes: hosts still connect with their IP, and the address can still be seen in the page source and API responses. To hide the address under each host in the sidebar too, turn off the address field in Customize Sidebar.

## Show host status in the sidebar

On by default. Shows whether each host in the sidebar is online or offline. Pick how with Status style:

- Color the name: the name turns green when online and red when offline (the default)
- Dot left of the name: a green or red dot before the name; a gray dot while it is still being checked
- Both

Set your own Online color and Offline color as any CSS color, like `#22c55e`. It works with every interface preset, with or without status stripes. If you turn off badges in Customize Sidebar, it falls back to the status stripe.

## Stop the white flash on reload

An admin setting, off by default. Termix paints its default white background until its JavaScript has loaded and put your theme on the page. Turn on Stop the white flash on reload and the plugin adds a small `better-termix-boot.js` to Termix's `index.html`, which puts your theme, interface size and accent color on the page before anything is drawn.

This edits a Termix file on the server (`/app/html/index.html` in Docker). The plugin adds it again each time Termix starts, so it survives updating the Docker image, and removes it when you turn the setting off or disable the plugin. If Termix's frontend is somewhere else, set Frontend folder. The first reload after turning it on, and after changing theme on a new device, may still flash once while the plugin learns your theme.

## A size between Normal and Large

Turn on Use a size between Normal and Large. It uses 15.5 pixels by default (Normal is 14 and Large is 17); change it with Size in pixels. It replaces the size picked in Appearance while it is on.

## Fix disappearing text while editing terminal input

An admin setting, off by default. If moving the cursor into the middle of a command and typing makes existing text disappear or look overwritten, turn on Fix disappearing text while editing terminal input. Then reload the page and reconnect the terminal. It disables SSH Terminal's predictive local echo for all users, so typed text waits for the server's response. High latency connections may feel slower.

[SSH Terminal's local echo implementation](https://github.com/Termix-SSH/Plugin-SSH-Terminal/blob/d8b91203cfdaa671bac24b56439b3476b63e8f19/src/frontend/lib/terminal-local-echo.ts) predicts printable characters without accounting for insertion in the middle of existing input. This workaround targets that behavior; it does not repair shell prompt width errors or unrelated rendering problems. It keeps your saved SSH Terminal settings intact.

This edits the bundled SSH Terminal's `dist/frontend.js` on the Termix server (normally `/app/dist/plugins/ssh-terminal/dist/frontend.js` in Docker). If it cannot be found, set SSH Terminal frontend file to its full path. The bundle must be from the `ssh-terminal` plugin and contain the supported local echo resolver; unrecognized builds are left unchanged and a warning is logged. See Termix's server logs if the option has no effect.

The patch is applied on startup and when its settings change. After updating SSH Terminal, restart Better Termix to apply it again. Turning the option off or disabling Better Termix removes only its marked override, preserving any other bundle changes. Reload and reconnect after disabling too. Installations with read-only plugin files cannot use this workaround.
