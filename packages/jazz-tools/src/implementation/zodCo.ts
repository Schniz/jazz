import { CoValueUniqueness } from "cojson";
import z from "zod";
import {
  Account,
  AccountCreationProps,
  AccountInstance,
  AccountSchema,
  AnonymousJazzAgent,
  AnyCoMapSchema,
  CoFeed,
  CoFeedSchema,
  CoListSchema,
  CoMapSchema,
  CoRecordSchema,
  FileStream,
  FileStreamSchema,
  Group,
  ImageDefinition,
  zodSchemaToCoSchema,
} from "../internal.js";

export const coMapDefiner = <Shape extends z.core.$ZodLooseShape>(
  shape: Shape,
): CoMapSchema<Shape> => {
  const objectSchema = z.object(shape).meta({
    collaborative: true,
  });

  type CleanedType = Pick<
    typeof objectSchema,
    "_zod" | "def" | "~standard" | "catchall"
  >;

  const coMapSchema = objectSchema as unknown as CleanedType & {
    collaborative: true;
    create: CoMapSchema<Shape>["create"];
    load: CoMapSchema<Shape>["load"];
    subscribe: CoMapSchema<Shape>["subscribe"];
    findUnique: CoMapSchema<Shape>["findUnique"];
    catchall: CoMapSchema<Shape>["catchall"];
    withHelpers: CoMapSchema<Shape>["withHelpers"];
  };

  coMapSchema.collaborative = true;

  coMapSchema.create = function (this: CoMapSchema<Shape>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).create(...args);
  } as CoMapSchema<Shape>["create"];

  coMapSchema.load = function (this: CoMapSchema<Shape>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).load(...args);
  } as CoMapSchema<Shape>["load"];

  coMapSchema.subscribe = function (this: CoMapSchema<Shape>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).subscribe(...args);
  } as CoMapSchema<Shape>["subscribe"];

  coMapSchema.findUnique = function (
    this: CoMapSchema<Shape>,
    unique: CoValueUniqueness["uniqueness"],
    ownerID: string,
    as?: Account | Group | AnonymousJazzAgent,
  ) {
    return (zodSchemaToCoSchema(this) as any).findUnique(unique, ownerID, as);
  } as CoMapSchema<Shape>["findUnique"];

  const oldCatchall = coMapSchema.catchall;
  coMapSchema.catchall = function (
    this: CoMapSchema<Shape>,
    schema: z.core.$ZodType,
  ) {
    return { ...this, ...oldCatchall(schema) } as any;
  } as CoMapSchema<Shape>["catchall"] as any;

  coMapSchema.withHelpers = function (
    this: CoMapSchema<Shape>,
    helpers: object,
  ) {
    return { ...this, ...helpers };
  } as CoMapSchema<Shape>["withHelpers"];

  return coMapSchema as unknown as CoMapSchema<Shape>;
};

const coAccountDefiner = <
  Shape extends {
    profile: AnyCoMapSchema<{ name: z.core.$ZodString<string> }>;
    root: AnyCoMapSchema;
  },
>(
  shape: Shape = {
    profile: co.map({ name: z.string() }),
    root: co.map({}),
  } as unknown as Shape,
): AccountSchema<Shape> => {
  const objectSchema = z.object(shape).meta({
    collaborative: true,
  });

  type CleanedType = Pick<
    typeof objectSchema,
    "_zod" | "def" | "~standard" | "catchall"
  >;

  const accountSchema = objectSchema as unknown as CleanedType & {
    collaborative: true;
    builtin: "Account";
    migration?: (
      account: AccountInstance<Shape>,
      creationProps?: AccountCreationProps,
    ) => void;

    create: AccountSchema<Shape>["create"];
    createAs: AccountSchema<Shape>["createAs"];
    getMe: AccountSchema<Shape>["getMe"];
    load: AccountSchema<Shape>["load"];
    subscribe: AccountSchema<Shape>["subscribe"];
    withHelpers: AccountSchema<Shape>["withHelpers"];
    withMigration: AccountSchema<Shape>["withMigration"];
  };

  accountSchema.collaborative = true;
  accountSchema.builtin = "Account";

  accountSchema.create = function (this: AccountSchema<Shape>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).create(...args);
  } as AccountSchema<Shape>["create"];

  accountSchema.createAs = function (
    this: AccountSchema<Shape>,
    ...args: any[]
  ) {
    return (zodSchemaToCoSchema(this) as any).createAs(...args);
  } as AccountSchema<Shape>["createAs"];

  accountSchema.getMe = function (this: AccountSchema<Shape>) {
    return (zodSchemaToCoSchema(this) as any).getMe();
  } as AccountSchema<Shape>["getMe"];

  accountSchema.load = function (this: AccountSchema<Shape>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).load(...args);
  } as AccountSchema<Shape>["load"];

  accountSchema.subscribe = function (
    this: AccountSchema<Shape>,
    ...args: any[]
  ) {
    return (zodSchemaToCoSchema(this) as any).subscribe(...args);
  } as AccountSchema<Shape>["subscribe"];

  accountSchema.withHelpers = function (
    this: CoMapSchema<Shape>,
    helpers: object,
  ) {
    return { ...this, ...helpers };
  } as CoMapSchema<Shape>["withHelpers"];

  accountSchema.withMigration = function (
    this: AccountSchema<Shape>,
    migration: (
      account: AccountInstance<Shape>,
      creationProps?: AccountCreationProps,
    ) => void,
  ) {
    return { ...this, migration };
  } as AccountSchema<Shape>["withMigration"];

  return accountSchema as unknown as AccountSchema<Shape>;
};

const coRecordDefiner = <
  K extends z.core.$ZodString<string>,
  V extends z.core.$ZodType,
>(
  _keyType: K,
  valueType: V,
): CoRecordSchema<K, V> => {
  return coMapDefiner({}).catchall(valueType) as unknown as CoRecordSchema<
    K,
    V
  >;
};

const coListDefiner = <T extends z.core.$ZodType>(
  element: T,
): CoListSchema<T> => {
  const arraySchema = z.array(element).meta({
    collaborative: true,
  });

  type CleanedType = Pick<typeof arraySchema, "_zod" | "def" | "~standard">;

  const coListSchema = arraySchema as unknown as CleanedType & {
    collaborative: true;
    create: CoListSchema<T>["create"];
    load: CoListSchema<T>["load"];
    subscribe: CoListSchema<T>["subscribe"];
  };

  coListSchema.collaborative = true;

  coListSchema.create = function (this: CoListSchema<T>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).create(...args);
  } as CoListSchema<T>["create"];

  coListSchema.load = function (this: CoListSchema<T>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).load(...args);
  } as CoListSchema<T>["load"];

  coListSchema.subscribe = function (this: CoListSchema<T>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).subscribe(...args);
  } as CoListSchema<T>["subscribe"];

  return coListSchema;
};

const coFeedDefiner = <T extends z.core.$ZodType>(
  element: T,
): CoFeedSchema<T> => {
  const placeholderSchema = z.instanceof(CoFeed);

  const coFeedSchema = placeholderSchema as unknown as Pick<
    typeof placeholderSchema,
    "_zod" | "def" | "~standard"
  > & {
    collaborative: true;
    builtin: "CoFeed";
    element: T;
    create: CoFeedSchema<T>["create"];
    load: CoFeedSchema<T>["load"];
    subscribe: CoFeedSchema<T>["subscribe"];
  };

  coFeedSchema.collaborative = true;
  coFeedSchema.builtin = "CoFeed";
  coFeedSchema.element = element;

  coFeedSchema.create = function (this: CoFeedSchema<T>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).create(...args);
  } as CoFeedSchema<T>["create"];

  coFeedSchema.load = function (this: CoFeedSchema<T>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).load(...args);
  } as CoFeedSchema<T>["load"];

  coFeedSchema.subscribe = function (this: CoFeedSchema<T>, ...args: any[]) {
    return (zodSchemaToCoSchema(this) as any).subscribe(...args);
  } as CoFeedSchema<T>["subscribe"];

  return coFeedSchema as unknown as CoFeedSchema<T>;
};

export const coFileStreamDefiner = (): FileStreamSchema => {
  const placeholderSchema = z.instanceof(FileStream);

  const fileStreamSchema = placeholderSchema as unknown as Pick<
    typeof placeholderSchema,
    "_zod" | "def" | "~standard"
  > & {
    collaborative: true;
    builtin: "FileStream";
    create: (typeof FileStream)["create"];
  };

  fileStreamSchema.collaborative = true;
  fileStreamSchema.builtin = "FileStream";

  fileStreamSchema.create = function (options: any) {
    return FileStream.create(options);
  } as (typeof FileStream)["create"];

  return fileStreamSchema;
};

export const co = {
  map: coMapDefiner,
  record: coRecordDefiner,
  list: coListDefiner,
  feed: coFeedDefiner,
  fileStream: coFileStreamDefiner,
  image: (): typeof ImageDefinition => {
    return ImageDefinition;
  },
  account: coAccountDefiner,
};
