/**
 * Builds exact-optional request arguments without forwarding undefined values.
 * Values such as null, false, 0 and empty strings remain intact.
 */
type OptionalValue<T> = 0 extends (1 & T) ? false : undefined extends T ? true : false;
type Defined<T extends object> = {
  [K in keyof T as OptionalValue<T[K]> extends true ? never : K]: T[K];
} & {
  [K in keyof T as OptionalValue<T[K]> extends true ? K : never]?: Exclude<T[K], undefined>;
};

export function omitUndefined<T extends object>(value: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Defined<T>;
}
