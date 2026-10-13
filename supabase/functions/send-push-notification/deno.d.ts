/**
 * Minimal Deno global type stubs for VS Code IntelliSense.
 *
 * These stubs allow VS Code's Node.js TypeScript server to understand the
 * Deno-specific APIs used in this Edge Function without needing the
 * VS Code Deno extension.
 *
 * They do NOT affect the Deno runtime — Deno ignores .d.ts files.
 */

declare namespace Deno {
  /** Access to environment variables (server-side only). */
  interface Env {
    /** Returns the value of the environment variable, or undefined if not set. */
    get(key: string): string | undefined;
    /** Sets an environment variable. */
    set(key: string, value: string): void;
    /** Returns true if the environment variable is set. */
    has(key: string): boolean;
    /** Deletes an environment variable. */
    delete(key: string): void;
    /** Returns all environment variables as a plain object. */
    toObject(): { [key: string]: string };
  }

  /** Environment variable accessor. */
  const env: Env;

  /** Handler function for Deno.serve. */
  type ServeHandler = (request: Request) => Response | Promise<Response>;

  /** Options for Deno.serve. */
  interface ServeOptions {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    onListen?: (params: { hostname: string; port: number }) => void;
    onError?: (error: unknown) => Response | Promise<Response>;
  }

  /**
   * Starts an HTTP server. Used as the Edge Function entry point.
   * @param handler - The request handler function.
   * @param options - Optional server configuration.
   */
  function serve(handler: ServeHandler, options?: ServeOptions): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
