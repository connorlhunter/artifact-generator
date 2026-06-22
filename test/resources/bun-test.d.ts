declare module "bun:test" {
  type AnyFunction = (...args: any[]) => any;

  interface Mock<T extends AnyFunction = AnyFunction> {
    (...args: Parameters<T>): ReturnType<T>;
    mockClear(): this;
    mockImplementation(implementation: T): this;
    mockRejectedValueOnce(value: unknown): this;
    mockReset(): this;
    mockResolvedValue(value: Awaited<ReturnType<T>>): this;
    mockResolvedValueOnce(value: Awaited<ReturnType<T>>): this;
    mockReturnValue(value: ReturnType<T>): this;
    mockReturnValueOnce(value: ReturnType<T>): this;
  }

  export const afterAll: (callback: () => void | Promise<void>) => void;
  export const afterEach: (callback: () => void | Promise<void>) => void;
  export const beforeAll: (callback: () => void | Promise<void>) => void;
  export const beforeEach: (callback: () => void | Promise<void>) => void;
  export const describe: (name: string, callback: () => void) => void;
  export const expect: any;
  export const mock: {
    <T extends AnyFunction = AnyFunction>(implementation?: T): Mock<T>;
    clearAllMocks(): void;
    module(id: string, factory: () => Record<string, unknown>): void | Promise<void>;
    restore(): void;
  };
  export function spyOn<T extends object, K extends keyof T>(
    object: T,
    method: K,
  ): Mock<Extract<T[K], AnyFunction>>;
  export const test: (name: string, callback: () => void | Promise<void>) => void;
}
