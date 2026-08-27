-- aside tweaks · palette from anywhere (⌥⌘K). Paste into ~/.hammerspoon/init.lua.
-- Opens the desk bridge's signal page in Aside; the extension turns it into the palette.
hs.hotkey.bind({"cmd", "alt"}, "K", function()
  hs.execute('open -a Aside "http://127.0.0.1:49321/aside-tweaks/palette"')
end)
