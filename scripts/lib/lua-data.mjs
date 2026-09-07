import fengari from "fengari";
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;

export function evaluateLuaData(chunks, expression) {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  const execute = (code) => {
    if (lauxlib.luaL_dostring(state, to_luastring(code)) !== lua.LUA_OK) throw new Error(to_jsstring(lua.lua_tostring(state, -1)));
  };
  const value = (index) => {
    const type = lua.lua_type(state, index);
    if (type === lua.LUA_TNUMBER) return lua.lua_tonumber(state, index);
    if (type === lua.LUA_TSTRING) return to_jsstring(lua.lua_tostring(state, index));
    if (type === lua.LUA_TBOOLEAN) return lua.lua_toboolean(state, index);
    if (type === lua.LUA_TNIL) return null;
    if (type !== lua.LUA_TTABLE) throw new Error(`Unsupported Lua data type ${type}`);
    const absolute = lua.lua_absindex(state, index);
    const result = {};
    lua.lua_pushnil(state);
    while (lua.lua_next(state, absolute)) {
      const key = lua.lua_type(state, -2) === lua.LUA_TNUMBER ? lua.lua_tonumber(state, -2) : to_jsstring(lua.lua_tostring(state, -2));
      result[key] = value(-1);
      lua.lua_pop(state, 1);
    }
    return result;
  };
  try {
    execute("io=nil; os=nil; package=nil; debug=nil; dofile=nil; loadfile=nil; require=function() end");
    for (const chunk of chunks) execute(chunk);
    execute(`return ${expression}`);
    return value(-1);
  } finally { lua.lua_close(state); }
}