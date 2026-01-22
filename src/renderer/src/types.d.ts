export {};

declare global {
  interface Window {
    electron?: {
      ipcRenderer: {
        send: (channel: string, data?: unknown) => void;
        on: (channel: string, listener: (...args: any[]) => void) => void;
        off: (channel: string, listener: (...args: any[]) => void) => void;
        invoke: (channel: string, data?: unknown) => Promise<any>;
      };
    };
  }
}
