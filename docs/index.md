Better Termix adds four small fixes to the Termix interface. Settings are saved to your account, so they follow you to every PC, phone and tablet you sign in from.

## Turn it on

1. In Settings, General, turn on Plugin developer mode.
2. In Plugins, choose Install from file and pick `better-termix-1.0.2.tmxplug`.
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
