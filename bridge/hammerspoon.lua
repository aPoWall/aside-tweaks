-- aside tweaks · palette from anywhere (⌥⌘K). Paste into ~/.hammerspoon/init.lua.
-- Opens the desk bridge's signal page in Aside; the extension turns it into the palette.
-- The port comes from ~/.config/aside-tweaks/desk.json (49321 when absent).
hs.hotkey.bind({"cmd", "alt"}, "K", function()
  local port = 49321
  local f = io.open(os.getenv("HOME") .. "/.config/aside-tweaks/desk.json", "r")
  if f then
    local ok, conf = pcall(hs.json.decode, f:read("*a"))
    f:close()
    if ok and type(conf) == "table" and tonumber(conf.port) then port = tonumber(conf.port) end
  end
  hs.execute('open -a Aside "http://127.0.0.1:' .. port .. '/aside-tweaks/palette"')
end)
