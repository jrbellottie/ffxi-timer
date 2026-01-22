import { contextBridge, ipcRenderer } from "electron";

// Expose a single stable API surface:
contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data),

    on: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_event, ...args) => listener(...args));
    },

    off: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.off(channel, listener as any);
    },

    invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),
  },
});
